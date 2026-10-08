from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from app.middleware.auth import get_current_user
from app.database import get_db
from app.main import get_ws_manager
from app.ml.disease import predict_disease, load_disease_model, _classes
from app.integration_engine import on_disease_detected
from app.config import settings
import os
import uuid
import time
import torch

router = APIRouter(prefix="/api/v1/disease", tags=["disease"])

UPLOAD_DIR = os.path.join(os.path.abspath(settings.upload_dir), "disease")
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
    treatment_steps = pred.get("treatment_steps") or [step.strip() for step in pred["treatment"].split("|") if step.strip()]
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

    # ── NEW: Compute Smart Crop Health Alert ──
    from app.services.crop_health_alert import determine_crop_alert_status

    # Get latest pest info for alert context
    pest_row = await db.fetchrow("""
        SELECT pest_name, infestation FROM pest_scans
        WHERE farm_id=$1 ORDER BY scanned_at DESC LIMIT 1
    """, farm_id)

    # Get weather risk level from latest weather alert
    weather_alert_row = await db.fetchrow("""
        SELECT severity FROM alerts
        WHERE farm_id=$1 AND alert_type='WEATHER'
        ORDER BY created_at DESC LIMIT 1
    """, farm_id)
    weather_risk = "LOW"
    if weather_alert_row:
        sev = weather_alert_row["severity"]
        weather_risk = "HIGH" if sev in ("HIGH", "CRITICAL") else ("MEDIUM" if sev == "MEDIUM" else "LOW")

    crop_alert = determine_crop_alert_status(
        disease_name=pred["disease_name"],
        disease_confidence=float(pred["confidence"]),
        disease_severity=pred["severity"],
        is_uncertain=is_uncertain,
        is_healthy=is_healthy,
        pest_name=pest_row["pest_name"] if pest_row else None,
        pest_infestation=pest_row["infestation"] if pest_row else None,
        weather_risk_level=weather_risk,
    )

    # ── Load treatment plan from verified agricultural guidelines ──
    treatment_plan = None
    if not is_uncertain:
        import json as _json
        _gpath = os.path.join(os.path.dirname(__file__), "..", "data", "treatment_guidelines.json")
        try:
            with open(_gpath, "r", encoding="utf-8") as _gf:
                _gdata = _json.load(_gf)
            
            treatments_dict = _gdata.get("treatments", {})
            class_key = pred.get("class_name", "")
            disease_key = pred.get("disease_name", "")
            crop_key = pred.get("crop_name", "")
            composite_key = f"{crop_key}___{disease_key}".replace(" ", "_")

            # Multi-key robust matching
            plan = (
                treatments_dict.get(class_key)
                or treatments_dict.get(disease_key)
                or treatments_dict.get(composite_key)
                or next((v for k, v in treatments_dict.items() if k.lower() in [class_key.lower(), disease_key.lower()]), None)
                or _gdata.get("default_treatment", {})
            )
            
            sev_upper = pred.get("severity", "LOW").upper()
            treatment_plan = {
                "disease": plan.get("disease", pred.get("disease_name", "Unknown")),
                "crop": plan.get("crop", pred.get("crop_name", "Crop")),
                "guidance": plan.get("severity_guidance", {}).get(sev_upper, plan.get("severity_guidance", {}).get("MEDIUM", "Consult local extension officer.")),
                "cultural_practices": plan.get("cultural_practices", []),
                "follow_up_days": plan.get("follow_up_days", 7),
                "monitoring_note": plan.get("monitoring_note", "Re-scan after treatment."),
                "source": "Agricultural Extension Guidelines (ICAR / TNAU / KVK / USDA-ARS)",
            }
        except Exception as _e:
            import logging
            logging.getLogger(__name__).warning(f"Error loading treatment guidelines: {_e}")

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
        "message":         pred.get("message", "Diagnosis complete."),
        "crop_alert":      crop_alert,
        "treatment_plan":  treatment_plan,
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
