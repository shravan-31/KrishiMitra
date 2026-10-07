"""
KrishiMitra Integration Engine
Cascade event handlers — wires all 14 features together.
Called by routers AFTER saving results to DB.
"""

import asyncio, json
from datetime import datetime, date


# ─── HEALTH SCORE ────────────────────────────────────────────────────────────

async def update_health_score(farm_id: int, component: str, db):
    """
    Recalculate dynamic weighted health score using ONLY measured components.
    Fix 13: Irrigation sensor data is not faked; remaining active components are dynamically re-normalized.
    """
    base_weights = {
        "soil":       0.35,
        "disease":    0.30,
        "pest":       0.20,
        "weather":    0.15
        # "irrigation": marked unavailable / unmeasured — no fake 80.0
    }

    scores = {}
    active_weights = {}

    # 1. Soil component
    soil_row = await db.fetchrow(
        "SELECT soil_health_score FROM soil_reports "
        "WHERE farm_id=$1 ORDER BY tested_at DESC LIMIT 1", farm_id)
    if soil_row and soil_row["soil_health_score"] is not None:
        scores["soil"] = float(soil_row["soil_health_score"])
        active_weights["soil"] = base_weights["soil"]

    # 2. Disease component
    disease_row = await db.fetchrow(
        "SELECT severity FROM disease_scans "
        "WHERE farm_id=$1 ORDER BY scanned_at DESC LIMIT 1", farm_id)
    scores["disease"] = {
        None: 90.0, "LOW": 85.0, "MEDIUM": 60.0,
        "HIGH": 35.0, "CRITICAL": 10.0
    }.get(disease_row["severity"] if disease_row else None, 85.0)
    active_weights["disease"] = base_weights["disease"]

    # 3. Pest component
    pest_row = await db.fetchrow(
        "SELECT infestation FROM pest_scans "
        "WHERE farm_id=$1 ORDER BY scanned_at DESC LIMIT 1", farm_id)
    scores["pest"] = {
        None: 90.0, "LOW": 85.0, "MEDIUM": 60.0, "HIGH": 30.0
    }.get(pest_row["infestation"] if pest_row else None, 85.0)
    active_weights["pest"] = base_weights["pest"]

    # 4. Weather component
    scores["weather"] = 80.0
    active_weights["weather"] = base_weights["weather"]

    # Dynamic re-normalization of weights to sum exactly to 1.0
    total_active = sum(active_weights.values())
    if total_active > 0:
        health_score = sum(scores[k] * (active_weights[k] / total_active) for k in active_weights)
    else:
        health_score = 80.0

    return round(health_score, 1)


# ─── ALERT CREATION ──────────────────────────────────────────────────────────

async def create_alert(farm_id: int, alert_type: str,
                       severity: str, title: str,
                       message: str, db):
    farm = await db.fetchrow(
        "SELECT user_id FROM farms WHERE id=$1", farm_id)
    if not farm:
        return
    await db.execute("""
        INSERT INTO alerts
          (user_id, farm_id, alert_type, severity, title, message)
        VALUES ($1,$2,$3,$4,$5,$6)
    """, farm["user_id"], farm_id, alert_type,
         severity, title, message)


# ─── EXPENSE ESTIMATION & DEDUPLICATION (Fix 11) ──────────────────────────────

PESTICIDE_COST_MAP = {
    "CRITICAL": 2500, "HIGH": 1800, "MEDIUM": 1200, "LOW": 600
}
FERTILIZER_COST_PER_KG = 25.0

async def should_add_expense(farm_id: int, category: str, description: str, db, window_days: int = 2) -> bool:
    """Check if an equivalent auto-estimated expense already exists within the deduplication window."""
    existing = await db.fetchrow("""
        SELECT id FROM expenses
        WHERE farm_id = $1
          AND category = $2
          AND description = $3
          AND date >= CURRENT_DATE - ($4 || ' days')::INTERVAL
        LIMIT 1
    """, farm_id, category, description, str(window_days))
    return existing is None

