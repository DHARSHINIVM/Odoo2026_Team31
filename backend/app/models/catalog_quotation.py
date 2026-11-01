import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
)
from sqlalchemy.orm import relationship
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class Component(Base):
    __tablename__ = "components"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False)  # PANEL, INVERTER, BATTERY, STRUCTURE, CABLE, METER, BOS
    manufacturer = Column(String(100), nullable=False)
    model_number = Column(String(100), nullable=False)
    rated_power_w = Column(Float, nullable=True)
    unit_cost_paise = Column(Integer, nullable=False)
    unit_price_paise = Column(Integer, nullable=False)
    warranty_years = Column(Integer, default=5, nullable=False)
    tier_grade = Column(String(20), default="TIER_1", nullable=False)  # TIER_1, TIER_2, TIER_3
    failure_rate_pct = Column(Float, default=0.5, nullable=False)
    credibility_score = Column(Integer, default=92, nullable=False)  # 0 to 100
    certification_status = Column(String(100), default="ALMM / BIS Approved", nullable=False)
    documentation_status = Column(String(50), default="Verified Datasheet", nullable=False)
    supplier_name = Column(String(100), nullable=True)
    supplier_rating = Column(Float, default=4.5, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    package_items = relationship("PackageItem", back_populates="component")
    quotation_items = relationship("QuotationItem", back_populates="component")
    stocks = relationship("WarehouseStock", back_populates="component")
    bom_items = relationship("BOMItem", back_populates="component")
    serialized_items = relationship("SerializedItem", back_populates="component")
    warranties = relationship("Warranty", back_populates="component")


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    capacity_kw = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    total_price_paise = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    items = relationship("PackageItem", back_populates="package", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="package")


class PackageItem(Base):
    __tablename__ = "package_items"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)

    package = relationship("Package", back_populates="items")
    component = relationship("Component", back_populates="package_items")


class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    quotation_number = Column(String(40), unique=True, index=True, nullable=False)
    enquiry_id = Column(Integer, ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False)
    survey_id = Column(Integer, ForeignKey("site_surveys.id", ondelete="SET NULL"), nullable=True)
    package_id = Column(Integer, ForeignKey("packages.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    system_capacity_kw = Column(Float, nullable=False)
    gross_amount_paise = Column(Integer, nullable=False)
    subsidy_amount_paise = Column(Integer, default=0, nullable=False)
    discount_paise = Column(Integer, default=0, nullable=False)
    tax_amount_paise = Column(Integer, default=0, nullable=False)
    net_amount_paise = Column(Integer, nullable=False)
    estimated_annual_units_kwh = Column(Float, nullable=False)
    estimated_payback_years = Column(Float, default=4.2, nullable=False)
    validity_days = Column(Integer, default=30, nullable=False)
    valid_until = Column(DateTime, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    status = Column(String(30), default="DRAFT", nullable=False)  # DRAFT, SHARED, ACCEPTED, REJECTED, EXPIRED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    enquiry = relationship("Enquiry", back_populates="quotations")
    survey = relationship("SiteSurvey", back_populates="quotations")
    package = relationship("Package", back_populates="quotations")
    customer = relationship("Customer", back_populates="quotations")
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")
    order = relationship("Order", back_populates="quotation", uselist=False)


class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="SET NULL"), nullable=True)
    item_description = Column(String(200), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price_paise = Column(Integer, nullable=False)
    total_price_paise = Column(Integer, nullable=False)

    quotation = relationship("Quotation", back_populates="items")
    component = relationship("Component", back_populates="quotation_items")

