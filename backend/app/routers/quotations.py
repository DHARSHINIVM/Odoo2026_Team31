import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Quotation, QuotationItem, SiteSurvey, Enquiry, Customer, Package, Order, Payment
from app.schemas.entities import QuotationCreate, QuotationOut, QuotationItemOut, OrderOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/quotations", tags=["Quotations"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[QuotationOut])
def list_quotations(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Quotation)
    if status and status.upper() != "ALL":
        query = query.filter(Quotation.status == status.upper())

    quotations = query.order_by(Quotation.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for q in quotations:
        out = QuotationOut.model_validate(q)
        if q.customer:
            out.customer_name = q.customer.name
            out.customer_phone = q.customer.phone
            out.customer_email = q.customer.email
            out.customer_address = q.customer.address
            out.customer_city = q.customer.city
        if q.enquiry:
            out.enquiry_number = q.enquiry.enquiry_number
        if q.order:
            out.order_id = q.order.id
            out.order_number = q.order.order_number
        out.items = [QuotationItemOut.model_validate(item) for item in q.items]
        results.append(out)
    return results


@router.post("", response_model=QuotationOut, status_code=status.HTTP_201_CREATED)
def create_quotation(payload: QuotationCreate, db: Session = Depends(get_db)):
    # 1. Validate Enquiry
    enquiry = db.query(Enquiry).filter(Enquiry.id == payload.enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=400, detail="Invalid enquiry_id: Enquiry does not exist")

    # 2. BUSINESS RULE ENFORCEMENT: Associated Site Survey MUST be APPROVED
    survey = db.query(SiteSurvey).filter(SiteSurvey.id == payload.survey_id).first()
    if not survey:
        raise HTTPException(status_code=400, detail="Invalid survey_id: Site survey does not exist")
    if survey.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"Business Rule Violation: Quotations cannot be created until the associated site survey is approved. Current survey status is '{survey.status}'."
        )

    # 3. Derive customer_id
    customer_id = payload.customer_id or enquiry.customer_id

    # 4. Generate Quotation Number
    count = db.query(Quotation).count() + 1
    quotation_number = f"QT-2026-{count:03d}"

    # Default terms and conditions if not provided
    default_terms = (
        "1. Price validity: 30 days from proposal issue date.\n"
        "2. Payment Schedule: 20% advance upon order confirmation, 60% upon material dispatch, 20% after commissioning.\n"
        "3. Equipment Warranty: 25 years linear performance on solar PV modules, 10 years on inverter, 5 years comprehensive EPC workmanship.\n"
        "4. Subsidy: PM Surya Ghar central subsidy is credited directly to customer bank account post-commissioning."
    )

    valid_until = datetime.datetime.utcnow() + datetime.timedelta(days=payload.validity_days)

    quotation = Quotation(
        quotation_number=quotation_number,
        enquiry_id=payload.enquiry_id,
        survey_id=payload.survey_id,
        package_id=payload.package_id,
        customer_id=customer_id,
        system_capacity_kw=payload.system_capacity_kw,
        gross_amount_paise=payload.gross_amount_paise,
        subsidy_amount_paise=payload.subsidy_amount_paise,
        discount_paise=payload.discount_paise,
        tax_amount_paise=payload.tax_amount_paise,
        net_amount_paise=payload.net_amount_paise,
        estimated_annual_units_kwh=payload.estimated_annual_units_kwh or (payload.system_capacity_kw * 1500.0),
        estimated_payback_years=payload.estimated_payback_years,
        validity_days=payload.validity_days,
        valid_until=valid_until,
        terms_and_conditions=payload.terms_and_conditions or default_terms,
        notes=payload.notes,
        status="SHARED"
    )
    db.add(quotation)
    db.flush()

    # 5. Add Quotation Items
    for item in payload.items:
        q_item = QuotationItem(
            quotation_id=quotation.id,
            component_id=item.component_id,
            item_description=item.item_description,
            quantity=item.quantity,
            unit_price_paise=item.unit_price_paise,
            total_price_paise=item.total_price_paise
        )
        db.add(q_item)

    # 6. Advance enquiry status to QUOTED
    enquiry.status = "QUOTED"

    db.commit()
    db.refresh(quotation)

    out = QuotationOut.model_validate(quotation)
    if quotation.customer:
        out.customer_name = quotation.customer.name
        out.customer_phone = quotation.customer.phone
        out.customer_email = quotation.customer.email
        out.customer_address = quotation.customer.address
        out.customer_city = quotation.customer.city
    out.enquiry_number = enquiry.enquiry_number
    out.items = [QuotationItemOut.model_validate(it) for it in quotation.items]
    return out


