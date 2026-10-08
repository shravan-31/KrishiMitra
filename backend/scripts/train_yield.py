"""
KrishiMitra — Yield Prediction Model Training

Trains a Gradient Boosting model for crop yield prediction.
Uses yield dataset with features: area, crop, season, state, district, crop_year.
Saves sklearn-compatible model to backend/models/yield/model.pkl
"""

import os
import json
import pathlib
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import r2_score

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent  # backend directory
WORKSPACE_DIR = BASE_DIR.parent.parent  # root AgriMind directory

candidate_paths = [
    BASE_DIR / "data" / "raw" / "yield" / "crop_production.csv",
    WORKSPACE_DIR / "Dataset" / "yield" / "crop_production.csv",
    pathlib.Path("Dataset/yield/crop_production.csv").resolve(),
    pathlib.Path("backend/data/raw/yield/crop_production.csv").resolve(),
    pathlib.Path("data/raw/yield/crop_production.csv").resolve(),
]
DATA_PATH = next((p for p in candidate_paths if p.exists()), candidate_paths[0])
MODEL_DIR = BASE_DIR / "models" / "yield"
REPORT_DIR = BASE_DIR / "data" / "reports"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def clean_and_train():
    print("=" * 60)
    print("YIELD DATA CLEANING & PREPROCESSING")
    print("=" * 60)

    if not DATA_PATH.exists():
        print(f"Error: Raw yield dataset not found at {DATA_PATH}")
        return

    df = pd.read_csv(DATA_PATH)
    raw_rows = len(df)
    print(f"Raw rows: {raw_rows}")

    # 1. Drop target nulls (Production) and Area nulls
    df = df.dropna(subset=["Production", "Area"])
    after_dropna = len(df)

    # 2. Remove zero yield or zero area
    df = df[(df["Area"] > 0) & (df["Production"] >= 0)]
    df["Yield"] = df["Production"] / df["Area"]
    df = df[df["Yield"] > 0]
    after_zero_yield = len(df)

    # 3. Remove extreme area (>10,000)
    df = df[df["Area"] <= 10000]
    after_extreme_area = len(df)

    # 4. Log-transform yield
    df["log_yield"] = np.log1p(df["Yield"])

    # 5. IQR outlier removal on Area and log_yield
    q1_area = df["Area"].quantile(0.25)
    q3_area = df["Area"].quantile(0.75)
    iqr_area = q3_area - q1_area
    lower_area = q1_area - 1.5 * iqr_area
    upper_area = q3_area + 1.5 * iqr_area

    q1_yield = df["log_yield"].quantile(0.25)
    q3_yield = df["log_yield"].quantile(0.75)
    iqr_yield = q3_yield - q1_yield
    lower_yield = q1_yield - 1.5 * iqr_yield
    upper_yield = q3_yield + 1.5 * iqr_yield

    df = df[(df["Area"] >= lower_area) & (df["Area"] <= upper_area)]
    df = df[(df["log_yield"] >= lower_yield) & (df["log_yield"] <= upper_yield)]
    after_iqr = len(df)

    print(f"After drop NaN: {after_dropna}")
    print(f"After zero yield check: {after_zero_yield}")
    print(f"After removing extreme area (>10,000): {after_extreme_area}")
    print(f"After IQR outlier removal: {after_iqr}")

    # Save cleaning report
    report_data = [
        {"step": "Raw rows", "value": raw_rows},
        {"step": "After drop NaN", "value": after_dropna},
        {"step": "After zero yield check", "value": after_zero_yield},
        {"step": "After removing extreme area", "value": after_extreme_area},
        {"step": "After IQR outlier removal", "value": after_iqr}
    ]
    pd.DataFrame(report_data).to_csv(REPORT_DIR / "yield_cleaning_report.csv", index=False)

    # Encode categorical variables
    categorical_cols = ["State_Name", "District_Name", "Season", "Crop"]
    label_encoders = {}

    for col in categorical_cols:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le

    # Save label encoders
    with open(MODEL_DIR / "label_encoders.pkl", "wb") as f:
        pickle.dump(label_encoders, f)

    # Save feature names
    feature_cols = ["State_Name", "District_Name", "Crop_Year", "Season", "Crop", "Area"]
    with open(MODEL_DIR / "feature_names.json", "w") as f:
        json.dump(feature_cols, f, indent=2)

    X = df[feature_cols]
    y = df["log_yield"]

    # If dataset is too large, sample it to ensure fast training on CPU (around 30k rows is plenty for a great fit)
    if len(X) > 30000:
        df_sampled = df.sample(n=30000, random_state=42)
        X_train_val = df_sampled[feature_cols]
        y_train_val = df_sampled["log_yield"]
    else:
        X_train_val = X
        y_train_val = y

    X_train, X_test, y_train, y_test = train_test_split(
        X_train_val, y_train_val, test_size=0.2, random_state=42
    )

    print("\n" + "=" * 60)
    print("TRAINING GRADIENT BOOSTING REGRESSOR")
    print("=" * 60)
    print(f"Train size: {len(X_train)} | Test size: {len(X_test)}")

    model = GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=6,
        random_state=42
    )
    model.fit(X_train, y_train)

    from sklearn.metrics import mean_absolute_error, mean_squared_error
    y_pred = model.predict(X_test)
    r2 = float(r2_score(y_test, y_pred))
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

    metrics = {
        "r2_score": round(r2, 4),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "test_samples": len(y_test),
        "residual_std": round(float(np.std(y_test - y_pred)), 4)
    }

    print(f"Actual Test R2 Score: {r2:.4f}")
    print(f"Actual Test MAE:      {mae:.4f}")
    print(f"Actual Test RMSE:     {rmse:.4f}")
    with open(MODEL_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    # Save trained model
    with open(MODEL_DIR / "model.pkl", "wb") as f:
        pickle.dump(model, f)
    
    print(f"Saved model and assets to {MODEL_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    clean_and_train()
