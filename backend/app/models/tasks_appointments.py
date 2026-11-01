import datetime
import uuid
import json
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class Task(Base):
    """
    Personal and Automated Operational Task Registry.
    Tracks tasks across Sales, Survey, Installation, Warehouse, Service, and Admin roles.
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    priority = Column(String(20), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, URGENT
    status = Column(String(20), default="PENDING", nullable=False)    # PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, OVERDUE, CANCELLED, BLOCKED
    category = Column(String(50), default="GENERAL", nullable=False)  # SURVEY, INSTALLATION, SALES, INVENTORY, SERVICE, ADMIN, GENERAL

    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    survey_id = Column(Integer, ForeignKey("site_surveys.id", ondelete="SET NULL"), nullable=True)
    installation_id = Column(Integer, ForeignKey("installations.id", ondelete="SET NULL"), nullable=True)
    service_ticket_id = Column(Integer, ForeignKey("service_tickets.id", ondelete="SET NULL"), nullable=True)

    source_event = Column(String(100), nullable=True)  # e.g., SURVEY_ASSIGNED, INSTALLATION_SCHEDULED, STOCK_SHORTAGE
    comments = Column(Text, default="[]", nullable=False)  # JSON-encoded array of comment objects

    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    customer = relationship("Customer")
    order = relationship("Order")
    survey = relationship("SiteSurvey")
    installation = relationship("Installation")
    service_ticket = relationship("ServiceTicket")

    @property
    def is_overdue(self) -> bool:
        if self.status in ("COMPLETED", "CANCELLED") or not self.due_date:
            return False
        # Normalize timezone-naive or aware
        now = get_utc_now()
        due = self.due_date
        if due.tzinfo is None and now.tzinfo is not None:
            now = now.replace(tzinfo=None)
        return due < now

    @property
    def comment_list(self):
        try:
            return json.loads(self.comments or "[]")
        except Exception:
            return []

    def add_comment(self, user_id: int, user_name: str, text: str):
        lst = self.comment_list
        lst.append({
            "user_id": user_id,
            "user_name": user_name,
            "text": text,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        self.comments = json.dumps(lst)


class Appointment(Base):
    """
    Customer & Field Operations Appointment Registry.
    Supports Site Survey, Installation, and Service appointment scheduling with double-booking prevention.
    """
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    appointment_number = Column(String(40), unique=True, index=True, nullable=False)

    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    appointment_type = Column(String(30), default="SITE_SURVEY", nullable=False)  # SITE_SURVEY, INSTALLATION, SERVICE, CONSULTATION

    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    survey_id = Column(Integer, ForeignKey("site_surveys.id", ondelete="SET NULL"), nullable=True)
    installation_id = Column(Integer, ForeignKey("installations.id", ondelete="SET NULL"), nullable=True)
    assigned_tech_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    scheduled_date = Column(DateTime, nullable=False)
    time_slot = Column(String(30), default="10:00 - 12:00", nullable=False)  # 09:00 - 11:00, 11:00 - 13:00, 14:00 - 16:00, 16:00 - 18:00
    status = Column(String(30), default="REQUESTED", nullable=False)          # REQUESTED, CONFIRMED, ASSIGNED, RESCHEDULED, COMPLETED, CANCELLED

    customer_notes = Column(Text, nullable=True)
    technician_notes = Column(Text, nullable=True)
    service_address = Column(String(255), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    customer = relationship("Customer")
    order = relationship("Order")
    survey = relationship("SiteSurvey")
    installation = relationship("Installation")
    assigned_tech = relationship("User", foreign_keys=[assigned_tech_id])

