import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SiteSurvey, Enquiry, Customer, User
from app.schemas.entities import SiteSurveyCreate, SiteSurveyUpdate, SiteSurveyOut
from app.services.auth_service import decode_access_token, get_current_user, require_roles

router = APIRouter(prefix="/surveys", tags=["Site Surveys"], dependencies=[Depends(get_current_user)])


class SurveyAssignRequest(BaseModel):
    technician_id: int
    technician_name: str
    survey_date: Optional[datetime.datetime] = None


class SurveyReviewRequest(BaseModel):
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


def get_optional_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Optional[User]:
    if not authorization:
        return None
    try:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            payload = decode_access_token(parts[1])
            user_id = payload.get("sub")
            if user_id:
                return db.query(User).filter(User.id == int(user_id)).first()
    except Exception:
        pass
    return None


@router.get("", response_model=List[SiteSurveyOut])
def list_surveys(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SiteSurvey)
    if status and status.upper() != "ALL":
        query = query.filter(SiteSurvey.status == status.upper())

    surveys = query.order_by(SiteSurvey.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for s in surveys:
        out = SiteSurveyOut.model_validate(s)
        if s.enquiry:
            out.enquiry_number = s.enquiry.enquiry_number
            if s.enquiry.customer:
                out.customer_name = s.enquiry.customer.name
                out.customer_phone = s.enquiry.customer.phone
                out.customer_city = s.enquiry.customer.city
        results.append(out)
    return results


@router.post("", response_model=SiteSurveyOut, status_code=status.HTTP_201_CREATED)
def record_survey(payload: SiteSurveyCreate, db: Session = Depends(get_db)):
    enquiry = db.query(Enquiry).filter(Enquiry.id == payload.enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=400, detail="Invalid enquiry_id: Enquiry does not exist")

    count = db.query(SiteSurvey).count() + 1
    survey_number = f"SRV-2026-{count:03d}"

    survey = SiteSurvey(
        enquiry_id=payload.enquiry_id,
        survey_number=survey_number,
        assigned_technician_id=payload.assigned_technician_id,
        surveyor_name=payload.surveyor_name,
        survey_date=payload.survey_date or datetime.datetime.utcnow(),
        roof_dimensions=payload.roof_dimensions or "12m x 8m",
        roof_area_sqft=payload.roof_area_sqft,
        usable_roof_area_sqft=payload.usable_roof_area_sqft,
        shadow_free_area_sqft=payload.shadow_free_area_sqft or (payload.usable_roof_area_sqft * 0.9),
        roof_type=payload.roof_type,
        roof_azimuth_deg=payload.roof_azimuth_deg,
        tilt_angle_deg=payload.tilt_angle_deg,
        shading_loss_pct=payload.shading_loss_pct,
        structural_integrity=payload.structural_integrity,
        recommended_capacity_kw=payload.recommended_capacity_kw,
        structure_recommendation=payload.structure_recommendation or "Elevated HDG Structure",
        meter_type=payload.meter_type,
        inverter_distance_meters=payload.inverter_distance_meters,
        sanctioned_electrical_load_kw=payload.sanctioned_electrical_load_kw or 5.0,
        electrical_observations=payload.electrical_observations,
        technician_observations=payload.technician_observations,
        site_photographs=payload.site_photographs or "[]",
        notes=payload.notes,
        status=payload.status or ("ASSIGNED" if payload.assigned_technician_id else "APPROVED")
    )
    db.add(survey)

    if survey.status == "ASSIGNED":
        enquiry.status = "SURVEY_SCHEDULED"
    else:
        enquiry.status = "SURVEY_COMPLETED"
    db.commit()
    db.refresh(survey)

    if survey.status == "ASSIGNED" and survey.assigned_technician_id:
        try:
            from app.services.task_service import TaskService
            TaskService.on_survey_assigned(db, survey, survey.assigned_technician_id)
        except Exception:
            pass

    # Survey approved
    out = SiteSurveyOut.model_validate(survey)
    out.enquiry_number = enquiry.enquiry_number
    if enquiry.customer:
        out.customer_name = enquiry.customer.name
        out.customer_phone = enquiry.customer.phone
        out.customer_city = enquiry.customer.city
    return out


@router.get("/{survey_id}", response_model=SiteSurveyOut)
def get_survey(survey_id: int, db: Session = Depends(get_db)):
    survey = db.query(SiteSurvey).filter(SiteSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Site survey not found")

    out = SiteSurveyOut.model_validate(survey)
    if survey.enquiry:
        out.enquiry_number = survey.enquiry.enquiry_number
        if survey.enquiry.customer:
            out.customer_name = survey.enquiry.customer.name
            out.customer_phone = survey.enquiry.customer.phone
            out.customer_city = survey.enquiry.customer.city
    return out


@router.patch("/{survey_id}", response_model=SiteSurveyOut)
def update_survey(survey_id: int, payload: SiteSurveyUpdate, db: Session = Depends(get_db)):
    survey = db.query(SiteSurvey).filter(SiteSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Site survey not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(survey, field, value)

    db.commit()
    db.refresh(survey)

    # Survey approved
    out = SiteSurveyOut.model_validate(survey)
    if survey.enquiry:
        out.enquiry_number = survey.enquiry.enquiry_number
        if survey.enquiry.customer:
            out.customer_name = survey.enquiry.customer.name
            out.customer_phone = survey.enquiry.customer.phone
            out.customer_city = survey.enquiry.customer.city
    return out


@router.patch("/{survey_id}/assign", response_model=SiteSurveyOut)
def assign_survey_technician(
    survey_id: int,
    payload: SurveyAssignRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "SALES_EXECUTIVE"])),
    db: Session = Depends(get_db)
):
    """Admin / Sales Executive: Assign technician to site survey."""
    survey = db.query(SiteSurvey).filter(SiteSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Site survey not found")

    tech_user = db.query(User).filter(User.id == payload.technician_id).first()
    if not tech_user:
        raise HTTPException(status_code=404, detail="Technician user not found.")

    if not tech_user.has_capability("SURVEY_EXECUTION"):
        raise HTTPException(
            status_code=400,
            detail=f"Technician '{tech_user.full_name}' does not possess the 'SURVEY_EXECUTION' capability required for site surveys."
        )

    survey.assigned_technician_id = payload.technician_id
    survey.surveyor_name = payload.technician_name or tech_user.full_name
    if payload.survey_date:
        survey.survey_date = payload.survey_date
    survey.status = "ASSIGNED"

    if survey.enquiry:
        survey.enquiry.status = "SURVEY_SCHEDULED"

    db.commit()
    db.refresh(survey)

    try:
        from app.services.task_service import TaskService
        TaskService.on_survey_assigned(db, survey, payload.technician_id)
    except Exception:
        pass

    # Survey approved
    out = SiteSurveyOut.model_validate(survey)
    if survey.enquiry:
        out.enquiry_number = survey.enquiry.enquiry_number
        if survey.enquiry.customer:
            out.customer_name = survey.enquiry.customer.name
            out.customer_phone = survey.enquiry.customer.phone
            out.customer_city = survey.enquiry.customer.city
    return out


@router.patch("/{survey_id}/submit", response_model=SiteSurveyOut)
@router.post("/{survey_id}/submit", response_model=SiteSurveyOut)
def submit_survey_by_technician(
    survey_id: int,
    payload: SiteSurveyUpdate,
    db: Session = Depends(get_db)
):
    """Survey Technician: Submit completed site measurements and evidence."""
    survey = db.query(SiteSurvey).filter(SiteSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Site survey not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(survey, field, value)

    survey.status = "SUBMITTED"
    db.commit()
    db.refresh(survey)

    try:
        from app.services.task_service import TaskService
        TaskService.on_survey_submitted(db, survey)
    except Exception:
        pass

    out = SiteSurveyOut.model_validate(survey)
    if survey.enquiry:
        out.enquiry_number = survey.enquiry.enquiry_number
        if survey.enquiry.customer:
            out.customer_name = survey.enquiry.customer.name
            out.customer_phone = survey.enquiry.customer.phone
            out.customer_city = survey.enquiry.customer.city
    return out


@router.patch("/{survey_id}/approve", response_model=SiteSurveyOut)
def approve_survey(
    survey_id: int,
    payload: Optional[SurveyReviewRequest] = None,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "SALES_EXECUTIVE"])),
    db: Session = Depends(get_db)
):
    """
    Solar Admin / Authorized Sales Executive: Approve site survey.
    RBAC GUARD: Technicians are strictly prohibited from approving surveys.
    Anyone who conducted the survey cannot self-approve.
    Sales Executives require 'can_approve_survey' or 'APPROVE_SURVEY' capability.
    """
    survey = db.query(SiteSurvey).filter(SiteSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Site survey not found")

    user_role = (current_user.role or "").upper()
    if user_role in ("TECHNICIAN", "FIELD_TECHNICIAN") or current_user.id == survey.assigned_technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission Denied: Technicians are strictly prohibited from approving their own surveys. Requires an independent Solar Admin approval."
        )

    if user_role == "SALES_EXECUTIVE" and not (
        current_user.has_capability("can_approve_survey") or current_user.has_capability("APPROVE_SURVEY")
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission Denied: Sales Executive requires 'can_approve_survey' capability to approve surveys."
        )

    survey.reviewed_by_id = current_user.id

    survey.status = "APPROVED"
    survey.reviewed_at = datetime.datetime.utcnow()
    if payload and payload.review_notes:
        survey.review_notes = payload.review_notes

    if survey.enquiry:
        survey.enquiry.status = "SURVEY_COMPLETED"

    db.commit()
    db.refresh(survey)

    # Survey approved
    out = SiteSurveyOut.model_validate(survey)
    if survey.enquiry:
        out.enquiry_number = survey.enquiry.enquiry_number
        if survey.enquiry.customer:
            out.customer_name = survey.enquiry.customer.name
            out.customer_phone = survey.enquiry.customer.phone
            out.customer_city = survey.enquiry.customer.city
    return out


