import re
import datetime
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Dispatch, SerializedItem, Order, Warehouse, Component,
    BOMAllocation, Installation, WarehouseStock, StockMovement, User, DigitalSolarPassport
)
from app.schemas.entities import DispatchCreate, DispatchOut, SerialCaptureRequest, SerialCaptureItem, SerializedItemOut
from app.services.auth_service import get_current_user, require_roles
from app.services.passport_service import PassportService

router = APIRouter(prefix="/dispatches", tags=["Warehouse Dispatch & Serial Number Capture"])


class SerialValidationRequest(BaseModel):
    serial_number: str
    component_id: Optional[int] = None
    order_id: Optional[int] = None


class WarehouseDispatchPassportRequest(BaseModel):
    order_id: int
    warehouse_id: Optional[int] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    notes: Optional[str] = None
    scanned_serials: List[Union[Dict[str, Any], str]]
    is_partial: Optional[bool] = False
    dispatched_component_ids: Optional[List[int]] = None


@router.get("", response_model=List[DispatchOut])
def list_dispatches(
    order_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Dispatch)
    if order_id:
        query = query.filter(Dispatch.order_id == order_id)
    if status and status.upper() != "ALL":
        query = query.filter(Dispatch.status == status.upper())

    dispatches = query.order_by(Dispatch.dispatch_date.desc()).all()
    results = []
    for d in dispatches:
        serialized_items_out = []
        for s in d.serialized_items:
            comp = s.component
            serialized_items_out.append(SerializedItemOut(
                id=s.id,
                uuid=s.uuid,
                dispatch_id=s.dispatch_id,
                component_id=s.component_id,
                component_name=comp.name if comp else None,
                component_category=comp.category if comp else None,
                serial_number=s.serial_number,
                barcode_format=s.barcode_format,
                scanned_at=s.scanned_at,
                lifecycle_status=s.lifecycle_status,
                verification_status=s.verification_status,
                warehouse_id=s.warehouse_id,
                installation_id=s.installation_id
            ))

        results.append(DispatchOut(
            id=d.id,
            uuid=d.uuid,
            dispatch_number=d.dispatch_number,
            order_id=d.order_id,
            order_number=d.order.order_number if d.order else None,
            customer_name=d.order.customer.name if d.order and d.order.customer else None,
            warehouse_id=d.warehouse_id,
            warehouse_name=d.warehouse.name if d.warehouse else None,
            source_warehouses=d.source_warehouses or (d.warehouse.name if d.warehouse else None),
            vehicle_number=d.vehicle_number,
            driver_name=d.driver_name,
            driver_phone=d.driver_phone,
            dispatch_date=d.dispatch_date,
            estimated_delivery_date=d.estimated_delivery_date,
            expected_delivery_date=d.estimated_delivery_date,
            actual_delivery_date=d.delivery_date,
            delivery_date=d.delivery_date,
            status=d.status,
            notes=d.notes,
            serialized_items_count=len(d.serialized_items),
            serialized_items=serialized_items_out
        ))
    return results


