"""
KrishiMitra — Drought Shield & Water Stress Defense API
Precision water budgeting, drought stress index, optimized drip scheduling,
certified drought-resilient crops, and government relief subsidy integration.
Entirely in English.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

router = APIRouter(prefix="/api/v1/drought", tags=["drought"])


class DroughtAssessmentRequest(BaseModel):
    crop_name: str = Field("Cotton", description="Current or planned crop")
    acres: float = Field(2.0, ge=0.1, le=500.0, description="Cultivated land area in acres")
    water_source: str = Field("Borewell", description="Primary water source")
    daily_water_hours: float = Field(1.5, ge=0.1, le=24.0, description="Pump run time in hours per day")
    pump_hp: float = Field(3.0, ge=0.5, le=30.0, description="Motor pump horsepower (HP)")
    irrigation_type: str = Field("Drip Irrigation", description="Irrigation method used")
    soil_type: str = Field("Medium Black Clay", description="Soil texture type")
    growth_stage: str = Field("Flowering & Pod Formation", description="Crop developmental stage")
    district: str = Field("Latur", description="District in Maharashtra or other states")


# Benchmark Crop Water Needs (Liters per acre per day under normal hot conditions)
CROP_WATER_NEEDS = {
    "Sugarcane": {"daily_liters_per_acre": 32000, "drought_tolerance": "LOW", "critical_stage": "Tillering & Grand Growth"},
    "Rice": {"daily_liters_per_acre": 28000, "drought_tolerance": "LOW", "critical_stage": "Panicle Initiation & Flowering"},
    "Tomato": {"daily_liters_per_acre": 18000, "drought_tolerance": "MEDIUM", "critical_stage": "Flowering & Fruit Setting"},
    "Wheat": {"daily_liters_per_acre": 16000, "drought_tolerance": "MEDIUM", "critical_stage": "Crown Root & Flowering"},
    "Cotton": {"daily_liters_per_acre": 15000, "drought_tolerance": "MEDIUM-HIGH", "critical_stage": "Square Formation & Boll Development"},
    "Soybean": {"daily_liters_per_acre": 13000, "drought_tolerance": "MEDIUM-HIGH", "critical_stage": "Pod Filling & Seed Enlargement"},
    "Onion": {"daily_liters_per_acre": 14000, "drought_tolerance": "MEDIUM", "critical_stage": "Bulb Development"},
    "Maize": {"daily_liters_per_acre": 15000, "drought_tolerance": "MEDIUM", "critical_stage": "Tasseling & Silking"},
    "Potato": {"daily_liters_per_acre": 16000, "drought_tolerance": "MEDIUM", "critical_stage": "Tuber Initiation"},
    "Pomegranate": {"daily_liters_per_acre": 11000, "drought_tolerance": "HIGH", "critical_stage": "Fruit Development"},
    "Chickpea": {"daily_liters_per_acre": 7500, "drought_tolerance": "VERY HIGH", "critical_stage": "Pod Setting"},
    "Sorghum": {"daily_liters_per_acre": 8000, "drought_tolerance": "VERY HIGH", "critical_stage": "Boot Stage & Grain Filling"},
    "Pearl Millet": {"daily_liters_per_acre": 6500, "drought_tolerance": "EXCELLENT", "critical_stage": "Grain Filling"},
}

# University Certified Drought-Resilient Crop Catalog (MPKV Rahuri / VNMKV Parbhani)
DROUGHT_RESILIENT_CROPS = [
    {
        "crop": "Rabi Sorghum (Jowar)",
        "variety": "Phule Revati / Phule Yashoda",
        "institution": "MPKV Rahuri",
        "water_savings": "60% less water than Wheat",
        "duration_days": "115 - 120 days",
        "water_turns": "Only 1 to 2 protective irrigations required",
        "yield_potential": "14 - 18 Quintals / Acre",
        "benefits": "Deep root penetration, high fodder quality during dry spells."
    },
    {
        "crop": "Chickpea (Gram / Harbara)",
        "variety": "Phule Vikram / Digvijay",
        "institution": "MPKV Rahuri",
        "water_savings": "55% less water than cash crops",
        "duration_days": "100 - 105 days",
        "water_turns": "Succeeds on residual soil moisture + 1 drip round",
        "yield_potential": "10 - 12 Quintals / Acre",
        "benefits": "Wilt resistant, mechanically harvestable, excellent market price."
    },
    {
        "crop": "Pigeon Pea (Tur / Arhar)",
        "variety": "BDN-711 / Godavari",
        "institution": "VNMKV Parbhani",
        "water_savings": "50% less water than Sugarcane",
        "duration_days": "150 - 155 days",
        "water_turns": "Tolerates up to 35 days dry spell without wilting",
        "yield_potential": "8 - 11 Quintals / Acre",
        "benefits": "Taproot penetrates 2 meters deep to extract subsoil moisture."
    },
    {
        "crop": "Pearl Millet (Bajra)",
        "variety": "Phule Mahashakti / Dhanashakti",
        "institution": "MPKV Rahuri / ICRISAT",
        "water_savings": "70% less water than Maize",
        "duration_days": "80 - 85 days",
        "water_turns": "Thrives in low rainfall (350-450mm)",
        "yield_potential": "12 - 15 Quintals / Acre",
        "benefits": "Highest temperature tolerance (up to 44°C), iron-rich grains."
    },
    {
        "crop": "Drumstick (Moringa)",
        "variety": "PKM-1 / ODC-3",
        "institution": "TNAU / Dryland Research Station",
        "water_savings": "75% less water than Banana/Cane",
        "duration_days": "Perennial (Starts yielding at 6 months)",
        "water_turns": "25 liters per tree every 4 days via dripper",
        "yield_potential": "₹1.5 Lakh - ₹2.5 Lakh / Acre profit",
        "benefits": "Year-round steady market demand, zero loss from severe drought."
    },
    {
        "crop": "Custard Apple (Sitaphal)",
        "variety": "Balanagar / NMK-1 (Golden)",
        "institution": "VNMKV Parbhani",
        "water_savings": "80% less water than Grapes",
        "duration_days": "Hardy dryland fruit orchard",
        "water_turns": "Highly drought-adapted, minimal water post-fruit set",
        "yield_potential": "₹2 Lakh / Acre",
        "benefits": "Cattle do not graze leaves, thrives on poor rocky soils."
    }
]

# Government Schemes & Subsidies for Drought Relief
DROUGHT_SCHEMES = [
    {
        "title": "PM Krishi Sinchayee Yojana (PMKSY) — Drip & Sprinkler Subsidy",
        "authority": "Department of Agriculture, Govt. of Maharashtra",
        "benefit": "75% to 80% subsidy for small & marginal farmers on micro-irrigation systems.",
        "eligibility": "7/12 land record, active electricity/solar connection or farm pond.",
        "portal_name": "MahaDBT Farmer Portal",
        "portal_url": "https://mahadbt.maharashtra.gov.in",
        "tag": "80% Micro-Irrigation Subsidy"
    },
    {
        "title": "Magel Tyala Shettale (Individual Farm Pond Scheme)",
        "authority": "Govt. of Maharashtra Dryland Farming Directorate",
        "benefit": "Up to ₹50,000 for pond excavation + ₹75,000 for 500-micron plastic lining.",
        "eligibility": "Minimum 0.60 hectare land ownership, no existing government pond.",
        "portal_name": "MahaDBT Shettale Portal",
        "portal_url": "https://mahadbt.maharashtra.gov.in",
        "tag": "100% Water Storage Grant"
    },
    {
        "title": "Pradhan Mantri Fasal Bima Yojana (PMFBY) — ₹1 Drought Compensation",
        "authority": "Ministry of Agriculture & Farmers Welfare",
        "benefit": "Full crop loss compensation if drought causes mid-season adversity or localized deficit.",
        "eligibility": "Farmers insured under ₹1 scheme + e-Pik Pahani digital crop record.",
        "portal_name": "National Crop Insurance Portal",
        "portal_url": "https://pmfby.gov.in",
        "tag": "Crop Insurance Claim"
    },
    {
        "title": "Kusum Solar Agriculture Pump Subsidy (Component-B)",
        "authority": "MEDA (Maharashtra Energy Development Agency)",
        "benefit": "90% subsidy on 3 HP, 5 HP, and 7.5 HP standalone solar water pumps.",
        "eligibility": "Farmers without conventional grid electricity in drought-notified talukas.",
        "portal_name": "MahaVitaran Solar Portal",
        "portal_url": "https://www.mahadiscom.in/solar_ksy/",
        "tag": "90% Solar Pump Grant"
    }
]


@router.post("/analyze")
async def analyze_drought_stress(req: DroughtAssessmentRequest):
    """
    Computes precise water balance, stress severity, emergency survival schedule,
    and mitigation strategies tailored to crop and land specifications.
    Open to all users and farmers.
    """
    crop_clean = req.crop_name.strip().capitalize()
    benchmark = CROP_WATER_NEEDS.get(crop_clean, {
        "daily_liters_per_acre": 15000,
        "drought_tolerance": "MEDIUM",
        "critical_stage": "Flowering & Fruit Development"
    })

    # 1. Calculate Water Supply
    # Average pump discharge (liters per hour per HP)
    liters_per_hp_hour = 4200.0
    daily_water_supplied = req.pump_hp * req.daily_water_hours * liters_per_hp_hour

    # Irrigation efficiency multiplier
    eff_multiplier = 0.90 if "drip" in req.irrigation_type.lower() else (0.75 if "sprinkler" in req.irrigation_type.lower() else 0.50)
    effective_water_available = daily_water_supplied * eff_multiplier

    # 2. Calculate Water Demand
    daily_demand_liters = benchmark["daily_liters_per_acre"] * req.acres

    # Growth stage demand adjustments
    stage_lower = req.growth_stage.lower()
    if "flowering" in stage_lower or "pod" in stage_lower or "boll" in stage_lower:
        stage_multiplier = 1.25  # peak water consumption period
    elif "fruit" in stage_lower or "seed" in stage_lower:
        stage_multiplier = 1.15
    elif "seedling" in stage_lower or "vegetative" in stage_lower:
        stage_multiplier = 0.70
    else:
        stage_multiplier = 0.90

    total_demand = daily_demand_liters * stage_multiplier

    # Soil retention adjustments
    soil_lower = req.soil_type.lower()
    if "heavy black" in soil_lower or "deep black" in soil_lower or "regur" in soil_lower:
        retention_days = 6.0
        soil_bonus = "High clay content retains subsoil moisture up to 6 days."
    elif "medium black" in soil_lower:
        retention_days = 4.0
        soil_bonus = "Medium retention capacity; holds moisture up to 4 days."
    else:
        retention_days = 2.0
        soil_bonus = "Light or sandy texture; quick drainage requires frequent micro-dosing."

    # 3. Water Stress Index (WSI)
    coverage_ratio = effective_water_available / max(total_demand, 1.0)
    deficit_liters = max(0, int(total_demand - effective_water_available))
    surplus_liters = max(0, int(effective_water_available - total_demand))

    if coverage_ratio >= 1.05:
        stress_level = "OPTIMAL"
        stress_color = "#10b981"
        stress_badge = "Adequate Water Supply"
        survival_run_days = 45
        stress_pct = 15
    elif coverage_ratio >= 0.75:
        stress_level = "MODERATE"
        stress_color = "#f59e0b"
        stress_badge = "Mild Moisture Deficit"
        survival_run_days = 28
        stress_pct = 40
    elif coverage_ratio >= 0.45:
        stress_level = "HIGH"
        stress_color = "#f97316"
        stress_badge = "Severe Moisture Stress"
        survival_run_days = 16
        stress_pct = 72
    else:
        stress_level = "CRITICAL"
        stress_color = "#ef4444"
        stress_badge = "Extreme Drought Threat — Crop Failure Risk"
        survival_run_days = 8
        stress_pct = 95

    # 4. Precision Irrigation Schedule
    if coverage_ratio < 0.70:
        recommended_interval_days = 3
        daily_drip_duration_hours = round(min(req.daily_water_hours, 2.0), 1)
        cycle_note = "Irrigate every 3 days instead of daily. Water strictly between 5:30 AM – 7:30 AM to eliminate midday sun evaporation."
    else:
        recommended_interval_days = 2
        daily_drip_duration_hours = round(min(req.daily_water_hours, 3.0), 1)
        cycle_note = "Irrigate every alternate morning. Split delivery into two micro-pulses for maximum root-zone infiltration."

    water_saved_percent = 35 if "drip" in req.irrigation_type.lower() else 55

    # 5. Emergency Protocols
    emergency_protocols = {
        "mulching": "Spread a 3-inch thick layer of sugarcane trash, soybean residue, or straw mulch around the root zone to stop 40% surface evaporation.",
        "anti_transpirant_spray": "Foliar spray with 5% Kaolin clay (50g/L) or Potassium Nitrate (1%) at sunrise to create a reflective leaf shield and reduce transpiration by 30%.",
        "alternate_furrow_irrigation": "Water only odd-numbered rows during this cycle; switch to even-numbered rows next cycle to cut water demand in half.",
        "stage_prioritization": f"Prioritize all available water strictly for {benchmark.get('critical_stage', 'Flowering & Fruit Setting')} stage."
    }

    actionable_recs = [
        f"Shift all irrigation between 5:30 AM – 7:30 AM to eliminate up to 35% midday solar vaporization.",
        f"Apply organic straw mulching to preserve subsoil moisture in {req.soil_type}.",
        f"Utilize alternate furrow or pulse drip irrigation to stretch available water to ~{survival_run_days} days.",
        f"Apply for 80% drip subsidy and farm pond assistance through the Mahadbt portal."
    ]

    return {
        "crop": crop_clean,
        "acres": req.acres,
        "district": req.district,
        "stress_level": stress_level,
        "water_stress_index": stress_pct,
        "estimated_survival_days": survival_run_days,
        "summary": f"Your {crop_clean} crop currently requires {int(total_demand):,} L/day, while current irrigation delivers {int(effective_water_available):,} L/day ({round(coverage_ratio * 100)}% coverage). {stress_badge}.",
        "water_balance": {
            "crop_daily_demand_liters": int(total_demand),
            "effective_supply_liters": int(effective_water_available),
            "irrigation_efficiency_pct": int(eff_multiplier * 100),
            "water_deficit_liters": deficit_liters,
            "water_surplus_liters": surplus_liters
        },
        "water_stress": {
            "level": stress_level,
            "badge": stress_badge,
            "color": stress_color,
            "coverage_ratio_percent": round(coverage_ratio * 100, 1),
            "estimated_survival_days": survival_run_days,
            "daily_demand_liters": int(total_demand),
            "daily_available_liters": int(effective_water_available),
            "daily_deficit_liters": deficit_liters
        },
        "soil_analysis": {
            "soil_type": req.soil_type,
            "retention_days": retention_days,
            "note": soil_bonus
        },
        "drip_schedule": {
            "recommended_run_time_per_session": f"{daily_drip_duration_hours} Hours",
            "recommended_run_hours": daily_drip_duration_hours,
            "optimal_watering_window": "5:30 AM – 7:30 AM (Early Morning)",
            "optimal_window": "5:30 AM – 7:30 AM (Early Morning)",
            "avoid_window": "11:00 AM – 4:00 PM (Peak Solar Loss)",
            "watering_frequency": f"Every {recommended_interval_days} Days",
            "interval_days": recommended_interval_days,
            "water_saved_percent": f"{water_saved_percent}%",
            "tip": cycle_note,
            "guideline": cycle_note
        },
        "emergency_protocols": emergency_protocols,
        "actionable_recommendations": actionable_recs,
        "drought_resilient_crops": DROUGHT_RESILIENT_CROPS,
        "schemes": DROUGHT_SCHEMES,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/crops")
async def get_drought_tolerant_crops():
    """Returns curated list of university-certified dryland crops."""
    return {
        "status": "success",
        "drought_resilient_crops": DROUGHT_RESILIENT_CROPS
    }


@router.get("/schemes")
async def get_drought_relief_schemes():
    """Returns government drought subsidy programs and portal links."""
    return {
        "status": "success",
        "schemes": DROUGHT_SCHEMES
    }
