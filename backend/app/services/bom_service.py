import math
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Order, BillOfMaterials, BOMItem, Package, PackageItem, Component


class BOMService:
    @staticmethod
    def generate_bom_for_order(db: Session, order_id: int) -> BillOfMaterials:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Prevent duplicate BOM generation: if already exists, return existing BOM
        if order.bom:
            return order.bom

        quotation = order.quotation
        if not quotation:
            raise HTTPException(status_code=400, detail="Order has no associated quotation")

        capacity_kw = quotation.system_capacity_kw or 5.0
        count = db.query(BillOfMaterials).count() + 1
        bom_number = f"BOM-2026-{count:03d}"

        bom = BillOfMaterials(
            order_id=order.id,
            bom_number=bom_number,
            system_capacity_kw=capacity_kw,
            total_cost_paise=0,
            status="DRAFT"
        )
        db.add(bom)
        db.flush()

        total_material_cost_paise = 0

        # Case A: Generated from Quotation's Package
        if quotation.package_id:
            package = db.query(Package).filter(Package.id == quotation.package_id).first()
            if package and package.items:
                for p_item in package.items:
                    bom_item = BOMItem(
                        bom_id=bom.id,
                        component_id=p_item.component_id,
                        quantity_required=p_item.quantity,
                        quantity_allocated=0,
                        quantity_dispatched=0,
                        status="PENDING"
                    )
                    db.add(bom_item)
                    if p_item.component:
                        total_material_cost_paise += p_item.quantity * p_item.component.unit_cost_paise
        else:
            # Case B: System capacity automated component sizing
            num_panels = math.ceil((capacity_kw * 1000) / 550)
            panel = db.query(Component).filter(Component.category == "PANEL", Component.is_active == True).first()
            inverter = None
            if capacity_kw <= 5.5:
                inverter = db.query(Component).filter(Component.category == "INVERTER", Component.sku.ilike("%SG5K%")).first()
            if not inverter:
                inverter = db.query(Component).filter(Component.category == "INVERTER", Component.is_active == True).first()

            structure = db.query(Component).filter(Component.category == "STRUCTURE", Component.is_active == True).first()
            cable = db.query(Component).filter(Component.category == "CABLE", Component.is_active == True).first()
            meter = db.query(Component).filter(Component.category == "METER", Component.is_active == True).first()
            spd = db.query(Component).filter(Component.category == "PROTECTION", Component.is_active == True).first()

            items_to_create = []
            if panel:
                items_to_create.append((panel, num_panels))
            if inverter:
                items_to_create.append((inverter, 1))
            if structure:
                items_to_create.append((structure, math.ceil(num_panels / 4)))
            if cable:
                items_to_create.append((cable, 1 if capacity_kw <= 5 else 2))
            if meter:
                items_to_create.append((meter, 1))
            if spd:
                items_to_create.append((spd, 1 if capacity_kw <= 5 else 2))

            for comp, qty in items_to_create:
                bom_item = BOMItem(
                    bom_id=bom.id,
                    component_id=comp.id,
                    quantity_required=qty,
                    quantity_allocated=0,
                    quantity_dispatched=0,
                    status="PENDING"
                )
                db.add(bom_item)
                total_material_cost_paise += qty * comp.unit_cost_paise

        bom.total_cost_paise = total_material_cost_paise
        order.stage = "BOM_GENERATED"

        db.commit()
        db.refresh(bom)
        return bom

