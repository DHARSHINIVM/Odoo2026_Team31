import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (
    Customer, Enquiry, SiteSurvey, Quotation, Order, Warehouse,
    WarehouseStock, Installation, DigitalSolarPassport, ServiceTicket,
    Component, Dispatch
)
from app.services.auth_service import get_current_user

router = APIRouter(tags=["Dashboard"], dependencies=[Depends(get_current_user)])


@router.get("/dashboard")
@router.get("/dashboard/summary")
def get_dashboard_data(db: Session = Depends(get_db)):
    # 1. High-level metric counts
    total_customers = db.query(Customer).count()
    new_enquiries = db.query(Enquiry).filter(Enquiry.status == "NEW").count()
    total_enquiries = db.query(Enquiry).count()

    pending_surveys_rows = db.query(SiteSurvey).filter(
        SiteSurvey.status.in_(["SCHEDULED", "IN_PROGRESS"])
    ).all()
    total_pending_surveys = len(pending_surveys_rows)

    quotations_awaiting = db.query(Quotation).filter(
        Quotation.status.in_(["DRAFT", "SHARED"])
    ).count()
    total_quotations = db.query(Quotation).count()

    confirmed_orders = db.query(Order).all()
    confirmed_orders_count = len(confirmed_orders)

    total_contract_paise = sum(o.total_contract_paise for o in confirmed_orders)
    # pyrefly: ignore[no-matching-overload]
    total_confirmed_contract_inr = round(total_contract_paise / 100, 2)

    advance_received_paise = sum(o.advance_received_paise for o in confirmed_orders)
    # pyrefly: ignore[no-matching-overload]
    advance_received_inr = round(advance_received_paise / 100, 2)
    outstanding_receivables_inr = round(max(0, total_confirmed_contract_inr - advance_received_inr), 2)

    # Standardized EPC handover recognized revenue
    commissioned_orders = [
        o for o in confirmed_orders
        if (any(i.status in ("COMMISSIONED", "COMPLETED") for i in o.installations) or o.stage in ("COMMISSIONED", "COMPLETED"))
    ]
    # pyrefly: ignore[no-matching-overload]
    recognized_revenue_inr = round(sum(o.total_contract_paise for o in commissioned_orders) / 100, 2)

    avg_credibility = db.query(func.avg(Component.credibility_score)).scalar() or 92.0

    # 2. Revenue Chart Data (Past 6 Months)
    # pyrefly: ignore[deprecated]
    now = datetime.datetime.utcnow()
    revenue_chart = []
    for i in range(5, -1, -1):
        m_date = now - datetime.timedelta(days=i * 30)
        m_label = m_date.strftime("%b %Y")
        # Sum orders in this month
        month_orders = [o for o in confirmed_orders if o.created_at.strftime("%b %Y") == m_label]
        # pyrefly: ignore[no-matching-overload]
        month_val = round(sum(o.total_contract_paise for o in month_orders) / 100, 2)
        revenue_chart.append({
            "month": m_label,
            "revenue": month_val,
            "orders": len(month_orders),
            "display": f"₹{(month_val/100000):.1f}L" if month_val > 0 else "₹0"
        })

    # 3. Complete Sales Funnel Data
    approved_surveys_count = db.query(SiteSurvey).filter(SiteSurvey.status == "APPROVED").count()
    accepted_quotations_count = db.query(Quotation).filter(Quotation.status == "ACCEPTED").count()
    commissioned_count = db.query(Installation).filter(Installation.status == "COMMISSIONED").count()

    funnel_data = [
        {"stage": "1. Leads", "count": total_enquiries, "fill": "#3b82f6"},
        {"stage": "2. Surveys Approved", "count": approved_surveys_count, "fill": "#6366f1"},
        {"stage": "3. Proposals Accepted", "count": accepted_quotations_count, "fill": "#8b5cf6"},
        {"stage": "4. Orders Confirmed", "count": confirmed_orders_count, "fill": "#10b981"},
        {"stage": "5. Commissioned", "count": commissioned_count, "fill": "#059669"},
    ]

    # 4. Installation Progress Breakdown
    installs = db.query(Installation).all()
    installation_breakdown = {
        "SCHEDULED": sum(1 for i in installs if i.status == "SCHEDULED"),
        "IN_PROGRESS": sum(1 for i in installs if i.status == "IN_PROGRESS"),
        "COMMISSIONED": sum(1 for i in installs if i.status == "COMMISSIONED")
    }

    # 5. Low-stock inventory alerts
    stocks = db.query(WarehouseStock).all()
    low_stock_alerts = []
    for s in stocks:
        avail = max(0, s.qty_on_hand - s.qty_reserved)
        if avail <= s.min_threshold:
            comp = s.component
            wh = s.warehouse
            low_stock_alerts.append({
                "id": s.id,
                "component_name": comp.name if comp else f"SKU #{s.component_id}",
                "category": comp.category if comp else "EQUIPMENT",
                "warehouse_name": wh.name if wh else "Depot",
                "warehouse_city": wh.city if wh else "Pune",
                "qty_on_hand": s.qty_on_hand,
                "qty_reserved": s.qty_reserved,
                "available": avail,
                "min_threshold": s.min_threshold
            })

    # 6. Recent Orders
    recent_orders = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "customer_name": o.customer.name if o.customer else "N/A",
            # pyrefly: ignore[no-matching-overload]
            "contract_inr": round(o.total_contract_paise / 100, 2),
            "stage": o.stage,
            "payment_status": o.payment_status,
            "system_capacity_kw": o.quotation.system_capacity_kw if o.quotation else 5.0,
            "created_at": o.created_at.strftime("%Y-%m-%d")
        }
        for o in db.query(Order).order_by(Order.created_at.desc()).limit(5).all()
    ]

    # 7. Pending Surveys Awaiting Action
    pending_surveys = [
        {
            "id": s.id,
            "survey_number": s.survey_number,
            "customer_name": s.enquiry.customer.name if s.enquiry and s.enquiry.customer else "N/A",
            "customer_city": s.enquiry.customer.city if s.enquiry and s.enquiry.customer else "Pune",
            "surveyor_name": s.surveyor_name,
            "status": s.status,
            "survey_date": s.survey_date.strftime("%Y-%m-%d")
        }
        for s in pending_surveys_rows[:5]
    ]

    # 8. Open Service Tickets
    open_tickets = [
        {
            "id": t.id,
            "ticket_number": t.ticket_number,
            "customer_name": t.customer.name if t.customer else "N/A",
            "issue_category": t.issue_category,
            "priority": t.priority,
            "status": t.status,
            "description": t.description,
            "created_at": t.created_at.strftime("%Y-%m-%d")
        }
        for t in db.query(ServiceTicket).filter(ServiceTicket.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"])).limit(5).all()
    ]

    return {
        "metrics": {
            "total_customers": total_customers,
            "new_enquiries": new_enquiries,
            "total_enquiries": total_enquiries,
            "pending_surveys": total_pending_surveys,
            "quotations_awaiting": quotations_awaiting,
            "total_quotations": total_quotations,
            "confirmed_orders": confirmed_orders_count,
            "total_confirmed_contract_inr": total_confirmed_contract_inr,
            "advance_received_inr": advance_received_inr,
            "outstanding_receivables_inr": outstanding_receivables_inr,
            "recognized_revenue_inr": recognized_revenue_inr,
            # Backward-compatible aliases for Stage 1 views:
            "customers": total_customers,
            "enquiries": total_enquiries,
            "quotations": total_quotations,
            "orders": confirmed_orders_count,
            "total_contract_inr": total_confirmed_contract_inr,
            "avg_component_credibility": round(float(avg_credibility), 1),
            "digital_solar_passports": db.query(DigitalSolarPassport).count(),
            "commissioned_installations": commissioned_count,
            "warehouses": db.query(Warehouse).count(),
            "open_service_tickets": len(open_tickets),
            "low_stock_alerts_count": len(low_stock_alerts)
        },
        "revenue_chart": revenue_chart,
        "funnel_data": funnel_data,
        "installation_progress": installation_breakdown,
        "low_stock_alerts": low_stock_alerts[:5],
        "recent_orders": recent_orders,
        "pending_surveys": pending_surveys,
        "open_service_tickets": open_tickets,
        "open_tickets": open_tickets
    }
