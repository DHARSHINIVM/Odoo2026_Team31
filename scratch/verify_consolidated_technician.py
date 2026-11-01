"""
Verification Suite for Prompt 3: Consolidate Survey and Installation Technicians
SunPower Solutions — Unified Field Technician Implementation
"""
import os
import sys
import json
import datetime

# Ensure app package is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
sys.path.insert(0, os.path.join(root_dir, "backend"))

from app.database import SessionLocal  # type: ignore # pyrefly: ignore[missing-import]
from app.models import User, SiteSurvey, Installation, Order, Enquiry, Customer  # type: ignore # pyrefly: ignore[missing-import]
from app.routers.auth import update_user_capabilities, get_team_members_by_role, UpdateUserCapabilitiesRequest  # type: ignore # pyrefly: ignore[missing-import]
from app.routers.surveys import assign_survey_technician, approve_survey, SurveyAssignRequest, SurveyReviewRequest  # type: ignore # pyrefly: ignore[missing-import]
from app.routers.installations import assign_installation_team, list_installations, InstallationAssignRequest  # type: ignore # pyrefly: ignore[missing-import]
from fastapi import HTTPException  # type: ignore # pyrefly: ignore[missing-import]


def run_prompt3_verification():
    db = SessionLocal()
    print("=" * 80)
    print("PROMPT 3: CONSOLIDATED FIELD TECHNICIAN VERIFICATION SUITE")
    print("=" * 80)

    results = []

    def record(tid, name, passed, details=""):
        status_str = "[PASS]" if passed else "[FAIL]"
        print(f"\n{status_str} {tid}: {name}")
        if details:
            print(f"       Details: {details}")
        results.append({"id": tid, "name": name, "passed": passed, "details": details})

    # Retrieve or create test users
    admin = db.query(User).filter(User.role == "ADMIN").first()
    survey_mgr = db.query(User).filter(User.role == "SURVEY_MANAGER").first()

    # 1. Setup Unified Field Technician
    tech_unified = db.query(User).filter(User.username == "tech_unified_field").first()
    if not tech_unified:
        tech_unified = User(
            username="tech_unified_field",
            email="tech.unified@sunpower.com",
            full_name="Vikram Salunkhe (Senior Field Tech)",
            role="FIELD_TECHNICIAN",
            department="Operations",
            designation="Senior Field Operations Engineer",
            is_active=True
        )
        tech_unified.set_password("Password@123")
        tech_unified.set_capabilities([
            "SURVEY_EXECUTION", "INSTALLATION_EXECUTION", "ELECTRICAL_TESTING",
            "CAMERA_CAPTURE", "COMPONENT_VERIFICATION", "PASSPORT_UPDATES", "CUSTOMER_ACK"
        ])
        db.add(tech_unified)
        db.commit()
        db.refresh(tech_unified)

    # 2. Setup Assistant Field Technician
    tech_assistant = db.query(User).filter(User.username == "tech_assistant_field").first()
    if not tech_assistant:
        tech_assistant = User(
            username="tech_assistant_field",
            email="assistant.tech@sunpower.com",
            full_name="Pooja Shinde (Field Specialist)",
            role="FIELD_TECHNICIAN",
            department="Operations",
            designation="Field Specialist",
            is_active=True
        )
        tech_assistant.set_password("Password@123")
        tech_assistant.set_capabilities(["INSTALLATION_EXECUTION", "CAMERA_CAPTURE"])
        db.add(tech_assistant)
        db.commit()
        db.refresh(tech_assistant)

    # 3. Setup Restricted Technician (No survey capability)
    tech_restricted = db.query(User).filter(User.username == "tech_restricted_field").first()
    if not tech_restricted:
        tech_restricted = User(
            username="tech_restricted_field",
            email="restricted.tech@sunpower.com",
            full_name="Santosh Mane (Junior Helper)",
            role="FIELD_TECHNICIAN",
            department="Operations",
            designation="Trainee Field Hand",
            is_active=True
        )
        tech_restricted.set_password("Password@123")
        db.add(tech_restricted)
    
    # Always reset restricted technician to ELECTRICAL_TESTING only for reproducible testing
    tech_restricted.set_capabilities(["ELECTRICAL_TESTING"])
    db.commit()
    db.refresh(tech_restricted)

    # TEST 1: Single Field Technician Identity with Configurable Capabilities
    try:
        caps = tech_unified.capability_list
        has_survey = tech_unified.has_capability("SURVEY_EXECUTION")
        has_install = tech_unified.has_capability("INSTALLATION_EXECUTION")
        passed = has_survey and has_install and len(caps) >= 7
        record("TC-FT-01", "Unified Field Technician identity with multi-disciplinary capabilities", passed,
               f"Capabilities ({len(caps)}): {caps}")
    except Exception as e:
        record("TC-FT-01", "Unified Field Technician identity", False, str(e))

    # TEST 2: Team Member Discovery Across Roles
    try:
        survey_team = get_team_members_by_role("SURVEY_TECHNICIAN", db=db)
        install_team = get_team_members_by_role("INSTALLATION_TECHNICIAN", db=db)
        field_team = get_team_members_by_role("FIELD_TECHNICIAN", db=db)

        survey_tech_ids = [m["id"] for m in survey_team]
        install_tech_ids = [m["id"] for m in install_team]
        field_tech_ids = [m["id"] for m in field_team]

        unified_in_survey = tech_unified.id in survey_tech_ids
        unified_in_install = tech_unified.id in install_tech_ids
        unified_in_field = tech_unified.id in field_tech_ids

        passed = unified_in_survey and unified_in_install and unified_in_field
        record("TC-FT-02", "Team discovery includes Unified Technician in both Survey and Installation pools", passed,
               f"Survey pool contains: {unified_in_survey}, Install pool contains: {unified_in_install}, Field pool contains: {unified_in_field}")
    except Exception as e:
        record("TC-FT-02", "Team discovery across roles", False, str(e))

    # TEST 3: Assign Survey to Qualified Unified Field Technician
    survey = db.query(SiteSurvey).first()
    if survey:
        try:
            req = SurveyAssignRequest(
                technician_id=tech_unified.id,
                technician_name=tech_unified.full_name,
                survey_date=datetime.datetime.now(datetime.timezone.utc)
            )
            res = assign_survey_technician(survey.id, req, db=db)
            passed = res.assigned_technician_id == tech_unified.id
            record("TC-FT-03", "Survey assignment to qualified Field Technician", passed,
                   f"Survey #{res.survey_number} assigned to: {res.surveyor_name} (ID: {res.assigned_technician_id})")
        except Exception as e:
            record("TC-FT-03", "Survey assignment to qualified Field Technician", False, str(e))
    else:
        record("TC-FT-03", "Survey assignment", False, "No SiteSurvey in DB")

    # TEST 4: Block Survey Assignment to Technician Lacking SURVEY_EXECUTION
    if survey:
        try:
            req = SurveyAssignRequest(
                technician_id=tech_restricted.id,
                technician_name=tech_restricted.full_name,
                survey_date=datetime.datetime.now(datetime.timezone.utc)
            )
            assign_survey_technician(survey.id, req, db=db)
            record("TC-FT-04", "Enforce capability guard on survey assignment", False,
                   "Unqualified technician was assigned without error!")
        except HTTPException as e:
            passed = e.status_code == 400 and "SURVEY_EXECUTION" in e.detail
            record("TC-FT-04", "Enforce capability guard on survey assignment", passed,
                   f"Correctly blocked with HTTP {e.status_code}: {e.detail}")

    # TEST 5: Independent Survey Manager Approval Authority & Self-Approval Prevention
    if survey and survey_mgr:
        # Re-assign survey to tech_unified
        survey.assigned_technician_id = tech_unified.id
        survey.status = "SUBMITTED"
        db.commit()

        # Assigned Field Technician attempting self-approval -> Must be blocked (403)
        try:
            approve_survey(survey.id, None, current_user=tech_unified, db=db)
            record("TC-FT-05A", "Technician strictly forbidden from self-approving their survey", False,
                   "Technician was allowed to self-approve!")
        except HTTPException as e:
            passed = e.status_code == 403
            record("TC-FT-05A", "Technician strictly forbidden from self-approving their survey", passed,
                   f"Correctly blocked with HTTP {e.status_code}: {e.detail}")

        # Independent Survey Manager approving -> Must succeed (200)
        try:
            rev_req = SurveyReviewRequest(review_notes="Measurements and shadow analysis validated by Manager.")
            approved_survey = approve_survey(survey.id, rev_req, current_user=survey_mgr, db=db)
            passed = approved_survey.status == "APPROVED"
            record("TC-FT-05B", "Independent Survey Manager retains approval authority", passed,
                   f"Survey #{approved_survey.survey_number} approved with status: '{approved_survey.status}'")
        except Exception as e:
            record("TC-FT-05B", "Independent Survey Manager retains approval authority", False, str(e))

    # TEST 6: Multi-Technician Installation Assignment
    installation = db.query(Installation).first()
    if installation and admin:
        try:
            assign_req = InstallationAssignRequest(
                assigned_tech_id=tech_unified.id,
                assigned_technician=f"{tech_unified.full_name} (Lead Solar Engineer)",
                team_technician_ids=[tech_assistant.id],
                scheduled_start_date=datetime.datetime.now(datetime.timezone.utc),
                team_notes="Lead engineer with 1 assistant specialist for rooftop mounting and wiring."
            )
            updated_inst = assign_installation_team(installation.id, assign_req, current_user=admin, db=db)
            lead_assigned = updated_inst.assigned_tech_id == tech_unified.id
            team_included = tech_assistant.id in updated_inst.team_technician_ids
            size_correct = updated_inst.team_size >= 2
            passed = lead_assigned and team_included and size_correct
            record("TC-FT-06", "Multi-technician installation assignment with lead and team members", passed,
                   f"Lead: {updated_inst.lead_engineer} (ID: {updated_inst.assigned_tech_id}), Team: {updated_inst.team_technician_ids}, Size: {updated_inst.team_size}")
        except Exception as e:
            record("TC-FT-06", "Multi-technician installation assignment", False, str(e))
    else:
        record("TC-FT-06", "Multi-technician installation assignment", False, "No Installation record in DB")

    # TEST 7: Both Lead and Team Assistant Access Installation
    if installation:
        try:
            lead_insts = list_installations(current_user=tech_unified, db=db)
            assistant_insts = list_installations(current_user=tech_assistant, db=db)
            lead_has = any(i.id == installation.id for i in lead_insts)
            assistant_has = any(i.id == installation.id for i in assistant_insts)
            passed = lead_has and assistant_has
            record("TC-FT-07", "Both Lead and Assistant technicians can view and access shared installation", passed,
                   f"Lead saw: {len(lead_insts)} jobs (has current: {lead_has}); Assistant saw: {len(assistant_insts)} jobs (has current: {assistant_has})")
        except Exception as e:
            record("TC-FT-07", "Shared installation access", False, str(e))

    # TEST 8: Block Installation Assignment to Technician Lacking INSTALLATION_EXECUTION
    if installation and admin:
        try:
            assign_req = InstallationAssignRequest(
                assigned_tech_id=tech_restricted.id,
                team_technician_ids=[]
            )
            assign_installation_team(installation.id, assign_req, current_user=admin, db=db)
            record("TC-FT-08", "Enforce capability guard on installation lead assignment", False,
                   "Unqualified technician assigned as lead!")
        except HTTPException as e:
            passed = e.status_code == 400 and "INSTALLATION_EXECUTION" in e.detail
            record("TC-FT-08", "Enforce capability guard on installation lead assignment", passed,
                   f"Correctly blocked with HTTP {e.status_code}: {e.detail}")

    # TEST 9: Admin Configurable Capabilities Management Endpoint
    if admin:
        try:
            # Dynamically grant SURVEY_EXECUTION to tech_restricted
            update_req = UpdateUserCapabilitiesRequest(capabilities=["ELECTRICAL_TESTING", "SURVEY_EXECUTION"])
            updated_user = update_user_capabilities(tech_restricted.id, update_req, current_user=admin, db=db)
            now_has_survey = tech_restricted.has_capability("SURVEY_EXECUTION")
            record("TC-FT-09", "Manager/Admin can dynamically configure technician capabilities", now_has_survey,
                   f"Updated capabilities for {updated_user.full_name}: {updated_user.capability_list}")
        except Exception as e:
            record("TC-FT-09", "Manager/Admin capability management endpoint", False, str(e))

    print("\n" + "=" * 80)
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    pct = round((passed_count / total_count) * 100, 1) if total_count > 0 else 0
    print(f"PROMPT 3 VERIFICATION SUMMARY: {passed_count}/{total_count} PASSED ({pct}%)")
    print("=" * 80)
    db.close()


if __name__ == "__main__":
    run_prompt3_verification()
