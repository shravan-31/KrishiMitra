import os
import json
import pickle
import numpy as np

# Resolve model path
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "soil")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")
CONFIG_PATH = os.path.join(MODEL_DIR, "feature_names.json")

# Lazy loading
_model = None
_encoder = None
_features = None

def load_soil_model():
    global _model, _encoder, _features
    if _model is None:
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        with open(ENCODER_PATH, "rb") as f:
            _encoder = pickle.load(f)
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)
            _features = config["features"]

def calculate_soil_health(n, p, k, ph, organic_matter, moisture, ec):
    """
    Calculate a composite soil health score out of 100 based on standard soil science metrics.
    """
    score = 100.0
    
    # pH: optimal is 6.0 to 7.5
    if ph < 6.0:
        score -= (6.0 - ph) * 15
    elif ph > 7.5:
        score -= (ph - 7.5) * 15
        
    # Nitrogen (N): ideal 50 - 150
    if n < 50:
        score -= (50 - n) * 0.4
    elif n > 150:
        score -= (n - 150) * 0.15
        
    # Phosphorus (P): ideal 30 - 100
    if p < 30:
        score -= (30 - p) * 0.5
    elif p > 100:
        score -= (p - 100) * 0.15
        
    # Potassium (K): ideal 50 - 200
    if k < 50:
        score -= (50 - k) * 0.3
        
    # Organic matter: ideal >= 2.0%
    if organic_matter < 2.0:
        score -= (2.0 - organic_matter) * 15
        
    # Moisture: ideal 20% to 60%
    if moisture < 20:
        score -= (20 - moisture) * 0.5
    elif moisture > 60:
        score -= (moisture - 60) * 0.5
        
    # Electrical Conductivity (EC): ideal 0.5 to 2.0
    if ec < 0.5:
        score -= (0.5 - ec) * 10
    elif ec > 2.0:
        score -= (ec - 2.0) * 15
        
    return max(10.0, min(100.0, round(score, 1)))

def generate_fertilizer_advice(n, p, k, ph, organic_matter):
    """
    Generate customized fertilizer and soil improvement advice.
    """
    advice = []
    
    if n < 50:
        advice.append("Nitrogen (N) is low. Apply Urea or Ammonium Sulphate, or grow cover crops like clover.")
    elif n > 150:
        advice.append("Nitrogen (N) is high. Limit nitrogen fertilizers to avoid pest susceptibility.")
        
    if p < 30:
        advice.append("Phosphorus (P) is low. Apply Single Super Phosphate (SSP) or Bone Meal.")
    elif p > 100:
        advice.append("Phosphorus (P) is high. Reduce phosphate inputs to prevent zinc deficiency.")
        
    if k < 50:
        advice.append("Potassium (K) is low. Apply Muriate of Potash (MOP) or wood ash.")
        
    if ph < 6.0:
        advice.append("Soil is acidic. Add agricultural lime (calcium carbonate) to increase pH.")
    elif ph > 7.5:
        advice.append("Soil is alkaline. Incorporate agricultural sulfur, gypsum, or organic compost to lower pH.")
        
    if organic_matter < 2.0:
        advice.append("Organic matter is low. Incorporate well-rotted farmyard manure or vermicompost.")
        
    if not advice:
        advice.append("Soil nutrients and pH are well-balanced. Keep up standard organic fertilization.")
        
    return " | ".join(advice)

def predict_soil(n: float, p: float, k: float, temp: float, humidity: float, ph: float, rainfall: float,
                 organic_matter: float = 2.5, moisture: float = 35.0, ec: float = 1.2):
    """
    Recommend top crops and return soil health metrics.
    """
    load_soil_model()
    
    # Input matching train feature set: ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
    # If the model has fewer features due to correlation drop, we extract only those
    input_dict = {
        'N': n, 'P': p, 'K': k, 
        'temperature': temp, 'humidity': humidity, 
        'ph': ph, 'rainfall': rainfall
    }
    
    features_input = [input_dict[col] for col in _features]
    features_input = np.array([features_input])
    
    # Get probabilities for top recommendations
    probs = _model.predict_proba(features_input)[0]
    top_indices = np.argsort(probs)[::-1][:3]
    
    recommended_crops = []
    for idx in top_indices:
        if probs[idx] > 0.05:  # threshold of 5% confidence
            crop = _encoder.inverse_transform([idx])[0]
            recommended_crops.append(crop.capitalize())
            
    if not recommended_crops:
        recommended_crops = [str(_encoder.inverse_transform([top_indices[0]])[0]).capitalize()]
        
    health_score = calculate_soil_health(n, p, k, ph, organic_matter, moisture, ec)
    advice = generate_fertilizer_advice(n, p, k, ph, organic_matter)
    
    return {
        "recommended_crops": recommended_crops,
        "soil_health_score": health_score,
        "fertilizer_advice": advice
    }
