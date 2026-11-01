import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, Customer, Quotation, Payment, ProjectExpense, Installation, BillOfMaterials, User
from app.schemas.entities import OrderOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/orders", tags=["Orders"], dependencies=[Depends(get_current_user)])


class PaymentCreateRequest(BaseModel):
    amount_inr: float = Field(..., gt=0, description="Payment amount in INR")
    milestone: str = "ADVANCE"  # ADVANCE, STRUCTURE_DELIVERY, INSTALLATION_COMPLETE, COMMISSIONING, FINAL_BALANCE
    payment_mode: str = "BANK_TRANSFER"  # BANK_TRANSFER, UPI, CHEQUE, NEFT_RTGS, CASH
    transaction_reference: Optional[str] = None
    paid_at: Optional[datetime.datetime] = None


class ExpenseCreateRequest(BaseModel):
    category: str  # LABOUR, TRANSPORT, COMPONENTS_BOS, PERMIT_DISCOM, HARDWARE_FASTENERS, MISCELLANEOUS
    amount_inr: float = Field(..., gt=0, description="Expense amount in INR")
    description: str
    recorded_at: Optional[datetime.datetime] = None


@router.get("", response_model=List[OrderOut])
def list_orders(
    skip: int = 0,
    limit: int = 100,
    stage: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER":
        query = query.filter(Order.customer_id == current_user.customer_id)
    if stage and stage.upper() != "ALL":
        query = query.filter(Order.stage == stage.upper())

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for ord in orders:
        out = OrderOut.model_validate(ord)
        if ord.customer:
            out.customer_name = ord.customer.name
            out.customer_phone = ord.customer.phone
            out.customer_city = ord.customer.city
        if ord.quotation:
            out.quotation_number = ord.quotation.quotation_number
            out.system_capacity_kw = ord.quotation.system_capacity_kw
            if ord.quotation.enquiry:
                out.enquiry_number = ord.quotation.enquiry.enquiry_number
        results.append(out)
    return results


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    user_role = (current_user.role or "").upper()
    if user_role == "CUSTOMER" and order.customer_id != current_user.customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot access another customer's order."
        )

    out = OrderOut.model_validate(order)
    if order.customer:
        out.customer_name = order.customer.name
        out.customer_phone = order.customer.phone
        out.customer_city = order.customer.city
    if order.quotation:
        out.quotation_number = order.quotation.quotation_number
        out.system_capacity_kw = order.quotation.system_capacity_kw
        if order.quotation.enquiry:
            out.enquiry_number = order.quotation.enquiry.enquiry_number
    return out


