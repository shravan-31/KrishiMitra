from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.database import get_db
from app.integration_engine import update_health_score, load_farm_context

router = APIRouter(prefix="/api/v1/farms", tags=["farms"])

class FarmCreate(BaseModel):
    farm_name: str
    location: Optional[str] = ""
    state: Optional[str] = ""
    district: Optional[str] = ""
    area_acres: Optional[float] = 0.0
    soil_type: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class FarmOut(BaseModel):
    id: int
    user_id: int
    farm_name: str
    location: Optional[str]
    state: Optional[str]
    district: Optional[str]
    area_acres: Optional[float]
    soil_type: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]

@router.post("", response_model=FarmOut)
async def create_farm(farm: FarmCreate, user=Depends(get_current_user), db=Depends(get_db)):
    row = await db.fetchrow(
        """
        INSERT INTO farms (user_id, farm_name, location, state, district, area_acres, soil_type, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, user_id, farm_name, location, state, district, area_acres, soil_type, latitude, longitude
        """,
        user["id"], farm.farm_name, farm.location, farm.state, farm.district,
        farm.area_acres, farm.soil_type, farm.latitude, farm.longitude
    )
    return dict(row)

@router.get("", response_model=List[FarmOut])
async def list_farms(user=Depends(get_current_user), db=Depends(get_db)):
    rows = await db.fetch(
        """SELECT id, user_id, farm_name, location, state, district, area_acres, soil_type, latitude, longitude
           FROM farms WHERE user_id = $1 ORDER BY id DESC""",
        user["id"]
    )
    return [dict(row) for row in rows]

@router.get("/{id}", response_model=FarmOut)
async def get_farm(id: int, user=Depends(get_current_user), db=Depends(get_db)):
    row = await db.fetchrow(
        """SELECT id, user_id, farm_name, location, state, district, area_acres, soil_type, latitude, longitude
           FROM farms WHERE id = $1 AND user_id = $2""",
        id, user["id"]
    )
    if not row:
        raise HTTPException(status_code=404, detail="Farm not found")
    return dict(row)

@router.put("/{id}", response_model=FarmOut)
async def update_farm(id: int, farm: FarmCreate, user=Depends(get_current_user), db=Depends(get_db)):
    exists = await db.fetchval("SELECT id FROM farms WHERE id = $1 AND user_id = $2", id, user["id"])
    if not exists:
        raise HTTPException(status_code=404, detail="Farm not found")

    row = await db.fetchrow(
        """
        UPDATE farms
        SET farm_name = $1, location = $2, state = $3, district = $4,
            area_acres = $5, soil_type = $6, latitude = $7, longitude = $8
        WHERE id = $9 AND user_id = $10
        RETURNING id, user_id, farm_name, location, state, district, area_acres, soil_type, latitude, longitude
        """,
        farm.farm_name, farm.location, farm.state, farm.district,
        farm.area_acres, farm.soil_type, farm.latitude, farm.longitude,
        id, user["id"]
    )
    return dict(row)

@router.delete("/{id}")
async def delete_farm(id: int, user=Depends(get_current_user), db=Depends(get_db)):
    exists = await db.fetchval("SELECT id FROM farms WHERE id = $1 AND user_id = $2", id, user["id"])
    if not exists:
        raise HTTPException(status_code=404, detail="Farm not found")

    await db.execute("DELETE FROM farms WHERE id = $1 AND user_id = $2", id, user["id"])
    return {"ok": True}

@router.get("/{id}/health")
async def get_farm_health_score(id: int, user=Depends(get_current_user), db=Depends(get_db)):
    # Verify ownership
    exists = await db.fetchval("SELECT id FROM farms WHERE id = $1 AND user_id = $2", id, user["id"])
    if not exists:
        raise HTTPException(status_code=404, detail="Farm not found")
    score = await update_health_score(id, "soil", db)
    return {"health_score": score}

@router.get("/{id}/report")
async def get_farm_report(id: int, user=Depends(get_current_user), db=Depends(get_db)):
    # Verify ownership
    exists = await db.fetchval("SELECT id FROM farms WHERE id = $1 AND user_id = $2", id, user["id"])
    if not exists:
        raise HTTPException(status_code=404, detail="Farm not found")
    report_data = await load_farm_context(id, db)
    return report_data
