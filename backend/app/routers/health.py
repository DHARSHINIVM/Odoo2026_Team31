import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from app.database import get_db, Base
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    return HealthResponse(
        status="HEALTHY",
        app_name="SunPower Solutions – Solar Installation Management System",
        version="1.0.0-stage1",
        database="SQLite (foreign_keys=ON)",
        tables_count=len(tables),
        models_initialized=len(tables) >= 15,
        timestamp=datetime.datetime.utcnow()
    )