# -------------------------------------------------------------------------
# Feature 4: Financial Summaries, Milestone Payments & Project Expenses
# -------------------------------------------------------------------------
@router.get("/{order_id}/financials")
def get_order_financials(order_id: int, db: Session = Depends(get_db)):
    """
    Project-level comprehensive financial summary:
    Contract Value, Milestone Payments, Outstanding Balance, Actual Recorded Expenses,
    BOM Material Cost, Contribution Profit, and Ind AS 115 Recognition status.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    contract_value_inr = round(order.total_contract_paise / 100, 2)

    # Payments Collected
    completed_payments = [p for p in order.payments if p.status == "COMPLETED"]
    if completed_payments:
        payments_received_paise = sum(p.amount_paise for p in completed_payments)
    else:
        payments_received_paise = order.advance_received_paise or 0
    payments_received_inr = round(payments_received_paise / 100, 2)
    outstanding_balance_inr = round(max(0.0, contract_value_inr - payments_received_inr), 2)

    # Costs
    bom_cogs_paise = order.bom.total_cost_paise if order.bom else 0
    bom_cogs_inr = round(bom_cogs_paise / 100, 2)

    expenses_list = []
    for e in order.expenses:
        expenses_list.append({
            "id": e.id,
            "uuid": e.uuid,
            "category": e.category,
            "amount_inr": round(e.amount_paise / 100, 2),
            "description": e.description,
            "recorded_at": e.recorded_at.strftime("%Y-%m-%d %H:%M") if e.recorded_at else None
        })

    total_expenses_paise = sum(e.amount_paise for e in order.expenses)
    total_expenses_inr = round(total_expenses_paise / 100, 2)

    total_recorded_costs_inr = round(bom_cogs_inr + total_expenses_inr, 2)

    # Profitability Forecast (Contract-level completion view)
    estimated_project_profit_inr = round(contract_value_inr - total_recorded_costs_inr, 2)
    estimated_margin_pct = round((estimated_project_profit_inr / contract_value_inr * 100), 1) if contract_value_inr > 0 else 0.0

    # Ind AS 115 Revenue Recognition Handover Standard
    is_commissioned = (
        any(i.status in ("COMMISSIONED", "COMPLETED") for i in order.installations) or
        order.stage in ("COMMISSIONED", "COMPLETED")
    )
    if is_commissioned:
        recognized_revenue_inr = contract_value_inr
        contribution_profit_inr = round(recognized_revenue_inr - total_recorded_costs_inr, 2)
        contribution_margin_pct = round((contribution_profit_inr / recognized_revenue_inr * 100), 2) if recognized_revenue_inr > 0 else 0.0
        financial_status = "REVENUE_RECOGNIZED_FULL"
    else:
        recognized_revenue_inr = 0.0
        contribution_profit_inr = round(0.0 - total_recorded_costs_inr, 2)
        contribution_margin_pct = None  # None/null prevents distorted negative margin on WIP
        financial_status = "REVENUE_DEFERRED_WIP"

    payments_list = []
    for p in order.payments:
        payments_list.append({
            "id": p.id,
            "uuid": p.uuid,
            "payment_number": p.payment_number,
            "amount_inr": round(p.amount_paise / 100, 2),
            "milestone": p.milestone,
            "payment_mode": p.payment_mode,
            "transaction_reference": p.transaction_reference,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M") if p.paid_at else None,
            "status": p.status
        })

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "customer_name": order.customer.name if order.customer else "N/A",
        "customer_phone": order.customer.phone if order.customer else None,
        "stage": order.stage,
        "is_commissioned": is_commissioned,
        "financial_status": financial_status,
        "contract_value_inr": contract_value_inr,
        "payments_received_inr": payments_received_inr,
        "outstanding_balance_inr": outstanding_balance_inr,
        "payment_status": order.payment_status or ("PAID" if outstanding_balance_inr == 0 else "PARTIAL"),
        "bom_material_cogs_inr": bom_cogs_inr,
        "recorded_expenses_inr": total_expenses_inr,
        "total_recorded_costs_inr": total_recorded_costs_inr,
        "estimated_project_profit_inr": estimated_project_profit_inr,
        "estimated_margin_pct": estimated_margin_pct,
        "recognized_revenue_inr": recognized_revenue_inr,
        "contribution_profit_inr": contribution_profit_inr,
        "contribution_margin_pct": contribution_margin_pct,
        "payments": payments_list,
        "expenses": expenses_list
    }


@router.post("/{order_id}/payments", status_code=status.HTTP_201_CREATED)
def record_order_payment(
    order_id: int,
    payload: PaymentCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Record an actual milestone payment for an order and update order payment status atomically.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    amount_paise = int(round(payload.amount_inr * 100))
    if amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    next_count = db.query(Payment).filter(Payment.order_id == order.id).count() + 1
    payment_number = f"PAY-2026-{order.id:03d}-{next_count:02d}"

    payment = Payment(
        payment_number=payment_number,
        order_id=order.id,
        amount_paise=amount_paise,
        milestone=payload.milestone.upper(),
        payment_mode=payload.payment_mode.upper(),
        transaction_reference=payload.transaction_reference or f"TXN-{payment_number}",
        paid_at=payload.paid_at or datetime.datetime.utcnow(),
        status="COMPLETED"
    )
    db.add(payment)
    db.flush()

    # Re-sum all completed payments to ensure consistent balance without double-counting
    total_completed_paise = sum(p.amount_paise for p in order.payments if p.status == "COMPLETED")
    order.advance_received_paise = total_completed_paise

    if total_completed_paise >= order.total_contract_paise:
        order.payment_status = "PAID"
    elif total_completed_paise > 0:
        order.payment_status = "PARTIAL"
    else:
        order.payment_status = "PENDING"

    db.commit()
    db.refresh(payment)

    return {
        "success": True,
        "message": f"Payment of ₹{payload.amount_inr:,.2f} recorded successfully ({payment_number}).",
        "payment": {
            "id": payment.id,
            "payment_number": payment.payment_number,
            "amount_inr": round(payment.amount_paise / 100, 2),
            "milestone": payment.milestone,
            "payment_mode": payment.payment_mode,
            "transaction_reference": payment.transaction_reference,
            "paid_at": payment.paid_at.strftime("%Y-%m-%d %H:%M")
        },
        "order_payment_status": order.payment_status,
        "total_payments_received_inr": round(order.advance_received_paise / 100, 2),
        "outstanding_balance_inr": max(0.0, round((order.total_contract_paise - order.advance_received_paise) / 100, 2))
    }


@router.get("/{order_id}/payments")
def list_order_payments(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return [
        {
            "id": p.id,
            "uuid": p.uuid,
            "payment_number": p.payment_number,
            "amount_inr": round(p.amount_paise / 100, 2),
            "milestone": p.milestone,
            "payment_mode": p.payment_mode,
            "transaction_reference": p.transaction_reference,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M") if p.paid_at else None,
            "status": p.status
        }
        for p in order.payments
    ]


@router.post("/{order_id}/expenses", status_code=status.HTTP_201_CREATED)
def record_project_expense(
    order_id: int,
    payload: ExpenseCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Record an actual project expense linked to this EPC contract.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    amount_paise = int(round(payload.amount_inr * 100))
    if amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than zero.")

    expense = ProjectExpense(
        order_id=order.id,
        category=payload.category.upper(),
        amount_paise=amount_paise,
        description=payload.description,
        recorded_at=payload.recorded_at or datetime.datetime.utcnow()
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    return {
        "success": True,
        "message": f"Expense of ₹{payload.amount_inr:,.2f} under {payload.category} recorded successfully.",
        "expense": {
            "id": expense.id,
            "uuid": expense.uuid,
            "category": expense.category,
            "amount_inr": round(expense.amount_paise / 100, 2),
            "description": expense.description,
            "recorded_at": expense.recorded_at.strftime("%Y-%m-%d %H:%M")
        }
    }


@router.get("/{order_id}/expenses")
def list_order_expenses(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return [
        {
            "id": e.id,
            "uuid": e.uuid,
            "category": e.category,
            "amount_inr": round(e.amount_paise / 100, 2),
            "description": e.description,
            "recorded_at": e.recorded_at.strftime("%Y-%m-%d %H:%M") if e.recorded_at else None
        }
        for e in order.expenses
    ]


