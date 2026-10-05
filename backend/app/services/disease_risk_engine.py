"""
Weather-Based Disease Risk Engine
Rule-based deterministic assessment — NOT a trained ML model.
Label: "Rule-Based Disease Risk Assessment"
"""

# Crop-specific susceptibility profiles
CROP_PROFILES = {
    "tomato": {"fungal_susceptibility": 0.85, "optimal_temp_range": (18, 28), "humidity_threshold": 75},
    "potato": {"fungal_susceptibility": 0.90, "optimal_temp_range": (15, 25), "humidity_threshold": 70},
    "corn":   {"fungal_susceptibility": 0.60, "optimal_temp_range": (20, 32), "humidity_threshold": 80},
    "grape":  {"fungal_susceptibility": 0.80, "optimal_temp_range": (18, 30), "humidity_threshold": 70},
    "apple":  {"fungal_susceptibility": 0.75, "optimal_temp_range": (15, 28), "humidity_threshold": 75},
    "pepper": {"fungal_susceptibility": 0.65, "optimal_temp_range": (20, 30), "humidity_threshold": 78},
    "cherry": {"fungal_susceptibility": 0.70, "optimal_temp_range": (15, 28), "humidity_threshold": 75},
    "strawberry": {"fungal_susceptibility": 0.80, "optimal_temp_range": (15, 26), "humidity_threshold": 72},
    "peach":  {"fungal_susceptibility": 0.70, "optimal_temp_range": (18, 30), "humidity_threshold": 75},
    "soybean": {"fungal_susceptibility": 0.55, "optimal_temp_range": (20, 32), "humidity_threshold": 82},
    "squash": {"fungal_susceptibility": 0.75, "optimal_temp_range": (18, 30), "humidity_threshold": 78},
    "orange": {"fungal_susceptibility": 0.50, "optimal_temp_range": (20, 35), "humidity_threshold": 80},
    "raspberry": {"fungal_susceptibility": 0.70, "optimal_temp_range": (15, 26), "humidity_threshold": 75},
    "blueberry": {"fungal_susceptibility": 0.60, "optimal_temp_range": (15, 28), "humidity_threshold": 78},
}

DEFAULT_PROFILE = {"fungal_susceptibility": 0.65, "optimal_temp_range": (18, 30), "humidity_threshold": 78}

# Configurable thresholds
HUMIDITY_HIGH = 85
HUMIDITY_MEDIUM = 70
RAIN_PROB_HIGH = 60
RAIN_PROB_MEDIUM = 30
RAIN_MM_HIGH = 20
RAIN_MM_MEDIUM = 5
WIND_SPRAY_LIMIT = 25  # km/h


def _normalize_crop_name(crop_name: str) -> str:
    """Extract base crop name from PlantVillage class format."""
    if not crop_name:
        return ""
    base = crop_name.split("___")[0].strip().lower()
    base = base.replace("_", " ").replace(",", "").strip()
    # Map common variations
    mapping = {
        "corn (maize)": "corn", "corn maize": "corn",
        "pepper bell": "pepper", "cherry (including sour)": "cherry",
        "cherry including sour": "cherry",
    }
    return mapping.get(base, base.split()[0] if base else "")


def assess_disease_risk(
    crop_name: str,
    temperature: float | None = None,
    humidity: float | None = None,
    rainfall: float | None = None,
    rain_probability: float | None = None,
    wind_speed: float | None = None,
    forecast_condition: str | None = None,
    recent_disease_count: int = 0,
    recent_pest_count: int = 0,
) -> dict:
    """
    Deterministic rule-based disease risk assessment.
    Returns risk_level (LOW/MEDIUM/HIGH), risk_score (0-100),
    risk_factors list, and recommendation.
    """
    crop_key = _normalize_crop_name(crop_name)
    profile = CROP_PROFILES.get(crop_key, DEFAULT_PROFILE)

    risk_score = 0
    risk_factors = []

    # --- Humidity factor (0-30 points) ---
    if humidity is not None:
        if humidity >= HUMIDITY_HIGH:
            pts = 30
            risk_factors.append(f"Very high humidity ({humidity}%)")
        elif humidity >= profile["humidity_threshold"]:
            pts = 20
            risk_factors.append(f"High humidity ({humidity}%)")
        elif humidity >= HUMIDITY_MEDIUM:
            pts = 10
            risk_factors.append(f"Moderate humidity ({humidity}%)")
        else:
            pts = 0
        risk_score += pts

    # --- Rainfall / rain probability factor (0-25 points) ---
    rain_pts = 0
    if rainfall is not None and rainfall > RAIN_MM_HIGH:
        rain_pts = 25
        risk_factors.append(f"Heavy rainfall ({rainfall}mm)")
    elif rainfall is not None and rainfall > RAIN_MM_MEDIUM:
        rain_pts = 15
        risk_factors.append(f"Moderate rainfall ({rainfall}mm)")

    if rain_probability is not None:
        if rain_probability >= RAIN_PROB_HIGH:
            rp = 20
            if rain_pts < 20:
                risk_factors.append(f"High rain probability ({rain_probability}%)")
        elif rain_probability >= RAIN_PROB_MEDIUM:
            rp = 10
            if rain_pts < 10:
                risk_factors.append(f"Moderate rain probability ({rain_probability}%)")
        else:
            rp = 0
        rain_pts = max(rain_pts, rp)

    risk_score += min(rain_pts, 25)

    # --- Temperature factor (0-20 points) ---
    if temperature is not None:
        t_low, t_high = profile["optimal_temp_range"]
        if t_low <= temperature <= t_high:
            risk_score += 15
            risk_factors.append(f"Temperature ({temperature}°C) favorable for fungal growth")
        elif abs(temperature - t_low) <= 3 or abs(temperature - t_high) <= 3:
            risk_score += 8
        # else: temperature outside range, lower risk

    # --- Forecast condition (0-10 points) ---
    if forecast_condition:
        cond_lower = forecast_condition.lower()
        if any(w in cond_lower for w in ("thunderstorm", "heavy rain", "drizzle")):
            risk_score += 10
            risk_factors.append(f"Adverse weather forecast ({forecast_condition})")
        elif any(w in cond_lower for w in ("rain", "mist", "fog", "haze")):
            risk_score += 6
            risk_factors.append(f"Wet weather forecast ({forecast_condition})")
        elif "cloud" in cond_lower:
            risk_score += 3

    # --- Crop susceptibility multiplier ---
    risk_score = int(risk_score * profile["fungal_susceptibility"] / 0.65)

    # --- Recent disease/pest history bonus (0-15 points) ---
    if recent_disease_count > 0:
        bonus = min(recent_disease_count * 5, 10)
        risk_score += bonus
        risk_factors.append(f"Recent disease detections ({recent_disease_count})")
    if recent_pest_count > 0:
        bonus = min(recent_pest_count * 3, 5)
        risk_score += bonus
        risk_factors.append(f"Recent pest detections ({recent_pest_count})")

    # Clamp
    risk_score = max(0, min(100, risk_score))

    # Determine level
    if risk_score >= 65:
        risk_level = "HIGH"
        recommendation = "Inspect crop within 24 hours. Weather conditions are favorable for fungal disease development."
    elif risk_score >= 35:
        risk_level = "MEDIUM"
        recommendation = "Monitor crop closely. Consider preventive measures if symptoms appear."
    else:
        risk_level = "LOW"
        recommendation = "No significant weather-based disease risk detected. Continue regular monitoring."

    return {
        "crop": crop_name,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "risk_factors": risk_factors,
        "recommendation": recommendation,
        "engine": "Rule-Based Disease Risk Assessment",
    }
