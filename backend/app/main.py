import os
import sys
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Ensure app package is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.database import engine, Base, SessionLocal
from app.models import *  # Import all models to ensure metadata registration
from app.routers import (
    health_router, customers_router, enquiries_router,
    surveys_router, quotations_router, orders_router, catalog_router,
    products_router, inventory_router, bom_order_router, dashboard_router,
    dispatches_router, installations_router, passports_router,
    warranties_router, service_tickets_router, credibility_router,
    analytics_router, auth_router, role_dashboards_router,
    subsidies_router, notifications_router, documents_router, audit_logs_router,
    tasks_router, appointments_router, master_data_router, customer_portal_router
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sunpower")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify and initialize SQLite database schema
    logger.info("Connecting to SunPower Production SQLite Database Schema...")
    Base.metadata.create_all(bind=engine)
    logger.info("All 31 database tables verified and connected successfully.")
    yield


app = FastAPI(
    title="SunPower Solutions – Solar Installation Management System API",
    description="Modular Monolithic Backend for Solar EPC Workflow (Stage 1 Foundation)",
    version="1.0.0-stage1",
    lifespan=lifespan
)

# CORS configuration for local Vite development server
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background Activity & Telemetry Middleware
@app.middleware("http")
async def background_activity_logger_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    
    if not request.url.path.startswith("/uploads"):
        logger.info(
            f"[ACTIVITY_LOG] {request.method} {request.url.path} "
            f"-> Status: {response.status_code} ({duration_ms}ms)"
        )
    return response

# Centralized error handling
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_type": type(exc).__name__,
            "message": str(exc),
            "path": request.url.path,
        }
    )

# Include Routers under /api
app.include_router(health_router, prefix="/api")

app.include_router(auth_router, prefix="/api")
app.include_router(role_dashboards_router, prefix="/api")
app.include_router(customers_router, prefix="/api")
app.include_router(enquiries_router, prefix="/api")
app.include_router(surveys_router, prefix="/api")
app.include_router(quotations_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(catalog_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(bom_order_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(dispatches_router, prefix="/api")
app.include_router(installations_router, prefix="/api")
app.include_router(passports_router, prefix="/api")
app.include_router(warranties_router, prefix="/api")
app.include_router(service_tickets_router, prefix="/api")
app.include_router(credibility_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(subsidies_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(audit_logs_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(appointments_router, prefix="/api")
app.include_router(master_data_router, prefix="/api")
app.include_router(customer_portal_router, prefix="/api")

# Static files for local installation evidence uploads
uploads_dir = os.path.join(parent_dir, "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/")
def root():
    return {
        "app": "SunPower Solutions API",
        "stage": "Stage 1 Foundation",
        "docs": "/docs",
        "health": "/api/health"
    }