@router.post("/validate-serial")
def validate_serial(
    payload: SerialValidationRequest,
    current_user: User = Depends(require_roles(["WAREHOUSE_MANAGER", "ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """
    Validate a scanned component serial number before dispatch confirmation.
    Checks barcode format, uniqueness, avoids duplicate scans, prevents cross-order reallocation,
    and verifies component match against the order BOM.
    """
    sn = payload.serial_number.strip()
    if not sn:
        raise HTTPException(status_code=400, detail="Serial number cannot be blank.")

    # 1. Barcode Format Validation (Problem 11)
    if not re.match(r"^[A-Za-z0-9\-_./]{3,64}$", sn):
        return {
            "valid": False,
            "error_code": "INVALID_BARCODE_FORMAT",
            "message": f"Invalid barcode format: '{sn}'. Serial numbers must be 3-64 alphanumeric characters (may include hyphens, dots, underscores, or slashes).",
            "serial_number": sn
        }

    # 2. Check if already registered in system (Problems 5, 7, 8)
    existing = db.query(SerializedItem).filter(SerializedItem.serial_number == sn).first()
    if existing:
        disp = existing.dispatch
        ord_num = disp.order.order_number if disp and disp.order else "another order"
        
        # Cross-order assignment check (Problem 7)
        if payload.order_id and disp and disp.order_id != payload.order_id:
            return {
                "valid": False,
                "error_code": "SERIAL_ASSIGNED_TO_OTHER_ORDER",
                "message": f"Serial '{sn}' is already allocated to Order {ord_num} (Dispatch #{existing.dispatch_id}). Cross-order assignment is forbidden.",
                "serial_number": sn
            }

        # Serial already dispatched / installed (Problem 8)
        if existing.lifecycle_status in ("DISPATCHED", "INSTALLED", "COMMISSIONED"):
            return {
                "valid": False,
                "error_code": "SERIAL_ALREADY_DISPATCHED",
                "message": f"Serial '{sn}' has already been dispatched with status '{existing.lifecycle_status}'.",
                "serial_number": sn
            }

        # Duplicate scan (Problem 5)
        return {
            "valid": False,
            "error_code": "DUPLICATE_SERIAL",
            "message": f"Serial Number '{sn}' is already registered in Dispatch #{existing.dispatch_id}. Duplicate serials are prohibited.",
            "serial_number": sn
        }

    comp = None
    if payload.component_id:
        comp = db.query(Component).filter(Component.id == payload.component_id).first()
        if not comp:
            return {
                "valid": False,
                "error_code": "UNKNOWN_COMPONENT",
                "message": f"Component ID #{payload.component_id} was not found in catalog.",
                "serial_number": sn
            }

    # 3. Wrong Component Validation against Order BOM (Problem 6)
    if payload.order_id:
        order = db.query(Order).filter(Order.id == payload.order_id).first()
        if order and order.bom and payload.component_id:
            bom_comp_ids = {item.component_id for item in order.bom.items}
            if payload.component_id not in bom_comp_ids:
                return {
                    "valid": False,
                    "error_code": "WRONG_COMPONENT",
                    "message": f"Wrong Component: '{comp.name if comp else payload.component_id}' is not included in the Bill of Materials for Order {order.order_number}.",
                    "serial_number": sn
                }

    return {
        "valid": True,
        "serial_number": sn,
        "component_id": comp.id if comp else None,
        "component_name": comp.name if comp else "Verified Component",
        "category": comp.category if comp else "EQUIPMENT",
        "manufacturer": comp.manufacturer if comp else "Verified Mfr",
        "message": "Serial number is valid and available for dispatch."
    }


@router.post("/confirm-with-passport")
def confirm_dispatch_with_passport(
    payload: WarehouseDispatchPassportRequest,
    current_user: User = Depends(require_roles(["WAREHOUSE_MANAGER", "ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """
    Stage A: Warehouse Manager creates the Digital Solar Passport and confirms order dispatch.
    - Validates scanned component serial numbers.
    - Atomically relieves physical warehouse stock.
    - Generates unique Passport ID and customer-accessible QR code.
    - Transitions order stage to DISPATCHED (or PARTIALLY_DISPATCHED if partial).
    """
    wh_id = payload.warehouse_id or 1
    result = PassportService.create_warehouse_passport(
        db=db,
        order_id=payload.order_id,
        warehouse_id=wh_id,
        warehouse_manager_id=current_user.id,
        scanned_serials=payload.scanned_serials,
        vehicle_number=payload.vehicle_number,
        driver_name=payload.driver_name,
        driver_phone=payload.driver_phone,
        notes=payload.notes,
        is_partial=bool(payload.is_partial),
        dispatched_component_ids=payload.dispatched_component_ids
    )
    return result


@router.post("", response_model=DispatchOut, status_code=status.HTTP_201_CREATED)
def create_dispatch(
    payload: DispatchCreate,
    current_user: User = Depends(require_roles(["WAREHOUSE_MANAGER", "ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Guard against repeated dispatch (Problem 15)
    if order.stage in ("DISPATCHED", "COMPLETED"):
        raise HTTPException(
            status_code=400,
            detail=f"Order {order.order_number} has already been dispatched. Repeated dispatch confirmation rejected."
        )

    if not order.bom:
        raise HTTPException(
            status_code=400,
            detail="Business Rule Violation: Bill of Materials has not been generated for this order yet."
        )

    # Check allocations
    has_allocations = False
    source_wh_names = set()
    first_wh_id = None
    for it in order.bom.items:
        for a in it.allocations:
            has_allocations = True
            if a.warehouse:
                source_wh_names.add(a.warehouse.name)
                if not first_wh_id:
                    first_wh_id = a.warehouse_id

    if not has_allocations and order.stage not in ["INVENTORY_ALLOCATED", "DISPATCHED"]:
        raise HTTPException(
            status_code=400,
            detail="Business Rule Violation: Only orders with allocated inventory can be dispatched. Execute inventory allocation first."
        )

    chosen_wh_id = payload.warehouse_id or first_wh_id or 1
    wh = db.query(Warehouse).filter(Warehouse.id == chosen_wh_id).first()
    if not wh:
        wh = db.query(Warehouse).first()
        chosen_wh_id = wh.id if wh else 1

    # Atomic physical inventory validation & relief (Problems 2, 16)
    for it in order.bom.items:
        for a in it.allocations:
            alloc_wh_id = a.warehouse_id or chosen_wh_id
            stock = db.query(WarehouseStock).filter(
                WarehouseStock.warehouse_id == alloc_wh_id,
                WarehouseStock.component_id == it.component_id
            ).first()
            if not stock or stock.qty_on_hand < a.allocated_quantity:
                avail = stock.qty_on_hand if stock else 0
                comp_name = it.component.name if it.component else f"Component #{it.component_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient physical stock: Warehouse #{alloc_wh_id} has {avail} units of '{comp_name}', but {a.allocated_quantity} are required."
                )
            stock.qty_on_hand -= a.allocated_quantity
            stock.qty_reserved = max(0, stock.qty_reserved - a.allocated_quantity)
            a.status = "DISPATCHED"
            movement = StockMovement(
                warehouse_id=alloc_wh_id,
                component_id=it.component_id,
                quantity_change=-a.allocated_quantity,
                movement_type="DISPATCH",
                notes=f"Dispatched {a.allocated_quantity} units for Order {order.order_number}"
            )
            db.add(movement)

    source_wh_str = ", ".join(source_wh_names) if source_wh_names else (wh.name if wh else "Central Hub")
    next_num = db.query(Dispatch).count() + 1
    dispatch_number = f"DSP-2026-{next_num:03d}"

    disp_date = payload.dispatch_date or datetime.datetime.utcnow()
    est_delivery = payload.expected_delivery_date or (disp_date + datetime.timedelta(days=2))

    dispatch = Dispatch(
        dispatch_number=dispatch_number,
        order_id=order.id,
        warehouse_id=chosen_wh_id,
        source_warehouses=source_wh_str,
        vehicle_number=payload.vehicle_number or "MH-12-SP-2026",
        driver_name=payload.driver_name or "Kishore Gaikwad",
        driver_phone=payload.driver_phone or "+91 98220 77112",
        dispatch_date=disp_date,
        estimated_delivery_date=est_delivery,
        status="IN_TRANSIT",
        notes=payload.notes or f"Dispatched for {order.customer.name} rooftop site."
    )
    db.add(dispatch)

    order.stage = "DISPATCHED"
    db.commit()
    db.refresh(dispatch)

    return DispatchOut(
        id=dispatch.id,
        uuid=dispatch.uuid,
        dispatch_number=dispatch.dispatch_number,
        order_id=dispatch.order_id,
        order_number=order.order_number,
        customer_name=order.customer.name,
        warehouse_id=dispatch.warehouse_id,
        warehouse_name=wh.name if wh else None,
        source_warehouses=dispatch.source_warehouses,
        vehicle_number=dispatch.vehicle_number,
        driver_name=dispatch.driver_name,
        driver_phone=dispatch.driver_phone,
        dispatch_date=dispatch.dispatch_date,
        estimated_delivery_date=dispatch.estimated_delivery_date,
        expected_delivery_date=dispatch.estimated_delivery_date,
        actual_delivery_date=dispatch.delivery_date,
        delivery_date=dispatch.delivery_date,
        status=dispatch.status,
        notes=dispatch.notes,
        serialized_items_count=0,
        serialized_items=[]
    )


@router.get("/{dispatch_id}", response_model=DispatchOut)
def get_dispatch(
    dispatch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    serialized_items_out = []
    for s in d.serialized_items:
        comp = s.component
        serialized_items_out.append(SerializedItemOut(
            id=s.id,
            uuid=s.uuid,
            dispatch_id=s.dispatch_id,
            component_id=s.component_id,
            component_name=comp.name if comp else None,
            component_category=comp.category if comp else None,
            serial_number=s.serial_number,
            barcode_format=s.barcode_format,
            scanned_at=s.scanned_at,
            lifecycle_status=s.lifecycle_status,
            verification_status=s.verification_status,
            warehouse_id=s.warehouse_id,
            installation_id=s.installation_id
        ))

    return DispatchOut(
        id=d.id,
        uuid=d.uuid,
        dispatch_number=d.dispatch_number,
        order_id=d.order_id,
        order_number=d.order.order_number if d.order else None,
        customer_name=d.order.customer.name if d.order and d.order.customer else None,
        warehouse_id=d.warehouse_id,
        warehouse_name=d.warehouse.name if d.warehouse else None,
        source_warehouses=d.source_warehouses or (d.warehouse.name if d.warehouse else None),
        vehicle_number=d.vehicle_number,
        driver_name=d.driver_name,
        driver_phone=d.driver_phone,
        dispatch_date=d.dispatch_date,
        estimated_delivery_date=d.estimated_delivery_date,
        expected_delivery_date=d.estimated_delivery_date,
        actual_delivery_date=d.delivery_date,
        delivery_date=d.delivery_date,
        status=d.status,
        notes=d.notes,
        serialized_items_count=len(d.serialized_items),
        serialized_items=serialized_items_out
    )


@router.post("/{dispatch_id}/capture-serials")
def capture_serials(
    dispatch_id: int,
    payload: SerialCaptureRequest,
    current_user: User = Depends(require_roles(["WAREHOUSE_MANAGER", "ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    captured_records = []
    for item in payload.serials:
        sn_clean = item.serial_number.strip()
        if not sn_clean:
            continue

        existing = db.query(SerializedItem).filter(SerializedItem.serial_number == sn_clean).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate Serial Number: '{sn_clean}' is already registered in the system (Dispatch #{existing.dispatch_id})."
            )

        comp = db.query(Component).filter(Component.id == item.component_id).first()
        if not comp:
            raise HTTPException(status_code=404, detail=f"Component #{item.component_id} not found.")

        wh_id = item.warehouse_id or dispatch.warehouse_id

        serialized_record = SerializedItem(
            dispatch_id=dispatch.id,
            component_id=comp.id,
            warehouse_id=wh_id,
            serial_number=sn_clean,
            barcode_format=item.barcode_format or "CODE128",
            scanned_at=datetime.datetime.utcnow(),
            lifecycle_status="IN_TRANSIT" if dispatch.status != "DELIVERED" else "DELIVERED",
            verification_status="VERIFIED"
        )
        db.add(serialized_record)
        captured_records.append(serialized_record)

    db.commit()

    return {
        "success": True,
        "message": f"Successfully captured and verified {len(captured_records)} serialized components for {dispatch.dispatch_number}.",
        "dispatch_number": dispatch.dispatch_number,
        "captured_count": len(captured_records),
        "total_serials_in_dispatch": len(dispatch.serialized_items)
    }


@router.patch("/{dispatch_id}/deliver")
def mark_dispatch_delivered(
    dispatch_id: int,
    current_user: User = Depends(require_roles(["WAREHOUSE_MANAGER", "TECHNICIAN", "FIELD_TECHNICIAN", "ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    dispatch.status = "DELIVERED"
    dispatch.delivery_date = datetime.datetime.utcnow()

    for item in dispatch.serialized_items:
        if item.lifecycle_status in ("IN_TRANSIT", "DISPATCHED"):
            item.lifecycle_status = "DELIVERED"

    order = dispatch.order
    if order:
        existing_inst = db.query(Installation).filter(Installation.order_id == order.id).first()
        if not existing_inst:
            inst_number = f"INST-2026-{order.id:03d}"
            new_inst = Installation(
                installation_number=inst_number,
                order_id=order.id,
                assigned_technician="Ramesh Patil (Lead Certified Solar Engineer)",
                lead_engineer="Ramesh Patil",
                team_size=4,
                installation_address=f"{order.customer.address}, {order.customer.city}",
                scheduled_start_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
                status="SCHEDULED"
            )
            db.add(new_inst)
            order.stage = "INSTALLATION_SCHEDULED"
        else:
            if existing_inst.status == "AWAITING_INSTALLATION":
                existing_inst.status = "SCHEDULED"

    db.commit()
    db.refresh(dispatch)

    return {
        "success": True,
        "message": f"Dispatch {dispatch.dispatch_number} marked as DELIVERED.",
        "dispatch_number": dispatch.dispatch_number,
        "delivery_date": dispatch.delivery_date.isoformat(),
        "status": dispatch.status
    }


@router.post("/{dispatch_id}/cancel")
def cancel_dispatch(
    dispatch_id: int,
    current_user: User = Depends(require_roles(["WAREHOUSE_MANAGER", "ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """
    Cancel an in-transit dispatch, safely restoring physical stock, voiding digital passport,
    and rolling back the order stage (Problem 14).
    """
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    if dispatch.status in ("DELIVERED", "CANCELLED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel dispatch in status '{dispatch.status}'."
        )

    order = dispatch.order
    has_commissioned = any(i.status == "COMMISSIONED" for i in (order.installations or [])) if order else False
    if has_commissioned:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel dispatch: Associated installation has already been commissioned."
        )

    restored_items = []
    if order and order.bom:
        for item in order.bom.items:
            for alloc in item.allocations:
                if alloc.status == "DISPATCHED":
                    alloc_wh_id = alloc.warehouse_id or dispatch.warehouse_id
                    stock = db.query(WarehouseStock).filter(
                        WarehouseStock.warehouse_id == alloc_wh_id,
                        WarehouseStock.component_id == item.component_id
                    ).first()
                    if stock:
                        stock.qty_on_hand += alloc.allocated_quantity
                        stock.qty_reserved += alloc.allocated_quantity

                    alloc.status = "RESERVED"

                    mv = StockMovement(
                        warehouse_id=alloc_wh_id,
                        component_id=item.component_id,
                        quantity_change=alloc.allocated_quantity,
                        movement_type="DISPATCH_CANCELLED",
                        notes=f"Restored {alloc.allocated_quantity} units upon cancellation of Dispatch {dispatch.dispatch_number}",
                        created_at=datetime.datetime.utcnow()
                    )
                    db.add(mv)
                    restored_items.append({"component_id": item.component_id, "quantity": alloc.allocated_quantity})

    # Cancel serialized items
    for s in dispatch.serialized_items:
        s.lifecycle_status = "CANCELLED"

    # Cancel passport if linked to this dispatch
    passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.dispatch_id == dispatch.id).first()
    if passport:
        passport.lifecycle_status = "CANCELLED"
        passport.is_active = False

    dispatch.status = "CANCELLED"
    if order:
        order.stage = "INVENTORY_ALLOCATED"

    db.commit()
    db.refresh(dispatch)

    return {
        "success": True,
        "message": f"Dispatch {dispatch.dispatch_number} successfully cancelled and inventory restored.",
        "dispatch_number": dispatch.dispatch_number,
        "restored_items": restored_items,
        "order_stage": order.stage if order else None
    }
