"""Tests for FastAPI routes — health and static endpoints."""


def test_root_returns_ok(client):
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data


def test_crops_list(client):
    res = client.get("/api/crops/")
    assert res.status_code == 200
    data = res.json()
    assert "crops" in data
    assert len(data["crops"]) > 0


def test_crops_states(client):
    res = client.get("/api/crops/states")
    assert res.status_code == 200
    data = res.json()
    assert "states" in data
    assert "Tamil Nadu" in data["states"]
