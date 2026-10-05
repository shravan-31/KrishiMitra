"""
Soil Analysis Model
  Model:   XGBoost Classifier
  Dataset: Kaggle crop-recommendation (N,P,K,temp,humidity,pH,rainfall→crop)
  Output:  backend/models/soil/model.pkl
  Target:  Accuracy >= 92%

Dataset download:
  kaggle datasets download -d atharvaingle/crop-recommendation-dataset
  unzip to: backend/data/raw/soil/Crop_recommendation.csv
"""

import json, pathlib, pickle
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier

DATA_PATH  = pathlib.Path("backend/data/raw/soil/Crop_recommendation.csv")
MODEL_DIR  = pathlib.Path("backend/models/soil")
REPORT_DIR = pathlib.Path("backend/data/reports")
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

# ── STEP 1: LOAD + CLEAN ─────────────────────────────────────────────────
print("=" * 50)
print("SOIL DATA CLEANING")
print("=" * 50)

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

# Rule 5: Fill missing numerics with median
for col in numeric_cols:
    median = df[col].median()
    df[col] = df[col].fillna(median)

# Rule 6: Feature correlation check — drop if |corr| > 0.95
corr_matrix = df[numeric_cols].corr().abs()
upper = corr_matrix.where(
    np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
to_drop = [c for c in upper.columns
           if any(upper[c] > 0.95)]
if to_drop:
    df = df.drop(columns=to_drop)
    drop_report.append(f"Dropped high-corr features: {to_drop}")
    numeric_cols = [c for c in numeric_cols if c not in to_drop]

print("\n".join(drop_report))
print(f"\nFinal clean rows: {len(df)}")

# Save cleaned data
clean_path = pathlib.Path("backend/data/cleaned/soil")
clean_path.mkdir(parents=True, exist_ok=True)
df.to_csv(clean_path / "Crop_recommendation_cleaned.csv", index=False)

# Save cleaning report
pd.DataFrame({"step": drop_report}).to_csv(
    REPORT_DIR / "soil_cleaning_report.csv", index=False)

# ── STEP 2: ENCODE + SPLIT ───────────────────────────────────────────────
le = LabelEncoder()
df['label_enc'] = le.fit_transform(df['label'])

X = df[numeric_cols].values
y = df['label_enc'].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.15, stratify=y, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(
    X_train, y_train, test_size=0.15/(0.70+0.15),
    stratify=y_train, random_state=42)

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
    use_label_encoder=False,
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
cv_scores = cross_val_score(model, X, y, cv=cv,
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
