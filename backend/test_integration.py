import os
import io
import asyncio
import datetime
from PIL import Image
import asyncpg
from fastapi.testclient import TestClient

# Import the FastAPI app
from app.main import app
from app.database import init_db, close_db

def create_mock_image():
    """Create a valid tiny JPEG image in memory."""
    img = Image.new('RGB', (224, 224), color='green')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    return img_bytes.getvalue()

async def run_tests():
    # 1. Clean up database for mock_dev_user to ensure clean state
    dsn = os.getenv("DATABASE_URL", "postgresql://postgres@127.0.0.1:5432/agridb")
    conn = await asyncpg.connect(dsn)
    
    # Cascade deletes by removing the mock user
    try:
        user_id = await conn.fetchval("SELECT id FROM users WHERE google_sub = 'mock_dev_user'")
        if user_id:
            print(f"Cleaning up existing mock dev user with ID {user_id}...")
            # Delete from alerts first because alerts references farms and users
            await conn.execute("DELETE FROM alerts WHERE user_id = $1", user_id)
            # Since crop_calendar, disease_scans, etc. cascade delete from farms, we delete farms
            await conn.execute("DELETE FROM farms WHERE user_id = $1", user_id)
            # Finally delete the user
            await conn.execute("DELETE FROM users WHERE id = $1", user_id)
            print("Database cleaned up.")
        else:
            print("No existing mock dev user found. Starting fresh.")
    except asyncpg.exceptions.UndefinedTableError:
        print("Database tables do not exist yet. They will be initialized by the FastAPI lifespan when the TestClient starts.")
    except Exception as e:
        print(f"Non-critical cleanup error: {e}")
    finally:
        await conn.close()


    # 2. Run test suite using FastAPI TestClient
    # Note: TestClient context manager triggers startup and shutdown lifespan events
    with TestClient(app) as client:
        print("\n--- Test Phase 1: Authentication ---")
        # GET /auth/dev-login sets the HTTP-Only cookie and redirects
        response = client.get("/auth/dev-login", follow_redirects=False)
        assert response.status_code == 307 or response.status_code == 302, f"Expected redirect, got {response.status_code}"
        assert "access_token" in client.cookies, "access_token cookie not set!"
        print("✅ Auth bypass successful. JWT cookie acquired.")

        # Verify /auth/me
        me_resp = client.get("/auth/me")
        assert me_resp.status_code == 200, f"Expected 200, got {me_resp.status_code}"
        user_data = me_resp.json()
        assert user_data["email"] == "farmer@krishimitra.org"
        user_db_id = user_data["id"]
        print(f"✅ Auth profile verified. User ID: {user_db_id}")

        print("\n--- Test Phase 2: Farm CRUD ---")
        farm_payload = {
            "farm_name": "Krishi Test Farm",
            "location": "Pune District",
            "state": "Maharashtra",
            "district": "Pune",
            "area_acres": 5.0,
            "soil_type": "Black Soil"
        }
        create_farm_resp = client.post("/api/v1/farms", json=farm_payload)
        assert create_farm_resp.status_code == 200, create_farm_resp.text
        farm_data = create_farm_resp.json()
        farm_id = farm_data["id"]
        print(f"✅ Farm created successfully! Farm ID: {farm_id}")

        # List farms
        list_farms_resp = client.get("/api/v1/farms")
        assert list_farms_resp.status_code == 200
        assert len(list_farms_resp.json()) >= 1
        print("✅ List farms verified.")

        print("\n--- Test Phase 3: Crops CRUD ---")
        crop_payload = {
            "farm_id": farm_id,
            "crop_name": "Wheat",
            "variety": "Lokwan",
            "sown_date": str(datetime.date.today() - datetime.timedelta(days=10)),
            "harvest_date": str(datetime.date.today() + datetime.timedelta(days=100)),
            "area_acres": 5.0,
            "status": "growing"
        }
        create_crop_resp = client.post("/api/v1/crops", json=crop_payload)
        assert create_crop_resp.status_code == 200, create_crop_resp.text
        crop_data = create_crop_resp.json()
        crop_id = crop_data["id"]
        print(f"✅ Crop 'Wheat' created successfully! Crop ID: {crop_id}")

        print("\n--- Test Phase 4: WebSocket and Soil Analysis Cascade ---")
        # Establish WebSocket connection for real-time alerts
        with client.websocket_connect(f"/ws/farm/{farm_id}") as websocket:
            print("WebSocket connected to farm room.")

            # Create Soil Report to trigger cascades (Form params)
            soil_payload = {
                "farm_id": farm_id,
                "ph": 6.5,
                "nitrogen": 80.0,
                "phosphorus": 45.0,
                "potassium": 120.0,
                "moisture": 40.0,
                "ec": 1.1,
                "temperature": 27.0
            }
            soil_resp = client.post("/api/v1/soil/analyze", data=soil_payload)
            assert soil_resp.status_code == 200, soil_resp.text
            soil_data = soil_resp.json()
            print(f"✅ Soil report created. Health Score: {soil_data['soil_health_score']}")
            print(f"Recommended Crops: {soil_data['recommended_crops']}")
            print(f"Fertilizer Advice: {soil_data['fertilizer_advice']}")

            # Receive and check WebSocket message broadcasted by the cascade
            ws_msg = websocket.receive_json()
            assert ws_msg["event_type"] == "soil_analyzed"
            assert "health_score" in ws_msg["payload"]
            print(f"✅ WebSocket soil report event broadcasted successfully.")

        # Verify cascades in DB: Check alerts
        alerts_resp = client.get(f"/api/v1/alerts/{farm_id}")
        assert alerts_resp.status_code == 200
        alerts = alerts_resp.json()
        assert any(a["alert_type"] == "SCHEME" for a in alerts), "Soil scheme alert not found!"
        print("✅ DB Soil Scheme Alert verified.")

        print("\n--- Test Phase 5: Disease Scanner Cascade ---")
        with client.websocket_connect(f"/ws/farm/{farm_id}") as websocket:
            image_data = create_mock_image()
            scan_resp = client.post(
                "/api/v1/disease/scan",
                data={"farm_id": farm_id},
                files={"file": ("leaf.jpg", image_data, "image/jpeg")}
            )
            assert scan_resp.status_code == 200, scan_resp.text
            scan_data = scan_resp.json()
            print(f"✅ Leaf Disease Scan succeeded. Classified: {scan_data['disease_name']}")
            print(f"Treatment Advice: {scan_data['treatment_steps']}")

            ws_msg = websocket.receive_json()
            assert ws_msg["event_type"] == "disease_detected"
            assert ws_msg["payload"]["disease_name"] == scan_data["disease_name"]
            print("✅ WebSocket disease alert broadcasted successfully.")

        # Verify cascades in DB: Check alerts and crop_calendar
        alerts_resp = client.get(f"/api/v1/alerts/{farm_id}")
        alerts = alerts_resp.json()
        assert any(a["alert_type"] == "DISEASE" for a in alerts), "Disease alert not found!"
        print("✅ DB Disease Alert verified.")

        # Check calendar
        calendar_resp = client.get(f"/calendar?farm_id={farm_id}")
        assert calendar_resp.status_code == 200, calendar_resp.text
        tasks = calendar_resp.json()
        assert any("treatment" in t["task_name"].lower() or "apply" in t["task_name"].lower() for t in tasks), "Calendar treatment task not found!"
        print("✅ DB Calendar Treatment Task verified.")

        print("\n--- Test Phase 6: Insect Pest Scanner Cascade ---")
        with client.websocket_connect(f"/ws/farm/{farm_id}") as websocket:
            image_data = create_mock_image()
            pest_resp = client.post(
                "/api/v1/pest/detect",
                data={"farm_id": farm_id},
                files={"file": ("pest.jpg", image_data, "image/jpeg")}
            )
            assert pest_resp.status_code == 200, pest_resp.text
            pest_data = pest_resp.json()
            print(f"✅ Pest Scan succeeded. Classified Pest: {pest_data['pest_name']}")
            print(f"Control: Organic: {pest_data['organic_control']} | Chemical: {pest_data['chemical_control']}")

            ws_msg = websocket.receive_json()
            assert ws_msg["event_type"] == "pest_detected"
            print("✅ WebSocket pest alert broadcasted successfully.")

        print("\n--- Test Phase 7: Expense Logging Cascade ---")
        expense_payload = {
            "farm_id": farm_id,
            "category": "Fertilizer",
            "amount": 2500.0,
            "description": "Bought urea fertilizer",
            "date": str(datetime.date.today())
        }
        expense_resp = client.post("/api/v1/expenses", json=expense_payload)
        assert expense_resp.status_code == 200, expense_resp.text
        expense_data = expense_resp.json()
        print(f"✅ Expense logged successfully: ₹{expense_data['amount']}")

        # Verify season summary
        summary_resp = client.get(f"/season-summary?farm_id={farm_id}")
        assert summary_resp.status_code == 200, summary_resp.text
        summaries = summary_resp.json()
        assert len(summaries) >= 1, "No season summary generated!"
        summary = summaries[0]
        assert summary["total_expense"] >= 2500.0, f"Expected total expense to be at least 2500, got {summary['total_expense']}"
        print(f"✅ DB Season Summary ledger verified. Total Expense: ₹{summary['total_expense']}, Total Revenue: ₹{summary['total_revenue']}, P/L: ₹{summary['profit_loss']}")

        print("\n--- Test Phase 8: Market Mandi Price Forecasting ---")
        forecast_resp = client.get("/api/v1/market/forecast/Wheat?days=7")
        assert forecast_resp.status_code == 200, forecast_resp.text
        forecast_data = forecast_resp.json()
        assert len(forecast_data["daily_prices"]) == 7
        print(f"✅ Market forecast for Wheat verified. Trend: {forecast_data['trend']}")

        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Phase 3 Routing and Cascades are verified! 🎉")

if __name__ == "__main__":
    asyncio.run(run_tests())

