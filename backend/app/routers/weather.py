from fastapi import APIRouter, Depends, HTTPException, Query
from app.middleware.auth import get_current_user
from app.database import get_db
from app.websocket import get_ws_manager
from app.integration_engine import on_weather_refreshed
import httpx
import os
import datetime
from collections import Counter

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])

@router.get("/{lat}/{lon}")
async def get_weather(
    lat: float,
    lon: float,
    farm_id: int = Query(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager)
):
    # Input validation
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates: latitude must be in [-90, 90] and longitude in [-180, 180].")

    weather_data = {}
    forecast_list = []
    from app.config import settings
    api_key = (os.getenv("OPENWEATHER_API_KEY") or getattr(settings, "openweather_api_key", "") or "").strip()

    # 1. Fetch real current weather and 5-day forecast from OpenWeatherMap
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                # A. Current Weather
                cur_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
                cur_resp = await client.get(cur_url)
                
                if cur_resp.status_code == 200:
                    res = cur_resp.json()
                    is_live = True
                    rain_1h = res.get("rain", {}).get("1h", 0.0)
                    weather_data = {
                        "temp": round(float(res["main"]["temp"]), 1),
                        "humidity": int(res["main"]["humidity"]),
                        "wind_speed": round(float(res["wind"]["speed"]) * 3.6, 1), # m/s to km/h
                        "rainfall": round(float(rain_1h), 1),
                        "rainfall_forecast": 0.0, # populated below from forecast API
                        "uv_index": 5.0,
                        "drought_days": 0,
                        "condition": res["weather"][0]["main"] if res.get("weather") else "Clear",
                        "description": res["weather"][0]["description"].capitalize() if res.get("weather") else "Clear sky"
                    }

                # B. Real 5-Day / 3-Hour Forecast API
                fc_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric"
                fc_resp = await client.get(fc_url)
                
                if fc_resp.status_code == 200:
                    fc_json = fc_resp.json()
                    # Aggregate 3-hour slices by day
                    daily_groups = {}
                    total_forecast_rain = 0.0

                    for item in fc_json.get("list", []):
                        dt_txt = item.get("dt_txt", "")
                        day_key = dt_txt[:10] # YYYY-MM-DD
                        if not day_key:
                            continue
                            
                        if day_key not in daily_groups:
                            daily_groups[day_key] = {
                                "temps": [],
                                "humidities": [],
                                "conditions": [],
                                "rain": 0.0
                            }
                        daily_groups[day_key]["temps"].append(float(item["main"]["temp"]))
                        daily_groups[day_key]["humidities"].append(float(item["main"]["humidity"]))
                        if item.get("weather") and len(item["weather"]) > 0:
                            daily_groups[day_key]["conditions"].append(item["weather"][0]["main"])
                        # Rain in 3h
                        r3 = item.get("rain", {}).get("3h", 0.0)
                        daily_groups[day_key]["rain"] += float(r3)
                        total_forecast_rain += float(r3)

                    if weather_data:
                        weather_data["rainfall_forecast"] = round(total_forecast_rain, 1)

                    # Build daily forecast summaries
                    for d_key, vals in daily_groups.items():
                        day_dt = datetime.datetime.strptime(d_key, "%Y-%m-%d")
                        day_name = day_dt.strftime("%a")
                        most_common_cond = Counter(vals["conditions"]).most_common(1)[0][0] if vals["conditions"] else "Clear"
                        forecast_list.append({
                            "date": d_key,
                            "day": day_name,
                            "min_temp": round(min(vals["temps"]), 1),
                            "max_temp": round(max(vals["temps"]), 1),
                            "avg_humidity": round(sum(vals["humidities"]) / len(vals["humidities"]), 1),
                            "rainfall_mm": round(vals["rain"], 1),
                            "condition": most_common_cond
                        })

        except Exception as e:
            print(f"OpenWeatherMap request failed: {e}")
            is_live = False

    # 2. Deterministic Fallback if Live API is unavailable (NO RANDOM NUMBERS!)
    if not weather_data:
        weather_data = {
            "temp": 28.0,
            "humidity": 65,
            "wind_speed": 12.0,
            "rainfall": 0.0,
            "rainfall_forecast": 0.0,
            "uv_index": 5.0,
            "drought_days": 0,
            "condition": "Partly Cloudy",
            "description": "Seasonal average conditions"
        }

    # Attach forecast and truthful source metadata (Fix 4 & Phase 10)
    weather_data["forecast"] = forecast_list
    weather_data["forecast_available"] = bool(is_live and len(forecast_list) > 0)
    weather_data["source"] = "OpenWeatherMap" if is_live else None
    weather_data["is_live"] = is_live
    weather_data["status_label"] = "Live OpenWeather" if is_live else "Weather provider unavailable (Historical offline baseline)"
    if not is_live:
        weather_data["reason"] = "Weather provider unavailable or API key not verified"
    weather_data["fetched_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Generate Deterministic Agronomic Advisories
    advisories = []
    if weather_data["humidity"] > 80 and 20.0 <= weather_data["temp"] <= 30.0:
        advisories.append("High disease risk! Warmth and high humidity favor fungal growth. Inspect leaf undersides.")
    if weather_data["rainfall_forecast"] > 50.0:
        advisories.append("Heavy rain forecasted. Postpone irrigation and fertilizer application to prevent runoff.")
    if weather_data["temp"] > 42.0:
        advisories.append("Extreme heat stress! Ensure crops are hydrated. Apply mulching to retain soil moisture.")
    if weather_data["wind_speed"] > 40.0:
        advisories.append("High wind warning. Secure scaffolding/stakes for tall crops (e.g. banana, sugarcane).")
    if weather_data.get("drought_days", 0) >= 15:
        advisories.append("Extended drought alert. Prioritize drip irrigation and drought-tolerant maintenance.")
    if not advisories:
        advisories.append("Conditions are optimal. Continue standard crop care.")

    weather_data["advisory"] = " | ".join(advisories)

    # ── NEW: Weather-Based Disease Risk Assessment ──
    from app.services.disease_risk_engine import assess_disease_risk
    crop_name = "generic"
    try:
        crop_row = await db.fetchrow("""
            SELECT crop_name FROM crops
            WHERE farm_id=$1 AND status='growing'
            ORDER BY sown_date DESC LIMIT 1
        """, farm_id)
        if crop_row:
            crop_name = crop_row["crop_name"]
    except Exception:
        pass

    disease_risk = assess_disease_risk(
        crop_name=crop_name,
        temperature=weather_data.get("temp"),
        humidity=weather_data.get("humidity"),
        rainfall=weather_data.get("rainfall"),
        wind_speed=weather_data.get("wind_speed"),
        forecast_condition=weather_data.get("condition"),
    )
    weather_data["disease_risk"] = disease_risk

    # Call on_weather_refreshed cascade
    await on_weather_refreshed(farm_id, weather_data, db, ws_manager)

    return weather_data

@router.get("/alert/{farm_id}")
async def get_weather_alerts(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    rows = await db.fetch("""
        SELECT * FROM alerts
        WHERE farm_id=$1 AND alert_type='WEATHER' AND is_read=FALSE
        ORDER BY created_at DESC
    """, farm_id)
    return [dict(r) for r in rows]
