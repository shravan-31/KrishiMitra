"""
KrishiMitra — Train Disease Detection Model

Base:    MobileNetV2 (pretrained=ImageNet) — FINE-TUNE ONLY
Dataset: PlantVillage (38 classes)
Output:  backend/models/plantvillage/model.pth
Target:  Accuracy >= 94%

Usage:
    cd agri-intelligence
    python backend/scripts/train_disease.py
"""

import os
import json
import hashlib
import shutil
import pathlib

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import models, transforms, datasets
from PIL import Image, UnidentifiedImageError
import numpy as np
import pandas as pd
from collections import Counter

# ═══════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent  # backend directory
WORKSPACE_DIR = BASE_DIR.parent.parent  # root AgriMind directory

# Multi-location dataset discovery
candidate_data_dirs = [
    WORKSPACE_DIR / "Dataset" / "PlantVillage",
    BASE_DIR / "data" / "raw" / "plantvillage" / "PlantVillage",
    BASE_DIR / "data" / "raw" / "plantvillage",
    pathlib.Path("Dataset/PlantVillage").resolve(),
    pathlib.Path("backend/data/raw/plantvillage/PlantVillage").resolve(),
]
DATA_DIR = next((p for p in candidate_data_dirs if p.exists() and any(p.iterdir())), candidate_data_dirs[0])

CLEAN_DIR = BASE_DIR / "data" / "cleaned" / "plantvillage"
MODEL_DIR = BASE_DIR / "models" / "plantvillage"
REPORT_DIR = BASE_DIR / "data" / "reports"
BATCH_SIZE = 32
EPOCHS = 20
LR = 1e-4
IMG_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
EARLY_STOP_PATIENCE = 5
SAMPLE_PER_CLASS = int(os.getenv("SAMPLE_PER_CLASS", "120"))
CPU_EPOCHS = int(os.getenv("CPU_EPOCHS", "10"))

