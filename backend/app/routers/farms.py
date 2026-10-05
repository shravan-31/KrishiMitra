from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/farms", tags=["Farms"])

class FarmCreate(BaseModel):
    farm_name: str
    location: Optional[str] = ""
    state: Optional[str] = ""
    district: Optional[str] = ""
    area_acres: Optional[float] = 0.0
    soil_type: Optional[str] = ""

class FarmOut(BaseModel):
    id: int
    user_id: int
    farm_name: str
    location: Optional[str]
    state: Optional[str]
    district: Optional[str]
    area_acres: Optional[float]
    soil_type: Optional[str]

@router.post("", response_model=FarmOut)
async def create_farm(farm: FarmCreate, user=Depends(get_current_user), db=Depends(get_db)):
    row = await db.fetchrow(
        """
        INSERT INTO farms (user_id, farm_name, location, state, district, area_acres, soil_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, farm_name, location, state, district, area_acres, soil_type
        """,
        user["id"], farm.farm_name, farm.location, farm.state, farm.district, farm.area_acres, farm.soil_type
    )
    return dict(row)

@router.get("", response_model=List[FarmOut])
async def list_farms(user=Depends(get_current_user), db=Depends(get_db)):
    rows = await db.fetch(
        "SELECT id, user_id, farm_name, location, state, district, area_acres, soil_type FROM farms WHERE user_id = $1 ORDER BY id DESC",
        user["id"]
    )
    return [dict(row) for row in rows]

@router.get("/{farm_id}", response_model=FarmOut)
async def get_farm(farm_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    row = await db.fetchrow(
        "SELECT id, user_id, farm_name, location, state, district, area_acres, soil_type FROM farms WHERE id = $1 AND user_id = $2",
        farm_id, user["id"]
    )
    if not row:
        raise HTTPException(status_code=404, detail="Farm not found")
    return dict(row)

@router.put("/{farm_id}", response_model=FarmOut)
async def update_farm(farm_id: int, farm: FarmCreate, user=Depends(get_current_user), db=Depends(get_db)):
    # Check if farm exists and belongs to user
    exists = await db.fetchval("SELECT id FROM farms WHERE id = $1 AND user_id = $2", farm_id, user["id"])
    if not exists:
        raise HTTPException(status_code=404, detail="Farm not found")
        
    row = await db.fetchrow(
        """
        UPDATE farms
        SET farm_name = $1, location = $2, state = $3, district = $4, area_acres = $5, soil_type = $6
        WHERE id = $7 AND user_id = $8
        RETURNING id, user_id, farm_name, location, state, district, area_acres, soil_type
        """,
        farm.farm_name, farm.location, farm.state, farm.district, farm.area_acres, farm.soil_type, farm_id, user["id"]
    )
    return dict(row)

@router.delete("/{farm_id}")
async def delete_farm(farm_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    exists = await db.fetchval("SELECT id FROM farms WHERE id = $1 AND user_id = $2", farm_id, user["id"])
    if not exists:
        raise HTTPException(status_code=404, detail="Farm not found")
        
    await db.execute("DELETE FROM farms WHERE id = $1 AND user_id = $2", farm_id, user["id"])
    return {"ok": True}
