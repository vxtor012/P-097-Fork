import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from src.api.routes import router
from src.config import get_settings
from src.db import engine, init_db

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
        logger.warning("Database unavailable during startup (%s)", type(e).__name__)
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


@app.get("/ready")
async def readiness():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
            schema_ready = bool(
                (
                    await connection.execute(
                        text(
                            "SELECT to_regclass('public.auth_sessions') IS NOT NULL AND to_regclass('public.quote_requests') IS NOT NULL"
                        )
                    )
                ).scalar()
            )
            rag = bool(
                (await connection.execute(text("SELECT EXISTS(SELECT FROM ai_data.datasets WHERE is_active)"))).scalar()
            )
        data = {
            "status": "ready" if schema_ready else "migration_required",
            "database": "connected",
            "schema_ready": schema_ready,
            "ai_configured": bool(settings.openai_api_key or settings.google_api_key),
            "rag_dataset_ready": rag,
        }
        return JSONResponse(data, status_code=200 if schema_ready else 503)
    except Exception:
        return JSONResponse({"status": "unavailable", "database": "unavailable"}, status_code=503)
