"""
Smart Treatment Time Scheduler
Finds the best spray/treatment window using weather forecast data.
Avoids rain, high wind, and extreme temperature windows.
"""

from datetime import datetime, timedelta


# Thresholds
MAX_WIND_SPEED_KMPH = 25
MAX_RAIN_PROB_PCT = 30
MIN_TEMP_C = 5
MAX_TEMP_C = 40
IDEAL_HUMIDITY_RANGE = (40, 85)
RAIN_LOOKBACK_HOURS = 4
RAIN_LOOKAHEAD_HOURS = 6
MIN_DRY_WINDOW_HOURS = 4


def _parse_forecast_hours(forecast_data: list[dict]) -> list[dict]:
    """
    Normalize hourly/3-hourly forecast entries into a uniform format.
    Expected keys per entry: dt (unix), temp, humidity, wind_speed, rain_prob, rain_mm, condition
    """
    parsed = []
    for entry in forecast_data:
        dt_val = entry.get("dt")
        if isinstance(dt_val, (int, float)):
            dt = datetime.fromtimestamp(dt_val)
        elif isinstance(dt_val, str):
            dt = datetime.fromisoformat(dt_val)
        else:
            continue

        parsed.append({
            "dt": dt,
            "temp": float(entry.get("temp", 25)),
            "humidity": float(entry.get("humidity", 50)),
            "wind_speed": float(entry.get("wind_speed", 0)),
            "rain_prob": float(entry.get("rain_prob", entry.get("pop", 0)) or 0),
            "rain_mm": float(entry.get("rain_mm", entry.get("rain", {}).get("3h", 0)) if isinstance(entry.get("rain", 0), dict) else entry.get("rain_mm", 0)),
            "condition": entry.get("condition", entry.get("weather", [{}])[0].get("main", "Clear") if isinstance(entry.get("weather"), list) else "Clear"),
        })

    parsed.sort(key=lambda x: x["dt"])
    return parsed


def _rate_hour(hour: dict) -> dict:
    """Rate a single hour for suitability (0-100). Higher is better."""
    score = 100
    reasons_bad = []
    reasons_good = []

    # Wind check
    if hour["wind_speed"] > MAX_WIND_SPEED_KMPH:
        score -= 50
        reasons_bad.append(f"Wind too strong ({hour['wind_speed']} km/h)")
    elif hour["wind_speed"] > 15:
        score -= 15
        reasons_bad.append(f"Moderate wind ({hour['wind_speed']} km/h)")
    else:
        reasons_good.append(f"Calm wind ({hour['wind_speed']} km/h)")

    # Rain probability
    if hour["rain_prob"] > MAX_RAIN_PROB_PCT:
        score -= 40
        reasons_bad.append(f"Rain likely ({hour['rain_prob']}%)")
    elif hour["rain_prob"] > 15:
        score -= 10
    else:
        reasons_good.append("Low rain probability")

    # Active rain
    if hour["rain_mm"] > 0.5:
        score -= 30
        reasons_bad.append(f"Active rainfall ({hour['rain_mm']}mm)")

    # Temperature
    if hour["temp"] < MIN_TEMP_C or hour["temp"] > MAX_TEMP_C:
        score -= 20
        reasons_bad.append(f"Extreme temperature ({hour['temp']}°C)")
    elif 15 <= hour["temp"] <= 30:
        reasons_good.append(f"Ideal temperature ({hour['temp']}°C)")

    # Humidity
    hum = hour["humidity"]
    if IDEAL_HUMIDITY_RANGE[0] <= hum <= IDEAL_HUMIDITY_RANGE[1]:
        reasons_good.append(f"Good humidity ({hum}%)")
    elif hum > 90:
        score -= 10
        reasons_bad.append(f"Very high humidity ({hum}%)")

    # Weather condition penalty
    cond = hour["condition"].lower()
    if any(w in cond for w in ("thunderstorm", "heavy rain")):
        score -= 30
    elif any(w in cond for w in ("rain", "drizzle")):
        score -= 15
    elif any(w in cond for w in ("fog", "mist")):
        score -= 5

    score = max(0, min(100, score))

    return {
        **hour,
        "suitability_score": score,
        "reasons_good": reasons_good,
        "reasons_bad": reasons_bad,
        "suitable": score >= 60,
    }


