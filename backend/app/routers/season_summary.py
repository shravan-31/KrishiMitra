from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.routers.auth import get_current_user
from app.routers.crops import verify_farm_owner

router = APIRouter(prefix="/season-summary", tags=["Financial Ledger"])

class SeasonSummaryOut(BaseModel):
    id: int
    farm_id: int
    season: str
    year: int
    total_expense: float
    total_revenue: float
    profit_loss: float
    yield_kg: float
    updated_at: str

@router.get("", response_model=List[SeasonSummaryOut])
async def get_season_summary(farm_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_farm_owner(farm_id, user["id"], db)
    rows = await db.fetch(
        "SELECT id, farm_id, season, year, total_expense, total_revenue, profit_loss, yield_kg, updated_at "
        "FROM season_summary WHERE farm_id = $1 ORDER BY year DESC, season ASC",
        farm_id
    )
    res = []
    for r in rows:
        d = dict(r)
        d["updated_at"] = d["updated_at"].isoformat()
        res.append(d)
    return res
