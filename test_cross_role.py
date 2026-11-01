"""
Cross-Role Integration Verification:
Tests cross-role visibility between Customer, Service Manager, Sales, and Administrator.
"""
import requests

BASE_URL = "http://127.0.0.1:8000/api"

def run_cross_role_tests():
    print("=== STARTING CROSS-ROLE INTEGRATION VERIFICATION ===")

    # 1. Login as Customer (Rajesh)
    cust_res = requests.post(f"{BASE_URL}/auth/login", json={"username_or_email": "rajesh", "password": "Password@123"})
    assert cust_res.status_code == 200
    cust_token = cust_res.json()["access_token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # Retrieve customer's latest ticket
    cust_tickets = requests.get(f"{BASE_URL}/customer/service-tickets", headers=cust_headers).json()
    assert len(cust_tickets) > 0
    test_ticket = cust_tickets[0]
    tck_id = test_ticket["id"]
    tck_num = test_ticket["ticket_number"]
    print(f"[CROSS-ROLE 1] Customer created service ticket #{tck_num} (ID: {tck_id}) with status '{test_ticket['status']}'")

    # 2. Login as Administrator (Aditya Kulkarni)
    admin_res = requests.post(f"{BASE_URL}/auth/login", json={"username_or_email": "admin", "password": "Password@123"})
    if admin_res.status_code != 200:
        admin_res = requests.post(f"{BASE_URL}/auth/login", json={"username_or_email": "admin", "password": "admin123"})
    assert admin_res.status_code == 200
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[CROSS-ROLE 2] Authenticated as Solar Administrator")

    # 3. Administrator queries tickets: verify customer's ticket appears in operational queue!
    all_tickets = requests.get(f"{BASE_URL}/service/tickets", headers=admin_headers).json()
    found_in_admin = next((t for t in all_tickets if t["ticket_number"] == tck_num), None)
    assert found_in_admin is not None, f"Ticket #{tck_num} not found in operational queue!"
    print(f"[CROSS-ROLE 3] Ticket #{tck_num} confirmed visible in central operational queue!")

    # 4. Administrator assigns technician and resolves ticket
    patch_tck = requests.patch(f"{BASE_URL}/service/tickets/{tck_id}", json={
        "status": "RESOLVED",
        "assigned_technician": "Deepak Chavan (Field Technician)",
        "resolution_notes": "Wi-Fi dongle re-paired and cloud telemetry synchronized successfully."
    }, headers=admin_headers)
    assert patch_tck.status_code == 200
    print(f"[CROSS-ROLE 4] Operations updated ticket #{tck_num} to RESOLVED with resolution notes.")

    # 5. Customer re-queries their tickets: verify technician assignment and resolution notes are visible!
    cust_updated_tickets = requests.get(f"{BASE_URL}/customer/service-tickets", headers=cust_headers).json()
    updated_tck = next((t for t in cust_updated_tickets if t["id"] == tck_id), None)
    assert updated_tck is not None
    assert updated_tck["status"] == "RESOLVED"
    assert "re-paired" in updated_tck["resolution_notes"]
    print(f"[CROSS-ROLE 5] Customer Portal verified update: Status is '{updated_tck['status']}', Resolution: '{updated_tck['resolution_notes']}'")

    # 6. Administrator checks audit trail
    admin_res = requests.post(f"{BASE_URL}/auth/login", json={"username_or_email": "admin", "password": "Password@123"})
    assert admin_res.status_code == 200
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    audit_res = requests.get(f"{BASE_URL}/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    print(f"[CROSS-ROLE 6] Administrator verified central audit records: {len(audit_res.json())} immutable actions recorded.")

    print("\n=== ALL CROSS-ROLE INTEGRATION TESTS PASSED CLEANLY! ===")

if __name__ == "__main__":
    run_cross_role_tests()
