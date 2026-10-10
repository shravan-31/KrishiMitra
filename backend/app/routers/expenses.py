from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import datetime
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.database import get_db
from app.websocket import get_ws_manager
from app.integration_engine import on_expense_added

router = APIRouter(prefix="/api/v1/expenses", tags=["expenses"])

class ExpenseCreate(BaseModel):
    farm_id: int
    category: str
    amount: float
    description: Optional[str] = ""
    date: Optional[datetime.date] = None

class ExpenseOut(BaseModel):
    id: int
    farm_id: int
    category: str
    amount: float
    description: Optional[str]
    date: datetime.date

@router.post("", response_model=ExpenseOut)
async def add_expense(
    expense: ExpenseCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager)
):
    date_val = expense.date or datetime.date.today()
    row = await db.fetchrow("""
        INSERT INTO expenses (farm_id, category, amount, description, date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, farm_id, category, amount, description, date
    """, expense.farm_id, expense.category, expense.amount, expense.description, date_val)
    
    # Fire integration cascade
    # on_expense_added(farm_id, expense, db, ws_manager)
    await on_expense_added(expense.farm_id, dict(row), db, ws_manager)
    return dict(row)

@router.get("/{farm_id}", response_model=List[ExpenseOut])
async def list_expenses(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    rows = await db.fetch("""
        SELECT id, farm_id, category, amount, description, date
        FROM expenses
        WHERE farm_id = $1
        ORDER BY date DESC, id DESC
    """, farm_id)
    return [dict(r) for r in rows]

@router.get("/{farm_id}/summary")
async def get_expenses_summary(
    farm_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # Fetch totals
    totals_row = await db.fetchrow("""
        SELECT COALESCE(SUM(amount), 0) as total_expense
        FROM expenses
        WHERE farm_id=$1
    """, farm_id)
    
    summary_row = await db.fetchrow("""
        SELECT COALESCE(SUM(total_revenue), 0) as total_revenue
        FROM season_summary
        WHERE farm_id=$1
    """, farm_id)
    
    total_expense = float(totals_row["total_expense"])
    total_revenue = float(summary_row["total_revenue"])
    profit_loss = total_revenue - total_expense
    
    # Monthly breakdown (last 6 months)
    monthly_rows = await db.fetch("""
        SELECT 
            TO_CHAR(date, 'Mon') as month_name,
            EXTRACT(MONTH FROM date) as month_num,
            SUM(amount) as month_sum
        FROM expenses
        WHERE farm_id=$1 AND date >= DATE_TRUNC('year', CURRENT_DATE)
        GROUP BY TO_CHAR(date, 'Mon'), EXTRACT(MONTH FROM date)
        ORDER BY month_num
    """, farm_id)
    
    monthly_breakdown = []
    for r in monthly_rows:
        monthly_breakdown.append({
            "month": r["month_name"],
            "amount": float(r["month_sum"])
        })
        
    # Category breakdown
    cat_rows = await db.fetch("""
        SELECT category, SUM(amount) as cat_sum
        FROM expenses
        WHERE farm_id=$1
        GROUP BY category
    """, farm_id)
    
    category_breakdown = {}
    for r in cat_rows:
        category_breakdown[r["category"]] = float(r["cat_sum"])
        
    return {
        "total_expense":      total_expense,
        "total_revenue":      total_revenue,
        "profit_loss":        profit_loss,
        "monthly_breakdown":  monthly_breakdown,
        "category_breakdown": category_breakdown
    }
