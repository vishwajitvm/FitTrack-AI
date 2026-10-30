"""Smoke test for the ML photo pipeline (run inside the backend container against the live API).

    docker compose exec backend python scripts/smoke_test_photo_ml.py

Uses synthetic images, so dish predictions are meaningless — it checks the plumbing:
quality check, duplicate detection, ML-only analysis, saving (calibration + meal memory)
and personal-meal recognition from a different photo.
"""
import io
import json
import random

import httpx
from PIL import Image, ImageDraw, ImageFilter

API = "http://127.0.0.1:8000/api"


def plate_photo(seed: int, shift: int = 0) -> bytes:
    rnd = random.Random(seed)
    img = Image.new("RGB", (900, 700), (235, 232, 225))
    draw = ImageDraw.Draw(img)
    draw.ellipse((150 + shift, 80, 750 + shift, 640), fill=(200, 200, 205))  # steel tiffin
    for _ in range(900):  # rice grains + vegetables
        x, y = rnd.randint(230 + shift, 670 + shift), rnd.randint(150, 570)
        colour = rnd.choice([(245, 225, 160), (240, 200, 120), (90, 150, 60), (200, 90, 40)])
        draw.ellipse((x, y, x + 9, y + 5), fill=colour)
    buf = io.BytesIO()
    img.filter(ImageFilter.GaussianBlur(0.6)).save(buf, "JPEG", quality=90)
    return buf.getvalue()


def analyze(client: httpx.Client, image: bytes | None, **fields) -> dict:
    files = {"image": ("meal.jpg", image, "image/jpeg")} if image else None
    data = {k: str(v) for k, v in fields.items()}
    resp = client.post(f"{API}/food/analyze", files=files, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def show(label: str, a: dict) -> None:
    ml = a.get("ml") or {}
    items = [(i["name"][:28], i["estimated_weight_g"], i["calories"]) for i in a.get("items", [])]
    print(f"{label:34} status={a['status']:9} method={a.get('method'):14} items={items}")
    print(f"{'':34} quality={ml.get('image_quality')} dup_of={ml.get('duplicate_of')} "
          f"preds={[(p['label'][:18], p['score']) for p in ml.get('predictions', [])[:3]]} "
          f"similar={[(m['name'][:18], m['similarity']) for m in ml.get('similar_meals', [])]} calib={ml.get('calibration')}")


with httpx.Client() as client:
    photo_a = plate_photo(1)
    a1 = analyze(client, photo_a, description="fried rice", container_id="tiffin_large", fill_level="half", ml_only="true")
    show("1. ML-only + description", a1)

    a2 = analyze(client, photo_a, container_id="tiffin_large", fill_level="half", ml_only="true")
    show("2. same photo again", a2)

    # Save #1 with a corrected weight (user weighed 300 g) → calibration + meal memory.
    item = dict(a1["items"][0])
    factor = 300 / item["estimated_weight_g"]
    for k in ("estimated_weight_g", "calories", "protein", "carbs", "fat", "fibre"):
        item[k] = round(item[k] * factor, 1)
    saved = client.post(f"{API}/food/analyses/{a1['id']}/save",
                        json={"items": [item], "meal_type": "lunch", "date": "2026-10-27", "time": "13:30"}, timeout=60)
    saved.raise_for_status()
    print(f"{'3. saved with 300 g':34} food_log ids={[f['id'] for f in saved.json()]}")

    photo_b = plate_photo(2, shift=25)  # a different photo of the same kind of meal
    a3 = analyze(client, photo_b, container_id="tiffin_large", fill_level="half", ml_only="true")
    show("4. new photo, same meal", a3)

    a4 = analyze(client, None, description="fried rice", container_id="tiffin_large", fill_level="half", ml_only="true")
    show("5. text-only (calibrated geometry)", a4)

    status = client.get(f"{API}/ml/status").json()
    print("ML stats:", json.dumps(status["stats"]))
    for a in (a1, a2, a3, a4):
        client.delete(f"{API}/food/analyses/{a['id']}")  # no-op if the endpoint doesn't exist
    for f in saved.json():
        client.delete(f"{API}/food/{f['id']}")
    print("cleanup: removed the test food log entries")
