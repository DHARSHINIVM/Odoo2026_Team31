import datetime
import uuid
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class SystemConfiguration(Base):
    """
    Enterprise System Configuration & Master Data Registry
    Stores configurable business rules, pricing & tax rules, BOM templates,
    checklists, and system-wide application settings.
    """
    __tablename__ = "system_configurations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    key = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(50), nullable=False)  # PRICING_TAX, BOM_TEMPLATE, CHECKLIST, APP_SETTINGS, BUSINESS_RULES
    value_json = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

