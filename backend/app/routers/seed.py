import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.common import SeedResponse
from app.seed_data import seed_database

router = APIRouter(prefix="/seed", tags=["Seed"])


@router.post("/reset", response_model=SeedResponse)
def reset_seed_data(db: Session = Depends(get_db)):
    try:
        counts = seed_database(db)
        return SeedResponse(
            success=True,
            message="Successfully re-seeded SunPower Solutions with realistic end-to-end solar dataset.",
            counts=counts,
            timestamp=datetime.datetime.utcnow()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset seed data: {str(e)}")

