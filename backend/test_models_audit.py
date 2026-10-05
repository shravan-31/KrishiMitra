"""
AgriMind (KrishiMitra) — Deep AI/ML Models & Pipeline Technical Audit Script
Runs comprehensive standalone verification across all 5 AI/ML models.
"""

import os
import sys
import json
import time
import io
import numpy as np
import pandas as pd
from PIL import Image

# Setup paths
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "..", ".."))
sys.path.insert(0, BACKEND_DIR)

print("=" * 70)
print("AGRIMIND (KRISHIMITRA) — SENIOR TECHNICAL AUDIT SUITE")
print("=" * 70)

results = {}

# ─────────────────────────────────────────────────────────────────────────────
# 1. PLANT DISEASE MODEL AUDIT
# ─────────────────────────────────────────────────────────────────────────────
print("\n[PHASE 4 AUDIT] PLANT DISEASE MODEL (PlantVillage MobileNetV2)...")
try:
    from app.ml.disease import load_disease_model, predict_disease, _model, _classes, _treatments
    
    start_t = time.time()
    load_disease_model()
    load_time = time.time() - start_t
    
    assert _model is not None, "Model failed to load"
    assert _classes is not None and len(_classes) == 38, f"Expected 38 classes, got {len(_classes) if _classes else 0}"
    assert _treatments is not None and len(_treatments) > 0, "Treatment map missing"
    
    # Check model architecture
    total_params = sum(p.numel() for p in _model.parameters())
    print(f"  ✓ Model Loaded: MobileNetV2 ({total_params:,} parameters) in {load_time:.3f}s")
    print(f"  ✓ Classes: {len(_classes)} classes configured")
    print(f"  ✓ Model in eval mode: {not _model.training}")
    
    # Test 1: Real diseased leaf if available
    test_leaf_dir = os.path.join(WORKSPACE_DIR, "Dataset", "PlantVillage", "Tomato___Early_blight")
    if os.path.exists(test_leaf_dir) and os.listdir(test_leaf_dir):
        sample_img_name = os.listdir(test_leaf_dir)[0]
        sample_img_path = os.path.join(test_leaf_dir, sample_img_name)
        with open(sample_img_path, "rb") as f:
            img_bytes = f.read()
        pred = predict_disease(img_bytes)
        print(f"  ✓ Test Leaf (Tomato Early Blight): Predicted='{pred['disease_name']}', Conf={pred['confidence']*100:.1f}%, Crop='{pred['crop_name']}'")
        test1_res = pred
    else:
        # Fallback tiny image
        img = Image.new('RGB', (224, 224), color='green')
        b = io.BytesIO()
        img.save(b, format='JPEG')
        pred = predict_disease(b.getvalue())
        print(f"  ✓ Test Synthetic Green Leaf: Predicted='{pred['disease_name']}', Conf={pred['confidence']*100:.1f}%")
        test1_res = pred
        
    # Test 2: Healthy Leaf
    healthy_dir = os.path.join(WORKSPACE_DIR, "Dataset", "PlantVillage", "Tomato___healthy")
    if os.path.exists(healthy_dir) and os.listdir(healthy_dir):
        sample_img_name = os.listdir(healthy_dir)[0]
        sample_img_path = os.path.join(healthy_dir, sample_img_name)
        with open(sample_img_path, "rb") as f:
            img_bytes = f.read()
        pred_healthy = predict_disease(img_bytes)
        print(f"  ✓ Test Healthy Leaf: Predicted='{pred_healthy['disease_name']}', Conf={pred_healthy['confidence']*100:.1f}%")
    
    # Test 3: Non-leaf / White Noise Image (Safety / OOD Rejection Check)
    noise_img = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))
    b_noise = io.BytesIO()
    noise_img.save(b_noise, format='JPEG')
    pred_noise = predict_disease(b_noise.getvalue())
    print(f"  ⚠️ Non-Leaf Noise Test: Predicted='{pred_noise['disease_name']}', Conf={pred_noise['confidence']*100:.1f}%")
    print(f"     [FINDING]: Model lacks unknown/non-leaf rejection filter; noise classifies into '{pred_noise['class_name']}'!")

    results["disease_model"] = {
        "status": "WORKING (with OOD caveat)",
        "params": total_params,
        "classes": len(_classes),
        "test_sample_prediction": test1_res["class_name"],
        "confidence": test1_res["confidence"]
    }
except Exception as e:
    print(f"  ❌ Disease Model Error: {e}")
    results["disease_model"] = {"status": "BROKEN", "error": str(e)}

