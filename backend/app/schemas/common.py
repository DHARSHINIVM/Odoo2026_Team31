import datetime
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    database: str
    tables_count: int
    models_initialized: bool
    timestamp: datetime.datetime


class SeedResponse(BaseModel):
    success: bool
    message: str
    counts: Dict[str, int]
    timestamp: datetime.datetime

