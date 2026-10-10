import os
import io
import json
from typing import Optional, Dict, Any, List
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np

from app.ml.validator import validate_image, ValidationResult
from app.ml.crop_classifier import (
    identify_crop_from_probabilities,
    SUPPORTED_CROPS_MAP,
    SUPPORTED_CROP_NAMES,
    get_supported_crops,
    is_crop_supported,
)

# Resolve paths
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models", "plantvillage")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pth")
CLASSES_PATH = os.path.join(MODEL_DIR, "class_names.json")
TREATMENT_PATH = os.path.join(MODEL_DIR, "treatment_map.json")
GUIDELINES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "treatment_guidelines.json")

# Lazy loading
_model = None
_classes = None
_treatments = None
_guidelines = None

# Input transforms matching model training
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    ),
])


def load_disease_model():
    """Load MobileNetV2 disease model and class names into memory."""
    global _model, _classes, _treatments, _guidelines
    if _model is None:
        with open(CLASSES_PATH, "r", encoding="utf-8") as f:
            _classes = json.load(f)

        if os.path.exists(TREATMENT_PATH):
            with open(TREATMENT_PATH, "r", encoding="utf-8") as f:
                _treatments = json.load(f)
        else:
            _treatments = {}

        if os.path.exists(GUIDELINES_PATH):
            with open(GUIDELINES_PATH, "r", encoding="utf-8") as f:
                _guidelines = json.load(f).get("treatments", {})
        else:
            _guidelines = {}

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


def validate_image_bytes(image_bytes: bytes) -> bool:
    """
    Backward-compatible boolean validator for test suites and scripts.
    Returns True if valid image, False otherwise.
    """
    try:
        val = validate_image(image_bytes, target_domain="leaf")
        return bool(val.is_valid)
    except Exception:
        return False


def estimate_visual_severity(image: Image.Image, is_healthy: bool) -> Dict[str, Any]:
    """
    Decoupled visual lesion assessment.
    Agronomic Safety Standard:
    Without an expert-annotated lesion segmentation model (e.g., Mask R-CNN or DeepLabV3+
    validated on pathological ground-truth pixel masks), visual severity must consistently
    return NOT_ASSESSED. Heuristic color thresholds must NEVER fabricate an affected_area_ratio
    or claim LOW, MEDIUM, HIGH, or CRITICAL clinical severity.
    """
    if is_healthy:
        return {
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "severity_assessment_method": "HEALTHY_PLANT",
            "affected_area_ratio": None,
            "clinical_disclaimer": "Plant leaf is healthy; pathological disease severity is not assessed."
        }

    return {
        "severity": "NOT_ASSESSED",
        "severity_code": "NOT_ASSESSED",
        "affected_area_ratio": None,
        "experimental_visual_ratio": None,
        "severity_assessment_method": "NO_VALIDATED_SEGMENTATION_MODEL",
        "clinical_disclaimer": (
            "Clinical disease severity is marked NOT_ASSESSED because no validated lesion-segmentation model "
            "or expert-annotated ground-truth dataset is available in this deployment. "
            "Chemical treatments must not be dosed based on unvalidated severity estimates."
        )
    }