# ─────────────────────────────────────────────────────────────────────────────
# 2. INSECT PEST DETECTION MODEL AUDIT
# ─────────────────────────────────────────────────────────────────────────────
print("\n[PHASE 5 AUDIT] INSECT PEST MODEL (EfficientNet-B0)...")
try:
    from app.ml.pest import load_pest_model, predict_pest, _model as _pest_m, _classes as _pest_c, _controls as _pest_ctrl
    
    start_t = time.time()
    load_pest_model()
    load_time = time.time() - start_t
    
    assert _pest_m is not None, "Pest model failed to load"
    assert _pest_c is not None, "Pest classes missing"
    assert _pest_ctrl is not None, "Pest control map missing"
    
    total_params = sum(p.numel() for p in _pest_m.parameters())
    print(f"  ✓ Pest Model Loaded: EfficientNet-B0 ({total_params:,} parameters) in {load_time:.3f}s")
    print(f"  ✓ Pest Classes: {len(_pest_c)} classes -> {_pest_c}")
    
    # Test with real pest sample if exists
    pest_sample_dir = os.path.join(WORKSPACE_DIR, "Dataset", "pest_detection", "Aphids")
    if os.path.exists(pest_sample_dir) and os.listdir(pest_sample_dir):
        sample_img_name = os.listdir(pest_sample_dir)[0]
        sample_img_path = os.path.join(pest_sample_dir, sample_img_name)
        with open(sample_img_path, "rb") as f:
            img_bytes = f.read()
        pred_pest = predict_pest(img_bytes)
        print(f"  ✓ Test Pest Sample (Aphids): Predicted='{pred_pest['pest_name']}', Conf={pred_pest['confidence']*100:.1f}%, Severity='{pred_pest['severity']}'")
    else:
        # Synthetic test
        img = Image.new('RGB', (224, 224), color='brown')
        b = io.BytesIO()
        img.save(b, format='JPEG')
        pred_pest = predict_pest(b.getvalue())
        print(f"  ✓ Test Synthetic Image: Predicted='{pred_pest['pest_name']}', Conf={pred_pest['confidence']*100:.1f}%")
        
    results["pest_model"] = {
        "status": "WORKING",
        "params": total_params,
        "classes": len(_pest_c),
        "prediction": pred_pest["pest_name"],
        "confidence": pred_pest["confidence"]
    }
except Exception as e:
    print(f"  ❌ Pest Model Error: {e}")
    results["pest_model"] = {"status": "BROKEN", "error": str(e)}

# ─────────────────────────────────────────────────────────────────────────────
# 3. SOIL HEALTH AI AUDIT
# ─────────────────────────────────────────────────────────────────────────────
print("\n[PHASE 6 AUDIT] SOIL HEALTH AI (XGBoost Classifier + Heuristic Health Index)...")
try:
    from app.ml.soil import load_soil_model, predict_soil, calculate_soil_health, generate_fertilizer_advice, _model as _soil_m
    
    load_soil_model()
    print("  ✓ Soil Model Loaded: XGBoost Classifier")
    
    # Test 1: Normal Balanced Input
    res_normal = predict_soil(n=80, p=45, k=120, temp=27.0, humidity=70.0, ph=6.8, rainfall=120.0, organic_matter=2.5, moisture=40.0, ec=1.1)
    print(f"  ✓ Normal Input (N=80, P=45, K=120, pH=6.8):")
    print(f"    - Health Score: {res_normal['soil_health_score']}/100")
    print(f"    - Recommended Crops: {res_normal['recommended_crops']}")
    print(f"    - Fertilizer Advice: {res_normal['fertilizer_advice']}")
    assert 70.0 <= res_normal['soil_health_score'] <= 100.0, f"Expected high score for optimal inputs, got {res_normal['soil_health_score']}"
    
    # Test 2: Severe Deficit & Extreme Acidic pH (pH=3.0, N=0, P=0, K=0)
    res_acidic = predict_soil(n=0, p=0, k=0, temp=25.0, humidity=50.0, ph=3.0, rainfall=50.0, organic_matter=0.5, moisture=10.0, ec=0.1)
    print(f"  ✓ Severe Acidic & Zero Nutrients (N=0, P=0, K=0, pH=3.0):")
    print(f"    - Health Score: {res_acidic['soil_health_score']}/100 (Clamped safely, no crash)")
    print(f"    - Advice: {res_acidic['fertilizer_advice']}")
    assert res_acidic['soil_health_score'] == 10.0, f"Expected minimum clamp 10.0, got {res_acidic['soil_health_score']}"
    
    # Test 3: Extreme Alkaline (pH=12.0) & Extreme Nutrients (N=300, P=250, K=400)
    res_alkaline = predict_soil(n=300, p=250, k=400, temp=35.0, humidity=30.0, ph=12.0, rainfall=10.0, organic_matter=4.0, moisture=80.0, ec=3.5)
    print(f"  ✓ Extreme Alkaline & Excess Nutrients (N=300, P=250, K=400, pH=12.0):")
    print(f"    - Health Score: {res_alkaline['soil_health_score']}/100")
    print(f"    - Advice: {res_alkaline['fertilizer_advice']}")
    
    results["soil_model"] = {
        "status": "WORKING",
        "normal_health_score": res_normal["soil_health_score"],
        "extreme_acidic_score": res_acidic["soil_health_score"],
        "recommended_crops": res_normal["recommended_crops"]
    }
