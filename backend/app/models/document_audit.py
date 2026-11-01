import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class Document(Base):
    """
    Feature 6: Enterprise Document Management Model
    Stores metadata for documents across all business modules:
    Customers, Enquiries, Surveys, Quotations, Orders, Installations,
    Solar Passports, Warranties, and Service Tickets.
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # SURVEY_REPORT, QUOTATION_DOC, INSTALLATION_PHOTO, COMMISSIONING_REPORT, WARRANTY_CERTIFICATE, SERVICE_DOCUMENT, CUSTOMER_ID_PROOF, ELECTRICITY_BILL, OTHER

    # Storage details (actual content kept on local disk, never raw blobs in SQLite)
    file_name = Column(String(255), nullable=False)  # Sanitized local filename
    original_file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Relative to uploads dir
    file_url = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), default="application/octet-stream", nullable=False)

    # Associated Business Entity Linkage
    entity_type = Column(String(50), index=True, nullable=False)  # CUSTOMER, ENQUIRY, SURVEY, QUOTATION, ORDER, INSTALLATION, PASSPORT, WARRANTY, SERVICE_TICKET, COMPONENT
    entity_id = Column(Integer, index=True, nullable=False)
    entity_identifier = Column(String(100), index=True, nullable=True)  # Human-readable code e.g. ORD-2026-0001, CUST-101, etc.

    # Audit & Upload Tracking
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_by_name = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by_user_id])

    __table_args__ = (
        Index("idx_doc_entity", "entity_type", "entity_id"),
    )


class AuditLog(Base):
    """
    Feature 8: Traceable Enterprise Audit Trail
    Records authenticated user actions, status changes, and critical decisions
    across Enquiries, Surveys, Quotations, Orders, Transfers, Dispatches,
    Installations, Passports, Warranties, Service Tickets, Documents, and RBAC.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    timestamp = Column(DateTime, default=get_utc_now, index=True, nullable=False)

    # Actor Details
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_name = Column(String(100), nullable=True)
    user_role = Column(String(50), nullable=True)

    # Action & Target
    action = Column(String(50), index=True, nullable=False)  # CREATE, UPDATE, STATUS_CHANGE, APPROVE, REJECT, ALLOCATE, DISPATCH, COMMISSION, TRANSFER, PAYMENT, EXPENSE, UPLOAD, ARCHIVE, RBAC_CHANGE
    entity_type = Column(String(50), index=True, nullable=False)  # ENQUIRY, SURVEY, QUOTATION, ORDER, INVENTORY_TRANSFER, DISPATCH, INSTALLATION, PASSPORT, WARRANTY, SERVICE_TICKET, PAYMENT, PROJECT_EXPENSE, DOCUMENT, USER, COMPONENT
    entity_id = Column(Integer, index=True, nullable=True)
    entity_identifier = Column(String(100), index=True, nullable=True)

    # Detailed Context (JSON formatted before & after diffs, excluding secrets)
    old_values = Column(Text, nullable=True)  # JSON representation of changed fields before
    new_values = Column(Text, nullable=True)  # JSON representation of changed fields after
    details = Column(Text, nullable=True)     # Human-readable summary
    ip_address = Column(String(50), nullable=True)

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("idx_audit_entity", "entity_type", "entity_id"),
        Index("idx_audit_action_time", "action", "timestamp"),
    )

