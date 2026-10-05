"""
Smart Crop Health Alert System
Centralized function: determine_crop_alert_status()
GREEN = Healthy / Low Risk
YELLOW = Warning / Moderate Risk / Uncertain
RED = Confirmed Disease / Pest / High Risk
"""


def determine_crop_alert_status(
    disease_name: str | None = None,
    disease_confidence: float | None = None,
    disease_severity: str | None = None,
    is_uncertain: bool = False,
    is_healthy: bool = True,
    pest_name: str | None = None,
    pest_infestation: str | None = None,
    weather_risk_level: str = "LOW",
) -> dict:
    """
    Returns a deterministic alert status based on real model output,
    disease severity, pest risk, confidence, and weather disease risk.

    Args:
        disease_confidence: 0.0 - 1.0 (raw model probability)
        disease_severity: LOW / MEDIUM / HIGH / CRITICAL
        is_uncertain: True if model confidence was below threshold
        is_healthy: True if prediction class is a 'healthy' class
        pest_infestation: LOW / MEDIUM / HIGH
        weather_risk_level: LOW / MEDIUM / HIGH from disease_risk_engine
    """
    reasons = []
    actions = []

    # ─── RED conditions ───────────────────────────────────────────────
    red_triggered = False

    # Confirmed disease with high confidence
    if (not is_healthy and not is_uncertain and disease_confidence is not None
            and disease_confidence >= 0.70 and disease_severity in ("HIGH", "CRITICAL")):
        red_triggered = True
        conf_pct = round(disease_confidence * 100, 1)
        reasons.append(f"{disease_name} detected with {conf_pct}% confidence")
        actions.append("Immediate treatment recommended. Follow the treatment plan below.")

    # High pest infestation
    if pest_infestation == "HIGH":
        red_triggered = True
        reasons.append(f"High pest infestation: {pest_name}")
        actions.append("Apply pest control measures immediately.")

    # Weather risk HIGH combined with active disease
    if weather_risk_level == "HIGH" and not is_healthy:
        red_triggered = True
        reasons.append("Weather conditions highly favorable for disease spread")
        actions.append("Inspect crop within 24 hours.")

    if red_triggered:
        return {
            "status": "RED",
            "status_label": "High Risk",
            "reason": "; ".join(reasons),
            "recommended_action": " ".join(actions),
            "icon": "🔴",
        }

    # ─── YELLOW conditions ────────────────────────────────────────────
    yellow_triggered = False

    # Uncertain model prediction
    if is_uncertain:
        yellow_triggered = True
        reasons.append("Model prediction is uncertain — low confidence")
        actions.append("Upload another clearer image or monitor crop closely.")

    # Moderate disease severity
    if disease_severity == "MEDIUM" and not is_healthy:
        yellow_triggered = True
        conf_pct = round((disease_confidence or 0) * 100, 1)
        reasons.append(f"Moderate disease severity: {disease_name} ({conf_pct}%)")
        actions.append("Monitor crop and apply preventive treatment if symptoms increase.")

    # Medium pest infestation
    if pest_infestation == "MEDIUM":
        yellow_triggered = True
        reasons.append(f"Moderate pest activity: {pest_name}")
        actions.append("Monitor and apply organic controls if needed.")

    # Weather risk MEDIUM
    if weather_risk_level == "MEDIUM":
        yellow_triggered = True
        reasons.append("Weather conditions moderately favorable for disease")
        actions.append("Keep monitoring — conditions may worsen.")

    # Weather risk HIGH but crop is currently healthy
    if weather_risk_level == "HIGH" and is_healthy:
        yellow_triggered = True
        reasons.append("Weather disease risk is high, but crop currently appears healthy")
        actions.append("Preventive inspection recommended within 48 hours.")

    if yellow_triggered:
        return {
            "status": "YELLOW",
            "status_label": "Warning",
            "reason": "; ".join(reasons),
            "recommended_action": " ".join(actions),
            "icon": "🟡",
        }

    # ─── GREEN ────────────────────────────────────────────────────────
    return {
        "status": "GREEN",
        "status_label": "Healthy",
        "reason": "No major disease or pest risk detected.",
        "recommended_action": "Continue regular monitoring.",
        "icon": "🟢",
    }


def compute_followup_trend(
    initial_confidence: float,
    new_confidence: float,
    initial_severity: str,
    new_severity: str,
) -> dict:
    """
    Compare original and follow-up scan to determine trend.
    Returns IMPROVING / STABLE / WORSENING.
    This is an AI-observed visual trend, NOT a confirmed agronomic recovery.
    """
    severity_rank = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
    init_rank = severity_rank.get(initial_severity, 2)
    new_rank = severity_rank.get(new_severity, 2)

    conf_delta = new_confidence - initial_confidence
    rank_delta = new_rank - init_rank

    if conf_delta <= -0.10 or rank_delta <= -1:
        trend = "IMPROVING"
        message = "AI-observed visual trend suggests improvement. Continue monitoring."
    elif conf_delta >= 0.10 or rank_delta >= 1:
        trend = "WORSENING"
        message = "AI-observed visual trend suggests worsening. Consult an agricultural professional."
    else:
        trend = "STABLE"
        message = "AI-observed visual trend shows little change. Continue current treatment plan."

    return {
        "trend": trend,
        "message": message,
        "confidence_change": round(conf_delta * 100, 1),
        "severity_change": f"{initial_severity} → {new_severity}",
        "disclaimer": "This is an AI-observed visual trend, not a confirmed recovery assessment.",
    }
