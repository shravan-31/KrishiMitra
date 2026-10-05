from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from app.middleware.auth import get_current_user
from app.database import get_db
from app.main import get_ws_manager
from app.ml.market import forecast_market, get_historical_prices
from app.services.mandi_service import fetch_mandi_prices
from app.integration_engine import on_market_price_updated
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/api/v1/market", tags=["market"])

@router.get("/prices/{crop_name}")
async def get_crop_prices(
    crop_name: str,
    state: Optional[str] = Query("Maharashtra", description="State filter"),
    district: Optional[str] = Query(None, description="District filter"),
    market: Optional[str] = Query(None, description="Market / Mandi filter"),
    user=Depends(get_current_user),
    db=Depends(get_db),
    ws_manager=Depends(get_ws_manager)
):
    crop_clean = crop_name.strip().capitalize()
    
    # 1. Fetch real APMC mandi data from Data.gov.in (with resilient archive fallback)
    mandi_resp = await fetch_mandi_prices(
        commodity=crop_clean,
        state=state,
        district=district,
        market=market,
        limit=50
    )
    
    records = mandi_resp.get("records", [])
    
    # Also fetch historical baseline for trend computation
    hist_prices, hist_dates = get_historical_prices(crop_clean, limit=5)
    
    if records:
        # Sort by arrival date descending or modal price
        best_record = max(records, key=lambda r: r.get("modal_price", 0.0))
        today_price = float(best_record.get("modal_price", 0.0))
        
        # Build mandis list from real records
        mandis = []
        for r in records[:10]:
            mandis.append({
                "mandi": f"{r.get('market', 'APMC')} ({r.get('district', '')})",
                "price": r.get("modal_price", 0.0),
                "min_price": r.get("min_price", 0.0),
                "max_price": r.get("max_price", 0.0),
                "state": r.get("state", "Maharashtra"),
                "variety": r.get("variety", "Common"),
                "arrival_date": r.get("arrival_date", "")
            })
            
        best_market = f"{best_record.get('market')} Mandi (₹{today_price}/q)"
        record_date = mandi_resp.get("record_date") or best_record.get("arrival_date")
    else:
        today_price = round(hist_prices[-1], 2) if hist_prices else 2000.0
        best_market = f"APMC Pune Reference (₹{today_price}/q)"
        record_date = hist_dates[-1] if hist_dates else datetime.now().strftime("%Y-%m-%d")
        mandis = [
            {
                "mandi": "APMC Reference Market",
                "price": today_price,
                "min_price": round(today_price * 0.95, 2),
                "max_price": round(today_price * 1.05, 2),
                "state": state or "Maharashtra",
                "variety": "Common",
                "arrival_date": record_date
            }
        ]
        
    yesterday_price = round(hist_prices[-2], 2) if len(hist_prices) >= 2 else round(today_price - 15.0, 2)
    trend = "UP" if today_price > yesterday_price else ("DOWN" if today_price < yesterday_price else "STABLE")
    
    # Notify integration cascade
    try:
        await on_market_price_updated(
            crop=crop_clean,
            price=today_price,
            mandi=best_market,
            db=db,
            ws_manager=ws_manager
        )
    except Exception:
        pass
        
    return {
        "today_price": today_price,
        "yesterday_price": yesterday_price,
        "trend": trend,
        "best_market": best_market,
        "all_mandis": mandis,
        "source": mandi_resp.get("source", "data.gov.in"),
        "is_live": mandi_resp.get("is_live", False),
        "status_label": mandi_resp.get("status_label", "Latest available APMC record"),
        "record_date": record_date,
        "fetched_at": mandi_resp.get("fetched_at", datetime.now(timezone.utc).isoformat())
    }

@router.get("/forecast/{crop_name}")
async def get_crop_forecast(
    crop_name: str,
    days: int = 30,
    user=Depends(get_current_user)
):
    crop_clean = crop_name.strip().capitalize()
    
    try:
        res = forecast_market(crop_name=crop_clean, forecast_days=days)
    except ValueError as ve:
        # Explicit rejection for unsupported crops (Fix 7)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "forecast_not_supported",
                "message": str(ve),
                "supported_crops": ["Rice", "Wheat"],
                "requested_crop": crop_clean
            }
        )
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Market forecasting failed: {ex}")
        
    prices = res["forecast_prices"]
    dates = res["forecast_dates"]
    
    forecast_list = []
    for d, p in zip(dates, prices):
        forecast_list.append({
            "date": d,
            "price": p
        })
        
    return {
        "daily_prices": forecast_list,
        "trend": res["trend"],
        "min": min(prices),
        "max": max(prices),
        "avg": round(sum(prices) / len(prices), 2),
        "percent_change": res.get("percent_change", 0.0),
        "source": "AgriMind Market LSTM (PyTorch)",
        "is_forecast": True,
        "supported_crop": True,
        "crop": crop_clean,
        "notice": "7-Day AI Forecast derived from historical agricultural market trends."
    }
