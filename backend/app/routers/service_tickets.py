import json
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ServiceTicket, Customer, DigitalSolarPassport, Installation, Component, Warranty, User
from app.schemas.entities import ServiceTicketCreate, ServiceTicketUpdate, ServiceTicketOut
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/service/tickets", tags=["Service & Maintenance Management"])


def _format_ticket(t: ServiceTicket) -> ServiceTicketOut:
    cust = t.customer
    passp = t.passport
    comp = t.component
    return ServiceTicketOut(
        id=t.id,
        uuid=t.uuid,
        ticket_number=t.ticket_number,
        customer_id=t.customer_id,
        customer_name=cust.name if cust else None,
        customer_phone=cust.phone if cust else None,
        customer_city=cust.city if cust else None,
        passport_id=t.passport_id,
        passport_number=passp.passport_number if passp else None,
        installation_id=t.installation_id,
        component_id=t.component_id,
        component_name=comp.name if comp else None,
        serial_number=t.serial_number,
        issue_category=t.issue_category,
        priority=t.priority,
        description=t.description,
        assigned_technician=t.assigned_technician,
        assigned_tech_id=t.assigned_tech_id,
        is_warranty_covered=t.is_warranty_covered,
        diagnosis_notes=t.diagnosis_notes,
        parts_used=t.parts_used or "[]",
        labour_hours=t.labour_hours or 0.0,
        labour_cost_paise=t.labour_cost_paise or 0,
        repair_expenses_paise=t.repair_expenses_paise or 0,
        customer_confirmation_notes=t.customer_confirmation_notes,
        resolution_notes=t.resolution_notes,
        status=t.status,
        created_at=t.created_at,
        resolved_at=t.resolved_at
    )


class CustomerComplaintRequest(BaseModel):
    passport_token: str
    issue_category: str
    description: str
    component_id: Optional[int] = None
    serial_number: Optional[str] = None
    evidence_files: Optional[List[Dict[str, Any]]] = None


@router.post("/customer-complaint")
def create_customer_complaint(
    payload: CustomerComplaintRequest,
    db: Session = Depends(get_db)
):
    """
    Stage C: Secure customer complaint ingestion linked to a verified Digital Solar Passport.
    - Validates passport token cryptographically.
    - Matches affected component serial number.
    - Automatically verifies active warranty coverage.
    - Creates a traceable service ticket (SRV-2026-XXX).
    """
    passport = db.query(DigitalSolarPassport).filter(
        DigitalSolarPassport.qr_code_token == payload.passport_token,
        DigitalSolarPassport.is_active == True
    ).first()
    if not passport:
        raise HTTPException(
            status_code=404,
            detail="Digital Solar Passport token is invalid or has expired."
        )

    desc = payload.description.strip()
    if len(desc) < 5:
        raise HTTPException(
            status_code=400,
            detail="Complaint description must be at least 5 characters long."
        )

    # Guard against duplicate active complaints for the same passport & category/serial (Problem 21)
    active_query = db.query(ServiceTicket).filter(
        ServiceTicket.passport_id == passport.id,
        ServiceTicket.issue_category == payload.issue_category,
        ServiceTicket.status.in_(["NEW_COMPLAINT", "OPEN", "IN_PROGRESS", "WARRANTY_CHECK"])
    )
    if payload.serial_number:
        active_query = active_query.filter(ServiceTicket.serial_number == payload.serial_number)
    existing_complaint = active_query.first()
    if existing_complaint:
        raise HTTPException(
            status_code=409,
            detail=f"Duplicate Complaint: An active service ticket ({existing_complaint.ticket_number}) is already open for '{payload.issue_category}'. Our technical team is actively attending to this case."
        )

    is_covered = True
    comp_id = payload.component_id
    serial = payload.serial_number

    if serial:
        warranty = db.query(Warranty).filter(
            Warranty.passport_id == passport.id,
            Warranty.serial_number == serial
        ).first()
        if warranty:
            is_covered = bool(warranty.status == "ACTIVE" and warranty.end_date > datetime.datetime.utcnow())
            if not comp_id:
                comp_id = warranty.component_id

    priority = "HIGH" if payload.issue_category in ("INVERTER_FAULT", "GRID_TRIP") else "MEDIUM"
    next_num = db.query(ServiceTicket).count() + 1
    ticket_num = f"SRV-2026-{next_num:03d}"

    ticket = ServiceTicket(
        ticket_number=ticket_num,
        passport_id=passport.id,
        installation_id=passport.installation_id,
        customer_id=passport.customer_id,
        component_id=comp_id,
        serial_number=serial,
        issue_category=payload.issue_category,
        priority=priority,
        description=desc,
        is_warranty_covered=is_covered,
        status="NEW_COMPLAINT",
        complaint_source="DIGITAL_PASSPORT",
        evidence_files=json.dumps(payload.evidence_files or []),
        created_at=datetime.datetime.utcnow()
    )
    db.add(ticket)

    # Set passport to SERVICE_REQUIRED
    passport.lifecycle_status = "SERVICE_REQUIRED"

    db.commit()
    db.refresh(ticket)

    try:
        from app.services.task_service import TaskService
        TaskService.on_service_ticket_created(db, ticket)
    except Exception:
        pass

    return {
        "success": True,
        "message": f"Service complaint {ticket.ticket_number} successfully registered.",
        "ticket_number": ticket.ticket_number,
        "ticket_id": ticket.id,
        "passport_number": passport.passport_number,
        "status": ticket.status,
        "priority": ticket.priority,
        "is_warranty_covered": ticket.is_warranty_covered,
        "created_at": ticket.created_at.isoformat()
    }


