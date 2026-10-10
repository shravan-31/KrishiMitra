from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from app.middleware.auth import get_current_user
from app.database import get_db
from app.websocket import get_ws_manager
from app.ml.disease import predict_disease, load_disease_model, _classes
from app.ml.crop_classifier import get_supported_crops, SUPPORTED_CROP_NAMES
from app.integration_engine import on_disease_detected
from app.config import settings
import os
import uuid
import time
import json

router = APIRouter(prefix="/api/v1/disease", tags=["disease"])

UPLOAD_DIR = os.path.join(os.path.abspath(settings.upload_dir), "disease")
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def verify_farm_access(farm_id: int, user_id: int, db) -> dict:
    """Verifies that the requested farm exists and belongs to the authenticated user."""
    farm = await db.fetchrow("SELECT id, user_id, name FROM farms WHERE id=$1", farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this farm boundary")
    return dict(farm)


@router.get("/supported-crops")
async def list_supported_crops():
    """Returns the list of 14 supported crops and their verifiable disease classes."""
    return {
        "status": "success",
        "total_crops": len(SUPPORTED_CROP_NAMES),
        "supported_crops": get_supported_crops()
    }


@router.get("/run-evaluation")
async def run_evaluation_pipeline(samples_per_class: int = 3):
    """
    Triggers the Stage 1 Real-World Model Evaluation pipeline across categories A-F,
    calculates real-world metrics, and saves the report.
    """
    import sys
    if "scripts.evaluate_diagnosis" in sys.modules:
        del sys.modules["scripts.evaluate_diagnosis"]
    import scripts.evaluate_diagnosis
    manifest = scripts.evaluate_diagnosis.generate_evaluation_manifest(samples_per_class=samples_per_class)
    report = scripts.evaluate_diagnosis.evaluate_all_categories(manifest)
    return report


@router.get("/run-translation-validation")
async def run_translation_validation_endpoint():
    """
    Triggers the Stage 4 Automated Translation & Catalog Validation script.
    """
    import sys
    if "scripts.validate_translations" in sys.modules:
        del sys.modules["scripts.validate_translations"]
    import scripts.validate_translations
    return scripts.validate_translations.run_full_validation()


@router.get("/run-reliability-suite")
async def run_reliability_suite_endpoint(start: int = 1, end: int = 25):
    """
    Triggers the Stage 5 25-scenario comprehensive production reliability test suite.
    """
    import sys
    if "tests.test_reliability_suite" in sys.modules:
        del sys.modules["tests.test_reliability_suite"]
    import tests.test_reliability_suite
    return await tests.test_reliability_suite.run_scenario_tests(start_scenario=start, end_scenario=end)



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


@router.post("/scan")
async def scan_disease(
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

    # Step 3: Run hierarchical ML pipeline (Validation ➔ Crop Identification ➔ Disease Classification)
    try:
        pred = predict_disease(image_bytes, min_confidence=settings.disease_min_confidence)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as ex:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Leaf analysis failed: {str(ex)}")

    status = pred.get("status", "success")
    is_valid = pred.get("is_valid", True)
    is_uncertain = pred.get("is_uncertain", False)
    crop_name = pred.get("crop_name", "UNKNOWN_CROP")

    # Step 4: Handle Invalid / Non-plant / Unknown Crop gracefully
    if not is_valid or status in ("INVALID_IMAGE", "NO_SUPPORTED_PLANT_DETECTED"):
        return {
            "status": status,
            "status_code": status,
            "is_valid": False,
            "is_uncertain": True,
            "disease_name": pred.get("disease_name", "Invalid image"),
            "disease_code": "INVALID_IMAGE",
            "crop_name": "UNKNOWN_CROP",
            "crop_code": "UNKNOWN_CROP",
            "confidence": 0.0,
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "severity_details": pred.get("severity_details", {}),
            "treatment_steps": [],
            "treatment_eligibility": False,
            "treatment_eligibility_reason": "Invalid or non-plant image; no treatment can be prescribed.",
            "is_healthy": False,
            "top5": [],
            "image_url": None,
            "message": pred.get("message", "Validation failed. Please photograph a real crop leaf."),
            "crop_alert": {
                "status": "YELLOW",
                "status_label": "Invalid Image",
                "reason": pred.get("message", "Validation failed"),
                "recommended_action": "Upload a clear, daylight photograph of a crop leaf.",
                "icon": "⚠️"
            },
            "treatment_plan": None,
            "localized_crop": _get_localized_text("crops", "UNKNOWN_CROP", lang),
            "localized_severity": _get_localized_text("severities", "NOT_ASSESSED", lang),
            "localized_status": _get_localized_text("statuses", status, lang),
        }

    if status == "UNKNOWN_CROP" or crop_name == "UNKNOWN_CROP":
        return {
            "status": "UNKNOWN_CROP",
            "status_code": "UNKNOWN_CROP",
            "is_valid": True,
            "is_uncertain": True,
            "disease_name": "Unknown Crop Species",
            "disease_code": "UNKNOWN_CROP",
            "crop_name": "UNKNOWN_CROP",
            "crop_code": "UNKNOWN_CROP",
            "confidence": pred.get("confidence", 0.0),
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "severity_details": pred.get("severity_details", {}),
            "treatment_steps": [],
            "treatment_eligibility": False,
            "treatment_eligibility_reason": "Crop species is unrecognized among the 14 supported crops. Chemical treatments withheld for safety.",
            "is_healthy": False,
            "top5": pred.get("top_predictions", []),
            "image_url": None,
            "message": pred.get("message", "Crop species could not be identified or is unsupported."),
            "supported_crops": pred.get("supported_crops", SUPPORTED_CROP_NAMES),
            "crop_alert": {
                "status": "YELLOW",
                "status_label": "Unknown Crop",
                "reason": "Crop species not recognized among the 14 supported crops.",
                "recommended_action": f"Supported crops: {', '.join(SUPPORTED_CROP_NAMES)}.",
                "icon": "🌱"
            },
            "treatment_plan": None,
            "localized_crop": _get_localized_text("crops", "UNKNOWN_CROP", lang),
            "localized_severity": _get_localized_text("severities", "NOT_ASSESSED", lang),
            "localized_status": _get_localized_text("statuses", "UNKNOWN_CROP", lang),
        }

    # Step 4b: Handle Uncertain Diagnosis gracefully (Strict Zero DB Mutation & Safe Fallback)
    if is_uncertain or status == "UNCERTAIN":
        filename = f"{uuid.uuid4()}_{int(time.time())}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(image_bytes)
        image_url = f"/static/uploads/disease/{filename}"

        top5 = [
            {
                "class_name": tp.get("class_name", ""),
                "crop": tp.get("crop", ""),
                "label": tp.get("label", ""),
                "confidence": round(tp.get("confidence", 0.0) * 100, 1) if tp.get("confidence", 0.0) <= 1.0 else tp.get("confidence", 0.0)
            }
            for tp in pred.get("top_predictions", [])
        ]

        return {
            "status": "UNCERTAIN",
            "status_code": "UNCERTAIN",
            "is_valid": True,
            "is_uncertain": True,
            "disease_name": pred.get("disease_name", "Uncertain diagnosis"),
            "disease_code": "UNCERTAIN",
            "crop_name": crop_name,
            "crop_code": pred.get("crop_code", crop_name.upper().replace(" ", "_")),
            "confidence": round(float(pred.get("confidence", 0.0)) * 100, 1) if float(pred.get("confidence", 0.0)) <= 1.0 else float(pred.get("confidence", 0.0)),
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "severity_details": pred.get("severity_details", {}),
            "treatment": "",
            "treatment_steps": [],
            "treatment_eligibility": False,
            "treatment_eligibility_reason": pred.get("treatment_eligibility_reason", "Diagnosis confidence is inconclusive. Chemical spray advice withheld to prevent crop injury."),
            "is_healthy": False,
            "top5": top5,
            "image_url": image_url,
            "message": pred.get("message", "Diagnosis is uncertain. Please capture a clearer close-up photograph."),
            "crop_alert": {
                "status": "YELLOW",
                "status_label": "Uncertain Diagnosis",
                "reason": "Diagnosis confidence is below safe operating threshold.",
                "recommended_action": "Retake a clear daylight photograph or consult local agricultural extension officer.",
                "icon": "⚠️"
            },
            "treatment_plan": None,
            "supported_crops": SUPPORTED_CROP_NAMES,
            "localized_crop": _get_localized_text("crops", crop_name, lang),
            "localized_severity": _get_localized_text("severities", "NOT_ASSESSED", lang),
            "localized_status": _get_localized_text("statuses", "UNCERTAIN", lang),
        }

    # Step 5: Save valid scan locally
    filename = f"{uuid.uuid4()}_{int(time.time())}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(image_bytes)
    image_url = f"/static/uploads/disease/{filename}"

    is_healthy = pred.get("is_healthy", False)
    top5 = [
        {
            "class_name": tp.get("class_name", ""),
            "crop": tp.get("crop", ""),
            "label": tp.get("label", ""),
            "confidence": round(tp.get("confidence", 0.0) * 100, 1) if tp.get("confidence", 0.0) <= 1.0 else tp.get("confidence", 0.0)
        }
        for tp in pred.get("top_predictions", [])
    ]

    # Step 6: Save to DB only if valid
    await db.execute("""
        INSERT INTO disease_scans
          (farm_id, user_id, image_url, crop_name, disease_name,
           confidence, severity, treatment)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    """, farm_id, user["id"], image_url,
         crop_name, pred["disease_name"],
         float(pred["confidence"]), pred["severity"],
         pred.get("treatment", ""))

    # Step 7: Fire integration cascade only if valid, confirmed, and non-uncertain diagnosis
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
        from app.integration_engine import update_health_score
        score = await update_health_score(farm_id, "disease", db)
        await ws_manager.broadcast(farm_id, {
            "event_type": "disease_detected",
            "payload": {
                "disease_name": pred["disease_name"],
                "severity": "LOW",
                "confidence": round(float(pred["confidence"]) * 100, 1),
                "health_score": score
            }
        })

    # Step 8: Compute Smart Crop Health Alert
    from app.services.crop_health_alert import determine_crop_alert_status
    pest_row = await db.fetchrow("""
        SELECT pest_name, infestation FROM pest_scans
        WHERE farm_id=$1 ORDER BY scanned_at DESC LIMIT 1
    """, farm_id)

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

    # Step 9: Load verified agricultural treatment plan (only for confirmed diagnosis)
    treatment_plan = None
    if not is_uncertain and not is_healthy:
        _gpath = os.path.join(os.path.dirname(__file__), "..", "data", "treatment_guidelines.json")
        try:
            with open(_gpath, "r", encoding="utf-8") as _gf:
                _gdata = json.load(_gf)

            treatments_dict = _gdata.get("treatments", {})
            class_key = pred.get("class_name", "")
            disease_key = pred.get("disease_name", "")
            crop_key = pred.get("crop_name", "")
            composite_key = f"{crop_key}___{disease_key}".replace(" ", "_")

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
                "cultural_practices": plan.get("cultural_practices", ["Maintain proper plant aeration and spacing."]),
                "follow_up_days": plan.get("follow_up_days", 7),
                "monitoring_note": plan.get("monitoring_note", "Re-scan leaf symptoms after treatment."),
                "source": "Agricultural Extension Guidelines (ICAR / TNAU / KVK / USDA-ARS)",
            }
        except Exception as _e:
            treatment_plan = None

    return {
        "status":                       status,
        "status_code":                  pred.get("status_code", status),
        "is_uncertain":                 is_uncertain,
        "disease_name":                 pred["disease_name"],
        "disease_code":                 pred.get("disease_code", pred["disease_name"]),
        "crop_name":                    crop_name,
        "crop_code":                    pred.get("crop_code", crop_name.upper().replace(" ", "_")),
        "confidence":                   round(float(pred["confidence"]) * 100, 1),
        "severity":                     pred["severity"],
        "severity_code":                pred.get("severity_code", "NOT_ASSESSED"),
        "severity_details":             pred.get("severity_details", {}),
        "treatment_eligibility":        pred.get("treatment_eligibility", False),
        "treatment_eligibility_reason": pred.get("treatment_eligibility_reason", ""),
        "treatment_steps":              pred.get("treatment_steps", []),
        "is_healthy":                   is_healthy,
        "top5":                         top5,
        "image_url":                    image_url,
        "message":                      pred.get("message", "Diagnosis complete."),
        "crop_alert":                   crop_alert,
        "treatment_plan":               treatment_plan,
        "supported_crops":              SUPPORTED_CROP_NAMES,
        "localized_crop":               _get_localized_text("crops", crop_name, lang),
        "localized_disease":            _get_localized_text("diseases", pred.get("class_name", ""), lang) or _get_localized_text("diseases", pred.get("disease_name", ""), lang),
        "localized_severity":           _get_localized_text("severities", pred["severity"], lang),
        "localized_status":             _get_localized_text("statuses", status, lang),
    }


@router.get("/history/{farm_id}")
async def disease_history(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # Verify farm ownership against authenticated user
    await verify_farm_access(farm_id, user["id"], db)

    rows = await db.fetch("""
        SELECT id, farm_id, user_id, image_url, crop_name, disease_name,
               confidence, severity, treatment, scanned_at
        FROM disease_scans
        WHERE farm_id=$1
        ORDER BY scanned_at DESC LIMIT 20
    """, farm_id)
    return [dict(r) for r in rows]
