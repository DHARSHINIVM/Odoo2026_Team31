import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db, get_utc_now
from app.models import (
    User, Customer, Enquiry, SiteSurvey, Quotation, Order, Warehouse,
    WarehouseStock, BillOfMaterials, Dispatch, SerializedItem, Installation,
    DigitalSolarPassport, Warranty, WarrantyPolicy, ServiceTicket,
    Payment, ProjectExpense, SubsidyApplication, Notification,
    StockMovement, InventoryTransfer, Task, Appointment
)
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/dashboard", tags=["Dynamic Role Dashboards"])


# -------------------------------------------------------------------------
# A. Admin / Solar Manager Dashboard
# -------------------------------------------------------------------------
@router.get("/admin")
def get_admin_dashboard(
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    total_customers = db.query(Customer).count()
    total_enquiries = db.query(Enquiry).count()
    active_quotations = db.query(Quotation).filter(Quotation.status.in_(["SHARED", "SENT", "ACCEPTED"])).count()
    confirmed_orders = db.query(Order).all()
    confirmed_orders_count = len(confirmed_orders)

    total_installations = db.query(Installation).count()
    completed_installations = db.query(Installation).filter(Installation.status == "COMMISSIONED").count()

    # Revenue Breakdown
    total_contract_paise = sum(o.total_contract_paise for o in confirmed_orders)
    total_contract_inr = round(total_contract_paise / 100, 2)
    advance_received_inr = round(sum(o.advance_received_paise for o in confirmed_orders) / 100, 2)
    
    # Financial Oversight: All Payments & Outstanding
    all_payments = db.query(Payment).all()
    recorded_payments_inr = round(sum(p.amount_paise for p in all_payments) / 100, 2)
    verified_payments = [p for p in all_payments if p.status in ("COMPLETED", "VERIFIED")]
    verified_payments_inr = round(sum(p.amount_paise for p in verified_payments) / 100, 2)
    outstanding_balance_inr = max(0.0, round(total_contract_inr - verified_payments_inr, 2))
    collection_rate_pct = round((verified_payments_inr / total_contract_inr * 100), 1) if total_contract_inr > 0 else 0.0

    # Active Projects (Orders not closed or cancelled)
    active_projects_count = sum(1 for o in confirmed_orders if o.stage not in ("CLOSED", "CANCELLED"))

    # Survey Progress Breakdown
    surveys_all = db.query(SiteSurvey).all()
    survey_progress = {
        "total": len(surveys_all),
        "pending_assignment": sum(1 for s in surveys_all if s.status == "PENDING_ASSIGNMENT"),
        "in_progress": sum(1 for s in surveys_all if s.status in ("ASSIGNED", "IN_PROGRESS", "SCHEDULED")),
        "pending_approval": sum(1 for s in surveys_all if s.status in ("SUBMITTED", "UNDER_REVIEW")),
        "approved": sum(1 for s in surveys_all if s.status == "APPROVED"),
        "rejected": sum(1 for s in surveys_all if s.status in ("REJECTED", "CORRECTION_REQUIRED"))
    }

    # Dispatch Progress Breakdown
    dispatches_all = db.query(Dispatch).all()
    dispatch_progress = {
        "total": len(dispatches_all),
        "draft_pending": sum(1 for d in dispatches_all if d.status in ("DRAFT", "PENDING", "PREPARING")),
        "in_transit": sum(1 for d in dispatches_all if d.status in ("IN_TRANSIT", "DISPATCHED")),
        "delivered": sum(1 for d in dispatches_all if d.status in ("DELIVERED", "RECEIVED"))
    }

    # Installation Progress Breakdown
    installations_all = db.query(Installation).all()
    installation_progress = {
        "total": len(installations_all),
        "scheduled": sum(1 for i in installations_all if i.status in ("SCHEDULED", "ASSIGNED")),
        "in_progress": sum(1 for i in installations_all if i.status in ("IN_PROGRESS", "WORK_IN_PROGRESS", "TESTING")),
        "commissioned": sum(1 for i in installations_all if i.status in ("COMMISSIONED", "COMPLETED"))
    }

    # Warranty & Service Oversight
    warranties_all = db.query(Warranty).all()
    tickets_all = db.query(ServiceTicket).all()
    passports_count = db.query(DigitalSolarPassport).count()

    warranty_oversight = {
        "total_warranties": len(warranties_all),
        "active": sum(1 for w in warranties_all if w.status == "ACTIVE"),
        "expiring_soon": sum(1 for w in warranties_all if w.status == "EXPIRING_SOON"),
        "total_passports": passports_count
    }

    service_oversight = {
        "total_tickets": len(tickets_all),
        "open": sum(1 for t in tickets_all if t.status in ("NEW_COMPLAINT", "OPEN", "ASSIGNED", "IN_PROGRESS", "DIAGNOSIS")),
        "critical": sum(1 for t in tickets_all if t.priority == "CRITICAL" and t.status not in ("CLOSED", "RESOLVED")),
        "resolved": sum(1 for t in tickets_all if t.status in ("CLOSED", "RESOLVED"))
    }

    # Operational Exceptions & Overdue Alerts
    now = get_utc_now()
    exceptions = []
    
    # Overdue Follow-ups
    for enq in db.query(Enquiry).filter(Enquiry.follow_up_date != None).all():
        if enq.follow_up_date and enq.status not in ("ORDER_PLACED", "LOST", "REJECTED"):
            f_dt = enq.follow_up_date
            if f_dt.tzinfo is None:
                f_dt = f_dt.replace(tzinfo=datetime.timezone.utc)
            if f_dt < now:
                exceptions.append({
                    "type": "OVERDUE_FOLLOWUP",
                    "severity": "MEDIUM",
                    "title": f"Overdue Enquiry Follow-up: {enq.enquiry_number}",
                    "details": f"Customer {enq.customer.name if enq.customer else 'N/A'} was scheduled for follow-up on {f_dt.strftime('%d %b %Y')}.",
                    "link": f"/enquiries"
                })

    # Critical Service Tickets
    for ticket in tickets_all:
        if ticket.priority == "CRITICAL" and ticket.status not in ("CLOSED", "RESOLVED"):
            exceptions.append({
                "type": "CRITICAL_TICKET",
                "severity": "HIGH",
                "title": f"Critical Ticket: {ticket.ticket_number}",
                "details": f"Customer {ticket.customer.name if ticket.customer else 'N/A'} reported: {ticket.issue_category} - {ticket.description[:60]}...",
                "link": f"/service"
            })

    # Pending Survey Approvals > 48h
    for s in surveys_all:
        if s.status in ("SUBMITTED", "UNDER_REVIEW"):
            cust_name = s.enquiry.customer.name if (s.enquiry and s.enquiry.customer) else "N/A"
            exceptions.append({
                "type": "PENDING_SURVEY_APPROVAL",
                "severity": "LOW",
                "title": f"Survey Awaiting Review: {s.survey_number}",
                "details": f"Submitted for Customer {cust_name} - requires manager approval.",
                "link": f"/surveys"
            })

    # Standardized EPC Revenue Recognition:
    # Revenue is recognized 100% on commissioned systems (WIP systems recognize 0 revenue)
    commissioned_orders = [
        o for o in confirmed_orders
        if (any(i.status in ("COMMISSIONED", "COMPLETED") for i in o.installations) or o.stage in ("COMMISSIONED", "COMPLETED"))
    ]
    recognized_revenue_inr = round(sum(o.total_contract_paise for o in commissioned_orders) / 100, 2)

    # Cost of Goods & Direct Expenses strictly matched to Recognized Projects
    rec_cogs_inr = round(sum(o.bom.total_cost_paise for o in commissioned_orders if o.bom) / 100, 2)
    rec_expenses_inr = round(sum(sum(e.amount_paise for e in o.expenses) for o in commissioned_orders) / 100, 2)
    rec_costs_inr = round(rec_cogs_inr + rec_expenses_inr, 2)

    # Standard Contribution Profit & Margin on Recognized Portfolio
    contribution_profit_inr = round(recognized_revenue_inr - rec_costs_inr, 2) if recognized_revenue_inr > 0 else 0.0
    contribution_margin_pct = round((contribution_profit_inr / recognized_revenue_inr * 100), 1) if recognized_revenue_inr > 0 else None

    # Low Stock Inventory Alerts
    low_stock = []
    for s in db.query(WarehouseStock).all():
        avail = max(0, s.qty_on_hand - s.qty_reserved)
        if avail <= s.min_threshold:
            low_stock.append({
                "component_name": s.component.name if s.component else f"Item #{s.component_id}",
                "warehouse": s.warehouse.name if s.warehouse else "Depot",
                "available": avail,
                "min_threshold": s.min_threshold
            })

    # Subsidies
    subsidy_apps = db.query(SubsidyApplication).all()
    subsidies_summary = {
        "total": len(subsidy_apps),
        "disbursed_inr": round(sum(s.disbursed_subsidy_paise for s in subsidy_apps) / 100, 2),
        "approved": sum(1 for s in subsidy_apps if s.status == "APPROVED"),
        "pending_inspection": sum(1 for s in subsidy_apps if s.status in ["DRAFT", "SUBMITTED"])
    }

    # Revenue chart (Past 6 Months)
    now = get_utc_now()
    revenue_chart = []
    for i in range(5, -1, -1):
        m_date = now - datetime.timedelta(days=i * 30)
        m_label = m_date.strftime("%b %Y")
        month_orders = [o for o in confirmed_orders if o.created_at.strftime("%b %Y") == m_label]
        val = round(sum(o.total_contract_paise for o in month_orders) / 100, 2)
        revenue_chart.append({"month": m_label, "revenue": val, "orders": len(month_orders)})

    # Conversion Funnel
    funnel = [
        {"stage": "1. Leads", "count": total_enquiries},
        {"stage": "2. Surveys Approved", "count": db.query(SiteSurvey).filter(SiteSurvey.status == "APPROVED").count()},
        {"stage": "3. Quotes Accepted", "count": db.query(Quotation).filter(Quotation.status == "ACCEPTED").count()},
        {"stage": "4. Orders Confirmed", "count": confirmed_orders_count},
        {"stage": "5. Commissioned", "count": completed_installations},
    ]

    return {
        "kpis": {
            "total_customers": total_customers,
            "total_enquiries": total_enquiries,
            "active_quotations": active_quotations,
            "confirmed_orders": confirmed_orders_count,
            "active_projects": active_projects_count,
            "total_installations": total_installations,
            "completed_installations": completed_installations,
            "total_contract_inr": total_contract_inr,
            "total_order_value_inr": total_contract_inr,
            "advance_received_inr": advance_received_inr,
            "recorded_payments_inr": recorded_payments_inr,
            "verified_payments_inr": verified_payments_inr,
            "outstanding_balance_inr": outstanding_balance_inr,
            "collection_rate_pct": collection_rate_pct,
            "recognized_revenue_inr": recognized_revenue_inr,
            "contribution_profit_inr": contribution_profit_inr,
            "contribution_margin_pct": contribution_margin_pct,
            "pending_survey_approvals": db.query(SiteSurvey).filter(SiteSurvey.status.in_(["SUBMITTED", "UNDER_REVIEW"])).count(),
            "open_service_tickets": service_oversight["open"],
            "critical_tickets_count": service_oversight["critical"],
            "active_warranties_count": warranty_oversight["active"],
            "total_passports": passports_count,
            "low_stock_alerts_count": len(low_stock)
        },
        "survey_progress": survey_progress,
        "dispatch_progress": dispatch_progress,
        "installation_progress": installation_progress,
        "warranty_oversight": warranty_oversight,
        "service_oversight": service_oversight,
        "operational_exceptions": exceptions,
        "revenue_chart": revenue_chart,
        "funnel_data": funnel,
        "subsidies_summary": subsidies_summary,
        "low_stock_alerts": low_stock[:6],
        "recent_payments": [
            {
                "id": p.id,
                "payment_number": p.payment_number,
                "order_number": p.order.order_number if p.order else "N/A",
                "customer": p.order.customer.name if (p.order and p.order.customer) else "N/A",
                "amount_inr": round(p.amount_paise / 100, 2),
                "milestone": p.milestone,
                "payment_mode": p.payment_mode,
                "status": p.status,
                "paid_at": p.paid_at.strftime("%d %b %Y") if p.paid_at else "N/A"
            }
            for p in db.query(Payment).order_by(Payment.paid_at.desc()).limit(6).all()
        ],
        "recent_orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "customer": o.customer.name if o.customer else "N/A",
                "contract_inr": round(o.total_contract_paise / 100, 2),
                "stage": o.stage,
                "payment_status": o.payment_status
            }
            for o in db.query(Order).order_by(Order.created_at.desc()).limit(6).all()
        ]
    }