@router.patch("/{survey_id}/reject", response_model=SiteSurveyOut)
def reject_survey(
    survey_id: int,
    payload: Optional[SurveyReviewRequest] = None,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "SALES_EXECUTIVE"])),
    db: Session = Depends(get_db)
):
    survey = db.query(SiteSurvey).filter(SiteSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Site survey not found")

    user_role = (current_user.role or "").upper()
    if user_role in ("TECHNICIAN", "FIELD_TECHNICIAN") or current_user.id == survey.assigned_technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission Denied: Technicians cannot reject surveys. Action reserved for Administrator or Sales Executive."
        )

    if user_role == "SALES_EXECUTIVE" and not (
        current_user.has_capability("can_approve_survey") or current_user.has_capability("APPROVE_SURVEY")
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission Denied: Sales Executive requires 'can_approve_survey' capability to reject surveys."
        )

    survey.status = "REJECTED"
    survey.reviewed_at = datetime.datetime.utcnow()
    survey.reviewed_by_id = current_user.id

    if payload:
        if payload.rejection_reason:
            survey.rejection_reason = payload.rejection_reason
        if payload.review_notes:
            survey.review_notes = payload.review_notes

    if survey.enquiry:
        survey.enquiry.status = "REJECTED"

    db.commit()
    db.refresh(survey)

    # Survey approved
    out = SiteSurveyOut.model_validate(survey)
    if survey.enquiry:
        out.enquiry_number = survey.enquiry.enquiry_number
        if survey.enquiry.customer:
            out.customer_name = survey.enquiry.customer.name
            out.customer_phone = survey.enquiry.customer.phone
            out.customer_city = survey.enquiry.customer.city
    return out