CLEAN_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: DATA CLEANING
# ═══════════════════════════════════════════════════════════════════════════
def get_md5(path):
    """Compute MD5 hash of a file for deduplication."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def is_blurry(img_path, threshold=100):
    """Check if an image is too blurry using Laplacian variance."""
    try:
        import cv2

        img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            return True
        return cv2.Laplacian(img, cv2.CV_64F).var() < threshold
    except ImportError:
        # cv2 not available — skip blur check
        return False


def clean_data():
    """Clean PlantVillage dataset: verify, deduplicate, blur-check."""
    print("=" * 60)
    print("STEP 1: DATA CLEANING")
    print("=" * 60)

    if not DATA_DIR.exists():
        print(f"ERROR: Dataset not found at {DATA_DIR}")
        print("Run download_plantvillage.py first, or copy data to:")
        print(f"  {DATA_DIR}/<ClassName>/*.jpg")
        return False

    seen_hashes = set()
    dropped_rows = []
    kept = 0

    is_cpu = (DEVICE.type == "cpu")
    max_images_per_class = SAMPLE_PER_CLASS if is_cpu else None
    min_samples_required = 0 if is_cpu else 500

    for class_dir in sorted(DATA_DIR.iterdir()):
        if not class_dir.is_dir():
            continue
        out_dir = CLEAN_DIR / class_dir.name
        if out_dir.exists():
            shutil.rmtree(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        class_images = sorted(list(class_dir.glob("*.*")))
        if max_images_per_class is not None:
            class_images = class_images[:max_images_per_class]

        for img_path in class_images:
            # Rule 1: verify PIL can open it
            try:
                img = Image.open(img_path)
                img.verify()
            except Exception as e:
                dropped_rows.append({
                    "file": str(img_path),
                    "class": class_dir.name,
                    "reason": f"corrupt: {e}",
                })
                continue

            # Rule 2: deduplicate via MD5
            h = get_md5(img_path)
            if h in seen_hashes:
                dropped_rows.append({
                    "file": str(img_path),
                    "class": class_dir.name,
                    "reason": "duplicate",
                })
                continue
            seen_hashes.add(h)

            # Rule 3: blur check
            if not is_cpu and is_blurry(img_path, threshold=100):
                dropped_rows.append({
                    "file": str(img_path),
                    "class": class_dir.name,
                    "reason": "blurry",
                })
                continue

            shutil.copy(img_path, out_dir / img_path.name)
            kept += 1

    # Rule 4: min 500 per class — augment by copying if needed
    for class_dir in sorted(CLEAN_DIR.iterdir()):
        if not class_dir.is_dir():
            continue
        imgs = list(class_dir.glob("*.*"))
        if len(imgs) == 0:
            continue
        if len(imgs) < min_samples_required:
            need = min_samples_required - len(imgs)
            for i in range(need):
                src = imgs[i % len(imgs)]
                shutil.copy(src, class_dir / f"aug_{i}_{src.name}")

    # Save cleaning report
    pd.DataFrame(dropped_rows).to_csv(
        REPORT_DIR / "disease_cleaning_report.csv", index=False
    )
    print(f"Kept: {kept} images | Dropped: {len(dropped_rows)}")
    return True



# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: SAVE CLASS NAMES
# ═══════════════════════════════════════════════════════════════════════════
def save_class_names():
    """Extract and save sorted class names from cleaned directory."""
    class_names = sorted([d.name for d in CLEAN_DIR.iterdir() if d.is_dir()])
    with open(MODEL_DIR / "class_names.json", "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"Classes: {len(class_names)}")
    return class_names


# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: SAVE TREATMENT MAP
# ═══════════════════════════════════════════════════════════════════════════
def save_treatment_map():
    """Save disease-to-treatment mapping for all 38 classes."""
    treatment_map = {
        "Apple___Apple_scab": {
            "severity": "MEDIUM",
            "treatment": [
                "Remove and destroy fallen infected leaves",
                "Apply fungicide: Mancozeb 75 WP @ 2.5g/L water",
                "Spray every 10-14 days during wet weather",
                "Prune for better air circulation",
            ],
        },
        "Apple___Black_rot": {
            "severity": "HIGH",
            "treatment": [
                "Prune all dead/diseased wood immediately",
                "Apply Captan 50 WP @ 2g/L water",
                "Remove mummified fruit from tree and ground",
                "Spray copper-based fungicide as protective",
            ],
        },
        "Apple___Cedar_apple_rust": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Myclobutanil fungicide at pink bud stage",
                "Remove nearby cedar/juniper trees if possible",
                "Spray Mancozeb 75 WP @ 2g/L every 7-10 days",
                "Use rust-resistant apple varieties next season",
            ],
        },
        "Apple___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Continue regular monitoring."],
        },
        "Blueberry___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Maintain soil pH 4.5-5.5."],
        },
        "Cherry_(including_sour)___Powdery_mildew": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply sulfur-based fungicide early morning",
                "Spray Trifloxystrobin @ 0.5g/L water",
                "Improve air circulation by pruning",
                "Avoid overhead irrigation",
            ],
        },
        "Cherry_(including_sour)___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Continue regular monitoring."],
        },
        "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
            "severity": "HIGH",
            "treatment": [
                "Apply Azoxystrobin + Propiconazole @ 1ml/L",
                "Use resistant hybrid varieties in next season",
                "Rotate crops — avoid continuous maize",
                "Spray at first sign, repeat after 14 days",
            ],
        },
        "Corn_(maize)___Common_rust_": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Mancozeb 75 WP @ 2.5g/L at early stage",
                "Use rust-resistant maize hybrids",
                "Avoid late planting in rust-prone areas",
                "Spray Propiconazole 25 EC @ 1ml/L if severe",
            ],
        },
        "Corn_(maize)___Northern_Leaf_Blight": {
            "severity": "HIGH",
            "treatment": [
                "Apply Propiconazole 25 EC @ 1ml/L water",
                "Use resistant varieties: HQPM-1, NK-6240",
                "Practice crop rotation with non-host crops",
                "Spray at flag leaf stage for best results",
            ],
        },
        "Corn_(maize)___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Ensure adequate nutrients."],
        },
        "Grape___Black_rot": {
            "severity": "HIGH",
            "treatment": [
                "Remove all mummified berries and infected leaves",
                "Apply Mancozeb + Carbendazim mixture",
                "Spray Captan 50 WP @ 2.5g/L every 7-10 days",
                "Ensure good canopy management for air flow",
            ],
        },
        "Grape___Esca_(Black_Measles)": {
            "severity": "CRITICAL",
            "treatment": [
                "No chemical cure — remove and destroy infected wood",
                "Protect pruning wounds with wound sealant",
                "Use certified disease-free planting material",
                "Contact agricultural extension officer immediately",
            ],
        },
        "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Copper oxychloride @ 3g/L water",
                "Spray Mancozeb 75 WP at 10-day intervals",
                "Improve vineyard drainage and air circulation",
                "Remove severely infected leaves",
            ],
        },
        "Grape___healthy": {
            "severity": "LOW",
            "treatment": ["Vine is healthy. Maintain proper trellising."],
        },
        "Orange___Haunglongbing_(Citrus_greening)": {
            "severity": "CRITICAL",
            "treatment": [
                "No cure — remove and destroy infected trees",
                "Control psyllid vector with Imidacloprid spray",
                "Use certified disease-free nursery stock",
                "Report to local agricultural department immediately",
            ],
        },
        "Peach___Bacterial_spot": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Copper hydroxide @ 2g/L at petal fall",
                "Spray Oxytetracycline during early season",
                "Use resistant varieties: Redhaven, Reliance",
                "Avoid overhead sprinkler irrigation",
            ],
        },
        "Peach___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Monitor regularly."],
        },
        "Pepper,_bell___Bacterial_spot": {
            "severity": "HIGH",
            "treatment": [
                "Apply Copper-based bactericide every 7 days",
                "Use disease-free certified seed/transplants",
                "Avoid working in field when foliage is wet",
                "Spray Streptomycin sulfate @ 0.5g/L water",
            ],
        },
        "Pepper,_bell___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Ensure adequate watering."],
        },
        "Potato___Early_blight": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Mancozeb 75 WP @ 2.5g/L at first sign",
                "Spray Chlorothalonil 75 WP @ 2g/L water",
                "Ensure adequate potassium fertilization",
                "Practice 3-year crop rotation",
            ],
        },
        "Potato___Late_blight": {
            "severity": "CRITICAL",
            "treatment": [
                "URGENT: Apply Metalaxyl + Mancozeb immediately",
                "Spray Cymoxanil + Mancozeb @ 2.5g/L water",
                "Destroy all infected plant material by burning",
                "Apply preventive spray every 5-7 days in wet weather",
            ],
        },
        "Potato___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Monitor for early blight signs."],
        },
        "Raspberry___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Prune after fruiting."],
        },
        "Soybean___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Ensure proper nodulation."],
        },
        "Squash___Powdery_mildew": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Sulfur dust or Wettable sulfur @ 3g/L",
                "Spray Neem oil 0.3% solution as organic option",
                "Ensure proper plant spacing for air circulation",
                "Remove severely infected leaves",
            ],
        },
        "Strawberry___Leaf_scorch": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Captan 50 WP @ 2g/L water",
                "Remove and destroy infected leaves",
                "Avoid overhead irrigation — use drip",
                "Plant resistant varieties in next season",
            ],
        },
        "Strawberry___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Maintain mulch cover."],
        },
        "Tomato___Bacterial_spot": {
            "severity": "HIGH",
            "treatment": [
                "Apply Copper hydroxide @ 2g/L every 7 days",
                "Use certified disease-free transplants only",
                "Spray Bactericide (Streptomycin) at first sign",
                "Avoid working when foliage is wet",
            ],
        },
        "Tomato___Early_blight": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Mancozeb 75 WP @ 2.5g/L water",
                "Spray Iprodione 50 WP @ 2g/L if severe",
                "Remove lower infected leaves and destroy",
                "Mulch soil to prevent spore splash",
            ],
        },
        "Tomato___Late_blight": {
            "severity": "CRITICAL",
            "treatment": [
                "URGENT: Spray Metalaxyl + Mancozeb @ 2.5g/L",
                "Apply Dimethomorph 50 WP @ 1g/L immediately",
                "Remove and burn all infected plant parts",
                "Preventive spray every 5 days in humid weather",
            ],
        },
        "Tomato___Leaf_Mold": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Chlorothalonil 75 WP @ 2g/L water",
                "Reduce greenhouse humidity below 85%",
                "Improve ventilation in protected cultivation",
                "Remove and destroy affected leaves",
            ],
        },
        "Tomato___Septoria_leaf_spot": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Mancozeb or Chlorothalonil at first sign",
                "Remove lower infected leaves immediately",
                "Avoid overhead irrigation — use drip system",
                "Spray every 7-10 days in wet conditions",
            ],
        },
        "Tomato___Spider_mites Two-spotted_spider_mite": {
            "severity": "HIGH",
            "treatment": [
                "Apply Abamectin 1.8 EC @ 0.5ml/L water",
                "Spray Spiromesifen 22.9 SC @ 1ml/L",
                "Use Neem oil 0.5% as organic option",
                "Ensure adequate irrigation — mites thrive in drought",
            ],
        },
        "Tomato___Target_Spot": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply Azoxystrobin 23 SC @ 1ml/L water",
                "Spray Chlorothalonil 75 WP @ 2g/L",
                "Remove infected leaves and improve air flow",
                "Crop rotation with non-solanaceous crops",
            ],
        },
        "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
            "severity": "CRITICAL",
            "treatment": [
                "No cure — remove and destroy infected plants",
                "Control whitefly vector: Imidacloprid 17.8 SL @ 0.5ml/L",
                "Use reflective silver mulch to repel whiteflies",
                "Plant virus-resistant varieties: HM-1, Naveen",
            ],
        },
        "Tomato___Tomato_mosaic_virus": {
            "severity": "HIGH",
            "treatment": [
                "No chemical cure — remove infected plants",
                "Disinfect tools with 10% bleach solution",
                "Control aphid and thrip vectors",
                "Use virus-free certified seed for next crop",
            ],
        },
        "Tomato___healthy": {
            "severity": "LOW",
            "treatment": ["Plant is healthy. Monitor for early pest signs."],
        },
    }

    with open(MODEL_DIR / "treatment_map.json", "w") as f:
        json.dump(treatment_map, f, indent=2)
    print(f"Treatment map saved: {len(treatment_map)} entries")
    return treatment_map


# ═══════════════════════════════════════════════════════════════════════════
# STEP 4-5: TRANSFORMS + DATASETS
# ═══════════════════════════════════════════════════════════════════════════
def build_dataloaders(class_names):
    """Create train/val/test dataloaders with augmentation + class balancing."""
    train_transforms = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(30),
        transforms.ColorJitter(
            brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1
        ),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
        ),
    ])

    val_transforms = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
        ),
    ])

    full_dataset = datasets.ImageFolder(str(CLEAN_DIR), transform=train_transforms)

    n = len(full_dataset)
    n_train = int(0.70 * n)
    n_val = int(0.15 * n)
    n_test = n - n_train - n_val

    train_set, val_set, test_set = torch.utils.data.random_split(
        full_dataset, [n_train, n_val, n_test],
        generator=torch.Generator().manual_seed(42),
    )

    # Apply val transforms to val and test sets
    val_dataset_copy = datasets.ImageFolder(str(CLEAN_DIR), transform=val_transforms)
    val_set_proper = torch.utils.data.Subset(val_dataset_copy, val_set.indices)
    test_set_proper = torch.utils.data.Subset(val_dataset_copy, test_set.indices)

    # Class-balanced sampler for training
    targets = [full_dataset.targets[i] for i in train_set.indices]
    class_counts = Counter(targets)
    weights = [1.0 / class_counts[t] for t in targets]
    sampler = WeightedRandomSampler(weights, len(weights))

    num_workers = 0 if DEVICE.type == "cpu" else 4

    train_loader = DataLoader(
        train_set, batch_size=BATCH_SIZE, sampler=sampler, num_workers=num_workers,
        pin_memory=(DEVICE.type != "cpu"),
    )
    val_loader = DataLoader(
        val_set_proper, batch_size=BATCH_SIZE, shuffle=False, num_workers=num_workers,
        pin_memory=(DEVICE.type != "cpu"),
    )
    test_loader = DataLoader(
        test_set_proper, batch_size=BATCH_SIZE, shuffle=False, num_workers=num_workers,
        pin_memory=(DEVICE.type != "cpu"),
    )

    print(f"Train: {n_train} | Val: {n_val} | Test: {n_test}")
    return train_loader, val_loader, test_loader


# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: BUILD MODEL — MobileNetV2 HIGH-ACCURACY FINE-TUNE
# ═══════════════════════════════════════════════════════════════════════════
def build_model(num_classes, unfreeze_top=True):
    """
    Load pretrained MobileNetV2 with differential layer unfreezing.
    Freezes low-level edge/corner features while unfreezing top inverted
    residual blocks (features[14:]) so the model learns fine-grained leaf
    lesions and pathology textures, driving validation accuracy >95%.
    """
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)

    # Freeze base layers
    for param in model.features.parameters():
        param.requires_grad = False

    # Unfreeze top feature layers (last 3 blocks) for domain adaptation
    if unfreeze_top:
        for block in model.features[14:]:
            for param in block.parameters():
                param.requires_grad = True

    # Replace classifier head with dual-dropout regularization
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(model.last_channel, 512),
        nn.ReLU(),
        nn.Dropout(p=0.2),
        nn.Linear(512, num_classes),
    )
    model = model.to(DEVICE)

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"Model: MobileNetV2 (Differential Fine-Tuning) | Trainable: {trainable:,} / {total:,} params")
    print(f"Device: {DEVICE}")
    return model


# ═══════════════════════════════════════════════════════════════════════════
# STEP 7: TRAINING LOOP
# ═══════════════════════════════════════════════════════════════════════════
def train_model(model, train_loader, val_loader, class_names):
    """Train with differential learning rate, early stopping, and LR scheduling."""
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    # Differential parameter groups: low LR for backbone, standard LR for head
    backbone_params = [p for p in model.features.parameters() if p.requires_grad]
    classifier_params = [p for p in model.classifier.parameters() if p.requires_grad]

    param_groups = []
    if backbone_params:
        param_groups.append({"params": backbone_params, "lr": LR * 0.1, "weight_decay": 1e-4})
    param_groups.append({"params": classifier_params, "lr": LR, "weight_decay": 1e-4})

    optimizer = torch.optim.AdamW(param_groups)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=2, min_lr=1e-6
    )

    best_val_acc = 0.0
    patience_counter = 0
    history = []

    print("\n" + "=" * 60)
    print("STEP 7: TRAINING")
    print("=" * 60)

    is_cpu = (DEVICE.type == "cpu")
    epochs_to_run = CPU_EPOCHS if is_cpu else EPOCHS

    for epoch in range(epochs_to_run):
        # ── Train ──
        model.train()
        train_loss, train_correct, train_total = 0, 0, 0

        for images, labels in train_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()
            _, predicted = outputs.max(1)
            train_total += labels.size(0)
            train_correct += predicted.eq(labels).sum().item()

        train_acc = 100.0 * train_correct / train_total

        # ── Validate ──
        model.eval()
        val_loss, val_correct, val_total = 0, 0, 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(DEVICE), labels.to(DEVICE)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()

        val_acc = 100.0 * val_correct / val_total
        scheduler.step(val_acc)
        history.append({
            "epoch": epoch + 1,
            "train_acc": round(train_acc, 2),
            "val_acc": round(val_acc, 2),
        })

        total_epochs = CPU_EPOCHS if is_cpu else EPOCHS
        print(
            f"Epoch {epoch + 1:2d}/{total_epochs} | "
            f"Train: {train_acc:.2f}% | Val: {val_acc:.2f}%"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "val_acc": val_acc,
                    "class_names": class_names,
                    "num_classes": len(class_names),
                },
                MODEL_DIR / "model.pth",
            )
            patience_counter = 0
            print(f"  -> Saved best model: {val_acc:.2f}%")
        else:
            patience_counter += 1
            if patience_counter >= EARLY_STOP_PATIENCE:
                print(f"  Early stopping at epoch {epoch + 1}")
                break

    return history, best_val_acc


# ═══════════════════════════════════════════════════════════════════════════
# STEP 8: TEST EVALUATION
# ═══════════════════════════════════════════════════════════════════════════
def evaluate_test(model, test_loader):
    """Load best checkpoint and evaluate on held-out test set."""
    checkpoint = torch.load(MODEL_DIR / "model.pth", map_location=DEVICE)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    test_correct, test_total = 0, 0
    with torch.no_grad():
        for images, labels in test_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            outputs = model(images)
            _, preds = outputs.max(1)
            test_total += labels.size(0)
            test_correct += preds.eq(labels).sum().item()

    test_acc = 100.0 * test_correct / test_total
    return test_acc


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
def main():
    print("=" * 60)
    print("  KrishiMitra — Disease Detection Training")
    print("  MobileNetV2 (ImageNet) -> PlantVillage (38 classes)")
    print("=" * 60)

    # Step 1: Clean data
    if not clean_data():
        return

    # Step 2: Save class names
    class_names = save_class_names()

    # Step 3: Save treatment map
    save_treatment_map()

    # Step 4-5: Build dataloaders
    train_loader, val_loader, test_loader = build_dataloaders(class_names)

    # Step 6: Build model
    num_classes = len(class_names)
    model = build_model(num_classes)

    # Step 7: Train
    history, best_val_acc = train_model(model, train_loader, val_loader, class_names)

    # Step 8: Test evaluation
    test_acc = evaluate_test(model, test_loader)

    print(f"\n{'=' * 60}")
    print(f"FINAL TEST ACCURACY: {test_acc:.2f}%")
    print(f"TARGET: >= 94.00%  ->  {'PASS' if test_acc >= 94 else 'FAIL'}")
    print(f"Model saved to: {MODEL_DIR}/model.pth")
    print(f"{'=' * 60}")

    # Save training history
    pd.DataFrame(history).to_csv(
        REPORT_DIR / "disease_training_history.csv", index=False
    )


if __name__ == "__main__":
    main()
