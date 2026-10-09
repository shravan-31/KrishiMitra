import os
import io
import json
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

# Resolve paths
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "pest")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pth")
CLASSES_PATH = os.path.join(MODEL_DIR, "class_names.json")
CONTROL_PATH = os.path.join(MODEL_DIR, "pest_control_map.json")

# Lazy loading
_model = None
_classes = None
_controls = None

# Input transforms
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    ),
])

def load_pest_model(force_reload: bool = False):
    global _model, _classes, _controls
    if _model is None or force_reload:
        with open(CLASSES_PATH, "r") as f:
            _classes = json.load(f)
            
        with open(CONTROL_PATH, "r") as f:
            _controls = json.load(f)
            
        # EfficientNet-B0 setup matching train_pest.py
        _model = models.efficientnet_b0()
        
        in_features = _model.classifier[1].in_features
        _model.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(p=0.2),
            nn.Linear(512, len(_classes)),
        )
        
        # Load weights on CPU
        checkpoint = torch.load(MODEL_PATH, map_location=torch.device("cpu"))
        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            _model.load_state_dict(checkpoint["model_state_dict"])
        else:
            _model.load_state_dict(checkpoint)
        _model.eval()

def validate_pest_image_bytes(image_bytes: bytes):
    """Validate image bytes for corruption, minimum resolution, and basic quality."""
    if not image_bytes or len(image_bytes) < 100:
        raise ValueError("Pest image file is empty or too small.")
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.verify()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Corrupted or invalid pest image file: {e}")
        
    width, height = image.size
    if width < 32 or height < 32:
        raise ValueError(f"Pest image resolution too low ({width}x{height}). Minimum required is 32x32.")
        
    extrema = image.getextrema()
    is_blank = all(channel[0] == channel[1] for channel in extrema)
    if is_blank:
        raise ValueError("Pest image appears to be completely blank/solid color.")
        
    return image


def predict_pest(image_bytes: bytes, min_confidence: float = 0.05):
    """
    Perform pest prediction on raw image bytes.
    Returns real top-5 predictions via torch.topk and ensures treatments are never withheld.
    """
    load_pest_model()
    
    # 1. Validate image
    image = validate_pest_image_bytes(image_bytes)
    
    # 2. Transform tensor
    tensor = _transform(image).unsqueeze(0)
    
    with torch.no_grad():
        outputs = _model(tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
        
    # 3. Real Top-5 via torch.topk
    k = min(5, len(_classes))
    top_probs, top_indices = torch.topk(probabilities, k=k)
    
    top_predictions = []
    for p, idx in zip(top_probs, top_indices):
        raw_name = _classes[idx.item()]
        clean_lbl = raw_name.replace("_", " ").strip()
        top_predictions.append({
            "class_name": raw_name,
            "label": clean_lbl,
            "confidence": round(float(p.item()) * 100, 1)
        })
        
    # Top-1 result
    top_class = top_predictions[0]["class_name"]
    pest_display = top_predictions[0]["label"]
    confidence = float(top_probs[0].item())
    
    # Get control info
    control_info = _controls.get(top_class, {
        "severity": "LOW",
        "treatment": ["Apply organic neem oil solution (5ml/L).", "Apply recommended standard pesticide if infestation is severe."]
    })
    
    treatments = control_info.get("treatment", control_info.get("control", ["Apply organic neem oil spray.", "Apply targeted insect repellent."]))
    if isinstance(treatments, list):
        treatment_str = " | ".join(treatments)
        treatments_list = treatments
    else:
        treatment_str = str(treatments)
        treatments_list = [treatment_str]
        
    organic_ctrl = treatments_list[0] if len(treatments_list) > 0 else "Apply organic neem oil solution (5ml/L)."
    chemical_ctrl = treatments_list[1] if len(treatments_list) > 1 else "Apply recommended standard pesticide if infestation is severe."

    # 4. Out-of-Distribution / Low Confidence Check
    if confidence < min_confidence:
        return {
            "status": "uncertain",
            "is_uncertain": True,
            "pest_name": None,
            "prediction": None,
            "confidence": round(confidence, 2),
            "severity": control_info.get("severity", "LOW"),
            "treatment": treatment_str,
            "organic_control": organic_ctrl,
            "chemical_control": chemical_ctrl,
            "top_predictions": top_predictions,
            "message": "Moderate confidence detection. Recommended treatments are provided below based on closest visual match."
        }
        
    return {
        "status": "success",
        "is_uncertain": False,
        "pest_name": pest_display,
        "prediction": pest_display,
        "confidence": round(confidence, 2),
        "severity": control_info.get("severity", "MEDIUM"),
        "treatment": treatment_str,
        "organic_control": organic_ctrl,
        "chemical_control": chemical_ctrl,
        "top_predictions": top_predictions,
        "message": "Pest identified successfully."
    }

