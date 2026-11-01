import datetime
import io
import csv
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from app.database import get_db
from app.models import (
    Order, Quotation, Customer, Enquiry, SiteSurvey, ProjectExpense, Payment,
    WarehouseStock, Dispatch, Installation, ServiceTicket, DigitalSolarPassport,
    BillOfMaterials, Component, Warranty, Warehouse, InventoryTransfer, User
)
from app.services.credibility_service import CredibilityService
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analytics", tags=["Financial & Operational Analytics"], dependencies=[Depends(get_current_user)])


@router.get("/financial")
def get_financial_analytics(db: Session = Depends(get_db)):
    """
    Real database financial metrics:
    - Total contract value (confirmed orders only; unconfirmed quotes strictly excluded).
    - Advance payments received.
    - Outstanding receivables.
    - Total project expenses.
    - Estimated project margin.
    - Monthly revenue trends.
    - Value by system capacity.
    - Payment status distribution.
    """
    confirmed_orders = db.query(Order).all()

    # 1. Total confirmed contract value (in INR)
    total_contract_paise = sum(o.total_contract_paise for o in confirmed_orders)
    total_contract_inr = round(total_contract_paise / 100, 2)

    # 2. Advance payments received
    advance_received_paise = sum(o.advance_received_paise for o in confirmed_orders)
    advance_received_inr = round(advance_received_paise / 100, 2)

    # 3. Outstanding receivables
    outstanding_receivables_inr = round(max(0, total_contract_inr - advance_received_inr), 2)

    # 4. Total project expenses
    expenses = db.query(ProjectExpense).all()
    total_expenses_paise = sum(e.amount_paise for e in expenses)
    total_expenses_inr = round(total_expenses_paise / 100, 2)

    # 5. Estimated material costs from BOMs
    boms = db.query(BillOfMaterials).all()
    total_bom_paise = sum(b.total_cost_paise for b in boms)
    total_bom_inr = round(total_bom_paise / 100, 2)

    # 6. Estimated Gross EPC Margin (Contract-level completion forecast)
    total_costs_inr = total_expenses_inr + total_bom_inr
    estimated_margin_inr = round(total_contract_inr - total_costs_inr, 2)
    margin_pct = round((estimated_margin_inr / total_contract_inr * 100), 1) if total_contract_inr > 0 else 0.0

    # 6b. Recognized EPC Revenue & Margin (Completed-Contract Handover standard)
    commissioned_orders = [
        o for o in confirmed_orders
        if (any(i.status in ("COMMISSIONED", "COMPLETED") for i in o.installations) or o.stage in ("COMMISSIONED", "COMPLETED"))
    ]
    recognized_revenue_inr = round(sum(o.total_contract_paise for o in commissioned_orders) / 100, 2)
    rec_cogs_inr = round(sum(o.bom.total_cost_paise for o in commissioned_orders if o.bom) / 100, 2)
    rec_expenses_inr = round(sum(sum(e.amount_paise for e in o.expenses) for o in commissioned_orders) / 100, 2)
    rec_costs_inr = round(rec_cogs_inr + rec_expenses_inr, 2)
    recognized_profit_inr = round(recognized_revenue_inr - rec_costs_inr, 2) if recognized_revenue_inr > 0 else 0.0
    recognized_margin_pct = round((recognized_profit_inr / recognized_revenue_inr * 100), 1) if recognized_revenue_inr > 0 else None

    # 7. Revenue by month
    monthly_revenue_map: Dict[str, float] = {}
    for o in confirmed_orders:
        month_str = o.created_at.strftime("%b %Y")
        amt = round(o.total_contract_paise / 100, 2)
        monthly_revenue_map[month_str] = monthly_revenue_map.get(month_str, 0.0) + amt

    # Ensure a continuous 6-month timeline for clean charts
    now = datetime.datetime.utcnow()
    revenue_by_month = []
    for i in range(5, -1, -1):
        m_date = now - datetime.timedelta(days=i * 30)
        m_label = m_date.strftime("%b %Y")
        val = monthly_revenue_map.get(m_label, 0.0)
        revenue_by_month.append({
            "month": m_label,
            "revenue_inr": val,
            "display": f"₹{(val/100000):.1f}L" if val > 0 else "₹0"
        })

    # 8. Order value by system capacity
    capacity_stats = {
        "Small (< 5 kW)": {"value": 0.0, "count": 0},
        "Standard (5 - 10 kW)": {"value": 0.0, "count": 0},
        "Commercial (> 10 kW)": {"value": 0.0, "count": 0}
    }
    for o in confirmed_orders:
        cap = o.quotation.system_capacity_kw if o.quotation else 5.0
        val = round(o.total_contract_paise / 100, 2)
        if cap < 5.0:
            bucket = "Small (< 5 kW)"
        elif cap <= 10.0:
            bucket = "Standard (5 - 10 kW)"
        else:
            bucket = "Commercial (> 10 kW)"
        capacity_stats[bucket]["value"] += val
        capacity_stats[bucket]["count"] += 1

    order_value_by_capacity = [
        {"capacity_tier": k, "order_value_inr": v["value"], "order_count": v["count"]}
        for k, v in capacity_stats.items()
    ]

    # 9. Payment Status Distribution
    payment_statuses = {}
    for o in confirmed_orders:
        st = o.payment_status or "PENDING"
        payment_statuses[st] = payment_statuses.get(st, 0) + 1

    payment_distribution = [
        {"status": k, "count": v} for k, v in payment_statuses.items()
    ]

    # 10. Expense Category Breakdown
    expense_categories = {}
    for e in expenses:
        cat = e.category
        expense_categories[cat] = expense_categories.get(cat, 0.0) + round(e.amount_paise / 100, 2)

    expense_breakdown = [
        {"category": k.replace('_', ' ') if hasattr(k, 'replace') else k, "amount_inr": v} for k, v in expense_categories.items()
    ]

    return {
        "total_contract_value_inr": total_contract_inr,
        "advance_payments_received_inr": advance_received_inr,
        "outstanding_receivables_inr": outstanding_receivables_inr,
        "total_project_expenses_inr": total_expenses_inr,
        "estimated_cogs_inr": total_bom_inr,
        "estimated_project_margin_inr": estimated_margin_inr,
        "margin_percentage": margin_pct,
        "recognized_revenue_inr": recognized_revenue_inr,
        "recognized_cogs_inr": rec_cogs_inr,
        "recognized_expenses_inr": rec_expenses_inr,
        "recognized_costs_inr": rec_costs_inr,
        "recognized_profit_inr": recognized_profit_inr,
        "recognized_margin_pct": recognized_margin_pct,
        "commissioned_orders_count": len(commissioned_orders),
        "confirmed_orders_count": len(confirmed_orders),
        "revenue_by_month": revenue_by_month,
        "order_value_by_capacity": order_value_by_capacity,
        "payment_status_distribution": payment_distribution,
        "expense_category_breakdown": [
            {"category": k.replace("_", " "), "amount_inr": v} for k, v in expense_categories.items()
        ]
    }


