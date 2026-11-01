import asyncio
import datetime
import httpx
import sys
import os

# Ensure app is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.main import app


async def run_stage4_tests():
    print("=" * 66)
    print(" STAGE 4 COMPLETE SOLAR INSTALLATION LIFECYCLE TEST SUITE")
    print("=" * 66)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver/api") as client:
        # Step 0: Reset Seed Data
        print("\n>>> Step 0: Reset Seed Data...")
        resp = await client.post("/seed/reset")
        assert resp.status_code == 200, f"Seed reset failed: {resp.text}"
        print("Seed reset successful.")

        # Step 1: Verify Initial Seed Dispatch & Passport
        print("\n>>> Step 1: Verify Seeded Dispatch & Passport...")
        resp = await client.get("/dispatches")
        assert resp.status_code == 200
        dispatches = resp.json()
        assert len(dispatches) >= 1, "Expected at least 1 seeded dispatch"
        print(f"Verified {len(dispatches)} existing dispatches.")

        resp = await client.get("/passports/1")
        assert resp.status_code == 200
        p1 = resp.json()
        assert p1["passport_number"] == "DSP-MH-2026-0081"
        assert len(p1["warranties"]) >= 2
        print(f"Verified Passport {p1['passport_number']} with {len(p1['warranties'])} warranties.")

        # Step 2: Create Fresh Order up to Inventory Allocation
        print("\n>>> Step 2: Create Fresh Order through Sales & BOM Allocation...")
        # Customer
        c_resp = await client.post("/customers", json={
            "name": "Vikram Singhania",
            "phone": "+91 99220 88334",
            "email": "vikram.s@singhaniagroup.com",
            "address": "Villa 12, Marvel Aurum, Koregaon Park",
            "city": "Pune",
            "pincode": "411001",
            "avg_monthly_bill_paise": 650000
        })
        cust_id = c_resp.json()["id"]

        # Enquiry
        e_resp = await client.post("/enquiries", json={
            "customer_id": cust_id,
            "required_capacity_kw": 5.0,
            "property_type": "Residential Villa",
            "grid_type": "ON_GRID"
        })
        enq_id = e_resp.json()["id"]

        # Survey & Approve
        s_resp = await client.post(f"/enquiries/{enq_id}/schedule-survey", json={
            "surveyor_name": "Kailash Shinde",
            "notes": "Parapet wall measurement and staircase shadow mapping required."
        })
        survey_id = s_resp.json()["id"]
        await client.patch(f"/surveys/{survey_id}/approve")

        # Quotation
        q_resp = await client.post("/quotations", json={
            "enquiry_id": enq_id,
            "survey_id": survey_id,
            "system_capacity_kw": 5.0,
            "gross_amount_paise": 28000000,
            "subsidy_amount_paise": 7800000,
            "discount_paise": 1000000,
            "net_amount_paise": 19200000
        })
        quote_id = q_resp.json()["id"]

        # Accept Quotation -> Order
        ord_resp = await client.post(f"/quotations/{quote_id}/accept")
        order_id = ord_resp.json()["id"]
        order_num = ord_resp.json()["order_number"]
        print(f"Created Fresh Order {order_num} (ID {order_id})")

        # Step 3: Test Business Rule - Dispatch BLOCKED on unallocated order
        print("\n>>> Step 3: Test Business Rule - Dispatch BLOCKED on unallocated order...")
        bad_dispatch = await client.post("/dispatches", json={"order_id": order_id})
        assert bad_dispatch.status_code == 400, f"Expected 400 for unallocated dispatch, got: {bad_dispatch.status_code}"
        print(f"[PASSED] Correctly blocked dispatch before BOM generation & allocation: {bad_dispatch.json()['detail']}")

        # Generate BOM & Allocate Inventory
        print("\n>>> Step 4: Generate BOM and Allocate Inventory...")
        bom_resp = await client.post(f"/orders/{order_id}/generate-bom")
        assert bom_resp.status_code == 200
        alloc_resp = await client.post(f"/orders/{order_id}/allocate-inventory", json={"allow_partial": False})
        assert alloc_resp.status_code == 200
        print(f"Allocated inventory for {order_num} across regional warehouses.")

        # Step 5: Create Official Project Dispatch
        print("\n>>> Step 5: Create Warehouse Dispatch for Allocated Order...")
        disp_create_resp = await client.post("/dispatches", json={
            "order_id": order_id,
            "vehicle_number": "MH-12-SP-9912",
            "driver_name": "Mahesh Gaikwad",
            "driver_phone": "+91 98220 99441",
            "notes": "Express delivery for Koregaon Park villa rooftop project."
        })
        assert disp_create_resp.status_code == 201, f"Dispatch creation failed: {disp_create_resp.text}"
        dispatch_data = disp_create_resp.json()
        dispatch_id = dispatch_data["id"]
        dispatch_num = dispatch_data["dispatch_number"]
        print(f"Created Dispatch {dispatch_num} (Status: {dispatch_data['status']}, Order: {dispatch_data['order_number']})")

        # Step 6: Serial Number Capture & Uniqueness Enforcement
        print("\n>>> Step 6: Serial Number Barcode Capture & Uniqueness Test...")
        # Get components in BOM to know what IDs to capture
        bom_detail_resp = await client.get(f"/orders/{order_id}/bom")
        bom_items = bom_detail_resp.json()["items"]
        panel_comp_id = next(it["component_id"] for it in bom_items if it["category"] == "PANEL")
        inverter_comp_id = next(it["component_id"] for it in bom_items if it["category"] == "INVERTER")

        serials_payload = {
            "serials": [
                {"component_id": inverter_comp_id, "serial_number": "SNG-5K-2026-V9921", "barcode_format": "CODE128"},
                {"component_id": panel_comp_id, "serial_number": "WRE-550-2026V-001", "barcode_format": "CODE128"},
                {"component_id": panel_comp_id, "serial_number": "WRE-550-2026V-002", "barcode_format": "CODE128"},
                {"component_id": panel_comp_id, "serial_number": "WRE-550-2026V-003", "barcode_format": "CODE128"},
                {"component_id": panel_comp_id, "serial_number": "WRE-550-2026V-004", "barcode_format": "CODE128"},
            ]
        }
        capture_resp = await client.post(f"/dispatches/{dispatch_id}/capture-serials", json=serials_payload)
        assert capture_resp.status_code == 200, f"Capture failed: {capture_resp.text}"
        print(f"Captured {capture_resp.json()['captured_count']} physical serial numbers.")

        # Test duplicate serial prevention
        dup_payload = {
            "serials": [{"component_id": inverter_comp_id, "serial_number": "SNG-5K-2026-V9921"}]
        }
        dup_resp = await client.post(f"/dispatches/{dispatch_id}/capture-serials", json=dup_payload)
        assert dup_resp.status_code == 400, "Duplicate serial should be blocked with HTTP 400"
        print(f"[PASSED] Correctly blocked duplicate serial number: {dup_resp.json()['detail']}")

        # Step 7: Mark Dispatch Delivered
        print("\n>>> Step 7: Mark Dispatch as Delivered on Site...")
        deliv_resp = await client.patch(f"/dispatches/{dispatch_id}/deliver")
        assert deliv_resp.status_code == 200
        print(f"Dispatch marked DELIVERED on {deliv_resp.json()['delivery_date']}.")

        # Step 8: Fetch Installation Record
        print("\n>>> Step 8: Retrieve Auto-Scheduled Installation Record...")
        inst_list_resp = await client.get(f"/installations?order_id={order_id}")
        assert inst_list_resp.status_code == 200
        inst_list = inst_list_resp.json()
        assert len(inst_list) >= 1
        inst_id = inst_list[0]["id"]
        inst_num = inst_list[0]["installation_number"]
        print(f"Found Installation {inst_num} (Status: {inst_list[0]['status']})")

        # Step 9: Test Incomplete Checklist Commissioning Block
        print("\n>>> Step 9: Test Business Rule - Commissioning BLOCKED on incomplete checklist...")
        # Check 7 of the 8 mandatory checklist items, leave customer handover FALSE
        await client.patch(f"/installations/{inst_id}/checklist", json={
            "chk_structure_installed": True,
            "chk_panels_installed": True,
            "chk_inverter_installed": True,
            "chk_electrical_completed": True,
            "chk_earthing_completed": True,
            "chk_safety_checks_completed": True,
            "chk_system_tested": True,
            "chk_customer_handover_completed": False
        })
        comm_fail = await client.post(f"/installations/{inst_id}/commission")
        assert comm_fail.status_code == 400, "Commissioning should be blocked when checklist is incomplete"
        print(f"[PASSED] Correctly blocked commissioning: {comm_fail.json()['detail']}")

        # Step 10: Complete Checklist & Commission
        print("\n>>> Step 10: Complete All Mandatory Checklist Items & Commission System...")
        await client.patch(f"/installations/{inst_id}/checklist", json={
            "chk_customer_handover_completed": True,
            "earthing_resistance_ohms": 1.95,
            "peak_power_tested_kw": 5.12,
            "grid_sync_successful": True,
            "team_notes": "All safety checks passed. Net meter synced with MSEDCL grid at 240V."
        })
        comm_success = await client.post(f"/installations/{inst_id}/commission")
        assert comm_success.status_code == 200, f"Commission failed: {comm_success.text}"
        comm_data = comm_success.json()
        passport_num = comm_data["passport_number"]
        qr_token = comm_data["qr_code_token"]
        print(f"Commissioning Succeeded: {comm_data['message']}")
        print(f"  Passport Number: {passport_num}")
        print(f"  Lookup Token:    {qr_token}")

        # Step 11: Inspect Digital Solar Passport
        print("\n>>> Step 11: Inspect Digital Solar Passport Details...")
        passp_resp = await client.get(f"/passports/{order_id}")
        assert passp_resp.status_code == 200
        passp_data = passp_resp.json()
        assert passp_data["passport_number"] == passport_num
        assert len(passp_data["warranties"]) >= 5
        assert "<svg" in passp_data["qr_code_svg"], "QR code SVG should be included"
        # Check actual serial numbers match
        passport_serials = [w["serial_number"] for w in passp_data["warranties"]]
        assert "SNG-5K-2026-V9921" in passport_serials, "Inverter serial number missing from passport"
        assert "WRE-550-2026V-001" in passport_serials, "PV module serial number missing from passport"
        print(f"Verified Passport {passport_num}: {len(passp_data['warranties'])} verified equipment warranties.")

        # Step 12: Public Read-Only Passport Token Verification
        print("\n>>> Step 12: Test Public Read-Only Passport Endpoint...")
        pub_resp = await client.get(f"/passports/public/{qr_token}")
        assert pub_resp.status_code == 200, f"Public lookup failed: {pub_resp.text}"
        pub_data = pub_resp.json()
        assert pub_data["passport_number"] == passport_num
        assert "phone" not in pub_data, "Public view must not leak phone number"
        assert "address" not in pub_data, "Public view must not leak detailed residential address"
        assert pub_data["customer_display_name"] == "Vikram Singhania Residence"
        print(f"Public Passport Verified: {pub_data['customer_display_name']} ({pub_data['city']}, {pub_data['system_capacity_kw']} kW)")

        # Step 13: Serial-Number-Based Warranty Lookup
        print("\n>>> Step 13: Serial-Number-Based Warranty Lookup...")
        w_lookup = await client.get("/warranties/SNG-5K-2026-V9921")
        assert w_lookup.status_code == 200, f"Warranty lookup failed: {w_lookup.text}"
        w_data = w_lookup.json()
        assert w_data["is_valid"] is True
        assert w_data["duration_years"] == 10
        assert "Sungrow" in w_data["manufacturer"]
        print(f"Warranty Lookup for SNG-5K-2026-V9921: {w_data['component_name']} - {w_data['duration_years']} Years ({w_data['status']})")

        # Step 14: Service Ticket Creation & Management
        print("\n>>> Step 14: Service Ticket Creation & Lifecycle...")
        tkt_create = await client.post("/service/tickets", json={
            "customer_id": cust_id,
            "passport_id": passp_data["id"],
            "installation_id": inst_id,
            "serial_number": "SNG-5K-2026-V9921",
            "issue_category": "GENERAL_QUERY",
            "priority": "LOW",
            "description": "Customer requested guidance on Sungrow mobile app Wi-Fi dongle pairing."
        })
        assert tkt_create.status_code == 201, f"Ticket creation failed: {tkt_create.text}"
        ticket_data = tkt_create.json()
        ticket_id = ticket_data["id"]
        ticket_num = ticket_data["ticket_number"]
        print(f"Created Service Ticket {ticket_num} (Status: {ticket_data['status']})")

        # Update Ticket to RESOLVED
        tkt_update = await client.patch(f"/service/tickets/{ticket_id}", json={
            "status": "RESOLVED",
            "resolution_notes": "Completed remote Wi-Fi setup assistance. Solar app communication confirmed."
        })
        assert tkt_update.status_code == 200
        assert tkt_update.json()["status"] == "RESOLVED"
        assert tkt_update.json()["resolved_at"] is not None
        print(f"Ticket {ticket_num} updated to RESOLVED on {tkt_update.json()['resolved_at']}.")

        print("\n" + "=" * 66)
        print(" [SUCCESS] ALL 14 STAGE 4 INTEGRATION TESTS PASSED PERFECTLY!")
        print("=" * 66)


if __name__ == "__main__":
    asyncio.run(run_stage4_tests())
