"""Classical computer-vision features for meal photos (no neural network needed).

- pHash: 64-bit DCT perceptual hash → detects re-uploads of the same photo.
- Blur: variance of the Laplacian on a 512 px greyscale copy.
- Brightness: mean luminance.
"""
import io

import numpy as np
from PIL import Image
from scipy.fft import dctn

BLUR_THRESHOLD = 60.0  # Laplacian variance below this looks blurry at 512 px
DARK_THRESHOLD = 55.0  # mean luminance (0-255)
DUPLICATE_MAX_DISTANCE = 4  # Hamming distance between pHashes


def _grey(image_bytes: bytes, size: int | None = None) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    if size:
        img.thumbnail((size, size))
    return np.asarray(img, dtype=np.float64)


def phash(image_bytes: bytes) -> str:
    """32×32 greyscale → 2-D DCT → top-left 8×8 (minus DC) vs median → 16 hex chars."""
    img = Image.open(io.BytesIO(image_bytes)).convert("L").resize((32, 32), Image.Resampling.LANCZOS)
    coeffs = dctn(np.asarray(img, dtype=np.float64), norm="ortho")[:8, :8]
    flat = coeffs.flatten()
    bits = flat > np.median(flat[1:])
    return f"{int(''.join('1' if b else '0' for b in bits), 2):016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def quality(image_bytes: bytes) -> dict:
    grey = _grey(image_bytes, 512)
    lap = (
        -4 * grey[1:-1, 1:-1] + grey[:-2, 1:-1] + grey[2:, 1:-1] + grey[1:-1, :-2] + grey[1:-1, 2:]
    )
    blur_score = float(lap.var())
    brightness = float(grey.mean())
    is_blurry = blur_score < BLUR_THRESHOLD
    is_dark = brightness < DARK_THRESHOLD
    message = None
    if is_blurry and is_dark:
        message = "Photo is blurry and dark — retake it in better light, holding the phone steady."
    elif is_blurry:
        message = "Photo looks blurry — portions may be estimated less accurately."
    elif is_dark:
        message = "Photo is quite dark — try better lighting for more accurate recognition."
    return {
        "blur_score": round(blur_score, 1),
        "is_blurry": is_blurry,
        "brightness": round(brightness, 1),
        "is_dark": is_dark,
        "message": message,
    }
