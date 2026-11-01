import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SubsidyApplication, Order, Customer, User
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/subsidies", tags=["Solar Subsidy Management (PM Surya Ghar)"], dependencies=[Depends(get_current_user)])


class SubsidyApplicationOut(BaseModel):
    id: int
    uuid: str
    application_number: str
    order_id: int
    customer_id: int
    installation_id: Optional[int] = None
    discom_name: str
    consumer_number: str
    system_capacity_kw: float
    subsidy_scheme: str
    eligible_subsidy_inr: float
    disbursed_subsidy_inr: float
    status: str
    document_checklist: str
    application_date: datetime.datetime
    inspection_date: Optional[datetime.datetime] = None
    approval_date: Optional[datetime.datetime] = None
    disbursement_date: Optional[datetime.datetime] = None
    disbursement_reference: Optional[str] = None
    reviewer_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    customer_name: Optional[str] = None

    class Config:
        from_attributes = True


class CreateSubsidyRequest(BaseModel):
    order_id: int
    discom_name: str = "MSEDCL"
    consumer_number: str
    system_capacity_kw: float
    eligible_subsidy_inr: float = 78000.0
    document_checklist: Optional[str] = "[]"


class UpdateSubsidyStatusRequest(BaseModel):
    status: str  # DRAFT, SUBMITTED, INSPECTION_CLEARED, APPROVED, DISBURSED, REJECTED
    disbursement_reference: Optional[str] = None
    disbursed_amount_inr: Optional[float] = None
    reviewer_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


@router.get("", response_model=List[SubsidyApplicationOut])
def list_subsidy_applications(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SubsidyApplication)
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(SubsidyApplication.status == status_filter.upper())
    
    results = query.order_by(SubsidyApplication.application_date.desc()).all()
    out = []
    for s in results:
        dto = SubsidyApplicationOut(
            id=s.id,
            uuid=s.uuid,
            application_number=s.application_number,
            order_id=s.order_id,
            customer_id=s.customer_id,
            installation_id=s.installation_id,
            discom_name=s.discom_name,
            consumer_number=s.consumer_number,
            system_capacity_kw=s.system_capacity_kw,
            subsidy_scheme=s.subsidy_scheme,
            eligible_subsidy_inr=round(s.eligible_subsidy_paise / 100, 2),
            disbursed_subsidy_inr=round(s.disbursed_subsidy_paise / 100, 2),
            status=s.status,
            document_checklist=s.document_checklist,
            application_date=s.application_date,
            inspection_date=s.inspection_date,
            approval_date=s.approval_date,
            disbursement_date=s.disbursement_date,
            disbursement_reference=s.disbursement_reference,
            reviewer_notes=s.reviewer_notes,
            rejection_reason=s.rejection_reason,
            customer_name=s.customer.name if s.customer else "N/A"
        )
        out.append(dto)
    return out


@router.post("", response_model=SubsidyApplicationOut, status_code=status.HTTP_201_CREATED)
def create_subsidy_application(
    payload: CreateSubsidyRequest,
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    count = db.query(SubsidyApplication).count() + 1
    app_number = f"SUB-2026-{count:04d}"

    app_record = SubsidyApplication(
        application_number=app_number,
        order_id=order.id,
        customer_id=order.customer_id,
        installation_id=order.installations[0].id if order.installations else None,
        discom_name=payload.discom_name,
        consumer_number=payload.consumer_number,
        system_capacity_kw=payload.system_capacity_kw,
        eligible_subsidy_paise=int(payload.eligible_subsidy_inr * 100),
        disbursed_subsidy_paise=0,
        status="DRAFT",
        document_checklist=payload.document_checklist or "[]",
        application_date=datetime.datetime.utcnow()
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)

    return SubsidyApplicationOut(
        id=app_record.id,
        uuid=app_record.uuid,
        application_number=app_record.application_number,
        order_id=app_record.order_id,
        customer_id=app_record.customer_id,
        installation_id=app_record.installation_id,
        discom_name=app_record.discom_name,
        consumer_number=app_record.consumer_number,
        system_capacity_kw=app_record.system_capacity_kw,
        subsidy_scheme=app_record.subsidy_scheme,
        eligible_subsidy_inr=round(app_record.eligible_subsidy_paise / 100, 2),
        disbursed_subsidy_inr=0.0,
        status=app_record.status,
        document_checklist=app_record.document_checklist,
        application_date=app_record.application_date,
        reviewer_notes=app_record.reviewer_notes,
        customer_name=order.customer.name if order.customer else "N/A"
    )


@router.patch("/{id}/status", response_model=SubsidyApplicationOut)
def update_subsidy_status(
    id: int,
    payload: UpdateSubsidyStatusRequest,
    db: Session = Depends(get_db)
):
    app_record = db.query(SubsidyApplication).filter(SubsidyApplication.id == id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Subsidy application not found")

    new_status = payload.status.upper()
    app_record.status = new_status
    if payload.reviewer_notes:
        app_record.reviewer_notes = payload.reviewer_notes
    if payload.rejection_reason:
        app_record.rejection_reason = payload.rejection_reason

    now = datetime.datetime.utcnow()
    if new_status == "INSPECTION_CLEARED":
        app_record.inspection_date = now
    elif new_status == "APPROVED":
        app_record.approval_date = now
    elif new_status == "DISBURSED":
        app_record.disbursement_date = now
        if payload.disbursement_reference:
            app_record.disbursement_reference = payload.disbursement_reference
        if payload.disbursed_amount_inr:
            app_record.disbursed_subsidy_paise = int(payload.disbursed_amount_inr * 100)
        else:
            app_record.disbursed_subsidy_paise = app_record.eligible_subsidy_paise

    db.commit()
    db.refresh(app_record)

    return SubsidyApplicationOut(
        id=app_record.id,
        uuid=app_record.uuid,
        application_number=app_record.application_number,
        order_id=app_record.order_id,
        customer_id=app_record.customer_id,
        installation_id=app_record.installation_id,
        discom_name=app_record.discom_name,
        consumer_number=app_record.consumer_number,
        system_capacity_kw=app_record.system_capacity_kw,
        subsidy_scheme=app_record.subsidy_scheme,
        eligible_subsidy_inr=round(app_record.eligible_subsidy_paise / 100, 2),
        disbursed_subsidy_inr=round(app_record.disbursed_subsidy_paise / 100, 2),
        status=app_record.status,
        document_checklist=app_record.document_checklist,
        application_date=app_record.application_date,
        inspection_date=app_record.inspection_date,
        approval_date=app_record.approval_date,
        disbursement_date=app_record.disbursement_date,
        disbursement_reference=app_record.disbursement_reference,
        reviewer_notes=app_record.reviewer_notes,
        rejection_reason=app_record.rejection_reason,
        customer_name=app_record.customer.name if app_record.customer else "N/A"
    )

