"""
KrishiMitra — Layered Image Validation Gate

Performs multi-stage pre-inference validation before any AI/ML model execution:
1. Binary & Format Integrity (file size, magic bytes, decoding, corruption).
2. Geometric & Resolution Dimensions (minimum size, aspect ratio).
3. Image Quality (blur/sharpness, blank/monochromatic, over/under exposure).
4. Agricultural Subject Verification (vegetation presence, document/logo rejection, natural leaf texture).

Outcomes:
- VALID: Passes all quality, structural, and agricultural subject checks.
- INVALID_IMAGE: Corrupted, unreadable, blank, blurry, or synthetic graphic/document.
- NO_SUPPORTED_PLANT_DETECTED: Natural non-plant image (face, vehicle, animal, interior furniture, logo).
"""

import io
import math
from typing import Tuple, Dict, Any, Optional
from PIL import Image, ImageStat, ImageFilter
import numpy as np


# Minimum and maximum allowable file size (bytes)
MIN_FILE_SIZE_BYTES = 512              # 0.5 KB
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 # 15 MB

# Minimum spatial dimensions for reliable pathological diagnosis
MIN_WIDTH = 64
MIN_HEIGHT = 64

# Aspect ratio boundaries (reject extreme strip banners or barcodes)
MIN_ASPECT_RATIO = 0.2
MAX_ASPECT_RATIO = 5.0


class ValidationResult:
    """Encapsulates the verdict and diagnostics of the image validation pipeline."""

    def __init__(
        self,
        is_valid: bool,
        status: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        image: Optional[Image.Image] = None,
    ):
        self.is_valid = is_valid
        self.status = status          # 'VALID', 'INVALID_IMAGE', 'NO_SUPPORTED_PLANT_DETECTED'
        self.message = message
        self.details = details or {}
        self.image = image

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "status": self.status,
            "message": self.message,
            "details": self.details,
        }


def check_binary_and_format(image_bytes: bytes) -> Tuple[bool, str, Optional[Image.Image]]:
    """Stage 1: Verify raw bytes, header, and format integrity."""
    if not image_bytes or len(image_bytes) < MIN_FILE_SIZE_BYTES:
        return False, f"Image file is empty or too small (< {MIN_FILE_SIZE_BYTES} bytes).", None

    if len(image_bytes) > MAX_FILE_SIZE_BYTES:
        return False, f"Image file exceeds maximum allowable size of {MAX_FILE_SIZE_BYTES // (1024*1024)}MB.", None

    try:
        stream = io.BytesIO(image_bytes)
        img = Image.open(stream)
        img.verify()  # Verifies CRC and file structure
    except Exception as exc:
        return False, f"Corrupted or unsupported image file header: {exc}", None

    # Re-open after verify() (PIL requirement)
    try:
        stream.seek(0)
        img = Image.open(stream)
        img_rgb = img.convert("RGB")
        img_rgb.load()  # Force full pixel decoding
    except Exception as exc:
        return False, f"Image decoding failed: {exc}", None

    return True, "Valid image structure", img_rgb


def check_dimensions(img: Image.Image) -> Tuple[bool, str]:
    """Stage 2: Check dimensions and aspect ratio."""
    width, height = img.size
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        return False, f"Image resolution too low ({width}x{height}px). Minimum required is {MIN_WIDTH}x{MIN_HEIGHT}px."

    aspect = width / max(height, 1)
    if aspect < MIN_ASPECT_RATIO or aspect > MAX_ASPECT_RATIO:
        return False, f"Extreme aspect ratio ({aspect:.2f}). Please upload a standard leaf or pest photograph."

    return True, "Dimensions valid"


def check_image_quality(img: Image.Image) -> Tuple[bool, str, Dict[str, Any]]:
    """Stage 3: Inspect image variance, solid color blocks, exposure, and blur."""
    stat = ImageStat.Stat(img)
    
    # 1. Monochromatic / Solid color test
    channel_means = stat.mean
    channel_stds = stat.stddev
    mean_std = sum(channel_stds) / len(channel_stds)

    # Purely blank/featureless check (flat color canvas, pure black, flat white, or monochromatic)
    if mean_std < 2.5:
        return False, "Image appears completely blank, featureless, or a flat solid color canvas.", {"mean_std": mean_std}

    # 2. Extreme exposure (pitch black or pure white)
    avg_luminance = 0.299 * channel_means[0] + 0.587 * channel_means[1] + 0.114 * channel_means[2]
    if avg_luminance < 10.0:
        return False, "Image is underexposed (too dark or completely black). Capture photo in proper lighting.", {"luminance": avg_luminance}
    if avg_luminance > 250.0:
        return False, "Image is overexposed (completely white or washed out).", {"luminance": avg_luminance}

    # 3. Focus / Blur check via Laplacian edge variance
    thumb = img.resize((128, 128), Image.Resampling.BILINEAR).convert("L")
    edges = thumb.filter(ImageFilter.FIND_EDGES)
    edge_stat = ImageStat.Stat(edges)
    edge_var = edge_stat.var[0]
    
    # Low edge variance on complex non-synthetic images indicates severe blur
    if edge_var < 6.0 and mean_std >= 12.0:
        return False, "Image is severely blurred or out of focus. Please upload a clear photo of the leaf.", {"edge_variance": edge_var}

    return True, "Quality acceptable", {
        "mean_std": round(mean_std, 2),
        "luminance": round(avg_luminance, 2),
        "edge_variance": round(edge_var, 2)
    }


