from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from app.middleware.auth import get_current_user
from app.database import get_db
from app.main import get_ws_manager
from app.ml.pest import predict_pest, load_pest_model, _classes
from app.integration_engine import on_pest_detected
import os
import uuid
import time

router = APIRouter(prefix="/api/v1/pest", tags=["pest"])

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads", "pest"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/detect")
async def detect_pest(
    farm_id: int = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager)
):
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Save file locally to serve as static asset
    filename = f"{uuid.uuid4()}_{int(time.time())}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(image_bytes)
        
    image_url = f"/static/uploads/pest/{filename}"

    from app.config import settings

    # Run ML prediction
    try:
        pred = predict_pest(image_bytes, min_confidence=settings.pest_min_confidence)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as ex:
        import traceback
        print("Error during pest prediction:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pest detection failed: {str(ex)}")

    is_uncertain = pred.get("is_uncertain", False)

    # Split treatments into organic and chemical
    treatments = pred["treatment"].split(" | ")
    organic = treatments[0] if len(treatments) > 0 else "Apply organic soap spray."
    chemical = treatments[1] if len(treatments) > 1 else "Apply standard chemical controls if severe."

    # Save to pest_scans table
    await db.execute("""
        INSERT INTO pest_scans
          (farm_id, user_id, image_url, pest_name, infestation, organic_ctrl, chemical_ctrl, treatment)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, farm_id, user["id"], image_url, pred["pest_name"], pred["severity"], organic, chemical, pred["treatment"])

    # Fire integration cascade only if reliable identification
    if not is_uncertain:
        score = await on_pest_detected(
            farm_id=farm_id,
            pest=pred["pest_name"],
            infestation_level=pred["severity"],
            db=db,
            ws_manager=ws_manager
        )

    # Real Top-5 from model output
    top5 = pred.get("top_predictions", [])

    return {
        "status":            pred.get("status", "success"),
        "is_uncertain":      is_uncertain,
        "pest_name":         pred["pest_name"],
        "confidence":        round(pred["confidence"] * 100, 1),
        "infestation_level": pred["severity"],
        "organic_control":   organic,
        "chemical_control":  chemical,
        "treatment":         pred["treatment"],
        "top5":              top5,
        "image_url":         image_url,
        "message":           pred.get("message", "Pest identified.")
    }

@router.get("/history/{farm_id}")
async def pest_history(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    rows = await db.fetch("""
        SELECT * FROM pest_scans
        WHERE farm_id=$1
        ORDER BY scanned_at DESC LIMIT 10
    """, farm_id)
    return [dict(r) for r in rows]
