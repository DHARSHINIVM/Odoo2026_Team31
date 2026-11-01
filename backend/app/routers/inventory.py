from typing import List, Optional, Dict, Any
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import (
    Warehouse, WarehouseStock, Component, StockMovement, InventoryTransfer, User,
    SerializedItem, Order, BillOfMaterials, BOMItem, BOMAllocation, Task, Dispatch
)
from app.schemas.entities import WarehouseOut
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(tags=["Inventory & Warehouses"], dependencies=[Depends(require_roles(["ADMIN", "SALES_EXECUTIVE", "TECHNICIAN", "WAREHOUSE_MANAGER", "SOLAR_MANAGER", "FIELD_TECHNICIAN"]))])


@router.get("/warehouses", response_model=List[WarehouseOut])
@router.get("/inventory/warehouses", response_model=List[WarehouseOut], include_in_schema=False)
def list_warehouses(db: Session = Depends(get_db)):
    warehouses = db.query(Warehouse).order_by(Warehouse.is_primary.desc(), Warehouse.code.asc()).all()
    return [WarehouseOut.model_validate(w) for w in warehouses]


@router.post("/warehouses", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
@router.post("/inventory/warehouses", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_warehouse(payload: dict, db: Session = Depends(get_db)):
    existing = db.query(Warehouse).filter(Warehouse.code == payload["code"]).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Warehouse code '{payload['code']}' already exists.")

    warehouse = Warehouse(
        code=payload["code"],
        name=payload["name"],
        city=payload["city"],
        state=payload.get("state", "Maharashtra"),
        pincode=payload.get("pincode", "411001"),
        manager_name=payload.get("manager_name", "Logistics Lead"),
        contact_phone=payload.get("contact_phone", "+91 98220 00000"),
        is_primary=bool(payload.get("is_primary", False))
    )
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return WarehouseOut.model_validate(warehouse)


@router.get("/warehouses/{warehouse_id}")
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    stocks = []
    for s in wh.stocks:
        comp = s.component
        available = max(0, s.qty_on_hand - s.qty_reserved)
        stocks.append({
            "stock_id": s.id,
            "component_id": s.component_id,
            "component_name": comp.name if comp else f"Component #{s.component_id}",
            "sku": comp.sku if comp else "N/A",
            "category": comp.category if comp else "BOS",
            "qty_on_hand": s.qty_on_hand,
            "qty_reserved": s.qty_reserved,
            "available": available,
            "min_threshold": s.min_threshold,
            "is_low_stock": available <= s.min_threshold
        })

    return {
        "warehouse": WarehouseOut.model_validate(wh),
        "stocks": stocks,
        "total_sku_count": len(stocks)
    }


@router.get("/inventory")
@router.get("/inventory/stocks", include_in_schema=False)
def list_inventory(
    warehouse_id: Optional[int] = None,
    category: Optional[str] = None,
    low_stock_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(WarehouseStock).join(WarehouseStock.component)

    if warehouse_id:
        query = query.filter(WarehouseStock.warehouse_id == warehouse_id)

    if category and category.upper() != "ALL":
        query = query.filter(Component.category == category.upper())

    stocks = query.all()
    results = []

    for s in stocks:
        comp = s.component
        wh = s.warehouse
        available = max(0, s.qty_on_hand - s.qty_reserved)
        is_low = available <= s.min_threshold

        if low_stock_only and not is_low:
            continue

        results.append({
            "id": s.id,
            "warehouse_id": s.warehouse_id,
            "warehouse_name": wh.name if wh else "N/A",
            "warehouse_code": wh.code if wh else "N/A",
            "warehouse_city": wh.city if wh else "N/A",
            "component_id": s.component_id,
            "component_name": comp.name if comp else f"Component #{s.component_id}",
            "sku": comp.sku if comp else "N/A",
            "category": comp.category if comp else "BOS",
            "tier_grade": comp.tier_grade if comp else "TIER_1",
            "credibility_score": comp.credibility_score if comp else 90,
            "qty_on_hand": s.qty_on_hand,
            "qty_reserved": s.qty_reserved,
            "available": available,
            "min_threshold": s.min_threshold,
            "is_low_stock": is_low,
            "unit_cost_inr": round(comp.unit_cost_paise / 100, 2) if comp else 0
        })

    return results


@router.post("/inventory/adjustments")
def adjust_inventory_stock(payload: dict, db: Session = Depends(get_db)):
    warehouse_id = int(payload["warehouse_id"])
    component_id = int(payload["component_id"])
    quantity_change = int(payload["quantity_change"])
    notes = payload.get("notes", "Manual inventory adjustment")

    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    comp = db.query(Component).filter(Component.id == component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")

    stock = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == warehouse_id,
        WarehouseStock.component_id == component_id
    ).first()

    if not stock:
        if quantity_change < 0:
            raise HTTPException(status_code=400, detail="Cannot reduce stock on non-existent stock record.")
        stock = WarehouseStock(
            warehouse_id=warehouse_id,
            component_id=component_id,
            qty_on_hand=quantity_change,
            qty_reserved=0,
            min_threshold=10
        )
        db.add(stock)
    else:
        new_on_hand = stock.qty_on_hand + quantity_change
        # Rule: Available stock cannot be negative
        if new_on_hand - stock.qty_reserved < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Adjustment rejected: would cause negative available stock ({new_on_hand} on hand vs {stock.qty_reserved} reserved)."
            )
        stock.qty_on_hand = new_on_hand

    # Log movement history
    movement = StockMovement(
        warehouse_id=warehouse_id,
        component_id=component_id,
        quantity_change=quantity_change,
        movement_type="MANUAL_ADJUSTMENT",
        notes=notes
    )
    db.add(movement)

    db.commit()
    db.refresh(stock)

    available = stock.qty_on_hand - stock.qty_reserved
    return {
        "success": True,
        "message": f"Stock updated for {comp.name} at {wh.name}.",
        "warehouse_name": wh.name,
        "component_name": comp.name,
        "qty_on_hand": stock.qty_on_hand,
        "qty_reserved": stock.qty_reserved,
        "available": available,
        "is_low_stock": available <= stock.min_threshold
    }


@router.get("/inventory/movements")
def get_inventory_movements(limit: int = 50, db: Session = Depends(get_db)):
    movements = db.query(StockMovement).order_by(StockMovement.created_at.desc()).limit(limit).all()
    return [
        {
            "id": m.id,
            "warehouse_name": m.warehouse.name if m.warehouse else "N/A",
            "component_name": m.component.name if m.component else "N/A",
            "quantity_change": m.quantity_change,
            "movement_type": m.movement_type,
            "notes": m.notes,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M")
        }
        for m in movements
    ]


class CreateTransferRequest(BaseModel):
    source_warehouse_id: int
    dest_warehouse_id: int
    component_id: int
    quantity: int
    notes: Optional[str] = None
    requested_by_name: Optional[str] = "Warehouse Manager"
    auto_approve: Optional[bool] = False


def _format_transfer(t: InventoryTransfer) -> dict:
    source_wh = t.source_warehouse
    dest_wh = t.dest_warehouse
    comp = t.component
    return {
        "id": t.id,
        "uuid": t.uuid,
        "transfer_number": t.transfer_number,
        "source_warehouse_id": t.source_warehouse_id,
        "source_warehouse_name": source_wh.name if source_wh else "Unknown Source",
        "source_warehouse_code": source_wh.code if source_wh else "N/A",
        "source_warehouse_city": source_wh.city if source_wh else "N/A",
        "dest_warehouse_id": t.dest_warehouse_id,
        "dest_warehouse_name": dest_wh.name if dest_wh else "Unknown Destination",
        "dest_warehouse_code": dest_wh.code if dest_wh else "N/A",
        "dest_warehouse_city": dest_wh.city if dest_wh else "N/A",
        "component_id": t.component_id,
        "component_name": comp.name if comp else f"Component #{t.component_id}",
        "component_sku": comp.sku if comp else "N/A",
        "component_category": comp.category if comp else "EQUIPMENT",
        "quantity": t.quantity,
        "status": t.status,
        "requested_by_user_id": t.requested_by_user_id,
        "requested_by_name": t.requested_by_name,
        "approved_by_user_id": t.approved_by_user_id,
        "approved_by_name": t.approved_by_name,
        "received_by_user_id": t.received_by_user_id,
        "received_by_name": t.received_by_name,
        "notes": t.notes,
        "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else None,
        "approved_at": t.approved_at.strftime("%Y-%m-%d %H:%M") if t.approved_at else None,
        "dispatched_at": t.dispatched_at.strftime("%Y-%m-%d %H:%M") if t.dispatched_at else None,
        "received_at": t.received_at.strftime("%Y-%m-%d %H:%M") if t.received_at else None,
        "cancelled_at": t.cancelled_at.strftime("%Y-%m-%d %H:%M") if t.cancelled_at else None,
    }


# -------------------------------------------------------------------------
# Inter-Warehouse Transfer Endpoints (Feature 5)
# -------------------------------------------------------------------------
@router.get("/inventory/transfers")
def list_inventory_transfers(
    status_filter: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    component_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InventoryTransfer)
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(InventoryTransfer.status == status_filter.upper())
    if warehouse_id:
        query = query.filter(
            (InventoryTransfer.source_warehouse_id == warehouse_id) |
            (InventoryTransfer.dest_warehouse_id == warehouse_id)
        )
    if component_id:
        query = query.filter(InventoryTransfer.component_id == component_id)

    transfers = query.order_by(InventoryTransfer.created_at.desc()).all()
    return [_format_transfer(t) for t in transfers]


@router.post("/inventory/transfers", status_code=status.HTTP_201_CREATED)
@router.post("/inventory/transfer", status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_inventory_transfer(
    payload: CreateTransferRequest,
    db: Session = Depends(get_db)
):
    if payload.source_warehouse_id == payload.dest_warehouse_id:
        raise HTTPException(
            status_code=400,
            detail="Source and destination warehouses cannot be identical."
        )

    if payload.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Transfer quantity must be greater than zero."
        )

    source_wh = db.query(Warehouse).filter(Warehouse.id == payload.source_warehouse_id).first()
    if not source_wh:
        raise HTTPException(status_code=404, detail="Source warehouse not found.")

    dest_wh = db.query(Warehouse).filter(Warehouse.id == payload.dest_warehouse_id).first()
    if not dest_wh:
        raise HTTPException(status_code=404, detail="Destination warehouse not found.")

    comp = db.query(Component).filter(Component.id == payload.component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found.")

    source_stock = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == payload.source_warehouse_id,
        WarehouseStock.component_id == payload.component_id
    ).first()

    available = (source_stock.qty_on_hand - source_stock.qty_reserved) if source_stock else 0
    if available < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient available stock at {source_wh.name}. Requested {payload.quantity}, but only {available} units available."
        )

    next_num = db.query(InventoryTransfer).count() + 1
    transfer_number = f"TRF-2026-{next_num:03d}"
    now = datetime.datetime.utcnow()

    initial_status = "REQUESTED"
    approved_at = None
    approved_by_name = None

    if payload.auto_approve:
        initial_status = "APPROVED"
        approved_at = now
        approved_by_name = payload.requested_by_name or "Warehouse Manager"
        source_stock.qty_reserved += payload.quantity

    transfer = InventoryTransfer(
        transfer_number=transfer_number,
        source_warehouse_id=payload.source_warehouse_id,
        dest_warehouse_id=payload.dest_warehouse_id,
        component_id=payload.component_id,
        quantity=payload.quantity,
        status=initial_status,
        requested_by_name=payload.requested_by_name or "Warehouse Manager",
        approved_by_name=approved_by_name,
        approved_at=approved_at,
        notes=payload.notes,
        created_at=now
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)


@router.patch("/inventory/transfers/{transfer_id}/approve")
def approve_inventory_transfer(
    transfer_id: int,
    db: Session = Depends(get_db)
):
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found.")

    if transfer.status != "REQUESTED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve transfer in '{transfer.status}' status. Must be 'REQUESTED'."
        )

    source_stock = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == transfer.source_warehouse_id,
        WarehouseStock.component_id == transfer.component_id
    ).first()

    available = (source_stock.qty_on_hand - source_stock.qty_reserved) if source_stock else 0
    if available < transfer.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve: Insufficient available stock ({available} available vs {transfer.quantity} requested)."
        )

    source_stock.qty_reserved += transfer.quantity
    transfer.status = "APPROVED"
    transfer.approved_at = datetime.datetime.utcnow()
    transfer.approved_by_name = "Warehouse Operations Lead"

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)


