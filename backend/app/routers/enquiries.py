import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Enquiry, Customer, SiteSurvey
from app.schemas.entities import (
    EnquiryCreate, EnquiryUpdate, EnquiryStatusUpdate,
    EnquiryScheduleSurvey, EnquiryOut, SiteSurveyOut
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/enquiries", tags=["Enquiries"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[EnquiryOut])
def list_enquiries(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sales_rep_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Enquiry)

    if status and status.upper() != "ALL":
        query = query.filter(Enquiry.status == status.upper())

    if sales_rep_id is not None:
        query = query.filter(Enquiry.assigned_sales_rep_id == sales_rep_id)

    if search:
        search_filter = f"%{search}%"
        query = query.join(Enquiry.customer).filter(
            or_(
                Enquiry.enquiry_number.ilike(search_filter),
                Customer.name.ilike(search_filter),
                Customer.phone.ilike(search_filter)
            )
        )

    enquiries = query.order_by(Enquiry.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for enq in enquiries:
        out = EnquiryOut.model_validate(enq)
        if enq.customer:
            out.customer_name = enq.customer.name
            out.customer_phone = enq.customer.phone
            out.customer_city = enq.customer.city
        out.has_survey = len(enq.surveys) > 0
        if out.has_survey:
            latest_survey = sorted(enq.surveys, key=lambda s: s.created_at, reverse=True)[0]
            out.survey_status = latest_survey.status
        out.has_quotation = len(enq.quotations) > 0
        results.append(out)
    return results


@router.post("", response_model=EnquiryOut, status_code=status.HTTP_201_CREATED)
def create_enquiry(payload: EnquiryCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Invalid customer_id: Customer does not exist")

    count = db.query(Enquiry).count() + 1
    enquiry_number = f"ENQ-2026-{count:03d}"

    enquiry = Enquiry(
        customer_id=payload.customer_id,
        enquiry_number=enquiry_number,
        required_capacity_kw=payload.required_capacity_kw,
        property_type=payload.property_type,
        roof_type=payload.roof_type,
        grid_type=payload.grid_type,
        budget_paise=payload.budget_paise,
        notes=payload.notes,
        status="NEW"
    )
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)

    out = EnquiryOut.model_validate(enquiry)
    out.customer_name = customer.name
    out.customer_phone = customer.phone
    out.customer_city = customer.city
    return out


@router.get("/{enquiry_id}", response_model=EnquiryOut)
def get_enquiry(enquiry_id: int, db: Session = Depends(get_db)):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    out = EnquiryOut.model_validate(enquiry)
    if enquiry.customer:
        out.customer_name = enquiry.customer.name
        out.customer_phone = enquiry.customer.phone
        out.customer_city = enquiry.customer.city
    out.has_survey = len(enquiry.surveys) > 0
    if out.has_survey:
        latest_survey = sorted(enquiry.surveys, key=lambda s: s.created_at, reverse=True)[0]
        out.survey_status = latest_survey.status
    out.has_quotation = len(enquiry.quotations) > 0
    return out


@router.patch("/{enquiry_id}", response_model=EnquiryOut)
def update_enquiry(enquiry_id: int, payload: EnquiryUpdate, db: Session = Depends(get_db)):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(enquiry, field, value)

    db.commit()
    db.refresh(enquiry)

    out = EnquiryOut.model_validate(enquiry)
    if enquiry.customer:
        out.customer_name = enquiry.customer.name
        out.customer_phone = enquiry.customer.phone
        out.customer_city = enquiry.customer.city
    return out


@router.patch("/{enquiry_id}/status", response_model=EnquiryOut)
def update_enquiry_status(enquiry_id: int, payload: EnquiryStatusUpdate, db: Session = Depends(get_db)):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    valid_statuses = ["NEW", "SURVEY_SCHEDULED", "SURVEY_COMPLETED", "QUOTED", "ORDER_PLACED", "REJECTED"]
    if payload.status.upper() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(valid_statuses)}")

    enquiry.status = payload.status.upper()
    db.commit()
    db.refresh(enquiry)

    out = EnquiryOut.model_validate(enquiry)
    if enquiry.customer:
        out.customer_name = enquiry.customer.name
        out.customer_phone = enquiry.customer.phone
        out.customer_city = enquiry.customer.city
    return out


@router.post("/{enquiry_id}/schedule-survey", response_model=SiteSurveyOut, status_code=status.HTTP_201_CREATED)
def schedule_site_survey(enquiry_id: int, payload: EnquiryScheduleSurvey, db: Session = Depends(get_db)):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    # Update enquiry status
    enquiry.status = "SURVEY_SCHEDULED"

    # Generate survey number
    count = db.query(SiteSurvey).count() + 1
    survey_number = f"SRV-2026-{count:03d}"

    # Default estimation based on enquiry capacity (approx 100 sqft per kW)
    est_area = enquiry.required_capacity_kw * 100.0

    survey = SiteSurvey(
        enquiry_id=enquiry.id,
        survey_number=survey_number,
        surveyor_name=payload.surveyor_name,
        survey_date=payload.survey_date or datetime.datetime.utcnow(),
        roof_area_sqft=est_area,
        usable_roof_area_sqft=est_area * 0.8,
        roof_type=enquiry.roof_type,
        roof_azimuth_deg=180.0,
        tilt_angle_deg=15.0,
        shading_loss_pct=4.0,
        structural_integrity="GOOD",
        recommended_capacity_kw=enquiry.required_capacity_kw,
        structure_recommendation="Elevated HDG Structure",
        notes=payload.notes,
        status="SCHEDULED"
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)

    out = SiteSurveyOut.model_validate(survey)
    out.enquiry_number = enquiry.enquiry_number
    if enquiry.customer:
        out.customer_name = enquiry.customer.name
        out.customer_phone = enquiry.customer.phone
        out.customer_city = enquiry.customer.city
    return out
