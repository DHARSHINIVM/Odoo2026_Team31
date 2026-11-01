import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
)
from sqlalchemy.orm import relationship
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class SubsidyApplication(Base):
    """
    Module 9: Central Government PM Surya Ghar / State DISCOM Solar Subsidy Tracking
    Links customer and installation, tracks document checklist, inspector clearance, and disbursement.
    """
    __tablename__ = "subsidy_applications"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    application_number = Column(String(40), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    installation_id = Column(Integer, ForeignKey("installations.id", ondelete="SET NULL"), nullable=True)

    discom_name = Column(String(100), default="MSEDCL", nullable=False)
    consumer_number = Column(String(50), nullable=False)
    system_capacity_kw = Column(Float, nullable=False)
    subsidy_scheme = Column(String(100), default="PM Surya Ghar: Muft Bijli Yojana", nullable=False)
    
    # Financial amounts stored as integer paise
    eligible_subsidy_paise = Column(Integer, default=7800000, nullable=False)  # e.g. Rs. 78,000
    disbursed_subsidy_paise = Column(Integer, default=0, nullable=False)

    # Workflow Statuses: DRAFT -> SUBMITTED -> INSPECTION_CLEARED -> APPROVED -> DISBURSED (or REJECTED)
    status = Column(String(40), default="DRAFT", nullable=False)
    
    # JSON-encoded array of document checklist items (e.g. Electricity Bill, Aadhaar, Bank Passbook, Net Meter Testing Report)
    document_checklist = Column(Text, default="[]", nullable=False)
    
    application_date = Column(DateTime, default=get_utc_now, nullable=False)
    inspection_date = Column(DateTime, nullable=True)
    approval_date = Column(DateTime, nullable=True)
    disbursement_date = Column(DateTime, nullable=True)
    disbursement_reference = Column(String(100), nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    order = relationship("Order")
    customer = relationship("Customer")
    installation = relationship("Installation")


class Notification(Base):
    """
    Module 11: Real-Time In-App Notification System
    Alerts users on assignments, follow-ups, survey reviews, inventory alerts, and warranty events.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # Specific recipient, or null for role broadcast
    target_role = Column(String(40), nullable=True)  # Target role broadcast e.g. "WAREHOUSE_MANAGER"
    
    category = Column(String(50), default="WORKFLOW", nullable=False)  # ENQUIRY, SURVEY, ORDER, INVENTORY, DISPATCH, INSTALLATION, SERVICE, WARRANTY
    title = Column(String(120), nullable=False)
    message = Column(Text, nullable=False)
    link_url = Column(String(200), nullable=True)
    
    related_entity_type = Column(String(50), nullable=True)  # e.g. "Enquiry", "SiteSurvey", "Order"
    related_entity_id = Column(Integer, nullable=True)
    
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    user = relationship("User", back_populates="notifications")

