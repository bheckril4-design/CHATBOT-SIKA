from fastapi.testclient import TestClient

import app.main as main_module

from app.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "SAMEORIGIN"
    assert "default-src 'self'" in response.headers["content-security-policy"]


def test_readiness_endpoint_exposes_go_live_checks() -> None:
    client = TestClient(app)
    response = client.get("/readiness")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "not_ready"}
    assert "checks" in payload
    assert "chat_ready" in payload["checks"]
    assert "voice_ready" in payload["checks"]


def test_readiness_is_ready_in_demo_mode_without_openai_key(monkeypatch) -> None:
    monkeypatch.setattr(main_module.settings, "demo_mode", True)
    monkeypatch.setattr(main_module.settings, "openai_api_key", None)

    client = TestClient(app)
    response = client.get("/readiness")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["chat_ready"] is True
    assert payload["checks"]["chat_mode"] == "demo"
    assert "demo_mode_active" in payload["warnings"]
    assert "openai_api_key_missing" not in payload["warnings"]
