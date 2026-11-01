import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Warranty, WarrantyPolicy, Component, DigitalSolarPassport, Customer, User
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/warranties", tags=["Warranty Management"])


class WarrantyPolicyCreate(BaseModel):
    code: str
    manufacturer: str
    component_category: str
    model_name: Optional[str] = None
    duration_years: int
    warranty_type: str = "PRODUCT_REPLACEMENT"
    terms_summary: str


@router.get("/policies")
def list_warranty_policies(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Module 7: List all standard warranty policies by category."""
    query = db.query(WarrantyPolicy).filter(WarrantyPolicy.is_active == True)
    if category and category.upper() != "ALL":
        query = query.filter(WarrantyPolicy.component_category == category.upper())
    return query.order_by(WarrantyPolicy.component_category, WarrantyPolicy.manufacturer).all()


@router.post("/policies", status_code=status.HTTP_201_CREATED)
def create_warranty_policy(
    payload: WarrantyPolicyCreate,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    existing = db.query(WarrantyPolicy).filter(WarrantyPolicy.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Policy code '{payload.code}' already exists.")

    policy = WarrantyPolicy(
        code=payload.code,
        manufacturer=payload.manufacturer,
        component_category=payload.component_category.upper(),
        model_name=payload.model_name,
        duration_years=payload.duration_years,
        warranty_type=payload.warranty_type,
        terms_summary=payload.terms_summary,
        is_active=True
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


class ReplacementRequest(BaseModel):
    original_serial_number: str
    replacement_serial_number: str
    component_id: Optional[int] = None
    reason: Optional[str] = "Replaced during service maintenance"
    service_ticket_id: Optional[int] = None


@router.get("")
def list_warranties(
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    expiring_days_threshold: int = Query(90, ge=1, le=365, description="Configurable threshold in days for EXPIRING_SOON status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Feature 2: List all registered component warranties with:
    - Configurable expiration threshold (default 90 days).
    - Status filtering (ACTIVE, EXPIRING_SOON, EXPIRED, REPLACED, VOID).
    - Category & text search across Serial Number, Component Name, Manufacturer, Customer, and Passport.
    """
    query = db.query(Warranty).join(Warranty.component)
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER":
        query = query.join(Warranty.passport).filter(DigitalSolarPassport.customer_id == current_user.customer_id)

    if category and category.upper() != "ALL":
        query = query.filter(Component.category == category.upper())

    warranties = query.order_by(Warranty.end_date.asc()).all()
    results = []
    now = datetime.datetime.utcnow()
    clean_search = search.strip().lower() if search else None

    for w in warranties:
        comp = w.component
        passport = w.passport
        customer = passport.customer if passport else None

        is_active = w.status in ("ACTIVE", "EXPIRING_SOON") and w.end_date > now
        days_remaining = max(0, (w.end_date - now).days) if w.end_date > now else 0

        if w.status == "VOID":
            computed_status = "VOID"
        elif w.status == "REPLACED":
            computed_status = "REPLACED"
        elif w.end_date < now:
            computed_status = "EXPIRED"
        elif days_remaining <= expiring_days_threshold:
            computed_status = "EXPIRING_SOON"
        else:
            computed_status = "ACTIVE"

        if status_filter and status_filter.upper() != "ALL":
            if computed_status != status_filter.upper():
                continue

        if clean_search:
            matches = [
                clean_search in (w.serial_number or "").lower(),
                clean_search in (comp.name if comp else "").lower(),
                clean_search in (w.manufacturer or "").lower(),
                clean_search in (customer.name if customer else "").lower(),
                clean_search in (passport.passport_number if passport else "").lower()
            ]
            if not any(matches):
                continue

        results.append({
            "id": w.id,
            "uuid": w.uuid,
            "serial_number": w.serial_number,
            "component_id": w.component_id,
            "component_name": comp.name if comp else "Equipment",
            "category": comp.category if comp else "PANEL",
            "sku": comp.sku if comp else "N/A",
            "manufacturer": w.manufacturer or (comp.manufacturer if comp else "Verified Mfr"),
            "warranty_type": w.warranty_type,
            "duration_years": w.duration_years,
            "start_date": w.start_date.strftime("%Y-%m-%d"),
            "end_date": w.end_date.strftime("%Y-%m-%d"),
            "days_remaining": days_remaining,
            "status": computed_status,
            "is_valid": is_active,
            "terms_summary": w.terms_summary,
            "passport_id": w.passport_id,
            "passport_number": passport.passport_number if passport else None,
            "customer_name": customer.name if customer else None,
            "customer_city": customer.city if customer else None
        })

    return results


@router.get("/check/{serial_number}")
def check_warranty_eligibility(serial_number: str, db: Session = Depends(get_db)):
    """
    Feature 2 & 3 Integration: Verify component warranty status and eligibility for service ticketing.
    Evaluates expiration dates and provides clear coverage disclaimers.
    """
    clean_sn = serial_number.strip()
    warranty = db.query(Warranty).filter(Warranty.serial_number == clean_sn).first()

    if not warranty:
        return {
            "is_warranty_valid": False,
            "warranty_status": "NO_RECORD_FOUND",
            "message": f"No registered warranty found for serial number '{clean_sn}'. Repair will default to Chargeable.",
            "serial_number": clean_sn,
            "is_chargeable_default": True
        }

    now = datetime.datetime.utcnow()
    is_active = warranty.status in ("ACTIVE", "EXPIRING_SOON") and warranty.end_date > now
    days_remaining = max(0, (warranty.end_date - now).days) if warranty.end_date > now else 0
    computed_status = "EXPIRED" if warranty.end_date < now else ("EXPIRING_SOON" if days_remaining <= 90 else warranty.status)

    comp = warranty.component
    passport = warranty.passport
    customer = passport.customer if passport else None

    return {
        "is_warranty_valid": is_active,
        "warranty_status": computed_status,
        "days_remaining": days_remaining,
        "serial_number": warranty.serial_number,
        "component_id": warranty.component_id,
        "component_name": comp.name if comp else "Solar Equipment",
        "category": comp.category if comp else "EQUIPMENT",
        "manufacturer": warranty.manufacturer or (comp.manufacturer if comp else "N/A"),
        "warranty_type": warranty.warranty_type,
        "duration_years": warranty.duration_years,
        "start_date": warranty.start_date.strftime("%Y-%m-%d"),
        "end_date": warranty.end_date.strftime("%Y-%m-%d"),
        "terms_summary": warranty.terms_summary,
        "passport_id": passport.id if passport else None,
        "passport_number": passport.passport_number if passport else None,
        "customer_id": customer.id if customer else None,
        "customer_name": customer.name if customer else None,
        "coverage_disclaimer": "Warranty coverage is subject to physical technician fault inspection. Issues caused by grid surges, improper electrical handling, or external physical damage are not covered under equipment warranty."
    }


@router.post("/replace")
def record_component_replacement(
    payload: ReplacementRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "TECHNICIAN", "FIELD_TECHNICIAN"])),
    db: Session = Depends(get_db)
):
    """
    Feature 2 Integration: Replace a defective serialized component while preserving original warranty history.
    """
    clean_orig = payload.original_serial_number.strip()
    clean_new = payload.replacement_serial_number.strip()

    orig_w = db.query(Warranty).filter(Warranty.serial_number == clean_orig).first()
    if not orig_w:
        raise HTTPException(status_code=404, detail=f"Original warranty record for '{clean_orig}' not found.")

    now = datetime.datetime.utcnow()
    orig_w.status = "REPLACED"
    orig_w.terms_summary = f"{orig_w.terms_summary or ''}\n[REPLACED on {now.strftime('%Y-%m-%d')} by {clean_new}: {payload.reason}]".strip()

    comp_id = payload.component_id or orig_w.component_id
    comp = db.query(Component).filter(Component.id == comp_id).first()

    # Remaining warranty duration transferred to replacement
    remaining_days = max(365, (orig_w.end_date - now).days)
    new_end_date = now + datetime.timedelta(days=remaining_days)

    new_w = Warranty(
        passport_id=orig_w.passport_id,
        component_id=comp_id,
        policy_id=orig_w.policy_id,
        serial_number=clean_new,
        manufacturer=orig_w.manufacturer,
        warranty_type=orig_w.warranty_type,
        duration_years=orig_w.duration_years,
        start_date=now,
        end_date=new_end_date,
        terms_summary=f"Warranty transferred from {clean_orig}. Reason: {payload.reason}.",
        status="ACTIVE"
    )
    db.add(new_w)
    db.commit()
    db.refresh(new_w)

    return {
        "success": True,
        "message": f"Component replacement recorded. Original '{clean_orig}' marked REPLACED. New warranty registered for '{clean_new}'.",
        "replacement_warranty": {
            "id": new_w.id,
            "serial_number": new_w.serial_number,
            "status": new_w.status,
            "start_date": new_w.start_date.strftime("%Y-%m-%d"),
            "end_date": new_w.end_date.strftime("%Y-%m-%d")
        }
    }


