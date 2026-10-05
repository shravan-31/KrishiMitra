from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel, Field
from app.middleware.auth import get_current_user
from app.database import get_db
from app.ml.yield_pred import predict_yield
from app.integration_engine import on_yield_predicted

router = APIRouter(prefix="/api/v1/yield", tags=["yield"])

class YieldPredictRequest(BaseModel):
    farm_id: int
    crop_name: str
    state: Optional[str] = None
    district: Optional[str] = None
    season: str = "Kharif"
    area_acres: float = Field(..., gt=0, description="Cultivated land area in acres")
    year: int = Field(default=2024, ge=1990, le=2030)

@router.post("/predict")
async def predict_crop_yield(
    req: YieldPredictRequest,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # 1. Resolve State and District (Fix 10: priority hierarchy)
    state = req.state.strip() if req.state and req.state.strip() else None
    district = req.district.strip() if req.district and req.district.strip() else None

    # Fetch farm profile if state or district is missing
    farm_row = await db.fetchrow("SELECT state, district FROM farms WHERE id=$1", req.farm_id)
    if farm_row:
        if not state and farm_row.get("state"):
            state = farm_row["state"].strip()
        if not district and farm_row.get("district"):
            district = farm_row["district"].strip()

    # Fallback to default state if not provided
    if not state:
        state = "Maharashtra"

    # Strictly require district — do NOT silently default to Pune
    if not district:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="District is required for accurate yield prediction. Please select your district."
        )

    # 2. Run ML yield model with genuine prediction intervals
    try:
        pred = predict_yield(
            state=state,
            district=district,
            crop_year=req.year,
            season=req.season,
            crop=req.crop_name,
            area_acres=req.area_acres
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Yield ML prediction failed: {ex}")

    # 3. Save to database (store genuine null confidence per Fix 8)
    await db.execute("""
        INSERT INTO yield_predictions
          (farm_id, crop_name, predicted_kg, confidence, area_acres, season, improvement_tips)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
    """, req.farm_id, req.crop_name, pred["predicted_kg"], pred["confidence"],
         req.area_acres, req.season, pred["improvement_tips"])

    # 4. Prepare yield data for cascade
    predicted_per_acre = round(pred["predicted_kg"] / max(0.1, req.area_acres), 1)
    below_average = predicted_per_acre < 800.0  # kg/acre benchmark
    
    yield_data = {
        "predicted_kg": pred["predicted_kg"],
        "crop_name": req.crop_name,
        "below_average": below_average
    }

    try:
        from app.main import get_ws_manager
        ws_manager = get_ws_manager()
        await on_yield_predicted(req.farm_id, yield_data, db, ws_manager)
    except Exception:
        pass

    tips = [t.strip() for t in pred["improvement_tips"].split("|") if t.strip()]

    return {
        "predicted_kg": pred["predicted_kg"],
        "predicted_per_acre": predicted_per_acre,
        "prediction_interval": pred["prediction_interval"],
        "confidence": None, # Genuine: Regression models provide prediction intervals, not fake %
        "state": state,
        "district": district,
        "improvement_tips": tips,
        "method": "GradientBoostingRegressor (Residual-calibrated 90% interval)"
    }

@router.get("/history/{farm_id}")
async def yield_history(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    rows = await db.fetch("""
        SELECT * FROM yield_predictions
        WHERE farm_id=$1
        ORDER BY predicted_at DESC LIMIT 5
    """, farm_id)
    return [dict(r) for r in rows]
