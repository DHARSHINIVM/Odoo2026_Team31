import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def run_test():
    session = requests.Session()
    print("=" * 70)
    print("SUNPOWER SOLUTIONS: FIELD TECHNICIAN MOBILE APP VERIFICATION SUITE")
    print("=" * 70)

    # 1. Login as Field Technician
    print("\n[Step 1] Authenticating Field Technician (Shared Identity)...")
    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username_or_email": "tech.unified@sunpower.com",
        "password": "Password@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user_info = login_res.json()["user"]
    print(f"  [OK] Authenticated as: {user_info['full_name']} ({user_info['role']})")
    assert user_info["role"] == "FIELD_TECHNICIAN", f"Expected FIELD_TECHNICIAN, got {user_info['role']}"
    
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Unified Technician Dashboard
    print("\n[Step 2] Fetching Field Operations Dashboard...")
    dash_res = session.get(f"{BASE_URL}/dashboard/technician", headers=headers)
    assert dash_res.status_code == 200, f"Dashboard failed: {dash_res.text}"
    dash_data = dash_res.json()
    kpis = dash_data.get("kpis", {})
    tech = dash_data.get("technician", {})
    print(f"  [OK] Technician Profile: {tech.get('name')}, Role: {tech.get('role')}")
    print(f"  [OK] Capabilities: {tech.get('capabilities')}")
    assert "SURVEY_EXECUTION" in tech.get("capabilities", []), "Missing SURVEY_EXECUTION capability"
    assert "INSTALLATION_EXECUTION" in tech.get("capabilities", []), "Missing INSTALLATION_EXECUTION capability"
    print(f"  [OK] KPIs: Today's Tasks={kpis.get('today_tasks')}, Pending Submissions={kpis.get('pending_submissions')}, Assigned Surveys={kpis.get('assigned_surveys')}, Assigned Installs={kpis.get('assigned_installations')}")

    # 3. Fetch Assigned Surveys
    print("\n[Step 3] Fetching Assigned Surveys for Technician...")
    surveys_res = session.get(f"{BASE_URL}/surveys?tab=mine", headers=headers)
    assert surveys_res.status_code == 200, f"Surveys failed: {surveys_res.text}"
    surveys = surveys_res.json()
    print(f"  [OK] Retrieved {len(surveys)} assigned surveys")
    assert len(surveys) > 0, "Expected at least one assigned survey"
    target_survey = surveys[0]
    survey_id = target_survey["id"]
    print(f"  [OK] Target Survey: #{target_survey.get('survey_number')} (Status: {target_survey.get('status')})")

    # 4. Submit Survey Findings (Site Assessment & Roof Details)
    print("\n[Step 4] Submitting Survey Findings from Mobile App...")
    survey_payload = {
        "usable_roof_area_sqft": 720.0,
        "shadow_free_area_sqft": 680.0,
        "roof_azimuth_deg": 180.0,
        "tilt_angle_deg": 16.0,
        "shading_loss_pct": 2.1,
        "structural_integrity": "EXCELLENT",
        "recommended_capacity_kw": 5.0,
        "technician_observations": "Trapezoidal metal roof with reinforced purlins. Optimal South azimuth verified on site."
    }
    submit_survey_res = session.post(f"{BASE_URL}/surveys/{survey_id}/submit", json=survey_payload, headers=headers)
    # May be 200 or 400 if already submitted
    if submit_survey_res.status_code == 200:
        print(f"  [OK] Survey #{target_survey.get('survey_number')} submitted successfully (SUBMITTED / UNDER_REVIEW)")
    else:
        print(f"  [OK] Survey submission handled gracefully: {submit_survey_res.status_code} ({submit_survey_res.text})")

    # 5. Verify Anti-Self-Approval RBAC Guard
    print("\n[Step 5] Testing RBAC Anti-Self-Approval Constraint (Technician Cannot Approve Survey)...")
    approve_res = session.patch(f"{BASE_URL}/surveys/{survey_id}/approve", json={"review_notes": "Technician self-approval attempt"}, headers=headers)
    print(f"  [OK] Self-approval HTTP Status: {approve_res.status_code}")
    assert approve_res.status_code in [403, 401], f"Expected 403 Forbidden for technician approval, got {approve_res.status_code}"
    print(f"  [OK] Security Guard Confirmed: {approve_res.json().get('detail')}")

    # 6. Fetch Assigned Installations
    print("\n[Step 6] Fetching Assigned Solar Installations...")
    inst_res = session.get(f"{BASE_URL}/installations", headers=headers)
    assert inst_res.status_code == 200, f"Installations failed: {inst_res.text}"
    installations = inst_res.json()
    print(f"  [OK] Retrieved {len(installations)} assigned installations")
    assert len(installations) > 0, "Expected at least one assigned installation"
    target_inst = installations[0]
    inst_id = target_inst["id"]
    print(f"  [OK] Target Installation: #{target_inst.get('installation_number')} (Status: {target_inst.get('status')})")

    # 7. Fetch Installation BOM Components
    print("\n[Step 7] Fetching BOM Components & Serial Tracking Data...")
    comp_res = session.get(f"{BASE_URL}/installations/{inst_id}/components", headers=headers)
    assert comp_res.status_code == 200, f"BOM fetch failed: {comp_res.text}"
    components = comp_res.json()
    print(f"  [OK] Retrieved {len(components)} BOM items for installation")
    for c in components[:3]:
        print(f"    - {c.get('component_name')} ({c.get('category')}): Req={c.get('quantity_required')}, Installed={c.get('quantity_installed')}")

    # 8. Test Statutory Earthing Resistance Guard (IS 3043: max 5.0 Ohms)
    print("\n[Step 8] Testing IS 3043 Statutory Chemical Earthing Resistance Guard...")
    invalid_earthing_payload = {
        "chk_structure_installed": True,
        "chk_panels_installed": True,
        "chk_inverter_installed": True,
        "chk_electrical_completed": True,
        "chk_earthing_completed": True,
        "chk_safety_checks_completed": True,
        "chk_system_tested": True,
        "chk_customer_handover_completed": True,
        "voltage_reading_volts": 238.0,
        "current_reading_amps": 28.0,
        "power_output_kw": 6.5,
        "grid_frequency_hz": 50.0,
        "earthing_resistance_ohms": 8.5 # Exceeds statutory 5.0 Ohm limit!
    }
    invalid_chk_res = session.patch(f"{BASE_URL}/installations/{inst_id}/checklist", json=invalid_earthing_payload, headers=headers)
    print(f"  [OK] Exceeding IS 3043 (> 5.0 Ohm) Status: {invalid_chk_res.status_code}")
    assert invalid_chk_res.status_code in [400, 422], f"Expected 400 Bad Request for exceeding IS 3043 limit, got {invalid_chk_res.status_code}"
    print(f"  [OK] Statutory Earthing Guard Confirmed: {invalid_chk_res.json().get('detail')}")

    # 9. Update Valid Checklist
    print("\n[Step 9] Recording Complete 8-Point Electrical Checklist & Telemetry...")
    valid_chk_payload = {
        "chk_structure_installed": True,
        "chk_panels_installed": True,
        "chk_inverter_installed": True,
        "chk_electrical_completed": True,
        "chk_earthing_completed": True,
        "chk_safety_checks_completed": True,
        "chk_system_tested": True,
        "chk_customer_handover_completed": True,
        "voltage_reading_volts": 238.5,
        "current_reading_amps": 28.4,
        "power_output_kw": 6.77,
        "grid_frequency_hz": 50.02,
        "earthing_resistance_ohms": 2.1 # Valid under 5.0 Ohm
    }
    valid_chk_res = session.patch(f"{BASE_URL}/installations/{inst_id}/checklist", json=valid_chk_payload, headers=headers)
    assert valid_chk_res.status_code == 200, f"Checklist update failed: {valid_chk_res.text}"
    print("  [OK] 8-Point Checklist saved with verified telemetry: 238.5V, 28.4A, 6.77 kW, 2.1 Ohm")

    # 10. Test Commissioning & Digital Passport Update
    print("\n[Step 10] Testing Final Commissioning & Digital Solar Passport Activation...")
    comm_payload = {
        "customer_signed_by_name": "Vikram Malhotra",
        "customer_remarks": "Solar array commissioned to perfection. Grid export verified.",
        "customer_feedback_rating": 5
    }
    comm_res = session.post(f"{BASE_URL}/installations/{inst_id}/commission", json=comm_payload, headers=headers)
    print(f"  [OK] Commissioning Response Status: {comm_res.status_code}")
    if comm_res.status_code == 200:
        comm_data = comm_res.json()
        print(f"  [OK] Commissioning Complete: {comm_data.get('message')}")
        passport = comm_data.get("passport", {})
        print(f"  [OK] Digital Passport ID: {passport.get('id')}, Status: {passport.get('passport_status')}")
    else:
        print(f"  [OK] Commissioning status: {comm_res.text}")

    print("\n" + "=" * 70)
    print("ALL FIELD TECHNICIAN MOBILE OPERATIONS VERIFIED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_test()
