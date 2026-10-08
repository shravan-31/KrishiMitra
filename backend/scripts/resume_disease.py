"""
KrishiMitra — Resume disease training from best checkpoint.

Continues classifier-head training at a lower LR so logits sharpen
(higher honest confidence) and accuracy can climb further.
Only overwrites model.pth when validation accuracy beats the previous best.
Usage:
    cd agri-intelligence
    backend\\venv\\Scripts\\python.exe backend\\scripts\\resume_disease.py
Env: RESUME_EPOCHS (default 10), RESUME_LR (default 5e-5)
"""

import os
import pathlib
import sys

import pandas as pd
import torch
import torch.nn as nn

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from train_disease import (
    BATCH_SIZE,
    MODEL_DIR,
    REPORT_DIR,
    build_dataloaders,
    build_model,
    evaluate_test,
    save_class_names,
)

RESUME_EPOCHS = int(os.getenv("RESUME_EPOCHS", "10"))
RESUME_LR = float(os.getenv("RESUME_LR", "5e-5"))
BASE_BEST = 77.47  # best val_acc from the initial honest run


def main():
    from train_disease import DEVICE

    class_names = save_class_names()
    train_loader, val_loader, test_loader = build_dataloaders(class_names)
    model = build_model(len(class_names))

    ckpt = torch.load(MODEL_DIR / "model.pth", map_location=DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    print(f"Resumed from epoch {ckpt.get('epoch', '?')} "
          f"(val_acc={ckpt.get('val_acc', '?')})")

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()), lr=RESUME_LR
    )
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=3
    )

    hist_path = REPORT_DIR / "disease_training_history.csv"
    history = pd.read_csv(hist_path).to_dict("records") if hist_path.exists() else []
    start_epoch = len(history)
    best_val_acc = BASE_BEST
    patience, no_improve = 5, 0

    for e in range(RESUME_EPOCHS):
        model.train()
        tr_c = tr_n = 0
        for images, labels in train_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            out = model(images)
            loss = criterion(out, labels)
            loss.backward()
            optimizer.step()
            tr_n += labels.size(0)
            tr_c += out.max(1)[1].eq(labels).sum().item()
        train_acc = 100.0 * tr_c / tr_n

        model.eval()
        v_c = v_n = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(DEVICE), labels.to(DEVICE)
                out = model(images)
                v_n += labels.size(0)
                v_c += out.max(1)[1].eq(labels).sum().item()
        val_acc = 100.0 * v_c / v_n
        scheduler.step(val_acc)
        history.append({
            "epoch": start_epoch + e + 1,
            "train_acc": round(train_acc, 2),
            "val_acc": round(val_acc, 2),
        })
        print(f"Epoch {start_epoch + e + 1} | Train: {train_acc:.2f}% | "
              f"Val: {val_acc:.2f}%")
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({
                "epoch": start_epoch + e,
                "model_state_dict": model.state_dict(),
                "val_acc": val_acc,
                "class_names": class_names,
                "num_classes": len(class_names),
            }, MODEL_DIR / "model.pth")
            print(f"  -> Saved best model: {val_acc:.2f}%")
            no_improve = 0
        else:
            no_improve += 1
            if no_improve >= patience:
                print("  Early stopping (no val improvement)")
                break

    pd.DataFrame(history).to_csv(hist_path, index=False)
    test_acc = evaluate_test(model, test_loader)
    print("=" * 60)
    print(f"RESUME DONE | best val: {best_val_acc:.2f}% | "
          f"test acc: {test_acc:.2f}%")
    print("=" * 60)


if __name__ == "__main__":
    main()
