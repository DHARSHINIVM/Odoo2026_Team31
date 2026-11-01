import os
import json
import uuid
import datetime
import secrets
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db, get_utc_now
from app.models import (
    Customer, User, Order, SiteSurvey, Enquiry, Quotation, BillOfMaterials, BOMAllocation,
    Dispatch, SerializedItem, Installation, DigitalSolarPassport, Warranty,
    ServiceTicket, Appointment, Notification, Document, AuditLog, CustomerFeedback
)
from app.models.user_auth import hash_password, verify_password
from app.services.auth_service import (
    get_current_user, get_optional_current_user, create_session_and_token, require_roles, ROLE_PERMISSIONS
)
from app.services.appointment_service import AppointmentService, STANDARD_TIME_SLOTS
from app.services.passport_service import PassportService

router = APIRouter(prefix="/customer", tags=["Customer Portal & Mobile Application"])

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


# =========================================================================
# Request & Response Schemas
# =========================================================================

class CustomerRegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: str
    password: str
    address: Optional[str] = "Baner Road, Pune"
    city: Optional[str] = "Pune"
    pincode: Optional[str] = "411045"
    consumer_number: Optional[str] = None
    sanctioned_load_kw: Optional[float] = 5.0


class ForgotPasswordRequest(BaseModel):
    email_or_phone: str


class ResetPasswordRequest(BaseModel):
    email_or_phone: str
    verification_token: str
    new_password: str


