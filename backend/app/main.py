"""FastAPI application entry point for RoomieSplit."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.profile import router as profile_router
from app.api.rooms import router as rooms_router
from app.api.expenses import router as expenses_router
from app.api.balances import balances_router, repayments_router
from app.api.reports import router as reports_router

from contextlib import asynccontextmanager
from app.core.database import Base, engine
import app.models  # noqa: F401

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="RoomieSplit API",
    description="Shared household expense and budget management for roommates.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile_router)
app.include_router(rooms_router)
app.include_router(expenses_router)
app.include_router(balances_router)
app.include_router(repayments_router)
app.include_router(reports_router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "RoomieSplit API"}
