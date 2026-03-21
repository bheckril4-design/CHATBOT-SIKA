import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SimpleRateLimitMiddleware(BaseHTTPMiddleware):
    EXCLUDED_PATH_PREFIXES = ("/health", "/docs", "/openapi.json", "/widget", "/assistant-app")

    def __init__(self, app, limit_per_minute: int = 30) -> None:
        super().__init__(app)
        self.limit_per_minute = limit_per_minute
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if any(request.url.path.startswith(prefix) for prefix in self.EXCLUDED_PATH_PREFIXES):
            return await call_next(request)

        client_id = request.client.host if request.client else "anonymous"
        now = time.time()
        window_start = now - 60
        bucket = self.hits[client_id]

        while bucket and bucket[0] < window_start:
            bucket.popleft()

        if len(bucket) >= self.limit_per_minute:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Trop de requetes. Merci de reessayer dans une minute."
                },
            )

        bucket.append(now)
        return await call_next(request)
