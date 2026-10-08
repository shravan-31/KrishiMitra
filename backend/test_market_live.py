import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.services.mandi_service import fetch_mandi_prices
from app.ml.market import forecast_market

async def test_market():
    crops = ["Soybean", "Cotton", "Onion", "Tomato", "Wheat", "Rice", "Maize", "Potato", "Sugarcane"]
    print("=" * 70)
    print("VERIFYING LIVE MARKET TODAY-DATED PRICES & UPCOMING FORECAST")
    print("=" * 70)
    for c in crops:
        mandi_res = await fetch_mandi_prices(c)
        rec_count = mandi_res.get("total_records", 0)
        first = mandi_res["records"][0] if mandi_res.get("records") else {}
        today_price = first.get("modal_price", 0)
        mandi_name = first.get("market", "")
        rec_date = mandi_res.get("record_date", "")

        fc = forecast_market(c, forecast_days=7)
        next_days = fc.get("forecast_dates", [])
        next_prices = fc.get("forecast_prices", [])

        print(f"\n🌾 [{c}]")
        print(f"  Today ({rec_date}): ₹{today_price}/q at {mandi_name}")
        print(f"  Upcoming 3 Days: {list(zip(next_days[:3], next_prices[:3]))}")
        print(f"  Trend: {fc.get('trend')} | {fc.get('advisory', '')[:40]}...")

if __name__ == "__main__":
    asyncio.run(test_market())
