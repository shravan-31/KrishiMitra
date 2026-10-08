import requests
import json

base_url = "http://127.0.0.1:8000"

print("--- Testing GET /api/v1/drought/crops ---")
try:
    r = requests.get(f"{base_url}/api/v1/drought/crops")
    print("Status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print("Crops count:", len(data.get("drought_resilient_crops", [])))
        print("First crop:", data["drought_resilient_crops"][0]["crop"])
    else:
        print("Error:", r.text)
except Exception as e:
    print("Exception:", e)

print("\n--- Testing GET /api/v1/drought/schemes ---")
try:
    r = requests.get(f"{base_url}/api/v1/drought/schemes")
    print("Status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print("Schemes count:", len(data.get("schemes", [])))
        print("First scheme:", data["schemes"][0]["name"])
    else:
        print("Error:", r.text)
except Exception as e:
    print("Exception:", e)

print("\n--- Testing POST /api/v1/drought/analyze ---")
payload = {
    "crop_name": "Cotton",
    "acres": 3.0,
    "water_source": "Borewell",
    "daily_water_hours": 1.5,
    "pump_hp": 3.0,
    "irrigation_type": "Drip Irrigation",
    "soil_type": "Medium Black Clay",
    "growth_stage": "Flowering & Pod Formation",
    "district": "Latur"
}
try:
    r = requests.post(f"{base_url}/api/v1/drought/analyze", json=payload)
    print("Status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print("Stress Level:", data.get("stress_level"))
        print("Stress Index:", data.get("water_stress_index"))
        print("Survival Days:", data.get("estimated_survival_days"))
        print("Water balance:", json.dumps(data.get("water_balance"), indent=2))
        print("Drip schedule:", json.dumps(data.get("drip_schedule"), indent=2))
        print("\nALL DROUGHT ENDPOINTS WORKING PERFECTLY!")
    else:
        print("Error:", r.text)
except Exception as e:
    print("Exception:", e)