def verify_agricultural_subject(
    img: Image.Image,
    target_domain: str = "leaf"  # 'leaf' or 'pest'
) -> Tuple[bool, str, str, Dict[str, Any]]:
    """
    Stage 4: Detect whether image contains organic plant vegetation / leaf / agricultural pest,
    or is an unrelated graphic (college logo, document, text page, human face, vehicle).
    
    Returns:
        (is_valid, status, message, metrics)
    """
    # Sample down to 128x128 numpy array for high-performance vectorized checks
    sample = img.resize((128, 128), Image.Resampling.BILINEAR)
    arr = np.array(sample, dtype=np.float32) # [128, 128, 3]

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    
    # ── Test A: Detect Document / Page of Text ──
    # Documents typically have > 75% pure white/near-white pixels (R,G,B > 225)
    near_white_mask = (r > 225) & (g > 225) & (b > 225)
    white_ratio = float(np.mean(near_white_mask))
    if white_ratio > 0.72:
        return (
            False,
            "INVALID_IMAGE",
            "Uploaded file appears to be a paper document, screenshot, or text sheet rather than a crop leaf.",
            {"white_ratio": round(white_ratio, 3)}
        )

    # ── Test B: Detect Flat Vector Logos / Synthetic Graphics ──
    # Synthetic vector graphics/logos have very few unique colors and quantized distributions.
    # Quantize to 64 colors and check palette dispersion
    quantized = sample.quantize(colors=64)
    histogram = quantized.histogram()
    # If top 3 colors represent > 85% of total area and white/black dominates, it is an icon/logo
    sorted_counts = sorted(histogram, reverse=True)
    top3_ratio = sum(sorted_counts[:3]) / (128 * 128)
    
    # ── Test C: Botanical Color and Vegetation Spectrum ──
    # Vegetation displays distinctive Excess Green Index (ExG = 2*G - R - B)
    # and HSV hue ranges for green [30°-165°] and chlorotic yellow/brown [12°-30°].
    exg = (2.0 * g - r - b)
    
    # Normalize color channels to avoid divide by zero
    total_rgb = r + g + b + 1e-5
    norm_g = g / total_rgb
    norm_r = r / total_rgb
    norm_b = b / total_rgb

    # Green leaf pixels: G > R and G > B with positive ExG
    green_vegetation = (g > r) & (g > b) & (exg > 15.0)
    
    # Diseased / Necrotic plant tissue (yellow, orange-brown chlorosis / blight)
    # Typically R >= G > B with moderate brown/yellow hue
    necrotic_tissue = (r >= g) & (g > b) & (r < 235) & (b < 140) & ((r - b) > 30)

    # Total plant leaf tissue mask
    plant_tissue = green_vegetation | necrotic_tissue
    plant_ratio = float(np.mean(plant_tissue))

    metrics = {
        "plant_pixel_ratio": round(plant_ratio, 3),
        "white_ratio": round(white_ratio, 3),
        "top3_color_ratio": round(top3_ratio, 3),
        "mean_exg": round(float(np.mean(exg)), 2)
    }

    # If testing specifically for plant leaf:
    if target_domain == "leaf":
        # If synthetic graphic with high concentration of flat colors and no vegetation
        if top3_ratio > 0.85 and plant_ratio < 0.15:
            return (
                False,
                "INVALID_IMAGE",
                "Uploaded image appears to be a digital graphic, college logo, or drawing rather than a real plant leaf.",
                metrics
            )

        # Non-plant images (cars, people, pets, furniture, logos) typically have plant_ratio < 0.08
        if plant_ratio < 0.08:
            return (
                False,
                "NO_SUPPORTED_PLANT_DETECTED",
                "No plant foliage, crop leaf, or agricultural vegetation detected. Please photograph an actual crop leaf.",
                metrics
            )

    elif target_domain == "pest":
        # For pests: insects may appear on leaves, soil, traps, or stems.
        # However, flat digital logos, synthetic graphics, and text documents must still be rejected.
        if (top3_ratio > 0.82 and (white_ratio > 0.40 or plant_ratio < 0.10)) or white_ratio > 0.70:
            return (
                False,
                "INVALID_IMAGE",
                "Uploaded image appears to be a digital graphic, logo, or document. Please upload a clear photo of the insect pest.",
                metrics
            )

    return True, "VALID", "Agricultural subject verified", metrics


def validate_image(
    image_bytes: bytes,
    target_domain: str = "leaf"
) -> ValidationResult:
    """
    Main layered validation entry point.
    
    Args:
        image_bytes: Raw bytes from uploaded multipart file.
        target_domain: 'leaf' for disease scanner, 'pest' for pest detector.
        
    Returns:
        ValidationResult object with is_valid, status, message, details, and decoded PIL Image.
    """
    # Stage 1: Binary & Format
    ok, msg, img = check_binary_and_format(image_bytes)
    if not ok:
        return ValidationResult(is_valid=False, status="INVALID_IMAGE", message=msg)

    # Stage 2: Dimensions
    ok, msg = check_dimensions(img)
    if not ok:
        return ValidationResult(is_valid=False, status="INVALID_IMAGE", message=msg)

    # Stage 3: Image Quality
    ok, msg, quality_metrics = check_image_quality(img)
    if not ok:
        return ValidationResult(is_valid=False, status="INVALID_IMAGE", message=msg, details=quality_metrics)

    # Stage 4: Agricultural Subject Gate
    ok, status, msg, subject_metrics = verify_agricultural_subject(img, target_domain=target_domain)
    details = {**quality_metrics, **subject_metrics}

    if not ok:
        return ValidationResult(is_valid=False, status=status, message=msg, details=details)

    return ValidationResult(
        is_valid=True,
        status="VALID",
        message="Image passed all validation checks.",
        details=details,
        image=img
    )
