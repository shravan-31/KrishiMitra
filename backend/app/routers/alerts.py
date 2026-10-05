from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])

class AlertOut(BaseModel):
    id: int
    user_id: int
    farm_id: Optional[int]
    alert_type: str
    severity: str
    title: str
    message: str
    is_read: bool
    created_at: str

@router.get("/{farm_id}", response_model=List[AlertOut])
async def list_alerts(
    farm_id: int,
    is_read: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(20),
    offset: int = Query(0),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # Verify owner of the farm
    owner_id = await db.fetchval("SELECT user_id FROM farms WHERE id = $1", farm_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    if owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    query = """
        SELECT id, user_id, farm_id, alert_type, severity, title, message, is_read, created_at
        FROM alerts
        WHERE farm_id = $1
    """
    params = [farm_id]
    param_idx = 2

    if is_read is not None:
        query += f" AND is_read = ${param_idx}"
        params.append(is_read)
        param_idx += 1

    if severity:
        query += f" AND severity = ${param_idx}"
        params.append(severity.upper())
        param_idx += 1

    query += f" ORDER BY created_at DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
    params.extend([limit, offset])

    rows = await db.fetch(query, *params)
    
    res = []
    for r in rows:
        d = dict(r)
        d["created_at"] = d["created_at"].isoformat()
        res.append(d)
    return res

@router.put("/{alert_id}/read")
async def mark_alert_read(
    alert_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    alert = await db.fetchrow("SELECT user_id FROM alerts WHERE id = $1", alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    if alert["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    await db.execute("UPDATE alerts SET is_read = TRUE WHERE id = $1", alert_id)
    return {"ok": True}

@router.delete("/{farm_id}/clear-read")
async def clear_read_alerts(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    owner_id = await db.fetchval("SELECT user_id FROM farms WHERE id = $1", farm_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    if owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    await db.execute("DELETE FROM alerts WHERE farm_id = $1 AND is_read = TRUE", farm_id)
    return {"ok": True}
