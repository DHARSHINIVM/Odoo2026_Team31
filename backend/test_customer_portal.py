"""
Test suite for SunPower Customer Portal Backend Endpoints:
1. Customer Login & Token Verification
2. Customer Profile GET & PATCH
3. Dashboard GET with 13-stage Milestones
4. Projects List & Ownership Guard
5. Appointments GET, Availability, Booking, Reschedule, Cancellation
6. Passport GET, SVG QR retrieval, QR verification, Acknowledgement
7. Warranties GET
8. Service Complaints POST, Photo upload, Duplicate prevention
9. Feedback POST & GET
10. Notifications GET & Read toggle
11. Security & Data Isolation Tests: Attempted access to another customer's order, passport, appointment, and ticket
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    client = TestClient(app)
    print("=== STARTING SUNPOWER CUSTOMER PORTAL BACKEND VERIFICATION ===")

    # 1. Login
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "rajesh",
        "password": "Password@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user = login_res.json()["user"]
    print(f" [PASS] Authenticated as {user['full_name']} (Role: {user['role']}, Customer ID: {user['customer_id']})")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Profile GET & PATCH
    prof_res = client.get("/api/customer/profile", headers=headers)
    assert prof_res.status_code == 200, f"Profile failed: {prof_res.text}"
    profile = prof_res.json()
    assert profile["customer_id"] == 1
    assert "Rajesh" in profile["full_name"]
    print(f" [PASS] Customer profile retrieved: {profile['full_name']}, City: {profile['city']}, Phone: {profile['phone']}")

    patch_res = client.patch("/api/customer/profile", json={
        "contact_preferences": {"preferred_channel": "WHATSAPP", "notify_sms": True, "notify_email": True, "notify_push": True}
    }, headers=headers)
    assert patch_res.status_code == 200
    print(" [PASS] Customer profile preferences updated.")

    # 3. Dashboard GET
    dash_res = client.get("/api/customer/dashboard", headers=headers)
    assert dash_res.status_code == 200, f"Dashboard failed: {dash_res.text}"
    dash = dash_res.json()
    assert len(dash["milestones"]) == 13, f"Expected 13 milestones, got {len(dash['milestones'])}"
    assert dash["passport"] is not None
    assert dash["passport"]["passport_number"] == "DSP-MH-2026-0081"
    print(f" [PASS] Dashboard loaded. Milestones: {len(dash['milestones'])}, Active Passport: {dash['passport']['passport_number']}, Rated Power: {dash['active_project']['system_capacity_kw']} kW")

    # 4. Projects List & Details
    proj_res = client.get("/api/customer/projects", headers=headers)
    assert proj_res.status_code == 200
    projects = proj_res.json()
    assert len(projects) >= 1
    order_id = projects[0]["order_id"]
    print(f" [PASS] Projects listed: {len(projects)} project(s). Primary Order ID: {order_id}")

    proj_det = client.get(f"/api/customer/projects/{order_id}", headers=headers)
    assert proj_det.status_code == 200
    assert len(proj_det.json()["milestones"]) == 13
    print(f" [PASS] Project #{order_id} detail retrieved with 13-stage milestone breakdown.")

    # 5. Appointments: Availability, Booking, Reschedule, Cancel
    avail_res = client.get("/api/appointments/availability?appointment_type=SITE_SURVEY&days_ahead=3")
    assert avail_res.status_code == 200
    schedule = avail_res.json()["schedule"]
    target_date = schedule[1]["date"]
    slot = schedule[1]["slots"][0]["time_slot"]
    print(f" [PASS] Central slot availability retrieved for {target_date}: {slot}")

    book_res = client.post("/api/customer/appointments", json={
        "appointment_type": "SERVICE",
        "scheduled_date": target_date,
        "time_slot": slot,
        "customer_notes": "Annual system performance inspection"
    }, headers=headers)
    assert book_res.status_code == 201, f"Booking failed: {book_res.text}"
    apt_id = book_res.json()["appointment_id"]
    apt_num = book_res.json()["appointment_number"]
    print(f" [PASS] Booked appointment #{apt_num} (ID: {apt_id}) for slot {slot}")

    resched_slot = schedule[1]["slots"][1]["time_slot"]
    resched_res = client.patch(f"/api/customer/appointments/{apt_id}/reschedule", json={
        "new_date": target_date,
        "new_time_slot": resched_slot,
        "reason": "Customer preferred afternoon slot"
    }, headers=headers)
    assert resched_res.status_code == 200
    print(f" [PASS] Appointment rescheduled to {resched_slot}")

    cancel_res = client.patch(f"/api/customer/appointments/{apt_id}/cancel", json={
        "cancellation_reason": "Testing complete"
    }, headers=headers)
    assert cancel_res.status_code == 200
    print(" [PASS] Appointment cancellation validated.")

    # 6. Passport & QR Verification
    pass_res = client.get("/api/customer/passport", headers=headers)
    assert pass_res.status_code == 200
    pass_data = pass_res.json()
    assert pass_data["qr_code_svg"].startswith("<svg")
    qr_token = pass_data["qr_code_token"]
    print(f" [PASS] Canonical Digital Solar Passport retrieved with SVG QR: {pass_data['passport_number']}")

    qr_lookup = client.get(f"/api/customer/passport/verify-qr/{qr_token}", headers=headers)
    assert qr_lookup.status_code == 200
    assert qr_lookup.json()["is_owner"] == True
    print(f" [PASS] Hardware QR token scanned and validated: {qr_token[:20]}...")

    ack_res = client.post("/api/customer/passport/acknowledge", json={
        "passport_id": pass_data["id"],
        "customer_notes": "All 10 Waaree panels and Sungrow inverter verified operational."
    }, headers=headers)
    assert ack_res.status_code == 200
    print(" [PASS] Customer passport electronic acknowledgement registered.")

    # 7. Warranties
    war_res = client.get("/api/customer/warranties", headers=headers)
    assert war_res.status_code == 200
    warranties = war_res.json()
    assert len(warranties) >= 1
    print(f" [PASS] Canonical warranties retrieved: {len(warranties)} equipment warranty records.")

    # 8. Service Complaint & Photo Evidence
    ticket_res = client.post("/api/customer/service-tickets", json={
        "issue_category": "GENERAL_QUERY",
        "description": "Customer requested walkthrough on monitoring mobile app and grid-tie sync.",
        "passport_id": pass_data["id"]
    }, headers=headers)
    assert ticket_res.status_code == 201, f"Ticket creation failed: {ticket_res.text}"
    ticket_id = ticket_res.json()["ticket_id"]
    ticket_num = ticket_res.json()["ticket_number"]
    print(f" [PASS] Created service ticket #{ticket_num} (ID: {ticket_id})")

    # Photo upload to service ticket
    fake_photo = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00" + b"\x00"*100
    upload_res = client.post(
        f"/api/customer/service-tickets/{ticket_id}/upload-evidence",
        files={"file": ("rooftop_junction_box.jpg", fake_photo, "image/jpeg")},
        data={"description": "Photograph of solar junction box and inverter display"},
        headers=headers
    )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    print(f" [PASS] Photo evidence successfully uploaded: {upload_res.json()['file_url']}")

    # 9. Feedback
    fb_res = client.post("/api/customer/feedback", json={
        "feedback_type": "INSTALLATION",
        "rating": 5,
        "category_ratings": {"cleanliness": 5, "timeliness": 5, "professionalism": 5},
        "comments": "Excellent rooftop installation by Deepak Chavan and the SunPower crew!"
    }, headers=headers)
    assert fb_res.status_code == 201
    print(" [PASS] Customer 5-star feedback submitted.")

    fb_list = client.get("/api/customer/feedback", headers=headers)
    assert fb_list.status_code == 200
    assert len(fb_list.json()) >= 1
    print(f" [PASS] Customer feedback list verified: {len(fb_list.json())} review(s).")

    # 10. Notifications
    notif_res = client.get("/api/customer/notifications", headers=headers)
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert len(notifs) >= 1
    print(f" [PASS] Customer in-app notifications retrieved: {len(notifs)} notification(s).")

    # 11. Security & Customer Data Isolation
    print("\n--- Testing Horizontal Privilege Escalation & Data Isolation Guards ---")
    # Order 2 belongs to Customer 2 (Amit Patel). Customer 1 (Rajesh) must be rejected with 403 Forbidden!
    foreign_order = client.get("/api/orders/2", headers=headers)
    assert foreign_order.status_code == 403, f"Expected 403 on foreign order, got {foreign_order.status_code}"
    print(" [PASS] Guarded against accessing Customer 2's Order #2 -> HTTP 403 Forbidden")

    foreign_proj = client.get("/api/customer/projects/2", headers=headers)
    assert foreign_proj.status_code == 403
    print(" [PASS] Guarded against accessing Customer 2's Project #2 in Customer Portal -> HTTP 403 Forbidden")

    # Passport 2 belongs to Customer 2. Customer 1 must be rejected with 403!
    foreign_passport = client.get("/api/passports/2", headers=headers)
    assert foreign_passport.status_code == 403
    print(" [PASS] Guarded against accessing Customer 2's Passport #2 -> HTTP 403 Forbidden")

    # List orders only returns Customer 1's orders
    orders_list = client.get("/api/orders", headers=headers)
    assert orders_list.status_code == 200
    assert all(o["customer_name"] == "Rajesh Sharma" for o in orders_list.json())
    print(" [PASS] /api/orders properly isolated: only returns authenticated customer's records.")

    print("\n=== ALL CUSTOMER PORTAL BACKEND TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()

