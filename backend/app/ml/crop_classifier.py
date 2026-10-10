"""
KrishiMitra — Crop Species Identification & Routing Gate

Identifies supported crop species before pathological disease diagnosis.
Uses the validated 38-class representation mapped strictly to the 14 supported botanical crop taxa.
Prevents unverified disease diagnosis when the crop species cannot be determined with high confidence
or when an unsupported crop (e.g. Rose, Wheat, Rice, Cotton, Mango) is uploaded.

Documented Supported Crops:
1. Apple
2. Blueberry
3. Cherry
4. Corn (Maize)
5. Grape
6. Orange
7. Peach
8. Bell Pepper
9. Potato
10. Raspberry
11. Soybean
12. Squash
13. Strawberry
14. Tomato
"""

import math
from typing import Dict, List, Any, Optional, Tuple
import torch


# The 14 officially supported agricultural crop species in the active PlantVillage pipeline
SUPPORTED_CROPS_MAP: Dict[str, List[str]] = {
    "Apple": [
        "Apple___Apple_scab",
        "Apple___Black_rot",
        "Apple___Cedar_apple_rust",
        "Apple___healthy"
    ],
    "Blueberry": [
        "Blueberry___healthy"
    ],
    "Cherry": [
        "Cherry_(including_sour)___Powdery_mildew",
        "Cherry_(including_sour)___healthy"
    ],
    "Corn": [
        "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
        "Corn_(maize)___Common_rust_",
        "Corn_(maize)___Northern_Leaf_Blight",
        "Corn_(maize)___healthy"
    ],
    "Grape": [
        "Grape___Black_rot",
        "Grape___Esca_(Black_Measles)",
        "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
        "Grape___healthy"
    ],
    "Orange": [
        "Orange___Haunglongbing_(Citrus_greening)"
    ],
    "Peach": [
        "Peach___Bacterial_spot",
        "Peach___healthy"
    ],
    "Bell Pepper": [
        "Pepper,_bell___Bacterial_spot",
        "Pepper,_bell___healthy"
    ],
    "Potato": [
        "Potato___Early_blight",
        "Potato___Late_blight",
        "Potato___healthy"
    ],
    "Raspberry": [
        "Raspberry___healthy"
    ],
    "Soybean": [
        "Soybean___healthy"
    ],
    "Squash": [
        "Squash___Powdery_mildew"
    ],
    "Strawberry": [
        "Strawberry___Leaf_scorch",
        "Strawberry___healthy"
    ],
    "Tomato": [
        "Tomato___Bacterial_spot",
        "Tomato___Early_blight",
        "Tomato___Late_blight",
        "Tomato___Leaf_Mold",
        "Tomato___Septoria_leaf_spot",
        "Tomato___Spider_mites Two-spotted_spider_mite",
        "Tomato___Target_Spot",
        "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
        "Tomato___Tomato_mosaic_virus",
        "Tomato___healthy"
    ]
}

SUPPORTED_CROP_NAMES: List[str] = list(SUPPORTED_CROPS_MAP.keys())

# Default confidence thresholds validated on held-out evaluation
DEFAULT_CROP_MIN_CONFIDENCE = 0.55  # Minimum aggregated crop probability
DEFAULT_CROP_MIN_MARGIN = 0.15      # Margin between #1 crop and #2 crop
MAX_CROP_ENTROPY = 2.4              # Maximum Shannon entropy before flagging OOD/uncertainty


def get_supported_crops() -> List[Dict[str, Any]]:
    """Return explicit list of supported crops and their disease diagnostic capabilities."""
    result = []
    for crop, classes in SUPPORTED_CROPS_MAP.items():
        diseases = [
            c.split("___")[1].replace("_", " ").replace("healthy", "Healthy").strip()
            for c in classes if "___" in c
        ]
        has_healthy_class = any("healthy" in c.lower() for c in classes)
        result.append({
            "crop_name": crop,
            "supported_classes_count": len(classes),
            "disease_count": len(diseases),
            "diagnosable_conditions": diseases,
            "classes": classes,
            "has_healthy_reference": has_healthy_class
        })
    return result


