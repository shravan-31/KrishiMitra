"""
KrishiMitra — Train Pest Detection Model

Base:    EfficientNet-B0 (pretrained=ImageNet) — FINE-TUNE ONLY
Dataset: IP102 (15 classes)
Output:  backend/models/pest/model.pth
Target:  Accuracy >= 91%
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
from PIL import Image
import numpy as np
import pandas as pd
from collections import Counter

# CONFIG
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent  # backend directory
WORKSPACE_DIR = BASE_DIR.parent.parent  # root AgriMind directory

candidate_data_dirs = [
    WORKSPACE_DIR / "Dataset" / "pest_detection",
    BASE_DIR / "data" / "raw" / "ip102",
    pathlib.Path("Dataset/pest_detection").resolve(),
    pathlib.Path("backend/data/raw/ip102").resolve(),
    pathlib.Path("data/raw/ip102").resolve(),
]
DATA_DIR = next((p for p in candidate_data_dirs if p.exists() and any(p.iterdir())), candidate_data_dirs[0])

CLEAN_DIR = BASE_DIR / "data" / "cleaned" / "ip102"
MODEL_DIR = BASE_DIR / "models" / "pest"
REPORT_DIR = BASE_DIR / "data" / "reports"
BATCH_SIZE = 32
EPOCHS = 8
LR = 1e-3
IMG_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
EARLY_STOP_PATIENCE = 3

CLEAN_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def get_md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def clean_data():
    print("=" * 60)
    print("STEP 1: DATA CLEANING")
    print("=" * 60)

    if not DATA_DIR.exists():
        print(f"ERROR: Dataset not found at {DATA_DIR}")
        return False

    seen_hashes = set()
    dropped_rows = []
    kept = 0

    max_images_per_class = None
    min_samples_required = 30

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

            # Rule 2: Minimum file size 1KB
            size_kb = os.path.getsize(img_path) / 1024.0
            if size_kb < 1.0:
                dropped_rows.append({
                    "file": str(img_path),
                    "class": class_dir.name,
                    "reason": f"too small: {size_kb:.1f}KB",
                })
                continue

            # Rule 3: deduplicate via MD5
            h = get_md5(img_path)
            if h in seen_hashes:
                dropped_rows.append({
                    "file": str(img_path),
                    "class": class_dir.name,
                    "reason": "duplicate",
                })
                continue
            seen_hashes.add(h)

            shutil.copy(img_path, out_dir / img_path.name)
            kept += 1

    # Rule 4: min samples per class — augment by copying if needed
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
        REPORT_DIR / "pest_cleaning_report.csv", index=False
    )
    print(f"Kept: {kept} images | Dropped: {len(dropped_rows)}")
    return True


def save_class_names():
    class_names = sorted([d.name for d in CLEAN_DIR.iterdir() if d.is_dir()])
    with open(MODEL_DIR / "class_names.json", "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"Classes: {len(class_names)}")
    return class_names


def save_pest_control_map():
    pest_control_map = {
        "Aphids": {
            "severity": "MEDIUM",
            "treatment": [
                "Spray neem oil (0.5% solution) or insecticidal soap, release natural predators like ladybugs or lacewings, and remove and discard heavily infested plant tips.",
                "Apply chemical controls like Imidacloprid if infestation is severe."
            ]
        },
        "Armyworm": {
            "severity": "HIGH",
            "treatment": [
                "Apply Bacillus thuringiensis (Bt) or Spinosad sprays, plow soil in early spring to expose and destroy pupae, and use pheromone traps to monitor adult moth activity.",
                "Apply Chlorantraniliprole for chemical control."
            ]
        },
        "Bollworm": {
            "severity": "HIGH",
            "treatment": [
                "Plant Bt crop varieties if available, deploy pheromone traps at 5-10 traps per acre, and encourage predatory bugs and trichogramma wasps.",
                "Apply Spinosad or Emamectin benzoate @ 0.4g/L."
            ]
        },
        "Cutworm": {
            "severity": "MEDIUM",
            "treatment": [
                "Use cardboard collars around stems of young seedlings, apply diatomaceous earth around the base of plants, and hand-pick larvae from soil surface at night.",
                "Apply Spinosad bait or Pyrethroid insecticide to the soil in the evening."
            ]
        },
        "Fruit_Fly": {
            "severity": "HIGH",
            "treatment": [
                "Deploy methyl eugenol or protein bait traps, collect and bury fallen infested fruits at least 2 feet deep, and use fruit bagging/sleeving for high-value crops.",
                "Apply spinosad bait spray or standard chemical sprays like Malathion if fly density is high."
            ]
        },
        "Grasshopper": {
            "severity": "MEDIUM",
            "treatment": [
                "Apply nosema locustae baits for biological control, keep a buffer strip of tall grass/weeds around the field, and till soil in late autumn to destroy grasshopper eggs.",
                "Apply chemical sprays like Cypermethrin or Lambda-cyhalothrin."
            ]
        },
        "Leaf_Miner": {
            "severity": "LOW",
            "treatment": [
                "Remove and destroy infested leaves showing mine patterns, use yellow sticky cards to trap adult flies, and introduce parasitic wasps like Diglyphus isaea.",
                "Apply Spinosad or Abamectin to target larvae inside leaves."
            ]
        },
        "Mealybugs": {
            "severity": "HIGH",
            "treatment": [
                "Prune and destroy infested plant parts, spray with high-pressure water or horticultural oil, and release Cryptolaemus montrouzieri (mealybug destroyer) beetles.",
                "Apply systemic insecticides like Buprofezin or Imidacloprid."
            ]
        },
        "Nematodes": {
            "severity": "HIGH",
            "treatment": [
                "Grow nematode-resistant crop cultivars, practice crop rotation with non-hosts like French marigolds, and solarize soil during hot summer months using clear plastic sheets.",
                "Apply bio-nematicides containing Purpureocillium lilacinum or chemical nematicides if critical."
            ]
        },
        "Scale_Insects": {
            "severity": "MEDIUM",
            "treatment": [
                "Prune heavily infested twigs and branches, apply horticultural spray oil during the dormant season, and introduce natural predators such as parasitic wasps.",
                "Use systemic insecticides like Acetamiprid or Dinotefuran."
            ]
        },
        "Spider_Mites": {
            "severity": "HIGH",
            "treatment": [
                "Spray underside of leaves with cold water or insecticidal soap, introduce predatory mites such as Phytoseiulus persimilis, and keep plants well-watered to prevent drought stress.",
                "Apply miticides like Abamectin, Spiromesifen, or Hexythiazox."
            ]
        },
        "Stem_Borer": {
            "severity": "CRITICAL",
            "treatment": [
                "Cut and burn infested plants showing 'dead heart' symptoms, release Trichogramma chilonis egg parasitoids, and plow and destroy crop stubble after harvest to kill hibernating larvae.",
                "Apply granular Cartap hydrochloride or Fipronil in the soil."
            ]
        },
        "Termites": {
            "severity": "CRITICAL",
            "treatment": [
                "Locate and destroy nearby termite mounds, use neem cake or well-rotted organic manure in soil, and ensure proper field irrigation (dry soil attracts termites).",
                "Apply Chlorpyrifos or Imidacloprid to the soil around crops."
            ]
        },
        "Thrips": {
            "severity": "MEDIUM",
            "treatment": [
                "Use blue sticky traps to monitor and catch adult thrips, spray neem oil or horticultural oil for organic control, and avoid excessive nitrogen fertilization which attracts thrips.",
                "Apply Spinosad or Fipronil sprays to foliage."
            ]
        },
        "Whitefly": {
            "severity": "HIGH",
            "treatment": [
                "Use yellow sticky traps to catch flying adults, spray neem oil (1% solution) or insecticidal soap, and introduce parasitoid wasps like Encarsia formosa.",
                "Spray underside of leaves with Spiromesifen or Diafenthiuron."
            ]
        }
    }

    with open(MODEL_DIR / "pest_control_map.json", "w") as f:
        json.dump(pest_control_map, f, indent=2)
    print(f"Pest control map saved: {len(pest_control_map)} entries")
    return pest_control_map


def build_dataloaders(class_names):
    train_transforms = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(30),
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

    val_dataset_copy = datasets.ImageFolder(str(CLEAN_DIR), transform=val_transforms)
    val_set_proper = torch.utils.data.Subset(val_dataset_copy, val_set.indices)
    test_set_proper = torch.utils.data.Subset(val_dataset_copy, test_set.indices)

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


def build_model(num_classes):
    """Load pretrained EfficientNet-B0, freeze feature backbone for rapid CPU execution, modify classifier head."""
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)

    # Freeze entire feature backbone for fast CPU training
    for param in model.features.parameters():
        param.requires_grad = False

    # Replace classifier head
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(p=0.2),
        nn.Linear(512, num_classes),
    )
    model = model.to(DEVICE)

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"Model: EfficientNet-B0 | Trainable: {trainable:,} / {total:,} params")
    print(f"Device: {DEVICE}")
    return model


def train_model(model, train_loader, val_loader, class_names):
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR, weight_decay=1e-4,
    )
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=2,
    )

    best_val_acc = 0.0
    patience_counter = 0
    history = []

    print("\n" + "=" * 60)
    print("STEP 7: TRAINING PEST MODEL")
    print("=" * 60)

    for epoch in range(EPOCHS):
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

        train_acc = 100.0 * train_correct / max(train_total, 1)

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

        val_acc = 100.0 * val_correct / max(val_total, 1)
        scheduler.step(val_acc)
        history.append({
            "epoch": epoch + 1,
            "train_acc": round(train_acc, 2),
            "val_acc": round(val_acc, 2),
        })

        print(
            f"Epoch {epoch + 1:2d}/{EPOCHS} | "
            f"Train: {train_acc:.2f}% | Val: {val_acc:.2f}%"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "epoch": epoch + 1,
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


def evaluate_test(model, test_loader):
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

    test_acc = 100.0 * test_correct / max(test_total, 1)
    return test_acc


def main():
    print("=" * 60)
    print("  KrishiMitra — Pest Detection Training")
    print("  EfficientNet-B0 (ImageNet) -> IP102 (15 classes)")
    print("=" * 60)

    # Step 1: Clean data
    if not clean_data():
        return

    # Step 2: Save class names
    class_names = save_class_names()

    # Step 3: Save control map
    save_pest_control_map()

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
    print(f"TARGET: >= 91.00%  ->  {'PASS' if test_acc >= 91 else 'FAIL'}")
    print(f"Model saved to: {MODEL_DIR}/model.pth")
    print(f"{'=' * 60}")

    # Save training history
    pd.DataFrame(history).to_csv(
        REPORT_DIR / "pest_training_history.csv", index=False
    )


if __name__ == "__main__":
    main()
