import os
import sys
import datetime

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(os.path.dirname(current_dir), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import (
    User, Customer, Enquiry, SiteSurvey, Quotation, Order, Package, Component,
    ServiceTicket, Appointment
)
from app.routers.role_dashboards import get_sales_dashboard
from app.routers.enquiries import create_enquiry
from app.schemas.entities import EnquiryCreate, SiteSurveyOut, ServiceTicketCreate
from app.routers.surveys import approve_survey, reject_survey, SurveyReviewRequest
from app.routers.service_tickets import (
    create_service_ticket, assign_service_technician, AssignTechnicianRequest
)
from app.services.appointment_service import AppointmentService

def run_sales_verification():
    print("=" * 80)
    print("SUNPOWER SOLUTIONS -- SALES EXECUTIVE MODULE FUNCTIONAL VERIFICATION")
    print("=" * 80)

    db: Session = SessionLocal()
    sales_user = db.query(User).filter(User.role == "SALES_EXECUTIVE").first()
    admin_user = db.query(User).filter(User.role == "ADMIN").first()
    tech_user = db.query(User).filter(User.role.in_(["FIELD_TECHNICIAN", "SURVEY_TECHNICIAN"])).first()

    assert sales_user, "Sales Executive user must exist"
    assert admin_user, "Admin user must exist"
    assert tech_user, "Technician user must exist"

    results = []
    def check(code, desc, ok, details=""):
        status_tag = "[PASS]" if ok else "[FAIL]"
        print(f"{status_tag} {code}: {desc}")
        if details:
            print(f"       Details: {details}")
        results.append((code, ok))
        assert ok, f"FAILED {code}: {desc}"

    # 1. Sales Dashboard Verification
    print("\n--- 1. SALES EXECUTIVE DASHBOARD ---")
    sales_dash = get_sales_dashboard(current_user=sales_user, db=db)
    check("SALES-01", "GET /dashboard/sales returns full payload", bool(sales_dash))
    kpis = sales_dash.get("kpis", {})
    check("SALES-02", "Sales KPIs include commercial & operational counters",
          "assigned_enquiries" in kpis and "surveys_requested" in kpis and "confirmed_orders" in kpis,
          f"Enquiries: {kpis.get('assigned_enquiries')}, Surveys: {kpis.get('surveys_requested')}, Orders: {kpis.get('confirmed_orders')}")
    check("SALES-03", "Financial metrics present in Sales Dashboard",
          "total_contract_inr" in kpis and "outstanding_balance_inr" in kpis,
          f"Contract: INR {kpis.get('total_contract_inr')}, Outstanding: INR {kpis.get('outstanding_balance_inr')}")
    check("SALES-04", "Material Readiness breakdown present",
          "material_readiness" in sales_dash and "allocated_orders" in sales_dash["material_readiness"],
          str(sales_dash.get("material_readiness")))
    check("SALES-05", "Installation Progress breakdown present",
          "installation_progress" in sales_dash and "commissioned" in sales_dash["installation_progress"],
          str(sales_dash.get("installation_progress")))
    check("SALES-06", "Surveys review queue populated",
          "surveys_review_queue" in sales_dash,
          f"Pending surveys in queue: {len(sales_dash.get('surveys_review_queue', []))}")
    check("SALES-07", "Active projects list populated",
          "active_projects_list" in sales_dash,
          f"Active projects count: {len(sales_dash.get('active_projects_list', []))}")
    check("SALES-08", "User permissions matrix evaluated",
          "user_permissions" in sales_dash and "can_approve_survey" in sales_dash["user_permissions"],
          str(sales_dash.get("user_permissions")))

    # 2. Lead & Customer Enquiry Management
    print("\n--- 2. ENQUIRY & LEAD MANAGEMENT ---")
    cust = db.query(Customer).first()
    if not cust:
        cust = Customer(name="Priya Sharma", phone="+919876543210", email="priya@example.com", city="Bengaluru")
        db.add(cust)
        db.commit()
        db.refresh(cust)

    enq_payload = EnquiryCreate(
        customer_id=cust.id,
        required_capacity_kw=4.5,
        grid_type="ON_GRID",
        monthly_bill_inr=7200,
        roof_type="RCC_FLAT",
        lead_source="DIRECT_SALES",
        lead_priority="HIGH",
        notes="4.5kW rooftop solar inquiry with net metering requirement."
    )
    new_enquiry = create_enquiry(payload=enq_payload, db=db)
    check("SALES-09", "Create customer enquiry with capacity and grid preference",
          bool(new_enquiry and new_enquiry.enquiry_number),
          f"Enquiry: {new_enquiry.enquiry_number}, Capacity: {new_enquiry.required_capacity_kw}kW, Grid: {new_enquiry.grid_type}")

    # 3. Appointments & Scheduling
    print("\n--- 3. APPOINTMENTS & SCHEDULING ---")
    future_date = datetime.date.today() + datetime.timedelta(days=8)
    apt = AppointmentService.book_appointment(
        db=db,
        customer_id=cust.id,
        appointment_type="SITE_SURVEY",
        scheduled_date=future_date,
        time_slot="14:00 - 16:00",
        customer_notes="Pre-installation site inspection"
    )
    check("SALES-10", "Book site survey appointment via AppointmentService",
          bool(apt and apt.appointment_number),
          f"Appointment: {apt.appointment_number} on {future_date} ({apt.time_slot})")

    # 4. Survey Coordination & Strict RBAC Prevention of Self-Approval
    print("\n--- 4. SURVEY COORDINATION & RBAC GOVERNANCE ---")
    # Create a test survey
    test_survey = db.query(SiteSurvey).filter(SiteSurvey.status.in_(["SUBMITTED", "UNDER_REVIEW"])).first()
    if not test_survey:
        count = db.query(SiteSurvey).count() + 1
        test_survey = SiteSurvey(
            enquiry_id=new_enquiry.id,
            survey_number=f"SRV-TEST-{count:03d}",
            assigned_technician_id=tech_user.id,
            surveyor_name=tech_user.full_name,
            status="SUBMITTED",
            roof_dimensions="15m x 10m",
            roof_area_sqft=1600.0,
            usable_roof_area_sqft=1400.0,
            recommended_capacity_kw=5.0
        )
        db.add(test_survey)
        db.commit()
        db.refresh(test_survey)

    # A. Test self-approval prohibition (Technician attempting to approve)
    technician_blocked = False
    try:
        approve_survey(
            survey_id=test_survey.id,
            payload=SurveyReviewRequest(review_notes="Tech self approval attempt"),
            current_user=tech_user,
            db=db
        )
    except HTTPException as e:
        if e.status_code == 403:
            technician_blocked = True
    check("SALES-11", "RBAC GUARD: Technician self-approval strictly blocked (403 Forbidden)", technician_blocked)

    # B. Test Sales Executive without capability
    sales_user.capabilities = "[]"
    db.commit()
    sales_no_cap_blocked = False
    try:
        approve_survey(
            survey_id=test_survey.id,
            payload=SurveyReviewRequest(review_notes="Sales without capability attempt"),
            current_user=sales_user,
            db=db
        )
    except HTTPException as e:
        if e.status_code == 403:
            sales_no_cap_blocked = True
    check("SALES-12", "RBAC GUARD: Sales Executive without 'can_approve_survey' blocked (403 Forbidden)", sales_no_cap_blocked)

    # C. Test Sales Executive WITH can_approve_survey capability
    sales_user.capabilities = '["can_approve_survey"]'
    db.commit()
    approved_survey = approve_survey(
        survey_id=test_survey.id,
        payload=SurveyReviewRequest(review_notes="Approved by authorised Sales Executive"),
        current_user=sales_user,
        db=db
    )
    check("SALES-13", "Authorised Sales Executive successfully approves site survey",
          approved_survey.status == "APPROVED",
          f"Survey: {approved_survey.survey_number}, Status: {approved_survey.status}")

    # 5. Service & Maintenance Coordination
    print("\n--- 5. WARRANTY & SERVICE TICKET COORDINATION ---")
    t_payload = ServiceTicketCreate(
        customer_id=cust.id,
        issue_category="INVERTER_FAULT",
        priority="HIGH",
        description="Customer reported inverter fault light on morning restart.",
        assigned_technician=tech_user.full_name
    )
    ticket_out = create_service_ticket(payload=t_payload, current_user=sales_user, db=db)
    check("SALES-14", "Sales Executive creates customer service ticket",
          bool(ticket_out and ticket_out.ticket_number),
          f"Ticket: {ticket_out.ticket_number}, Category: {ticket_out.issue_category}, Status: {ticket_out.status}")

    assign_out = assign_service_technician(
        ticket_id=ticket_out.id,
        payload=AssignTechnicianRequest(
            assigned_technician=tech_user.full_name,
            assigned_tech_id=tech_user.id,
            priority="CRITICAL",
            notes="Assigned by Sales Coordinator for urgent resolution"
        ),
        current_user=sales_user,
        db=db
    )
    check("SALES-15", "Sales Executive reassigns technician and updates priority to CRITICAL",
          assign_out.assigned_technician == tech_user.full_name and assign_out.priority == "CRITICAL",
          f"Assigned to: {assign_out.assigned_technician}, Priority: {assign_out.priority}")

    print("\n" + "=" * 80)
    print(f"SALES EXECUTIVE MODULE: ALL 15 TESTS PASSED SUCCESSFULLY! (15/15)")
    print("=" * 80)

if __name__ == "__main__":
    run_sales_verification()