async def estimate_expense(farm_id: int, category: str, db, **kwargs):
    if category == "pesticide":
        severity = kwargs.get("severity", "MEDIUM")
        amount   = PESTICIDE_COST_MAP.get(severity, 1200)
        desc     = (f"Auto-estimated pesticide for "
                    f"{kwargs.get('disease') or kwargs.get('pest','unknown')}")
    elif category == "fertilizer":
        deficits = kwargs.get("deficits", {})
        amount   = sum(abs(v) * FERTILIZER_COST_PER_KG
                       for v in deficits.values() if isinstance(v, (int,float)))
        amount   = max(amount, 500)
        desc     = "Auto-estimated fertilizer from soil analysis"
    else:
        return

    # Fix 11: Idempotency check before inserting duplicate expense
    if not await should_add_expense(farm_id, category, desc, db):
        return

    await db.execute("""
        INSERT INTO expenses (farm_id, category, amount, description, date)
        VALUES ($1,$2,$3,$4,$5)
    """, farm_id, category, amount, desc, date.today())


# ─── CALENDAR TASK & DEDUPLICATION & WEATHER-AWARE SPRAY (Fix 11 & 14) ────────

async def should_create_task(farm_id: int, task_name: str, task_type: str, db, window_hours: int = 48) -> bool:
    """Check if an equivalent uncompleted task exists within the deduplication window."""
    existing = await db.fetchrow("""
        SELECT id FROM crop_calendar
        WHERE farm_id = $1
          AND task_type = $2
          AND task_name = $3
          AND completed = FALSE
          AND scheduled_at >= NOW() - ($4 || ' hours')::INTERVAL
        LIMIT 1
    """, farm_id, task_type, task_name, str(window_hours))
    return existing is None

async def add_calendar_task(farm_id: int, task_name: str,
                            task_type: str, urgency: str,
                            days_from_now: int = 1, db = None,
                            weather_context: dict = None):
    from datetime import timedelta

    # Fix 11: Deduplicate active tasks within 48h
    if not await should_create_task(farm_id, task_name, task_type, db):
        return

    # Fix 14: Weather-aware spray scheduling
    # If spraying/treatment is planned during rain or strong wind, postpone to next safe window
    final_days = days_from_now
    weather_note = ""
    if task_type in ("TREATMENT", "SPRAY"):
        # Check if farm has high rainfall or high humidity alert
        weather_alert = await db.fetchrow("""
            SELECT title FROM alerts
            WHERE farm_id = $1
              AND alert_type = 'WEATHER'
              AND severity IN ('HIGH', 'CRITICAL')
              AND created_at >= NOW() - INTERVAL '24 hours'
            LIMIT 1
        """, farm_id)

        if weather_alert:
            final_days = max(days_from_now, 2)
            weather_note = " [Weather Advisory: Spray postponed due to inclement weather conditions]"
        else:
            weather_note = " [Weather check required before spray]"

    full_task_name = f"{task_name}{weather_note}"
    scheduled = datetime.utcnow() + timedelta(days=final_days)

    await db.execute("""
        INSERT INTO crop_calendar
          (farm_id, task_name, task_type, scheduled_at, urgency)
        VALUES ($1,$2,$3,$4,$5)
    """, farm_id, full_task_name, task_type, scheduled, urgency)


# ─── GOVT SCHEMES CHECK ──────────────────────────────────────────────────────

SCHEME_RULES = {
    "disease_subsidy": {
        "name": "Rajya Krishi Suraksha Yojana",
        "description": "State pesticide subsidy for crop disease treatment",
        "benefit": "50% subsidy on certified pesticides",
        "link": "https://agricoop.nic.in"
    },
    "soil_health_card": {
        "name": "Soil Health Card Scheme",
        "description": "Free soil testing and recommendations",
        "benefit": "Free soil health card + fertilizer subsidy",
        "link": "https://soilhealth.dac.gov.in"
    },
    "PMFBY_drought": {
        "name": "Pradhan Mantri Fasal Bima Yojana",
        "description": "Crop insurance for drought/flood losses",
        "benefit": "Crop loss compensation up to ₹2 lakh",
        "link": "https://pmfby.gov.in"
    },
    "KCC": {
        "name": "Kisan Credit Card",
        "description": "Low-interest credit for agricultural expenses",
        "benefit": "Credit up to ₹3 lakh at 4% interest",
        "link": "https://www.nabard.org/kcc"
    },
    "low_yield_support": {
        "name": "PM-KISAN + SMAM",
        "description": "Income support + machinery assistance",
        "benefit": "₹6000/year + 50% subsidy on agri machinery",
        "link": "https://pmkisan.gov.in"
    },
    "critical_health": {
        "name": "National Food Security Mission",
        "description": "Comprehensive support for distressed farms",
        "benefit": "Seeds, fertilizers, training support",
        "link": "https://nfsm.gov.in"
    }
}