@router.get("/{identifier}")
def get_warranty_by_serial(
    identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Look up equipment warranty status by serial number or warranty ID.
    """
    warranty = None
    if identifier.isdigit():
        warranty = db.query(Warranty).filter(Warranty.id == int(identifier)).first()
    if not warranty:
        clean_sn = identifier.strip()
        warranty = db.query(Warranty).filter(Warranty.serial_number == clean_sn).first()

    if not warranty:
        raise HTTPException(
            status_code=404,
            detail=f"No warranty record found for '{identifier}'. Verify the serial number or ID."
        )

    comp = warranty.component
    passport = warranty.passport
    customer = passport.customer if passport else None
    order = passport.order if passport else None

    now = datetime.datetime.utcnow()
    is_active = warranty.status == "ACTIVE" and warranty.end_date > now
    days_remaining = max(0, (warranty.end_date - now).days) if is_active else 0
    computed_status = "EXPIRED" if warranty.end_date < now else ("EXPIRING_SOON" if days_remaining <= 90 else warranty.status)

    return {
        "success": True,
        "serial_number": warranty.serial_number,
        "component_id": warranty.component_id,
        "component_name": comp.name if comp else "Solar Equipment",
        "category": comp.category if comp else "EQUIPMENT",
        "sku": comp.sku if comp else "N/A",
        "manufacturer": warranty.manufacturer or (comp.manufacturer if comp else "Verified Mfr"),
        "warranty_type": warranty.warranty_type,
        "duration_years": warranty.duration_years,
        "start_date": warranty.start_date.strftime("%Y-%m-%d"),
        "end_date": warranty.end_date.strftime("%Y-%m-%d"),
        "days_remaining": days_remaining,
        "status": computed_status,
        "is_valid": is_active,
        "terms_summary": warranty.terms_summary,
        "passport_number": passport.passport_number if passport else None,
        "qr_code_token": passport.qr_code_token if passport else None,
        "commissioning_date": passport.commissioning_date.strftime("%Y-%m-%d") if passport else None,
        "customer_name": customer.name if customer else None,
        "customer_city": customer.city if customer else None,
        "order_number": order.order_number if order else None
    }
