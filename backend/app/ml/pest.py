import os
import io
import json
from typing import Optional, Dict, Any, List
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

from app.ml.validator import validate_image, ValidationResult

# Resolve paths
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "pest")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pth")
CLASSES_PATH = os.path.join(MODEL_DIR, "class_names.json")
CONTROL_PATH = os.path.join(MODEL_DIR, "pest_control_map.json")

# Lazy loading
_model = None
_classes = None
_controls = None

# Input transforms matching training pipeline
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    ),
])


def load_pest_model(force_reload: bool = False):
    """Load EfficientNet-B0 pest classification model and class mappings."""
    global _model, _classes, _controls
    if _model is None or force_reload:
        with open(CLASSES_PATH, "r", encoding="utf-8") as f:
            _classes = json.load(f)

        if os.path.exists(CONTROL_PATH):
            with open(CONTROL_PATH, "r", encoding="utf-8") as f:
                _controls = json.load(f)
        else:
            _controls = {}

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

        checkpoint = torch.load(MODEL_PATH, map_location=torch.device("cpu"))
        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            _model.load_state_dict(checkpoint["model_state_dict"])
        else:
            _model.load_state_dict(checkpoint)
        _model.eval()


def validate_pest_image_bytes(image_bytes: bytes) -> bool:
    """
    Backward-compatible boolean validator for test suites and scripts.
    Returns True if valid image, False otherwise.
    """
    try:
        val = validate_image(image_bytes, target_domain="pest")
        return bool(val.is_valid)
    except Exception:
        return False


def predict_pest(
    image_bytes: bytes,
    min_confidence: float = 0.70
) -> Dict[str, Any]:
    """
    Perform pest classification on raw image bytes with strict presence verification.

    Architectural & Safety Boundary:
    The active model is a 15-class insect classifier (EfficientNet-B0). It does NOT
    contain a trained negative 'no-pest' class, background class, or bounding-box
    object detector. Therefore:
    1. Raw top-1 classification is NEVER interpreted as guaranteed proof of infestation density.
    2. Infestation severity is strictly marked 'NOT_ASSESSED' because counting insect density
       from single-image classification without bounding boxes is scientifically invalid.
    3. When confidence is below the validated threshold (0.70) or margin is ambiguous,
       an explicit UNCERTAIN state is returned and all chemical treatments are suppressed.
    """
    load_pest_model()

    # ── Stage 1: Layered Image Validation ──
    val_result = validate_image(image_bytes, target_domain="pest")
    if not val_result.is_valid:
        status_code = val_result.status  # 'INVALID_IMAGE' or 'NO_SUPPORTED_PLANT_DETECTED'
        return {
            "status": status_code,
            "status_code": status_code,
            "is_valid": False,
            "is_uncertain": True,
            "pest_name": None,
            "pest_code": None,
            "prediction": None,
            "confidence": 0.0,
            "infestation_level": "NOT_ASSESSED",
            "infestation_code": "NOT_ASSESSED",
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "treatment": "",
            "organic_control": "",
            "chemical_control": "",
            "treatment_eligibility": False,
            "treatment_eligibility_reason": "Image validation failed; no agricultural pest analysis possible.",
            "top_predictions": [],
            "message": val_result.message,
            "validation_details": val_result.details,
            "model_limitations": "Model requires clear agricultural imagery; non-plant/invalid inputs rejected.",
        }

    image = val_result.image

    # ── Stage 2: Transform & Model Inference ──
    tensor = _transform(image).unsqueeze(0)
    with torch.no_grad():
        outputs = _model(tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]

    # ── Stage 3: Top-K Extraction ──
    k = min(5, len(_classes))
    top_probs, top_indices = torch.topk(probabilities, k=k)

    top_predictions = []
    for p, idx in zip(top_probs, top_indices):
        raw_name = _classes[idx.item()]
        clean_lbl = raw_name.replace("_", " ").strip()
        top_predictions.append({
            "class_name": raw_name,
            "label": clean_lbl,
            "confidence": round(float(p.item()), 4)
        })

    top_class = top_predictions[0]["class_name"]
    pest_display = top_predictions[0]["label"]
    confidence = float(top_probs[0].item())
    runner_up_conf = float(top_probs[1].item()) if len(top_probs) > 1 else 0.0
    margin = confidence - runner_up_conf

    # ── Stage 4: Strict Uncertainty & Presence Filtering ──
    # If confidence is below threshold or class margin is ambiguous,
    # we cannot reliably confirm pest presence
    if confidence < min_confidence or margin < 0.10:
        return {
            "status": "UNCERTAIN",
            "status_code": "UNCERTAIN",
            "is_valid": True,
            "is_uncertain": True,
            "pest_name": None,
            "pest_code": None,
            "prediction": None,
            "confidence": round(confidence, 4),
            "infestation_level": "NOT_ASSESSED",
            "infestation_code": "NOT_ASSESSED",
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "treatment": "",
            "organic_control": "",
            "chemical_control": "",
            "treatment_eligibility": False,
            "treatment_eligibility_reason": "Pest presence inconclusive. Chemical spray advice withheld to avoid unwarranted chemical use.",
            "top_predictions": top_predictions,
            "message": (
                f"Pest presence inconclusive (confidence {round(confidence*100, 1)}%, margin {round(margin*100, 1)}%). "
                f"Because this model is an insect classifier without a 'no-pest' baseline or object detector, "
                f"manual inspection at a local Krishi Vigyan Kendra (KVK) is recommended before applying any pesticides."
            ),
            "model_limitations": "Insect classifier cannot verify negative pest absence or quantify infestation density without object detector."
        }

    # Retrieve control guidance for confirmed candidate
    control_info = _controls.get(top_class, {})
    treatments = control_info.get("treatment", [
        "Monitor pest population using physical sticky/pheromone traps.",
        "Consult local agricultural extension officer for economic threshold levels."
    ])
    if isinstance(treatments, list):
        treatment_str = " | ".join(treatments)
        organic_ctrl = treatments[0] if len(treatments) > 0 else "Deploy monitoring traps and sticky cards."
        chemical_ctrl = treatments[1] if len(treatments) > 1 else "Consult extension officer before chemical spray."
    else:
        treatment_str = str(treatments)
        organic_ctrl = treatment_str
        chemical_ctrl = "Consult extension officer."

    return {
        "status": "PEST_DETECTED",
        "status_code": "PEST_DETECTED",
        "is_valid": True,
        "is_uncertain": False,
        "pest_name": pest_display,
        "pest_code": top_class,
        "prediction": pest_display,
        "confidence": round(confidence, 4),
        "infestation_level": "NOT_ASSESSED",
        "infestation_code": "NOT_ASSESSED",
        "severity": "NOT_ASSESSED",
        "severity_code": "NOT_ASSESSED",
        "severity_details": {
            "infestation_level": "NOT_ASSESSED",
            "assessment_method": "NOT_ASSESSED_CLASSIFIER_ONLY",
            "limitations": "Model classifies insect species but cannot measure spatial population density without an object detector."
        },
        "treatment": treatment_str,
        "organic_control": organic_ctrl,
        "chemical_control": chemical_ctrl,
        "treatment_eligibility": True,
        "treatment_eligibility_reason": "High-confidence insect identification. Prioritize non-chemical IPM traps first.",
        "top_predictions": top_predictions,
        "message": f"Identified {pest_display} insect symptoms with {round(confidence*100, 1)}% confidence.",
        "model_limitations": "Infestation severity is marked NOT_ASSESSED because single-image classification cannot estimate insect density."
    }
