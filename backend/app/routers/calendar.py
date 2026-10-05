from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import datetime
from pydantic import BaseModel

from app.database import get_db
from app.routers.auth import get_current_user
from app.routers.crops import verify_farm_owner

router = APIRouter(prefix="/calendar", tags=["Agronomy Calendar"])

class TaskCreate(BaseModel):
    farm_id: int
    task_name: str
    task_type: str
    scheduled_at: datetime.datetime
    urgency: Optional[str] = "NORMAL"
    cost_estimate: Optional[float] = 0.0

class TaskOut(BaseModel):
    id: int
    farm_id: int
    task_name: str
    task_type: str
    scheduled_at: str
    completed: bool
    urgency: str
    cost_estimate: float

@router.post("", response_model=TaskOut)
async def add_calendar_task(task: TaskCreate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_farm_owner(task.farm_id, user["id"], db)
    
    row = await db.fetchrow(
        """
        INSERT INTO crop_calendar (farm_id, task_name, task_type, scheduled_at, urgency, cost_estimate)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, farm_id, task_name, task_type, scheduled_at, completed, urgency, cost_estimate
        """,
        task.farm_id, task.task_name, task.task_type, task.scheduled_at, task.urgency, task.cost_estimate
    )
    
    res_dict = dict(row)
    res_dict["scheduled_at"] = res_dict["scheduled_at"].isoformat()
    
    # Broadcast change
    try:
        from app.main import ws_manager
        await ws_manager.broadcast(task.farm_id, {
            "type": "calendar_update",
            "title": "New Calendar Task",
            "message": f"Scheduled task: {task.task_name}",
            "farm_id": task.farm_id
        })
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")
        
    return res_dict

@router.get("", response_model=List[TaskOut])
async def list_calendar_tasks(farm_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_farm_owner(farm_id, user["id"], db)
    rows = await db.fetch(
        "SELECT id, farm_id, task_name, task_type, scheduled_at, completed, urgency, cost_estimate FROM crop_calendar "
        "WHERE farm_id = $1 ORDER BY scheduled_at ASC, id DESC",
        farm_id
    )
    res = []
    for r in rows:
        d = dict(r)
        d["scheduled_at"] = d["scheduled_at"].isoformat()
        res.append(d)
    return res

@router.put("/{task_id}/complete", response_model=TaskOut)
async def toggle_task_complete(task_id: int, completed: bool, user=Depends(get_current_user), db=Depends(get_db)):
    # Verify owner of the farm the task belongs to
    task = await db.fetchrow("SELECT farm_id, task_name FROM crop_calendar WHERE id = $1", task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await verify_farm_owner(task["farm_id"], user["id"], db)
    
    row = await db.fetchrow(
        """
        UPDATE crop_calendar
        SET completed = $1
        WHERE id = $2
        RETURNING id, farm_id, task_name, task_type, scheduled_at, completed, urgency, cost_estimate
        """,
        completed, task_id
    )
    
    res_dict = dict(row)
    res_dict["scheduled_at"] = res_dict["scheduled_at"].isoformat()
    
    # Broadcast change
    try:
        from app.main import ws_manager
        await ws_manager.broadcast(task["farm_id"], {
            "type": "calendar_update",
            "title": "Task Updated",
            "message": f"Task '{task['task_name']}' marked as {'completed' if completed else 'incomplete'}.",
            "farm_id": task["farm_id"]
        })
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")
        
    return res_dict

@router.delete("/{task_id}")
async def delete_calendar_task(task_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    task = await db.fetchrow("SELECT farm_id FROM crop_calendar WHERE id = $1", task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await verify_farm_owner(task["farm_id"], user["id"], db)
    await db.execute("DELETE FROM crop_calendar WHERE id = $1", task_id)
    
    try:
        from app.main import ws_manager
        await ws_manager.broadcast(task["farm_id"], {
            "type": "calendar_update",
            "title": "Task Removed",
            "message": "A task was removed from your crop calendar.",
            "farm_id": task["farm_id"]
        })
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")
        
    return {"ok": True}
