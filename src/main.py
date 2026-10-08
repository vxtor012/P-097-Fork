import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import get_settings
from src.db import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"🚀 Starting {settings.app_name} in {settings.app_env} mode")
    try:
        await init_db()
        logger.info("✅ Database connected")
    except Exception as e:
        logger.warning(f"⚠️  DB chưa sẵn sàng: {e} — chạy không có DB")
    yield
    logger.info("🛑 Shutting down...")


settings = get_settings()
app = FastAPI(
    title="VinFast AI Agent",
    description="AI Agent + Car Configurator API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
