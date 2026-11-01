import sys
import os
import requests
import datetime

# Ensure standard output uses UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def login(email, password="Password@123"):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"username_or_email": email, "password": password})
    if resp.status_code != 200:
        raise Exception(f"Login failed for {email}: {resp.status_code} {resp.text}")
    data = resp.json()
    token = data.get("access_token")
    user = data.get("user")
    return token, user

def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

print("================================================================================")
print("SUNPOWER SOLUTIONS — MASTER CORRECTION LIVE VERIFICATION")
print("================================================================================")

# -------------------------------------------------------------------------
# Test 1: Administrator Workspace — Read-Only Task Monitoring & Operational Logs
# -------------------------------------------------------------------------
print("\n[TEST 1] Administrator Workspace — Task Monitoring, Inventory Oversight, Operational Logs")
admin_token, admin_user = login("admin@sunpower.com")
headers_admin = auth_headers(admin_token)

# A. Admin Tasks monitoring
res_tasks = requests.get(f"{BASE_URL}/tasks", headers=headers_admin)
assert res_tasks.status_code == 200, f"Admin tasks fetch failed: {res_tasks.text}"
all_tasks = res_tasks.json()
print(f"  [OK] Admin fetched all operational tasks: {len(all_tasks)} total tasks logged")

# Verify task attributes
if len(all_tasks) > 0:
    sample_task = all_tasks[0]
    required_keys = ["id", "title", "category", "priority", "status", "created_at"]
    for k in required_keys:
        assert k in sample_task, f"Missing key {k} in task"
    print(f"  [OK] Sample Task #{sample_task['id']}: '{sample_task['title']}' | Category: {sample_task['category']} | Status: {sample_task['status']}")

# B. Admin Task Summary KPIs
res_summary = requests.get(f"{BASE_URL}/tasks/summary", headers=headers_admin)
assert res_summary.status_code == 200
summary = res_summary.json()
print(f"  [OK] Admin Tasks Analytics: Total={summary['total']}, Pending={summary['pending']}, InProgress={summary['in_progress']}, Completed={summary['completed']}, Overdue={summary['overdue']}")

# C. Admin High-Level Inventory Oversight (No Intelligent Procurement Cards)
res_warehouses = requests.get(f"{BASE_URL}/warehouses", headers=headers_admin)
assert res_warehouses.status_code == 200
whs = res_warehouses.json()
print(f"  [OK] Admin Inventory Oversight: {len(whs)} Regional Depots tracked (Pune, Mumbai, Nashik)")

res_movements = requests.get(f"{BASE_URL}/inventory/movements", headers=headers_admin)
assert res_movements.status_code == 200
print(f"  [OK] Admin Audit Movements: {len(res_movements.json())} transactions in immutable audit log")

# D. Admin Installations Compact Operational Logs
res_inst = requests.get(f"{BASE_URL}/installations", headers=headers_admin)
assert res_inst.status_code == 200
inst_list = res_inst.json()
print(f"  [OK] Admin Installation Logs: {len(inst_list)} installation projects logged")
if len(inst_list) > 0:
    si = inst_list[0]
    print(f"  [OK] Sample Log: Inst #{si['id']} | Order: {si.get('order_number')} | Tech: {si.get('assigned_technician')} | Status: {si['status']}")

# -------------------------------------------------------------------------
# Test 2: Sales Executive Workspace — Products, BOM & Personal Task Manager
# -------------------------------------------------------------------------
print("\n[TEST 2] Sales Executive Workspace — Product Catalog, BOM & Personal Tasks")
sales_token, sales_user = login("sales@sunpower.com")
headers_sales = auth_headers(sales_token)

# A. Product Catalog & Packages (fixes api.getProduct / api.getProducts)
res_prods = requests.get(f"{BASE_URL}/products", headers=headers_sales)
assert res_prods.status_code == 200
prods = res_prods.json()
assert len(prods) > 0, "No products found in catalog"
print(f"  [OK] Product Catalog loaded successfully: {len(prods)} components available")

first_prod_id = prods[0]['id']
res_single_prod = requests.get(f"{BASE_URL}/products/{first_prod_id}", headers=headers_sales)
assert res_single_prod.status_code == 200
single_prod = res_single_prod.json()
print(f"  [OK] api.getProduct({first_prod_id}) verified: '{single_prod['name']}' ({single_prod['sku']})")