# -------------------------------------------------------------------------
# B. Sales Executive Dashboard
# -------------------------------------------------------------------------
@router.get("/sales")
def get_sales_dashboard(
    current_user: User = Depends(require_roles(["ADMIN", "SALES_EXECUTIVE"])),
    db: Session = Depends(get_db)
):
    is_admin = current_user.role.upper() == "ADMIN"
    
    # Scoped enquiry query
    enq_query = db.query(Enquiry)
    if not is_admin:
        enq_query = enq_query.filter(
            (Enquiry.assigned_sales_rep_id == current_user.id) | (Enquiry.assigned_sales_rep_id == None)
        )
    
    my_enquiries = enq_query.all()
    total_assigned = len(my_enquiries)
    new_leads = sum(1 for e in my_enquiries if e.status in ["NEW", "ASSIGNED"])
    
    # Follow-ups due
    now = get_utc_now()
    now_naive = now.replace(tzinfo=None)

    def _is_overdue(dt):
        if not dt:
            return False
        if getattr(dt, "tzinfo", None) is not None:
            return dt < now
        return dt < now_naive

    followups_due_today = sum(1 for e in my_enquiries if e.follow_up_date and e.follow_up_date.date() == now.date())
    overdue_followups = sum(1 for e in my_enquiries if _is_overdue(e.follow_up_date) and e.status not in ["ORDER_PLACED", "REJECTED", "LOST"])

    # Quotations and Conversions
    quotes_query = db.query(Quotation)
    if not is_admin:
        enq_ids = [e.id for e in my_enquiries]
        quotes_query = quotes_query.filter(Quotation.enquiry_id.in_(enq_ids))
    
    my_quotes = quotes_query.all()
    quotes_prepared = len(my_quotes)
    accepted_quotes = sum(1 for q in my_quotes if q.status == "ACCEPTED")
    pending_quotes = sum(1 for q in my_quotes if q.status in ["DRAFT", "SHARED", "SENT"])
    converted_orders = sum(1 for e in my_enquiries if e.status == "ORDER_PLACED")
    qualified_leads = sum(1 for e in my_enquiries if e.status not in ["NEW", "REJECTED", "LOST"])
    conversion_rate = round((converted_orders / total_assigned * 100), 1) if total_assigned > 0 else 0.0

    # Cross-module Operational Coordination Data (Surveys, Orders, Materials, Installations, Service)
    all_surveys = db.query(SiteSurvey).all()
    surveys_requested = sum(1 for s in all_surveys if s.status in ["REQUESTED", "ASSIGNED", "IN_PROGRESS", "SCHEDULED"])
    surveys_awaiting_review = sum(1 for s in all_surveys if s.status in ["SUBMITTED", "UNDER_REVIEW"])

    all_orders = db.query(Order).all()
    confirmed_orders_count = len(all_orders)
    active_projects_count = sum(1 for o in all_orders if o.stage not in ["CLOSED", "CANCELLED"])

    # Financial & Payment status
    total_contract_paise = sum(o.total_contract_paise for o in all_orders)
    total_contract_inr = round(total_contract_paise / 100, 2)
    advance_received_inr = round(sum(o.advance_received_paise for o in all_orders) / 100, 2)
    all_payments = db.query(Payment).all()
    verified_payments_inr = round(sum(p.amount_paise for p in all_payments if p.status in ("COMPLETED", "VERIFIED")) / 100, 2)
    outstanding_balance_inr = max(0.0, round(total_contract_inr - verified_payments_inr, 2))

    # Material & Inventory Readiness
    material_readiness = {
        "allocated_orders": sum(1 for o in all_orders if o.stage in ["INVENTORY_ALLOCATED", "DISPATCHED", "INSTALLATION_SCHEDULED", "INSTALLED", "COMMISSIONED"]),
        "dispatched_orders": sum(1 for o in all_orders if o.stage in ["DISPATCHED", "INSTALLATION_SCHEDULED", "INSTALLED", "COMMISSIONED"]),
        "procurement_pending": sum(1 for o in all_orders if o.stage in ["CONFIRMED", "BOM_GENERATED"])
    }

    # Installation Progress
    all_installs = db.query(Installation).all()
    installation_progress = {
        "scheduled": sum(1 for i in all_installs if i.status in ["SCHEDULED", "ASSIGNED"]),
        "in_progress": sum(1 for i in all_installs if i.status in ["IN_PROGRESS", "WORK_IN_PROGRESS", "TESTING"]),
        "commissioned": sum(1 for i in all_installs if i.status in ["COMMISSIONED", "COMPLETED"])
    }

    # Service Exceptions
    all_tickets = db.query(ServiceTicket).all()
    open_tickets = [t for t in all_tickets if t.status not in ["CLOSED", "RESOLVED"]]
    service_exceptions = [
        {
            "id": t.id,
            "ticket_number": t.ticket_number,
            "customer_name": t.customer.name if t.customer else "N/A",
            "issue_category": t.issue_category,
            "priority": t.priority,
            "status": t.status,
            "assigned_technician": t.assigned_technician or "Unassigned"
        }
        for t in open_tickets[:5]
    ]

    # Surveys Awaiting Review Queue
    surveys_review_queue = [
        {
            "id": s.id,
            "survey_number": s.survey_number,
            "customer_name": s.enquiry.customer.name if (s.enquiry and s.enquiry.customer) else "N/A",
            "customer_city": s.enquiry.customer.city if (s.enquiry and s.enquiry.customer) else "N/A",
            "surveyor_name": s.surveyor_name or "Technician",
            "recommended_capacity_kw": s.recommended_capacity_kw,
            "status": s.status,
            "submitted_at": s.survey_date.strftime("%Y-%m-%d") if s.survey_date else "Recent"
        }
        for s in all_surveys if s.status in ["SUBMITTED", "UNDER_REVIEW"]
    ]

    # Active Projects List
    active_projects_list = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "customer_name": o.customer.name if o.customer else "N/A",
            "capacity_kw": o.quotation.system_capacity_kw if o.quotation else 5.0,
            "stage": o.stage,
            "payment_status": o.payment_status,
            "contract_inr": round(o.total_contract_paise / 100, 2),
            "installation_target_date": o.installation_target_date.strftime("%Y-%m-%d") if o.installation_target_date else "TBD"
        }
        for o in all_orders if o.stage not in ["CLOSED", "CANCELLED"]
    ][:8]

    # User Permissions Matrix for Sales Executive
    user_perms = {
        "can_approve_survey": bool(is_admin or current_user.has_capability("can_approve_survey") or current_user.has_capability("APPROVE_SURVEY")),
        "can_approve_quotation": bool(is_admin or current_user.has_capability("can_approve_quotation")),
        "can_apply_special_discount": bool(is_admin or current_user.has_capability("can_apply_special_discount")),
        "can_override_survey": bool(is_admin or current_user.has_capability("can_override_survey"))
    }

    # Upcoming follow-ups list
    upcoming_followups = [
        {
            "enquiry_id": e.id,
            "enquiry_number": e.enquiry_number,
            "customer_name": e.customer.name if e.customer else "N/A",
            "phone": e.customer.phone if e.customer else "N/A",
            "follow_up_date": e.follow_up_date.strftime("%Y-%m-%d %H:%M") if e.follow_up_date else "Not set",
            "priority": e.lead_priority,
            "next_action": e.next_action or "Initial consultation call",
            "is_overdue": bool(_is_overdue(e.follow_up_date))
        }
        for e in my_enquiries if e.follow_up_date
    ]
    upcoming_followups.sort(key=lambda x: x["follow_up_date"])

    return {
        "kpis": {
            "assigned_enquiries": total_assigned,
            "new_leads": new_leads,
            "qualified_leads": qualified_leads,
            "followups_due_today": followups_due_today,
            "overdue_followups": overdue_followups,
            "surveys_requested": surveys_requested,
            "surveys_awaiting_review": surveys_awaiting_review,
            "quotations_prepared": quotes_prepared,
            "quotations_pending": pending_quotes,
            "accepted_quotations": accepted_quotes,
            "confirmed_orders": confirmed_orders_count,
            "active_projects": active_projects_count,
            "total_contract_inr": total_contract_inr,
            "advance_received_inr": advance_received_inr,
            "verified_payments_inr": verified_payments_inr,
            "outstanding_balance_inr": outstanding_balance_inr,
            "converted_orders": converted_orders,
            "conversion_rate_pct": conversion_rate
        },
        "material_readiness": material_readiness,
        "installation_progress": installation_progress,
        "service_exceptions": service_exceptions,
        "surveys_review_queue": surveys_review_queue,
        "active_projects_list": active_projects_list,
        "user_permissions": user_perms,
        "upcoming_followups": upcoming_followups[:6],
        "my_enquiries": [
            {
                "id": e.id,
                "enquiry_number": e.enquiry_number,
                "customer_name": e.customer.name if e.customer else "N/A",
                "phone": e.customer.phone if e.customer else "N/A",
                "city": e.customer.city if e.customer else "N/A",
                "capacity_kw": e.required_capacity_kw,
                "priority": e.lead_priority,
                "status": e.status,
                "created_at": e.created_at.strftime("%Y-%m-%d")
            }
            for e in my_enquiries[:10]
        ]
    }


