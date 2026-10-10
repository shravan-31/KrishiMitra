from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from app.middleware.auth import get_current_user
from app.database import get_db
from app.websocket import get_ws_manager
from app.ml.pest import predict_pest, load_pest_model, _classes
from app.integration_engine import on_pest_detected
from app.config import settings
import os
import uuid
import time

import json

router = APIRouter(prefix="/api/v1/pest", tags=["pest"])

UPLOAD_DIR = os.path.join(os.path.abspath(settings.upload_dir), "pest")
os.makedirs(UPLOAD_DIR, exist_ok=True)

CATALOG_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "translations_catalog.json")

def _get_localized_text(category: str, key: str, lang: str = "en") -> str:
    if not key:
        return ""
    try:
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            cat = json.load(f)
        item = cat.get(category, {}).get(key, {})
        if isinstance(item, dict):
            return item.get(lang) or item.get("en") or key
        return str(item) if item else key
    except Exception:
        return key


async def verify_farm_access(farm_id: int, user_id: int, db) -> dict:
    """Verifies that the requested farm exists and belongs to the authenticated user."""
    farm = await db.fetchrow("SELECT id, user_id, name FROM farms WHERE id=$1", farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this farm boundary")
    return dict(farm)


@router.post("/detect")
async def detect_pest(
    farm_id: int = Form(...),
    file: UploadFile = File(...),
    lang: str = Form("en"),
    user=Depends(get_current_user),
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager)
):
    # Step 1: Enforce farm ownership authorization
    farm = await verify_farm_access(farm_id, user["id"], db)

    # Step 2: Read image bytes
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Step 3: Run pest prediction with presence/uncertainty verification
    try:
        pred = predict_pest(image_bytes, min_confidence=settings.pest_min_confidence)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as ex:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pest detection failed: {str(ex)}")

    status = pred.get("status", "success")
    is_valid = pred.get("is_valid", True)
    is_uncertain = pred.get("is_uncertain", False)

    # Step 4: Handle Invalid / Non-insect image
    if not is_valid or status in ("INVALID_IMAGE", "NO_SUPPORTED_PLANT_DETECTED"):
        return {
            "status":                       status,
            "status_code":                  pred.get("status_code", status),
            "is_valid":                     False,
            "is_uncertain":                 True,
            "pest_name":                    None,
            "pest_code":                    None,
            "confidence":                   0.0,
            "infestation_level":            "NOT_ASSESSED",
            "infestation_code":             "NOT_ASSESSED",
            "severity":                     "NOT_ASSESSED",
            "organic_control":              "",
            "chemical_control":             "",
            "treatment":                    "",
            "treatment_eligibility":        False,
            "treatment_eligibility_reason": pred.get("treatment_eligibility_reason", "Invalid image; no pest analysis eligible."),
            "top5":                         [],
            "image_url":                    None,
            "message":                      pred.get("message", "Invalid image. Please upload a clear photo of an insect pest."),
            "model_limitations":            pred.get("model_limitations", "Model requires agricultural imagery."),
            "localized_pest":               None,
            "localized_infestation":        _get_localized_text("severities", "NOT_ASSESSED", lang),
            "localized_status":             _get_localized_text("statuses", status, lang)
        }

    # Step 5: Save valid image locally
    filename = f"{uuid.uuid4()}_{int(time.time())}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(image_bytes)
    image_url = f"/static/uploads/pest/{filename}"

    # Step 6: Handle Uncertain / Inconclusive pest presence
    if is_uncertain or status == "UNCERTAIN":
        return {
            "status":                       "UNCERTAIN",
            "status_code":                  "UNCERTAIN",
            "is_valid":                     True,
            "is_uncertain":                 True,
            "pest_name":                    None,
            "pest_code":                    None,
            "confidence":                   round(pred["confidence"] * 100, 1) if pred["confidence"] <= 1.0 else pred["confidence"],
            "infestation_level":            "NOT_ASSESSED",
            "infestation_code":             "NOT_ASSESSED",
            "severity":                     "NOT_ASSESSED",
            "organic_control":              "",
            "chemical_control":             "",
            "treatment":                    "",
            "treatment_eligibility":        False,
            "treatment_eligibility_reason": pred.get("treatment_eligibility_reason", "Pest presence inconclusive. Chemical spray advice withheld."),
            "top5":                         pred.get("top_predictions", []),
            "image_url":                    image_url,
            "message":                      pred.get("message", "Inconclusive pest presence. Manual inspection recommended before chemical application."),
            "model_limitations":            pred.get("model_limitations", "Classifier cannot verify pest absence or count insects."),
            "localized_pest":               None,
            "localized_infestation":        _get_localized_text("severities", "NOT_ASSESSED", lang),
            "localized_status":             _get_localized_text("statuses", "UNCERTAIN", lang)
        }

    # Step 7: Confirmed detection -> Save to pest_scans table
    treatments = pred.get("treatment", "").split(" | ")
    organic = pred.get("organic_control") or (treatments[0] if len(treatments) > 0 else "")
    chemical = pred.get("chemical_control") or (treatments[1] if len(treatments) > 1 else "")

    await db.execute("""
        INSERT INTO pest_scans
          (farm_id, user_id, image_url, pest_name, infestation, organic_ctrl, chemical_ctrl, treatment)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, farm_id, user["id"], image_url, pred["pest_name"], pred["infestation_level"], organic, chemical, pred["treatment"])

    # Step 8: Fire integration cascade only for confirmed detections
    score = await on_pest_detected(
        farm_id=farm_id,
        pest=pred["pest_name"],
        infestation_level=pred["infestation_level"],
        db=db,
        ws_manager=ws_manager
    )
    top5 = [
        {
            "class_name": tp.get("class_name", ""),
            "label": tp.get("label", ""),
            "confidence": round(tp.get("confidence", 0.0) * 100, 1) if tp.get("confidence", 0.0) <= 1.0 else tp.get("confidence", 0.0)
        }
        for tp in pred.get("top_predictions", [])
    ]

    return {
        "status":                       "PEST_DETECTED",
        "status_code":                  "PEST_DETECTED",
        "is_valid":                     True,
        "is_uncertain":                 False,
        "pest_name":                    pred["pest_name"],
        "pest_code":                    pred.get("pest_code", pred["pest_name"]),
        "confidence":                   round(pred["confidence"] * 100, 1) if pred["confidence"] <= 1.0 else pred["confidence"],
        "infestation_level":            pred["infestation_level"],
        "infestation_code":             pred.get("infestation_code", "NOT_ASSESSED"),
        "severity":                     pred.get("severity", "NOT_ASSESSED"),
        "severity_details":             pred.get("severity_details", {}),
        "organic_control":              organic,
        "chemical_control":             chemical,
        "treatment":                    pred["treatment"],
        "treatment_eligibility":        pred.get("treatment_eligibility", True),
        "treatment_eligibility_reason": pred.get("treatment_eligibility_reason", ""),
        "top5":                         top5,
        "image_url":                    image_url,
        "message":                      pred.get("message", "Pest identified."),
        "model_limitations":            pred.get("model_limitations", ""),
        "localized_pest":               _get_localized_text("pests", pred.get("pest_code") or pred["pest_name"], lang),
        "localized_infestation":        _get_localized_text("severities", pred["infestation_level"], lang),
        "localized_status":             _get_localized_text("statuses", "PEST_DETECTED", lang)
    }


@router.get("/history/{farm_id}")
async def pest_history(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # Verify farm ownership against authenticated user
    await verify_farm_access(farm_id, user["id"], db)

    rows = await db.fetch("""
        SELECT * FROM pest_scans
        WHERE farm_id=$1
        ORDER BY scanned_at DESC LIMIT 10
    """, farm_id)
    return [dict(r) for r in rows]