@router.get("/operational")
def get_operational_analytics(db: Session = Depends(get_db)):
    """
    Real database operational conversion and efficiency metrics:
    - Funnel conversion rates.
    - Inventory utilization.
    - Dispatch breakdown.
    - Installation progress.
    - Service ticket backlog.
    """
    total_enquiries = db.query(Enquiry).count()
    total_surveys = db.query(SiteSurvey).count()
    approved_surveys = db.query(SiteSurvey).filter(SiteSurvey.status == "APPROVED").count()

    total_quotations = db.query(Quotation).count()
    accepted_quotations = db.query(Quotation).filter(Quotation.status == "ACCEPTED").count()

    confirmed_orders = db.query(Order).count()

    # Conversion Rates
    enquiry_conversion_rate = round((confirmed_orders / total_enquiries * 100), 1) if total_enquiries > 0 else 0.0
    survey_approval_rate = round((approved_surveys / total_surveys * 100), 1) if total_surveys > 0 else 0.0
    quotation_acceptance_rate = round((accepted_quotations / total_quotations * 100), 1) if total_quotations > 0 else 0.0

    # Orders awaiting inventory allocation (CONFIRMED or BOM_GENERATED)
    orders_awaiting_allocation = db.query(Order).filter(
        Order.stage.in_(["CONFIRMED", "BOM_GENERATED"])
    ).count()

    # Inventory Utilization
    stocks = db.query(WarehouseStock).all()
    total_on_hand = sum(s.qty_on_hand for s in stocks)
    total_reserved = sum(s.qty_reserved for s in stocks)
    inventory_utilization_pct = round((total_reserved / total_on_hand * 100), 1) if total_on_hand > 0 else 0.0

    # Dispatch status breakdown
    dispatches = db.query(Dispatch).all()
    dispatch_breakdown = {
        "PREPARING": 0,
        "IN_TRANSIT": 0,
        "DELIVERED": 0,
        "RETURNED": 0
    }
    for d in dispatches:
        dispatch_breakdown[d.status] = dispatch_breakdown.get(d.status, 0) + 1

    # Installation progress breakdown
    installations = db.query(Installation).all()
    installation_breakdown = {
        "SCHEDULED": 0,
        "IN_PROGRESS": 0,
        "COMMISSIONED": 0
    }
    for i in installations:
        installation_breakdown[i.status] = installation_breakdown.get(i.status, 0) + 1

    commissioned_systems = installation_breakdown.get("COMMISSIONED", 0)

    # Open service tickets
    open_tickets = db.query(ServiceTicket).filter(
        ServiceTicket.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"])
    ).count()

    # Complete Sales-to-Commissioning Funnel
    funnel = [
        {"stage": "1. Inbound Leads", "count": total_enquiries, "dropoff_pct": 0.0},
        {"stage": "2. Surveys Approved", "count": approved_surveys, "dropoff_pct": round(((total_enquiries - approved_surveys) / total_enquiries * 100), 1) if total_enquiries else 0},
        {"stage": "3. Quotes Accepted", "count": accepted_quotations, "dropoff_pct": round(((approved_surveys - accepted_quotations) / approved_surveys * 100), 1) if approved_surveys else 0},
        {"stage": "4. Orders Confirmed", "count": confirmed_orders, "dropoff_pct": round(((accepted_quotations - confirmed_orders) / accepted_quotations * 100), 1) if accepted_quotations else 0},
        {"stage": "5. Commissioned", "count": commissioned_systems, "dropoff_pct": round(((confirmed_orders - commissioned_systems) / confirmed_orders * 100), 1) if confirmed_orders else 0},
    ]

    return {
        "enquiry_conversion_rate": enquiry_conversion_rate,
        "survey_approval_rate": survey_approval_rate,
        "quotation_acceptance_rate": quotation_acceptance_rate,
        "confirmed_orders": confirmed_orders,
        "orders_awaiting_allocation": orders_awaiting_allocation,
        "inventory_utilization_pct": inventory_utilization_pct,
        "total_stock_on_hand": total_on_hand,
        "total_stock_reserved": total_reserved,
        "dispatch_status": dispatch_breakdown,
        "installation_progress": installation_breakdown,
        "commissioned_systems": commissioned_systems,
        "open_service_tickets": open_tickets,
        "funnel_data": funnel
    }


