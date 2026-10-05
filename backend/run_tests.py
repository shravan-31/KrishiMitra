"""
Runner script for AgriMind backend automated tests.
Executes test functions and produces detailed test reports.
"""

import sys
import traceback

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
    except Exception as e:
        print(f"FAILED TO IMPORT TESTS: {e}")
        traceback.print_exc()
        return False

    tests = [
        ("Disease Model Top-5 & OOD", test_disease_model_top5_and_ood),
        ("Pest Model Top-5 & OOD", test_pest_model_top5_and_ood),
        ("Soil ML & Bounds Validation", test_soil_model_and_bounds),
        ("Yield Prediction Interval & District", test_yield_prediction_interval_and_district),
        ("Mandi Parser & LSTM Crop Enforce", test_mandi_parsing_and_lstm_crops),
        ("Scheduler Dedup & Dynamic Health", test_scheduler_dedup_and_dynamic_health),
        ("KrishiMitra Pesticide Guardrails", test_krishimitra_safety_prompt_rules),
        ("Deterministic Business Logic Audit", test_no_randomness_in_business_modules),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        try:
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