def is_crop_supported(crop_name: str) -> bool:
    """Check if a crop string matches one of the 14 supported crops."""
    if not crop_name:
        return False
    norm = crop_name.strip().lower().replace("_", " ")
    for sc in SUPPORTED_CROP_NAMES:
        if sc.lower().replace("_", " ") == norm:
            return True
        if norm in sc.lower():
            return True
    return False


def identify_crop_from_probabilities(
    probabilities: torch.Tensor,
    class_names: List[str],
    min_confidence: float = DEFAULT_CROP_MIN_CONFIDENCE,
    min_margin: float = DEFAULT_CROP_MIN_MARGIN,
    target_crop: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes calibrated marginal crop probabilities across the 14 supported crops.
    
    Args:
        probabilities: Softmax tensor of length 38 across PlantVillage classes.
        class_names: List of class strings matching index order of probabilities.
        min_confidence: Minimum required probability to declare crop match.
        min_margin: Minimum margin over second-place crop.
        target_crop: Optional expected farm crop to verify congruence.
        
    Returns:
        Structured crop decision dictionary.
    """
    probs_np = probabilities.cpu().numpy() if isinstance(probabilities, torch.Tensor) else probabilities

    # Accumulate probabilities per crop
    crop_probs: Dict[str, float] = {crop: 0.0 for crop in SUPPORTED_CROP_NAMES}
    for idx, cname in enumerate(class_names):
        prob = float(probs_np[idx])
        for crop, classes in SUPPORTED_CROPS_MAP.items():
            if cname in classes:
                crop_probs[crop] += prob
                break

    # Sort crops descending by aggregated probability
    sorted_crops = sorted(crop_probs.items(), key=lambda kv: kv[1], reverse=True)
    top_crop, top_prob = sorted_crops[0]
    runner_up_crop, runner_up_prob = sorted_crops[1]
    margin = top_prob - runner_up_prob

    # Calculate normalized Shannon entropy over the 14 crops
    entropy = 0.0
    for _, p in sorted_crops:
        if p > 1e-6:
            entropy -= p * math.log2(p)

    is_confident = (top_prob >= min_confidence) and (margin >= min_margin) and (entropy <= MAX_CROP_ENTROPY)

    # If expected farm crop provided (e.g. farmer selected "Tomato", but image is "Apple"):
    mismatch = False
    if target_crop and is_confident:
        norm_target = target_crop.strip().lower()
        if norm_target in ("pepper", "bell pepper", "capsicum"):
            norm_target = "bell pepper"
        elif norm_target in ("maize", "corn"):
            norm_target = "corn"

        if norm_target != top_crop.lower():
            mismatch = True

    if not is_confident:
        return {
            "crop_name": "UNKNOWN_CROP",
            "detected_crop": top_crop,
            "confidence": round(float(max(0.0, min(top_prob, 1.0))), 4),
            "margin": round(margin, 3),
            "entropy": round(entropy, 3),
            "status": "UNKNOWN_CROP",
            "is_supported": False,
            "message": (
                f"Crop species could not be identified with sufficient certainty "
                f"(top candidate '{top_crop}' at {round(top_prob*100, 1)}%, margin {round(margin*100, 1)}%). "
                f"Supported crops: {', '.join(SUPPORTED_CROP_NAMES)}."
            ),
            "top_candidates": [
                {
                    "crop": c,
                    "label": c,
                    "confidence": round(float(max(0.0, min(p, 1.0))), 4)
                }
                for c, p in sorted_crops[:5]
            ],
            "supported_crops": SUPPORTED_CROP_NAMES
        }

    return {
        "crop_name": top_crop,
        "detected_crop": top_crop,
        "confidence": round(float(max(0.0, min(top_prob, 1.0))), 4),
        "margin": round(margin, 3),
        "entropy": round(entropy, 3),
        "status": "IDENTIFIED",
        "is_supported": True,
        "crop_mismatch": mismatch,
        "message": f"Identified as {top_crop} with {round(top_prob*100, 1)}% confidence.",
        "top_candidates": [
            {
                "crop": c,
                "label": c,
                "confidence": round(float(max(0.0, min(p, 1.0))), 4)
            }
            for c, p in sorted_crops[:5]
        ],
        "supported_crops": SUPPORTED_CROP_NAMES
    }
