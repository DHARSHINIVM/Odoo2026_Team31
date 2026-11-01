import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(os.path.dirname(current_dir), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import (
    User, Customer, Enquiry, SiteSurvey, Quotation, Order, Package, Component,
    SystemConfiguration, WarrantyPolicy, Payment
)
from app.routers.role_dashboards import get_admin_dashboard
from app.routers.auth import (
    get_roles_permissions_matrix, list_user_sessions,
    revoke_user_sessions_endpoint, reset_user_password, ResetPasswordRequest
)
from app.routers.master_data import (
    get_master_data_overview, list_master_packages, list_master_components,
    get_bom_templates, get_pricing_tax_configuration, get_technical_checklists,
    get_commissioning_test_templates, get_warranty_terms, get_system_configuration,
    create_master_package, PackageCreateRequest
)

def run_admin_verification():
    print("=" * 80)
    print("SUNPOWER SOLUTIONS — ADMINISTRATOR MODULE FUNCTIONAL VERIFICATION")
    print("=" * 80)

    db: Session = SessionLocal()
    admin_user = db.query(User).filter(User.role == "ADMIN").first()
    sales_user = db.query(User).filter(User.role == "SALES_EXECUTIVE").first()
    assert admin_user, "Admin user must exist"

    results = []
    def check(code, desc, ok, details=""):
        status_tag = "[PASS]" if ok else "[FAIL]"
        print(f"{status_tag} {code}: {desc}")
        if details:
            print(f"       Details: {details}")
        results.append((code, ok))
        assert ok, f"FAILED {code}: {desc}"

    # 1. Executive Dashboard
    admin_dash = get_admin_dashboard(current_user=admin_user, db=db)
    check("ADM-01", "GET /dashboard/admin returns executive payload", bool(admin_dash))
    kpis = admin_dash.get("kpis", {})
    check("ADM-02", "Executive Dashboard calculates total order value & money received",
          "total_order_value_inr" in kpis and "verified_payments_inr" in kpis and "outstanding_balance_inr" in kpis,
          f"Order Value: Rs.{kpis.get('total_contract_inr')}, Received: Rs.{kpis.get('verified_payments_inr')}, Outstanding: Rs.{kpis.get('outstanding_balance_inr')}")
    check("ADM-03", "Executive Dashboard calculates survey, dispatch & installation progress",
          "survey_progress" in admin_dash and "dispatch_progress" in admin_dash and "installation_progress" in admin_dash,
          f"Surveys: {admin_dash.get('survey_progress')}")
    check("ADM-04", "Executive Dashboard calculates operational exceptions",
          "operational_exceptions" in admin_dash and isinstance(admin_dash["operational_exceptions"], list),
          f"Found {len(admin_dash.get('operational_exceptions', []))} active exceptions/overdue flags")

    # 2. Roles & Granular Permissions
    roles_perms = get_roles_permissions_matrix(current_user=admin_user)
    check("ADM-05", "GET /auth/roles-permissions returns 5 approved roles matrix",
          len(roles_perms.get("approved_roles", [])) >= 5,
          f"Roles: {[r['role'] for r in roles_perms.get('approved_roles', [])]}")

    # 3. User Session Management
    sessions = list_user_sessions(user_id=admin_user.id, current_user=admin_user, db=db)
    check("ADM-06", "GET /auth/users/{id}/sessions returns active session history",
          isinstance(sessions, list), f"Found {len(sessions)} session records for admin")

    revoke_res = revoke_user_sessions_endpoint(user_id=admin_user.id, current_user=admin_user, db=db)
    check("ADM-07", "POST /auth/users/{id}/revoke-sessions executes successfully",
          revoke_res.get("success") is True, f"Result: {revoke_res.get('message')}")

    # 4. Password Reset
    test_emp = db.query(User).filter(User.username == "admintestemp").first()
    if not test_emp:
        test_emp = User(
            username="admintestemp",
            email="admintestemp@sunpower.com",
            full_name="Admin Test Employee",
            role="SALES_EXECUTIVE",
            is_active=True
        )
        test_emp.set_password("Password@123")
        db.add(test_emp)
        db.commit()
        db.refresh(test_emp)

    reset_res = reset_user_password(
        user_id=test_emp.id,
        payload=ResetPasswordRequest(new_password="NewSecurePassword@123"),
        current_user=admin_user,
        db=db
    )
    check("ADM-08", "POST /auth/users/{id}/reset-password updates password and revokes sessions",
          reset_res.get("success") is True, f"Result: {reset_res.get('message')}")

    # 5. Master Data Overview
    overview = get_master_data_overview(db=db)
    check("ADM-09", "GET /master-data/overview returns package & component statistics",
          overview.get("packages", {}).get("total", 0) > 0 and overview.get("components", {}).get("total", 0) > 0,
          f"Packages: {overview.get('packages')}, Components: {overview.get('components')}")

    # 6. Master Data Solar Packages (1-5 kW On-Grid & Off-Grid)
    pkgs = list_master_packages(db=db)
    check("ADM-10", "GET /master-data/packages lists 1-5 kW On-Grid & Off-Grid packages",
          len(pkgs) >= 8, f"Total packages: {len(pkgs)}")

    # 7. Create Master Package
    try:
        new_pkg_res = create_master_package(
            payload=PackageCreateRequest(
                code="PKG-ADM-VERIFY-1KW",
                name="Admin Verified 1kW Kit",
                capacity_kw=1.0,
                description="Verified 1kW test kit",
                total_price_paise=6500000
            ),
            current_user=admin_user,
            db=db
        )
        check("ADM-11", "POST /master-data/packages creates new package template",
              new_pkg_res.get("success") is True, f"Code: {new_pkg_res.get('code')}")
    except HTTPException as e:
        check("ADM-11", "POST /master-data/packages creates or handles duplicate gracefully",
              "already exists" in e.detail, f"Handled: {e.detail}")

    # 8. Components, BOM Templates, Pricing-Tax, Checklists, Tests, Warranty, System Config
    comps = list_master_components(db=db)
    check("ADM-12", "GET /master-data/components lists master component specs",
          len(comps) >= 10, f"Retrieved {len(comps)} components")

    bom = get_bom_templates(db=db)
    check("ADM-13", "GET /master-data/bom-templates returns standard 1-5 kW recipes",
          len(bom.get("templates", [])) >= 5, f"Recipes: {[t['name'] for t in bom.get('templates', [])]}")

    pricing = get_pricing_tax_configuration(db=db)
    check("ADM-14", "GET /master-data/pricing-tax returns GST rates and benchmark prices",
          "gst_rates" in pricing and "benchmark_prices_inr_per_kw" in pricing,
          f"Composite rate: {pricing.get('gst_rates', {}).get('effective_composite_rate_pct')}%")

    chks = get_technical_checklists(db=db)
    check("ADM-15", "GET /master-data/checklists returns survey & install checklists",
          len(chks.get("survey_checklist", [])) >= 5, f"Checklist items: {len(chks.get('survey_checklist', []))}")

    tests = get_commissioning_test_templates(db=db)
    check("ADM-16", "GET /master-data/commissioning-tests returns electrical test templates",
          len(tests.get("electrical_tests", [])) >= 5, f"Tests: {[t['test_name'] for t in tests.get('electrical_tests', [])]}")

    warranty = get_warranty_terms(db=db)
    check("ADM-17", "GET /master-data/warranty-terms returns policy terms",
          len(warranty.get("standard_terms", [])) >= 4, f"Terms: {len(warranty.get('standard_terms', []))}")

    sys_cfg = get_system_configuration(db=db)
    check("ADM-18", "GET /master-data/system-config returns SLAs and company profile",
          "company_name" in sys_cfg and "slas" in sys_cfg, f"Company: {sys_cfg.get('company_name')}")

    db.close()
    print("=" * 80)
    passed = sum(1 for _, ok in results if ok)
    print(f"ADMINISTRATOR MODULE VERIFICATION: {passed}/{len(results)} PASSED (100.0%)")
    print("=" * 80)

if __name__ == "__main__":
    run_admin_verification()
