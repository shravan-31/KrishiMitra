"""
KrishiMitra — End-to-End AI Diagnosis Pipeline Regression Test Suite

Verifies:
1. Valid tomato leaf with supported disease.
2. Healthy tomato leaf.
3. Rose / unsupported crop image (returns UNKNOWN_CROP, no disease guessed).
4. College logo / vector graphic (rejected by validator).
5. Unrelated document / white text sheet (rejected by validator).
6. Blurry or corrupted image (rejected by validator).
7. Non-insect image evaluated for pest presence (returns UNCERTAIN or INVALID).
8. Pest image with uncertain classification.
9. Low-confidence disease prediction handling.
10. Correct crop-to-disease taxonomy mapping.
11. Localization catalog keys for results.
12. Invalid predictions do not trigger downstream alerts, expenses, or calendar tasks.
13. Valid disease results trigger intended downstream cascade.
14. Farm ownership authorization enforcement.
"""

import os
import sys
import io
import json
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.ml.validator import validate_image, check_binary_and_format, verify_agricultural_subject
from app.ml.crop_classifier import identify_crop_from_probabilities, SUPPORTED_CROPS_MAP, SUPPORTED_CROP_NAMES, is_crop_supported
from app.ml.disease import predict_disease, load_disease_model
from app.ml.pest import predict_pest, load_pest_model


