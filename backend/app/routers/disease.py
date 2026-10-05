from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from app.middleware.auth import get_current_user
from app.database import get_db
from app.main import get_ws_manager
from app.ml.disease import predict_disease, load_disease_model, _classes
from app.integration_engine import on_disease_detected
import os
import uuid
import time
import torch

router = APIRouter(prefix="/api/v1/disease", tags=["disease"])

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads", "disease"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/scan")
async def scan_disease(
    farm_id: int = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager)
):
    # Step 1: Read image bytes
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Step 2: Save locally to serve as static file
    filename = f"{uuid.uuid4()}_{int(time.time())}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(image_bytes)
    
    image_url = f"/static/uploads/disease/{filename}"

    from app.config import settings

    # Step 3: Run ML inference
    try:
        pred = predict_disease(image_bytes, min_confidence=settings.disease_min_confidence)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as ex:
        import traceback
        print("Error during disease prediction:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Leaf analysis failed: {str(ex)}")

    # Extract treatment steps
    treatment_steps = [step.strip() for step in pred["treatment"].split("|") if step.strip()]
    is_healthy = "healthy" in pred["disease_name"].lower()
    is_uncertain = pred.get("is_uncertain", False)

    # Real Top-5 from model output
    top5 = pred.get("top_predictions", [])

    # Step 4: Save to DB
    await db.execute("""
        INSERT INTO disease_scans
          (farm_id, user_id, image_url, crop_name, disease_name,
           confidence, severity, treatment)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    """, farm_id, user["id"], image_url,
         pred["crop_name"], pred["disease_name"],
         float(pred["confidence"]), pred["severity"],
         pred["treatment"])

    # Step 5: Fire integration cascade only if reliable diagnosis
    if not is_uncertain and not is_healthy:
        await on_disease_detected(
            farm_id=farm_id,
            disease=pred["disease_name"],
            severity=pred["severity"],
            confidence=round(float(pred["confidence"]) * 100, 1),
            db=db,
            ws_manager=ws_manager
        )
    elif is_healthy and not is_uncertain:
        # Just update health score positively
        from app.integration_engine import update_health_score
        score = await update_health_score(farm_id, "disease", db)
        await ws_manager.broadcast(farm_id, {
            "event_type": "disease_detected",
            "payload": {"disease_name": pred["disease_name"], "severity": "LOW",
                        "confidence": round(float(pred["confidence"]) * 100, 1), "health_score": score}
        })

    return {
        "status":          pred.get("status", "success"),
        "is_uncertain":    is_uncertain,
        "disease_name":    pred["disease_name"],
        "confidence":      round(float(pred["confidence"]) * 100, 1),
        "severity":        pred["severity"],
        "treatment_steps": treatment_steps,
        "is_healthy":      is_healthy,
        "top5":            top5,
        "image_url":       image_url,
        "message":         pred.get("message", "Diagnosis complete.")
    }

@router.get("/history/{farm_id}")
async def disease_history(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    rows = await db.fetch("""
        SELECT id, farm_id, user_id, image_url, crop_name, disease_name,
               confidence, severity, treatment, scanned_at
        FROM disease_scans
        WHERE farm_id=$1
        ORDER BY scanned_at DESC LIMIT 20
    """, farm_id)
    return [dict(r) for r in rows]