def find_best_treatment_windows(
    forecast_data: list[dict],
    min_window_hours: int = MIN_DRY_WINDOW_HOURS,
    max_results: int = 3,
) -> dict:
    """
    Analyze forecast and find the best treatment windows.

    Args:
        forecast_data: list of forecast entries from weather API
        min_window_hours: minimum consecutive suitable hours
        max_results: max number of windows to return

    Returns: dict with windows list and overall recommendation
    """
    hours = _parse_forecast_hours(forecast_data)
    if not hours:
        return {
            "windows": [],
            "recommendation": "No forecast data available. Check weather before applying treatment.",
            "engine": "Weather-Based Treatment Scheduler",
        }

    rated = [_rate_hour(h) for h in hours]

    # Find consecutive suitable windows
    windows = []
    current_window_start = None
    current_window_hours = []

    for h in rated:
        if h["suitable"]:
            if current_window_start is None:
                current_window_start = h["dt"]
            current_window_hours.append(h)
        else:
            if current_window_hours and len(current_window_hours) >= min_window_hours:
                avg_score = sum(x["suitability_score"] for x in current_window_hours) / len(current_window_hours)
                windows.append({
                    "start": current_window_start.isoformat(),
                    "end": current_window_hours[-1]["dt"].isoformat(),
                    "duration_hours": len(current_window_hours),
                    "avg_score": round(avg_score, 1),
                    "best_hour": max(current_window_hours, key=lambda x: x["suitability_score"])["dt"].isoformat(),
                    "conditions": {
                        "temp_range": f"{min(x['temp'] for x in current_window_hours)}-{max(x['temp'] for x in current_window_hours)}°C",
                        "wind_range": f"{min(x['wind_speed'] for x in current_window_hours)}-{max(x['wind_speed'] for x in current_window_hours)} km/h",
                        "max_rain_prob": f"{max(x['rain_prob'] for x in current_window_hours)}%",
                    },
                })
            current_window_start = None
            current_window_hours = []

    # Handle last window
    if current_window_hours and len(current_window_hours) >= min_window_hours:
        avg_score = sum(x["suitability_score"] for x in current_window_hours) / len(current_window_hours)
        windows.append({
            "start": current_window_start.isoformat(),
            "end": current_window_hours[-1]["dt"].isoformat(),
            "duration_hours": len(current_window_hours),
            "avg_score": round(avg_score, 1),
            "best_hour": max(current_window_hours, key=lambda x: x["suitability_score"])["dt"].isoformat(),
            "conditions": {
                "temp_range": f"{min(x['temp'] for x in current_window_hours)}-{max(x['temp'] for x in current_window_hours)}°C",
                "wind_range": f"{min(x['wind_speed'] for x in current_window_hours)}-{max(x['wind_speed'] for x in current_window_hours)} km/h",
                "max_rain_prob": f"{max(x['rain_prob'] for x in current_window_hours)}%",
            },
        })

    # Sort by score, take top N
    windows.sort(key=lambda w: w["avg_score"], reverse=True)
    windows = windows[:max_results]

    if windows:
        best = windows[0]
        recommendation = (
            f"Best treatment window: {best['start'][:16]} to {best['end'][:16]} "
            f"({best['duration_hours']}h, score {best['avg_score']}/100). "
            f"Conditions: {best['conditions']['temp_range']}, wind {best['conditions']['wind_range']}."
        )
    else:
        recommendation = (
            "No suitable treatment windows found in the forecast period. "
            "Wait for calmer, dry conditions before applying pesticide or fungicide."
        )

    # Generate per-hour timeline for chart
    timeline = []
    for h in rated:
        timeline.append({
            "time": h["dt"].isoformat(),
            "score": h["suitability_score"],
            "suitable": h["suitable"],
            "temp": h["temp"],
            "wind": h["wind_speed"],
            "rain_prob": h["rain_prob"],
        })

    return {
        "windows": windows,
        "timeline": timeline[:48],  # Limit to 48 hours
        "recommendation": recommendation,
        "engine": "Weather-Based Treatment Scheduler",
    }
