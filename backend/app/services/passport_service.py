import datetime
import json
import secrets
from typing import Dict, Any, Optional, List
import qrcode
import qrcode.image.svg
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import (
    Order, Installation, DigitalSolarPassport, Warranty,
    SerializedItem, Component, Customer, Dispatch,
    Warehouse, WarehouseStock, StockMovement, BillOfMaterials
)


class PassportService:
    @staticmethod
    def generate_qr_svg(url: str) -> str:
        """Generate a pure SVG QR code string for the lookup URL."""
        factory = qrcode.image.svg.SvgImage
        img = qrcode.make(url, image_factory=factory, box_size=10, border=2)
        return img.to_string(encoding="unicode")

    @staticmethod
    def create_warehouse_passport(
        db: Session,
        order_id: int,
        warehouse_id: int,
        warehouse_manager_id: Optional[int],
        scanned_serials: List[Dict[str, Any]],
        vehicle_number: Optional[str] = None,
        driver_name: Optional[str] = None,
        driver_phone: Optional[str] = None,
        notes: Optional[str] = None,
        is_partial: bool = False,
        dispatched_component_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Stage A: Warehouse Manager creates the Digital Solar Passport during dispatch.
        - Scans and validates component serial numbers.
        - Relieves physical warehouse inventory (decrements qty_on_hand and qty_reserved).
        - Generates unique Passport ID and cryptographic QR code.
        - Initializes lifecycle state to DISPATCHED / AWAITING_INSTALLATION.
        - Prevents duplicate passport creation, duplicate batch serials, and over-dispatch.
        - Fully transactional with immediate rollback on error (Problem 17).
        """
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Repeated dispatch confirmation guard (Problem 15)
        if order.stage in ("DISPATCHED", "COMPLETED") and not is_partial:
            raise HTTPException(
                status_code=400,
                detail=f"Order {order.order_number} has already been dispatched. Repeated dispatch confirmation rejected."
            )

        # Check for existing active passport to prevent duplicate creation (Problem 19)
        existing_passport = db.query(DigitalSolarPassport).filter(
            DigitalSolarPassport.order_id == order.id,
            DigitalSolarPassport.is_active == True
        ).first()
        if existing_passport:
            raise HTTPException(
                status_code=400,
                detail=f"A Digital Solar Passport already exists for this order ({existing_passport.passport_number}). Cannot create a duplicate passport."
            )

        wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not wh:
            wh = db.query(Warehouse).first()
            if not wh:
                raise HTTPException(status_code=400, detail="No valid warehouse found.")

        # Require at least 1 scanned physical serial
        if not scanned_serials:
            raise HTTPException(
                status_code=400,
                detail="Scanning Required: At least one physical component serial number must be scanned to create a Digital Solar Passport."
            )

        # Validate scanned serials uniqueness against DB and within incoming batch (Problems 4, 5, 6)
        seen_batch_serials = set()
        cleaned_serials = []
        for s in scanned_serials:
            sn = s.get("serial_number", "").strip()
            if not sn:
                continue
            if sn in seen_batch_serials:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate Serial in Batch: Serial '{sn}' was scanned multiple times in this dispatch batch."
                )
            seen_batch_serials.add(sn)

            existing_sn = db.query(SerializedItem).filter(SerializedItem.serial_number == sn).first()
            if existing_sn:
                raise HTTPException(
                    status_code=400,
                    detail=f"Serial Number Conflict: Serial '{sn}' is already registered in Dispatch #{existing_sn.dispatch_id}. Cannot reuse serials."
                )
            comp_id = s.get("component_id")
            comp = db.query(Component).filter(Component.id == comp_id).first() if comp_id else None
            if not comp:
                raise HTTPException(status_code=400, detail=f"Component ID #{comp_id} for serial '{sn}' was not found in catalog.")

            if order.bom and order.bom.items:
                bom_comps = {it.component_id for it in order.bom.items}
                if comp.id not in bom_comps:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Wrong component scanned: '{comp.name}' is not in the Bill of Materials for Order {order.order_number}."
                    )

            cleaned_serials.append({
                "serial_number": sn,
                "component_id": comp.id,
                "barcode_format": s.get("barcode_format", "CODE128")
            })

        try:
            # Determine which component IDs are included in this dispatch
            active_comp_ids = set(dispatched_component_ids) if dispatched_component_ids else {s["component_id"] for s in cleaned_serials}

            # Relieve physical inventory for allocated BOM items
            if order.bom and order.bom.items:
                for bom_item in order.bom.items:
                    # In partial dispatch, only relieve items being dispatched
                    if is_partial and bom_item.component_id not in active_comp_ids:
                        continue

                    for alloc in bom_item.allocations:
                        alloc_wh_id = alloc.warehouse_id or wh.id
                        qty = alloc.allocated_quantity
                        if qty <= 0:
                            continue
                        stock = db.query(WarehouseStock).filter(
                            WarehouseStock.warehouse_id == alloc_wh_id,
                            WarehouseStock.component_id == bom_item.component_id
                        ).first()
                        if stock:
                            if stock.qty_on_hand < qty:
                                comp_name = bom_item.component.name if bom_item.component else f"Component #{bom_item.component_id}"
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Insufficient physical stock: Warehouse #{alloc_wh_id} has {stock.qty_on_hand} units of '{comp_name}', but {qty} are required for dispatch."
                                )
                            stock.qty_on_hand -= qty
                            stock.qty_reserved = max(0, stock.qty_reserved - qty)
                        
                        alloc.status = "DISPATCHED"
                        
                        movement = StockMovement(
                            warehouse_id=alloc_wh_id,
                            component_id=bom_item.component_id,
                            quantity_change=-qty,
                            movement_type="DISPATCH",
                            notes=f"{'Partial' if is_partial else 'Full'} dispatch of {qty} units for Order {order.order_number}"
                        )
                        db.add(movement)

            # Create Dispatch record
            next_dsp = db.query(Dispatch).count() + 1
            dispatch_num = f"DSP-2026-{next_dsp:03d}"
            disp_date = datetime.datetime.utcnow()

            dispatch = Dispatch(
                dispatch_number=dispatch_num,
                order_id=order.id,
                warehouse_id=wh.id,
                source_warehouses=wh.name,
                vehicle_number=vehicle_number or "MH-12-SP-2026",
                driver_name=driver_name or "Kishore Gaikwad",
                driver_phone=driver_phone or "+91 98220 77112",
                dispatch_date=disp_date,
                estimated_delivery_date=disp_date + datetime.timedelta(days=2),
                status="IN_TRANSIT",
                notes=notes or f"Dispatched with Digital Passport for {order.customer.name} site."
            )
            db.add(dispatch)
            db.flush()

            # Create SerializedItem records
            serialized_records = []
            for s in cleaned_serials:
                item = SerializedItem(
                    dispatch_id=dispatch.id,
                    component_id=s["component_id"],
                    warehouse_id=wh.id,
                    serial_number=s["serial_number"],
                    barcode_format=s["barcode_format"],
                    scanned_at=datetime.datetime.utcnow(),
                    lifecycle_status="DISPATCHED",
                    verification_status="VERIFIED"
                )
                db.add(item)
                serialized_records.append(item)
            db.flush()

            # System capacity & sizing
            system_capacity_kw = order.quotation.system_capacity_kw if order.quotation else 5.0
            grid_type = "ON_GRID"
            if order.quotation and order.quotation.enquiry:
                grid_type = order.quotation.enquiry.grid_type

            annual_kwh = system_capacity_kw * 1450.0
            lifetime_mwh = round((annual_kwh * 25) / 1000.0, 1)
            co2_offset = round(lifetime_mwh * 0.82, 1)

            panel_count = sum(1 for it in serialized_records if it.component and it.component.category == "PANEL")
            inverter_count = sum(1 for it in serialized_records if it.component and it.component.category == "INVERTER")
            battery_count = sum(1 for it in serialized_records if it.component and it.component.category == "BATTERY")

            pv_summary = f"{panel_count} High-Efficiency PV Modules ({system_capacity_kw} kW System)" if panel_count else f"Tier-1 Solar PV Modules ({system_capacity_kw} kW)"
            inverter_summary = f"{inverter_count} Grid-Tied Inverter" if inverter_count else "High-Efficiency Grid Inverter"
            battery_summary = f"{battery_count} Storage Battery Pack" if battery_count else None

            # Unique Passport credentials
            lookup_token = secrets.token_urlsafe(32)
            passport_number = f"DSP-2026-{order.id:04d}"

            passport = DigitalSolarPassport(
                passport_number=passport_number,
                order_id=order.id,
                customer_id=order.customer_id,
                warehouse_id=wh.id,
                dispatch_id=dispatch.id,
                warehouse_manager_id=warehouse_manager_id,
                qr_code_token=lookup_token,
                system_capacity_kw=system_capacity_kw,
                grid_type=grid_type,
                lifecycle_status="DISPATCHED",
                created_at=datetime.datetime.utcnow(),
                dispatch_date=disp_date,
                commissioning_date=disp_date,
                pv_module_summary=pv_summary,
                inverter_summary=inverter_summary,
                battery_summary=battery_summary,
                estimated_lifetime_mwh=lifetime_mwh,
                co2_offset_tonnes=co2_offset,
                system_health_score=98,
                is_active=True
            )
            db.add(passport)
            db.flush()

            # Link or create initial Installation
            inst = db.query(Installation).filter(Installation.order_id == order.id).first()
            if not inst:
                inst = Installation(
                    installation_number=f"INST-2026-{order.id:03d}",
                    order_id=order.id,
                    assigned_technician="Ramesh Patil (Lead Certified Solar Engineer)",
                    lead_engineer="Ramesh Patil",
                    team_size=4,
                    installation_address=f"{order.customer.address}, {order.customer.city}",
                    scheduled_start_date=disp_date + datetime.timedelta(days=1),
                    status="AWAITING_INSTALLATION"
                )
                db.add(inst)
                db.flush()
            else:
                inst.status = "AWAITING_INSTALLATION"

            passport.installation_id = inst.id

            # Attach serialized items to installation
            for item in serialized_records:
                item.installation_id = inst.id

            # Update order stage (Problem 13: Partial Dispatch vs Full Dispatch)
            order.stage = "PARTIALLY_DISPATCHED" if is_partial else "DISPATCHED"

            db.commit()
            db.refresh(passport)
            db.refresh(dispatch)

            lookup_url = f"/passport/public/{passport.qr_code_token}"
            qr_svg = PassportService.generate_qr_svg(lookup_url)

            return {
                "success": True,
                "message": f"Digital Solar Passport {passport.passport_number} created and order dispatched.",
                "passport_id": passport.id,
                "passport_number": passport.passport_number,
                "lifecycle_status": passport.lifecycle_status,
                "qr_code_token": passport.qr_code_token,
                "qr_code_svg": qr_svg,
                "public_lookup_url": lookup_url,
                "dispatch_number": dispatch.dispatch_number,
                "scanned_serials_count": len(serialized_records),
                "installation_id": inst.id,
                "is_partial": is_partial,
                "order_stage": order.stage
            }
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def generate_passport(db: Session, installation_id: int) -> DigitalSolarPassport:
        """
        Stage B: Complete installation worksheet, advance passport to ACTIVE,
        and activate contractual warranties tied to component serial numbers.
        """
        installation = db.query(Installation).filter(Installation.id == installation_id).first()
        if not installation:
            raise HTTPException(status_code=404, detail="Installation record not found")

        order = installation.order
        if not order:
            raise HTTPException(status_code=400, detail="Installation is not linked to a valid order")

        # Verify all mandatory checklist items are completed
        mandatory_checks = {
            "Mounting structure installed": installation.chk_structure_installed,
            "Solar panels installed": installation.chk_panels_installed,
            "Inverter installed": installation.chk_inverter_installed,
            "Electrical connections completed": installation.chk_electrical_completed,
            "Earthing completed": installation.chk_earthing_completed,
            "Safety checks completed": installation.chk_safety_checks_completed,
            "System tested": installation.chk_system_tested,
            "Customer handover completed": installation.chk_customer_handover_completed,
        }
        incomplete = [item for item, passed in mandatory_checks.items() if not passed]
        if incomplete:
            raise HTTPException(
                status_code=400,
                detail=f"Commissioning Blocked: Mandatory checklist requirements incomplete: {', '.join(incomplete)}."
            )

        # Verify photographic quality evidence is present (Problem 20)
        evidence_list = []
        if installation.evidence_files:
            try:
                evidence_list = json.loads(installation.evidence_files)
            except Exception:
                evidence_list = []
        if not evidence_list or len(evidence_list) == 0:
            raise HTTPException(
                status_code=400,
                detail="Commissioning Blocked: Mandatory photographic evidence missing. Please upload at least one verified installation photograph before commissioning."
            )

        # Verify earthing resistance safety limit (IS 3043: <= 5.0 Ohms)
        if installation.earthing_resistance_ohms is not None and (installation.earthing_resistance_ohms <= 0 or installation.earthing_resistance_ohms > 5.0):
            raise HTTPException(
                status_code=400,
                detail=f"Commissioning Blocked: Earthing resistance ({installation.earthing_resistance_ohms} Ω) exceeds permissible limit of 5.0 Ω (IS 3043)."
            )

        # Check if passport already exists (Warehouse-created)
        passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.order_id == order.id).first()
        
        commissioning_date = installation.commissioning_date or datetime.datetime.utcnow()

        if passport:
            # Advance warehouse-created passport to ACTIVE
            passport.lifecycle_status = "ACTIVE"
            passport.commissioning_date = commissioning_date
            passport.installation_id = installation.id
        else:
            # Fallback if created directly
            lookup_token = secrets.token_urlsafe(32)
            passport_number = f"DSP-2026-{order.id:04d}"
            system_capacity_kw = order.quotation.system_capacity_kw if order.quotation else 5.0
            grid_type = "ON_GRID"
            if order.quotation and order.quotation.enquiry:
                grid_type = order.quotation.enquiry.grid_type

            annual_kwh = system_capacity_kw * 1450.0
            lifetime_mwh = round((annual_kwh * 25) / 1000.0, 1)
            co2_offset = round(lifetime_mwh * 0.82, 1)

            passport = DigitalSolarPassport(
                passport_number=passport_number,
                order_id=order.id,
                customer_id=order.customer_id,
                installation_id=installation.id,
                qr_code_token=lookup_token,
                system_capacity_kw=system_capacity_kw,
                grid_type=grid_type,
                lifecycle_status="ACTIVE",
                commissioning_date=commissioning_date,
                pv_module_summary=f"Tier-1 Solar PV Modules ({system_capacity_kw} kW)",
                inverter_summary="High-Efficiency Grid-Tied Inverter",
                estimated_lifetime_mwh=lifetime_mwh,
                co2_offset_tonnes=co2_offset,
                system_health_score=98,
                is_active=True
            )
            db.add(passport)
            db.flush()

        # Gather serialized items from dispatches
        serialized_items = []
        for dsp in order.dispatches:
            for item in dsp.serialized_items:
                item.installation_id = installation.id
                item.lifecycle_status = "INSTALLED"
                serialized_items.append(item)

        # Activate warranties if not already created
        existing_warranties = db.query(Warranty).filter(Warranty.passport_id == passport.id).all()
        existing_serials = {w.serial_number for w in existing_warranties if w.serial_number}

        for item in serialized_items:
            if item.serial_number in existing_serials:
                continue

            comp = item.component
            if not comp:
                continue

            duration = comp.warranty_years or (25 if comp.category == "PANEL" else 5)
            w_start = commissioning_date
            w_end = w_start + datetime.timedelta(days=int(duration * 365.25))
            w_type = "EQUIPMENT_PERFORMANCE" if comp.category == "PANEL" else "PRODUCT_REPLACEMENT"

            warranty = Warranty(
                passport_id=passport.id,
                component_id=comp.id,
                serial_number=item.serial_number,
                manufacturer=comp.manufacturer,
                warranty_type=w_type,
                duration_years=duration,
                start_date=w_start,
                end_date=w_end,
                terms_summary=f"Official {comp.manufacturer} {duration}-year warranty covering {comp.name}.",
                status="ACTIVE"
            )
            db.add(warranty)
            existing_serials.add(item.serial_number)

        # Add EPC Workmanship Warranty
        epc_serial = f"EPC-{passport.passport_number}"
        if epc_serial not in existing_serials:
            epc_comp_id = serialized_items[0].component_id if serialized_items else 1
            epc_warranty = Warranty(
                passport_id=passport.id,
                component_id=epc_comp_id,
                serial_number=epc_serial,
                manufacturer="SunPower Solutions EPC",
                warranty_type="WORKMANSHIP_EPC",
                duration_years=5,
                start_date=commissioning_date,
                end_date=commissioning_date + datetime.timedelta(days=int(5 * 365.25)),
                terms_summary="Comprehensive SunPower Solutions turnkey engineering, installation and grid interconnection workmanship warranty.",
                status="ACTIVE"
            )
            db.add(epc_warranty)

        # Transition order stage to COMMISSIONED
        order.stage = "COMMISSIONED"
        installation.status = "COMMISSIONED"
        installation.commissioning_date = commissioning_date

        db.commit()
        db.refresh(passport)
        return passport

    @staticmethod
    def get_public_passport(db: Session, token: str) -> Dict[str, Any]:
        """
        Retrieves a sanitized public view of the Digital Solar Passport using its lookup token.
        Excludes sensitive customer mobile numbers and financial/billing records.
        """
        passport = db.query(DigitalSolarPassport).filter(
            DigitalSolarPassport.qr_code_token == token,
            DigitalSolarPassport.is_active == True
        ).first()

        if not passport:
            raise HTTPException(status_code=404, detail="Solar Passport token is invalid or has expired.")

        cust = passport.customer
        customer_display = f"{cust.name} Residence" if cust else "Verified Solar Installation"

        serialized_comps = []
        for w in passport.warranties:
            if w.serial_number and not w.serial_number.startswith("EPC-"):
                comp = w.component
                serialized_comps.append({
                    "serial_number": w.serial_number,
                    "component_name": comp.name if comp else "Solar Equipment",
                    "category": comp.category if comp else "EQUIPMENT",
                    "manufacturer": w.manufacturer or (comp.manufacturer if comp else "Verified Mfr"),
                    "warranty_years": w.duration_years,
                    "warranty_status": w.status,
                    "warranty_end_date": w.end_date.strftime("%Y-%m-%d") if w.end_date else None
                })

        # Fallback to serialized items if warranties not yet generated
        if not serialized_comps and passport.order:
            for dsp in passport.order.dispatches:
                for item in dsp.serialized_items:
                    comp = item.component
                    serialized_comps.append({
                        "serial_number": item.serial_number,
                        "component_name": comp.name if comp else "Solar Equipment",
                        "category": comp.category if comp else "EQUIPMENT",
                        "manufacturer": comp.manufacturer if comp else "Verified Mfr",
                        "warranty_years": comp.warranty_years or 5,
                        "warranty_status": "PENDING_ACTIVATION" if passport.lifecycle_status != "ACTIVE" else "ACTIVE",
                        "warranty_end_date": "Activates upon commissioning"
                    })

        warranties_out = []
        now = datetime.datetime.utcnow()
        for w in passport.warranties:
            warranties_out.append({
                "id": w.id,
                "uuid": w.uuid,
                "passport_id": w.passport_id,
                "component_id": w.component_id,
                "component_name": w.component.name if w.component else "Component",
                "serial_number": w.serial_number,
                "manufacturer": w.manufacturer,
                "warranty_type": w.warranty_type,
                "duration_years": w.duration_years,
                "start_date": w.start_date,
                "end_date": w.end_date,
                "terms_summary": w.terms_summary,
                "status": w.status,
                "is_valid": w.status == "ACTIVE" and (w.end_date > now if w.end_date else True)
            })

        evidence_files = []
        if passport.installation and passport.installation.evidence_files:
            try:
                evidence_files = json.loads(passport.installation.evidence_files)
            except Exception:
                evidence_files = []

        service_history = []
        for t in passport.service_tickets:
            service_history.append({
                "ticket_number": t.ticket_number,
                "issue_category": t.issue_category,
                "priority": t.priority,
                "description": t.description,
                "status": t.status,
                "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else None,
                "resolved_at": t.resolved_at.strftime("%Y-%m-%d %H:%M") if t.resolved_at else None
            })

        lookup_url = f"/passport/public/{passport.qr_code_token}"
        qr_svg = PassportService.generate_qr_svg(lookup_url)

        return {
            "passport_id": passport.id,
            "passport_number": passport.passport_number,
            "lifecycle_status": passport.lifecycle_status or "ACTIVE",
            "qr_code_token": passport.qr_code_token,
            "qr_code_svg": qr_svg,
            "system_capacity_kw": passport.system_capacity_kw,
            "grid_type": passport.grid_type,
            "commissioning_date": passport.commissioning_date,
            "pv_module_summary": passport.pv_module_summary,
            "inverter_summary": passport.inverter_summary,
            "battery_summary": passport.battery_summary,
            "estimated_lifetime_mwh": passport.estimated_lifetime_mwh,
            "co2_offset_tonnes": passport.co2_offset_tonnes,
            "system_health_score": passport.system_health_score,
            "is_active": passport.is_active,
            "customer_display_name": customer_display,
            "city": cust.city if cust else "Maharashtra",
            "state": cust.state if cust else "Maharashtra",
            "serialized_components": serialized_comps,
            "warranties": warranties_out,
            "evidence_files": evidence_files,
            "service_tickets": service_history
        }
