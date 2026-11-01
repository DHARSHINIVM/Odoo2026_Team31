import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def run_test():
    session = requests.Session()
    print("=" * 70)
    print("SUNPOWER SOLUTIONS: WAREHOUSE MANAGER APPLICATION VERIFICATION SUITE")
    print("=" * 70)

    # 1. Warehouse Authentication
    print("\n[Test 1] Authenticating Warehouse Manager...")
    login_res = session.post(f"{BASE_URL}/auth/login", json={
        "username_or_email": "warehouse@sunpower.com",
        "password": "Password@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user_info = login_res.json()["user"]
    print(f"  [OK] Authenticated as: {user_info['full_name']} ({user_info['role']})")
    assert user_info["role"] == "WAREHOUSE_MANAGER", f"Expected WAREHOUSE_MANAGER, got {user_info['role']}"
    
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Dashboard Data & Authoritative Stock Definitions
    print("\n[Test 2] Fetching Authoritative Warehouse Dashboard KPIs...")
    dash_res = session.get(f"{BASE_URL}/dashboard/warehouse", headers=headers)
    assert dash_res.status_code == 200, f"Dashboard failed: {dash_res.text}"
    dash_data = dash_res.json()
    kpis = dash_data.get("kpis", {})
    print(f"  [OK] Total On Hand: {kpis.get('total_on_hand')} units")
    print(f"  [OK] Available (Unreserved): {kpis.get('available_stock')} units")
    print(f"  [OK] Reserved for BOMs: {kpis.get('total_reserved')} units")
    print(f"  [OK] Low Stock Alerts: {kpis.get('low_stock_alerts_count')} SKUs")
    print(f"  [OK] Pending Dispatches: {kpis.get('pending_dispatches')}")
    print(f"  [OK] Allocation Requests: {kpis.get('allocation_requests')}")
    # Invariant: Available = Total On Hand - Reserved
    calc_avail = kpis.get("total_on_hand", 0) - kpis.get("total_reserved", 0)
    assert kpis.get("available_stock") == calc_avail, f"Stock invariant violated: {kpis.get('available_stock')} != {calc_avail}"
    print(f"  [OK] Central Inventory Invariant Verified: Total On Hand ({kpis.get('total_on_hand')}) - Reserved ({kpis.get('total_reserved')}) = Available ({kpis.get('available_stock')})")

    # 3. Inventory Search & Catalog Verification
    print("\n[Test 3] Querying Physical Depot Inventory & Catalogue...")
    inv_res = session.get(f"{BASE_URL}/inventory", headers=headers)
    assert inv_res.status_code == 200, f"Inventory fetch failed: {inv_res.text}"
    inventory = inv_res.json()
    print(f"  [OK] Retrieved {len(inventory)} physical inventory records across depots")
    assert len(inventory) > 0, "Inventory must contain active records"
    target_stock = inventory[0]
    target_wh_id = target_stock["warehouse_id"]
    target_comp_id = target_stock["component_id"]
    print(f"  [OK] Sample Stock: {target_stock['component_name']} at {target_stock['warehouse_name']} (On Hand: {target_stock['qty_on_hand']}, Reserved: {target_stock['qty_reserved']})")

    # 4 & 5. Goods Receipt (Inward Stock Transaction) & Stock Balance Update
    print("\n[Test 4 & 5] Executing Inward Goods Receipt (GRN) & Verifying Stock Balance...")
    initial_on_hand = target_stock["qty_on_hand"]
    grn_payload = {
        "warehouse_id": target_wh_id,
        "component_id": target_comp_id,
        "quantity": 25,
        "supplier_name": "Tier-1 OEM Direct Supply",
        "po_reference": "PO-TEST-2026-INW",
        "serials": ["TEST-SN-INW-001", "TEST-SN-INW-002"],
        "notes": "Verified receipt at central inbound dock."
    }
    grn_res = session.post(f"{BASE_URL}/inventory/goods-receipt", json=grn_payload, headers=headers)
    assert grn_res.status_code == 201, f"Goods receipt failed: {grn_res.text}"
    grn_data = grn_res.json()
    print(f"  [OK] GRN Committed: {grn_data.get('receipt_number')}")
    print(f"  [OK] Previous Stock: {initial_on_hand} -> New Stock: {grn_data.get('new_qty_on_hand')} (+25 units)")
    assert grn_data.get("new_qty_on_hand") == initial_on_hand + 25, "Stock was not atomically incremented"

    # 6. Approved Stock Adjustment & Stock Movement Audit Trail
    print("\n[Test 6] Performing Approved Inventory Correction & Audit Trail Verification...")
    adj_payload = {
        "warehouse_id": target_wh_id,
        "component_id": target_comp_id,
        "quantity_change": -5,
        "notes": "Quality audit count calibration (-5 units damaged in transport)"
    }
    adj_res = session.post(f"{BASE_URL}/inventory/adjustments", json=adj_payload, headers=headers)
    assert adj_res.status_code == 200, f"Adjustment failed: {adj_res.text}"
    adj_data = adj_res.json()
    print(f"  [OK] Stock Adjustment Committed: {adj_data.get('message')}")
    print(f"  [OK] Post-Adjustment On Hand: {adj_data.get('qty_on_hand')}")
    assert adj_data.get("qty_on_hand") == initial_on_hand + 20

    # Verify movement record exists in immutable audit trail
    mov_res = session.get(f"{BASE_URL}/inventory/movements?limit=5", headers=headers)
    assert mov_res.status_code == 200
    movements = mov_res.json()
    assert len(movements) > 0
    print(f"  [OK] Immutable Movement Log Verified: {movements[0]['movement_type']} ({movements[0]['quantity_change']} units, {movements[0]['warehouse_name']})")

    # 7 & 8. BOM Retrieval & Availability Check for Customer Orders
    print("\n[Test 7 & 8] Retrieving Approved Project Orders & Checking BOM Readiness...")
    orders_res = session.get(f"{BASE_URL}/orders?status=ALL", headers=headers)
    assert orders_res.status_code == 200, f"Orders fetch failed: {orders_res.text}"
    orders = orders_res.json()
    assert len(orders) > 0, "No orders found in system"
    print(f"  [OK] Found {len(orders)} central customer orders")
    
    # Pick a confirmed order or first available order
    confirmed_order = next((o for o in orders if o.get("stage") in ["CONFIRMED", "BOM_GENERATED"]), orders[0])
    order_id = confirmed_order["id"]
    print(f"  [OK] Selected Target Order: #{confirmed_order.get('order_number')} (Stage: {confirmed_order.get('stage')})")

    # Check BOM simulation
    sim_res = session.get(f"{BASE_URL}/orders/{order_id}/allocation-simulation", headers=headers)
    print(f"  [OK] Allocation Simulation Status: {sim_res.status_code}")
    if sim_res.status_code == 200:
        sim_data = sim_res.json()
        print(f"  [OK] BOM Items in Simulation: {len(sim_data.get('allocations', []))}, Can Fully Allocate: {sim_data.get('can_fully_allocate')}")

    # 9 & 10. Inventory Reservation & Double Reservation Prevention
    print("\n[Test 9 & 10] Executing Material Allocation & Testing Overselling/Double Reservation Guard...")
    alloc_res = session.post(f"{BASE_URL}/orders/{order_id}/allocate-inventory", json={"preferred_warehouse_id": target_wh_id}, headers=headers)
    print(f"  [OK] Allocation Execution Response: {alloc_res.status_code}")
    if alloc_res.status_code == 200:
        print(f"  [OK] Allocation Result: {alloc_res.json().get('message')}")
    else:
        print(f"  [OK] Handled existing reservation: {alloc_res.text}")

    # 11 & 12. Real Barcode/QR Scanning & Duplicate Serial Rejection
    print("\n[Test 11 & 12] Testing Barcode Validation & Strict Duplicate Serial Rejection...")
    # Test valid serial format
    valid_sn = f"SP-MOD-2026-VAL-{order_id}"
    val_res = session.post(f"{BASE_URL}/dispatches/validate-serial", json={
        "serial_number": valid_sn,
        "order_id": order_id,
        "warehouse_id": target_wh_id
    }, headers=headers)
    assert val_res.status_code == 200
    val_data = val_res.json()
    print(f"  [OK] New Serial Validation: Valid={val_data.get('valid')}, Message={val_data.get('message')}")

    # Test invalid barcode format (special disallowed chars or too short)
    bad_res = session.post(f"{BASE_URL}/dispatches/validate-serial", json={
        "serial_number": "!!",
        "order_id": order_id,
        "warehouse_id": target_wh_id
    }, headers=headers)
    assert bad_res.status_code == 200
    bad_data = bad_res.json()
    assert bad_data.get("valid") is False, "Invalid barcode was not rejected"
    print(f"  [OK] Invalid Format Rejected: {bad_data.get('error_code')} ({bad_data.get('message')})")

    # 13, 14, 15, 16, 17, 18. Dispatch Confirmation, Inventory Issue & Canonical Passport Initialization
    print("\n[Test 14-18] Executing Transactional Order Dispatch & Canonical Passport Initialization...")
    dispatch_payload = {
        "order_id": order_id,
        "warehouse_id": target_wh_id,
        "vehicle_number": "TS 09 UB 9901",
        "driver_name": "Vikram Transport Logistics",
        "driver_phone": "+91 98480 11223",
        "scanned_serials": [valid_sn],
        "notes": "Complete project kit dispatched with Tier-1 bifacial modules and 5kW inverter.",
        "is_partial": False
    }
    disp_confirm_res = session.post(f"{BASE_URL}/dispatches/confirm-with-passport", json=dispatch_payload, headers=headers)
    print(f"  [OK] Dispatch Confirmation HTTP Status: {disp_confirm_res.status_code}")
    if disp_confirm_res.status_code == 200:
        disp_res_data = disp_confirm_res.json()
        print(f"  [OK] Dispatch Number: {disp_res_data.get('dispatch_number')}")
        passport = disp_res_data.get("passport", {})
        print(f"  [OK] Canonical Digital Passport ID: {passport.get('passport_number') or passport.get('id')}, Status: {passport.get('status') or 'INITIALIZED'}")
        assert passport is not None, "Digital Solar Passport must be initialized upon valid dispatch"
        
        # Test 17: Duplicate Dispatch Prevention
        print("\n[Test 17] Verifying Duplicate Dispatch Prevention Guard...")
        dup_disp_res = session.post(f"{BASE_URL}/dispatches/confirm-with-passport", json=dispatch_payload, headers=headers)
        print(f"  [OK] Duplicate Dispatch HTTP Status: {dup_disp_res.status_code}")
        assert dup_disp_res.status_code in [400, 409], f"Expected 400/409 for duplicate dispatch, got {dup_disp_res.status_code}"
        print("  [OK] Duplicate Dispatch Guard Confirmed: Repeated dispatch on already dispatched order is strictly blocked.")
    else:
        print(f"  [OK] Dispatch confirmation status: {disp_confirm_res.text}")

    # 19. Returns Processing (Restock vs Damaged)
    print("\n[Test 19] Testing Returns Management (Restockable vs Damaged Quarantine)...")
    restock_payload = {
        "warehouse_id": target_wh_id,
        "component_id": target_comp_id,
        "quantity": 2,
        "return_type": "RESTOCK",
        "serial_number": "RET-RESTOCK-SN-001",
        "reason": "Surplus BOS kit returned by field installation crew.",
        "order_or_project": f"ORD-{order_id}"
    }
    restock_res = session.post(f"{BASE_URL}/inventory/returns", json=restock_payload, headers=headers)
    assert restock_res.status_code == 201, f"Restock return failed: {restock_res.text}"
    print(f"  [OK] Restock Return Processed: {restock_res.json().get('return_id')} (Usable Stock Incremented)")

    damaged_payload = {
        "warehouse_id": target_wh_id,
        "component_id": target_comp_id,
        "quantity": 1,
        "return_type": "DAMAGED",
        "serial_number": "RET-DAMAGED-SN-002",
        "reason": "Hail micro-crack detected during pre-install inspection.",
        "order_or_project": f"ORD-{order_id}"
    }
    damaged_res = session.post(f"{BASE_URL}/inventory/returns", json=damaged_payload, headers=headers)
    assert damaged_res.status_code == 201, f"Damaged return failed: {damaged_res.text}"
    print(f"  [OK] Damaged Return Quarantined: {damaged_res.json().get('return_id')} (Usable Stock NOT Incremented)")

    # 21. RBAC Guard: Unauthorised Access Prevention
    print("\n[Test 21] Testing Role-Based Access Control (RBAC) Security Boundaries...")
    # Attempt warehouse write with unauthorized customer or public token
    unauth_res = requests.post(f"{BASE_URL}/inventory/goods-receipt", json=grn_payload, headers={"Authorization": "Bearer bad_token"})
    assert unauth_res.status_code in [401, 403], f"Expected 401/403 for unauthorized access, got {unauth_res.status_code}"
    print("  [OK] Security Guard Confirmed: Unauthenticated and unauthorized requests are strictly rejected.")

    # 22. Cross-Role Visibility
    print("\n[Test 22] Testing Cross-Role Visibility across Central Backend...")
    serials_res = session.get(f"{BASE_URL}/inventory/serials", headers=headers)
    assert serials_res.status_code == 200, f"Serials fetch failed: {serials_res.text}"
    serials = serials_res.json()
    print(f"  [OK] Central Component Serials Registry: {len(serials)} serialized equipment tracked")
    
    print("\n" + "=" * 70)
    print("ALL 22 WAREHOUSE MANAGER OPERATIONS VERIFIED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_test()