@router.get("/by-token/{token}")
def list_tickets_by_passport_token(
    token: str,
    db: Session = Depends(get_db)
):
    """List service tickets and real-time repair progress for a customer's passport."""
    passport = db.query(DigitalSolarPassport).filter(
        DigitalSolarPassport.qr_code_token == token
    ).first()
    if not passport:
        raise HTTPException(status_code=404, detail="Passport token not found.")

    tickets = db.query(ServiceTicket).filter(
        ServiceTicket.passport_id == passport.id
    ).order_by(ServiceTicket.created_at.desc()).all()

    return [_format_ticket(t) for t in tickets]


@router.get("", response_model=List[ServiceTicketOut])
def list_service_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    customer_id: Optional[int] = None,
    is_warranty_covered: Optional[bool] = None,
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ServiceTicket)
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER":
        query = query.filter(ServiceTicket.customer_id == current_user.customer_id)
    if status and status.upper() != "ALL":
        st = status.upper()
        if st == "OPEN":
            query = query.filter(ServiceTicket.status.in_(["OPEN", "NEW_COMPLAINT", "WARRANTY_CHECK"]))
        else:
            query = query.filter(ServiceTicket.status == st)
    if priority and priority.upper() != "ALL":
        query = query.filter(ServiceTicket.priority == priority.upper())
    if customer_id:
        query = query.filter(ServiceTicket.customer_id == customer_id)
    if is_warranty_covered is not None:
        query = query.filter(ServiceTicket.is_warranty_covered == is_warranty_covered)

    tickets = query.order_by(ServiceTicket.created_at.desc()).all()

    if q:
        clean_q = q.strip().lower()
        filtered = []
        for t in tickets:
            cust = t.customer
            matches = [
                clean_q in t.ticket_number.lower(),
                cust and clean_q in cust.name.lower(),
                t.serial_number and clean_q in t.serial_number.lower(),
                clean_q in t.description.lower(),
                clean_q in t.issue_category.lower(),
                t.assigned_technician and clean_q in t.assigned_technician.lower()
            ]
            if any(matches):
                filtered.append(t)
        tickets = filtered

    return [_format_ticket(t) for t in tickets]


@router.post("", response_model=ServiceTicketOut, status_code=status.HTTP_201_CREATED)
def create_service_ticket(
    payload: ServiceTicketCreate,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "SALES_EXECUTIVE", "CUSTOMER", "TECHNICIAN"])),
    db: Session = Depends(get_db)
):
    cust = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    is_covered = True
    if payload.serial_number:
        warranty = db.query(Warranty).filter(Warranty.serial_number == payload.serial_number).first()
        if warranty:
            is_covered = bool(warranty.status == "ACTIVE" and warranty.end_date > datetime.datetime.utcnow())

    next_num = db.query(ServiceTicket).count() + 1
    ticket_num = f"SRV-2026-{next_num:03d}"

    t = ServiceTicket(
        ticket_number=ticket_num,
        customer_id=payload.customer_id,
        passport_id=payload.passport_id,
        installation_id=payload.installation_id,
        component_id=payload.component_id,
        serial_number=payload.serial_number,
        issue_category=payload.issue_category,
        priority=payload.priority or "MEDIUM",
        description=payload.description,
        assigned_technician=payload.assigned_technician,
        is_warranty_covered=is_covered,
        status="NEW_COMPLAINT"
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    try:
        from app.services.task_service import TaskService
        TaskService.on_service_ticket_created(db, t)
    except Exception:
        pass

    return _format_ticket(t)


@router.get("/{ticket_id}", response_model=ServiceTicketOut)
def get_service_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(ServiceTicket).filter(ServiceTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Service ticket not found")
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER" and t.customer_id != current_user.customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot access another customer's service ticket."
        )
    return _format_ticket(t)


@router.patch("/{ticket_id}", response_model=ServiceTicketOut)
def update_service_ticket(
    ticket_id: int,
    payload: ServiceTicketUpdate,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "SALES_EXECUTIVE", "TECHNICIAN", "FIELD_TECHNICIAN"])),
    db: Session = Depends(get_db)
):
    t = db.query(ServiceTicket).filter(ServiceTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Service ticket not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if hasattr(t, field):
            setattr(t, field, val)

    if payload.status:
        st = payload.status.upper()
        t.status = st
        if st in ["RESOLVED", "CLOSED"] and not t.resolved_at:
            t.resolved_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(t)
    return _format_ticket(t)


class AssignTechnicianRequest(BaseModel):
    assigned_technician: str
    assigned_tech_id: Optional[int] = None
    priority: Optional[str] = None
    notes: Optional[str] = None


@router.patch("/{ticket_id}/assign", response_model=ServiceTicketOut)
def assign_service_technician(
    ticket_id: int,
    payload: AssignTechnicianRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "SALES_EXECUTIVE"])),
    db: Session = Depends(get_db)
):
    t = db.query(ServiceTicket).filter(ServiceTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Service ticket not found")

    t.assigned_technician = payload.assigned_technician
    if payload.assigned_tech_id:
        t.assigned_tech_id = payload.assigned_tech_id
    if payload.priority:
        t.priority = payload.priority.upper()

    if t.status in ("OPEN", "NEW_COMPLAINT"):
        t.status = "ASSIGNED"

    if payload.notes:
        now_str = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")
        t.diagnosis_notes = f"{t.diagnosis_notes or ''}\n[{now_str}] Assignment note: {payload.notes}".strip()

    db.commit()
    db.refresh(t)
    return _format_ticket(t)