@router.get("/installations/profitability")
def get_all_installations_profitability(db: Session = Depends(get_db)):
    """
    Module 10 / Issue 3: Standardized Installation-Level Contribution Profitability Audit
    Formula:
      Contribution Profit = Recognized Revenue - Material COGS - Technician Labour - Direct Expenses
      Contribution Margin (%) = (Contribution Profit / Recognized Revenue) * 100

    Revenue Recognition Standard (Ind AS 115 / Completed EPC Handover):
      - Commissioned / Completed: 100% of Contract Value is recognized as revenue.
      - Work-in-Progress (WIP): 0.0 revenue recognized. Customer advances are deferred contract liabilities.
        Margin is returned as None (null in JSON) to prevent division by zero or distorted negative percentages.
    """
    orders = db.query(Order).order_by(Order.id.asc()).all()
    results = []

    total_contract_paise = 0
    total_payments_paise = 0
    total_recognized_rev_paise = 0
    total_cogs_paise = 0
    total_labour_paise = 0
    total_expenses_paise = 0

    rec_rev_sum_paise = 0
    rec_costs_sum_paise = 0

    for o in orders:
        total_contract_paise += o.total_contract_paise

        # Quotation Value
        quotation_value_inr = round(o.quotation.net_amount_paise / 100, 2) if o.quotation else None
        contract_value_inr = round(o.total_contract_paise / 100, 2)

        # Payments Collected (avoid duplicate counting between payments table and advance_received_paise)
        completed_payments_paise = sum(p.amount_paise for p in o.payments if p.status == "COMPLETED")
        if completed_payments_paise > 0:
            payments_received_paise = completed_payments_paise
        else:
            payments_received_paise = o.advance_received_paise or 0

        payments_received_inr = round(payments_received_paise / 100, 2)
        total_payments_paise += payments_received_paise
        outstanding_receivables_inr = round(max(0.0, contract_value_inr - payments_received_inr), 2)

        # Installation linkage & milestone status
        inst = o.installations[0] if o.installations else None
        is_commissioned = (inst is not None and inst.status in ("COMMISSIONED", "COMPLETED")) or (o.stage in ("COMMISSIONED", "COMPLETED"))

        # Recognized Revenue Enforcement
        if is_commissioned:
            recognized_rev_paise = o.total_contract_paise
            recognized_revenue_inr = round(recognized_rev_paise / 100, 2)
            financial_status = "REVENUE_RECOGNIZED_FULL"
        else:
            recognized_rev_paise = 0
            recognized_revenue_inr = 0.0
            financial_status = "REVENUE_NOT_RECOGNIZED"

        # Material COGS (from Bill of Materials)
        bom_cogs_paise = o.bom.total_cost_paise if o.bom else 0
        material_cogs_inr = round(bom_cogs_paise / 100, 2)

        # Technician Labour (from ProjectExpense where category == LABOUR)
        labour_paise = sum(e.amount_paise for e in o.expenses if e.category.upper() == "LABOUR")
        labour_cost_inr = round(labour_paise / 100, 2)

        # Direct Expenses (from ProjectExpense where category != LABOUR)
        direct_exp_paise = sum(e.amount_paise for e in o.expenses if e.category.upper() != "LABOUR")
        direct_expenses_inr = round(direct_exp_paise / 100, 2)

        # Direct Costs Calculation
        total_costs_paise = bom_cogs_paise + labour_paise + direct_exp_paise
        total_direct_costs_inr = round(total_costs_paise / 100, 2)

        # Contribution Profit = Recognized Revenue - Total Direct Costs
        profit_paise = recognized_rev_paise - total_costs_paise
        contribution_profit_inr = round(profit_paise / 100, 2)

        # Contribution Margin (%) - Requirement F: Zero Revenue Handling
        if recognized_revenue_inr > 0:
            contribution_margin_pct = round((contribution_profit_inr / recognized_revenue_inr) * 100, 2)
            rec_rev_sum_paise += recognized_rev_paise
            rec_costs_sum_paise += total_costs_paise
        else:
            # Null margin for WIP to prevent invalid divide-by-zero or distorted negative percentage
            contribution_margin_pct = None

        # Data completeness status
        if not o.bom:
            completeness_status = "DATA_INCOMPLETE_NO_BOM"
        elif is_commissioned:
            completeness_status = "COMPLETE_AUDITED"
        else:
            completeness_status = "WIP_PENDING_HANDOVER"

        total_recognized_rev_paise += recognized_rev_paise
        total_cogs_paise += bom_cogs_paise
        total_labour_paise += labour_paise
        total_expenses_paise += direct_exp_paise

        results.append({
            "order_id": o.id,
            "order_number": o.order_number,
            "installation_id": inst.id if inst else None,
            "installation_number": inst.installation_number if inst else "N/A",
            "customer_name": o.customer.name if o.customer else "N/A",
            "capacity_kw": o.quotation.system_capacity_kw if o.quotation else 5.0,
            "technician": inst.assigned_technician if inst else "Unassigned",
            "stage": o.stage,
            "installation_status": inst.status if inst else "UNSCHEDULED",
            "quotation_value_inr": quotation_value_inr,
            "contract_value_inr": contract_value_inr,
            "payments_received_inr": payments_received_inr,
            "outstanding_receivables_inr": outstanding_receivables_inr,
            "recognized_revenue_inr": recognized_revenue_inr,
            "material_cogs_inr": material_cogs_inr,
            "labour_cost_inr": labour_cost_inr,
            "direct_expenses_inr": direct_expenses_inr,
            "total_direct_costs_inr": total_direct_costs_inr,
            "contribution_profit_inr": contribution_profit_inr,
            "contribution_margin_pct": contribution_margin_pct,
            "is_commissioned": is_commissioned,
            "financial_status": financial_status,
            "completeness_status": completeness_status
        })

    # Overall Recognized Portfolio Margin
    rec_profit_paise = rec_rev_sum_paise - rec_costs_sum_paise
    rec_margin_pct = round((rec_profit_paise / rec_rev_sum_paise * 100), 2) if rec_rev_sum_paise > 0 else None

    return {
        "accounting_policy": "Completed-Contract EPC Revenue Recognition (Ind AS 115 / IFRS 15)",
        "summary": {
            "total_contract_value_inr": round(total_contract_paise / 100, 2),
            "total_payments_received_inr": round(total_payments_paise / 100, 2),
            "total_outstanding_receivables_inr": round(max(0, (total_contract_paise - total_payments_paise)) / 100, 2),
            "total_recognized_revenue_inr": round(total_recognized_rev_paise / 100, 2),
            "total_material_cogs_inr": round(total_cogs_paise / 100, 2),
            "total_labour_inr": round(total_labour_paise / 100, 2),
            "total_direct_expenses_inr": round(total_expenses_paise / 100, 2),
            "total_direct_costs_inr": round((total_cogs_paise + total_labour_paise + total_expenses_paise) / 100, 2),
            "recognized_projects_profit_inr": round(rec_profit_paise / 100, 2),
            "recognized_projects_margin_pct": rec_margin_pct,
            "overall_contribution_margin_pct": rec_margin_pct,
            "commissioned_projects_count": sum(1 for r in results if r["is_commissioned"]),
            "wip_projects_count": sum(1 for r in results if not r["is_commissioned"])
        },
        "installations": results
    }


