import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey,
    Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(120), nullable=True)
    phone = Column(String(20), nullable=False, index=True)
    address = Column(Text, nullable=False)
    city = Column(String(80), nullable=False)
    state = Column(String(80), nullable=False, default="Maharashtra")
    pincode = Column(String(10), nullable=False)
    consumer_number = Column(String(50), nullable=True)
    installation_address = Column(Text, nullable=True)
    contact_preferences = Column(Text, default='{"preferred_channel": "WHATSAPP", "notify_sms": true, "notify_email": true, "notify_push": true}', nullable=False)
    avg_monthly_bill_paise = Column(Integer, default=0, nullable=False)
    sanctioned_load_kw = Column(Float, default=0.0)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    enquiries = relationship("Enquiry", back_populates="customer", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="customer")
    orders = relationship("Order", back_populates="customer")
    passports = relationship("DigitalSolarPassport", back_populates="customer")
    service_tickets = relationship("ServiceTicket", back_populates="customer")
    feedbacks = relationship("CustomerFeedback", back_populates="customer", cascade="all, delete-orphan")


class Enquiry(Base):
    """
    Module 3: Extended CRM & Enquiry Management
    Supports Sales Rep Assignment, Priority, Follow-ups, Sources, Interaction History.
    Lifecycle: NEW -> ASSIGNED -> CONTACTED -> SURVEY_REQUESTED -> SURVEY_SCHEDULED -> SURVEY_COMPLETED -> QUOTED -> ORDER_PLACED (or REJECTED / LOST)
    """
    __tablename__ = "enquiries"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    enquiry_number = Column(String(30), unique=True, index=True, nullable=False)
    required_capacity_kw = Column(Float, nullable=False)
    property_type = Column(String(50), default="Residential", nullable=False)
    roof_type = Column(String(50), default="RCC Flat", nullable=False)
    grid_type = Column(String(30), default="ON_GRID", nullable=False)  # ON_GRID, OFF_GRID, HYBRID
    budget_paise = Column(Integer, nullable=True)
    
    # Extended CRM Fields
    assigned_sales_rep_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sales_rep_name = Column(String(100), default="Unassigned", nullable=True)
    source = Column(String(50), default="WEBSITE", nullable=False)  # WEBSITE, REFERRAL, PM_SURYA_GHAR, COLD_CALL, EXHIBITION
    lead_priority = Column(String(20), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, URGENT
    
    follow_up_date = Column(DateTime, nullable=True)
    follow_up_notes = Column(Text, nullable=True)
    next_action = Column(String(120), nullable=True)
    interaction_history = Column(Text, default="[]", nullable=False)  # JSON-encoded array of interaction logs
    
    # Workflow Status
    status = Column(String(40), default="NEW", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    customer = relationship("Customer", back_populates="enquiries")
    assigned_sales_rep = relationship("User", foreign_keys=[assigned_sales_rep_id], back_populates="assigned_enquiries")
    surveys = relationship("SiteSurvey", back_populates="enquiry", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="enquiry")


class SiteSurvey(Base):
    """
    Module 4: Detailed Site Survey & Approval Lifecycle
    Lifecycle: REQUESTED -> ASSIGNED -> IN_PROGRESS -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED
    Enforces technician assignment, detailed physical measurements, photographs, and manager review gate.
    """
    __tablename__ = "site_surveys"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    enquiry_id = Column(Integer, ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False)
    survey_number = Column(String(30), unique=True, index=True, nullable=False)
    
    # Assignment
    assigned_technician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    surveyor_name = Column(String(100), nullable=False)
    survey_date = Column(DateTime, default=get_utc_now, nullable=False)
    
    # Roof & Shading Physical Measurements
    roof_dimensions = Column(String(80), default="12m x 8m", nullable=True)
    roof_area_sqft = Column(Float, nullable=False)
    usable_roof_area_sqft = Column(Float, nullable=False)
    shadow_free_area_sqft = Column(Float, default=0.0, nullable=True)
    roof_type = Column(String(50), default="RCC Flat", nullable=False)
    roof_azimuth_deg = Column(Float, default=180.0)
    tilt_angle_deg = Column(Float, default=15.0)
    shading_loss_pct = Column(Float, default=5.0)
    structural_integrity = Column(String(30), default="GOOD", nullable=False)  # POOR, FAIR, GOOD, EXCELLENT
    
    # Electrical System Observations
    sanctioned_electrical_load_kw = Column(Float, default=5.0, nullable=True)
    meter_type = Column(String(40), default="THREE_PHASE", nullable=False)
    inverter_distance_meters = Column(Float, default=12.0)
    electrical_observations = Column(Text, nullable=True)
    
    # Recommendations
    recommended_capacity_kw = Column(Float, nullable=False)
    structure_recommendation = Column(String(100), default="Elevated Galvanized Structure", nullable=True)
    technician_observations = Column(Text, nullable=True)
    site_photographs = Column(Text, default="[]", nullable=False)  # JSON-encoded array of photo URLs
    
    # Review & Approval Gate
    status = Column(String(30), default="APPROVED", nullable=False)  # REQUESTED, ASSIGNED, IN_PROGRESS, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    enquiry = relationship("Enquiry", back_populates="surveys")
    assigned_technician = relationship("User", foreign_keys=[assigned_technician_id], back_populates="assigned_surveys")
    quotations = relationship("Quotation", back_populates="survey")


class CustomerFeedback(Base):
    """
    Customer Satisfaction & Quality Feedback Registry.
    Records ratings and verified comments for installation milestones and service completions.
    """
    __tablename__ = "customer_feedback"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    installation_id = Column(Integer, ForeignKey("installations.id", ondelete="SET NULL"), nullable=True, index=True)
    service_ticket_id = Column(Integer, ForeignKey("service_tickets.id", ondelete="SET NULL"), nullable=True, index=True)

    feedback_type = Column(String(40), default="INSTALLATION", nullable=False)  # INSTALLATION, SERVICE, SURVEY, GENERAL
    rating = Column(Integer, nullable=False)  # 1 to 5 Stars
    category_ratings = Column(Text, default="{}", nullable=False)  # JSON-encoded criteria ratings
    comments = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    customer = relationship("Customer", back_populates="feedbacks")
    order = relationship("Order")
    installation = relationship("Installation")
    service_ticket = relationship("ServiceTicket")

