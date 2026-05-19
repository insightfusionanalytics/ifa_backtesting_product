from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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


app = FastAPI(
    title="IFA Backtest Product",
    version="0.1.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/healthz")
def healthz():
    return {"ok": True, "service": settings.APP_NAME, "env": settings.APP_ENV}