# ==========================================
# FEATURE 9: DETAILED DATABASE REPORTS
# ==========================================

@router.get("/reports/operational")
def get_operational_report(db: Session = Depends(get_db)):
    """
    Feature 9 Operational Report from real database records:
    - Enquiries by status and conversion rate
    - Quotations accepted, rejected, pending
    - Orders by status
    - Surveys awaiting review
    - Installation progress and completed installations
    - Warehouse stock availability and shortages
    - Inventory transfers by status
    - Service tickets by priority and status
    - Warranty coverage and upcoming expirations
    """
    # 1. Enquiries
    enquiries = db.query(Enquiry).all()
    total_enquiries = len(enquiries)
    enquiries_by_status: Dict[str, int] = {}
    for e in enquiries:
        st = e.status or "NEW"
        enquiries_by_status[st] = enquiries_by_status.get(st, 0) + 1

    won_enquiries = enquiries_by_status.get("WON", 0)
    enquiry_conversion_rate = round((won_enquiries / total_enquiries * 100), 1) if total_enquiries else 0.0

    # 2. Quotations
    quotes = db.query(Quotation).all()
    total_quotes = len(quotes)
    quotes_by_status: Dict[str, int] = {
        "DRAFT": 0, "SENT": 0, "ACCEPTED": 0, "REJECTED": 0, "EXPIRED": 0
    }
    for q in quotes:
        st = q.status or "DRAFT"
        quotes_by_status[st] = quotes_by_status.get(st, 0) + 1

    quote_acceptance_rate = round((quotes_by_status.get("ACCEPTED", 0) / total_quotes * 100), 1) if total_quotes else 0.0

    # 3. Orders
    orders = db.query(Order).all()
    total_orders = len(orders)
    orders_by_stage: Dict[str, int] = {}
    total_contract_paise = 0
    for o in orders:
        st = o.stage or "CONFIRMED"
        orders_by_stage[st] = orders_by_stage.get(st, 0) + 1
        total_contract_paise += o.total_contract_paise or 0

    # 4. Surveys
    surveys = db.query(SiteSurvey).all()
    surveys_by_status = {
        "SCHEDULED": 0, "IN_PROGRESS": 0, "SUBMITTED": 0, "APPROVED": 0, "REJECTED": 0
    }
    for s in surveys:
        st = s.status or "SCHEDULED"
        surveys_by_status[st] = surveys_by_status.get(st, 0) + 1
    surveys_awaiting_review = surveys_by_status.get("SUBMITTED", 0)

    # 5. Installations
    installs = db.query(Installation).all()
    total_installs = len(installs)
    installs_by_status: Dict[str, int] = {}
    for i in installs:
        st = i.status or "SCHEDULED"
        installs_by_status[st] = installs_by_status.get(st, 0) + 1
    completed_installs = installs_by_status.get("COMMISSIONED", 0) + installs_by_status.get("COMPLETED", 0)

    # 6. Warehouse Stock & Shortages
    stocks = db.query(WarehouseStock).all()
    total_on_hand = sum(s.qty_on_hand for s in stocks)
    total_reserved = sum(s.qty_reserved for s in stocks)
    total_available = max(0, total_on_hand - total_reserved)
    low_stock_items = sum(1 for s in stocks if s.qty_on_hand <= (getattr(s, "min_threshold", 5) or 5))

    # 7. Inventory Transfers
    transfers = db.query(InventoryTransfer).all()
    transfers_by_status: Dict[str, int] = {
        "REQUESTED": 0, "APPROVED": 0, "IN_TRANSIT": 0, "RECEIVED": 0, "CANCELLED": 0
    }
    for t in transfers:
        st = t.status or "REQUESTED"
        transfers_by_status[st] = transfers_by_status.get(st, 0) + 1

    # 8. Service Tickets
    tickets = db.query(ServiceTicket).all()
    total_tickets = len(tickets)
    tickets_by_status: Dict[str, int] = {}
    tickets_by_priority: Dict[str, int] = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for tk in tickets:
        st = tk.status or "OPEN"
        pr = tk.priority or "MEDIUM"
        tickets_by_status[st] = tickets_by_status.get(st, 0) + 1
        tickets_by_priority[pr] = tickets_by_priority.get(pr, 0) + 1

    # 9. Warranties
    now = datetime.datetime.utcnow()
    horizon = now + datetime.timedelta(days=90)
    warranties = db.query(Warranty).all()
    total_warranties = len(warranties)
    active_warranties = sum(1 for w in warranties if w.status == "ACTIVE" and w.end_date >= now)
    expiring_soon = sum(1 for w in warranties if w.end_date and now <= w.end_date <= horizon and w.status in ("ACTIVE", "EXPIRING_SOON"))
    expired_warranties = sum(1 for w in warranties if w.end_date and w.end_date < now)
    replaced_warranties = sum(1 for w in warranties if w.status == "REPLACED")

    return {
        "generated_at": now.isoformat(),
        "enquiries": {
            "total": total_enquiries,
            "conversion_rate_pct": enquiry_conversion_rate,
            "by_status": enquiries_by_status
        },
        "quotations": {
            "total": total_quotes,
            "acceptance_rate_pct": quote_acceptance_rate,
            "by_status": quotes_by_status
        },
        "orders": {
            "total": total_orders,
            "pipeline_value_inr": round(total_contract_paise / 100, 2),
            "by_stage": orders_by_stage
        },
        "surveys": {
            "total": len(surveys),
            "awaiting_review": surveys_awaiting_review,
            "by_status": surveys_by_status
        },
        "installations": {
            "total": total_installs,
            "completed": completed_installs,
            "by_status": installs_by_status
        },
        "inventory": {
            "total_on_hand_units": total_on_hand,
            "total_reserved_units": total_reserved,
            "total_available_units": total_available,
            "low_stock_alerts_count": low_stock_items
        },
        "transfers": {
            "total": len(transfers),
            "by_status": transfers_by_status
        },
        "service_tickets": {
            "total": total_tickets,
            "by_status": tickets_by_status,
            "by_priority": tickets_by_priority
        },
        "warranties": {
            "total": total_warranties,
            "active": active_warranties,
            "expiring_within_90_days": expiring_soon,
            "expired": expired_warranties,
            "replaced": replaced_warranties
        }
    }


