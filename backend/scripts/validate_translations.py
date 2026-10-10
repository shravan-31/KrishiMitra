"""
KrishiMitra Automated Translation and Catalog Validation Script
Verifies completeness, key parity, interpolation variables, and domain codes
across English (en.json), Marathi (mr.json), Hindi (hi.json), and translations_catalog.json.
"""
import os
import sys
import json
import re
from typing import Dict, Any, List, Set, Tuple

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(BACKEND_ROOT, ".."))

EN_LOCALE_PATH = os.path.join(REPO_ROOT, "frontend", "src", "i18n", "locales", "en.json")
MR_LOCALE_PATH = os.path.join(REPO_ROOT, "frontend", "src", "i18n", "locales", "mr.json")
HI_LOCALE_PATH = os.path.join(REPO_ROOT, "frontend", "src", "i18n", "locales", "hi.json")
CATALOG_PATH = os.path.join(BACKEND_ROOT, "app", "data", "translations_catalog.json")


def extract_flattened_keys(data: Dict[str, Any], prefix: str = "") -> Dict[str, str]:
    """Flattens nested JSON dictionaries into dot-separated paths."""
    flattened = {}
    for k, v in data.items():
        curr_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            flattened.update(extract_flattened_keys(v, prefix=curr_key))
        else:
            flattened[curr_key] = str(v)
    return flattened


def extract_placeholders(text: str) -> Set[str]:
    """Extracts i18next mustache interpolation tags like {{var}}."""
    return set(re.findall(r"\{\{([a-zA-Z0-9_]+)\}\}", text))


def validate_catalog() -> Dict[str, Any]:
    """Validates backend translations_catalog.json for all domain codes and 3 languages."""
    if not os.path.exists(CATALOG_PATH):
        return {"error": f"Catalog not found at {CATALOG_PATH}"}

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    langs = {"en", "mr", "hi"}
    issues = []

    # Expected sections
    required_sections = ["crops", "pests", "severities", "statuses"]
    for sec in required_sections:
        if sec not in catalog:
            issues.append(f"Missing catalog section: '{sec}'")
            continue
        for code, trans in catalog[sec].items():
            if not isinstance(trans, dict):
                issues.append(f"Invalid entry in '{sec}.{code}': must be dict")
                continue
            missing_langs = langs - set(trans.keys())
            if missing_langs:
                issues.append(f"Incomplete translations for '{sec}.{code}': missing {missing_langs}")
            for l in langs:
                if l in trans and not trans[l].strip():
                    issues.append(f"Empty translation for '{sec}.{code}.{l}'")

    # Verify 14 crops presence
    expected_crops = [
        "Apple", "Blueberry", "Cherry", "Corn", "Grape", "Orange", "Peach",
        "Bell Pepper", "Potato", "Raspberry", "Soybean", "Squash", "Strawberry", "Tomato"
    ]
    crops_in_catalog = set(catalog.get("crops", {}).keys())
    for exp in expected_crops:
        if exp not in crops_in_catalog:
            issues.append(f"Crop '{exp}' missing from backend translations catalog")

    # Verify 15 pests presence
    expected_pests = [
        "Aphids", "Armyworm", "Bollworm", "Cutworm", "Fruit_Fly", "Grasshopper",
        "Leaf_Miner", "Mealybugs", "Nematodes", "Scale_Insects", "Spider_Mites",
        "Stem_Borer", "Termites", "Thrips", "Whitefly"
    ]
    pests_in_catalog = set(catalog.get("pests", {}).keys())
    for exp in expected_pests:
        if exp not in pests_in_catalog:
            issues.append(f"Pest '{exp}' missing from backend translations catalog")

    # Verify statuses
    expected_statuses = [
        "VALID", "INVALID_IMAGE", "NO_SUPPORTED_PLANT_DETECTED", "UNKNOWN_CROP",
        "UNCERTAIN", "HEALTHY", "DISEASE_DETECTED", "PEST_DETECTED",
        "NO_PEST_DETECTED", "UNSUPPORTED_ANALYSIS"
    ]
    statuses_in_catalog = set(catalog.get("statuses", {}).keys())
    for exp in expected_statuses:
        if exp not in statuses_in_catalog:
            issues.append(f"Status code '{exp}' missing from backend translations catalog")

    return {
        "status": "PASS" if not issues else "FAIL",
        "total_issues": len(issues),
        "issues": issues,
        "crops_count": len(crops_in_catalog),
        "pests_count": len(pests_in_catalog),
        "statuses_count": len(statuses_in_catalog),
        "severities_count": len(catalog.get("severities", {}).keys()),
    }


