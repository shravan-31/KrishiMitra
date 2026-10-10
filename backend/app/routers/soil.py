from fastapi import APIRouter, Depends, Form, HTTPException
from app.middleware.auth import get_current_user
from app.database import get_db
from app.websocket import get_ws_manager
from app.ml.soil import predict_soil
from app.integration_engine import on_soil_analyzed

router = APIRouter(prefix="/api/v1/soil", tags=["soil"])

@router.post("/analyze")
async def analyze_soil(
    farm_id: int = Form(...),
    ph: float = Form(...),
    nitrogen: float = Form(...),
    phosphorus: float = Form(...),
    potassium: float = Form(...),
    moisture: float = Form(...),
    ec: float = Form(...),
    temperature: float = Form(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager)
):
    # Fix 17: Strict Agronomic Input Validation
    if not (0.0 <= ph <= 14.0):
        raise HTTPException(status_code=422, detail="Soil pH must be between 0.0 and 14.0")
    if not (0.0 <= nitrogen <= 1000.0):
        raise HTTPException(status_code=422, detail="Nitrogen must be between 0.0 and 1000.0 kg/ha")
    if not (0.0 <= phosphorus <= 500.0):
        raise HTTPException(status_code=422, detail="Phosphorus must be between 0.0 and 500.0 kg/ha")
    if not (0.0 <= potassium <= 1000.0):
        raise HTTPException(status_code=422, detail="Potassium must be between 0.0 and 1000.0 kg/ha")
    if not (0.0 <= moisture <= 100.0):
        raise HTTPException(status_code=422, detail="Moisture percentage must be between 0.0 and 100.0%")
    if not (0.0 <= ec <= 20.0):
        raise HTTPException(status_code=422, detail="Electrical conductivity (EC) must be between 0.0 and 20.0 dS/m")
    if not (-10.0 <= temperature <= 60.0):
        raise HTTPException(status_code=422, detail="Soil temperature must be between -10.0 and 60.0°C")

    try:
        # Run ML prediction (soil.py predict_soil)
        pred = predict_soil(
            n=nitrogen,
            p=phosphorus,
            k=potassium,
            temp=temperature,
            humidity=65.0,  # default humidity
            ph=ph,
            rainfall=100.0, # default rainfall
            organic_matter=2.5,
            moisture=moisture,
            ec=ec
        )
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Soil ML prediction failed: {ex}")

    # Save to soil_reports table
    await db.execute("""
        INSERT INTO soil_reports
          (farm_id, ph_level, nitrogen, phosphorus, potassium,
           organic_matter, moisture, ec, temperature,
           soil_health_score, recommended_crops, fertilizer_advice)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    """, farm_id, ph, nitrogen, phosphorus, potassium,
         2.5, moisture, ec, temperature,
         pred["soil_health_score"], pred["recommended_crops"],
         pred["fertilizer_advice"])

    # Prepare soil_data dict for cascade
    soil_data = {
        "nitrogen": nitrogen,
        "phosphorus": phosphorus,
        "potassium": potassium,
        "ph": ph,
        "recommended_crops": pred["recommended_crops"]
    }

    # Call integration cascade
    score = await on_soil_analyzed(farm_id, soil_data, db, ws_manager)

    # Determine nutrient status
    nutrient_status = {
        "nitrogen": "Optimal" if 50 <= nitrogen <= 150 else ("Deficient" if nitrogen < 50 else "Excess"),
        "phosphorus": "Optimal" if 30 <= phosphorus <= 100 else ("Deficient" if phosphorus < 30 else "Excess"),
        "potassium": "Optimal" if 50 <= potassium <= 200 else ("Deficient" if potassium < 50 else "Excess")
    }

    return {
        "soil_health_score": pred["soil_health_score"],
        "recommended_crops": pred["recommended_crops"],
        "fertilizer_advice": pred["fertilizer_advice"],
        "nutrient_status":   nutrient_status
    }

@router.get("/history/{farm_id}")
async def soil_history(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    rows = await db.fetch("""
        SELECT * FROM soil_reports
        WHERE farm_id=$1
        ORDER BY tested_at DESC LIMIT 10
    """, farm_id)
    return [dict(r) for r in rows]
