"""
Runner script for AgriMind backend automated tests.
Executes test functions and produces detailed test reports.
"""

import os
import sys
import traceback

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

def run():
    print("=" * 60)
    print("RUNNING AGRIMIND AUTOMATED AUDIT & FIX TESTS")
    print("=" * 60)

    try:
        from tests.test_all_fixes import (
            test_disease_model_top5_and_ood,
            test_pest_model_top5_and_ood,
            test_soil_model_and_bounds,
            test_yield_prediction_interval_and_district,
            test_mandi_parsing_and_lstm_crops,
            test_scheduler_dedup_and_dynamic_health,
            test_krishimitra_safety_prompt_rules,
            test_no_randomness_in_business_modules
        )
        from tests.test_diagnosis_pipeline import (
            test_valid_leaf_diagnosis_and_healthy,
            test_unsupported_crop_taxonomic_gate,
            test_college_logo_rejection,
            test_document_rejection,
            test_vehicle_rejection,
            test_corrupted_and_blurry_images,
            test_pest_uncertainty_and_no_hallucination,
            test_taxonomy_mapping_integrity,
            test_invalid_and_uncertain_treatment_suppression,
            test_supported_crops_catalog_list,
            test_farm_ownership_authorization,
            test_unvalidated_segmentation_severity_safeguard
        )
    except Exception as e:
        print(f"FAILED TO IMPORT TESTS: {e}")
        traceback.print_exc(file=sys.stdout)
        return False

    import asyncio

    tests = [
        ("Disease Model Top-5 & OOD", test_disease_model_top5_and_ood),
        ("Pest Model Top-5 & OOD", test_pest_model_top5_and_ood),
        ("Soil ML & Bounds Validation", test_soil_model_and_bounds),
        ("Yield Prediction Interval & District", test_yield_prediction_interval_and_district),
        ("Mandi Parser & LSTM Crop Enforce", test_mandi_parsing_and_lstm_crops),
        ("Scheduler Dedup & Dynamic Health", test_scheduler_dedup_and_dynamic_health),
        ("KrishiMitra Pesticide Guardrails", test_krishimitra_safety_prompt_rules),
        ("Deterministic Business Logic Audit", test_no_randomness_in_business_modules),
        ("Diagnosis Pipeline: Valid Leaf", test_valid_leaf_diagnosis_and_healthy),
        ("Diagnosis Pipeline: Unsupported Crop Gate", test_unsupported_crop_taxonomic_gate),
        ("Diagnosis Pipeline: College Logo Rejection", test_college_logo_rejection),
        ("Diagnosis Pipeline: Document Sheet Rejection", test_document_rejection),
        ("Diagnosis Pipeline: Vehicle / Non-plant Rejection", test_vehicle_rejection),
        ("Diagnosis Pipeline: Corrupt & Blur Validation", test_corrupted_and_blurry_images),
        ("Diagnosis Pipeline: Pest Presence & Uncertainty", test_pest_uncertainty_and_no_hallucination),
        ("Diagnosis Pipeline: Taxonomy Mapping Integrity", test_taxonomy_mapping_integrity),
        ("Diagnosis Pipeline: Treatment & Integration Protection", test_invalid_and_uncertain_treatment_suppression),
        ("Diagnosis Pipeline: Supported Crops Catalog List", test_supported_crops_catalog_list),
        ("Diagnosis Pipeline: Farm Ownership Authorization", test_farm_ownership_authorization),
        ("Diagnosis Pipeline: Severity Safeguard & Area Ratio", test_unvalidated_segmentation_severity_safeguard),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        try:
            if asyncio.iscoroutinefunction(test_fn):
                asyncio.run(test_fn())
            else:
                test_fn()
            print(f"[PASS] {name}")
            passed += 1
        except Exception as ex:
            print(f"[FAIL] {name}: {ex}")
            traceback.print_exc()
            failed += 1

    print("=" * 60)
    print(f"RESULTS: Passed: {passed} | Failed: {failed} | Total: {len(tests)}")
    print("=" * 60)
    return failed == 0

if __name__ == "__main__":
    success = run()
    sys.exit(0 if success else 1)