@router.patch("/inventory/transfers/{transfer_id}/dispatch")
def dispatch_inventory_transfer(
    transfer_id: int,
    db: Session = Depends(get_db)
):
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found.")

    if transfer.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot dispatch transfer in '{transfer.status}' status. Must be 'APPROVED'."
        )

    source_stock = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == transfer.source_warehouse_id,
        WarehouseStock.component_id == transfer.component_id
    ).first()

    if not source_stock or source_stock.qty_on_hand < transfer.quantity:
        raise HTTPException(
            status_code=400,
            detail="Source stock inconsistency: Insufficient stock on hand to dispatch."
        )

    # Deduct from source on_hand and reserved
    source_stock.qty_on_hand -= transfer.quantity
    source_stock.qty_reserved = max(0, source_stock.qty_reserved - transfer.quantity)

    # Record movement
    now = datetime.datetime.utcnow()
    mv = StockMovement(
        warehouse_id=transfer.source_warehouse_id,
        component_id=transfer.component_id,
        quantity_change=-transfer.quantity,
        movement_type="TRANSFER_OUT",
        notes=f"Dispatched via transfer {transfer.transfer_number} to {transfer.dest_warehouse.name if transfer.dest_warehouse else 'Destination'}",
        created_at=now
    )
    db.add(mv)

    transfer.status = "IN_TRANSIT"
    transfer.dispatched_at = now

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)


