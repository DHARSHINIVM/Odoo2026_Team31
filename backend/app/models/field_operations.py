import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    dispatch_number = Column(String(40), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False)
    source_warehouses = Column(String(255), nullable=True)
    vehicle_number = Column(String(40), default="MH-12-SP-2026", nullable=False)
    driver_name = Column(String(100), default="Kishore Gaikwad", nullable=False)
    driver_phone = Column(String(20), default="+91 98220 77112", nullable=False)
    dispatch_date = Column(DateTime, default=get_utc_now, nullable=False)
    estimated_delivery_date = Column(DateTime, nullable=True)
    delivery_date = Column(DateTime, nullable=True)
    status = Column(String(30), default="IN_TRANSIT", nullable=False)  # PREPARING, DISPATCHED, IN_TRANSIT, DELIVERED, RETURNED
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="dispatches")
    warehouse = relationship("Warehouse", back_populates="dispatches")
    serialized_items = relationship("SerializedItem", back_populates="dispatch", cascade="all, delete-orphan")

    @property
    def actual_delivery_date(self):
        return self.delivery_date

    @actual_delivery_date.setter
    def actual_delivery_date(self, val):
        self.delivery_date = val


class SerializedItem(Base):
    __tablename__ = "serialized_items"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="RESTRICT"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True)
    installation_id = Column(Integer, ForeignKey("installations.id", ondelete="SET NULL"), nullable=True)
    serial_number = Column(String(100), unique=True, index=True, nullable=False)
    barcode_format = Column(String(30), default="CODE128", nullable=False)
    scanned_at = Column(DateTime, default=get_utc_now, nullable=False)
    lifecycle_status = Column(String(30), default="IN_TRANSIT", nullable=False)
    verification_status = Column(String(30), default="VERIFIED", nullable=False)

    dispatch = relationship("Dispatch", back_populates="serialized_items")
    component = relationship("Component", back_populates="serialized_items")
    warehouse = relationship("Warehouse")
    installation = relationship("Installation", back_populates="serialized_items")


class Installation(Base):
    """
    Module 6: Digital Installation Worksheet & Commissioning Sign-off
    Supports 8-point checklist, real electrical measurements, photo uploads, customer sign-off.
    Workflow: CONFIRMED -> READY_FOR_DISPATCH -> DISPATCHED -> SCHEDULED -> IN_PROGRESS -> QUALITY_CHECK -> CUSTOMER_SIGNOFF -> COMMISSIONED
    """
    __tablename__ = "installations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    installation_number = Column(String(40), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    
    # Technician Assignment
    assigned_tech_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_technician = Column(String(100), default="Ramesh Patil (Lead Solar Engineer)", nullable=False)
    lead_engineer = Column(String(100), default="Ramesh Patil", nullable=False)
    team_technician_ids = Column(Text, default="[]", nullable=False)  # JSON-encoded list of technician IDs
    team_size = Column(Integer, default=4, nullable=False)
    installation_address = Column(String(255), nullable=True)
    scheduled_start_date = Column(DateTime, default=get_utc_now, nullable=False)
    completion_date = Column(DateTime, nullable=True)
    commissioning_date = Column(DateTime, nullable=True)
    status = Column(String(30), default="SCHEDULED", nullable=False)  # SCHEDULED, IN_PROGRESS, QUALITY_CHECK, CUSTOMER_SIGNOFF, COMMISSIONED, FAILED_INSPECTION

    # Mandatory Commissioning Checklist Items (Persistently Stored)
    chk_structure_installed = Column(Boolean, default=False, nullable=False)
    chk_panels_installed = Column(Boolean, default=False, nullable=False)
    chk_inverter_installed = Column(Boolean, default=False, nullable=False)
    chk_electrical_completed = Column(Boolean, default=False, nullable=False)
    chk_earthing_completed = Column(Boolean, default=False, nullable=False)
    chk_safety_checks_completed = Column(Boolean, default=False, nullable=False)
    chk_system_tested = Column(Boolean, default=False, nullable=False)
    chk_customer_handover_completed = Column(Boolean, default=False, nullable=False)

    # Commissioning Electrical Readings (Module 6)
    voltage_reading_volts = Column(Float, default=230.0, nullable=False)
    current_reading_amps = Column(Float, default=20.0, nullable=False)
    power_output_kw = Column(Float, default=0.0, nullable=False)
    grid_frequency_hz = Column(Float, default=50.0, nullable=False)
    earthing_resistance_ohms = Column(Float, default=2.1, nullable=False)
    peak_power_tested_kw = Column(Float, default=0.0, nullable=False)
    grid_sync_successful = Column(Boolean, default=False, nullable=False)

    # Customer Sign-Off Details
    customer_signed_by_name = Column(String(100), nullable=True)
    customer_signoff_date = Column(DateTime, nullable=True)
    customer_feedback_rating = Column(Integer, default=5, nullable=True)  # 1 to 5 Stars
    customer_remarks = Column(Text, nullable=True)
    commissioning_signed = Column(Boolean, default=False, nullable=False)

    commissioning_report_url = Column(String(255), nullable=True)
    team_notes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    evidence_files = Column(Text, default="[]", nullable=False)  # JSON-encoded array of upload records

    @property
    def team_technicians(self):
        try:
            import json
            return json.loads(self.team_technician_ids or "[]")
        except Exception:
            return []

    @team_technicians.setter
    def team_technicians(self, val):
        import json
        if isinstance(val, list):
            self.team_technician_ids = json.dumps(val)
        else:
            self.team_technician_ids = "[]"

    order = relationship("Order", back_populates="installations")
    assigned_tech_user = relationship("User", foreign_keys=[assigned_tech_id], back_populates="assigned_installations")
    serialized_items = relationship("SerializedItem", back_populates="installation")
    passport = relationship("DigitalSolarPassport", back_populates="installation", uselist=False)
    service_tickets = relationship("ServiceTicket", back_populates="installation")