@router.get("/{quotation_id}", response_model=QuotationOut)
def get_quotation(quotation_id: int, db: Session = Depends(get_db)):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    out = QuotationOut.model_validate(quotation)
    if quotation.customer:
        out.customer_name = quotation.customer.name
        out.customer_phone = quotation.customer.phone
        out.customer_email = quotation.customer.email
        out.customer_address = quotation.customer.address
        out.customer_city = quotation.customer.city
    if quotation.enquiry:
        out.enquiry_number = quotation.enquiry.enquiry_number
    if quotation.order:
        out.order_id = quotation.order.id
        out.order_number = quotation.order.order_number
    out.items = [QuotationItemOut.model_validate(it) for it in quotation.items]
    return out


@router.post("/{quotation_id}/accept", response_model=OrderOut)
def accept_quotation_and_create_order(quotation_id: int, db: Session = Depends(get_db)):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Mark quotation as ACCEPTED
    quotation.status = "ACCEPTED"

    # Prevent duplicate orders from the same quotation
    existing_order = db.query(Order).filter(Order.quotation_id == quotation_id).first()
    if existing_order:
        out = OrderOut.model_validate(existing_order)
        if existing_order.customer:
            out.customer_name = existing_order.customer.name
            out.customer_phone = existing_order.customer.phone
            out.customer_city = existing_order.customer.city
        out.system_capacity_kw = quotation.system_capacity_kw
        out.quotation_number = quotation.quotation_number
        if quotation.enquiry:
            out.enquiry_number = quotation.enquiry.enquiry_number
        return out

    # Generate Order
    order_count = db.query(Order).count() + 1
    order_number = f"ORD-2026-{order_count:03d}"

    advance_req = int(round(quotation.net_amount_paise * 0.20))

    order = Order(
        order_number=order_number,
        quotation_id=quotation.id,
        customer_id=quotation.customer_id,
        total_contract_paise=quotation.net_amount_paise,
        advance_required_paise=advance_req,
        advance_received_paise=advance_req,  # Default recorded advance upon order confirmation
        payment_status="PARTIAL",
        stage="CONFIRMED",
        installation_target_date=datetime.datetime.utcnow() + datetime.timedelta(days=21)
    )
    db.add(order)
    db.flush()

    # Record advance payment in financial ledger
    pay_count = db.query(Payment).count() + 1
    payment = Payment(
        payment_number=f"PAY-2026-{pay_count:03d}",
        order_id=order.id,
        amount_paise=advance_req,
        milestone="ADVANCE",
        payment_mode="BANK_TRANSFER",
        transaction_reference=f"ADV-TXN-{order.order_number}",
        status="COMPLETED"
    )
    db.add(payment)

    # Advance enquiry status to ORDER_PLACED
    if quotation.enquiry:
        quotation.enquiry.status = "ORDER_PLACED"

    db.commit()
    db.refresh(order)

    out = OrderOut.model_validate(order)
    if order.customer:
        out.customer_name = order.customer.name
        out.customer_phone = order.customer.phone
        out.customer_city = order.customer.city
    out.system_capacity_kw = quotation.system_capacity_kw
    out.quotation_number = quotation.quotation_number
    if quotation.enquiry:
        out.enquiry_number = quotation.enquiry.enquiry_number
    return out


@router.post("/{quotation_id}/reject", response_model=QuotationOut)
def reject_quotation(quotation_id: int, db: Session = Depends(get_db)):
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    quotation.status = "REJECTED"
    db.commit()
    db.refresh(quotation)

    out = QuotationOut.model_validate(quotation)
    if quotation.customer:
        out.customer_name = quotation.customer.name
        out.customer_phone = quotation.customer.phone
        out.customer_city = quotation.customer.city
    return out