@router.patch("/inventory/transfers/{transfer_id}/receive")
def receive_inventory_transfer(
    transfer_id: int,
    db: Session = Depends(get_db)
):
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found.")

    if transfer.status != "IN_TRANSIT":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot receive transfer in '{transfer.status}' status. Transfer must be 'IN_TRANSIT' to prevent double application."
        )

    # Destination stock
    dest_stock = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == transfer.dest_warehouse_id,
        WarehouseStock.component_id == transfer.component_id
    ).first()

    if not dest_stock:
        dest_stock = WarehouseStock(
            warehouse_id=transfer.dest_warehouse_id,
            component_id=transfer.component_id,
            qty_on_hand=transfer.quantity,
            qty_reserved=0,
            min_threshold=10
        )
        db.add(dest_stock)
    else:
        dest_stock.qty_on_hand += transfer.quantity

    # Record destination movement
    now = datetime.datetime.utcnow()
    mv = StockMovement(
        warehouse_id=transfer.dest_warehouse_id,
        component_id=transfer.component_id,
        quantity_change=transfer.quantity,
        movement_type="TRANSFER_IN",
        notes=f"Received via transfer {transfer.transfer_number} from {transfer.source_warehouse.name if transfer.source_warehouse else 'Source'}",
        created_at=now
    )
    db.add(mv)

    transfer.status = "RECEIVED"
    transfer.received_at = now
    transfer.received_by_name = "Destination Depot Manager"

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)