def predict_disease(
    image_bytes: bytes,
    min_confidence: float = 0.50,
    target_crop: Optional[str] = None
) -> Dict[str, Any]:
    """
    Full hierarchical diagnosis pipeline:
    1. Layered image validation (rejects logos, docs, non-plants, blur).
    2. Model inference across PlantVillage classes.
    3. Crop identification & routing (rejects unknown crops like Rose, Rice, Cotton).
    4. Pathological disease evaluation within identified crop.
    5. Decoupled severity assessment and treatment eligibility safeguards.
    """
    load_disease_model()

    # ── Stage 1: Layered Image Validation ──
    val_result = validate_image(image_bytes, target_domain="leaf")
    if not val_result.is_valid:
        return {
            "status": val_result.status,  # 'INVALID_IMAGE' or 'NO_SUPPORTED_PLANT_DETECTED'
            "status_code": val_result.status,
            "is_valid": False,
            "is_uncertain": True,
            "prediction": None,
            "crop_name": "UNKNOWN_CROP",
            "crop_code": "UNKNOWN_CROP",
            "disease_name": "No valid plant leaf detected",
            "disease_code": "INVALID_IMAGE",
            "confidence": 0.0,
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "severity_details": {
                "severity": "NOT_ASSESSED",
                "severity_assessment_method": "INVALID_INPUT",
                "affected_area_ratio": None,
                "clinical_disclaimer": "Image is not a valid plant leaf."
            },
            "treatment": "",
            "treatment_steps": [],
            "treatment_eligibility": False,
            "treatment_eligibility_reason": "Invalid or non-plant image; no treatment can be prescribed.",
            "top_predictions": [],
            "message": val_result.message,
            "validation_details": val_result.details,
            "supported_crops": SUPPORTED_CROP_NAMES,
        }

    image = val_result.image

    # ── Stage 2: Transform Tensor & Inference ──
    tensor = _transform(image).unsqueeze(0)
    with torch.no_grad():
        outputs = _model(tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]

    # ── Stage 3: Hierarchical Crop Identification Gate ──
    crop_decision = identify_crop_from_probabilities(
        probabilities,
        _classes,
        min_confidence=0.50,
        min_margin=0.10,
        target_crop=target_crop
    )

    if crop_decision["status"] == "UNKNOWN_CROP" or not crop_decision["is_supported"]:
        crop_conf = max(0.0, min(float(crop_decision.get("confidence", 0.0)), 1.0))
        top_cands = []
        for cand in crop_decision.get("top_candidates", []):
            c_conf = max(0.0, min(float(cand.get("confidence", 0.0)), 1.0))
            top_cands.append({
                "crop": cand.get("crop", "Unknown"),
                "label": cand.get("label", cand.get("crop", "Unknown")),
                "confidence": round(c_conf, 4)
            })
        return {
            "status": "UNKNOWN_CROP",
            "status_code": "UNKNOWN_CROP",
            "is_valid": True,
            "is_uncertain": True,
            "prediction": None,
            "crop_name": "UNKNOWN_CROP",
            "crop_code": "UNKNOWN_CROP",
            "disease_name": "Unknown or unsupported crop species",
            "disease_code": "UNKNOWN_CROP",
            "confidence": round(crop_conf, 4),
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "severity_details": {
                "severity": "NOT_ASSESSED",
                "severity_assessment_method": "UNSUPPORTED_SPECIES",
                "affected_area_ratio": None,
                "clinical_disclaimer": "Crop species is unsupported or unrecognized."
            },
            "treatment": "",
            "treatment_steps": [],
            "treatment_eligibility": False,
            "treatment_eligibility_reason": "Crop species is unrecognized among the 14 supported crops. Chemical treatments withheld for safety.",
            "top_predictions": top_cands,
            "message": crop_decision["message"],
            "supported_crops": SUPPORTED_CROP_NAMES,
            "crop_decision": crop_decision,
        }

    detected_crop = crop_decision["crop_name"]

    # ── Stage 4: Disease Evaluation within Identified Crop ──
    k = min(5, len(_classes))
    top_probs, top_indices = torch.topk(probabilities, k=k)

    top_predictions = []
    for p, idx in zip(top_probs, top_indices):
        c_name = _classes[idx.item()]
        c_parts = c_name.split("___")
        c_crop = c_parts[0].replace("_", " ").strip()
        c_disease = c_parts[1].replace("_", " ").replace("healthy", "Healthy").strip() if len(c_parts) > 1 else c_name
        # Clamp confidence between 0 and 1
        conf = float(p.item())
        conf = max(0.0, min(conf, 1.0))
        top_predictions.append({
            "class_name": c_name,
            "crop": c_crop,
            "label": c_disease,
            "confidence": round(conf, 4)
        })

    top_class = top_predictions[0]["class_name"]
    top_disease = top_predictions[0]["label"]
    confidence = top_predictions[0]["confidence"]
    is_healthy = "healthy" in top_class.lower()

    # ── Stage 5: Confidence & Uncertainty Thresholding ──
    if confidence < min_confidence:
        return {
            "status": "UNCERTAIN",
            "status_code": "UNCERTAIN",
            "is_valid": True,
            "is_uncertain": True,
            "prediction": None,
            "class_name": top_class,
            "crop_name": detected_crop,
            "crop_code": detected_crop.upper().replace(" ", "_"),
            "disease_name": f"Uncertain diagnosis ({top_disease})",
            "disease_code": "UNCERTAIN",
            "confidence": round(confidence, 4),
            "severity": "NOT_ASSESSED",
            "severity_code": "NOT_ASSESSED",
            "severity_details": {
                "severity": "NOT_ASSESSED",
                "severity_assessment_method": "INCONCLUSIVE_CONFIDENCE",
                "affected_area_ratio": None,
                "clinical_disclaimer": "Diagnosis confidence is below safe operating threshold."
            },
            "treatment": "",
            "treatment_steps": [],
            "treatment_eligibility": False,
            "treatment_eligibility_reason": "Diagnosis confidence is inconclusive. Chemical spray advice is withheld to prevent crop injury.",
            "top_predictions": top_predictions,
            "message": f"Diagnosis is uncertain (confidence {round(confidence*100, 1)}% is below threshold {round(min_confidence*100, 1)}%). Please capture a clearer close-up.",
            "supported_crops": SUPPORTED_CROP_NAMES,
        }

    # ── Stage 6: Decoupled Visual Severity Assessment ──
    severity_details = estimate_visual_severity(image, is_healthy=is_healthy)
    severity_label = severity_details["severity"]

    # ── Stage 7: Treatment Safeguards ──
    guideline = _guidelines.get(top_class, {})
    raw_steps = guideline.get("cultural_practices", [])

    if is_healthy:
        status = "HEALTHY"
        status_code = "HEALTHY"
        treatment_str = "Plant is healthy. Continue routine monitoring."
        treatment_steps = ["Continue routine irrigation and fertilization.", "Monitor foliage weekly for early symptom emergence."]
        treatment_eligibility = False
        treatment_reason = "Plant is healthy. Chemical fungicides or pesticides are not required."
    else:
        status = "DISEASE_DETECTED"
        status_code = "DISEASE_DETECTED"
        treatment_str = " | ".join(raw_steps) if raw_steps else "Maintain proper aeration and sanitation. Consult local extension office."
        treatment_steps = raw_steps if raw_steps else ["Maintain proper field sanitation.", "Consult local Krishi Vigyan Kendra (KVK)."]
        treatment_eligibility = True
        treatment_reason = "Confirmed disease symptoms within supported crop. Cultural and advisory guidance provided."

    return {
        "status": status,
        "status_code": status_code,
        "is_valid": True,
        "is_uncertain": False,
        "prediction": top_disease,
        "class_name": top_class,
        "crop_name": detected_crop,
        "crop_code": detected_crop.upper().replace(" ", "_"),
        "disease_name": top_disease,
        "disease_code": top_class,
        "confidence": round(confidence, 4),
        "severity": severity_label,
        "severity_code": severity_details.get("severity_code", "NOT_ASSESSED"),
        "severity_details": severity_details,
        "treatment": treatment_str,
        "treatment_steps": treatment_steps,
        "treatment_eligibility": treatment_eligibility,
        "treatment_eligibility_reason": treatment_reason,
        "is_healthy": is_healthy,
        "top_predictions": top_predictions,
        "message": "Leaf diagnosis completed successfully.",
        "supported_crops": SUPPORTED_CROP_NAMES,
    }
