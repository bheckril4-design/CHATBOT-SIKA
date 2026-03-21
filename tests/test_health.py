from fastapi.testclient import TestClient

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