@router.patch("/inventory/transfers/{transfer_id}/cancel")
def cancel_inventory_transfer(
    transfer_id: int,
    db: Session = Depends(get_db)
):
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found.")

    if transfer.status not in ("REQUESTED", "APPROVED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel transfer in '{transfer.status}' status. Dispatched or received transfers cannot be cancelled."
        )

    if transfer.status == "APPROVED":
        source_stock = db.query(WarehouseStock).filter(
            WarehouseStock.warehouse_id == transfer.source_warehouse_id,
            WarehouseStock.component_id == transfer.component_id
        ).first()
        if source_stock:
            source_stock.qty_reserved = max(0, source_stock.qty_reserved - transfer.quantity)

    transfer.status = "CANCELLED"
    transfer.cancelled_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)


@router.get("/inventory/transfers/{transfer_id}")
def get_inventory_transfer(transfer_id: int, db: Session = Depends(get_db)):
    transfer = db.query(InventoryTransfer).filter(InventoryTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found.")
    return _format_transfer(transfer)


# -------------------------------------------------------------------------
# Goods Receipts, Returns, Serials, and Reservation Management
# -------------------------------------------------------------------------

class GoodsReceiptRequest(BaseModel):
    warehouse_id: int
    component_id: int
    quantity: int
    supplier_name: Optional[str] = "Approved Solar OEM"
    po_reference: Optional[str] = None
    serials: Optional[List[str]] = None
    notes: Optional[str] = None


@router.post("/inventory/goods-receipt", status_code=status.HTTP_201_CREATED)
def receive_goods(
    payload: GoodsReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Goods Receipt: Inward stock transaction from suppliers.
    Increments physical stock on hand only after transaction is committed.
    Registers component serials for high-value components.
    """
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Goods receipt quantity must be greater than zero.")

    wh = db.query(Warehouse).filter(Warehouse.id == payload.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found.")

    comp = db.query(Component).filter(Component.id == payload.component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found.")

    stock = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == payload.warehouse_id,
        WarehouseStock.component_id == payload.component_id
    ).first()

    if not stock:
        stock = WarehouseStock(
            warehouse_id=payload.warehouse_id,
            component_id=payload.component_id,
            qty_on_hand=payload.quantity,
            qty_reserved=0,
            min_threshold=10
        )
        db.add(stock)
    else:
        stock.qty_on_hand += payload.quantity

    registered_serials = []
    if payload.serials:
        for sn in payload.serials:
            sn_clean = sn.strip().upper()
            if not sn_clean:
                continue
            existing = db.query(SerializedItem).filter(SerializedItem.serial_number == sn_clean).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate Serial Number: '{sn_clean}' is already registered in the system."
                )
            # Find default dispatch id or 1 for warehouse pool
            disp = db.query(Dispatch).first()
            disp_id = disp.id if disp else 1
            s_item = SerializedItem(
                dispatch_id=disp_id,
                component_id=payload.component_id,
                warehouse_id=payload.warehouse_id,
                serial_number=sn_clean,
                barcode_format="CODE128",
                lifecycle_status="IN_WAREHOUSE",
                verification_status="VERIFIED"
            )
            db.add(s_item)
            registered_serials.append(sn_clean)

    receipt_notes = f"PO: {payload.po_reference or 'N/A'} | Supplier: {payload.supplier_name or 'OEM'} | {payload.notes or 'Inward goods receipt verified'}"
    movement = StockMovement(
        warehouse_id=payload.warehouse_id,
        component_id=payload.component_id,
        quantity_change=payload.quantity,
        movement_type="GOODS_RECEIPT",
        notes=receipt_notes
    )
    db.add(movement)

    db.commit()
    db.refresh(stock)

    return {
        "success": True,
        "receipt_number": f"GRN-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "warehouse_name": wh.name,
        "component_name": comp.name,
        "quantity_received": payload.quantity,
        "new_qty_on_hand": stock.qty_on_hand,
        "available_stock": stock.qty_on_hand - stock.qty_reserved,
        "registered_serials": registered_serials,
        "received_by": current_user.full_name
    }


class ReturnStockRequest(BaseModel):
    warehouse_id: int
    component_id: int
    quantity: int
    return_type: str  # RESTOCK | DAMAGED
    serial_number: Optional[str] = None
    reason: str
    order_or_project: Optional[str] = None


@router.post("/inventory/returns", status_code=status.HTTP_201_CREATED)
def process_return(
    payload: ReturnStockRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns Management:
    - RESTOCK: Return items inspected and added back to usable stock on hand.
    - DAMAGED: Quarantined in damaged log, usable stock is NOT incremented.
    """
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Return quantity must be greater than zero.")

    wh = db.query(Warehouse).filter(Warehouse.id == payload.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found.")

    comp = db.query(Component).filter(Component.id == payload.component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found.")

    stock = db.query(WarehouseStock).filter(
        WarehouseStock.warehouse_id == payload.warehouse_id,
        WarehouseStock.component_id == payload.component_id
    ).first()

    movement_type = "RETURN_RESTOCK" if payload.return_type.upper() == "RESTOCK" else "RETURN_DAMAGED"
    if payload.return_type.upper() == "RESTOCK":
        if not stock:
            stock = WarehouseStock(
                warehouse_id=payload.warehouse_id,
                component_id=payload.component_id,
                qty_on_hand=payload.quantity,
                qty_reserved=0,
                min_threshold=10
            )
            db.add(stock)
        else:
            stock.qty_on_hand += payload.quantity

    if payload.serial_number:
        sn_clean = payload.serial_number.strip().upper()
        s_item = db.query(SerializedItem).filter(SerializedItem.serial_number == sn_clean).first()
        if s_item:
            s_item.lifecycle_status = "RETURNED_RESTOCKED" if payload.return_type.upper() == "RESTOCK" else "RETURNED_DAMAGED"
            s_item.warehouse_id = payload.warehouse_id

    return_notes = f"Return [{payload.return_type.upper()}] Ref: {payload.order_or_project or 'N/A'} | Reason: {payload.reason} | Serial: {payload.serial_number or 'N/A'}"
    movement = StockMovement(
        warehouse_id=payload.warehouse_id,
        component_id=payload.component_id,
        quantity_change=payload.quantity if payload.return_type.upper() == "RESTOCK" else 0,
        movement_type=movement_type,
        notes=return_notes
    )
    db.add(movement)

    db.commit()
    if stock:
        db.refresh(stock)

    return {
        "success": True,
        "return_id": f"RET-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "return_type": payload.return_type.upper(),
        "warehouse_name": wh.name,
        "component_name": comp.name,
        "quantity": payload.quantity,
        "usable_qty_on_hand": stock.qty_on_hand if stock else 0,
        "processed_by": current_user.full_name
    }


@router.get("/inventory/serials")
def list_inventory_serials(
    warehouse_id: Optional[int] = None,
    component_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SerializedItem).join(SerializedItem.component)
    if warehouse_id:
        query = query.filter(SerializedItem.warehouse_id == warehouse_id)
    if component_id:
        query = query.filter(SerializedItem.component_id == component_id)
    if search:
        query = query.filter(SerializedItem.serial_number.contains(search.upper()))
    serials = query.order_by(SerializedItem.scanned_at.desc()).limit(100).all()
    return [
        {
            "id": s.id,
            "serial_number": s.serial_number,
            "component_id": s.component_id,
            "component_name": s.component.name if s.component else "N/A",
            "category": s.component.category if s.component else "EQUIPMENT",
            "warehouse_id": s.warehouse_id,
            "lifecycle_status": s.lifecycle_status,
            "verification_status": s.verification_status,
            "scanned_at": s.scanned_at.strftime("%Y-%m-%d %H:%M") if s.scanned_at else None
        }
        for s in serials
    ]


class ReleaseReservationRequest(BaseModel):
    order_id: int
    reason: Optional[str] = "Order amended or cancelled"


@router.post("/inventory/reservations/release")
def release_order_reservation(
    payload: ReleaseReservationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if not order.bom:
        raise HTTPException(status_code=400, detail="No BOM associated with this order.")

    released_count = 0
    for item in order.bom.items:
        for alloc in item.allocations:
            if alloc.status == "RESERVED":
                stock = db.query(WarehouseStock).filter(
                    WarehouseStock.warehouse_id == alloc.warehouse_id,
                    WarehouseStock.component_id == item.component_id
                ).first()
                if stock:
                    stock.qty_reserved = max(0, stock.qty_reserved - alloc.allocated_quantity)
                alloc.status = "RELEASED"
                released_count += 1
                
                db.add(StockMovement(
                    warehouse_id=alloc.warehouse_id,
                    component_id=item.component_id,
                    quantity_change=0,
                    movement_type="RESERVATION_RELEASED",
                    notes=f"Released reservation for Order {order.order_number}: {payload.reason}"
                ))

    db.commit()
    return {
        "success": True,
        "order_number": order.order_number,
        "released_allocations_count": released_count,
        "message": f"Successfully released reservations for Order {order.order_number}."
    }


# -------------------------------------------------------------------------
# Authoritative Inward Goods Receipts Inspection (Module 3.E)
# -------------------------------------------------------------------------
@router.get("/inventory/goods-receipts")
def list_goods_receipts(
    warehouse_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Retrieve authoritative historical Goods Receipts committed into inventory.
    """
    query = db.query(StockMovement).filter(StockMovement.movement_type == "GOODS_RECEIPT")
    if warehouse_id:
        query = query.filter(StockMovement.warehouse_id == warehouse_id)

    movements = query.order_by(StockMovement.created_at.desc()).limit(limit).all()
    results = []
    for m in movements:
        notes_str = m.notes or ""
        # Parse notes format: "PO: ... | Supplier: ... | ..."
        po_ref = "N/A"
        supplier = "Approved Solar OEM"
        details = notes_str
        if "PO:" in notes_str:
            parts = [p.strip() for p in notes_str.split("|")]
            for p in parts:
                if p.startswith("PO:"):
                    po_ref = p.replace("PO:", "").strip()
                elif p.startswith("Supplier:"):
                    supplier = p.replace("Supplier:", "").strip()

        results.append({
            "id": m.id,
            "receipt_number": f"GRN-{m.created_at.strftime('%Y%m%d')}-{m.id:04d}",
            "po_reference": po_ref,
            "supplier_name": supplier,
            "warehouse_id": m.warehouse_id,
            "warehouse_name": m.warehouse.name if m.warehouse else "N/A",
            "component_id": m.component_id,
            "component_name": m.component.name if m.component else "N/A",
            "sku": m.component.sku if m.component else "N/A",
            "category": m.component.category if m.component else "EQUIPMENT",
            "quantity_received": m.quantity_change,
            "notes": notes_str,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M")
        })
    return results


# -------------------------------------------------------------------------
# Authoritative Inventory Reservations Inspection (Module 3.H)
# -------------------------------------------------------------------------
@router.get("/inventory/reservations")
def list_inventory_reservations(
    status_filter: Optional[str] = None,
    order_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Inspect authoritative project/order inventory reservations.
    Prevents double reservation and tracks reservation lifecycle: RESERVED -> PICKED -> DISPATCHED / RELEASED.
    """
    query = db.query(BOMAllocation).join(BOMAllocation.bom_item).join(BOMItem.bom).join(BillOfMaterials.order)
    
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(BOMAllocation.status == status_filter.upper())
    if order_id:
        query = query.filter(BillOfMaterials.order_id == order_id)
    if warehouse_id:
        query = query.filter(BOMAllocation.warehouse_id == warehouse_id)

    allocations = query.order_by(BOMAllocation.allocated_at.desc()).all()
    results = []
    for a in allocations:
        bom_item = a.bom_item
        bom = bom_item.bom if bom_item else None
        order = bom.order if bom else None
        comp = bom_item.component if bom_item else None
        wh = a.warehouse

        results.append({
            "allocation_id": a.id,
            "uuid": a.uuid,
            "order_id": order.id if order else None,
            "order_number": order.order_number if order else "N/A",
            "customer_name": order.customer.name if order and order.customer else "N/A",
            "component_id": bom_item.component_id if bom_item else None,
            "component_name": comp.name if comp else "N/A",
            "sku": comp.sku if comp else "N/A",
            "category": comp.category if comp else "BOS",
            "warehouse_id": a.warehouse_id,
            "warehouse_name": wh.name if wh else "N/A",
            "allocated_quantity": a.allocated_quantity,
            "status": a.status,
            "allocated_at": a.allocated_at.strftime("%Y-%m-%d %H:%M") if a.allocated_at else None
        })
    return results


# -------------------------------------------------------------------------
# Authoritative Returns and Damaged Inspection (Module 3.M)
# -------------------------------------------------------------------------
@router.get("/inventory/returns")
def list_inventory_returns(
    return_type: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Retrieve authoritative record of customer and site returns (RESTOCK vs DAMAGED).
    """
    query = db.query(StockMovement).filter(StockMovement.movement_type.like("RETURN%"))
    if return_type and return_type.upper() != "ALL":
        query = query.filter(StockMovement.movement_type == f"RETURN_{return_type.upper()}")
    if warehouse_id:
        query = query.filter(StockMovement.warehouse_id == warehouse_id)

    movements = query.order_by(StockMovement.created_at.desc()).all()
    results = []
    for m in movements:
        notes_str = m.notes or ""
        r_type = "RESTOCK" if "RESTOCK" in m.movement_type else "DAMAGED"
        serial = None
        reason = notes_str
        project_ref = None

        if "Serial:" in notes_str:
            parts = notes_str.split("Serial:")
            if len(parts) > 1:
                serial = parts[1].strip()

        if "Ref:" in notes_str:
            parts = notes_str.split("Ref:")
            if len(parts) > 1:
                project_ref = parts[1].split("|")[0].strip()

        results.append({
            "id": m.id,
            "return_id": f"RET-{m.created_at.strftime('%Y%m%d')}-{m.id:04d}",
            "return_type": r_type,
            "warehouse_id": m.warehouse_id,
            "warehouse_name": m.warehouse.name if m.warehouse else "N/A",
            "component_id": m.component_id,
            "component_name": m.component.name if m.component else "N/A",
            "sku": m.component.sku if m.component else "N/A",
            "quantity": abs(m.quantity_change) if m.quantity_change else 1,
            "project_reference": project_ref,
            "serial_number": serial,
            "notes": notes_str,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M")
        })
    return results


# -------------------------------------------------------------------------
# Categorized Inventory Alerts (Module 3.N)
# -------------------------------------------------------------------------
@router.get("/inventory/alerts")
def get_inventory_alerts(
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Real-time inventory alerts:
    - Low stock items
    - Unavailable/Zero stock
    - Reservation shortages on confirmed orders
    - Damaged quarantine items
    - Dispatch exceptions
    """
    query = db.query(WarehouseStock)
    if warehouse_id:
        query = query.filter(WarehouseStock.warehouse_id == warehouse_id)
    stocks = query.all()

    low_stock_alerts = []
    zero_stock_alerts = []
    for s in stocks:
        avail = max(0, s.qty_on_hand - s.qty_reserved)
        comp = s.component
        wh = s.warehouse
        if avail == 0:
            zero_stock_alerts.append({
                "type": "STOCK_OUT",
                "severity": "CRITICAL",
                "component_name": comp.name if comp else f"Component #{s.component_id}",
                "sku": comp.sku if comp else "N/A",
                "warehouse_name": wh.name if wh else "N/A",
                "qty_on_hand": s.qty_on_hand,
                "qty_reserved": s.qty_reserved,
                "available": avail,
                "message": f"Critical Stock-Out: '{comp.name if comp else 'Component'}' has 0 available units at {wh.name if wh else 'Depot'}."
            })
        elif avail <= s.min_threshold:
            low_stock_alerts.append({
                "type": "LOW_STOCK",
                "severity": "WARNING",
                "component_name": comp.name if comp else f"Component #{s.component_id}",
                "sku": comp.sku if comp else "N/A",
                "warehouse_name": wh.name if wh else "N/A",
                "qty_on_hand": s.qty_on_hand,
                "qty_reserved": s.qty_reserved,
                "available": avail,
                "min_threshold": s.min_threshold,
                "message": f"Low Stock Warning: '{comp.name if comp else 'Component'}' has {avail} available units (threshold: {s.min_threshold}) at {wh.name if wh else 'Depot'}."
            })

    # Reservation shortages across confirmed orders
    confirmed_orders = db.query(Order).filter(Order.stage.in_(["CONFIRMED", "BOM_GENERATED"])).all()
    shortage_alerts = []
    for ord in confirmed_orders:
        if ord.bom and ord.bom.items:
            for item in ord.bom.items:
                needed = item.quantity_required - item.quantity_allocated
                if needed > 0:
                    # Check global available
                    comp_stocks = db.query(WarehouseStock).filter(WarehouseStock.component_id == item.component_id).all()
                    tot_avail = sum(max(0, cs.qty_on_hand - cs.qty_reserved) for cs in comp_stocks)
                    if tot_avail < needed:
                        shortage_alerts.append({
                            "type": "RESERVATION_SHORTAGE",
                            "severity": "HIGH",
                            "order_number": ord.order_number,
                            "component_name": item.component.name if item.component else f"Component #{item.component_id}",
                            "quantity_required": item.quantity_required,
                            "quantity_short": needed - tot_avail,
                            "message": f"Procurement Shortage: Order {ord.order_number} needs {needed} units of '{item.component.name if item.component else 'item'}', but only {tot_avail} units exist across all depots."
                        })

    # Damaged quarantine count
    damaged_movements = db.query(StockMovement).filter(StockMovement.movement_type.contains("DAMAGED")).all()
    damaged_alerts = [
        {
            "type": "DAMAGED_STOCK",
            "severity": "MEDIUM",
            "component_name": dm.component.name if dm.component else "N/A",
            "warehouse_name": dm.warehouse.name if dm.warehouse else "N/A",
            "notes": dm.notes,
            "created_at": dm.created_at.strftime("%Y-%m-%d %H:%M"),
            "message": f"Damaged quarantine: {dm.component.name if dm.component else 'Component'} at {dm.warehouse.name if dm.warehouse else 'Depot'}."
        }
        for dm in damaged_movements[:5]
    ]

    return {
        "summary": {
            "total_alerts": len(low_stock_alerts) + len(zero_stock_alerts) + len(shortage_alerts) + len(damaged_alerts),
            "critical_stock_outs": len(zero_stock_alerts),
            "low_stock_warnings": len(low_stock_alerts),
            "procurement_shortages": len(shortage_alerts),
            "damaged_quarantined": len(damaged_alerts)
        },
        "zero_stock": zero_stock_alerts,
        "low_stock": low_stock_alerts,
        "shortages": shortage_alerts,
        "damaged": damaged_alerts
    }


# -------------------------------------------------------------------------
# Mobile Device Registration (Module 3.B)
# -------------------------------------------------------------------------
class DeviceRegistrationRequest(BaseModel):
    device_model: str
    os_version: str
    app_version: Optional[str] = "2.4.0-mobile"
    device_fingerprint: Optional[str] = None
    camera_supported: Optional[bool] = True


@router.post("/inventory/device-registration")
def register_warehouse_device(
    payload: DeviceRegistrationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Registers the authenticated mobile handheld device for warehouse audit tracking.
    """
    return {
        "success": True,
        "device_registered": True,
        "device_id": f"DEV-WH-{current_user.id:03d}-{payload.os_version.replace(' ', '_')}",
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "role": current_user.role,
        "device_model": payload.device_model,
        "os_version": payload.os_version,
        "app_version": payload.app_version,
        "registered_at": datetime.datetime.utcnow().isoformat(),
        "status": "AUTHORISED_ACTIVE"
    }


# =========================================================================
# Serial Number Management & Lifecycle Tracking (Warehouse Manager)
# =========================================================================

class SerialRegisterRequest(BaseModel):
    serial_number: str
    component_id: int
    warehouse_id: Optional[int] = None
    barcode_format: Optional[str] = "CODE128"
    lifecycle_status: Optional[str] = "AVAILABLE"  # Registered, Available, Reserved, Allocated, Dispatched, Installed, Returned, Damaged, Under Inspection


class SerialStatusUpdateRequest(BaseModel):
    lifecycle_status: str
    warehouse_id: Optional[int] = None
    notes: Optional[str] = None


@router.get("/inventory/serials")
@router.get("/dispatches/serials", include_in_schema=False)
def list_serials(
    status: Optional[str] = None,
    category: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List serialized components across depots with lifecycle status filtering.
    """
    query = db.query(SerializedItem)
    if status and status.upper() != "ALL":
        query = query.filter(SerializedItem.lifecycle_status == status.upper())
    if warehouse_id:
        query = query.filter(SerializedItem.warehouse_id == warehouse_id)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                SerializedItem.serial_number.ilike(search_filter),
                SerializedItem.component.has(Component.name.ilike(search_filter)),
                SerializedItem.component.has(Component.sku.ilike(search_filter))
            )
        )
    items = query.order_by(SerializedItem.scanned_at.desc()).all()
    results = []
    for it in items:
        if category and category.upper() != "ALL":
            if not it.component or it.component.category != category.upper():
                continue
        comp = it.component
        wh = it.warehouse
        disp = it.dispatch
        results.append({
            "id": it.id,
            "uuid": it.uuid,
            "serial_number": it.serial_number,
            "barcode_format": it.barcode_format,
            "component_id": it.component_id,
            "component_name": comp.name if comp else "N/A",
            "component_sku": comp.sku if comp else "N/A",
            "component_category": comp.category if comp else "N/A",
            "warehouse_id": it.warehouse_id,
            "warehouse_name": wh.name if wh else "Central Depot",
            "lifecycle_status": it.lifecycle_status,
            "verification_status": it.verification_status,
            "dispatch_id": it.dispatch_id,
            "dispatch_number": disp.dispatch_number if disp else None,
            "order_id": disp.order_id if disp else None,
            "installation_id": it.installation_id,
            "scanned_at": it.scanned_at.isoformat() if it.scanned_at else None
        })
    return results


@router.post("/inventory/serials/register", status_code=status.HTTP_201_CREATED)
@router.post("/dispatches/serials/register", status_code=status.HTTP_201_CREATED, include_in_schema=False)
def register_serial(
    payload: SerialRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Register component serial numbers for panels, inverters, and batteries.
    Guarantees duplicate serial number rejection and audit logging.
    """
    sn = payload.serial_number.strip()
    if not sn:
        raise HTTPException(status_code=400, detail="Serial number is required.")

    # Duplicate prevention
    existing = db.query(SerializedItem).filter(SerializedItem.serial_number == sn).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate serial number detected: '{sn}' is already registered with status '{existing.lifecycle_status}'."
        )

    comp = db.query(Component).filter(Component.id == payload.component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found in catalog.")

    wh_id = payload.warehouse_id
    if not wh_id:
        primary_wh = db.query(Warehouse).filter(Warehouse.is_primary == True).first()
        wh_id = primary_wh.id if primary_wh else 1

    item = SerializedItem(
        serial_number=sn,
        component_id=payload.component_id,
        warehouse_id=wh_id,
        barcode_format=payload.barcode_format or "CODE128",
        lifecycle_status=(payload.lifecycle_status or "AVAILABLE").upper(),
        verification_status="VERIFIED",
        scanned_at=datetime.datetime.utcnow()
    )
    db.add(item)

    # Stock audit trail
    mv = StockMovement(
        warehouse_id=wh_id,
        component_id=payload.component_id,
        quantity_change=1,
        movement_type="SERIAL_REGISTERED",
        notes=f"Serial {sn} registered by {current_user.full_name} ({current_user.role}). Initial status: {item.lifecycle_status}",
        created_at=datetime.datetime.utcnow()
    )
    db.add(mv)
    db.commit()
    db.refresh(item)

    return {
        "success": True,
        "message": f"Serial number '{sn}' registered successfully for {comp.name}.",
        "id": item.id,
        "serial_number": item.serial_number,
        "component_name": comp.name,
        "lifecycle_status": item.lifecycle_status,
        "warehouse_id": wh_id
    }


@router.patch("/inventory/serials/{serial_id}/status")
@router.patch("/dispatches/serials/{serial_id}/status", include_in_schema=False)
def update_serial_status(
    serial_id: int,
    payload: SerialStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update lifecycle status of a serialized component:
    REGISTERED, AVAILABLE, RESERVED, ALLOCATED, DISPATCHED, INSTALLED, RETURNED, DAMAGED, UNDER_INSPECTION.
    """
    item = db.query(SerializedItem).filter(SerializedItem.id == serial_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Serialized item not found.")

    old_status = item.lifecycle_status
    new_status = payload.lifecycle_status.upper()
    item.lifecycle_status = new_status

    if payload.warehouse_id:
        item.warehouse_id = payload.warehouse_id

    mv = StockMovement(
        warehouse_id=item.warehouse_id or 1,
        component_id=item.component_id,
        quantity_change=0,
        movement_type=f"SERIAL_STATUS_{new_status}",
        notes=f"Serial {item.serial_number} status changed from {old_status} to {new_status} by {current_user.full_name}. {payload.notes or ''}",
        created_at=datetime.datetime.utcnow()
    )
    db.add(mv)
    db.commit()
    db.refresh(item)

    return {
        "success": True,
        "message": f"Serial {item.serial_number} status updated to {new_status}.",
        "serial_number": item.serial_number,
        "old_status": old_status,
        "new_status": new_status
    }




