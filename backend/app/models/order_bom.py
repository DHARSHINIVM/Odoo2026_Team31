import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base, get_utc_now


def generate_uuid():
    return str(uuid.uuid4())


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    order_number = Column(String(40), unique=True, index=True, nullable=False)
    quotation_id = Column(Integer, ForeignKey("quotations.id", ondelete="RESTRICT"), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    total_contract_paise = Column(Integer, nullable=False)
    advance_required_paise = Column(Integer, nullable=False)
    advance_received_paise = Column(Integer, default=0, nullable=False)
    payment_status = Column(String(30), default="PENDING", nullable=False)  # PENDING, PARTIAL, COMPLETED, OVERDUE
    stage = Column(String(40), default="CONFIRMED", nullable=False)  # CONFIRMED, BOM_GENERATED, INVENTORY_ALLOCATED, DISPATCHED, INSTALLATION_SCHEDULED, INSTALLED, COMMISSIONED, CLOSED
    installation_target_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    quotation = relationship("Quotation", back_populates="order")
    customer = relationship("Customer", back_populates="orders")
    bom = relationship("BillOfMaterials", back_populates="order", uselist=False, cascade="all, delete-orphan")
    dispatches = relationship("Dispatch", back_populates="order", cascade="all, delete-orphan")
    installations = relationship("Installation", back_populates="order", cascade="all, delete-orphan")
    passport = relationship("DigitalSolarPassport", back_populates="order", uselist=False, cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    expenses = relationship("ProjectExpense", back_populates="order", cascade="all, delete-orphan")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    city = Column(String(80), nullable=False)
    state = Column(String(80), nullable=False, default="Maharashtra")
    pincode = Column(String(10), nullable=False)
    manager_name = Column(String(100), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)

    stocks = relationship("WarehouseStock", back_populates="warehouse", cascade="all, delete-orphan")
    allocations = relationship("BOMAllocation", back_populates="warehouse")
    dispatches = relationship("Dispatch", back_populates="warehouse")


class WarehouseStock(Base):
    __tablename__ = "warehouse_stock"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=False)
    qty_on_hand = Column(Integer, default=0, nullable=False)
    qty_reserved = Column(Integer, default=0, nullable=False)
    min_threshold = Column(Integer, default=10, nullable=False)

    __table_args__ = (
        UniqueConstraint("warehouse_id", "component_id", name="uq_warehouse_component"),
    )

    warehouse = relationship("Warehouse", back_populates="stocks")
    component = relationship("Component", back_populates="stocks")


class BillOfMaterials(Base):
    __tablename__ = "bills_of_materials"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    bom_number = Column(String(40), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    system_capacity_kw = Column(Float, nullable=False)
    total_cost_paise = Column(Integer, default=0, nullable=False)
    status = Column(String(30), default="DRAFT", nullable=False)  # DRAFT, ALLOCATED, DISPATCHED, COMPLETED
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    order = relationship("Order", back_populates="bom")
    items = relationship("BOMItem", back_populates="bom", cascade="all, delete-orphan")


class BOMItem(Base):
    __tablename__ = "bom_items"

    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("bills_of_materials.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="RESTRICT"), nullable=False)
    quantity_required = Column(Integer, nullable=False)
    quantity_allocated = Column(Integer, default=0, nullable=False)
    quantity_dispatched = Column(Integer, default=0, nullable=False)
    status = Column(String(30), default="PENDING", nullable=False)  # PENDING, PARTIALLY_ALLOCATED, FULLY_ALLOCATED, DISPATCHED

    bom = relationship("BillOfMaterials", back_populates="items")
    component = relationship("Component", back_populates="bom_items")
    allocations = relationship("BOMAllocation", back_populates="bom_item", cascade="all, delete-orphan")


class BOMAllocation(Base):
    __tablename__ = "bom_allocations"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    bom_item_id = Column(Integer, ForeignKey("bom_items.id", ondelete="CASCADE"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False)
    allocated_quantity = Column(Integer, nullable=False)
    allocated_at = Column(DateTime, default=get_utc_now, nullable=False)
    status = Column(String(30), default="RESERVED", nullable=False)  # RESERVED, PICKED, DISPATCHED, RELEASED

    bom_item = relationship("BOMItem", back_populates="allocations")
    warehouse = relationship("Warehouse", back_populates="allocations")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    movement_type = Column(String(50), default="MANUAL_ADJUSTMENT", nullable=False)  # INITIAL, MANUAL_ADJUSTMENT, ALLOCATION_RESERVE, DISPATCH
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    warehouse = relationship("Warehouse")
    component = relationship("Component")


class InventoryTransfer(Base):
    """
    Feature 5: Traceable Inter-Warehouse Stock Transfer
    Lifecycle: REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED (or CANCELLED)
    """
    __tablename__ = "inventory_transfers"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=generate_uuid, index=True, nullable=False)
    transfer_number = Column(String(40), unique=True, index=True, nullable=False)
    
    source_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False)
    dest_warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Integer, nullable=False)
    
    status = Column(String(30), default="REQUESTED", nullable=False)  # REQUESTED, APPROVED, IN_TRANSIT, RECEIVED, CANCELLED
    
    requested_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    requested_by_name = Column(String(100), default="Warehouse Staff", nullable=False)
    
    approved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_name = Column(String(100), nullable=True)
    
    received_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_by_name = Column(String(100), nullable=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    source_warehouse = relationship("Warehouse", foreign_keys=[source_warehouse_id])
    dest_warehouse = relationship("Warehouse", foreign_keys=[dest_warehouse_id])
    component = relationship("Component")
    requested_by_user = relationship("User", foreign_keys=[requested_by_user_id])