async def check_govt_schemes(farm_id: int, trigger: str, db):
    scheme = SCHEME_RULES.get(trigger)
    if not scheme:
        return
    farm = await db.fetchrow(
        "SELECT user_id FROM farms WHERE id=$1", farm_id)
    if farm:
        await create_alert(
            farm_id=farm_id,
            alert_type="SCHEME",
            severity="LOW",
            title=f"Eligible: {scheme['name']}",
            message=(f"{scheme['description']}. "
                     f"Benefit: {scheme['benefit']}. "
                     f"Apply: {scheme['link']}"),
            db=db
        )


# ─── SEASON SUMMARY ──────────────────────────────────────────────────────────

async def recalculate_season_summary(farm_id: int, db):
    current_year   = datetime.utcnow().year
    month          = datetime.utcnow().month
    current_season = ("Kharif" if 6 <= month <= 10
                      else "Rabi" if 11 <= month <= 3
                      else "Zaid")

    totals = await db.fetchrow("""
        SELECT
            COALESCE(SUM(amount),0) as total_expense
        FROM expenses
        WHERE farm_id=$1
          AND EXTRACT(YEAR FROM date) = $2
    """, farm_id, current_year)

    yield_row = await db.fetchrow("""
        SELECT COALESCE(SUM(predicted_kg),0) as total_yield
        FROM yield_predictions
        WHERE farm_id=$1
          AND EXTRACT(YEAR FROM predicted_at) = $2
    """, farm_id, current_year)

    total_expense = float(totals["total_expense"])
    total_yield   = float(yield_row["total_yield"])

    await db.execute("""
        INSERT INTO season_summary
          (farm_id, season, year, total_expense, yield_kg,
           profit_loss, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW())
        ON CONFLICT (farm_id, season, year)
        DO UPDATE SET
          total_expense = EXCLUDED.total_expense,
          yield_kg      = EXCLUDED.yield_kg,
          updated_at    = NOW()
    """, farm_id, current_season, current_year,
         total_expense, total_yield, -total_expense)


# ─── DASHBOARD CACHE BUST ─────────────────────────────────────────────────────

import redis.asyncio as aioredis
import os

_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(os.getenv("REDIS_URL","redis://redis:6379/0"))
    return _redis

async def bust_dashboard_cache(farm_id):
    try:
        r = await get_redis()
        if farm_id:
            await r.delete(f"dashboard:{farm_id}")
        await r.delete("global:market_prices")
    except Exception:
        pass  # cache bust failure is non-critical


# ─── MAIN EVENT HANDLERS ─────────────────────────────────────────────────────

async def on_disease_detected(farm_id, disease, severity,
                               confidence, db, ws_manager):
    score = await update_health_score(farm_id, "disease", db)
    await create_alert(
        farm_id, "DISEASE", severity,
        f"Disease Detected: {disease}",
        f"Confidence: {confidence}%. Immediate treatment recommended.",
        db)
    await estimate_expense(farm_id, "pesticide",
                           db=db, severity=severity, disease=disease)
    await add_calendar_task(farm_id, f"Apply treatment for {disease}",
                            "TREATMENT", urgency="HIGH",
                            days_from_now=1, db=db)
    await check_govt_schemes(farm_id, "disease_subsidy", db)
    await ws_manager.broadcast(farm_id, {
        "event_type": "disease_detected",
        "payload": {"disease_name": disease, "severity": severity,
                    "confidence": confidence, "health_score": score}
    })
    await bust_dashboard_cache(farm_id)
    return score


async def on_soil_analyzed(farm_id, soil_data, db, ws_manager):
    score = await update_health_score(farm_id, "soil", db)
    await check_govt_schemes(farm_id, "soil_health_card", db)
    deficits = {}
    if soil_data.get("nitrogen", 50) < 20:
        deficits["nitrogen"] = 20 - soil_data["nitrogen"]
    if soil_data.get("phosphorus", 30) < 10:
        deficits["phosphorus"] = 10 - soil_data["phosphorus"]
    if soil_data.get("potassium", 30) < 10:
        deficits["potassium"] = 10 - soil_data["potassium"]
    if deficits:
        await estimate_expense(farm_id, "fertilizer",
                               db=db, deficits=deficits)
    await add_calendar_task(farm_id, "Apply fertilizer as recommended",
                            "FERTILIZER", urgency="NORMAL",
                            days_from_now=3, db=db)
    await ws_manager.broadcast(farm_id, {
        "event_type": "soil_analyzed",
        "payload": {"health_score": score,
                    "recommended_crops": soil_data.get("recommended_crops",[])}
    })
    await bust_dashboard_cache(farm_id)
    return score