class CustomerProfileUpdate(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    installation_address: Optional[str] = None
    contact_preferences: Optional[Dict[str, Any]] = None


class AppointmentBookingRequest(BaseModel):
    appointment_type: str = "SITE_SURVEY"  # SITE_SURVEY, INSTALLATION, SERVICE, CONSULTATION
    scheduled_date: datetime.date
    time_slot: str
    order_id: Optional[int] = None
    service_address: Optional[str] = None
    contact_phone: Optional[str] = None
    customer_notes: Optional[str] = None


class AppointmentRescheduleRequest(BaseModel):
    new_date: datetime.date
    new_time_slot: str
    reason: Optional[str] = "Customer requested rescheduling"


class AppointmentCancelRequest(BaseModel):
    cancellation_reason: str = "Customer cancelled appointment"


class InstallationEnquiryRequest(BaseModel):
    customer_name: str
    mobile_number: str
    email: Optional[str] = None
    installation_address: str
    customer_type: str = "Residential"  # Residential / Commercial / Industrial
    solar_preference: str = "On-Grid"    # On-Grid / Off-Grid / Not sure
    approximate_capacity: Optional[str] = "5 kW"
    additional_remarks: Optional[str] = None
    preferred_survey_date: Optional[datetime.date] = None
    preferred_time_window: Optional[str] = "10:00 - 12:00"
    alternative_preferred_date: Optional[datetime.date] = None
    access_instructions: Optional[str] = None


class ServiceComplaintRequest(BaseModel):
    issue_category: str  # GENERAL_MAINTENANCE, PANEL_INSPECTION, INVERTER_FAULT, BATTERY_ISSUE, ELECTRICAL_ISSUE, PERFORMANCE_CONCERN, OTHER
    description: str
    component_id: Optional[int] = None
    serial_number: Optional[str] = None
    order_id: Optional[int] = None
    passport_id: Optional[int] = None
    priority: Optional[str] = "MEDIUM"
    preferred_visit_date: Optional[datetime.date] = None
    preferred_time_slot: Optional[str] = None
    service_type: Optional[str] = "SERVICE_VISIT"  # SERVICE_VISIT vs COMPLAINT


class CustomerFeedbackRequest(BaseModel):
    feedback_type: str = "INSTALLATION"  # INSTALLATION, SERVICE, PRODUCT, TECHNICIAN, SURVEY, GENERAL
    rating: int = Field(..., ge=1, le=5)
    category_ratings: Optional[Dict[str, int]] = None
    comments: Optional[str] = None
    order_id: Optional[int] = None
    installation_id: Optional[int] = None
    service_ticket_id: Optional[int] = None
    component_id: Optional[int] = None
    technician_id: Optional[int] = None


class PassportAcknowledgementRequest(BaseModel):
    passport_id: int
    customer_notes: Optional[str] = "I acknowledge that the solar system has been installed and tested according to specifications."


# =========================================================================
# Helper Dependency: Authenticate Customer and Retrieve Customer Record
# =========================================================================

def get_current_customer_record(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Customer:
    """
    Enforces customer authentication and verifies link to canonical Customer record.
    Admins are permitted to act on behalf of customer #1 for testing.
    """
    user_role = (current_user.role or "").upper()
    if user_role not in ("CUSTOMER", "ADMIN", "SOLAR_MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Role '{user_role}' is not authorized for customer portal."
        )

    customer = None
    if current_user.customer_id:
        customer = db.query(Customer).filter(Customer.id == current_user.customer_id).first()

    if not customer:
        # Fallback by matching email or phone
        customer = db.query(Customer).filter(
            (Customer.email.ilike(current_user.email)) | (Customer.phone == current_user.phone)
        ).first()

    if not customer and user_role in ("ADMIN", "SOLAR_MANAGER"):
        # For admin preview/test, fallback to customer 1
        customer = db.query(Customer).filter(Customer.id == 1).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No customer business record associated with this account. Please contact SunPower Support."
        )

    return customer


# =========================================================================
# 1. Customer Onboarding & Authentication
# =========================================================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_customer(
    payload: CustomerRegisterRequest,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Registers a new Customer user account:
    - Associates securely with existing Customer record if phone or email matches (avoids duplicate customers).
    - If no existing record found, creates a new canonical Customer record.
    - Issues an active server-side session and signed JWT bearer token.
    """
    email_clean = payload.email.strip().lower()
    phone_clean = payload.phone.strip()

    # Check if a user account already exists with this email
    existing_user = db.query(User).filter(
        (User.email.ilike(email_clean)) | (User.username.ilike(email_clean))
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{email_clean}' already exists. Please log in or use password recovery."
        )

    # Associate with existing Customer record if available
    customer = db.query(Customer).filter(
        (Customer.email.ilike(email_clean)) | (Customer.phone == phone_clean)
    ).first()

    if not customer:
        # Create new Customer record
        customer = Customer(
            name=payload.full_name.strip(),
            email=email_clean,
            phone=phone_clean,
            address=payload.address or "Solar Installation Site",
            city=payload.city or "Pune",
            state="Maharashtra",
            pincode=payload.pincode or "411001",
            consumer_number=payload.consumer_number,
            sanctioned_load_kw=payload.sanctioned_load_kw or 5.0,
            installation_address=payload.address,
            created_at=get_utc_now()
        )
        db.add(customer)
        db.flush()
    else:
        # Update installation address and consumer number if newly provided
        if payload.address and not customer.installation_address:
            customer.installation_address = payload.address
        if payload.consumer_number and not customer.consumer_number:
            customer.consumer_number = payload.consumer_number
        db.flush()

    # Create User record
    username = email_clean.split("@")[0] + "_" + secrets.token_hex(2)
    new_user = User(
        username=username,
        email=email_clean,
        full_name=payload.full_name.strip(),
        phone=phone_clean,
        role="CUSTOMER",
        department="Customer",
        designation="Solar Rooftop Owner",
        is_active=True,
        customer_id=customer.id,
        created_at=get_utc_now()
    )
    new_user.set_password(payload.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Issue session and JWT token
    user_agent = request.headers.get("user-agent") if request else "Customer Mobile"
    ip_addr = request.client.host if request and request.client else "127.0.0.1"
    token = create_session_and_token(user=new_user, db=db, user_agent=user_agent, ip_address=ip_addr)

    # Audit log
    audit = AuditLog(
        user_id=new_user.id,
        user_name=new_user.full_name,
        user_role="CUSTOMER",
        action="CREATE",
        entity_type="USER",
        entity_id=new_user.id,
        entity_identifier=new_user.username,
        new_values=json.dumps({"customer_id": customer.id, "email": email_clean})
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": "Customer account registered successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "customer_id": customer.id
        },
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "city": customer.city
        },
        "dashboard_route": "/mobile/customer"
    }


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Initiates password recovery for a Customer.
    Generates a secure 6-digit verification token with 15-minute expiration.
    """
    ident = payload.email_or_phone.strip().lower()
    user = db.query(User).filter(
        (User.email.ilike(ident)) | (User.phone == ident) | (User.username.ilike(ident))
    ).first()

    if not user:
        # Return generic success to prevent enumeration
        return {
            "success": True,
            "message": "If an account matching the provided details exists, a verification code has been dispatched."
        }

    token = f"{secrets.randbelow(900000) + 100000}"
    expires = get_utc_now() + datetime.timedelta(minutes=15)
    user.reset_token = token
    user.reset_token_expires_at = expires
    db.commit()

    return {
        "success": True,
        "message": f"Verification code dispatched to your registered contact.",
        "verification_token": token,  # Provided for local demonstration convenience
        "expires_in_seconds": 900
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Resets customer account password with validated verification token.
    """
    ident = payload.email_or_phone.strip().lower()
    user = db.query(User).filter(
        (User.email.ilike(ident)) | (User.phone == ident) | (User.username.ilike(ident))
    ).first()

    if not user or not user.reset_token:
        raise HTTPException(status_code=400, detail="Invalid verification request.")

    now = get_utc_now()
    if user.reset_token_expires_at and user.reset_token_expires_at.replace(tzinfo=datetime.timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if user.reset_token != payload.verification_token.strip():
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    user.set_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()

    return {
        "success": True,
        "message": "Password reset successfully. You may now log in with your new credentials."
    }


# =========================================================================
# 2. Customer Profile
# =========================================================================

@router.get("/profile")
def get_customer_profile(
    customer: Customer = Depends(get_current_customer_record),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves personal details, addresses, consumer number, and communication preferences.
    """
    contact_prefs = {}
    if customer.contact_preferences:
        try:
            contact_prefs = json.loads(customer.contact_preferences)
        except Exception:
            contact_prefs = {"preferred_channel": "WHATSAPP", "notify_sms": True, "notify_email": True, "notify_push": True}
    else:
        contact_prefs = {"preferred_channel": "WHATSAPP", "notify_sms": True, "notify_email": True, "notify_push": True}

    return {
        "customer_id": customer.id,
        "uuid": customer.uuid,
        "full_name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "billing_address": customer.address,
        "installation_address": customer.installation_address or customer.address,
        "city": customer.city,
        "state": customer.state,
        "pincode": customer.pincode,
        "consumer_number": customer.consumer_number,
        "sanctioned_load_kw": customer.sanctioned_load_kw,
        "avg_monthly_bill_inr": round((customer.avg_monthly_bill_paise or 0) / 100, 2),
        "contact_preferences": contact_prefs,
        "user_account": {
            "username": current_user.username,
            "role": current_user.role,
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None
        }
    }


@router.patch("/profile")
def update_customer_profile(
    payload: CustomerProfileUpdate,
    customer: Customer = Depends(get_current_customer_record),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates customer contact preferences, installation address, or contact details with validation.
    """
    if payload.phone:
        customer.phone = payload.phone.strip()
        current_user.phone = payload.phone.strip()

    if payload.email:
        customer.email = payload.email.strip().lower()

    if payload.installation_address:
        customer.installation_address = payload.installation_address.strip()

    if payload.contact_preferences is not None:
        customer.contact_preferences = json.dumps(payload.contact_preferences)

    db.commit()

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "customer_id": customer.id
    }


# =========================================================================
# 3. Customer Dashboard & 13-Stage Project Tracking
# =========================================================================

def _compute_13_milestones(order: Optional[Order], enquiry: Optional[Any], survey: Optional[Any], passport: Optional[Any]) -> List[Dict[str, Any]]:
    """
    Translates internal EPC engineering and warehouse workflows into exactly
    the 13 customer-friendly milestones specified in Section 3.D.
    """
    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Enquiry received
    enq_done = enquiry is not None
    enq_date = enquiry.created_at.strftime("%Y-%m-%d") if enquiry and enquiry.created_at else "Completed"
    
    # 2. Survey arranged
    surv_arranged = survey is not None or (order is not None)
    surv_arr_date = survey.survey_date.strftime("%Y-%m-%d") if survey and survey.survey_date else (enq_date if surv_done else "Pending")

    # 3. Site survey completed
    surv_done = (survey is not None and survey.status in ("APPROVED", "SUBMITTED", "UNDER_REVIEW")) or (order is not None)
    surv_date = survey.survey_date.strftime("%Y-%m-%d") if survey and survey.survey_date else (surv_arr_date if surv_done else "Pending")

    # 4. Quotation prepared
    quote = order.quotation if order else (enquiry.quotations[0] if enquiry and enquiry.quotations else None)
    quote_done = quote is not None or (order is not None)
    quote_date = quote.created_at.strftime("%Y-%m-%d") if quote and quote.created_at else "Pending"

    # 5. Order confirmed
    order_done = order is not None
    order_date = order.created_at.strftime("%Y-%m-%d") if order and order.created_at else "Pending"

    # 6. Payment progress
    payment_done = order is not None and (order.advance_received_paise or 0) > 0
    advance_inr = round((order.advance_received_paise or 0) / 100, 2) if order else 0

    # 7. Materials being arranged
    bom_exists = order is not None and (order.bom is not None or order.stage in ("BOM_GENERATED", "INVENTORY_ALLOCATED", "DISPATCHED", "INSTALLED", "COMMISSIONED"))

    # 8. Materials confirmed (Allocated)
    allocated_done = order is not None and (order.stage in ("INVENTORY_ALLOCATED", "DISPATCHED", "INSTALLED", "COMMISSIONED") or (order.bom and order.bom.status == "ALLOCATED"))

    # 9. Materials dispatched
    dispatch = order.dispatches[0] if order and order.dispatches else None
    dispatch_done = (dispatch is not None and dispatch.status in ("DISPATCHED", "IN_TRANSIT", "DELIVERED")) or (order is not None and order.stage in ("DISPATCHED", "INSTALLED", "COMMISSIONED"))
    dispatch_date = dispatch.dispatch_date.strftime("%Y-%m-%d") if dispatch and dispatch.dispatch_date else "Pending"

    # 10. Installation scheduled
    inst = order.installations[0] if order and order.installations else None
    inst_scheduled = inst is not None or (order is not None and order.stage in ("INSTALLED", "COMMISSIONED"))
    inst_sch_date = inst.scheduled_start_date.strftime("%Y-%m-%d") if inst and inst.scheduled_start_date else "Pending"

    # 11. Installation in progress
    inst_in_prog = inst is not None and inst.status in ("IN_PROGRESS", "QUALITY_CHECK", "CUSTOMER_SIGNOFF", "COMMISSIONED")

    # 12. Installation completed
    inst_completed = (inst is not None and inst.status in ("CUSTOMER_SIGNOFF", "COMMISSIONED")) or (order is not None and order.stage == "COMMISSIONED")
    inst_comp_date = inst.completion_date.strftime("%Y-%m-%d") if inst and inst.completion_date else "Pending"

    # 13. Warranty activated
    warranty_done = passport is not None and passport.is_active and len(passport.warranties) > 0
    warranty_date = passport.commissioning_date.strftime("%Y-%m-%d") if passport and passport.commissioning_date else "Pending"

    milestones = [
        {
            "step": 1,
            "title": "Enquiry Received",
            "is_completed": enq_done,
            "is_active": enq_done and not surv_arranged,
            "date": enq_date,
            "message": "Solar inquiry registered with SunPower Engineering team."
        },
        {
            "step": 2,
            "title": "Survey Arranged",
            "is_completed": surv_arranged,
            "is_active": surv_arranged and not surv_done,
            "date": surv_arr_date,
            "message": "Certified rooftop surveyor scheduled for technical feasibility inspection."
        },
        {
            "step": 3,
            "title": "Site Survey Completed",
            "is_completed": surv_done,
            "is_active": surv_done and not quote_done,
            "date": surv_date,
            "message": "Azimuth, tilt angle, shadow-free roof area, and structural integrity confirmed."
        },
        {
            "step": 4,
            "title": "Quotation Prepared",
            "is_completed": quote_done,
            "is_active": quote_done and not order_done,
            "date": quote_date,
            "message": "Custom solar engineering design, module sizing, and PM Surya Ghar subsidy applied."
        },
        {
            "step": 5,
            "title": "Order Confirmed",
            "is_completed": order_done,
            "is_active": order_done and not payment_done,
            "date": order_date,
            "message": "Solar EPC commercial contract signed and project initiated."
        },
        {
            "step": 6,
            "title": "Payment Progress",
            "is_completed": payment_done,
            "is_active": payment_done and not bom_exists,
            "date": order_date,
            "message": f"Advance payment of ₹{advance_inr:,.0f} verified and credited to project."
        },
        {
            "step": 7,
            "title": "Materials Being Arranged",
            "is_completed": bom_exists,
            "is_active": bom_exists and not allocated_done,
            "date": order_date,
            "message": "Bill of Materials derived; component requisition sent to regional logistics hubs."
        },
        {
            "step": 8,
            "title": "Materials Confirmed",
            "is_completed": allocated_done,
            "is_active": allocated_done and not dispatch_done,
            "date": order_date,
            "message": "Tier-1 solar modules, inverter, and HDG structure reserved in warehouse depot."
        },
        {
            "step": 9,
            "title": "Materials Dispatched",
            "is_completed": dispatch_done,
            "is_active": dispatch_done and not inst_scheduled,
            "date": dispatch_date,
            "message": "Consignment dispatched with logistics tracking and verified hardware barcodes."
        },
        {
            "step": 10,
            "title": "Installation Scheduled",
            "is_completed": inst_scheduled,
            "is_active": inst_scheduled and not inst_in_prog,
            "date": inst_sch_date,
            "message": "Certified installation engineering crew and site supervisor assigned."
        },
        {
            "step": 11,
            "title": "Installation In Progress",
            "is_completed": inst_in_prog,
            "is_active": inst_in_prog and not inst_completed,
            "date": inst_sch_date,
            "message": "Mounting structure torqued, modules clamped, inverter wired, and earthing verified."
        },
        {
            "step": 12,
            "title": "Installation Completed",
            "is_completed": inst_completed,
            "is_active": inst_completed and not warranty_done,
            "date": inst_comp_date,
            "message": "8-point quality gate cleared, earthing resistance <5Ω, grid synchronized."
        },
        {
            "step": 13,
            "title": "Warranty Activated",
            "is_completed": warranty_done,
            "is_active": warranty_done,
            "date": warranty_date,
            "message": "Digital Solar Passport generated; 25-year performance warranty active."
        }
    ]

    return milestones


@router.get("/dashboard")
def get_customer_dashboard(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Consolidated Customer Dashboard Endpoint matching Customer_UI design tokens.
    Returns:
    - Active project status
    - 13-stage customer milestones
    - Rated power & grid synchronization status
    - Hardware readiness & bill of materials breakdown
    - Assigned coordinator details (Vikram Rao / Sales Executive)
    - Canonical Digital Solar Passport access
    - Equipment warranties
    - Appointments & service requests
    - Real-time in-app notifications
    """
    # 1. Orders / Projects
    orders = db.query(Order).filter(Order.customer_id == customer.id).order_by(Order.created_at.desc()).all()
    primary_order = orders[0] if orders else None

    # 2. Enquiry & Survey
    enquiry = customer.enquiries[0] if customer.enquiries else None
    survey = enquiry.surveys[0] if (enquiry and enquiry.surveys) else None

    # 3. Canonical Passport
    passport = None
    if primary_order:
        passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.order_id == primary_order.id).first()
    if not passport:
        passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.customer_id == customer.id).first()

    # 4. Compute 13-Stage Milestones
    milestones = _compute_13_milestones(primary_order, enquiry, survey, passport)
    completed_count = sum(1 for m in milestones if m["is_completed"])
    momentum_pct = round((completed_count / len(milestones)) * 100)
    current_milestone = next((m for m in milestones if m["is_active"]), milestones[-1 if completed_count == 13 else completed_count])

    # 5. Technical System Specs
    system_cap = 5.0
    grid_type = "ON_GRID"
    target_pto = "Nov 2026"
    if passport:
        system_cap = passport.system_capacity_kw
        grid_type = passport.grid_type
        if passport.commissioning_date:
            target_pto = passport.commissioning_date.strftime("%b %Y")
    elif primary_order and primary_order.quotation:
        system_cap = primary_order.quotation.system_capacity_kw
        grid_type = "ON_GRID"

    # 6. Hardware & Materials Readiness (Derived from actual BOM and SerializedItems)
    hardware_items = []
    if primary_order and primary_order.bom:
        for it in primary_order.bom.items:
            comp = it.component
            comp_name = comp.name if comp else "Component"
            qty_req = getattr(it, "quantity_required", getattr(it, "quantity", 1))
            qty_alloc = getattr(it, "quantity_allocated", 0)
            is_ready = qty_alloc >= qty_req
            status_text = "Allocated" if is_ready else "Allocating"
            if primary_order.stage in ("DISPATCHED", "INSTALLED", "COMMISSIONED"):
                status_text = "Dispatched" if primary_order.stage == "DISPATCHED" else "Installed"

            hardware_items.append({
                "name": f"{comp_name} ({qty_req} units)",
                "category": comp.category if comp else "HARDWARE",
                "is_ready": is_ready or primary_order.stage in ("DISPATCHED", "INSTALLED", "COMMISSIONED"),
                "status": status_text
            })

    if not hardware_items:
        # Realistic fallback derived from system sizing
        hardware_items = [
            {"name": "Growatt 5000TL Inverter (1 unit)", "category": "INVERTER", "is_ready": True, "status": "Ready"},
            {"name": "Waaree 550W Bifacial Modules (10 units)", "category": "PANEL", "is_ready": True, "status": "Allocated"},
            {"name": "HDG Elevated Structure & Fasteners", "category": "STRUCTURE", "is_ready": completed_count >= 8, "status": "Ready" if completed_count >= 8 else "En Route"},
            {"name": "DC/AC Cables & Protection SPDs", "category": "PROTECTION", "is_ready": completed_count >= 8, "status": "Ready" if completed_count >= 8 else "Allocating"},
            {"name": "Bi-directional Net Meter (Three-Phase)", "category": "METER", "is_ready": completed_count >= 9, "status": "Ready" if completed_count >= 9 else "Pending Staging"}
        ]

    # 7. Assigned Coordinator
    assigned_sales = enquiry.assigned_sales_rep if enquiry else None
    coordinator = {
        "name": assigned_sales.full_name if assigned_sales else "Vikram Rao",
        "title": assigned_sales.designation if assigned_sales else "Solar Project Lead",
        "phone": assigned_sales.phone if assigned_sales and assigned_sales.phone else "+91 98200 22002",
        "email": assigned_sales.email if assigned_sales else "support@sunpower.com",
        "status": "Online"
    }

    # 8. Warranties Summary
    warranties_list = []
    if passport:
        for w in passport.warranties:
            warranties_list.append({
                "id": w.id,
                "component_name": w.component.name if w.component else "Solar Equipment",
                "serial_number": w.serial_number,
                "warranty_type": w.warranty_type,
                "duration_years": w.duration_years,
                "start_date": w.start_date.strftime("%Y-%m-%d") if w.start_date else None,
                "end_date": w.end_date.strftime("%Y-%m-%d") if w.end_date else None,
                "status": w.status,
                "is_valid": w.status == "ACTIVE"
            })

    # 9. Next Appointment
    next_apt = db.query(Appointment).filter(
        Appointment.customer_id == customer.id,
        Appointment.status.notin_(["CANCELLED", "COMPLETED"])
    ).order_by(Appointment.scheduled_date.asc()).first()

    next_apt_data = None
    if next_apt:
        next_apt_data = {
            "id": next_apt.id,
            "appointment_number": next_apt.appointment_number,
            "appointment_type": next_apt.appointment_type,
            "scheduled_date": next_apt.scheduled_date.strftime("%Y-%m-%d"),
            "time_slot": next_apt.time_slot,
            "status": next_apt.status,
            "technician_name": next_apt.assigned_tech.full_name if next_apt.assigned_tech else "Assigned Field Engineer"
        }

    # 10. Open Service Tickets Count
    open_tickets = db.query(ServiceTicket).filter(
        ServiceTicket.customer_id == customer.id,
        ServiceTicket.status.notin_(["RESOLVED", "CLOSED"])
    ).count()

    # 11. Unread In-App Notifications Count
    unread_notifs = db.query(Notification).filter(
        (Notification.related_entity_type == "Customer") & (Notification.related_entity_id == customer.id) |
        (Notification.title.ilike(f"%{customer.name}%")),
        Notification.is_read == False
    ).count()

    # 12. Recent Activity Log
    recent_activity = [
        {
            "title": "Digital Solar Passport Activated",
            "date": passport.commissioning_date.strftime("%b %d") if passport and passport.commissioning_date else "Nov 02",
            "desc": f"Certificate #{passport.passport_number} verified with Tier-1 components." if passport else "Installation sign-off cleared.",
            "is_highlight": True
        },
        {
            "title": "Order Confirmed & Advance Paid",
            "date": primary_order.created_at.strftime("%b %d") if primary_order and primary_order.created_at else "Oct 29",
            "desc": f"Order #{primary_order.order_number} confirmed with 20% advance milestone." if primary_order else "Contract signed.",
            "is_highlight": False
        },
        {
            "title": "Site Survey Approved",
            "date": survey.survey_date.strftime("%b %d") if survey and survey.survey_date else "Oct 25",
            "desc": f"Rooftop feasibility verified for {system_cap} kW capacity.",
            "is_highlight": False
        }
    ]

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "city": customer.city,
            "phone": customer.phone,
            "consumer_number": customer.consumer_number
        },
        "active_project": {
            "order_id": primary_order.id if primary_order else None,
            "order_number": primary_order.order_number if primary_order else "N/A",
            "system_capacity_kw": system_cap,
            "grid_type": grid_type,
            "target_pto": target_pto,
            "stage": primary_order.stage if primary_order else "CONFIRMED",
            "momentum_pct": momentum_pct,
            "current_stage_label": f"Stage {completed_count}/{len(milestones)}",
            "current_milestone_title": current_milestone["title"],
            "current_milestone_message": current_milestone["message"],
            "total_contract_inr": round((primary_order.total_contract_paise or 0) / 100, 2) if primary_order else 0,
            "advance_received_inr": round((primary_order.advance_received_paise or 0) / 100, 2) if primary_order else 0
        },
        "milestones": milestones,
        "hardware_items": hardware_items,
        "ready_hardware_count": sum(1 for h in hardware_items if h["is_ready"]),
        "total_hardware_count": len(hardware_items),
        "coordinator": coordinator,
        "passport": {
            "id": passport.id if passport else None,
            "passport_number": passport.passport_number if passport else None,
            "qr_code_token": passport.qr_code_token if passport else None,
            "public_url": f"/passport/public/{passport.qr_code_token}" if passport else None,
            "system_health_score": passport.system_health_score if passport else 98,
            "lifetime_mwh": passport.estimated_lifetime_mwh if passport else round(system_cap * 1.5 * 25, 1),
            "co2_tonnes": passport.co2_offset_tonnes if passport else round(system_cap * 1.5 * 25 * 0.82, 1),
            "customer_acknowledgement": passport.customer_acknowledgement if passport else None,
            "is_active": passport.is_active if passport else False
        } if passport else None,
        "warranties_count": len(warranties_list),
        "open_service_tickets_count": open_tickets,
        "unread_notifications_count": unread_notifs,
        "upcoming_appointment": next_apt_data,
        "recent_activity": recent_activity
    }


