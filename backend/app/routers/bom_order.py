from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, BillOfMaterials, BOMItem, BOMAllocation, Component, Warehouse
from app.services.bom_service import BOMService
from app.services.allocation_service import MultiWarehouseAllocationService
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/orders", tags=["Order BOM & Inventory Allocation"], dependencies=[Depends(get_current_user)])


@router.post("/{order_id}/generate-bom")
def generate_order_bom(order_id: int, db: Session = Depends(get_db)):
    bom = BOMService.generate_bom_for_order(db, order_id)
    order = db.query(Order).filter(Order.id == order_id).first()

    items = []
    for it in bom.items:
        comp = it.component
        items.append({
            "id": it.id,
            "component_id": it.component_id,
            "component_name": comp.name if comp else f"Component #{it.component_id}",
            "sku": comp.sku if comp else "N/A",
            "category": comp.category if comp else "BOS",
            "quantity_required": it.quantity_required,
            "quantity_allocated": it.quantity_allocated,
            "quantity_dispatched": it.quantity_dispatched,
            "status": it.status,
            "unit_cost_inr": round(comp.unit_cost_paise / 100, 2) if comp else 0,
            "total_cost_inr": round((it.quantity_required * comp.unit_cost_paise) / 100, 2) if comp else 0
        })

    return {
        "success": True,
        "message": f"Bill of Materials {bom.bom_number} generated successfully for Order {order.order_number}.",
        "order_number": order.order_number,
        "order_stage": order.stage,
        "bom_id": bom.id,
        "bom_number": bom.bom_number,
        "system_capacity_kw": bom.system_capacity_kw,
        "total_cost_inr": round(bom.total_cost_paise / 100, 2),
        "status": bom.status,
        "items_count": len(items),
        "items": items
    }


@router.get("/{order_id}/bom")
def get_order_bom(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not order.bom:
        raise HTTPException(status_code=404, detail="BOM has not yet been generated for this order. Call POST /api/orders/{id}/generate-bom first.")

    bom = order.bom
    items = []
    for it in bom.items:
        comp = it.component
        allocations = []
        for a in it.allocations:
            wh = a.warehouse
            allocations.append({
                "allocation_id": a.id,
                "warehouse_id": a.warehouse_id,
                "warehouse_name": wh.name if wh else "N/A",
                "warehouse_city": wh.city if wh else "N/A",
                "allocated_quantity": a.allocated_quantity,
                "status": a.status
            })

        items.append({
            "id": it.id,
            "component_id": it.component_id,
            "component_name": comp.name if comp else f"Component #{it.component_id}",
            "sku": comp.sku if comp else "N/A",
            "category": comp.category if comp else "BOS",
            "quantity_required": it.quantity_required,
            "quantity_allocated": it.quantity_allocated,
            "quantity_dispatched": it.quantity_dispatched,
            "status": it.status,
            "unit_cost_inr": round(comp.unit_cost_paise / 100, 2) if comp else 0,
            "total_cost_inr": round((it.quantity_required * comp.unit_cost_paise) / 100, 2) if comp else 0,
            "allocations": allocations
        })

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "order_stage": order.stage,
        "customer_name": order.customer.name if order.customer else "N/A",
        "customer_city": order.customer.city if order.customer else "N/A",
        "bom_id": bom.id,
        "bom_number": bom.bom_number,
        "system_capacity_kw": bom.system_capacity_kw,
        "total_cost_inr": round(bom.total_cost_paise / 100, 2),
        "status": bom.status,
        "items": items
    }


@router.post("/{order_id}/allocate-inventory")
def allocate_order_inventory(order_id: int, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    payload = payload or {}
    preferred_warehouse_id = payload.get("preferred_warehouse_id")
    allow_partial = bool(payload.get("allow_partial", False))

    result = MultiWarehouseAllocationService.execute_allocation(
        db=db,
        order_id=order_id,
        preferred_warehouse_id=preferred_warehouse_id,
        allow_partial=allow_partial
    )
    return result


@router.get("/{order_id}/allocation-simulation")
def simulate_order_allocation(order_id: int, preferred_warehouse_id: Optional[int] = None, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or not order.bom:
        raise HTTPException(status_code=404, detail="Order or BOM not found")

    sim = MultiWarehouseAllocationService.simulate_allocation_plan(
        db, order.bom.id, preferred_warehouse_id=preferred_warehouse_id
    )
    return sim

