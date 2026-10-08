import os
import sys
import json
import torch
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))

import app.ml.pest as p_ml

p_ml.load_pest_model()
print("Model loaded successfully.")
print(f"Classes ({len(p_ml._classes)}):", p_ml._classes)

workspace_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
pest_dir = os.path.join(workspace_dir, "Dataset", "pest_detection")

# Test 1: Real Whitefly image
wf_dir = os.path.join(pest_dir, "Whitefly")
if os.path.exists(wf_dir) and os.listdir(wf_dir):
    img_path = os.path.join(wf_dir, os.listdir(wf_dir)[0])
    with open(img_path, "rb") as f:
        res = p_ml.predict_pest(f.read())
    print("\n--- TEST WHITEFLY IMAGE ---")
    print("Predicted:", res["pest_name"])
    print("Confidence:", res["confidence"])
    print("Is Uncertain:", res.get("is_uncertain"))
    print("Top 5:", [(p["label"], p["confidence"]) for p in res.get("top_predictions", [])])

# Test 2: Real Aphids image
aphid_dir = os.path.join(pest_dir, "Aphids")
if os.path.exists(aphid_dir) and os.listdir(aphid_dir):
    img_path = os.path.join(aphid_dir, os.listdir(aphid_dir)[0])
    with open(img_path, "rb") as f:
        res = p_ml.predict_pest(f.read())
    print("\n--- TEST APHIDS IMAGE ---")
    print("Predicted:", res["pest_name"])
    print("Confidence:", res["confidence"])
    print("Is Uncertain:", res.get("is_uncertain"))
    print("Top 5:", [(p["label"], p["confidence"]) for p in res.get("top_predictions", [])])

# Test 3: Plant Leaf (PlantVillage Tomato Early Blight)
pv_dir = os.path.join(workspace_dir, "Dataset", "PlantVillage", "Tomato___Early_blight")
if os.path.exists(pv_dir) and os.listdir(pv_dir):
    img_path = os.path.join(pv_dir, os.listdir(pv_dir)[0])
    with open(img_path, "rb") as f:
        res = p_ml.predict_pest(f.read())
    print("\n--- TEST PLANT LEAF ON PEST SCANNER (OOD) ---")
    print("Predicted:", res["pest_name"])
    print("Confidence:", res["confidence"])
    print("Is Uncertain:", res.get("is_uncertain"))
    print("Top 5:", [(p["label"], p["confidence"]) for p in res.get("top_predictions", [])])
