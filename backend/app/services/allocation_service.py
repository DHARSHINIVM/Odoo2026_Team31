from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import (
    Order, BillOfMaterials, BOMItem, BOMAllocation,
    Warehouse, WarehouseStock, StockMovement, Component
)


class MultiWarehouseAllocationService:
    @staticmethod
    def simulate_allocation_plan(
        db: Session,
        bom_id: int,
        preferred_warehouse_id: Optional[int] = None
    ) -> Dict[str, Any]:
        bom = db.query(BillOfMaterials).filter(BillOfMaterials.id == bom_id).first()
        if not bom:
            raise HTTPException(status_code=404, detail="BOM not found")

        # 1. Fetch warehouses in priority order
        warehouses = db.query(Warehouse).all()
        if not warehouses:
            raise HTTPException(status_code=400, detail="No warehouses configured in the system")

        if preferred_warehouse_id:
            warehouses = sorted(
                warehouses,
                key=lambda w: (0 if w.id == preferred_warehouse_id else (1 if w.is_primary else 2))
            )
        else:
            warehouses = sorted(warehouses, key=lambda w: (0 if w.is_primary else 1))

        # 2. In-memory available stock tracker: (warehouse_id, component_id) -> available_qty
        stock_tracker = {}
        for w in warehouses:
            for s in w.stocks:
                available = max(0, s.qty_on_hand - s.qty_reserved)
                stock_tracker[(w.id, s.component_id)] = available

        if not bom.items or len(bom.items) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Missing BOM Component: BOM #{bom.bom_number} contains no component items. Configure Bill of Materials items before allocation."
            )

        plan = []
        shortages = []
        is_fully_satisfiable = True

        for item in bom.items:
            comp = item.component
            if not comp:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing BOM Component: BOM Item #{item.id} references component #{item.component_id} which does not exist in the catalog."
                )
            needed = item.quantity_required - item.quantity_allocated
            if needed <= 0:
                continue

            item_allocations = []
            for w in warehouses:
                avail = stock_tracker.get((w.id, item.component_id), 0)
                if avail > 0:
                    take = min(needed, avail)
                    item_allocations.append({
                        "warehouse_id": w.id,
                        "warehouse_name": w.name,
                        "warehouse_city": w.city,
                        "allocated_quantity": take
                    })
                    stock_tracker[(w.id, item.component_id)] -= take
                    needed -= take
                    if needed == 0:
                        break

            if needed > 0:
                is_fully_satisfiable = False
                shortages.append({
                    "component_id": item.component_id,
                    "component_name": comp.name if comp else f"Component #{item.component_id}",
                    "sku": comp.sku if comp else "N/A",
                    "quantity_required": item.quantity_required,
                    "quantity_missing": needed
                })

            plan.append({
                "bom_item_id": item.id,
                "component_id": item.component_id,
                "component_name": comp.name if comp else f"Component #{item.component_id}",
                "category": comp.category if comp else "BOS",
                "quantity_required": item.quantity_required,
                "allocations": item_allocations,
                "is_fulfilled": needed == 0
            })

        return {
            "bom_id": bom.id,
            "bom_number": bom.bom_number,
            "is_fully_satisfiable": is_fully_satisfiable,
            "shortages": shortages,
            "plan": plan
        }

    @staticmethod
    def execute_allocation(
        db: Session,
        order_id: int,
        preferred_warehouse_id: Optional[int] = None,
        allow_partial: bool = False
    ) -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if not order.bom:
            raise HTTPException(status_code=400, detail="BOM must be generated before allocating inventory")

        bom = order.bom

        # 1. Simulate and validate complete plan before making any reservations
        simulation = MultiWarehouseAllocationService.simulate_allocation_plan(
            db, bom.id, preferred_warehouse_id=preferred_warehouse_id
        )

        if not simulation["is_fully_satisfiable"] and not allow_partial:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Stock shortage detected across warehouses. Complete allocation aborted to prevent broken inventory state.",
                    "shortages": simulation["shortages"],
                    "suggestion": "Restock missing items or enable 'allow_partial' to commit available inventory."
                }
            )

        # 2. Transactionally apply reservations
        created_allocations = []
        for p in simulation["plan"]:
            bom_item = db.query(BOMItem).filter(BOMItem.id == p["bom_item_id"]).first()
            if not bom_item:
                continue

            for alloc in p["allocations"]:
                qty = alloc["allocated_quantity"]
                if qty <= 0:
                    continue

                # Create BOMAllocation
                bom_alloc = BOMAllocation(
                    bom_item_id=bom_item.id,
                    warehouse_id=alloc["warehouse_id"],
                    allocated_quantity=qty,
                    status="RESERVED"
                )
                db.add(bom_alloc)

                # Update stock reservation
                stock = db.query(WarehouseStock).filter(
                    WarehouseStock.warehouse_id == alloc["warehouse_id"],
                    WarehouseStock.component_id == bom_item.component_id
                ).first()

                if not stock or (stock.qty_on_hand - stock.qty_reserved) < qty:
                    avail = (stock.qty_on_hand - stock.qty_reserved) if stock else 0
                    comp_name = bom_item.component.name if bom_item.component else f"Component #{bom_item.component_id}"
                    raise HTTPException(
                        status_code=400,
                        detail=f"Inventory Allocation Error: Insufficient available physical stock for '{comp_name}' in warehouse #{alloc['warehouse_id']}. Available: {avail}, Requested: {qty}. Never creating phantom inventory."
                    )

                stock.qty_reserved += qty

                # Log stock movement
                movement = StockMovement(
                    warehouse_id=alloc["warehouse_id"],
                    component_id=bom_item.component_id,
                    quantity_change=-qty,
                    movement_type="ALLOCATION_RESERVE",
                    notes=f"Reserved {qty} units for Order {order.order_number} (BOM {bom.bom_number})"
                )
                db.add(movement)

                bom_item.quantity_allocated += qty
                created_allocations.append({
                    "bom_item_id": bom_item.id,
                    "component_id": bom_item.component_id,
                    "warehouse_id": alloc["warehouse_id"],
                    "allocated_quantity": qty
                })

            # Update BOMItem status
            if bom_item.quantity_allocated >= bom_item.quantity_required:
                bom_item.status = "FULLY_ALLOCATED"
            elif bom_item.quantity_allocated > 0:
                bom_item.status = "PARTIALLY_ALLOCATED"

        # Check if all items in BOM are now fulfilled
        all_fulfilled = all(item.quantity_allocated >= item.quantity_required for item in bom.items)
        if all_fulfilled:
            bom.status = "ALLOCATED"
            order.stage = "INVENTORY_ALLOCATED"
        elif any(item.quantity_allocated > 0 for item in bom.items):
            order.stage = "INVENTORY_ALLOCATED"

        db.commit()
        db.refresh(bom)
        db.refresh(order)

        return {
            "success": True,
            "order_number": order.order_number,
            "order_stage": order.stage,
            "bom_number": bom.bom_number,
            "bom_status": bom.status,
            "is_fully_allocated": all_fulfilled,
            "allocations_count": len(created_allocations),
            "allocations": created_allocations,
            "shortages": simulation["shortages"]
        }