# -------------------------------------------------------------------------
# C. Warehouse Manager Dashboard
# -------------------------------------------------------------------------
@router.get("/warehouse")
def get_warehouse_dashboard(
    current_user: User = Depends(require_roles(["ADMIN", "WAREHOUSE_MANAGER"])),
    db: Session = Depends(get_db)
):
    stocks = db.query(WarehouseStock).all()
    total_on_hand = sum(s.qty_on_hand for s in stocks)
    total_reserved = sum(s.qty_reserved for s in stocks)
    available_stock = total_on_hand - total_reserved

    low_stock = []
    shortage_count = 0
    for s in stocks:
        avail = max(0, s.qty_on_hand - s.qty_reserved)
        if avail <= s.min_threshold:
            low_stock.append({
                "component_name": s.component.name if s.component else "N/A",
                "sku": s.component.sku if s.component else "N/A",
                "warehouse": s.warehouse.name if s.warehouse else "Depot",
                "available": avail,
                "min_threshold": s.min_threshold
            })
        if avail == 0:
            shortage_count += 1

    # Dispatches
    dispatches = db.query(Dispatch).all()
    pending_dispatches = sum(1 for d in dispatches if d.status in ["PREPARING", "DISPATCHED"])
    in_transit_dispatches = sum(1 for d in dispatches if d.status == "IN_TRANSIT")
    completed_dispatches = sum(1 for d in dispatches if d.status == "DELIVERED")

    # Goods receipts & transfers pending
    pending_receipts = db.query(InventoryTransfer).filter(InventoryTransfer.status.in_(["REQUESTED", "APPROVED", "IN_TRANSIT"])).count()

    # Orders awaiting inventory allocation & reservation
    pending_allocations = db.query(Order).filter(Order.stage.in_(["CONFIRMED", "BOM_GENERATED"])).count()
    pending_reservations = db.query(Order).filter(Order.stage == "CONFIRMED").count()

    # Returns and Damaged counts from StockMovement
    damaged_movements = db.query(StockMovement).filter(StockMovement.movement_type.contains("DAMAGED")).count()
    returns_movements = db.query(StockMovement).filter(StockMovement.movement_type.contains("RETURN")).count()

    # Depot summaries
    warehouses = db.query(Warehouse).all()
    depot_summaries = []
    for w in warehouses:
        w_stocks = [s for s in stocks if s.warehouse_id == w.id]
        depot_summaries.append({
            "warehouse_id": w.id,
            "code": w.code,
            "name": w.name,
            "city": w.city,
            "total_items": sum(s.qty_on_hand for s in w_stocks),
            "reserved_items": sum(s.qty_reserved for s in w_stocks),
            "available_items": sum(max(0, s.qty_on_hand - s.qty_reserved) for s in w_stocks),
            "low_stock_count": sum(1 for s in w_stocks if (s.qty_on_hand - s.qty_reserved) <= s.min_threshold)
        })

    # Assigned personal tasks
    tasks = db.query(Task).filter(
        (Task.assigned_user_id == current_user.id) |
        (Task.category == "INVENTORY") |
        (Task.category == "GENERAL")
    ).order_by(Task.due_date.asc(), Task.priority.desc()).limit(10).all()

    personal_tasks = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "category": t.category,
            "due_date": t.due_date.strftime("%Y-%m-%d %H:%M") if t.due_date else "Today",
            "source_event": t.source_event
        }
        for t in tasks
    ]

    # Recent stock movements
    recent_movs = db.query(StockMovement).order_by(StockMovement.created_at.desc()).limit(8).all()
    movements_list = [
        {
            "id": m.id,
            "warehouse_name": m.warehouse.name if m.warehouse else "Central Depot",
            "component_name": m.component.name if m.component else "Solar Equipment",
            "quantity_change": m.quantity_change,
            "movement_type": m.movement_type,
            "notes": m.notes,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M")
        }
        for m in recent_movs
    ]

    return {
        "kpis": {
            "total_on_hand": total_on_hand,
            "total_stock": total_on_hand,
            "total_reserved": total_reserved,
            "reserved_stock": total_reserved,
            "available_stock": available_stock,
            "low_stock_alerts_count": len(low_stock),
            "low_stock_items": len(low_stock),
            "pending_goods_receipts": pending_receipts,
            "pending_reservations": pending_reservations,
            "allocation_requests": pending_allocations,
            "pending_allocations": pending_allocations,
            "procurement_shortages": shortage_count,
            "pending_dispatches": pending_dispatches,
            "in_transit_dispatches": in_transit_dispatches,
            "completed_dispatches": completed_dispatches,
            "returns_and_damaged": damaged_movements + returns_movements
        },
        "depot_summaries": depot_summaries,
        "warehouses": [
            {
                "id": w.id,
                "name": w.name,
                "code": w.code,
                "location": f"{w.city}, {w.state}",
                "total_units": sum(s.qty_on_hand for s in stocks if s.warehouse_id == w.id),
                "reserved_units": sum(s.qty_reserved for s in stocks if s.warehouse_id == w.id),
                "available_units": sum(max(0, s.qty_on_hand - s.qty_reserved) for s in stocks if s.warehouse_id == w.id)
            }
            for w in warehouses
        ],
        "low_stock_alerts": low_stock[:6],
        "personal_tasks": personal_tasks,
        "recent_movements": movements_list,
        "manager_profile": {
            "id": current_user.id,
            "name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role
        },
        "active_dispatches": [
            {
                "id": d.id,
                "dispatch_number": d.dispatch_number,
                "order_number": d.order.order_number if d.order else "N/A",
                "customer": d.order.customer.name if d.order and d.order.customer else "N/A",
                "vehicle": d.vehicle_number,
                "driver": d.driver_name,
                "status": d.status,
                "dispatch_date": d.dispatch_date.strftime("%Y-%m-%d")
            }
            for d in dispatches[:6]
        ]
    }