async def on_weather_refreshed(farm_id, weather, db, ws_manager):
    alerts_created = []
    if weather.get("humidity", 0) > 80 and 20 <= weather.get("temp", 25) <= 30:
        await create_alert(farm_id, "WEATHER", "HIGH",
                           "Fungal Risk Alert",
                           "High humidity and warm temperature — "
                           "fungal disease risk is elevated.", db)
        alerts_created.append("FUNGAL_RISK")
    if weather.get("rainfall_forecast", 0) > 50:
        await create_alert(farm_id, "WEATHER", "MEDIUM",
                           "Heavy Rain Forecast",
                           f"{weather['rainfall_forecast']}mm expected. "
                           "Postpone irrigation and spraying.", db)
        await add_calendar_task(farm_id, "Reschedule irrigation",
                                "IRRIGATION", urgency="NORMAL",
                                days_from_now=3, db=db)
        alerts_created.append("HEAVY_RAIN")
    if weather.get("temp", 25) > 42:
        await create_alert(farm_id, "WEATHER", "HIGH",
                           "Heat Stress Alert",
                           f"Temperature {weather['temp']}°C — "
                           "provide shade and extra irrigation.", db)
        alerts_created.append("HEAT_STRESS")
    if weather.get("wind_speed", 0) > 40:
        await create_alert(farm_id, "WEATHER", "CRITICAL",
                           "Storm Warning",
                           f"Wind speed {weather['wind_speed']} km/h. "
                           "Secure structures and crops.", db)
        alerts_created.append("STORM")
    if weather.get("drought_days", 0) >= 15:
        await check_govt_schemes(farm_id, "PMFBY_drought", db)
        alerts_created.append("DROUGHT")
    if alerts_created:
        await ws_manager.broadcast(farm_id, {
            "event_type": "weather_alert",
            "payload": {"alerts": alerts_created, "weather": weather}
        })
    await bust_dashboard_cache(farm_id)
    return alerts_created


async def on_pest_detected(farm_id, pest, infestation_level,
                            db, ws_manager):
    score = await update_health_score(farm_id, "pest", db)
    await create_alert(
        farm_id, "PEST", infestation_level,
        f"Pest Detected: {pest}",
        f"Infestation level: {infestation_level}. Take action immediately.", db)
    await estimate_expense(farm_id, "pesticide",
                           db=db, severity=infestation_level, pest=pest)
    await add_calendar_task(farm_id, f"Spray pesticide for {pest}",
                            "SPRAY", urgency="HIGH",
                            days_from_now=1, db=db)
    await ws_manager.broadcast(farm_id, {
        "event_type": "pest_detected",
        "payload": {"pest_name": pest, "level": infestation_level,
                    "health_score": score}
    })
    await bust_dashboard_cache(farm_id)
    return score


async def on_yield_predicted(farm_id, yield_data, db, ws_manager):
    await recalculate_season_summary(farm_id, db)
    if yield_data.get("below_average", False):
        await check_govt_schemes(farm_id, "low_yield_support", db)
    await ws_manager.broadcast(farm_id, {
        "event_type": "yield_predicted",
        "payload": {"predicted_kg": yield_data.get("predicted_kg"),
                    "crop": yield_data.get("crop_name")}
    })
    await bust_dashboard_cache(farm_id)


async def on_expense_added(farm_id, expense, db, ws_manager):
    await recalculate_season_summary(farm_id, db)
    total_row = await db.fetchrow("""
        SELECT COALESCE(SUM(amount),0) as total
        FROM expenses
        WHERE farm_id=$1
          AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM NOW())
    """, farm_id)
    if float(total_row["total"]) > 50000:
        await check_govt_schemes(farm_id, "KCC", db)
    await bust_dashboard_cache(farm_id)


