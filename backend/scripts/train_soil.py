"""
Soil Analysis Model
  Model:   XGBoost Classifier
  Dataset: Kaggle crop-recommendation (N,P,K,temp,humidity,pH,rainfall->crop)
  Output:  backend/models/soil/model.pkl
  Target:  Accuracy >= 92%
"""

import json, pathlib, pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent  # backend directory
WORKSPACE_DIR = BASE_DIR.parent.parent  # root AgriMind directory

candidate_paths = [
    WORKSPACE_DIR / "Dataset" / "crop_recommendation" / "Crop_recommendation.csv",
    BASE_DIR / "data" / "raw" / "soil" / "Crop_recommendation.csv",
    pathlib.Path("Dataset/crop_recommendation/Crop_recommendation.csv").resolve(),
    pathlib.Path("backend/data/raw/soil/Crop_recommendation.csv").resolve(),
    pathlib.Path("data/raw/soil/Crop_recommendation.csv").resolve(),
]
DATA_PATH = next((p for p in candidate_paths if p.exists()), candidate_paths[0])
MODEL_DIR = BASE_DIR / "models" / "soil"
REPORT_DIR = BASE_DIR / "data" / "reports"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def train_soil_model():
    # ── STEP 1: LOAD + CLEAN ─────────────────────────────────────────────────
    print("=" * 50)
    print("SOIL DATA CLEANING")
    print("=" * 50)
    print(f"Loading data from: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    original_len = len(df)
    print(f"Raw rows: {original_len}")

    drop_report = []

    # Rule 1: Remove duplicates
    df = df.drop_duplicates()
    drop_report.append(f"After dedup: {len(df)} rows")

    # Rule 2: Remove rows with NaN in label column
    df = df.dropna(subset=['label'])
    drop_report.append(f"After drop NaN label: {len(df)} rows")

    # Rule 3: Validate pH range
    invalid_ph = df[(df['ph'] < 0) | (df['ph'] > 14)]
    df = df[(df['ph'] >= 0) & (df['ph'] <= 14)]
    drop_report.append(f"Removed {len(invalid_ph)} invalid pH rows")

    # Rule 4: IQR outlier removal on numeric features
    numeric_cols = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
    before = len(df)
    for col in numeric_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        df = df[(df[col] >= Q1 - 1.5*IQR) & (df[col] <= Q3 + 1.5*IQR)]
    drop_report.append(f"After IQR outlier removal: {len(df)} rows "
                       f"(removed {before - len(df)})")

    # Rule 5: Min 50 samples per class
    class_counts = df['label'].value_counts()
    valid_classes = class_counts[class_counts >= 50].index
    dropped_classes = class_counts[class_counts < 50].index.tolist()
    df = df[df['label'].isin(valid_classes)]
    if dropped_classes:
        drop_report.append(f"Dropped classes (<50 samples): {dropped_classes}")

    print("\n".join(drop_report))
    print(f"Cleaned rows: {len(df)} across {df['label'].nunique()} classes")

    # Save cleaning report
    with open(REPORT_DIR / "soil_cleaning_report.csv", "w") as f:
        f.write("step,detail\n")
        for line in drop_report:
            f.write(f'"{line}",""\n')

    # ── STEP 2: SPLIT (70/15/15 stratified) ───────────────────────────────────
    X = df[numeric_cols]
    y = df['label']

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y_encoded, test_size=0.30, stratify=y_encoded, random_state=42)
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42)

    print(f"\nTrain: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

    # ── STEP 3: TRAIN XGBoost ────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("TRAINING XGBoost")
    print("=" * 50)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='mlogloss',
        random_state=42,
        n_jobs=1
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50
    )

    # ── STEP 4: EVALUATE ─────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred) * 100

    # 5-fold cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y_encoded, cv=cv,
                                 scoring='accuracy', n_jobs=1)

    print(f"\nTest Accuracy:  {test_acc:.2f}%")
    print(f"CV Accuracy:    {cv_scores.mean()*100:.2f}% ± {cv_scores.std()*100:.2f}%")
    print(f"Target: >=92%  ->  {'PASS' if test_acc >= 92 else 'FAIL'}")

    # ── STEP 5: SAVE ARTIFACTS ───────────────────────────────────────────────
    with open(MODEL_DIR / "model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(MODEL_DIR / "label_encoder.pkl", "wb") as f:
        pickle.dump(le, f)
    with open(MODEL_DIR / "feature_names.json", "w") as f:
        json.dump({"features": numeric_cols,
                   "classes": list(le.classes_),
                   "test_accuracy": test_acc,
                   "cv_accuracy": float(cv_scores.mean())}, f, indent=2)

    print(f"Saved to {MODEL_DIR}")
    return test_acc


if __name__ == "__main__":
    train_soil_model()