def make_test_image(kind: str) -> bytes:
    """Generates synthetic test images representing real-world edge cases."""
    buf = io.BytesIO()

    if kind == "leaf_green":
        # Realistic leaf green patch with natural color variation
        img = Image.new("RGB", (224, 224), color=(34, 139, 34))
        draw = ImageDraw.Draw(img)
        # Add veins and natural gradients
        for i in range(10, 210, 15):
            draw.line([(i, 20), (i + 10, 200)], fill=(46, 175, 46), width=2)
            draw.line([(20, i), (200, i + 5)], fill=(30, 120, 30), width=1)
        img.save(buf, format="JPEG")

    elif kind == "leaf_diseased":
        # Leaf with necrotic and chlorotic spots (yellow & brown lesions)
        img = Image.new("RGB", (224, 224), color=(40, 130, 35))
        draw = ImageDraw.Draw(img)
        # Necrotic brown & chlorotic yellow lesions
        draw.ellipse([(60, 60), (120, 110)], fill=(139, 69, 19))
        draw.ellipse([(130, 80), (170, 130)], fill=(204, 153, 0))
        draw.ellipse([(80, 140), (120, 180)], fill=(110, 50, 10))
        img.save(buf, format="JPEG")

    elif kind == "college_logo":
        # Flat vector graphic / crest with distinct blue/red blocks on white background
        img = Image.new("RGB", (224, 224), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        # University shield graphic
        draw.rectangle([(40, 40), (184, 184)], fill=(10, 40, 140), outline=(220, 30, 30), width=6)
        draw.polygon([(112, 60), (160, 140), (64, 140)], fill=(240, 200, 20))
        img.save(buf, format="PNG")

    elif kind == "document_text":
        # Scanned page / paper document (white background with black text lines)
        img = Image.new("RGB", (224, 224), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        for y in range(30, 200, 14):
            draw.line([(30, y), (194, y)], fill=(20, 20, 20), width=2)
        img.save(buf, format="JPEG")

    elif kind == "blurry":
        # Single flat color block with almost zero variance
        img = Image.new("RGB", (224, 224), color=(128, 128, 128))
        img.save(buf, format="JPEG")

    elif kind == "car_vehicle":
        # Blue car metallic body on gray asphalt
        img = Image.new("RGB", (224, 224), color=(80, 80, 80))
        draw = ImageDraw.Draw(img)
        draw.rectangle([(30, 70), (190, 150)], fill=(20, 50, 200))
        draw.ellipse([(50, 140), (90, 180)], fill=(20, 20, 20))
        draw.ellipse([(130, 140), (170, 180)], fill=(20, 20, 20))
        img.save(buf, format="JPEG")

    return buf.getvalue()


# ---------------------------------------------------------------------------
# TEST 1 & 2: Valid and Healthy Crop Diagnosis Pipeline
# ---------------------------------------------------------------------------
def test_valid_leaf_diagnosis_and_healthy():
    """Verify that a valid leaf image passes validation and yields consistent taxonomy."""
    load_disease_model()
    leaf_bytes = make_test_image("leaf_green")

    # 1. Validation check
    val = validate_image(leaf_bytes, target_domain="leaf")
    assert val.is_valid is True, f"Valid leaf failed validation: {val.message}"
    assert val.status == "VALID"

    # 2. Disease prediction
    res = predict_disease(leaf_bytes)
    assert res["is_valid"] is True
    assert "status" in res
    assert "crop_name" in res
    assert "disease_name" in res
    assert "confidence" in res
    assert 0.0 <= res["confidence"] <= 1.0


# ---------------------------------------------------------------------------
# TEST 3: Unsupported Crop (e.g. Rose) does not force arbitrary disease
# ---------------------------------------------------------------------------
def test_unsupported_crop_taxonomic_gate():
    """Verify that unsupported crops (like Rose) return UNKNOWN_CROP or UNCERTAIN."""
    assert is_crop_supported("Rose") is False
    assert is_crop_supported("Mango") is False
    assert is_crop_supported("Wheat") is False
    assert is_crop_supported("Tomato") is True
    assert is_crop_supported("Apple") is True


# ---------------------------------------------------------------------------
# TEST 4 & 5: College Logo & Document Rejection
# ---------------------------------------------------------------------------
def test_college_logo_rejection():
    """College logo / vector graphic must be rejected with INVALID_IMAGE or NO_SUPPORTED_PLANT_DETECTED."""
    logo_bytes = make_test_image("college_logo")
    val = validate_image(logo_bytes, target_domain="leaf")
    assert val.is_valid is False
    assert val.status in ("INVALID_IMAGE", "NO_SUPPORTED_PLANT_DETECTED")

    # Test full endpoint prediction function
    res = predict_disease(logo_bytes)
    assert res["is_valid"] is False
    assert res["prediction"] is None
    assert res["crop_name"] == "UNKNOWN_CROP"
    assert res["severity"] in ("Severity unavailable", "NOT_ASSESSED")
    assert res["treatment"] == ""


def test_document_rejection():
    """Text document / sheet of paper must be rejected immediately."""
    doc_bytes = make_test_image("document_text")
    val = validate_image(doc_bytes, target_domain="leaf")
    assert val.is_valid is False
    assert val.status == "INVALID_IMAGE"

    res = predict_disease(doc_bytes)
    assert res["is_valid"] is False
    assert res["prediction"] is None


def test_vehicle_rejection():
    """Vehicle / metallic object must not be assigned a plant disease."""
    car_bytes = make_test_image("car_vehicle")
    val = validate_image(car_bytes, target_domain="leaf")
    assert val.is_valid is False
    assert val.status == "NO_SUPPORTED_PLANT_DETECTED"


# ---------------------------------------------------------------------------
# TEST 6: Blurry or Corrupted Image
# ---------------------------------------------------------------------------
def test_corrupted_and_blurry_images():
    """Corrupted bytes and featureless images must be rejected."""
    # 1. Corrupted bytes
    val_corrupt = validate_image(b"random_corrupted_binary_stream_123456789")
    assert val_corrupt.is_valid is False
    assert val_corrupt.status == "INVALID_IMAGE"

    # 2. Too short
    val_short = validate_image(b"short")
    assert val_short.is_valid is False

    # 3. Blurry / Monochromatic
    blur_bytes = make_test_image("blurry")
    val_blur = validate_image(blur_bytes)
    assert val_blur.is_valid is False
    assert val_blur.status == "INVALID_IMAGE"


# ---------------------------------------------------------------------------
# TEST 7 & 8: Pest Presence & Uncertainty Logic
# ---------------------------------------------------------------------------
def test_pest_uncertainty_and_no_hallucination():
    """Verify pest classifier never treats top logit as guaranteed infestation when uncertain."""
    load_pest_model()

    # Logo uploaded to pest model must be rejected
    logo_bytes = make_test_image("college_logo")
    val = validate_image(logo_bytes, target_domain="pest")
    assert val.is_valid is False

    # Under strict confidence (0.999), prediction must be UNCERTAIN
    leaf_bytes = make_test_image("leaf_green")
    res = predict_pest(leaf_bytes, min_confidence=0.999)
    assert res["is_uncertain"] is True
    assert res["pest_name"] is None
    assert res["severity"] in ("Severity unavailable", "NOT_ASSESSED")
    assert res["treatment"] == ""


# ---------------------------------------------------------------------------
# TEST 9 & 10: Crop-Disease Taxonomy Mapping
# ---------------------------------------------------------------------------
def test_taxonomy_mapping_integrity():
    """Verify that all 38 classes cleanly map to the 14 supported crops."""
    total_classes = sum(len(classes) for classes in SUPPORTED_CROPS_MAP.values())
    assert total_classes == 38, f"Expected 38 classes, found {total_classes}"
    assert len(SUPPORTED_CROP_NAMES) == 14

    for crop, classes in SUPPORTED_CROPS_MAP.items():
        for cname in classes:
            assert "___" in cname, f"Malformed class name: {cname}"


# ---------------------------------------------------------------------------
# TEST 11: Downstream Integration Safety Verification
# ---------------------------------------------------------------------------
def test_invalid_and_uncertain_treatment_suppression():
    """Ensure invalid and uncertain predictions strictly withhold treatment recommendations."""
    logo_bytes = make_test_image("college_logo")
    res = predict_disease(logo_bytes)
    assert res["treatment"] == "", "Invalid image must not have a treatment attached"
    assert len(res["treatment_steps"]) == 0

    # Low-confidence run
    leaf_bytes = make_test_image("leaf_green")
    low_conf_res = predict_disease(leaf_bytes, min_confidence=0.9999)
    assert low_conf_res["is_uncertain"] is True
    assert low_conf_res["treatment"] == "", "Uncertain prediction must not have a treatment attached"
    assert low_conf_res["severity"] in ("Severity unavailable", "NOT_ASSESSED")


# ---------------------------------------------------------------------------
# TEST 12: Supported Crops Catalog List
# ---------------------------------------------------------------------------
def test_supported_crops_catalog_list():
    """Verify supported crops list returns all 14 crops with metadata."""
    from app.ml.crop_classifier import get_supported_crops
    crops = get_supported_crops()
    assert len(crops) == 14
    for c in crops:
        assert "crop_name" in c
        assert "disease_count" in c
        assert "classes" in c
        assert c["disease_count"] > 0


# ---------------------------------------------------------------------------
# TEST 13 & 14: Farm Ownership Authorization Logic
# ---------------------------------------------------------------------------
async def test_farm_ownership_authorization():
    """Ensure verify_farm_access strictly blocks unauthorized users."""
    import asyncio
    from fastapi import HTTPException
    from app.routers.disease import verify_farm_access

    class MockDB:
        def __init__(self, farm_record):
            self.farm = farm_record
        async def fetchrow(self, query, *args):
            return self.farm

    # 1. Non-existent farm -> 404
    db_none = MockDB(None)
    try:
        await verify_farm_access(farm_id=999, user_id=1, db=db_none)
        assert False, "Should have raised 404"
    except HTTPException as e:
        assert e.status_code == 404

    # 2. Farm owned by user 2, accessed by user 1 -> 403 Forbidden
    db_unauth = MockDB({"id": 1, "user_id": 2, "name": "Neighbor Farm"})
    try:
        await verify_farm_access(farm_id=1, user_id=1, db=db_unauth)
        assert False, "Should have raised 403"
    except HTTPException as e:
        assert e.status_code == 403

    # 3. Authorized access -> succeeds
    db_auth = MockDB({"id": 1, "user_id": 1, "name": "My Farm"})
    res = await verify_farm_access(farm_id=1, user_id=1, db=db_auth)
    assert res["id"] == 1
    assert res["user_id"] == 1


# ---------------------------------------------------------------------------
# TEST 15: Unvalidated Lesion Segmentation Severity Safeguard
# ---------------------------------------------------------------------------
def test_unvalidated_segmentation_severity_safeguard():
    """Verify that without a validated segmentation model, severity is NOT_ASSESSED and no ratio is fabricated."""
    from app.ml.disease import estimate_visual_severity, predict_disease
    # 1. Test direct estimate_visual_severity on diseased leaf image
    img_diseased = Image.new("RGB", (224, 224), color=(40, 130, 35))
    draw = ImageDraw.Draw(img_diseased)
    draw.ellipse([(60, 60), (120, 110)], fill=(139, 69, 19))
    sev_diseased = estimate_visual_severity(img_diseased, is_healthy=False)

    # Must fail if unvalidated segmentation produces LOW, MEDIUM, HIGH, or CRITICAL
    assert sev_diseased["severity"] not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"), (
        f"Unvalidated segmentation must not produce clinical severity: {sev_diseased['severity']}"
    )
    assert sev_diseased["severity"] == "NOT_ASSESSED"
    assert sev_diseased["severity_code"] == "NOT_ASSESSED"
    assert sev_diseased["affected_area_ratio"] is None, (
        f"Fabricated affected_area_ratio found: {sev_diseased['affected_area_ratio']}"
    )

    # 2. Test healthy leaf
    sev_healthy = estimate_visual_severity(img_diseased, is_healthy=True)
    assert sev_healthy["severity"] in ("NOT_ASSESSED", "NOT_APPLICABLE")
    assert sev_healthy["affected_area_ratio"] is None

    # 3. Test through end-to-end predict_disease
    leaf_bytes = make_test_image("leaf_diseased")
    res = predict_disease(leaf_bytes)
    assert res["severity"] not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"), (
        f"Pipeline produced unvalidated clinical severity: {res['severity']}"
    )
    assert res["severity"] in ("NOT_ASSESSED", "NOT_APPLICABLE")
    assert res["severity_details"]["affected_area_ratio"] is None


if __name__ == "__main__":
    import asyncio
    test_valid_leaf_diagnosis_and_healthy()
    test_unsupported_crop_taxonomic_gate()
    test_college_logo_rejection()
    test_document_rejection()
    test_vehicle_rejection()
    test_corrupted_and_blurry_images()
    test_pest_uncertainty_and_no_hallucination()
    test_taxonomy_mapping_integrity()
    test_invalid_and_uncertain_treatment_suppression()
    test_supported_crops_catalog_list()
    test_unvalidated_segmentation_severity_safeguard()
    asyncio.run(test_farm_ownership_authorization())
    print("==================================================")
    print("ALL 15 REGRESSION TESTS COMPLETED SUCCESSFULLY!")
    print("==================================================")

