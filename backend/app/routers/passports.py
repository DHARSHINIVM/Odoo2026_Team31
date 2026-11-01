import json
import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DigitalSolarPassport, Order, Installation, ServiceTicket, User
from app.schemas.entities import DigitalSolarPassportOut, PublicSolarPassportOut, WarrantyOut
from app.services.auth_service import get_current_user, require_roles
from app.services.passport_service import PassportService

router = APIRouter(prefix="/passports", tags=["Digital Solar Passport"])


@router.get("", response_model=List[Dict[str, Any]])
def list_passports(
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Feature 1: List all generated Digital Solar Passports.
    Supports comprehensive search across Passport Number, Customer Name, City, Order Number,
    Installation Number, and Component Serial Number.
    """
    query = db.query(DigitalSolarPassport)
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER":
        query = query.filter(DigitalSolarPassport.customer_id == current_user.customer_id)
    passports = query.order_by(DigitalSolarPassport.commissioning_date.desc()).all()
    results = []
    clean_q = q.strip().lower() if q else None

    for p in passports:
        order = p.order
        cust = p.customer
        inst = p.installation

        if clean_q:
            matches = [
                clean_q in p.passport_number.lower(),
                cust and clean_q in cust.name.lower(),
                cust and cust.city and clean_q in cust.city.lower(),
                order and clean_q in order.order_number.lower(),
                inst and clean_q in inst.installation_number.lower(),
                any(clean_q in (w.serial_number or "").lower() for w in p.warranties)
            ]
            if not any(matches):
                continue

        results.append({
            "id": p.id,
            "uuid": p.uuid,
            "passport_number": p.passport_number,
            "order_id": p.order_id,
            "order_number": order.order_number if order else "N/A",
            "customer_id": p.customer_id,
            "customer_name": cust.name if cust else "N/A",
            "customer_city": cust.city if cust else "N/A",
            "customer_phone": cust.phone if cust else None,
            "installation_id": p.installation_id,
            "installation_number": inst.installation_number if inst else "N/A",
            "system_capacity_kw": p.system_capacity_kw,
            "grid_type": p.grid_type,
            "lifecycle_status": p.lifecycle_status or "ACTIVE",
            "commissioning_date": p.commissioning_date.strftime("%Y-%m-%d") if p.commissioning_date else None,
            "system_health_score": p.system_health_score,
            "qr_code_token": p.qr_code_token,
            "public_lookup_url": f"/passport/public/{p.qr_code_token}",
            "serial_count": sum(1 for w in p.warranties if w.serial_number and not w.serial_number.startswith("EPC-")),
            "warranty_count": len(p.warranties),
            "open_tickets_count": sum(1 for t in p.service_tickets if t.status not in ("RESOLVED", "CLOSED"))
        })

    return results


@router.get("/public/{token}", response_model=PublicSolarPassportOut)
def get_public_passport(token: str, db: Session = Depends(get_db)):
    """
    Public lookup page endpoint for QR code validation.
    Returns technical equipment and warranty verification without exposing customer mobile/billing records.
    """
    return PassportService.get_public_passport(db, token)


@router.get("/detail/{identifier}", response_model=DigitalSolarPassportOut)
@router.get("/{identifier}", response_model=DigitalSolarPassportOut)
def get_order_passport(
    identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Internal comprehensive Solar Passport view with full equipment serials and warranty files.
    Accepts Order ID (int), Passport ID (int), or Passport Number (str).
    """
    passport = None
    if identifier.isdigit():
        target_id = int(identifier)
        # Check by passport ID first, then by order ID
        passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.id == target_id).first()
        if not passport:
            passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.order_id == target_id).first()
    else:
        passport = db.query(DigitalSolarPassport).filter(
            (DigitalSolarPassport.passport_number == identifier) |
            (DigitalSolarPassport.qr_code_token == identifier)
        ).first()

    if not passport:
        raise HTTPException(
            status_code=404,
            detail=f"Digital Solar Passport '{identifier}' has not been generated yet. Commission the installation first."
        )

    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER" and passport.customer_id != current_user.customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to view another customer's Digital Solar Passport."
        )

    order = passport.order
    customer = passport.customer
    inst = passport.installation

    # Evidence files from installation
    evidence_list = []
    if inst and inst.evidence_files:
        try:
            evidence_list = json.loads(inst.evidence_files)
        except Exception:
            evidence_list = []

    # Warranties
    warranties_out = []
    now = datetime.datetime.utcnow() if hasattr(datetime, 'datetime') else None
    for w in passport.warranties:
        comp = w.component
        warranties_out.append(WarrantyOut(
            id=w.id,
            uuid=w.uuid,
            passport_id=w.passport_id,
            component_id=w.component_id,
            component_name=comp.name if comp else None,
            serial_number=w.serial_number,
            manufacturer=w.manufacturer,
            warranty_type=w.warranty_type,
            duration_years=w.duration_years,
            start_date=w.start_date,
            end_date=w.end_date,
            terms_summary=w.terms_summary,
            status=w.status,
            is_valid=w.status == "ACTIVE"
        ))

    # Serialized components list (Actual physical installed hardware)
    serialized_comps = []
    if inst and inst.serialized_items:
        for it in inst.serialized_items:
            comp = it.component
            w = next((w for w in passport.warranties if w.serial_number == it.serial_number), None)
            serialized_comps.append({
                "serial_number": it.serial_number,
                "component_name": comp.name if comp else "Solar Component",
                "category": comp.category if comp else "EQUIPMENT",
                "sku": comp.sku if comp else "N/A",
                "manufacturer": comp.manufacturer if comp else "N/A",
                "duration_years": w.duration_years if w else 10,
                "start_date": w.start_date.strftime("%Y-%m-%d") if w else (inst.commissioning_date.strftime("%Y-%m-%d") if inst.commissioning_date else "2026-01-01"),
                "end_date": w.end_date.strftime("%Y-%m-%d") if w else "2036-01-01",
                "status": w.status if w else "ACTIVE",
                "lifecycle_status": it.lifecycle_status
            })

    if not serialized_comps:
        for w in passport.warranties:
            if w.serial_number and not w.serial_number.startswith("EPC-"):
                comp = w.component
                serialized_comps.append({
                    "serial_number": w.serial_number,
                    "component_name": comp.name if comp else "Solar Component",
                    "category": comp.category if comp else "EQUIPMENT",
                    "sku": comp.sku if comp else "N/A",
                    "manufacturer": w.manufacturer or (comp.manufacturer if comp else "N/A"),
                    "duration_years": w.duration_years,
                    "start_date": w.start_date.strftime("%Y-%m-%d"),
                    "end_date": w.end_date.strftime("%Y-%m-%d"),
                    "status": w.status,
                    "lifecycle_status": "INSTALLED"
                })

    # Service tickets history
    service_history = []
    for t in passport.service_tickets:
        service_history.append({
            "ticket_number": t.ticket_number,
            "issue_category": t.issue_category,
            "priority": t.priority,
            "description": t.description,
            "status": t.status,
            "assigned_technician": t.assigned_technician,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M"),
            "resolved_at": t.resolved_at.strftime("%Y-%m-%d %H:%M") if t.resolved_at else None
        })

    # Generate QR Code SVG for lookup URL
    lookup_url = f"/passport/public/{passport.qr_code_token}"
    qr_svg = PassportService.generate_qr_svg(lookup_url)

    return DigitalSolarPassportOut(
        id=passport.id,
        uuid=passport.uuid,
        passport_number=passport.passport_number,
        order_id=passport.order_id,
        order_number=order.order_number if order else None,
        customer_id=passport.customer_id,
        customer_name=customer.name if customer else None,
        customer_city=customer.city if customer else None,
        installation_id=passport.installation_id,
        qr_code_token=passport.qr_code_token,
        qr_code_svg=qr_svg,
        public_lookup_url=lookup_url,
        system_capacity_kw=passport.system_capacity_kw,
        grid_type=passport.grid_type,
        commissioning_date=passport.commissioning_date,
        pv_module_summary=passport.pv_module_summary,
        inverter_summary=passport.inverter_summary,
        estimated_lifetime_mwh=passport.estimated_lifetime_mwh,
        co2_offset_tonnes=passport.co2_offset_tonnes,
        system_health_score=passport.system_health_score,
        is_active=passport.is_active,
        serialized_components=serialized_comps,
        warranties=warranties_out,
        service_history=service_history,
        evidence_files=evidence_list
    )


@router.get("/{order_id}/qr")
def get_passport_qr_svg(order_id: int, db: Session = Depends(get_db)):
    """Return pure SVG QR code image."""
    passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.order_id == order_id).first()
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found for this order")

    lookup_url = f"/passport/public/{passport.qr_code_token}"
    svg = PassportService.generate_qr_svg(lookup_url)
    return Response(content=svg, media_type="image/svg+xml")
