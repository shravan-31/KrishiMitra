import os
import json
import pickle
import sys
import numpy as np

# Backward-compat: model.pkl was pickled with sklearn 1.7.0 where the
# Cython loss extension unpickled as top-level `_loss`. In sklearn >=1.8
# it lives at `sklearn._loss._loss`. Alias it so old pickles still load.
try:
    import sklearn._loss._loss as _sk_loss_ext  # noqa: F401
    sys.modules.setdefault("_loss", _sk_loss_ext)
except Exception:
    pass

# Resolve model path
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "yield")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
ENCODERS_PATH = os.path.join(MODEL_DIR, "label_encoders.pkl")
CONFIG_PATH = os.path.join(MODEL_DIR, "feature_names.json")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")

# Lazy loading
_model = None
_encoders = None
_features = None
_residual_std = 0.4185

def load_yield_model():
    global _model, _encoders, _features, _residual_std
    if _model is None:
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        with open(ENCODERS_PATH, "rb") as f:
            _encoders = pickle.load(f)
        with open(CONFIG_PATH, "r") as f:
            _features = json.load(f)
        if os.path.exists(METRICS_PATH):
            try:
                with open(METRICS_PATH, "r") as f:
                    m = json.load(f)
                    _residual_std = float(m.get("residual_std", 0.4185))
            except Exception:
                pass

def safe_encode(col_name: str, val: str):
    """
    Encodes categorical features. Raises ValueError if the category is unsupported,
    preventing silent incorrect mapping of districts/states.
    """
    encoder = _encoders[col_name]
    val_str = str(val).strip().lower()
    classes_lower = [c.lower() for c in encoder.classes_]
    
    if val_str in classes_lower:
        idx = classes_lower.index(val_str)
        return encoder.transform([encoder.classes_[idx]])[0]
        
    # Check substring match (e.g. "pune" in "pune district")
    for idx, c in enumerate(classes_lower):
        if val_str in c or c in val_str:
            return encoder.transform([encoder.classes_[idx]])[0]
            
    # Do not silently fall back to random/class 0 for districts
    human_col = col_name.replace("_", " ")
    raise ValueError(f"Unsupported {human_col} '{val}'. Please select a valid option from the supported agricultural regions.")

def predict_yield(state: str, district: str, crop_year: int, season: str, crop: str, area_acres: float):
    """
    Predict crop yield in kg using GradientBoostingRegressor.
    Derives genuine 90% prediction interval from test residual statistics.
    No synthetic or randomized confidence is produced.
    """
    load_yield_model()
    
    # Encode categorical features strictly
    state_enc = safe_encode("State_Name", state)
    district_enc = safe_encode("District_Name", district)
    season_enc = safe_encode("Season", season)
    crop_enc = safe_encode("Crop", crop)
    
    # Area conversion from acres to hectares
    area_hectares = area_acres * 0.404686
    
    input_features = [
        state_enc,
        district_enc,
        crop_year,
        season_enc,
        crop_enc,
        area_hectares
    ]
    
    # Pass named columns to match training feature names (avoids sklearn warning)
    try:
        import pandas as pd
        features_input = pd.DataFrame([input_features], columns=_features)
    except Exception:
        features_input = np.array([input_features])
    log_yield_pred = float(_model.predict(features_input)[0])
    
    # Denormalize log-transformed yield
    yield_hectare = np.expm1(log_yield_pred)
    predicted_production_tonnes = yield_hectare * area_hectares
    predicted_kg = max(0.0, predicted_production_tonnes * 1000.0)
    
    # Genuine 90% prediction interval derived from empirical validation residual std (z = 1.645)
    log_lower = max(0.0, log_yield_pred - 1.645 * _residual_std)
    log_upper = log_yield_pred + 1.645 * _residual_std
    
    lower_kg = max(0.0, np.expm1(log_lower) * area_hectares * 1000.0)
    upper_kg = max(lower_kg, np.expm1(log_upper) * area_hectares * 1000.0)
    
    # Improvement recommendations
    tips = [
        "Use certified high-yielding variety seeds (HYVs) suitable for your soil type.",
        "Implement micro-irrigation (drip/sprinkler) to optimize water-use efficiency.",
        "Apply balanced NPK fertilizers in split doses as recommended by your soil test report.",
        "Practice timely weeding and integrated pest management (IPM) to avoid crop losses."
    ]
    
    return {
        "predicted_kg": round(predicted_kg, 2),
        "confidence": None, # Removed fake confidence per Fix 8
        "prediction_interval": {
            "lower_kg": round(lower_kg, 2),
            "upper_kg": round(upper_kg, 2)
        },
        "improvement_tips": " | ".join(tips)
    }