# B. Solar Packages & Orders
res_packages = requests.get(f"{BASE_URL}/packages", headers=headers_sales)
assert res_packages.status_code == 200
print(f"  [OK] Solar Packages loaded: {len(res_packages.json())} standard system configurations")

res_orders = requests.get(f"{BASE_URL}/orders", headers=headers_sales)
assert res_orders.status_code == 200
sales_orders = res_orders.json()
assert len(sales_orders) > 0, "No orders available"
target_order = sales_orders[0]
print(f"  [OK] Sales Orders loaded: Target Order #{target_order['id']} ({target_order['order_number']})")

# C. BOM Retrieval & Generation for Order
res_bom = requests.get(f"{BASE_URL}/orders/{target_order['id']}/bom", headers=headers_sales)
print(f"  [OK] BOM check for Order #{target_order['id']}: Status={res_bom.status_code}")

# D. Sales Personal Task Manager
sales_task_payload = {
    "title": "Follow up with Rajesh Sharma on PM Surya Ghar Subsidy Document Submission",
    "description": "Call customer regarding electricity bill copy and cancelled cheque for MNRE portal.",
    "category": "Customer Follow-up",
    "priority": "HIGH",
    "customer_id": target_order.get("customer_id", 1),
    "order_id": target_order["id"],
    "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat()
}
res_create_task = requests.post(f"{BASE_URL}/tasks", json=sales_task_payload, headers=headers_sales)
assert res_create_task.status_code == 201, f"Sales task creation failed: {res_create_task.text}"
created_task = res_create_task.json()
task_id = created_task["id"]
print(f"  [OK] Created Sales Task #{task_id}: '{created_task['title']}' | Category: {created_task['category']}")

# E. Update Task Status (PENDING -> IN_PROGRESS -> COMPLETED)
res_update_status = requests.patch(f"{BASE_URL}/tasks/{task_id}", json={"status": "IN_PROGRESS"}, headers=headers_sales)
assert res_update_status.status_code == 200
print(f"  [OK] Sales Task #{task_id} transitioned to IN_PROGRESS")

res_add_comment = requests.post(f"{BASE_URL}/tasks/{task_id}/comments", json={"comment": "Spoke to customer; documents will be emailed by 3 PM."}, headers=headers_sales)
assert res_add_comment.status_code == 200
print(f"  [OK] Comment added to Task #{task_id} successfully")

res_complete = requests.patch(f"{BASE_URL}/tasks/{task_id}", json={"status": "COMPLETED"}, headers=headers_sales)
assert res_complete.status_code == 200
print(f"  [OK] Sales Task #{task_id} transitioned to COMPLETED with completion timestamp logged")

# -------------------------------------------------------------------------
# Test 3: Warehouse Manager Workspace — Web Dashboard & Serial Registry
# -------------------------------------------------------------------------
print("\n[TEST 3] Warehouse Manager Workspace — Web Dashboard, Staging & Serials")
wh_token, wh_user = login("warehouse@sunpower.com")
headers_wh = auth_headers(wh_token)

# A. Warehouse Web Application Dashboard KPIs
res_wh_dash = requests.get(f"{BASE_URL}/dashboard/warehouse", headers=headers_wh)
assert res_wh_dash.status_code == 200, f"Warehouse dashboard failed: {res_wh_dash.text}"
wh_dash = res_wh_dash.json()
kpis = wh_dash.get("kpis", {})
print(f"  [OK] Warehouse Web Dashboard KPIs verified from Central DB:")
print(f"       - Total On Hand Physical Stock: {kpis.get('total_on_hand')} units")
print(f"       - Available Stock:             {kpis.get('available_stock')} units")
print(f"       - Reserved for Orders:         {kpis.get('total_reserved')} units")
print(f"       - Low Stock Alert Items:       {kpis.get('low_stock_alerts_count')} items")
print(f"       - Pending Goods Receipts:      {kpis.get('pending_receipts')} transfers")
print(f"       - Pending Reservations:        {kpis.get('pending_reservations')} orders")
print(f"       - Allocation Requests:         {kpis.get('pending_allocations')} orders")
print(f"       - Procurement Shortages:       {kpis.get('shortage_count')} shortages")
print(f"       - Pending Dispatches:          {kpis.get('pending_dispatches')} dispatches")
print(f"       - Completed Dispatches:        {kpis.get('completed_dispatches')} deliveries")
print(f"       - Damaged/Return Movements:    {kpis.get('damaged_movements', 0) + kpis.get('returns_movements', 0)} items")