@router.get("/reports/financial")
def get_financial_report(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    customer_id: Optional[int] = Query(None, description="Filter by customer ID"),
    db: Session = Depends(get_db)
):
    """
    Feature 9 Financial Report:
    - Order value and recorded revenue
    - Payments received and outstanding balances
    - Recorded project expenses by category
    - Estimated project profit and margins (Ind AS 115 Completed Contract basis)
    - Summaries filtered by date range and project
    """
    order_query = db.query(Order)
    if customer_id and isinstance(customer_id, int):
        order_query = order_query.filter(Order.customer_id == customer_id)

    if start_date and isinstance(start_date, str):
        try:
            dt_start = datetime.datetime.fromisoformat(start_date)
            order_query = order_query.filter(Order.created_at >= dt_start)
        except Exception:
            pass

    if end_date and isinstance(end_date, str):
        try:
            dt_end = datetime.datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
            order_query = order_query.filter(Order.created_at <= dt_end)
        except Exception:
            pass

    orders = order_query.order_by(desc(Order.created_at)).all()

    # Expenses query
    exp_query = db.query(ProjectExpense)
    if start_date and isinstance(start_date, str):
        try:
            dt_start = datetime.datetime.fromisoformat(start_date)
            exp_query = exp_query.filter(ProjectExpense.expense_date >= dt_start)
        except Exception:
            pass
    if end_date and isinstance(end_date, str):
        try:
            dt_end = datetime.datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
            exp_query = exp_query.filter(ProjectExpense.expense_date <= dt_end)
        except Exception:
            pass

    all_expenses = exp_query.all()
    expenses_by_category: Dict[str, float] = {}
    for e in all_expenses:
        cat = e.category or "MISCELLANEOUS"
        amt = round(e.amount_paise / 100, 2)
        expenses_by_category[cat] = expenses_by_category.get(cat, 0.0) + amt

    total_contract_paise = sum(o.total_contract_paise for o in orders)
    total_contract_inr = round(total_contract_paise / 100, 2)

    total_payments_paise = 0
    total_recognized_rev_paise = 0
    total_bom_cogs_paise = 0
    total_expenses_paise = sum(e.amount_paise for e in all_expenses)

    projects_summary = []
    for o in orders:
        inst = o.installations[0] if o.installations else None
        is_commissioned = (inst is not None and inst.status in ("COMMISSIONED", "COMPLETED")) or (o.stage in ("COMMISSIONED", "COMPLETED"))

        contract_val = round(o.total_contract_paise / 100, 2)

        completed_payments_paise = sum(p.amount_paise for p in o.payments if p.status == "COMPLETED")
        paid_paise = completed_payments_paise if completed_payments_paise > 0 else (o.advance_received_paise or 0)
        total_payments_paise += paid_paise
        paid_val = round(paid_paise / 100, 2)
        outstanding = round(max(0.0, contract_val - paid_val), 2)

        bom_cogs = round(o.bom.total_cost_paise / 100, 2) if o.bom else 0.0
        total_bom_cogs_paise += (o.bom.total_cost_paise if o.bom else 0)

        site_exp = round(sum(e.amount_paise for e in o.expenses) / 100, 2)
        total_costs = round(bom_cogs + site_exp, 2)

        if is_commissioned:
            rec_rev = contract_val
            total_recognized_rev_paise += o.total_contract_paise
            rec_profit = round(rec_rev - total_costs, 2)
            rec_margin = round((rec_profit / rec_rev * 100), 1) if rec_rev > 0 else 0.0
        else:
            rec_rev = 0.0
            rec_profit = 0.0
            rec_margin = None

        est_profit = round(contract_val - total_costs, 2)
        est_margin = round((est_profit / contract_val * 100), 1) if contract_val > 0 else 0.0

        projects_summary.append({
            "order_id": o.id,
            "order_number": o.order_number,
            "customer_name": o.customer.name if o.customer else "N/A",
            "capacity_kw": o.quotation.system_capacity_kw if o.quotation else 5.0,
            "stage": o.stage,
            "created_at": o.created_at.strftime("%Y-%m-%d"),
            "contract_value_inr": contract_val,
            "payments_received_inr": paid_val,
            "outstanding_balance_inr": outstanding,
            "bom_cogs_inr": bom_cogs,
            "site_expenses_inr": site_exp,
            "total_costs_inr": total_costs,
            "estimated_profit_inr": est_profit,
            "estimated_margin_pct": est_margin,
            "is_commissioned": is_commissioned,
            "recognized_revenue_inr": rec_rev,
            "recognized_profit_inr": rec_profit,
            "recognized_margin_pct": rec_margin
        })

    return {
        "accounting_standard": "Ind AS 115 / IFRS 15 (Completed-Contract Handover)",
        "filter": {
            "start_date": start_date,
            "end_date": end_date,
            "customer_id": customer_id
        },
        "overview": {
            "total_orders_count": len(orders),
            "total_contract_value_inr": total_contract_inr,
            "total_payments_received_inr": round(total_payments_paise / 100, 2),
            "total_outstanding_receivables_inr": round(max(0.0, total_contract_inr - (total_payments_paise / 100)), 2),
            "total_recognized_revenue_inr": round(total_recognized_rev_paise / 100, 2),
            "total_bom_cogs_inr": round(total_bom_cogs_paise / 100, 2),
            "total_recorded_expenses_inr": round(total_expenses_paise / 100, 2),
            "total_direct_costs_inr": round((total_bom_cogs_paise + total_expenses_paise) / 100, 2),
            "estimated_portfolio_profit_inr": round(total_contract_inr - ((total_bom_cogs_paise + total_expenses_paise) / 100), 2),
            "expenses_by_category": expenses_by_category
        },
        "projects": projects_summary
    }


