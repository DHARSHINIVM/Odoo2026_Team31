import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.database import get_db, get_utc_now
from app.models.tasks_appointments import Appointment
from app.models.user_auth import User
from app.services.auth_service import get_current_user, require_roles
from app.services.appointment_service import AppointmentService, STANDARD_TIME_SLOTS

router = APIRouter(prefix="/appointments", tags=["Customer Appointments & Field Scheduling"])


class AppointmentCreate(BaseModel):
    customer_id: int
    appointment_type: str = "SITE_SURVEY"  # SITE_SURVEY, INSTALLATION, SERVICE, CONSULTATION
    scheduled_date: datetime.date
    time_slot: str
    assigned_tech_id: Optional[int] = None
    order_id: Optional[int] = None
    survey_id: Optional[int] = None
    installation_id: Optional[int] = None
    service_address: Optional[str] = None
    contact_phone: Optional[str] = None
    customer_notes: Optional[str] = None


class AppointmentRescheduleRequest(BaseModel):
    new_date: datetime.date
    new_time_slot: str
    reason: Optional[str] = None


class AppointmentCancelRequest(BaseModel):
    cancellation_reason: str


class AppointmentAssignRequest(BaseModel):
    technician_id: int


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    appointment_number: str
    customer_id: int
    customer_name: Optional[str] = None
    appointment_type: str
    order_id: Optional[int] = None
    survey_id: Optional[int] = None
    installation_id: Optional[int] = None
    assigned_tech_id: Optional[int] = None
    assigned_tech_name: Optional[str] = None
    scheduled_date: datetime.datetime
    time_slot: str
    status: str
    service_address: Optional[str] = None
    contact_phone: Optional[str] = None
    customer_notes: Optional[str] = None
    technician_notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


def _format_appointment(apt: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=apt.id,
        uuid=apt.uuid,
        appointment_number=apt.appointment_number,
        customer_id=apt.customer_id,
        customer_name=apt.customer.name if apt.customer else None,
        appointment_type=apt.appointment_type,
        order_id=apt.order_id,
        survey_id=apt.survey_id,
        installation_id=apt.installation_id,
        assigned_tech_id=apt.assigned_tech_id,
        assigned_tech_name=apt.assigned_tech.full_name if apt.assigned_tech else None,
        scheduled_date=apt.scheduled_date,
        time_slot=apt.time_slot,
        status=apt.status,
        service_address=apt.service_address or (apt.customer.address if apt.customer else None),
        contact_phone=apt.contact_phone or (apt.customer.phone if apt.customer else None),
        customer_notes=apt.customer_notes,
        technician_notes=apt.technician_notes,
        cancellation_reason=apt.cancellation_reason,
        created_at=apt.created_at,
        updated_at=apt.updated_at
    )


@router.get("/availability")
def get_availability(
    target_date: Optional[datetime.date] = None,
    appointment_type: str = "SITE_SURVEY",
    technician_id: Optional[int] = None,
    days_ahead: int = 7,
    db: Session = Depends(get_db)
):
    """
    Public/Customer & Staff Endpoint:
    Returns open time slots per day over the planning window.
    """
    start_date = target_date or datetime.date.today()
    schedule = []

    for i in range(min(days_ahead, 14)):
        current_d = start_date + datetime.timedelta(days=i)
        slots = AppointmentService.get_available_slots(
            db=db,
            target_date=current_d,
            appointment_type=appointment_type.upper(),
            technician_id=technician_id
        )
        schedule.append({
            "date": current_d.isoformat(),
            "day_name": current_d.strftime("%A"),
            "slots": slots
        })

    return {
        "appointment_type": appointment_type.upper(),
        "planning_window_days": days_ahead,
        "standard_slots": STANDARD_TIME_SLOTS,
        "schedule": schedule
    }


@router.get("", response_model=List[AppointmentOut])
def list_appointments(
    status_filter: Optional[str] = None,
    appointment_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    assigned_tech_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Appointment)
    user_role = (current_user.role or "").upper()

    if user_role in ("TECHNICIAN", "FIELD_TECHNICIAN"):
        query = query.filter((Appointment.assigned_tech_id == current_user.id) | (Appointment.assigned_tech_id.is_(None)))
    elif user_role == "CUSTOMER":
        query = query.filter(Appointment.customer_id == current_user.customer_id)

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(Appointment.status == status_filter.upper())
    if appointment_type and appointment_type.upper() != "ALL":
        query = query.filter(Appointment.appointment_type == appointment_type.upper())
    if customer_id:
        query = query.filter(Appointment.customer_id == customer_id)
    if assigned_tech_id:
        query = query.filter(Appointment.assigned_tech_id == assigned_tech_id)

    appointments = query.order_by(Appointment.scheduled_date.asc()).all()
    return [_format_appointment(a) for a in appointments]


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment(
    payload: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    apt = AppointmentService.book_appointment(
        db=db,
        customer_id=payload.customer_id,
        appointment_type=payload.appointment_type,
        scheduled_date=payload.scheduled_date,
        time_slot=payload.time_slot,
        assigned_tech_id=payload.assigned_tech_id,
        order_id=payload.order_id,
        survey_id=payload.survey_id,
        installation_id=payload.installation_id,
        service_address=payload.service_address,
        contact_phone=payload.contact_phone,
        customer_notes=payload.customer_notes
    )
    return _format_appointment(apt)


@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER" and apt.customer_id != current_user.customer_id:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot access another customer's appointment.")
    return _format_appointment(apt)


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER" and apt.customer_id != current_user.customer_id:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify another customer's appointment.")

    apt = AppointmentService.reschedule_appointment(
        db=db,
        appointment_id=appointment_id,
        new_date=payload.new_date,
        new_time_slot=payload.new_time_slot,
        reason=payload.reason
    )
    return _format_appointment(apt)


@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: int,
    payload: AppointmentCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER" and apt.customer_id != current_user.customer_id:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot cancel another customer's appointment.")

    apt = AppointmentService.cancel_appointment(
        db=db,
        appointment_id=appointment_id,
        cancellation_reason=payload.cancellation_reason
    )
    return _format_appointment(apt)


@router.patch("/{appointment_id}/assign", response_model=AppointmentOut)
def assign_technician(
    appointment_id: int,
    payload: AppointmentAssignRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "SALES_EXECUTIVE"])),
    db: Session = Depends(get_db)
):
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    tech = db.query(User).filter(User.id == payload.technician_id).first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician user not found")

    required_cap = "SURVEY_EXECUTION" if apt.appointment_type == "SITE_SURVEY" else "INSTALLATION_EXECUTION"
    if not tech.has_capability(required_cap):
        raise HTTPException(
            status_code=400,
            detail=f"Technician '{tech.full_name}' lacks capability '{required_cap}'."
        )

    apt.assigned_tech_id = tech.id
    apt.status = "ASSIGNED"
    db.commit()
    db.refresh(apt)
    return _format_appointment(apt)

