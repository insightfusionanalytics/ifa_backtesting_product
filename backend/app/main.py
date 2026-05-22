from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.security import init_firebase

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Starting {} ({})", settings.APP_NAME, settings.APP_ENV)
    init_firebase()
    yield
    logger.info("Shutting down")


# Hide auto-generated docs outside of local/dev to reduce surface area in prod.
_DOCS_URL = "/docs" if settings.APP_ENV in ("local", "dev") else None
_REDOC_URL = "/redoc" if settings.APP_ENV in ("local", "dev") else None
_OPENAPI_URL = "/openapi.json" if settings.APP_ENV in ("local", "dev") else None

app = FastAPI(
    title="IFA Backtest Product",
    version="0.1.0",
    docs_url=_DOCS_URL,
    redoc_url=_REDOC_URL,
    openapi_url=_OPENAPI_URL,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def _unhandled_exception(request: Request, exc: Exception):
    """Catch-all so a server bug never leaks a stack trace to the client.
    The traceback is still logged."""
    logger.exception("Unhandled exception on {} {}", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/healthz")
def healthz():
    return {"ok": True, "service": settings.APP_NAME, "env": settings.APP_ENV}