class DigitalSolarPassport(Base):
    __tablename__ = "digital_solar_passports"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    passport_number = Column(String(50), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    installation_id = Column(Integer, ForeignKey("installations.id", ondelete="SET NULL"), nullable=True)
    qr_code_token = Column(String(64), unique=True, index=True, nullable=False)
    system_capacity_kw = Column(Float, nullable=False)
    grid_type = Column(String(30), default="ON_GRID", nullable=False)
    commissioning_date = Column(DateTime, default=get_utc_now, nullable=False)
    pv_module_summary = Column(Text, nullable=True)
    inverter_summary = Column(Text, nullable=True)
    estimated_lifetime_mwh = Column(Float, default=0.0, nullable=False)
    co2_offset_tonnes = Column(Float, default=0.0, nullable=False)
    system_health_score = Column(Integer, default=98, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Lifecycle & Warehouse Creation Fields (Phase 2.5)
    lifecycle_status = Column(String(50), default="CREATED_AT_WAREHOUSE", nullable=False) # CREATED_AT_WAREHOUSE, DISPATCHED, AWAITING_INSTALLATION, INSTALLATION_IN_PROGRESS, INSTALLATION_SUBMITTED, ACTIVE, SERVICE_REQUIRED, CLOSED
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id", ondelete="SET NULL"), nullable=True)
    warehouse_manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    dispatch_date = Column(DateTime, nullable=True)
    battery_summary = Column(Text, nullable=True)
    other_components_summary = Column(Text, nullable=True)
    installation_start_time = Column(DateTime, nullable=True)
    installation_completed_time = Column(DateTime, nullable=True)
    technical_readings = Column(Text, nullable=True)
    customer_acknowledgement = Column(Text, nullable=True)

    order = relationship("Order", back_populates="passport")
    customer = relationship("Customer", back_populates="passports")
    installation = relationship("Installation", back_populates="passport")
    warehouse = relationship("Warehouse")
    dispatch = relationship("Dispatch")
    warehouse_manager = relationship("User", foreign_keys=[warehouse_manager_id])
    warranties = relationship("Warranty", back_populates="passport", cascade="all, delete-orphan")
    service_tickets = relationship("ServiceTicket", back_populates="passport")


class WarrantyPolicy(Base):
    """
    Module 7: Standard Manufacturer & EPC Warranty Policies
    Defines baseline warranty terms, durations, and conditions by category & manufacturer.
    """
    __tablename__ = "warranty_policies"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    code = Column(String(40), unique=True, index=True, nullable=False)
    manufacturer = Column(String(100), nullable=False)
    component_category = Column(String(50), nullable=False)  # PANEL, INVERTER, STRUCTURE, BATTERY, CABLE
    model_name = Column(String(100), nullable=True)
    duration_years = Column(Integer, nullable=False)
    warranty_type = Column(String(50), nullable=False)  # EQUIPMENT_PERFORMANCE, PRODUCT_REPLACEMENT, WORKMANSHIP_EPC
    terms_summary = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    warranties = relationship("Warranty", back_populates="policy")


class Warranty(Base):
    __tablename__ = "warranties"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    passport_id = Column(Integer, ForeignKey("digital_solar_passports.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="RESTRICT"), nullable=False)
    policy_id = Column(Integer, ForeignKey("warranty_policies.id", ondelete="SET NULL"), nullable=True)
    serial_number = Column(String(100), index=True, nullable=True)
    manufacturer = Column(String(100), nullable=True)
    warranty_type = Column(String(50), nullable=False)
    duration_years = Column(Integer, nullable=False)
    start_date = Column(DateTime, default=get_utc_now, nullable=False)
    end_date = Column(DateTime, nullable=False)
    terms_summary = Column(Text, nullable=True)
    status = Column(String(30), default="ACTIVE", nullable=False)  # ACTIVE, EXPIRING_SOON, EXPIRED, VOID

    passport = relationship("DigitalSolarPassport", back_populates="warranties")
    component = relationship("Component", back_populates="warranties")
    policy = relationship("WarrantyPolicy", back_populates="warranties")


class ServiceTicket(Base):
    """
    Module 8: Service & O&M Ticket Lifecycle
    Lifecycle: NEW_COMPLAINT -> WARRANTY_CHECK -> ASSIGNED -> DIAGNOSIS -> REPAIR_IN_PROGRESS -> QUALITY_CHECK -> CUSTOMER_CONFIRMATION -> CLOSED
    """
    __tablename__ = "service_tickets"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    ticket_number = Column(String(40), unique=True, index=True, nullable=False)
    passport_id = Column(Integer, ForeignKey("digital_solar_passports.id", ondelete="SET NULL"), nullable=True)
    installation_id = Column(Integer, ForeignKey("installations.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="SET NULL"), nullable=True)
    serial_number = Column(String(100), nullable=True)
    
    # Categorization & Priority
    issue_category = Column(String(50), nullable=False)  # INVERTER_FAULT, PANEL_DAMAGE, GRID_TRIP, WIRING_ISSUE, GENERATION_DROP, GENERAL_QUERY
    priority = Column(String(20), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    description = Column(Text, nullable=False)
    
    # Technician Assignment
    assigned_tech_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_technician = Column(String(100), nullable=True)
    
    # Warranty & Repair Diagnostics
    is_warranty_covered = Column(Boolean, default=True, nullable=False)
    diagnosis_notes = Column(Text, nullable=True)
    parts_used = Column(Text, default="[]", nullable=False)  # JSON-encoded array: [{"component": "Waaree 550W", "qty": 1, "cost_paise": 990000}]
    labour_hours = Column(Float, default=0.0, nullable=False)
    labour_cost_paise = Column(Integer, default=0, nullable=False)
    repair_expenses_paise = Column(Integer, default=0, nullable=False)
    customer_confirmation_notes = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    status = Column(String(35), default="NEW_COMPLAINT", nullable=False)  # NEW_COMPLAINT, WARRANTY_CHECK, ASSIGNED, DIAGNOSIS, REPAIR_IN_PROGRESS, QUALITY_CHECK, CUSTOMER_CONFIRMATION, RESOLVED, CLOSED
    complaint_source = Column(String(50), default="INTERNAL", nullable=False)  # INTERNAL, DIGITAL_PASSPORT, CUSTOMER_PORTAL
    evidence_files = Column(Text, default="[]", nullable=False)  # JSON-encoded array of photos/documents
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    passport = relationship("DigitalSolarPassport", back_populates="service_tickets")
    installation = relationship("Installation", back_populates="service_tickets")
    customer = relationship("Customer", back_populates="service_tickets")
    assigned_tech_user = relationship("User", foreign_keys=[assigned_tech_id], back_populates="assigned_service_tickets")
    component = relationship("Component")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    payment_number = Column(String(40), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    milestone = Column(String(50), nullable=False)  # ADVANCE, STRUCTURE_DELIVERY, INSTALLATION_COMPLETE, COMMISSIONING
    payment_mode = Column(String(40), default="BANK_TRANSFER", nullable=False)
    transaction_reference = Column(String(100), nullable=True)
    paid_at = Column(DateTime, default=get_utc_now, nullable=False)
    status = Column(String(30), default="COMPLETED", nullable=False)

    order = relationship("Order", back_populates="payments")


class ProjectExpense(Base):
    __tablename__ = "project_expenses"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False)  # LABOUR, TRANSPORT, PERMIT_DISCOM, HARDWARE_FASTENERS, MISCELLANEOUS
    amount_paise = Column(Integer, nullable=False)
    description = Column(String(255), nullable=False)
    recorded_at = Column(DateTime, default=get_utc_now, nullable=False)

    order = relationship("Order", back_populates="expenses")