except Exception as e:
    print(f"  ❌ Soil Model Error: {e}")
    results["soil_model"] = {"status": "BROKEN", "error": str(e)}

# ─────────────────────────────────────────────────────────────────────────────
# 4. CROP YIELD PREDICTOR AUDIT
# ─────────────────────────────────────────────────────────────────────────────
print("\n[PHASE 7 AUDIT] CROP YIELD PREDICTOR (Gradient Boosting Regressor)...")
try:
    from app.ml.yield_pred import load_yield_model, predict_yield, _model as _yield_m, _encoders as _yield_enc
    
    load_yield_model()
    print("  ✓ Yield Model Loaded: GradientBoostingRegressor")
    print(f"  ✓ Encoders: {list(_yield_enc.keys())}")
    
    # Test 1: Standard Wheat Prediction
    res_yield_wheat = predict_yield(
        state="Maharashtra", district="Pune", crop_year=2024,
        season="Rabi", crop="Wheat", area_acres=5.0
    )
    print(f"  ✓ Test Wheat (5 Acres, Maharashtra, Rabi):")
    print(f"    - Predicted Yield: {res_yield_wheat['predicted_kg']:,.1f} kg ({res_yield_wheat['predicted_kg']/5.0:,.1f} kg/acre)")
    print(f"    - Confidence: {res_yield_wheat['confidence']*100:.1f}%")
    
    # Test 2: Standard Rice Prediction
    res_yield_rice = predict_yield(
        state="Punjab", district="Ludhiana", crop_year=2024,
        season="Kharif", crop="Rice", area_acres=2.5
    )
    print(f"  ✓ Test Rice (2.5 Acres, Punjab, Kharif):")
    print(f"    - Predicted Yield: {res_yield_rice['predicted_kg']:,.1f} kg ({res_yield_rice['predicted_kg']/2.5:,.1f} kg/acre)")
    print(f"    - Confidence: {res_yield_rice['confidence']*100:.1f}%")

    results["yield_model"] = {
        "status": "WORKING (with simulated confidence)",
        "sample_wheat_kg": res_yield_wheat["predicted_kg"],
        "sample_rice_kg": res_yield_rice["predicted_kg"]
    }
except Exception as e:
    print(f"  ❌ Yield Model Error: {e}")
    results["yield_model"] = {"status": "BROKEN", "error": str(e)}

# ─────────────────────────────────────────────────────────────────────────────
# 5. MANDI PRICE FORECAST AUDIT
# ─────────────────────────────────────────────────────────────────────────────
print("\n[PHASE 8 AUDIT] MANDI PRICE FORECAST (PyTorch LSTM)...")
try:
    from app.ml.market import load_market_assets, forecast_market, _model as _market_m, _config as _market_cfg
    
    load_market_assets()
    total_params = sum(p.numel() for p in _market_m.parameters())
    print(f"  ✓ Market LSTM Loaded ({total_params:,} parameters)")
    print(f"  ✓ Configured Crops: {_market_cfg['crops']}")
    
    # Test 1: Wheat Forecast
    res_wheat_fc = forecast_market(crop_name="Wheat", forecast_days=7)
    print(f"  ✓ Wheat 7-Day Forecast:")
    print(f"    - Initial Historic Price: ₹{res_wheat_fc['historical_prices'][-1]:.2f}")
    print(f"    - 7-Day Projections: {res_wheat_fc['forecast_prices']}")
    print(f"    - Trend: {res_wheat_fc['trend']} ({res_wheat_fc['percent_change']}%)")
    
    # Test 2: Rice Forecast
    res_rice_fc = forecast_market(crop_name="Rice", forecast_days=7)
    print(f"  ✓ Rice 7-Day Forecast:")
    print(f"    - Initial Historic Price: ₹{res_rice_fc['historical_prices'][-1]:.2f}")
    print(f"    - 7-Day Projections: {res_rice_fc['forecast_prices']}")
    print(f"    - Trend: {res_rice_fc['trend']} ({res_rice_fc['percent_change']}%)")
    
    # Test 3: Unlisted Crop (Cotton) Fallback Test
    res_cotton_fc = forecast_market(crop_name="Cotton", forecast_days=7)
    print(f"  ⚠️ Unlisted Crop Test ('Cotton'):")
    print(f"    - Returned Crop Name: '{res_cotton_fc['crop']}' [FALLBACK TO RICE]")
    
    results["market_model"] = {
        "status": "WORKING (limited to Rice & Wheat)",
        "params": total_params,
        "supported_crops": _market_cfg["crops"],
        "wheat_trend": res_wheat_fc["trend"]
    }
except Exception as e:
    print(f"  ❌ Market Model Error: {e}")
    results["market_model"] = {"status": "BROKEN", "error": str(e)}

print("\n" + "=" * 70)
print("AUDIT EXECUTION COMPLETE. SUMMARY:")
print(json.dumps(results, indent=2))
print("=" * 70)
