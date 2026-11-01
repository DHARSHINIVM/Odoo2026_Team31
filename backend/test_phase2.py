import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import SessionLocal
from app.services.auth_service import create_access_token, decode_access_token
from app.routers.auth import login, LoginRequest, get_current_user_profile, list_company_users, get_team_members_by_role
from app.routers.role_dashboards import (
    get_admin_dashboard, get_sales_dashboard, get_survey_manager_dashboard,
    get_survey_technician_dashboard, get_warehouse_dashboard, get_installation_technician_dashboard,
    get_service_manager_dashboard
)
from app.routers.surveys import approve_survey, SurveyReviewRequest
from app.routers.subsidies import list_subsidy_applications, update_subsidy_status, UpdateSubsidyStatusRequest
from app.routers.analytics import get_all_installations_profitability
from app.routers.notifications import get_user_notifications
from app.models import User, SiteSurvey, SubsidyApplication
from fastapi import HTTPException


def run_phase2_verification():
    db = SessionLocal()
    print("==================================================")
    print("SUNPOWER SOLUTIONS — PHASE 2 VERIFICATION TEST SUITE")
    print("==================================================")
    
    # 1. Test Logins for all 7 roles via the login router
    roles = [
        ("admin@sunpower.com", "ADMIN"),
        ("sales@sunpower.com", "SALES_EXECUTIVE"),
        ("surveymgr@sunpower.com", "SURVEY_MANAGER"),
        ("surveytech@sunpower.com", "SURVEY_TECHNICIAN"),
        ("warehouse@sunpower.com", "WAREHOUSE_MANAGER"),
        ("installtech@sunpower.com", "INSTALLATION_TECHNICIAN"),
        ("servicemgr@sunpower.com", "SERVICE_MANAGER"),
    ]
    
    tokens = {}
    users = {}
    for email, expected_role in roles:
        req = LoginRequest(username_or_email=email, password="Password@123", expected_role=expected_role)
        login_res = login(payload=req, db=db)
        assert login_res.access_token is not None, f"No token returned for {email}"
        assert login_res.user.role == expected_role, f"Role mismatch for {email}: {login_res.user.role} != {expected_role}"
        
        # Verify token claims
        claims = decode_access_token(login_res.access_token)
        assert claims["role"] == expected_role
        
        user_entity = db.query(User).filter(User.id == login_res.user.id).first()
        tokens[expected_role] = login_res.access_token
        users[expected_role] = user_entity
        print(f"PASS: Login & Token for {expected_role} ({user_entity.full_name})")

    # 2. Test Role Dashboards for all 7 roles
    admin_dash = get_admin_dashboard(current_user=users["ADMIN"], db=db)
    assert "kpis" in admin_dash
    print(f"PASS: Admin Dashboard (Total Revenue Rs. {admin_dash['kpis']['recognized_revenue_inr']:,})")

    sales_dash = get_sales_dashboard(current_user=users["SALES_EXECUTIVE"], db=db)
    assert "kpis" in sales_dash
    print(f"PASS: Sales Dashboard (Assigned Enquiries: {sales_dash['kpis']['assigned_enquiries']})")

    sm_dash = get_survey_manager_dashboard(current_user=users["SURVEY_MANAGER"], db=db)
    assert "kpis" in sm_dash
    print(f"PASS: Survey Manager Dashboard (Awaiting Approval: {sm_dash['kpis']['awaiting_approval']})")

    st_dash = get_survey_technician_dashboard(current_user=users["SURVEY_TECHNICIAN"], db=db)
    assert "kpis" in st_dash
    print(f"PASS: Survey Technician Dashboard (My Surveys: {st_dash['kpis']['my_assigned_surveys']})")

    wh_dash = get_warehouse_dashboard(current_user=users["WAREHOUSE_MANAGER"], db=db)
    assert "kpis" in wh_dash
    print(f"PASS: Warehouse Dashboard (Available Stock: {wh_dash['kpis']['available_stock']})")

    inst_dash = get_installation_technician_dashboard(current_user=users["INSTALLATION_TECHNICIAN"], db=db)
    assert "kpis" in inst_dash
    print(f"PASS: Installation Dashboard (Assigned Installations: {inst_dash['kpis']['my_assigned_installations']})")

    svc_dash = get_service_manager_dashboard(current_user=users["SERVICE_MANAGER"], db=db)
    assert "kpis" in svc_dash
    print(f"PASS: Service Dashboard (Open Tickets: {svc_dash['kpis']['open_tickets']})")

    # 3. Test RBAC: Survey Tech cannot approve their own survey (Self-Approval Hard Block)
    sub_survey = db.query(SiteSurvey).filter(SiteSurvey.survey_number == "SRV-2026-008").first()
    if not sub_survey:
        sub_survey = db.query(SiteSurvey).first()
    sub_survey.status = "SUBMITTED"
    sub_survey.assigned_technician_id = users["SURVEY_TECHNICIAN"].id
    db.commit()
    db.refresh(sub_survey)
    
    self_approval_blocked = False
    try:
        approve_survey(
            survey_id=sub_survey.id,
            payload=SurveyReviewRequest(review_notes="I approve my own survey"),
            current_user=users["SURVEY_TECHNICIAN"],
            db=db
        )
    except HTTPException as e:
        if e.status_code == 403:
            self_approval_blocked = True
            print(f"PASS: RBAC Self-Approval Block Triggered correctly (HTTP {e.status_code}: {e.detail})")
    
    assert self_approval_blocked, "Survey technician was able to approve their own survey! RBAC violation!"

    # 4. Survey Manager approval succeeds
    approved_res = approve_survey(
        survey_id=sub_survey.id,
        payload=SurveyReviewRequest(review_notes="Approved by Survey Manager Suresh Patil."),
        current_user=users["SURVEY_MANAGER"],
        db=db
    )
    assert approved_res.status == "APPROVED"
    print(f"PASS: Survey Manager approval succeeded for Survey #{sub_survey.survey_number}")

    # 5. Test Subsidies
    subsidy_list = list_subsidy_applications(db=db)
    assert len(subsidy_list) >= 4
    first_sub = subsidy_list[0]
    updated_sub = update_subsidy_status(
        id=first_sub.id,
        payload=UpdateSubsidyStatusRequest(status="INSPECTION_CLEARED", reviewer_notes="DISCOM net meter inspection completed."),
        db=db
    )
    assert updated_sub.status == "INSPECTION_CLEARED"
    print(f"PASS: PM Surya Ghar Subsidy Tracking ({len(subsidy_list)} applications, status update verified)")

    # 6. Test Profitability Analytics
    profit_res = get_all_installations_profitability(db=db)
    assert "summary" in profit_res
    print(f"PASS: Installation-Level Profitability (Contribution Margin: {profit_res['summary']['overall_contribution_margin_pct']}%)")

    # 7. Test In-App Notifications
    notifs = get_user_notifications(current_user=users["SALES_EXECUTIVE"], db=db)
    assert len(notifs) >= 1
    print(f"PASS: Notifications System ({len(notifs)} notifications retrieved for Sales Rep)")

    print("==================================================")
    print("ALL 7 PHASE 2 TEST SUITES PASSED SUCCESSFULLY!")
    print("==================================================")
    db.close()

if __name__ == "__main__":
    run_phase2_verification()