@router.get("/reports/components")
def get_component_quality_report(category: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Feature 9 Component Report:
    - Component stock by warehouse
    - Component credibility scores and factor contributions
    - Components with incomplete manufacturer, certification, or warranty data
    """
    cred_eval = CredibilityService.evaluate_all(db, category=category)
    components = cred_eval["components"]

    # Incomplete Data Listing
    incomplete_components = [
        c for c in components if c["data_completeness"] != "COMPLETE"
    ]

    # Warehouse Stock distribution per component
    wh_query = db.query(WarehouseStock).all()
    stock_by_comp: Dict[int, Dict[str, Any]] = {}
    for s in wh_query:
        cid = s.component_id
        if cid not in stock_by_comp:
            stock_by_comp[cid] = {"total_on_hand": 0, "total_reserved": 0, "depots": []}
        stock_by_comp[cid]["total_on_hand"] += s.qty_on_hand
        stock_by_comp[cid]["total_reserved"] += s.qty_reserved
        wh_name = s.warehouse.name if s.warehouse else f"Depot #{s.warehouse_id}"
        stock_by_comp[cid]["depots"].append({
            "warehouse_name": wh_name,
            "qty_on_hand": s.qty_on_hand,
            "qty_reserved": s.qty_reserved,
            "available": max(0, s.qty_on_hand - s.qty_reserved)
        })

    enriched_components = []
    for c in components:
        cid = c["component_id"]
        c_copy = dict(c)
        c_copy["stock_info"] = stock_by_comp.get(cid, {"total_on_hand": 0, "total_reserved": 0, "depots": []})
        enriched_components.append(c_copy)

    return {
        "total_evaluated": cred_eval["total_evaluated"],
        "average_score": cred_eval["average_score"],
        "distribution": cred_eval["distribution"],
        "incomplete_data_count": len(incomplete_components),
        "incomplete_components": incomplete_components,
        "components": enriched_components
    }


@router.get("/export/csv")
def export_report_csv(
    report_type: str = Query("financial", description="financial, operational, components, service"),
    db: Session = Depends(get_db)
):
    """
    Feature 9: Export clean tabular business records to downloadable CSV files.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "financial":
        writer.writerow([
            "Order Number", "Customer Name", "Capacity (kW)", "Stage", "Created Date",
            "Contract Value (INR)", "Payments Received (INR)", "Outstanding Balance (INR)",
            "BOM COGS (INR)", "Site Expenses (INR)", "Total Costs (INR)",
            "Estimated Profit (INR)", "Estimated Margin (%)", "Commissioned", "Recognized Revenue (INR)"
        ])
        orders = db.query(Order).order_by(desc(Order.created_at)).all()
        for o in orders:
            inst = o.installations[0] if o.installations else None
            is_comm = (inst is not None and inst.status in ("COMMISSIONED", "COMPLETED")) or (o.stage in ("COMMISSIONED", "COMPLETED"))
            contract_val = round(o.total_contract_paise / 100, 2)
            completed_payments_paise = sum(p.amount_paise for p in o.payments if p.status == "COMPLETED")
            paid_val = round((completed_payments_paise if completed_payments_paise > 0 else (o.advance_received_paise or 0)) / 100, 2)
            outstanding = round(max(0.0, contract_val - paid_val), 2)
            bom_cogs = round(o.bom.total_cost_paise / 100, 2) if o.bom else 0.0
            site_exp = round(sum(e.amount_paise for e in o.expenses) / 100, 2)
            total_costs = round(bom_cogs + site_exp, 2)
            est_profit = round(contract_val - total_costs, 2)
            est_margin = round((est_profit / contract_val * 100), 1) if contract_val > 0 else 0.0
            rec_rev = contract_val if is_comm else 0.0

            writer.writerow([
                o.order_number,
                o.customer.name if o.customer else "N/A",
                o.quotation.system_capacity_kw if o.quotation else 5.0,
                o.stage,
                o.created_at.strftime("%Y-%m-%d"),
                contract_val,
                paid_val,
                outstanding,
                bom_cogs,
                site_exp,
                total_costs,
                est_profit,
                est_margin,
                "YES" if is_comm else "NO",
                rec_rev
            ])
        filename = "sunpower_financial_audit_report.csv"

    elif report_type == "components":
        writer.writerow([
            "SKU", "Component Name", "Category", "Manufacturer", "Supplier", "Tier",
            "Credibility Score", "Rating Label", "Data Completeness", "Failure Rate (%)",
            "Certification Status", "Documentation Status", "Inventory Recommendation"
        ])
        cred = CredibilityService.evaluate_all(db)
        for c in cred["components"]:
            writer.writerow([
                c["sku"],
                c["name"],
                c["category"],
                c["manufacturer"],
                c.get("supplier_name", c["manufacturer"]),
                c["tier_grade"],
                c["final_score"],
                c["rating_label"],
                c["data_completeness"],
                c["failure_rate_pct"],
                c["certification_status"],
                c["documentation_status"],
                c["inventory_recommendation_label"]
            ])
        filename = "sunpower_component_credibility_report.csv"

    elif report_type == "service":
        writer.writerow([
            "Ticket Number", "Customer Name", "City", "Issue Category", "Priority",
            "Status", "Technician", "Warranty Covered", "Created Date", "Resolved Date"
        ])
        tickets = db.query(ServiceTicket).order_by(desc(ServiceTicket.created_at)).all()
        for t in tickets:
            writer.writerow([
                t.ticket_number,
                t.customer.name if t.customer else "N/A",
                t.customer.city if t.customer else "N/A",
                t.issue_category,
                t.priority,
                t.status,
                t.assigned_technician or "Unassigned",
                "YES" if t.is_warranty_covered else "NO",
                t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "",
                t.resolved_at.strftime("%Y-%m-%d %H:%M") if t.resolved_at else ""
            ])
        filename = "sunpower_service_tickets_report.csv"

    elif report_type == "inventory":
        writer.writerow([
            "Warehouse Code", "Warehouse Name", "City", "SKU", "Component Name",
            "Category", "Qty On Hand (Physical)", "Qty Reserved", "Available Stock",
            "Min Threshold", "Low Stock Alert"
        ])
        stocks = db.query(WarehouseStock).join(WarehouseStock.warehouse).join(WarehouseStock.component).all()
        for s in stocks:
            wh = s.warehouse
            comp = s.component
            avail = max(0, s.qty_on_hand - s.qty_reserved)
            writer.writerow([
                wh.code if wh else "N/A",
                wh.name if wh else "N/A",
                wh.city if wh else "N/A",
                comp.sku if comp else "N/A",
                comp.name if comp else "N/A",
                comp.category if comp else "BOS",
                s.qty_on_hand,
                s.qty_reserved,
                avail,
                s.min_threshold,
                "YES" if avail <= s.min_threshold else "NO"
            ])
        filename = "sunpower_inventory_ledger_report.csv"

    elif report_type == "movements":
        writer.writerow([
            "Movement ID", "Timestamp", "Warehouse", "Component SKU", "Component Name",
            "Quantity Change", "Movement Type", "Audit Notes"
        ])
        movs = db.query(StockMovement).order_by(desc(StockMovement.created_at)).all()
        for m in movs:
            writer.writerow([
                m.id,
                m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else "",
                m.warehouse.name if m.warehouse else "N/A",
                m.component.sku if m.component else "N/A",
                m.component.name if m.component else "N/A",
                m.quantity_change,
                m.movement_type,
                m.notes or ""
            ])
        filename = "sunpower_stock_movements_audit_report.csv"

    elif report_type == "reservations":
        writer.writerow([
            "Allocation ID", "Order Number", "Customer Name", "Component SKU", "Component Name",
            "Warehouse Depot", "Allocated Quantity", "Reservation Status", "Allocated At"
        ])
        allocs = db.query(BOMAllocation).order_by(desc(BOMAllocation.allocated_at)).all()
        for a in allocs:
            bi = a.bom_item
            bom = bi.bom if bi else None
            ord = bom.order if bom else None
            comp = bi.component if bi else None
            wh = a.warehouse
            writer.writerow([
                a.id,
                ord.order_number if ord else "N/A",
                ord.customer.name if ord and ord.customer else "N/A",
                comp.sku if comp else "N/A",
                comp.name if comp else "N/A",
                wh.name if wh else "N/A",
                a.allocated_quantity,
                a.status,
                a.allocated_at.strftime("%Y-%m-%d %H:%M") if a.allocated_at else ""
            ])
        filename = "sunpower_inventory_reservations_report.csv"

    elif report_type == "receipts":
        writer.writerow([
            "Receipt ID", "Timestamp", "Warehouse Depot", "Component SKU", "Component Name",
            "Quantity Received", "Movement Type", "PO & Supplier Notes"
        ])
        receipts = db.query(StockMovement).filter(StockMovement.movement_type == "GOODS_RECEIPT").order_by(desc(StockMovement.created_at)).all()
        for r in receipts:
            writer.writerow([
                f"GRN-{r.created_at.strftime('%Y%m%d')}-{r.id:04d}",
                r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
                r.warehouse.name if r.warehouse else "N/A",
                r.component.sku if r.component else "N/A",
                r.component.name if r.component else "N/A",
                r.quantity_change,
                r.movement_type,
                r.notes or ""
            ])
        filename = "sunpower_goods_receipts_report.csv"

    elif report_type == "dispatches":
        writer.writerow([
            "Dispatch Number", "Order Number", "Customer Name", "Warehouse Depot",
            "Vehicle Number", "Driver Name", "Status", "Dispatch Date", "Serialized Units Scanned"
        ])
        dispatches = db.query(Dispatch).order_by(desc(Dispatch.dispatch_date)).all()
        for d in dispatches:
            writer.writerow([
                d.dispatch_number,
                d.order.order_number if d.order else "N/A",
                d.order.customer.name if d.order and d.order.customer else "N/A",
                d.warehouse.name if d.warehouse else "N/A",
                d.vehicle_number,
                d.driver_name,
                d.status,
                d.dispatch_date.strftime("%Y-%m-%d %H:%M") if d.dispatch_date else "",
                len(d.serialized_items)
            ])
        filename = "sunpower_dispatches_history_report.csv"

    elif report_type == "returns":
        writer.writerow([
            "Return ID", "Timestamp", "Warehouse Depot", "Component SKU", "Component Name",
            "Return Type", "Quantity", "Return Audit Notes"
        ])
        returns = db.query(StockMovement).filter(StockMovement.movement_type.like("RETURN%")).order_by(desc(StockMovement.created_at)).all()
        for ret in returns:
            writer.writerow([
                f"RET-{ret.created_at.strftime('%Y%m%d')}-{ret.id:04d}",
                ret.created_at.strftime("%Y-%m-%d %H:%M") if ret.created_at else "",
                ret.warehouse.name if ret.warehouse else "N/A",
                ret.component.sku if ret.component else "N/A",
                ret.component.name if ret.component else "N/A",
                "RESTOCK" if "RESTOCK" in ret.movement_type else "DAMAGED",
                abs(ret.quantity_change) if ret.quantity_change else 1,
                ret.notes or ""
            ])
        filename = "sunpower_returns_and_damaged_report.csv"

    else:
        # Default operational orders & installations
        writer.writerow([
            "Order Number", "Customer Name", "City", "Stage", "Payment Status",
            "Contract Value (INR)", "Advance Paid (INR)", "Created Date"
        ])
        orders = db.query(Order).order_by(desc(Order.created_at)).all()
        for o in orders:
            writer.writerow([
                o.order_number,
                o.customer.name if o.customer else "N/A",
                o.customer.city if o.customer else "N/A",
                o.stage,
                o.payment_status,
                round(o.total_contract_paise / 100, 2),
                round((o.advance_received_paise or 0) / 100, 2),
                o.created_at.strftime("%Y-%m-%d")
            ])
        filename = "sunpower_operational_report.csv"

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


