"""
KrishiMitra (AgriMind) — Master Retraining Suite for All AI/ML Models
Trains all 5 production models with maximum accuracy, class balancing, and validation:
  1. Crop Disease Detection (PlantVillage 38 Classes - MobileNetV2 with Differential Fine-Tuning)
  2. Insect Pest Detection (15 Classes - EfficientNet-B0)
  3. Soil Health & Crop Recommendation (XGBoost Classifier with 5-Fold Stratified CV)
  4. Crop Yield Predictor (Gradient Boosting Regressor with Log-Yield Scaling)
  5. Mandi Market Price Forecasting (PyTorch LSTM Time-Series)

Usage:
  python train_all_models.py                # Train all models sequentially
  python train_all_models.py --model disease # Train only disease model
  python train_all_models.py --model pest    # Train only pest model
  python train_all_models.py --model soil    # Train only soil model
  python train_all_models.py --model yield   # Train only yield model
  python train_all_models.py --model market  # Train only market model
"""

import os
import sys
import time
import json
import argparse
import pathlib

# Setup backend directory in path
SCRIPTS_DIR = pathlib.Path(__file__).resolve().parent
BACKEND_DIR = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(BACKEND_DIR))

# Ensure working directory is backend root
os.chdir(str(BACKEND_DIR))

REPORT_DIR = BACKEND_DIR / "data" / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def print_banner(title):
    print("\n" + "═" * 70)
    print(f"  🌱 {title}")
    print("═" * 70)


def train_disease_pipeline():
    print_banner("1/5: RETRAINING CROP DISEASE DETECTION MODEL")
    print("Architecture: MobileNetV2 (Differential Fine-Tuning on Top Residual Blocks)")
    print("Dataset:      PlantVillage (38 Classes)")
    print("Target:       Accuracy >= 94.0%")
    
    t0 = time.time()
    try:
        import train_disease
        train_disease.main()
        elapsed = time.time() - t0
        print(f"✓ Disease Model Training Completed in {elapsed:.1f}s")
        return {"status": "SUCCESS", "elapsed_seconds": round(elapsed, 1)}
    except Exception as e:
        print(f"❌ Disease Model Training Failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


def train_pest_pipeline():
    print_banner("2/5: RETRAINING INSECT PEST DETECTION MODEL")
    print("Architecture: EfficientNet-B0")
    print("Dataset:      IP102 / Pest Detection (15 Classes)")
    print("Target:       Accuracy >= 91.0%")
    
    t0 = time.time()
    try:
        import train_pest
        train_pest.clean_data()
        class_names = train_pest.save_class_names()
        train_pest.save_pest_control_map()
        train_loader, val_loader, test_loader = train_pest.build_dataloaders(class_names)
        model = train_pest.build_model(len(class_names))
        history, best_val = train_pest.train_model(model, train_loader, val_loader, class_names)
        test_acc = train_pest.evaluate_test(model, test_loader)
        
        elapsed = time.time() - t0
        print(f"\nFinal Test Accuracy: {test_acc:.2f}%")
        print(f"✓ Pest Model Training Completed in {elapsed:.1f}s")
        return {"status": "SUCCESS", "test_acc": test_acc, "elapsed_seconds": round(elapsed, 1)}
    except Exception as e:
        print(f"❌ Pest Model Training Failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


def train_soil_pipeline():
    print_banner("3/5: RETRAINING SOIL HEALTH & CROP RECOMMENDATION MODEL")
    print("Architecture: XGBoost Multi-Class Classifier")
    print("Dataset:      Kaggle Crop Recommendation (N, P, K, Temp, Humidity, pH, Rain)")
    print("Target:       Accuracy >= 92.0%")
    
    t0 = time.time()
    try:
        import train_soil
        acc = train_soil.train_soil_model()
        elapsed = time.time() - t0
        print(f"✓ Soil Model Training Completed in {elapsed:.1f}s (Accuracy: {acc:.2f}%)")
        return {"status": "SUCCESS", "test_acc": acc, "elapsed_seconds": round(elapsed, 1)}
    except Exception as e:
        print(f"❌ Soil Model Training Failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


def train_yield_pipeline():
    print_banner("4/5: RETRAINING CROP YIELD PREDICTOR MODEL")
    print("Architecture: Gradient Boosting Regressor")
    print("Dataset:      Crop Production Dataset with Log-Yield Scaling")
    print("Target:       R² Score >= 0.85")
    
    t0 = time.time()
    try:
        import train_yield
        train_yield.clean_and_train()
        elapsed = time.time() - t0
        print(f"✓ Yield Model Training Completed in {elapsed:.1f}s")
        return {"status": "SUCCESS", "elapsed_seconds": round(elapsed, 1)}
    except Exception as e:
        print(f"❌ Yield Model Training Failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


def train_market_pipeline():
    print_banner("5/5: RETRAINING MANDI MARKET PRICE PREDICTION MODEL")
    print("Architecture: PyTorch LSTM Time-Series Model")
    print("Dataset:      Mandi Agricultural Commodity Prices")
    print("Target:       Multi-step Modal Price Forecasting")
    
    t0 = time.time()
    try:
        import train_market
        train_market.train_model()
        elapsed = time.time() - t0
        print(f"✓ Market Model Training Completed in {elapsed:.1f}s")
        return {"status": "SUCCESS", "elapsed_seconds": round(elapsed, 1)}
    except Exception as e:
        print(f"❌ Market Model Training Failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


def run_full_model_audit():
    print_banner("RUNNING FULL POST-TRAINING INFERENCE AUDIT")
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, str(BACKEND_DIR / "test_models_audit.py")],
            cwd=str(BACKEND_DIR),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return {"status": "SUCCESS" if result.returncode == 0 else "PARTIAL"}
    except Exception as e:
        print(f"Audit could not execute: {e}")
        return {"status": "FAILED", "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="KrishiMitra Retrain All Models Suite")
    parser.add_argument(
        "--model",
        choices=["all", "disease", "pest", "soil", "yield", "market"],
        default="all",
        help="Select which model to retrain (default: all)"
    )
    args = parser.parse_args()

    overall_start = time.time()
    summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "models": {}
    }

    if args.model in ["all", "disease"]:
        summary["models"]["disease"] = train_disease_pipeline()

    if args.model in ["all", "pest"]:
        summary["models"]["pest"] = train_pest_pipeline()

    if args.model in ["all", "soil"]:
        summary["models"]["soil"] = train_soil_pipeline()

    if args.model in ["all", "yield"]:
        summary["models"]["yield"] = train_yield_pipeline()

    if args.model in ["all", "market"]:
        summary["models"]["market"] = train_market_pipeline()

    # Post-training audit across all models
    summary["audit"] = run_full_model_audit()
    summary["total_runtime_seconds"] = round(time.time() - overall_start, 1)

    summary_file = REPORT_DIR / "all_models_retraining_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print_banner("ALL TRAINING COMPLETED")
    print(f"Summary report generated at: {summary_file}")
    print(f"Total time elapsed: {summary['total_runtime_seconds']}s")


if __name__ == "__main__":
    main()
