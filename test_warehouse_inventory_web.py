import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 80)
    print("SUNPOWER SOLUTIONS — WAREHOUSE & TECHNICIAN WEB WORKSPACE VERIFICATION")
    print("=" * 80)

    # 1. Authenticate Warehouse Manager
    print("\n[STEP 1] Authenticating as Warehouse Manager (warehouse@sunpower.com)...")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "username_or_email": "warehouse@sunpower.com",
        "password": "Password@123"
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    login_data = res.json()
    token = login_data["access_token"]
    user = login_data["user"]
    dashboard_route = login_data["dashboard_route"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"SUCCESS: Logged in as {user['full_name']} (Role: {user['role']})")
    print(f"Canonical Web Dashboard Route: {dashboard_route}")
    assert dashboard_route == "/dashboard/warehouse", f"Expected /dashboard/warehouse, got {dashboard_route}"

    # 2. Fetch Warehouse Dashboard KPIs & Depots
    print("\n[STEP 2] Fetching Warehouse Web Command Dashboard (GET /dashboard/warehouse)...")
    wh_dash = requests.get(f"{BASE_URL}/dashboard/warehouse", headers=headers)
    assert wh_dash.status_code == 200, f"Dashboard failed: {wh_dash.text}"
    d = wh_dash.json()
    kpis = d.get("kpis", {})
    warehouses = d.get("warehouses", [])
    print(f"SUCCESS: Dashboard retrieved.")
    print(f" - Total Physical Stock: {kpis.get('total_on_hand')} units across {len(warehouses)} depots")
    print(f" - Available Unreserved: {kpis.get('available_stock')} units")
    print(f" - Reserved for Orders:  {kpis.get('total_reserved')} units")
    print(f" - Low Stock SKUs:       {kpis.get('low_stock_alerts_count')} alerts")
    print(f" - Pending Transfers:    {kpis.get('pending_receipts')}")
    assert len(warehouses) >= 3, f"Expected at least 3 depots, found {len(warehouses)}"

    # 3. Fetch Warehouses for Inventory Page
    print("\n[STEP 3] Fetching Warehouses Directory (GET /inventory/warehouses & /warehouses)...")
    wh_res = requests.get(f"{BASE_URL}/inventory/warehouses", headers=headers)
    assert wh_res.status_code == 200, f"Warehouses endpoint failed: {wh_res.text}"
    wh_list = wh_res.json()
    print(f"SUCCESS: Retrieved {len(wh_list)} regional fulfillment hubs:")
    for w in wh_list:
        print(f"   * [{w['code']}] {w['name']} ({w['city']}, {w['state']}) - Primary: {w.get('is_primary')}")

    # 4. Fetch Inventory Stock Module Data
    print("\n[STEP 4] Fetching Inventory Stock Ledger (GET /inventory)...")
    inv_res = requests.get(f"{BASE_URL}/inventory", headers=headers)
    assert inv_res.status_code == 200, f"Inventory stock failed: {inv_res.text}"
    inv_items = inv_res.json()
    assert isinstance(inv_items, list) and len(inv_items) > 0, "No inventory items returned"
    print(f"SUCCESS: Retrieved {len(inv_items)} authoritative stock records.")
    
    # Sample items
    sample = inv_items[0]
    print(f"Sample Record #1: {sample['component_name']} (SKU: {sample['sku']})")
    print(f"   Category: {sample['category']} | Depot: {sample['warehouse_name']}")
    print(f"   On Hand: {sample['qty_on_hand']} | Reserved: {sample['qty_reserved']} | Net Available: {sample['available']}")

    # Test category filter
    for cat in ['PANEL', 'INVERTER', 'STRUCTURE']:
        filtered = requests.get(f"{BASE_URL}/inventory?category={cat}", headers=headers).json()
        print(f" - Category Filter [{cat}]: {len(filtered)} SKUs found")
        assert len(filtered) > 0, f"Expected non-empty results for category {cat}"

    # 5. Fetch Stock Transfers Module Data
    print("\n[STEP 5] Fetching Multi-Warehouse Transfers (GET /inventory/transfers)...")
    tr_res = requests.get(f"{BASE_URL}/inventory/transfers", headers=headers)
    assert tr_res.status_code == 200, f"Transfers failed: {tr_res.text}"
    transfers = tr_res.json()
    assert isinstance(transfers, list) and len(transfers) > 0, "No transfer records returned"
    print(f"SUCCESS: Retrieved {len(transfers)} inter-depot transfers:")
    for t in transfers:
        print(f"   * [{t['transfer_number']}] {t['source_warehouse_name']} -> {t['dest_warehouse_name']} | "
              f"{t['quantity']}x {t['component_name']} ({t['status']})")

    # 6. Create a New Stock Transfer Transaction
    print("\n[STEP 6] Submitting New Inter-Depot Stock Transfer (POST /inventory/transfers)...")
    new_tr_payload = {
        "source_warehouse_id": 1,
        "dest_warehouse_id": 2,
        "component_id": 1, # Waaree Bi-550 (4 available at Pune)
        "quantity": 2,
        "notes": "Automated Web Workspace Rebalancing Test",
        "auto_approve": True
    }
    create_tr_res = requests.post(f"{BASE_URL}/inventory/transfers", headers=headers, json=new_tr_payload)
    assert create_tr_res.status_code in [200, 201], f"Create transfer failed: {create_tr_res.text}"
    created_tr = create_tr_res.json()
    print(f"SUCCESS: Created Transfer #{created_tr.get('transfer_number')} (Status: {created_tr.get('status')})")

    # 7. Fetch Immutable Stock Movement Audit Log
    print("\n[STEP 7] Fetching Stock Movement Audit Ledger (GET /inventory/movements)...")
    movs_res = requests.get(f"{BASE_URL}/inventory/movements?limit=10", headers=headers)
    assert movs_res.status_code == 200, f"Movements failed: {movs_res.text}"
    movements = movs_res.json()
    print(f"SUCCESS: Retrieved {len(movements)} recent audit ledger entries:")
    for m in movements[:3]:
        print(f"   * [{m.get('movement_type')}] {m.get('component_name')} | Change: {m.get('quantity_change')} | Depot: {m.get('warehouse_name')}")

    # 8. Authenticate Field Technician & Verify Web Workspace
    print("\n[STEP 8] Authenticating as Technician (technician@sunpower.com)...")
    tech_res = requests.post(f"{BASE_URL}/auth/login", json={
        "username_or_email": "technician@sunpower.com",
        "password": "Password@123"
    })
    assert tech_res.status_code == 200, f"Technician login failed: {tech_res.text}"
    tech_data = tech_res.json()
    tech_token = tech_data["access_token"]
    tech_user = tech_data["user"]
    tech_headers = {"Authorization": f"Bearer {tech_token}"}
    print(f"SUCCESS: Logged in as {tech_user['full_name']} (Role: {tech_user['role']})")
    print(f"Canonical Web Dashboard Route: {tech_data['dashboard_route']}")
    assert tech_data["dashboard_route"] == "/dashboard/technician"

    # Fetch technician unified dashboard
    tech_dash = requests.get(f"{BASE_URL}/dashboard/technician", headers=tech_headers)
    assert tech_dash.status_code == 200, f"Technician dashboard failed: {tech_dash.text}"
    td = tech_dash.json()
    print(f"SUCCESS: Unified Field Web Dashboard retrieved.")
    print(f" - Technician: {td.get('technician', {}).get('name')}")
    print(f" - Capabilities: {td.get('technician', {}).get('capabilities')}")
    print(f" - Assigned Surveys: {len(td.get('assigned_surveys', []))}")
    print(f" - Active Installations: {len(td.get('active_installations', []))}")

    print("\n" + "=" * 80)
    print("ALL 8 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
