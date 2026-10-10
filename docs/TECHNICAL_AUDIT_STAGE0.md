# KrishiMitra — Technical Baseline & Architecture Audit (Stage 0)

**Date:** October 10, 2026  
**Audited Location:** `D:\AgriMind\agri-intelligence`  
**Git Branch:** `main`  
**Last Verified Commit:** `d3c6b34baa3eb8b00365aa17c5750bf82073c710` (Fix crop disease & pest remedies)  

---

## 1. Existing System Behavior & File Map

### A. Deep Learning & Machine Learning Modules
1. **Disease Detection & Crop Identification:**
   - Inference file: [`backend/app/ml/disease.py`](file:///d:/AgriMind/agri-intelligence/backend/app/ml/disease.py)
   - Gate validator: [`backend/app/ml/validator.py`](file:///d:/AgriMind/agri-intelligence/backend/app/ml/validator.py)
   - Crop routing gate: [`backend/app/ml/crop_classifier.py`](file:///d:/AgriMind/agri-intelligence/backend/app/ml/crop_classifier.py)
   - Model weights: `backend/models/plantvillage/model.pth` (~11.8 MB MobileNetV2)
   - Classes file: `backend/models/plantvillage/class_names.json` (38 classes)
   - Preprocessing: `transforms.Compose([Resize((224, 224)), ToTensor(), Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])])`
   - Supported crops: Exactly 14 crops (Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Bell Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato).

2. **Pest Classification:**
   - Inference file: [`backend/app/ml/pest.py`](file:///d:/AgriMind/agri-intelligence/backend/app/ml/pest.py)
   - Model weights: `backend/models/pest/model.pth` (~18.9 MB EfficientNet-B0)
   - Classes file: `backend/models/pest/class_names.json` (15 insect classes)
   - Preprocessing: `transforms.Compose([Resize((224, 224)), ToTensor(), Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])])`
   - Model nature: Closed-set 15-class insect classifier. **Lacks a background/healthy negative class or bounding-box object detector.**

3. **Ancillary Agricultural ML Models:**
   - Soil crop recommendation: `backend/app/ml/soil.py` (`backend/models/soil/model.pkl`, XGBoost classifier across 22 crops)
   - Yield prediction: `backend/app/ml/yield_pred.py` (`backend/models/yield/model.pkl`, GradientBoostingRegressor)
   - APMC Mandi forecast: `backend/app/ml/market.py` (`backend/models/market/model.pt`, PyTorch 2-layer LSTM)

### B. Routers & Downstream Integration
1. **Disease Router:** [`backend/app/routers/disease.py`](file:///d:/AgriMind/agri-intelligence/backend/app/routers/disease.py)
   - Endpoint `/api/v1/disease/scan`: Accepts multipart form (`farm_id`, `file`).
   - Endpoint `/api/v1/disease/supported-crops`: Returns the 14 verified crops.
   - Endpoint `/api/v1/disease/history/{farm_id}`: Returns past scans for authorized farm.
   - Farm authorization: Enforced via `verify_farm_access(farm_id, user_id, db)`.
2. **Pest Router:** [`backend/app/routers/pest.py`](file:///d:/AgriMind/agri-intelligence/backend/app/routers/pest.py)
   - Endpoint `/api/v1/pest/detect`: Accepts multipart form (`farm_id`, `file`).
   - Endpoint `/api/v1/pest/history/{farm_id}`: Returns past pest detections.
   - Farm authorization: Enforced via `verify_farm_access(farm_id, user_id, db)`.
3. **Integration Engine:** [`backend/app/integration_engine.py`](file:///d:/AgriMind/agri-intelligence/backend/app/integration_engine.py)
   - Manages cascading updates: `on_disease_detected`, `on_pest_detected`, `update_health_score`.
   - Modifies `farms.health_score`, creates records in `alerts`, and schedules `crop_calendar` tasks.

### C. Frontend & Localization
1. **Pages:**
   - [`frontend/src/pages/Disease.jsx`](file:///d:/AgriMind/agri-intelligence/frontend/src/pages/Disease.jsx): Disease scanning, camera capture, tabbed diagnosis/treatment/schedule.
   - [`frontend/src/pages/Pest.jsx`](file:///d:/AgriMind/agri-intelligence/frontend/src/pages/Pest.jsx): Insect scanning, camera capture, control advice.
2. **Locales:**
   - English: [`frontend/src/i18n/locales/en.json`](file:///d:/AgriMind/agri-intelligence/frontend/src/i18n/locales/en.json) (~1,106 lines)
   - Marathi: [`frontend/src/i18n/locales/mr.json`](file:///d:/AgriMind/agri-intelligence/frontend/src/i18n/locales/mr.json) (~1,106 lines)
   - Hindi: [`frontend/src/i18n/locales/hi.json`](file:///d:/AgriMind/agri-intelligence/frontend/src/i18n/locales/hi.json) (~1,106 lines)
   - Backend catalog: [`backend/app/data/translations_catalog.json`](file:///d:/AgriMind/agri-intelligence/backend/app/data/translations_catalog.json)

---

## 2. Confirmed Bugs vs. Unverified Risks

| Risk / Finding | Status | Technical Cause & Impact |
|:---|:---|:---|
| **Disease Severity Coupling** | **Confirmed Bug** | Visual lesion severity was estimated via raw RGB color thresholding (brown/yellow pixel ratios). Leaves with natural yellow veins, soil dust, or shadowed lighting are falsely escalated to `MEDIUM` or `HIGH` severity. Must be decoupled and marked `NOT_ASSESSED` or clearly flagged as an experimental visual indicator. |
| **Pest Negative Absence** | **Confirmed Bug** | Active model `models/pest/model.pth` is an insect-only classifier. Claiming `NO_PEST_DETECTED` based on low top-1 confidence is scientifically invalid. The system must report `UNCERTAIN` and explain that a dedicated detector is needed for negative verification. |
| **Missing Model Evaluation Suite** | **Confirmed Risk** | No automated evaluation harness exists that loads labeled test splits and computes macro-F1, confusion matrices, false positive rates, and out-of-distribution selective risk. |
| **Backend-Rendered English Text** | **Confirmed Bug** | Several API return fields (`message`, `recommendation`, `reason`) were returning pre-rendered English strings instead of structured machine codes (`status_code`, `disease_code`, `crop_code`) mapped through the client localization catalog. |
| **Downstream Mutation Safety** | **Remediated** | Early returns were added to routers to prevent invalid/uncertain scans from writing to `alerts`, `disease_scans`, or updating `farm_health`. Must be enforced continuously with comprehensive regression tests. |

---

## 3. Available Labeled Datasets & Image Fixtures

- **PlantVillage Dataset:** `D:\AgriMind\Dataset\PlantVillage` (38 classes, 14 crops, >50,000 real leaf photographs).
- **Pest Detection Dataset:** `D:\AgriMind\Dataset\pest_detection` (15 classes, >1,200 real insect photographs).
- **Non-Plant & Edge Cases:** Synthetic test fixtures generated programmatically in test suites (logos, documents, vehicles, blurry frames).
- **Missing Labeled Assets:**
  - Expert-annotated pixel-level leaf lesion masks for clinical disease severity validation.
  - Multi-class insect bounding-box dataset (e.g. YOLO format) for pest object detection.
  - Labeled dataset of non-PlantVillage Indian field crops (e.g. Sugarcane, Cotton, Pigeonpea).

---

## 4. Current Test Baseline

- Test files:
  - [`backend/tests/test_all_fixes.py`](file:///d:/AgriMind/agri-intelligence/backend/tests/test_all_fixes.py)
  - [`backend/tests/test_diagnosis_pipeline.py`](file:///d:/AgriMind/agri-intelligence/backend/tests/test_diagnosis_pipeline.py)
- Runner: [`backend/run_tests.py`](file:///d:/AgriMind/agri-intelligence/backend/run_tests.py)
- Reported baseline: 19 passed tests covering top-5 outputs, input boundaries, logo rejection, Rose gating, pest uncertainty, and farm ownership.