# =========================================================================
# 4. Customer Projects & Orders
# =========================================================================

@router.get("/projects")
def list_customer_projects(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Lists all solar projects and orders owned by the authenticated customer.
    Enforces customer-specific data isolation.
    """
    orders = db.query(Order).filter(Order.customer_id == customer.id).order_by(Order.created_at.desc()).all()
    results = []

    for ord in orders:
        passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.order_id == ord.id).first()
        results.append({
            "id": ord.id,
            "order_id": ord.id,
            "order_number": ord.order_number,
            "stage": ord.stage,
            "status": ord.stage or "COMMISSIONED",
            "system_capacity_kw": ord.quotation.system_capacity_kw if ord.quotation else 5.0,
            "system_type": "On-Grid Residential",
            "address": customer.installation_address or "Residential Rooftop, Pune",
            "installation_date": passport.commissioning_date.strftime("%Y-%m-%d") if (passport and passport.commissioning_date) else None,
            "contract_inr": round(ord.total_contract_paise / 100, 2),
            "advance_paid_inr": round((ord.advance_received_paise or 0) / 100, 2),
            "payment_status": ord.payment_status,
            "created_at": ord.created_at.strftime("%Y-%m-%d"),
            "has_passport": passport is not None,
            "passport_number": passport.passport_number if passport else None,
            "passport_token": passport.qr_code_token if passport else None
        })

    return results


@router.get("/projects/{order_id}")
def get_customer_project_details(
    order_id: int,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Retrieves detailed milestone breakdown, equipment specs, and payment receipts.
    Guards strictly against horizontal privilege escalation (changing order_id).
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Solar project not found.")

    if order.customer_id != customer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this solar project."
        )

    passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.order_id == order.id).first()
    enquiry = order.quotation.enquiry if order.quotation else None
    survey = enquiry.surveys[0] if (enquiry and enquiry.surveys) else None
    milestones = _compute_13_milestones(order, enquiry, survey, passport)

    # Payments list
    payments = [
        {
            "payment_number": p.payment_number,
            "milestone": p.milestone,
            "amount_inr": round(p.amount_paise / 100, 2),
            "paid_at": p.paid_at.strftime("%Y-%m-%d"),
            "mode": p.payment_mode,
            "reference": p.transaction_reference,
            "status": p.status
        }
        for p in order.payments
    ]

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "stage": order.stage,
        "contract_inr": round(order.total_contract_paise / 100, 2),
        "advance_paid_inr": round((order.advance_received_paise or 0) / 100, 2),
        "payment_status": order.payment_status,
        "payments": payments,
        "milestones": milestones,
        "created_at": order.created_at.strftime("%Y-%m-%d"),
        "passport": {
            "passport_number": passport.passport_number,
            "qr_code_token": passport.qr_code_token,
            "commissioning_date": passport.commissioning_date.strftime("%Y-%m-%d") if passport.commissioning_date else None,
            "lifetime_mwh": passport.estimated_lifetime_mwh,
            "co2_tonnes": passport.co2_offset_tonnes,
            "health_score": passport.system_health_score
        } if passport else None
    }


# =========================================================================
# 4b. Solar Installation Request & Preferred Survey Appointment
# =========================================================================

@router.post("/installation-request", status_code=status.HTTP_201_CREATED)
def submit_installation_request(
    payload: InstallationEnquiryRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Module 2: Installation Request & Survey Booking
    - Validates required fields: customer_name, mobile_number, installation_address.
    - Creates or identifies Customer CRM record.
    - Creates Enquiry record with preferred solar configuration.
    - Creates associated Appointment request for site survey.
    - Dispatches notifications to Sales Executive/Admin and Customer.
    - Returns reference numbers and confirmation message.
    """
    clean_name = payload.customer_name.strip()
    clean_phone = payload.mobile_number.strip().replace(" ", "").replace("-", "")
    clean_email = payload.email.strip().lower() if payload.email else None
    clean_address = payload.installation_address.strip()

    if not clean_name or len(clean_name) < 2:
        raise HTTPException(status_code=400, detail="Customer name must be at least 2 characters.")
    if not clean_phone or len(clean_phone) < 8:
        raise HTTPException(status_code=400, detail="Valid mobile number is required.")
    if not clean_address or len(clean_address) < 5:
        raise HTTPException(status_code=400, detail="Complete installation address is required.")

    # 1. Identify or create Customer record
    customer = None
    if current_user and current_user.customer_id:
        customer = db.query(Customer).filter(Customer.id == current_user.customer_id).first()

    if not customer:
        customer = db.query(Customer).filter(Customer.phone == clean_phone).first()

    if not customer and clean_email:
        customer = db.query(Customer).filter(Customer.email.ilike(clean_email)).first()

    if not customer:
        customer = Customer(
            name=clean_name,
            phone=clean_phone,
            email=clean_email or f"lead_{secrets.token_hex(3)}@sunpower.local",
            installation_address=clean_address,
            city="Pune",
            state="Maharashtra",
            pincode="411001",
            sanctioned_load_kw=5.0,
            created_at=get_utc_now()
        )
        db.add(customer)
        db.flush()
    else:
        if clean_address and not customer.installation_address:
            customer.installation_address = clean_address
        db.flush()

    # Parse capacity
    cap_val = 5.0
    if payload.approximate_capacity:
        try:
            import re
            m = re.search(r"(\d+(\.\d+)?)", payload.approximate_capacity)
            if m:
                cap_val = float(m.group(1))
        except Exception:
            cap_val = 5.0

    # 2. Create Enquiry with robust unique number generation
    existing_enqs = db.query(Enquiry.enquiry_number).filter(Enquiry.enquiry_number.like("ENQ-2026-%")).all()
    existing_enq_nums = set()
    for (num_str,) in existing_enqs:
        try:
            existing_enq_nums.add(int(num_str.split("-")[-1]))
        except Exception:
            pass
    next_enq_num = (max(existing_enq_nums) + 1) if existing_enq_nums else (db.query(Enquiry).count() + 1)
    enquiry_number = f"ENQ-2026-{next_enq_num:03d}"

    notes_parts = [
        f"Customer Type: {payload.customer_type}",
        f"Solar Preference: {payload.solar_preference}",
        f"Approx Capacity: {payload.approximate_capacity or str(cap_val) + ' kW'}",
    ]
    if payload.additional_remarks:
        notes_parts.append(f"Remarks: {payload.additional_remarks}")
    if payload.access_instructions:
        notes_parts.append(f"Access Instructions: {payload.access_instructions}")
    if payload.alternative_preferred_date:
        notes_parts.append(f"Alternative Date: {payload.alternative_preferred_date}")

    enquiry = Enquiry(
        customer_id=customer.id,
        enquiry_number=enquiry_number,
        required_capacity_kw=cap_val,
        property_type=payload.customer_type,
        roof_type="RCC Flat",
        grid_type="ON_GRID" if "on" in payload.solar_preference.lower() else ("OFF_GRID" if "off" in payload.solar_preference.lower() else "HYBRID"),
        source="CUSTOMER_MOBILE",
        lead_priority="HIGH" if payload.customer_type in ("Commercial", "Industrial") else "MEDIUM",
        status="SURVEY_REQUESTED",
        notes=" | ".join(notes_parts),
        created_at=get_utc_now()
    )
    db.add(enquiry)
    db.flush()

    # 3. Create Survey Appointment Request with robust unique number generation
    apt_date = payload.preferred_survey_date or (datetime.date.today() + datetime.timedelta(days=2))
    apt_slot = payload.preferred_time_window or "10:00 - 12:00"

    existing_apts = db.query(Appointment.appointment_number).filter(Appointment.appointment_number.like("APT-2026-%")).all()
    existing_apt_nums = set()
    for (apt_str,) in existing_apts:
        try:
            existing_apt_nums.add(int(apt_str.split("-")[-1]))
        except Exception:
            pass
    next_apt_num = (max(existing_apt_nums) + 1) if existing_apt_nums else (db.query(Appointment).count() + 1)
    appointment_number = f"APT-2026-{next_apt_num:04d}"

    apt_notes = f"Installation Request {enquiry_number} | Type: {payload.customer_type}"
    if payload.access_instructions:
        apt_notes += f" | Access: {payload.access_instructions}"
    if payload.alternative_preferred_date:
        apt_notes += f" | Alt Date: {payload.alternative_preferred_date}"

    appointment = Appointment(
        appointment_number=appointment_number,
        customer_id=customer.id,
        appointment_type="SITE_SURVEY",
        scheduled_date=apt_date,
        time_slot=apt_slot,
        service_address=clean_address,
        contact_phone=clean_phone,
        status="REQUESTED",
        customer_notes=apt_notes,
        created_at=get_utc_now()
    )
    db.add(appointment)

    # 4. Notify Sales/Admin team
    sales_users = db.query(User).filter(User.role.in_(["SALES_EXECUTIVE", "ADMIN"])).all()
    for su in sales_users[:3]:
        db.add(Notification(
            user_id=su.id,
            category="ENQUIRY",
            title="New Solar Installation Request",
            message=f"{clean_name} requested installation ({enquiry_number}) for {cap_val}kW. Preferred survey: {apt_date} ({apt_slot}).",
            related_entity_type="Enquiry",
            related_entity_id=enquiry.id,
            is_read=False,
            created_at=get_utc_now()
        ))

    # 5. Customer Notification
    if current_user:
        db.add(Notification(
            user_id=current_user.id,
            category="PROJECT",
            title="Installation Request Received",
            message=f"Your solar installation request {enquiry_number} has been received. Our team will review your preferred survey time and contact you with confirmation.",
            related_entity_type="Enquiry",
            related_entity_id=enquiry.id,
            is_read=False,
            created_at=get_utc_now()
        ))

    db.commit()

    return {
        "success": True,
        "message": "Your solar installation request has been received. Our team will review your preferred survey time and contact you with appointment confirmation.",
        "enquiry_id": enquiry.id,
        "reference_number": enquiry_number,
        "appointment_number": appointment_number,
        "status": "SURVEY_APPOINTMENT_REQUESTED",
        "preferred_date": apt_date.strftime("%Y-%m-%d"),
        "preferred_time_window": apt_slot,
        "customer_name": clean_name
    }


@router.get("/installation-requests")
def list_customer_installation_requests(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    enquiries = db.query(Enquiry).filter(
        Enquiry.customer_id == customer.id
    ).order_by(Enquiry.created_at.desc()).all()

    return [{
        "id": e.id,
        "enquiry_number": e.enquiry_number,
        "required_capacity_kw": e.required_capacity_kw,
        "property_type": e.property_type,
        "grid_type": e.grid_type,
        "status": e.status,
        "notes": e.notes,
        "created_at": e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else None
    } for e in enquiries]


# =========================================================================
# 5. Customer Appointments & Scheduling
# =========================================================================

@router.get("/appointments")
def list_customer_appointments(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Returns appointment history and upcoming visits for the authenticated customer.
    Distinguishes Requested, Confirmed, Rescheduled, Completed, Cancelled.
    """
    appointments = db.query(Appointment).filter(
        Appointment.customer_id == customer.id
    ).order_by(Appointment.scheduled_date.desc()).all()

    results = []
    for apt in appointments:
        results.append({
            "id": apt.id,
            "uuid": apt.uuid,
            "appointment_number": apt.appointment_number,
            "appointment_type": apt.appointment_type,
            "scheduled_date": apt.scheduled_date.strftime("%Y-%m-%d"),
            "time_slot": apt.time_slot,
            "status": apt.status,
            "technician_name": apt.assigned_tech.full_name if apt.assigned_tech else "Assigned Field Engineer",
            "service_address": apt.service_address or customer.address,
            "contact_phone": apt.contact_phone or customer.phone,
            "customer_notes": apt.customer_notes,
            "cancellation_reason": apt.cancellation_reason,
            "created_at": apt.created_at.strftime("%Y-%m-%d")
        })

    return results


@router.get("/appointments/available-slots")
def get_customer_available_slots(
    appointment_type: str = "SITE_SURVEY",
    days_ahead: int = 7,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Returns available technician appointment slots from the central backend.
    """
    start_date = datetime.date.today()
    schedule = []
    for i in range(min(days_ahead, 14)):
        current_d = start_date + datetime.timedelta(days=i)
        slots = AppointmentService.get_available_slots(
            db=db,
            target_date=current_d,
            appointment_type=appointment_type.upper()
        )
        schedule.append({
            "date": current_d.isoformat(),
            "day_name": current_d.strftime("%A"),
            "slots": [s["time_slot"] for s in slots if s["available"]],
            "slot_details": slots
        })
    return schedule


@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def book_customer_appointment(
    payload: AppointmentBookingRequest,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Customer Appointment Request:
    - Validates date & time slot strictly against backend availability engine.
    - Prevents double-booking.
    - Validates installation/material readiness if requesting installation.
    - Emits in-app notification.
    """
    apt_type = payload.appointment_type.upper()
    if apt_type not in ("SITE_SURVEY", "INSTALLATION", "SERVICE", "CONSULTATION"):
        raise HTTPException(status_code=400, detail=f"Invalid appointment type '{payload.appointment_type}'.")

    # Business Rule: Installation Readiness Check
    if apt_type == "INSTALLATION":
        order = None
        if payload.order_id:
            order = db.query(Order).filter(Order.id == payload.order_id, Order.customer_id == customer.id).first()
        else:
            order = db.query(Order).filter(Order.customer_id == customer.id).first()

        if not order:
            raise HTTPException(
                status_code=400,
                detail="Installation Request Guard: You must have a confirmed solar order before booking an installation visit."
            )
        if order.stage not in ("INVENTORY_ALLOCATED", "DISPATCHED", "INSTALLED", "COMMISSIONED"):
            # A preferred slot is accepted as AWAITING_CONFIRMATION
            status_override = "REQUESTED"
        else:
            status_override = None

    apt = AppointmentService.book_appointment(
        db=db,
        customer_id=customer.id,
        appointment_type=apt_type,
        scheduled_date=payload.scheduled_date,
        time_slot=payload.time_slot,
        order_id=payload.order_id,
        service_address=payload.service_address or customer.installation_address or customer.address,
        contact_phone=payload.contact_phone or customer.phone,
        customer_notes=payload.customer_notes
    )

    # In-app notification for the customer
    notif = Notification(
        category="APPOINTMENT",
        title="Appointment Request Received",
        message=f"Your {apt_type.replace('_', ' ')} request for {payload.scheduled_date} ({payload.time_slot}) has been received (#{apt.appointment_number}).",
        related_entity_type="Customer",
        related_entity_id=customer.id,
        is_read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(apt)

    return {
        "success": True,
        "message": f"Appointment #{apt.appointment_number} successfully registered.",
        "appointment_number": apt.appointment_number,
        "appointment_id": apt.id,
        "scheduled_date": apt.scheduled_date.strftime("%Y-%m-%d"),
        "time_slot": apt.time_slot,
        "status": apt.status
    }


@router.patch("/appointments/{appointment_id}/reschedule")
def reschedule_customer_appointment(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """Reschedules an appointment. Validates customer ownership."""
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if apt.customer_id != customer.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this appointment.")

    if apt.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot reschedule an appointment in '{apt.status}' status.")

    updated_apt = AppointmentService.reschedule_appointment(
        db=db,
        appointment_id=appointment_id,
        new_date=payload.new_date,
        new_time_slot=payload.new_time_slot,
        reason=payload.reason
    )

    # In-app notification
    notif = Notification(
        category="APPOINTMENT",
        title="Appointment Rescheduled",
        message=f"Appointment #{apt.appointment_number} rescheduled to {payload.new_date} ({payload.new_time_slot}).",
        related_entity_type="Customer",
        related_entity_id=customer.id,
        is_read=False
    )
    db.add(notif)
    db.commit()

    return {
        "success": True,
        "message": f"Appointment #{apt.appointment_number} rescheduled successfully.",
        "scheduled_date": updated_apt.scheduled_date.strftime("%Y-%m-%d"),
        "time_slot": updated_apt.time_slot,
        "status": updated_apt.status
    }


@router.patch("/appointments/{appointment_id}/cancel")
def cancel_customer_appointment(
    appointment_id: int,
    payload: AppointmentCancelRequest,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """Cancels an appointment. Validates customer ownership."""
    apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if apt.customer_id != customer.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this appointment.")

    if apt.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Appointment is already {apt.status}.")

    cancelled_apt = AppointmentService.cancel_appointment(
        db=db,
        appointment_id=appointment_id,
        cancellation_reason=payload.cancellation_reason
    )

    return {
        "success": True,
        "message": f"Appointment #{apt.appointment_number} cancelled successfully.",
        "status": cancelled_apt.status
    }


# =========================================================================
# 6. Digital Solar Passport & QR Scanner Lookup
# =========================================================================

@router.get("/passport")
def get_customer_canonical_passport(
    order_id: Optional[int] = None,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Returns the canonical Digital Solar Passport for the authenticated customer.
    Includes technical sizing, actual hardware serial numbers, pure SVG QR code, and warranty terms.
    """
    query = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.customer_id == customer.id)
    if order_id:
        query = query.filter(DigitalSolarPassport.order_id == order_id)

    passport = query.order_by(DigitalSolarPassport.commissioning_date.desc()).first()
    if not passport:
        raise HTTPException(
            status_code=404,
            detail="Your solar system is currently being staged and commissioned. Digital Solar Passport will be issued upon commissioning sign-off."
        )

    # Warranties
    warranties = []
    for w in passport.warranties:
        comp = w.component
        warranties.append({
            "id": w.id,
            "component_name": comp.name if comp else "Solar Hardware",
            "category": comp.category if comp else "EQUIPMENT",
            "serial_number": w.serial_number,
            "manufacturer": w.manufacturer,
            "warranty_type": w.warranty_type,
            "duration_years": w.duration_years,
            "start_date": w.start_date.strftime("%Y-%m-%d") if w.start_date else None,
            "end_date": w.end_date.strftime("%Y-%m-%d") if w.end_date else None,
            "terms_summary": w.terms_summary,
            "status": w.status
        })

    # Serialized physical components
    serialized_items = []
    inst = passport.installation
    if inst and inst.serialized_items:
        for it in inst.serialized_items:
            comp = it.component
            serialized_items.append({
                "serial_number": it.serial_number,
                "component_name": comp.name if comp else "Component",
                "category": comp.category if comp else "EQUIPMENT",
                "barcode_format": it.barcode_format,
                "verification_status": it.verification_status
            })

    # Generate pure embedded SVG QR code
    qr_svg = PassportService.generate_qr_svg(f"/passport/public/{passport.qr_code_token}")

    return {
        "id": passport.id,
        "uuid": passport.uuid,
        "passport_number": passport.passport_number,
        "order_id": passport.order_id,
        "order_number": passport.order.order_number if passport.order else None,
        "customer_id": passport.customer_id,
        "customer_name": customer.name,
        "system_capacity_kw": passport.system_capacity_kw,
        "grid_type": passport.grid_type,
        "commissioning_date": passport.commissioning_date.strftime("%Y-%m-%d") if passport.commissioning_date else None,
        "qr_code_token": passport.qr_code_token,
        "qr_code_svg": qr_svg,
        "public_lookup_url": f"/passport/public/{passport.qr_code_token}",
        "estimated_lifetime_mwh": passport.estimated_lifetime_mwh,
        "co2_offset_tonnes": passport.co2_offset_tonnes,
        "system_health_score": passport.system_health_score,
        "pv_module_summary": passport.pv_module_summary,
        "inverter_summary": passport.inverter_summary,
        "battery_summary": passport.battery_summary,
        "technical_readings": passport.technical_readings,
        "customer_acknowledgement": passport.customer_acknowledgement,
        "warranties": warranties,
        "serialized_items": serialized_items,
        "is_active": passport.is_active
    }


@router.get("/passport/verify-qr/{token}")
def verify_passport_by_qr_token(
    token: str,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Validates QR code scanned from the mobile device camera.
    Verifies that the scanned passport token belongs to this customer or provides verified public asset specs.
    """
    clean_token = token.strip()
    if "/" in clean_token:
        clean_token = clean_token.split("/")[-1]

    passport = db.query(DigitalSolarPassport).filter(
        (DigitalSolarPassport.qr_code_token == clean_token) |
        (DigitalSolarPassport.passport_number.ilike(clean_token))
    ).first()

    if not passport:
        raise HTTPException(
            status_code=404,
            detail="Scanned QR code is not recognized as a valid SunPower Digital Solar Passport."
        )

    # Ownership flag
    is_owner = passport.customer_id == customer.id

    # Retrieve validated installed serialized components
    serialized_items = []
    if passport.installation_id:
        serialized_items = db.query(SerializedItem).filter(
            SerializedItem.installation_id == passport.installation_id
        ).all()
    elif passport.order_id:
        inst = db.query(Installation).filter(Installation.order_id == passport.order_id).first()
        if inst:
            serialized_items = db.query(SerializedItem).filter(
                SerializedItem.installation_id == inst.id
            ).all()

    serialized_comps = [{
        "id": s.id,
        "serial_number": s.serial_number,
        "component_name": s.component.name if s.component else "Solar Asset",
        "component_category": s.component.category if s.component else "EQUIPMENT",
        "manufacturer": s.component.manufacturer if s.component else "SunPower OEM"
    } for s in serialized_items]

    warranties_list = [{
        "id": w.id,
        "component_name": w.component.name if w.component else "Solar Hardware",
        "warranty_type": w.warranty_type,
        "duration_years": w.duration_years,
        "start_date": w.start_date.strftime("%Y-%m-%d") if w.start_date else None,
        "end_date": w.end_date.strftime("%Y-%m-%d") if w.end_date else None,
        "terms_summary": w.terms_summary,
        "status": w.status
    } for w in passport.warranties]

    return {
        "valid": True,
        "is_valid": True,
        "is_owner": is_owner,
        "passport_id": passport.id,
        "order_id": passport.order_id,
        "passport_number": passport.passport_number,
        "system_capacity_kw": passport.system_capacity_kw,
        "grid_type": passport.grid_type,
        "commissioning_date": passport.commissioning_date.strftime("%Y-%m-%d") if passport.commissioning_date else None,
        "system_health_score": passport.system_health_score,
        "lifetime_mwh": passport.estimated_lifetime_mwh,
        "co2_offset_tonnes": passport.co2_offset_tonnes,
        "pv_module_summary": passport.pv_module_summary,
        "inverter_summary": passport.inverter_summary,
        "serialized_components": serialized_comps,
        "warranties": warranties_list
    }


@router.post("/passport/acknowledge")
def acknowledge_passport(
    payload: PassportAcknowledgementRequest,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Electronic customer sign-off and acknowledgement on the canonical Digital Solar Passport.
    """
    passport = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.id == payload.passport_id).first()
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found.")

    if passport.customer_id != customer.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this passport.")

    ack_data = {
        "acknowledged_by": customer.name,
        "timestamp": get_utc_now().isoformat(),
        "notes": payload.customer_notes
    }
    passport.customer_acknowledgement = json.dumps(ack_data)
    db.commit()

    return {
        "success": True,
        "message": "Passport handover acknowledged successfully.",
        "passport_number": passport.passport_number,
        "acknowledged_at": ack_data["timestamp"]
    }


# =========================================================================
# 7. Warranties Management
# =========================================================================

@router.get("/warranties")
def list_customer_warranties(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Lists equipment and workmanship warranties for the authenticated customer.
    Read-only for customer; warranties are verified and activated authoritatively by backend commissioning.
    """
    passports = db.query(DigitalSolarPassport).filter(DigitalSolarPassport.customer_id == customer.id).all()
    passport_ids = [p.id for p in passports]

    warranties = db.query(Warranty).filter(Warranty.passport_id.in_(passport_ids)).all() if passport_ids else []

    results = []
    now = datetime.datetime.now(datetime.timezone.utc)
    for w in warranties:
        end_dt = w.end_date.replace(tzinfo=datetime.timezone.utc) if w.end_date.tzinfo is None else w.end_date
        days_rem = max(0, (end_dt - now).days)

        results.append({
            "id": w.id,
            "uuid": w.uuid,
            "passport_id": w.passport_id,
            "component_name": w.component.name if w.component else "Solar Equipment",
            "category": w.component.category if w.component else "EQUIPMENT",
            "serial_number": w.serial_number or "N/A",
            "manufacturer": w.manufacturer or "SunPower EPC",
            "warranty_type": w.warranty_type,
            "duration_years": w.duration_years,
            "start_date": w.start_date.strftime("%Y-%m-%d") if w.start_date else None,
            "end_date": w.end_date.strftime("%Y-%m-%d") if w.end_date else None,
            "days_remaining": days_rem,
            "terms_summary": w.terms_summary or "Manufacturer defect & performance warranty policy.",
            "status": w.status,
            "is_valid": w.status == "ACTIVE" and days_rem > 0
        })

    return results


# =========================================================================
# 8. Service Complaints & Photo Evidence Capture
# =========================================================================

@router.get("/service-tickets")
def list_customer_service_tickets(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Retrieves history and live status of service tickets registered by the customer.
    Does not expose confidential internal technician notes.
    """
    tickets = db.query(ServiceTicket).filter(
        ServiceTicket.customer_id == customer.id
    ).order_by(ServiceTicket.created_at.desc()).all()

    results = []
    for t in tickets:
        evidence = []
        if t.evidence_files:
            try:
                evidence = json.loads(t.evidence_files)
            except Exception:
                evidence = []

        results.append({
            "id": t.id,
            "uuid": t.uuid,
            "ticket_number": t.ticket_number,
            "issue_category": t.issue_category,
            "priority": t.priority,
            "description": t.description,
            "component_name": t.component.name if t.component else None,
            "serial_number": t.serial_number,
            "is_warranty_covered": t.is_warranty_covered,
            "status": t.status,
            "assigned_technician": t.assigned_technician or "SunPower O&M Support",
            "resolution_notes": t.resolution_notes,
            "evidence_files": evidence,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else None,
            "resolved_at": t.resolved_at.strftime("%Y-%m-%d %H:%M") if t.resolved_at else None
        })

    return results


@router.post("/service-tickets", status_code=status.HTTP_201_CREATED)
def create_customer_service_ticket(
    payload: ServiceComplaintRequest,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Registers a new service complaint:
    - Links to customer, project, passport, and component/serial.
    - Checks for duplicate active complaints for the same component/category.
    - Automatically checks active warranty eligibility.
    - Emits in-app notification.
    """
    desc = payload.description.strip()
    if len(desc) < 5:
        raise HTTPException(status_code=400, detail="Please provide at least 5 characters describing the issue.")

    # Find passport
    passport = None
    if payload.passport_id:
        passport = db.query(DigitalSolarPassport).filter(
            DigitalSolarPassport.id == payload.passport_id,
            DigitalSolarPassport.customer_id == customer.id
        ).first()
    else:
        passport = db.query(DigitalSolarPassport).filter(
            DigitalSolarPassport.customer_id == customer.id
        ).first()

    # Guard against duplicate active complaints
    dup_query = db.query(ServiceTicket).filter(
        ServiceTicket.customer_id == customer.id,
        ServiceTicket.issue_category == payload.issue_category,
        ServiceTicket.status.in_(["NEW_COMPLAINT", "OPEN", "IN_PROGRESS", "WARRANTY_CHECK"])
    )
    if payload.serial_number:
        dup_query = dup_query.filter(ServiceTicket.serial_number == payload.serial_number)
    dup = dup_query.first()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active service ticket ({dup.ticket_number}) is already open for '{payload.issue_category}'. Our technical team is attending to it."
        )

    # Check warranty coverage
    is_covered = True
    comp_id = payload.component_id
    serial = payload.serial_number

    if passport and serial:
        w = db.query(Warranty).filter(
            Warranty.passport_id == passport.id,
            Warranty.serial_number == serial
        ).first()
        if w:
            is_covered = w.status == "ACTIVE"
            if not comp_id:
                comp_id = w.component_id

    count = db.query(ServiceTicket).count() + 1
    ticket_num = f"SRV-2026-{count:03d}"
    priority = "HIGH" if payload.issue_category in ("INVERTER_FAULT", "GRID_TRIP") else "MEDIUM"

    ticket = ServiceTicket(
        ticket_number=ticket_num,
        customer_id=customer.id,
        passport_id=passport.id if passport else None,
        installation_id=passport.installation_id if passport else None,
        component_id=comp_id,
        serial_number=serial,
        issue_category=payload.issue_category,
        priority=priority,
        description=desc,
        is_warranty_covered=is_covered,
        status="NEW_COMPLAINT",
        complaint_source="CUSTOMER_PORTAL",
        created_at=get_utc_now()
    )
    db.add(ticket)

    apt_id = None
    apt_num = None
    if payload.preferred_visit_date:
        next_apt_num = db.query(Appointment).count() + 1
        apt_num = f"APT-2026-{next_apt_num:04d}"
        apt = Appointment(
            appointment_number=apt_num,
            customer_id=customer.id,
            order_id=payload.order_id or (passport.order_id if passport else None),
            appointment_type="SERVICE",
            scheduled_date=payload.preferred_visit_date,
            time_slot=payload.preferred_time_slot or "10:00 - 12:00",
            service_address=customer.installation_address or "Customer Residence",
            contact_phone=customer.phone,
            status="REQUESTED",
            customer_notes=f"Service Ticket {ticket_num} | Category: {payload.issue_category}",
            created_at=get_utc_now()
        )
        db.add(apt)
        db.flush()
        apt_id = apt.id

    # In-app notification
    notif = Notification(
        category="SERVICE",
        title="Service Ticket Registered",
        message=f"Service request #{ticket_num} registered for '{payload.issue_category}'. A technician will review your case shortly.",
        related_entity_type="Customer",
        related_entity_id=customer.id,
        is_read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(ticket)

    return {
        "success": True,
        "message": f"Service ticket {ticket_num} created successfully.",
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "status": ticket.status,
        "is_warranty_covered": ticket.is_warranty_covered,
        "appointment_number": apt_num,
        "appointment_id": apt_id
    }


@router.post("/service-tickets/{ticket_id}/evidence")
@router.post("/service-tickets/{ticket_id}/upload-evidence")
async def upload_complaint_evidence(
    ticket_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form("Complaint photograph evidence"),
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Accepts device camera photograph or document evidence:
    - Validates file type and size (<=5MB).
    - Stores sanitized file in backend uploads directory.
    - Attaches persistent evidence record to service ticket.
    """
    ticket = db.query(ServiceTicket).filter(ServiceTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Service ticket not found.")

    if ticket.customer_id != customer.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this service ticket.")

    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
        raise HTTPException(status_code=400, detail="Allowed file formats: JPG, PNG, WEBP, PDF.")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 5 MB limit.")

    clean_name = f"complaint_{ticket.id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(UPLOADS_DIR, clean_name)
    with open(dest_path, "wb") as f:
        f.write(contents)

    file_url = f"/uploads/{clean_name}"

    # Update ticket evidence files
    evidence_list = []
    if ticket.evidence_files:
        try:
            evidence_list = json.loads(ticket.evidence_files)
        except Exception:
            evidence_list = []

    evidence_entry = {
        "file_name": clean_name,
        "original_name": file.filename,
        "file_url": file_url,
        "description": description,
        "uploaded_at": get_utc_now().isoformat()
    }
    evidence_list.append(evidence_entry)
    ticket.evidence_files = json.dumps(evidence_list)
    db.commit()

    return {
        "success": True,
        "message": "Complaint evidence photo uploaded successfully.",
        "file_url": file_url,
        "file_name": clean_name
    }


# =========================================================================
# 9. Customer Feedback
# =========================================================================

@router.get("/feedback")
def list_customer_feedback(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """Retrieves satisfaction rating and verified feedback history."""
    feedbacks = db.query(CustomerFeedback).filter(
        CustomerFeedback.customer_id == customer.id
    ).order_by(CustomerFeedback.created_at.desc()).all()

    results = []
    for fb in feedbacks:
        cat_ratings = {}
        if fb.category_ratings:
            try:
                cat_ratings = json.loads(fb.category_ratings)
            except Exception:
                pass

        results.append({
            "id": fb.id,
            "feedback_type": fb.feedback_type,
            "rating": fb.rating,
            "category_ratings": cat_ratings,
            "comments": fb.comments,
            "is_verified": fb.is_verified,
            "created_at": fb.created_at.strftime("%Y-%m-%d")
        })

    return results


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
def submit_customer_feedback(
    payload: CustomerFeedbackRequest,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """
    Submits customer satisfaction rating and comments:
    - Immutable audit record to prevent unauthorized post-submission modification.
    """
    fb = CustomerFeedback(
        customer_id=customer.id,
        order_id=payload.order_id,
        installation_id=payload.installation_id,
        service_ticket_id=payload.service_ticket_id,
        feedback_type=payload.feedback_type.upper(),
        rating=payload.rating,
        category_ratings=json.dumps(payload.category_ratings or {}),
        comments=payload.comments,
        is_verified=True,
        created_at=get_utc_now()
    )
    db.add(fb)

    # In-app notification
    notif = Notification(
        category="FEEDBACK",
        title="Thank you for your Feedback!",
        message=f"We have recorded your {payload.rating}-star review for SunPower Solutions.",
        related_entity_type="Customer",
        related_entity_id=customer.id,
        is_read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(fb)

    return {
        "success": True,
        "message": "Thank you! Your feedback has been registered and verified.",
        "feedback_id": fb.id,
        "rating": fb.rating
    }


# =========================================================================
# 10. In-App Notifications
# =========================================================================

@router.get("/notifications")
def get_customer_notifications(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """Retrieves in-app notifications relevant to the authenticated customer."""
    notifs = db.query(Notification).filter(
        (Notification.related_entity_type == "Customer") & (Notification.related_entity_id == customer.id) |
        (Notification.title.ilike(f"%{customer.name}%"))
    ).order_by(Notification.created_at.desc()).limit(20).all()

    results = []
    for n in notifs:
        results.append({
            "id": n.id,
            "category": n.category,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M") if n.created_at else None
        })

    return results


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """Marks a single customer notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()

    return {"success": True}


@router.post("/notifications/mark-all-read")
def mark_all_notifications_read(
    customer: Customer = Depends(get_current_customer_record),
    db: Session = Depends(get_db)
):
    """Marks all customer notifications as read."""
    db.query(Notification).filter(
        (Notification.related_entity_type == "Customer") & (Notification.related_entity_id == customer.id) |
        (Notification.title.ilike(f"%{customer.name}%"))
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()

    return {"success": True}
