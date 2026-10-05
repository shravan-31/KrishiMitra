"""
Crop Health Router — New Smart Features
- /api/v1/crop-health/alert           → Crop health alert (GREEN/YELLOW/RED)
- /api/v1/crop-health/disease-risk    → Weather-based disease risk
- /api/v1/crop-health/treatment-plan  → Solution-in-the-Loop treatment plan
- /api/v1/crop-health/treatment-windows → Smart treatment time scheduler
- /api/v1/crop-health/followup        → Follow-up scan comparison
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.middleware.auth import get_current_user
from app.database import get_db
from app.services.crop_health_alert import determine_crop_alert_status, compute_followup_trend
from app.services.disease_risk_engine import assess_disease_risk
from app.services.treatment_scheduler import find_best_treatment_windows
import json
import os
import httpx
from app.config import settings

router = APIRouter(prefix="/api/v1/crop-health", tags=["crop-health"])

# Load treatment guidelines
_GUIDELINES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "treatment_guidelines.json")
_guidelines = {}
try:
    with open(_GUIDELINES_PATH, "r") as f:
        _guidelines = json.load(f)
except Exception:
    pass


@router.get("/alert/{farm_id}")
async def get_crop_health_alert(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Returns current crop health alert status (GREEN/YELLOW/RED)
    based on most recent disease scan, pest scan, and weather risk.
    """
    # Get latest disease scan
    disease_row = await db.fetchrow("""
        SELECT disease_name, confidence, severity
        FROM disease_scans
        WHERE farm_id=$1
        ORDER BY scanned_at DESC LIMIT 1
    """, farm_id)

    # Get latest pest scan
    pest_row = await db.fetchrow("""
        SELECT pest_name, infestation
        FROM pest_scans
        WHERE farm_id=$1
        ORDER BY scanned_at DESC LIMIT 1
    """, farm_id)

    # Get weather-based risk from latest alert
    weather_alert = await db.fetchrow("""
        SELECT severity
        FROM alerts
        WHERE farm_id=$1 AND alert_type='WEATHER'
        ORDER BY created_at DESC LIMIT 1
    """, farm_id)

    is_healthy = True
    is_uncertain = False
    disease_name = None
    disease_confidence = None
    disease_severity = None

    if disease_row:
        disease_name = disease_row["disease_name"]
        disease_confidence = float(disease_row["confidence"])
        disease_severity = disease_row["severity"]
        is_healthy = "healthy" in disease_name.lower()
        is_uncertain = disease_confidence < 0.5

    weather_risk_level = "LOW"
    if weather_alert:
        sev = weather_alert["severity"]
        if sev in ("HIGH", "CRITICAL"):
            weather_risk_level = "HIGH"
        elif sev == "MEDIUM":
            weather_risk_level = "MEDIUM"

    alert = determine_crop_alert_status(
        disease_name=disease_name,
        disease_confidence=disease_confidence,
        disease_severity=disease_severity,
        is_uncertain=is_uncertain,
        is_healthy=is_healthy,
        pest_name=pest_row["pest_name"] if pest_row else None,
        pest_infestation=pest_row["infestation"] if pest_row else None,
        weather_risk_level=weather_risk_level,
    )

    return alert


