from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import get_settings
from app.rate_limit import SimpleRateLimitMiddleware
from app.routers.calculate import router as calculate_router
from app.routers.chat import router as chat_router
from app.routers.finance import router as finance_router
from app.routers.voice import router as voice_router

settings = get_settings()
REPO_ROOT = Path(__file__).resolve().parents[2]
WIDGET_DIR = REPO_ROOT / "frontend" / "widget"
ASSISTANT_DIR = REPO_ROOT / "frontend" / "assistant"
DIST_DIR = REPO_ROOT / "dist"

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    summary="API MVP pour le chatbot financier SIKA",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SimpleRateLimitMiddleware,
    limit_per_minute=settings.rate_limit_per_minute,
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_host_list,
)

app.include_router(chat_router)
app.include_router(calculate_router)
app.include_router(finance_router)
app.include_router(voice_router)

if WIDGET_DIR.exists():
    app.mount("/widget", StaticFiles(directory=WIDGET_DIR), name="widget")

if ASSISTANT_DIR.exists():
    app.mount("/assistant-app", StaticFiles(directory=ASSISTANT_DIR, html=True), name="assistant-app")


def _frame_ancestors(path: str) -> str:
    if settings.environment == "production":
        return "'self'"

    if path.startswith("/assistant-app"):
        return "'self' http://localhost:3000 http://127.0.0.1:3000"

    return "'self'"


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=(self)"
    response.headers["Cross-Origin-Resource-Policy"] = "same-site"
    frame_ancestors = _frame_ancestors(request.url.path)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        f"frame-ancestors {frame_ancestors}; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    if settings.environment == "production":
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    elif not request.url.path.startswith("/assistant-app"):
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
    return response


@app.get("/")
async def root():
    if settings.serve_frontend_from_backend and DIST_DIR.exists():
        return FileResponse(DIST_DIR / "index.html")
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "demo_mode": settings.demo_mode,
        "status": "ok",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readiness")
async def readiness() -> dict[str, object]:
    if settings.demo_mode:
        chat_mode = "demo"
        chat_ready = True
    elif settings.ai_provider == "ollama":
        chat_mode = "ollama"
        chat_ready = bool(settings.ollama_model and settings.ollama_base_url)
    elif settings.ai_provider == "openai":
        chat_mode = "openai"
        chat_ready = bool(settings.openai_api_key)
    else:
        if settings.openai_api_key:
            chat_mode = "openai"
            chat_ready = True
        elif settings.ollama_model and settings.ollama_base_url:
            chat_mode = "ollama"
            chat_ready = True
        else:
            chat_mode = "unavailable"
            chat_ready = False
    finance_ready = (
        settings.market_data_provider != "demo"
        and (
            bool(settings.twelve_data_api_key)
            or bool(settings.exchange_rate_api_key)
            or bool(settings.alpha_vantage_api_key)
        )
    )
    trusted_hosts_ready = bool(settings.trusted_host_list)
    cors_ready = bool(settings.cors_origins)

    warnings: list[str] = []
    if settings.demo_mode:
        warnings.append("demo_mode_active")
    if not settings.demo_mode and chat_mode == "openai" and not settings.openai_api_key:
        warnings.append("openai_api_key_missing")
    if not settings.demo_mode and chat_mode == "ollama" and not (settings.ollama_model and settings.ollama_base_url):
        warnings.append("ollama_not_fully_configured")
    if settings.market_data_provider == "demo":
        warnings.append("finance_provider_demo")
    if not finance_ready:
        warnings.append("finance_provider_not_fully_configured")
    warnings.append("voice_endpoints_placeholder")

    return {
        "status": "ready" if chat_ready and trusted_hosts_ready and cors_ready else "not_ready",
        "environment": settings.environment,
        "checks": {
            "chat_ready": chat_ready,
            "chat_mode": chat_mode,
            "finance_ready": finance_ready,
            "trusted_hosts_ready": trusted_hosts_ready,
            "cors_ready": cors_ready,
            "voice_ready": False,
        },
        "warnings": warnings,
    }


def _serve_frontend_enabled() -> bool:
    return settings.serve_frontend_from_backend and DIST_DIR.exists()


def _resolve_frontend_file(full_path: str) -> Path:
    relative_path = full_path.strip("/") or "index.html"
    candidate = (DIST_DIR / relative_path).resolve()
    dist_root = DIST_DIR.resolve()
    if not str(candidate).startswith(str(dist_root)):
        raise HTTPException(status_code=404, detail="Not Found")
    if candidate.is_file():
        return candidate
    return DIST_DIR / "index.html"


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend_app(full_path: str):
    if not _serve_frontend_enabled():
        raise HTTPException(status_code=404, detail="Not Found")

    if full_path.startswith(("chat", "calculate", "market-data", "voice-to-text", "text-to-speech", "health", "readiness", "widget", "assistant-app")):
        raise HTTPException(status_code=404, detail="Not Found")

    return FileResponse(_resolve_frontend_file(full_path))