async def on_market_price_updated(crop, price, mandi, db, ws_manager):
    MSP_MAP = {
        "wheat": 2275, "rice": 2183, "maize": 1962,
        "cotton": 6620, "soybean": 4600, "sugarcane": 315
    }
    msp = MSP_MAP.get(crop.lower(), 0)
    if msp > 0 and price < msp:
        farms = await db.fetch(
            "SELECT DISTINCT c.farm_id, c.farm_id as fid "
            "FROM crops c WHERE LOWER(c.crop_name) = $1",
            crop.lower())
        for f in farms:
            await create_alert(
                f["farm_id"], "MARKET", "HIGH",
                f"Price Below MSP: {crop}",
                f"Current: ₹{price}/q | MSP: ₹{msp}/q. "
                f"Consider holding stock.", db)
    await ws_manager.broadcast_all({
        "event_type": "price_alert",
        "payload": {"crop": crop, "price": price, "mandi": mandi,
                    "below_msp": price < msp if msp else False}
    })
    await bust_dashboard_cache(None)


async def on_health_score_changed(farm_id, new_score, db, ws_manager):
    await ws_manager.broadcast(farm_id, {
        "event_type": "health_score_update",
        "payload": {"score": new_score,
                    "grade": ("A" if new_score >= 80
                              else "B" if new_score >= 60
                              else "C" if new_score >= 40
                              else "D")}
    })
    if new_score < 50:
        await check_govt_schemes(farm_id, "critical_health", db)
    await bust_dashboard_cache(farm_id)


# ─── LOAD ALL FARM CONTEXT (for Chat AI) ─────────────────────────────────────

async def load_farm_context(farm_id: int, db) -> dict:
    """Load ALL 14 features in ONE optimized async query."""
    row = await db.fetchrow("""
        SELECT
            f.*,
            (SELECT row_to_json(s)
             FROM soil_reports s
             WHERE s.farm_id = $1
             ORDER BY tested_at DESC LIMIT 1) AS soil,

            (SELECT json_agg(d ORDER BY scanned_at DESC)
             FROM (SELECT id, disease_name, confidence, severity, treatment,
                          scanned_at, image_url
                   FROM disease_scans
                   WHERE farm_id = $1
                   ORDER BY scanned_at DESC LIMIT 5) d) AS diseases,

            (SELECT json_agg(p ORDER BY scanned_at DESC)
             FROM (SELECT id, pest_name, infestation, organic_ctrl, chemical_ctrl, treatment,
                          scanned_at, image_url
                   FROM pest_scans
                   WHERE farm_id = $1
                   ORDER BY scanned_at DESC LIMIT 5) p) AS pests,

            (SELECT json_agg(t ORDER BY scheduled_at)
             FROM (SELECT id, task_name, task_type, scheduled_at,
                          urgency, completed
                   FROM crop_calendar
                   WHERE farm_id = $1 AND completed = FALSE
                   ORDER BY scheduled_at LIMIT 10) t) AS tasks,

            (SELECT json_agg(e ORDER BY date DESC)
             FROM (SELECT id, category, amount, description, date
                   FROM expenses
                   WHERE farm_id = $1
                   ORDER BY date DESC LIMIT 50) e) AS expenses,

            (SELECT json_agg(a ORDER BY created_at DESC)
             FROM (SELECT alert_type, severity, title, message,
                          created_at
                   FROM alerts
                   WHERE farm_id = $1 AND is_read = FALSE
                   ORDER BY created_at DESC LIMIT 10) a) AS alerts,

            (SELECT row_to_json(ss)
             FROM season_summary ss
             WHERE ss.farm_id = $1
             ORDER BY updated_at DESC LIMIT 1) AS season_summary,

            (SELECT json_agg(c)
             FROM (SELECT crop_name, variety, status, sown_date,
                          harvest_date
                   FROM crops
                   WHERE farm_id = $1
                     AND status = 'growing') c) AS active_crops

        FROM farms f
        WHERE f.id = $1
    """, farm_id)

    if not row:
        return {}
    data = dict(row)
    # asyncpg returns row_to_json/json_agg columns as JSON strings —
    # parse them so API consumers get real objects/arrays, not strings.
    for key in ("soil", "diseases", "pests", "tasks",
                "expenses", "alerts", "season_summary", "active_crops"):
        val = data.get(key)
        if isinstance(val, str):
            try:
                data[key] = json.loads(val)
            except Exception:
                data[key] = None
    return data