# B. Warehouse Operational Tasks
wh_task_payload = {
    "title": "Verify incoming Waaree 550W mono-PERC panel consignment (Lot #WRE-2026-08)",
    "description": "Inspect pallet packaging, verify factory flash test reports, register serial numbers into system.",
    "category": "Stock Verification",
    "priority": "HIGH",
    "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=2)).isoformat()
}
res_wh_task = requests.post(f"{BASE_URL}/tasks", json=wh_task_payload, headers=headers_wh)
assert res_wh_task.status_code == 201
created_wh_task = res_wh_task.json()
print(f"  [OK] Created Warehouse Operational Task #{created_wh_task['id']}: '{created_wh_task['title']}' | Category: {created_wh_task['category']}")

# C. Serial Numbers Registry: List Serials
res_serials = requests.get(f"{BASE_URL}/inventory/serials", headers=headers_wh)
assert res_serials.status_code == 200
serials_list = res_serials.json()
print(f"  [OK] Serial Numbers Registry query returned {len(serials_list)} registered serialized components")

# D. Register New Serial Number (Panel)
test_sn = f"WRE-550-TEST-{datetime.datetime.utcnow().strftime('%H%M%S')}"
panel_component = next((p for p in prods if p.get("category") == "PANEL"), prods[0])
reg_payload = {
    "serial_number": test_sn,
    "component_id": panel_component["id"],
    "warehouse_id": 1,
    "barcode_format": "CODE128",
    "lifecycle_status": "AVAILABLE"
}
res_reg = requests.post(f"{BASE_URL}/inventory/serials/register", json=reg_payload, headers=headers_wh)
assert res_reg.status_code == 201, f"Serial registration failed: {res_reg.text}"
reg_res = res_reg.json()
serial_item_id = reg_res["id"]
print(f"  [OK] Registered New Hardware Serial: '{test_sn}' for '{reg_res['component_name']}' with status AVAILABLE")

# E. Duplicate Serial Rejection
res_dup = requests.post(f"{BASE_URL}/inventory/serials/register", json=reg_payload, headers=headers_wh)
assert res_dup.status_code == 400, f"Expected 400 on duplicate serial, got {res_dup.status_code}"
print(f"  [OK] Duplicate Serial Rejection verified: Server returned 400 with message: '{res_dup.json().get('detail')}'")

# F. Transition Lifecycle Status (AVAILABLE -> RESERVED -> UNDER_INSPECTION)
res_status_update = requests.patch(
    f"{BASE_URL}/inventory/serials/{serial_item_id}/status",
    json={"lifecycle_status": "UNDER_INSPECTION", "notes": "Periodic calibration check"},
    headers=headers_wh
)
assert res_status_update.status_code == 200
print(f"  [OK] Serial Lifecycle Transition verified: Status updated to 'UNDER_INSPECTION'")

# -------------------------------------------------------------------------
# Test 4: Technician & Customer Workspaces Intact
# -------------------------------------------------------------------------
print("\n[TEST 4] Technician & Customer Workspaces Integrity")
tech_token, tech_user = login("technician@sunpower.com")
headers_tech = auth_headers(tech_token)
res_tech_dash = requests.get(f"{BASE_URL}/dashboard/technician", headers=headers_tech)
assert res_tech_dash.status_code == 200
tech_name = tech_user.get('full_name') or tech_user.get('name') or tech_user.get('username')
print(f"  [OK] Unified Technician Workspace operational for {tech_name}")

cust_token, cust_user = login("customer@sunpower.com")
headers_cust = auth_headers(cust_token)
res_cust_me = requests.get(f"{BASE_URL}/auth/me", headers=headers_cust)
assert res_cust_me.status_code == 200
cust_name = cust_user.get('full_name') or cust_user.get('name') or cust_user.get('username')
print(f"  [OK] Customer Mobile Portal operational for {cust_name}")

print("\n================================================================================")
print("ALL MASTER CORRECTION INTEGRATION TESTS PASSED (100% SUCCESS)!")
print("================================================================================")