# -------------------------------------------------------------------------
# D. Unified Technician Workspace (Single Identity, All 6 Task Types)
# -------------------------------------------------------------------------
@router.get("/technician")
def get_unified_technician_dashboard(
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER", "TECHNICIAN", "FIELD_TECHNICIAN"])),
    db: Session = Depends(get_db)
):
    """
    Unified Field Technician Workspace.
    Single employee identity handling all 6 primary task types:
    1. Site Survey (SITE_SURVEY)
    2. Installation (INSTALLATION)
    3. Commissioning and Testing (COMMISSIONING)
    4. Maintenance Visit (MAINTENANCE)
    5. Repair or Service Visit (SERVICE_REPAIR)
    6. Inspection or Follow-up Visit (INSPECTION)
    """
    is_admin = current_user.role.upper() in ("ADMIN", "SOLAR_MANAGER")
    now = get_utc_now()
    caps = current_user.capability_list

    # 1. Assigned Surveys
    survey_query = db.query(SiteSurvey)
    if not is_admin:
        survey_query = survey_query.filter(
            (SiteSurvey.assigned_technician_id == current_user.id) |
            (SiteSurvey.surveyor_name.ilike(f"%{current_user.full_name}%"))
        )
    my_surveys = survey_query.all()

    # 2. Assigned Installations
    inst_query = db.query(Installation)
    if not is_admin:
        inst_query = inst_query.filter(
            (Installation.assigned_tech_id == current_user.id) |
            (Installation.assigned_technician.ilike(f"%{current_user.full_name}%"))
        )
    my_installations = inst_query.all()

    # 3. Assigned Service Tickets & Repairs
    svc_query = db.query(ServiceTicket)
    if not is_admin:
        svc_query = svc_query.filter(
            (ServiceTicket.assigned_tech_id == current_user.id) |
            (ServiceTicket.assigned_technician.ilike(f"%{current_user.full_name}%"))
        )
    my_service_tickets = svc_query.all()

    # 4. Assigned Field Appointments
    appt_query = db.query(Appointment)
    if not is_admin:
        appt_query = appt_query.filter(
            (Appointment.assigned_tech_id == current_user.id) |
            (Appointment.technician_notes.ilike(f"%{current_user.full_name}%"))
        )
    my_appointments = appt_query.all()

    # 5. Assigned Operational Tasks
    task_query = db.query(Task)
    if not is_admin:
        task_query = task_query.filter(Task.assigned_user_id == current_user.id)
    my_tasks = task_query.all()

    # Unified 6-Task-Type Representation
    unified_tasks = []

    # Map Surveys -> 1. Site Survey
    for s in my_surveys:
        cust = s.enquiry.customer if s.enquiry and s.enquiry.customer else None
        unified_tasks.append({
            "task_id": f"TSK-SRV-{s.id:04d}",
            "task_type": "SITE_SURVEY",
            "task_type_label": "1. Site Survey",
            "project_id": s.enquiry.enquiry_number if s.enquiry else f"ENQ-{s.enquiry_id}",
            "customer_name": cust.name if cust else "N/A",
            "customer_phone": cust.phone if cust else "N/A",
            "site_address": (cust.installation_address or cust.address) if cust else "N/A",
            "assigned_technician": s.surveyor_name or current_user.full_name,
            "priority": "HIGH" if s.status == "REJECTED" else "MEDIUM",
            "scheduled_date": s.survey_date.strftime("%Y-%m-%d %H:%M") if s.survey_date else "N/A",
            "due_date": s.survey_date.strftime("%Y-%m-%d") if s.survey_date else "N/A",
            "status": s.status,
            "required_checklist": [
                "Verify structural integrity of roof slab/truss",
                "Measure usable and shadow-free roof area (sq.ft)",
                "Assess orientation (azimuth) and optimal tilt angle",
                "Evaluate LT panel, meter position and earthing pit location",
                "Record cable routing distance from roof to inverter location"
            ],
            "required_documents": [
                "Panoramic roof overview photograph",
                "Shading obstacle assessment photo",
                "Main service entrance & LT energy meter photo",
                "Proposed inverter & conduit placement photo"
            ],
            "completion_requirements": "Complete roof survey form with measured area, verified tilt angle, shading loss percentage, and recommended capacity.",
            "entity_type": "SURVEY",
            "entity_id": s.id
        })

    # Map Installations -> 2. Installation & 3. Commissioning and Testing
    for i in my_installations:
        order = i.order
        cust = order.customer if order and order.customer else None
        
        if i.status in ("SCHEDULED", "ASSIGNED", "IN_PROGRESS", "WORK_IN_PROGRESS"):
            unified_tasks.append({
                "task_id": f"TSK-INS-{i.id:04d}",
                "task_type": "INSTALLATION",
                "task_type_label": "2. Installation",
                "project_id": order.order_number if order else f"ORD-{i.order_id}",
                "customer_name": cust.name if cust else "N/A",
                "customer_phone": cust.phone if cust else "N/A",
                "site_address": i.installation_address or ((cust.installation_address or cust.address) if cust else "N/A"),
                "assigned_technician": i.assigned_technician or current_user.full_name,
                "priority": "HIGH",
                "scheduled_date": i.scheduled_start_date.strftime("%Y-%m-%d") if i.scheduled_start_date else "N/A",
                "due_date": i.scheduled_start_date.strftime("%Y-%m-%d") if i.scheduled_start_date else "N/A",
                "status": i.status,
                "required_checklist": [
                    "Fix HDG mounting structure rails and mid/end clamps",
                    "Mount solar PV modules and verify string polarity",
                    "Install inverter on dedicated heat-dissipating wall bracket",
                    "Run UV-resistant solar DC cabling through conduit",
                    "Connect separate equipment earthing and SPD protection"
                ],
                "required_documents": [
                    "Completed mounting structure photo",
                    "Installed panel string layout photo",
                    "Inverter mounting and DC disconnect cabinet photo",
                    "AC/DC distribution box connection photo"
                ],
                "completion_requirements": "Physical installation of structure, panels, and inverter complete; component serial numbers scanned and matched against warehouse BOM.",
                "entity_type": "INSTALLATION",
                "entity_id": i.id
            })
        
        if i.status in ("QUALITY_CHECK", "CUSTOMER_SIGNOFF", "COMMISSIONED"):
            unified_tasks.append({
                "task_id": f"TSK-COM-{i.id:04d}",
                "task_type": "COMMISSIONING",
                "task_type_label": "3. Commissioning & Testing",
                "project_id": order.order_number if order else f"ORD-{i.order_id}",
                "customer_name": cust.name if cust else "N/A",
                "customer_phone": cust.phone if cust else "N/A",
                "site_address": i.installation_address or ((cust.installation_address or cust.address) if cust else "N/A"),
                "assigned_technician": i.assigned_technician or current_user.full_name,
                "priority": "HIGH",
                "scheduled_date": i.scheduled_start_date.strftime("%Y-%m-%d") if i.scheduled_start_date else "N/A",
                "due_date": (i.commissioning_date or i.scheduled_start_date).strftime("%Y-%m-%d") if (i.commissioning_date or i.scheduled_start_date) else "N/A",
                "status": i.status,
                "required_checklist": [
                    "Open-circuit voltage (Voc) & short-circuit current (Isc) test",
                    "Inverter grid sync and anti-islanding trip test",
                    "Earthing resistance measurement (<= 5.0 Ohms IS 3043)",
                    "Complete 8-point electrical safety checklist",
                    "Touchscreen customer walk-through and electronic sign-off"
                ],
                "required_documents": [
                    "Digital multimeter / clamp meter reading photos",
                    "Inverter display live generation telemetry photo",
                    "Earth pit resistance measurement reading photo",
                    "Customer signature acknowledgement on electronic worksheet"
                ],
                "completion_requirements": "System generated power verified under full sunlight, Digital Solar Passport updated to ACTIVE with electronic customer sign-off.",
                "entity_type": "COMMISSIONING",
                "entity_id": i.id
            })

    # Map Service Tickets -> 4. Maintenance Visit & 5. Repair / Service Visit
    for t in my_service_tickets:
        cust = t.customer
        is_maint = t.issue_category in ("PERIODIC_MAINTENANCE", "GENERAL_QUERY")
        type_code = "MAINTENANCE" if is_maint else "SERVICE_REPAIR"
        type_lbl = "4. Maintenance Visit" if is_maint else "5. Repair / Service Visit"
        unified_tasks.append({
            "task_id": f"TSK-SRV-{t.id:04d}",
            "task_type": type_code,
            "task_type_label": type_lbl,
            "project_id": t.ticket_number,
            "customer_name": cust.name if cust else "N/A",
            "customer_phone": cust.phone if cust else "N/A",
            "site_address": (cust.installation_address or cust.address) if cust else "N/A",
            "assigned_technician": t.assigned_technician or current_user.full_name,
            "priority": t.priority or "MEDIUM",
            "scheduled_date": t.created_at.strftime("%Y-%m-%d") if t.created_at else "N/A",
            "due_date": t.created_at.strftime("%Y-%m-%d") if t.created_at else "N/A",
            "status": t.status,
            "required_checklist": [
                "Fault symptom diagnosis and error code extraction",
                "Component continuity, insulation and resistance testing",
                "Warranty coverage verification against serial number",
                "Defective component repair or warranty replacement",
                "Post-repair functional verification under load"
            ] if not is_maint else [
                "Solar panel dust and soiling inspection",
                "Inverter cooling fan and heatsink cleaning",
                "MC4 connector thermal inspection",
                "Array earthing continuity test",
                "Discom net meter reading log"
            ],
            "required_documents": [
                "Defective / damaged component photograph",
                "Replaced component serial number photo",
                "Post-repair operating telemetry screen photo"
            ],
            "completion_requirements": "Issue resolved, root cause and diagnosis notes recorded, parts used and labour hours entered, customer confirmation obtained.",
            "entity_type": "SERVICE_TICKET",
            "entity_id": t.id
        })

    # Map general Task records -> covers 6. Inspection or Follow-up Visit
    for tk in my_tasks:
        cust = tk.customer
        task_cat = tk.category.upper() if tk.category else "GENERAL"
        type_code = "INSPECTION"
        type_lbl = "6. Inspection / Follow-up Visit"
        if task_cat == "SURVEY":
            type_code = "SITE_SURVEY"
            type_lbl = "1. Site Survey"
        elif task_cat == "INSTALLATION":
            type_code = "INSTALLATION"
            type_lbl = "2. Installation"
        elif task_cat == "COMMISSIONING":
            type_code = "COMMISSIONING"
            type_lbl = "3. Commissioning & Testing"
        elif task_cat == "MAINTENANCE":
            type_code = "MAINTENANCE"
            type_lbl = "4. Maintenance Visit"
        elif task_cat == "SERVICE":
            type_code = "SERVICE_REPAIR"
            type_lbl = "5. Repair / Service Visit"

        task_tag = f"TSK-GEN-{tk.id:04d}"
        if not any(u["task_id"] == task_tag for u in unified_tasks):
            unified_tasks.append({
                "task_id": task_tag,
                "task_type": type_code,
                "task_type_label": type_lbl,
                "project_id": tk.order.order_number if tk.order else f"TASK-{tk.id:04d}",
                "customer_name": cust.name if cust else "N/A",
                "customer_phone": cust.phone if cust else "N/A",
                "site_address": (cust.installation_address or cust.address) if cust else "N/A",
                "assigned_technician": tk.assigned_user.full_name if tk.assigned_user else current_user.full_name,
                "priority": tk.priority or "MEDIUM",
                "scheduled_date": tk.due_date.strftime("%Y-%m-%d %H:%M") if tk.due_date else "N/A",
                "due_date": tk.due_date.strftime("%Y-%m-%d") if tk.due_date else "N/A",
                "status": tk.status,
                "required_checklist": [
                    "Post-installation structural audit",
                    "Discom net-metering inspection readiness",
                    "Safety warning signage verification",
                    "Lightning arrester continuity inspection"
                ],
                "required_documents": [
                    "Net-meter installation photo",
                    "Lightning arrester & earth pit photo",
                    "Discom inspection compliance certificate copy"
                ],
                "completion_requirements": "Regulatory compliance checklist cleared, DISCOM synchronization approval verified.",
                "entity_type": "TASK",
                "entity_id": tk.id
            })

    # KPIs
    today_surveys = [s for s in my_surveys if s.survey_date and s.survey_date.date() == now.date() and s.status in ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"]]
    today_installs = [i for i in my_installations if i.scheduled_start_date and i.scheduled_start_date.date() == now.date() and i.status != "COMMISSIONED"]
    today_services = [t for t in my_service_tickets if t.created_at and t.created_at.date() == now.date() and t.status not in ["RESOLVED", "CLOSED"]]

    pending_surveys = [s for s in my_surveys if s.status in ["ASSIGNED", "IN_PROGRESS"]]
    returned_surveys = [s for s in my_surveys if s.status == "REJECTED"]
    completed_surveys = [s for s in my_surveys if s.status in ["SUBMITTED", "APPROVED"]]

    in_progress_installs = [i for i in my_installations if i.status in ["IN_PROGRESS", "QUALITY_CHECK", "CUSTOMER_SIGNOFF"]]
    completed_installs = [i for i in my_installations if i.status == "COMMISSIONED"]
    resolved_services = [t for t in my_service_tickets if t.status in ["RESOLVED", "CLOSED"]]

    return {
        "technician": {
            "id": current_user.id,
            "name": current_user.full_name,
            "role": "TECHNICIAN",
            "capabilities": caps
        },
        "kpis": {
            "today_tasks": len(today_surveys) + len(today_installs) + len(today_services),
            "pending_submissions": len(pending_surveys) + len(in_progress_installs),
            "returned_surveys": len(returned_surveys),
            "completed_jobs": len(completed_surveys) + len(completed_installs) + len(resolved_services),
            "surveys_total": len(my_surveys),
            "installations_total": len(my_installations),
            "service_tickets_total": len(my_service_tickets),
            "all_tasks_total": len(unified_tasks)
        },
        "my_surveys": [
            {
                "id": s.id,
                "survey_number": s.survey_number,
                "customer_name": s.enquiry.customer.name if s.enquiry and s.enquiry.customer else "N/A",
                "phone": s.enquiry.customer.phone if s.enquiry and s.enquiry.customer else "N/A",
                "address": s.enquiry.customer.address if s.enquiry and s.enquiry.customer else "N/A",
                "city": s.enquiry.customer.city if s.enquiry and s.enquiry.customer else "N/A",
                "roof_type": s.roof_type,
                "target_capacity_kw": s.enquiry.required_capacity_kw if s.enquiry else 5.0,
                "status": s.status,
                "survey_date": s.survey_date.strftime("%Y-%m-%d %H:%M") if s.survey_date else "N/A",
                "reviewer_notes": getattr(s, "review_notes", None)
            }
            for s in my_surveys
        ],
        "my_installations": [
            {
                "id": i.id,
                "installation_number": i.installation_number,
                "order_number": i.order.order_number if i.order else "N/A",
                "customer": i.order.customer.name if i.order and i.order.customer else "N/A",
                "phone": i.order.customer.phone if i.order and i.order.customer else "N/A",
                "address": i.installation_address or (i.order.customer.address if i.order and i.order.customer else "N/A"),
                "scheduled_date": i.scheduled_start_date.strftime("%Y-%m-%d") if i.scheduled_start_date else "N/A",
                "status": i.status,
                "capacity_kw": i.order.quotation.system_capacity_kw if i.order and i.order.quotation else 5.0,
                "passport_number": i.passport.passport_number if i.passport else "Pending",
                "passport_token": i.passport.qr_code_token if i.passport else None
            }
            for i in my_installations
        ],
        "my_service_tickets": [
            {
                "id": t.id,
                "ticket_number": t.ticket_number,
                "customer_name": t.customer.name if t.customer else "N/A",
                "phone": t.customer.phone if t.customer else "N/A",
                "address": (t.customer.installation_address or t.customer.address) if t.customer else "N/A",
                "issue_category": t.issue_category,
                "priority": t.priority,
                "status": t.status,
                "description": t.description,
                "is_warranty_covered": t.is_warranty_covered,
                "diagnosis_notes": t.diagnosis_notes,
                "resolution_notes": t.resolution_notes,
                "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "N/A"
            }
            for t in my_service_tickets
        ],
        "my_appointments": [
            {
                "id": a.id,
                "appointment_number": a.appointment_number,
                "appointment_type": a.appointment_type,
                "customer_name": a.customer.name if a.customer else "N/A",
                "preferred_date": a.scheduled_date.strftime("%Y-%m-%d") if a.scheduled_date else "N/A",
                "time_slot": a.time_slot,
                "status": a.status
            }
            for a in my_appointments
        ],
        "my_tasks": unified_tasks
    }

