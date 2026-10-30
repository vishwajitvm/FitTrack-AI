"""End-to-end scenarios for the dashboard daily brief against a RUNNING throwaway backend.

Writes data, so it only runs when FITTRACK_TEST_API points at a test stack (never your real backend); the starting
data is restored from a JSON backup afterwards. Uses the AI providers configured there (a few short calls).

Run:  FITTRACK_TEST_API=http://localhost:8001 pytest tests/test_brief_api.py
"""
import os

import pytest

httpx = pytest.importorskip("httpx")

API = os.environ.get("FITTRACK_TEST_API", "").rstrip("/")
pytestmark = pytest.mark.skipif(not API, reason="set FITTRACK_TEST_API to a throwaway test backend to run these")
KEYS = {"date", "headline", "good", "watch", "next", "tone", "numbers", "source", "generated_at", "cached"}


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=API, timeout=120) as c:
        assert c.get("/api/health").json()["status"] == "ok"
        original = c.get("/api/export/json").content
        yield c
        r = c.post("/api/import/json", files={"file": ("start.json", original, "application/json")})
        assert r.status_code == 200, r.text


def brief(client, **params) -> dict:
    r = client.get("/api/brief", params=params)
    assert r.status_code == 200, r.text
    body = r.json()
    assert KEYS <= set(body)
    assert body["headline"].strip() and body["next"], body
    assert body["tone"] in ("start", "great", "good", "mixed", "off")
    assert "â€" not in body["headline"]
    return body


def test_reload_is_served_from_storage(client):
    first = brief(client)
    again = brief(client)
    assert again["cached"] is True
    assert again["generated_at"] == first["generated_at"]
    assert again["headline"] == first["headline"]


def test_logging_food_rewrites_it_and_deleting_rewrites_again(client):
    before = brief(client)
    today = before["date"]
    added = client.post("/api/food", json={"date": today, "meal_type": "dinner", "food_name": "Brief test paneer tikka", "calories": 420, "protein": 30, "time": "20:00"})
    assert added.status_code == 200, added.text
    after = brief(client)
    assert after["cached"] is False
    assert after["generated_at"] != before["generated_at"]
    assert after["numbers"]["eaten_kcal"] == pytest.approx(before["numbers"]["eaten_kcal"] + 420, abs=1)
    assert after["numbers"]["food_count"] == before["numbers"]["food_count"] + 1
    assert brief(client)["cached"] is True  # and stays put until the next change

    food_id = added.json()["id"]
    assert client.delete(f"/api/food/{food_id}").status_code in (200, 204)
    gone = brief(client)
    assert gone["cached"] is False
    assert gone["numbers"]["eaten_kcal"] == pytest.approx(before["numbers"]["eaten_kcal"], abs=1)


def test_checkin_change_rewrites_it(client):
    before = brief(client)
    r = client.put(f"/api/daily/{before['date']}/checkin", json={"sleep_hours": 4.5})
    assert r.status_code == 200, r.text
    after = brief(client)
    assert after["cached"] is False


def test_refresh_forces_a_rewrite(client):
    before = brief(client)
    forced = brief(client, refresh="true")
    assert forced["cached"] is False and forced["generated_at"] != before["generated_at"]


def test_past_day_and_bad_date(client):
    past = brief(client, date="2026-10-27")
    assert past["date"] == "2026-10-27"
    assert client.get("/api/brief", params={"date": "not-a-date"}).status_code == 422


def test_numbers_are_consistent(client):
    n = brief(client)["numbers"]
    if n["goal_kcal"] is not None and n["eaten_kcal"] is not None:
        assert n["kcal_left"] == round(n["goal_kcal"] - n["eaten_kcal"])
    if n["burned_kcal"] is not None and n["goal_kcal"] is not None:
        assert n["goal_kcal"] <= n["burned_kcal"]  # the goal is a deficit, never above today's burn
