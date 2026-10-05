import os
import io
import json
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

# Resolve paths
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "plantvillage")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pth")
CLASSES_PATH = os.path.join(MODEL_DIR, "class_names.json")
TREATMENT_PATH = os.path.join(MODEL_DIR, "treatment_map.json")

# Lazy loading
_model = None
_classes = None
_treatments = None

# Input transforms
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    ),
])

def load_disease_model():
    global _model, _classes, _treatments
    if _model is None:
        with open(CLASSES_PATH, "r") as f:
            _classes = json.load(f)
            
        with open(TREATMENT_PATH, "r") as f:
            _treatments = json.load(f)
            
        # MobileNetV2 setup matching train_disease.py
        _model = models.mobilenet_v2()
        _model.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(_model.last_channel, 512),
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

def validate_image_bytes(image_bytes: bytes):
    """Validate image bytes for corruption, minimum resolution, and basic quality."""
    if not image_bytes or len(image_bytes) < 100:
        raise ValueError("Image file is empty or too small.")
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.verify()  # verify integrity
        # Re-open after verify
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Corrupted or invalid image file: {e}")
        
    width, height = image.size
    if width < 32 or height < 32:
        raise ValueError(f"Image resolution too low ({width}x{height}). Minimum required is 32x32.")
        
    # Check for completely blank/solid image
    extrema = image.getextrema()
    # extrema for RGB is ((min_r, max_r), (min_g, max_g), (min_b, max_b))
    is_blank = all(channel[0] == channel[1] for channel in extrema)
    if is_blank:
        raise ValueError("Image appears to be completely blank/solid color.")
        
    return image


def predict_disease(image_bytes: bytes, min_confidence: float = 0.60):
    """
    Perform disease prediction on raw image bytes.
    Returns real top-5 predictions via torch.topk and handles OOD/uncertainty safely.
    """
    load_disease_model()
    
    # 1. Image validation
    image = validate_image_bytes(image_bytes)
    
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
        c_name = _classes[idx.item()]
        c_parts = c_name.split("___")
        c_crop = c_parts[0].replace("_", " ").strip()
        c_disease = c_parts[1].replace("_", " ").replace("healthy", "Healthy").strip() if len(c_parts) > 1 else c_name
        top_predictions.append({
            "class_name": c_name,
            "crop": c_crop,
            "label": c_disease,
            "confidence": round(float(p.item()) * 100, 1)
        })
        
    # Top-1 result
    top_class = top_predictions[0]["class_name"]
    top_crop = top_predictions[0]["crop"]
    top_disease = top_predictions[0]["label"]
    confidence = float(top_probs[0].item())
    
    # Get treatment info
    treatment_info = _treatments.get(top_class, {
        "severity": "LOW",
        "treatment": ["No specific treatment map found. Monitor plant health."]
    })
    treatment_str = " | ".join(treatment_info.get("treatment", []))
    
    # 4. Out-of-Distribution / Low Confidence Check
    if confidence < min_confidence:
        return {
            "status": "uncertain",
            "is_uncertain": True,
            "class_name": top_class,
            "crop_name": top_crop,
            "disease_name": top_disease,
            "confidence": round(confidence, 2),
            "severity": "LOW",
            "treatment": "Diagnosis uncertain — please upload a clearer, well-lit image of the affected leaf before taking action.",
            "top_predictions": top_predictions,
            "message": "The image could not be classified reliably with sufficient confidence. Please upload a clear image of the affected leaf."
        }
        
    return {
        "status": "success",
        "is_uncertain": False,
        "class_name": top_class,
        "crop_name": top_crop,
        "disease_name": top_disease,
        "confidence": round(confidence, 2),
        "severity": treatment_info.get("severity", "LOW"),
        "treatment": treatment_str,
        "top_predictions": top_predictions,
        "message": "Leaf diagnosis completed successfully."
    }
