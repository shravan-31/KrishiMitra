from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import datetime
from pydantic import BaseModel
from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/crops", tags=["crops"])

class CropCreate(BaseModel):
    farm_id: int
    crop_name: str
    variety: Optional[str] = ""
    sown_date: Optional[datetime.date] = None
    harvest_date: Optional[datetime.date] = None
    area_acres: Optional[float] = 0.0
    status: Optional[str] = "growing"

class CropOut(BaseModel):
    id: int
    farm_id: int
    crop_name: str
    variety: Optional[str]
    sown_date: Optional[datetime.date]
    harvest_date: Optional[datetime.date]
    area_acres: Optional[float]
    status: Optional[str]

class RecommendRequest(BaseModel):
    ph: float
    nitrogen: float
    phosphorus: float
    potassium: float
    location: str
    season: str
    water_availability: str

async def verify_farm_owner(farm_id: int, user_id: int, db) -> None:
    owner_id = await db.fetchval("SELECT user_id FROM farms WHERE id = $1", farm_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    if owner_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this farm")

@router.post("", response_model=CropOut)
async def create_crop(crop: CropCreate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_farm_owner(crop.farm_id, user["id"], db)
    row = await db.fetchrow(
        """
        INSERT INTO crops (farm_id, crop_name, variety, sown_date, harvest_date, area_acres, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, farm_id, crop_name, variety, sown_date, harvest_date, area_acres, status
        """,
        crop.farm_id, crop.crop_name, crop.variety, crop.sown_date, crop.harvest_date, crop.area_acres, crop.status
    )
    return dict(row)

@router.get("", response_model=List[CropOut])
async def list_crops(farm_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_farm_owner(farm_id, user["id"], db)
    rows = await db.fetch(
        "SELECT id, farm_id, crop_name, variety, sown_date, harvest_date, area_acres, status FROM crops WHERE farm_id = $1 ORDER BY id DESC",
        farm_id
    )
    return [dict(row) for row in rows]

@router.get("/{crop_id}", response_model=CropOut)
async def get_crop(crop_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    row = await db.fetchrow(
        "SELECT id, farm_id, crop_name, variety, sown_date, harvest_date, area_acres, status FROM crops WHERE id = $1",
        crop_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Crop not found")
    await verify_farm_owner(row["farm_id"], user["id"], db)
    return dict(row)

@router.put("/{crop_id}", response_model=CropOut)
async def update_crop(crop_id: int, crop: CropCreate, user=Depends(get_current_user), db=Depends(get_db)):
    existing_farm_id = await db.fetchval("SELECT farm_id FROM crops WHERE id = $1", crop_id)
    if not existing_farm_id:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    await verify_farm_owner(existing_farm_id, user["id"], db)
    await verify_farm_owner(crop.farm_id, user["id"], db)
    
    row = await db.fetchrow(
        """
        UPDATE crops
        SET farm_id = $1, crop_name = $2, variety = $3, sown_date = $4, harvest_date = $5, area_acres = $6, status = $7
        WHERE id = $8
        RETURNING id, farm_id, crop_name, variety, sown_date, harvest_date, area_acres, status
        """,
        crop.farm_id, crop.crop_name, crop.variety, crop.sown_date, crop.harvest_date, crop.area_acres, crop.status, crop_id
    )
    return dict(row)

@router.delete("/{crop_id}")
async def delete_crop(crop_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    farm_id = await db.fetchval("SELECT farm_id FROM crops WHERE id = $1", crop_id)
    if not farm_id:
        raise HTTPException(status_code=404, detail="Crop not found")
        
    await verify_farm_owner(farm_id, user["id"], db)
    await db.execute("DELETE FROM crops WHERE id = $1", crop_id)
    return {"ok": True}

@router.post("/recommend")
async def recommend_crops(
    req: RecommendRequest,
    user=Depends(get_current_user)
):
    # Static top crops list based on request variables
    crops = [
        {"crop_name": "Wheat", "profitability_score": 92.0, "water_need": "MEDIUM", "market_demand": "HIGH", "best_state": "Punjab"},
        {"crop_name": "Rice", "profitability_score": 88.0, "water_need": "HIGH", "market_demand": "HIGH", "best_state": "West Bengal"},
        {"crop_name": "Maize", "profitability_score": 81.0, "water_need": "LOW", "market_demand": "MEDIUM", "best_state": "Karnataka"},
        {"crop_name": "Cotton", "profitability_score": 79.0, "water_need": "MEDIUM", "market_demand": "HIGH", "best_state": "Gujarat"},
        {"crop_name": "Soybean", "profitability_score": 75.0, "water_need": "LOW", "market_demand": "MEDIUM", "best_state": "Madhya Pradesh"}
    ]
    return crops

@router.get("/calendar/{crop}/{state}")
async def get_crop_calendar(
    crop: str,
    state: str,
    user=Depends(get_current_user)
):
    # Static schedules mapped by crop
    crop_lower = crop.lower()
    if "wheat" in crop_lower:
        sowing = "Nov 1 - Nov 30"
        irrigation = ["Crown Root Initiation (21 days)", "Tillering (40 days)", "Flowering (80 days)"]
        fertilizer = ["Basal: NPK 12:32:16", "Top dress: Urea at 30 days", "Top dress: Urea at 60 days"]
        harvest = "April 1 - April 30"
    elif "rice" in crop_lower:
        sowing = "June 1 - June 30"
        irrigation = ["Transplanting (1-7 days)", "Panicle Initiation (60 days)", "Heading (85 days)"]
        fertilizer = ["Basal: compost + NPK", "Urea: 3 weeks after transplanting", "Urea: 7 weeks after transplanting"]
        harvest = "Oct 15 - Nov 15"
    else:
        sowing = "Immediate"
        irrigation = ["Regular vegetative phase", "Flowering phase"]
        fertilizer = ["Balanced organic manure", "Urea split doses"]
        harvest = "After 90-120 days"

    return {
        "sowing_window": sowing,
        "irrigation_schedule": irrigation,
        "fertilizer_schedule": fertilizer,
        "harvest_window": harvest
    }