def validate_frontend_locales() -> Dict[str, Any]:
    """Validates English, Marathi, and Hindi frontend JSON files for key parity and formatting."""
    with open(EN_LOCALE_PATH, "r", encoding="utf-8") as f:
        en_data = json.load(f)
    with open(MR_LOCALE_PATH, "r", encoding="utf-8") as f:
        mr_data = json.load(f)
    with open(HI_LOCALE_PATH, "r", encoding="utf-8") as f:
        hi_data = json.load(f)

    flat_en = extract_flattened_keys(en_data)
    flat_mr = extract_flattened_keys(mr_data)
    flat_hi = extract_flattened_keys(hi_data)

    keys_en = set(flat_en.keys())
    keys_mr = set(flat_mr.keys())
    keys_hi = set(flat_hi.keys())

    missing_in_mr = sorted(list(keys_en - keys_mr))
    missing_in_hi = sorted(list(keys_en - keys_hi))
    extra_in_mr = sorted(list(keys_mr - keys_en))
    extra_in_hi = sorted(list(keys_hi - keys_en))

    empty_values_en = [k for k, v in flat_en.items() if not v.strip()]
    empty_values_mr = [k for k, v in flat_mr.items() if not v.strip()]
    empty_values_hi = [k for k, v in flat_hi.items() if not v.strip()]

    placeholder_mismatches = []
    for k in keys_en:
        val_en = flat_en[k]
        if "{{" in val_en:
            if k in flat_mr and k in flat_hi:
                p_en = extract_placeholders(val_en)
                p_mr = extract_placeholders(flat_mr[k])
                p_hi = extract_placeholders(flat_hi[k])
                if p_en != p_mr:
                    placeholder_mismatches.append(f"Placeholder mismatch in Marathi at '{k}': expected {p_en}, got {p_mr}")
                if p_en != p_hi:
                    placeholder_mismatches.append(f"Placeholder mismatch in Hindi at '{k}': expected {p_en}, got {p_hi}")

    total_keys = len(keys_en)
    mr_coverage = round(len(keys_en - set(missing_in_mr)) / total_keys * 100, 2)
    hi_coverage = round(len(keys_en - set(missing_in_hi)) / total_keys * 100, 2)

    return {
        "status": "PASS" if not (missing_in_mr or missing_in_hi or placeholder_mismatches) else "FAIL",
        "total_en_keys": total_keys,
        "total_mr_keys": len(keys_mr),
        "total_hi_keys": len(keys_hi),
        "mr_coverage_pct": mr_coverage,
        "hi_coverage_pct": hi_coverage,
        "missing_in_mr_count": len(missing_in_mr),
        "missing_in_hi_count": len(missing_in_hi),
        "missing_in_mr_samples": missing_in_mr[:10],
        "missing_in_hi_samples": missing_in_hi[:10],
        "empty_en_keys": empty_values_en,
        "empty_mr_keys": empty_values_mr,
        "empty_hi_keys": empty_values_hi,
        "placeholder_mismatches_count": len(placeholder_mismatches),
        "placeholder_mismatches": placeholder_mismatches[:10],
    }


def run_full_validation() -> Dict[str, Any]:
    catalog_res = validate_catalog()
    locales_res = validate_frontend_locales()
    overall_pass = (catalog_res.get("status") == "PASS") and (locales_res.get("status") == "PASS")
    return {
        "overall_status": "PASS" if overall_pass else "FAIL",
        "catalog_validation": catalog_res,
        "locale_validation": locales_res,
    }


if __name__ == "__main__":
    report = run_full_validation()
    print(json.dumps(report, indent=2, ensure_ascii=False))