@router.get("/disease-risk/{farm_id}")
async def get_disease_risk(
    farm_id: int,
    lat: float = Query(...),
    lon: float = Query(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Weather-based disease risk assessment for the farm's crop.
    Fetches live weather data and runs deterministic rule-based assessment.
    Label: Rule-Based Disease Risk Assessment
    """
    # Get crop name from latest disease scan or active crop
    crop_name = "generic"
    crop_row = await db.fetchrow("""
        SELECT crop_name FROM crops
        WHERE farm_id=$1 AND status='growing'
        ORDER BY sown_date DESC LIMIT 1
    """, farm_id)
    if crop_row:
        crop_name = crop_row["crop_name"]
    else:
        disease_row = await db.fetchrow("""
            SELECT crop_name FROM disease_scans
            WHERE farm_id=$1
            ORDER BY scanned_at DESC LIMIT 1
        """, farm_id)
        if disease_row:
            crop_name = disease_row["crop_name"]

    # Fetch weather
    api_key = (os.getenv("OPENWEATHER_API_KEY") or getattr(settings, "openweather_api_key", "") or "").strip()
    temperature = None
    humidity = None
    rainfall = None
    rain_probability = None
    wind_speed = None
    forecast_condition = None

    if api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                cur_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
                cur_resp = await client.get(cur_url)
                if cur_resp.status_code == 200:
                    res = cur_resp.json()
                    temperature = float(res["main"]["temp"])
                    humidity = float(res["main"]["humidity"])
                    wind_speed = round(float(res["wind"]["speed"]) * 3.6, 1)
                    rainfall = float(res.get("rain", {}).get("1h", 0.0))
                    forecast_condition = res["weather"][0]["main"] if res.get("weather") else "Clear"
        except Exception:
            pass

    # Count recent disease/pest events
    recent_disease = await db.fetchval("""
        SELECT COUNT(*) FROM disease_scans
        WHERE farm_id=$1 AND scanned_at >= NOW() - INTERVAL '7 days'
          AND disease_name NOT ILIKE '%healthy%'
    """, farm_id)

    recent_pest = await db.fetchval("""
        SELECT COUNT(*) FROM pest_scans
        WHERE farm_id=$1 AND scanned_at >= NOW() - INTERVAL '7 days'
    """, farm_id)

    risk = assess_disease_risk(
        crop_name=crop_name,
        temperature=temperature,
        humidity=humidity,
        rainfall=rainfall,
        rain_probability=rain_probability,
        wind_speed=wind_speed,
        forecast_condition=forecast_condition,
        recent_disease_count=recent_disease or 0,
        recent_pest_count=recent_pest or 0,
    )

    risk["weather"] = {
        "temperature": temperature,
        "humidity": humidity,
        "wind_speed": wind_speed,
        "rainfall": rainfall,
        "condition": forecast_condition,
    }

    return risk


@router.get("/treatment-plan/{disease_class}")
async def get_treatment_plan(
    disease_class: str,
    severity: str = Query("MEDIUM"),
    user=Depends(get_current_user),
):
    """
    Returns verified treatment plan from agricultural extension guidelines.
    Source: ICAR/TNAU/KVK public guidelines.
    """
    treatments = _guidelines.get("treatments", {})
    plan = treatments.get(disease_class)

    if not plan:
        plan = _guidelines.get("default_treatment", {})

    severity_upper = severity.upper()
    guidance = plan.get("severity_guidance", {}).get(severity_upper)
    if not guidance:
        guidance = plan.get("severity_guidance", {}).get("MEDIUM", "Consult local agricultural extension officer.")

    return {
        "disease_class": disease_class,
        "disease": plan.get("disease", disease_class.replace("___", " — ").replace("_", " ")),
        "crop": plan.get("crop", "Unknown"),
        "severity": severity_upper,
        "treatment_guidance": guidance,
        "cultural_practices": plan.get("cultural_practices", []),
        "follow_up_days": plan.get("follow_up_days", 7),
        "monitoring_note": plan.get("monitoring_note", "Re-scan after treatment period."),
        "source": "Agricultural Extension Guidelines (ICAR/TNAU/KVK)",
        "disclaimer": "These are general guidance references. Always consult local agricultural extension officers for region-specific recommendations.",
    }


@router.get("/treatment-windows/{farm_id}")
async def get_treatment_windows(
    farm_id: int,
    lat: float = Query(...),
    lon: float = Query(...),
    user=Depends(get_current_user),
):
    """
    Find optimal spray/treatment windows using weather forecast.
    Avoids rain, high wind, and extreme conditions.
    """
    api_key = (os.getenv("OPENWEATHER_API_KEY") or getattr(settings, "openweather_api_key", "") or "").strip()
    forecast_data = []

    if api_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                fc_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric"
                fc_resp = await client.get(fc_url)
                if fc_resp.status_code == 200:
                    fc_json = fc_resp.json()
                    for item in fc_json.get("list", []):
                        forecast_data.append({
                            "dt": item.get("dt"),
                            "temp": item["main"]["temp"],
                            "humidity": item["main"]["humidity"],
                            "wind_speed": round(float(item["wind"]["speed"]) * 3.6, 1),
                            "rain_prob": float(item.get("pop", 0)) * 100,
                            "rain_mm": float(item.get("rain", {}).get("3h", 0.0)),
                            "condition": item["weather"][0]["main"] if item.get("weather") else "Clear",
                        })
        except Exception:
            pass

    if not forecast_data:
        return {
            "windows": [],
            "timeline": [],
            "recommendation": "Weather forecast unavailable. Check weather conditions manually before applying treatment.",
            "engine": "Weather-Based Treatment Scheduler",
        }

    return find_best_treatment_windows(forecast_data)


@router.post("/followup")
async def compare_followup_scan(
    farm_id: int = Query(...),
    original_scan_id: int = Query(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Compare original and latest scan to compute AI-observed visual trend.
    Disclaimer: This is an AI visual comparison, NOT a confirmed recovery assessment.
    """
    original = await db.fetchrow("""
        SELECT disease_name, confidence, severity, scanned_at
        FROM disease_scans WHERE id=$1 AND farm_id=$2
    """, original_scan_id, farm_id)

    if not original:
        raise HTTPException(status_code=404, detail="Original scan not found")

    latest = await db.fetchrow("""
        SELECT disease_name, confidence, severity, scanned_at
        FROM disease_scans
        WHERE farm_id=$1 AND scanned_at > $2
        ORDER BY scanned_at DESC LIMIT 1
    """, farm_id, original["scanned_at"])

    if not latest:
        return {
            "trend": "NO_FOLLOWUP",
            "message": "No follow-up scan found after the original scan. Upload a new image to compare.",
        }

    trend = compute_followup_trend(
        initial_confidence=float(original["confidence"]),
        new_confidence=float(latest["confidence"]),
        initial_severity=original["severity"],
        new_severity=latest["severity"],
    )

    trend["original"] = {
        "disease": original["disease_name"],
        "confidence": round(float(original["confidence"]) * 100, 1),
        "severity": original["severity"],
        "date": original["scanned_at"].isoformat() if original["scanned_at"] else None,
    }
    trend["followup"] = {
        "disease": latest["disease_name"],
        "confidence": round(float(latest["confidence"]) * 100, 1),
        "severity": latest["severity"],
        "date": latest["scanned_at"].isoformat() if latest["scanned_at"] else None,
    }

    return trend
