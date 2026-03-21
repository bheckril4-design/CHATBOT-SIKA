from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_widget_assets_are_served() -> None:
    js_response = client.get("/widget/sika-chatbot.js")
    css_response = client.get("/widget/sika-chatbot.css")

    assert js_response.status_code == 200
    assert "text/javascript" in js_response.headers["content-type"]
    assert css_response.status_code == 200
    assert "text/css" in css_response.headers["content-type"]


def test_assistant_app_is_served() -> None:
    response = client.get("/assistant-app/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "SIKA Assistant" in response.text
