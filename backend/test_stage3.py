import sys
import os
import anyio
import httpx

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, Base
from app.main import app


async def run_stage3_tests():
    print("==================================================================")
    print(" STAGE 3 BOM & INTELLIGENT MULTI-WAREHOUSE ALLOCATION TEST SUITE")
    print("==================================================================")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Step 0: Reset seed
        print("\n>>> Step 0: Reset Seed Data...")
        res_seed = await client.post("/api/seed/reset")
        assert res_seed.status_code == 200, f"Seed failed: {res_seed.text}"
        print("Seed reset successful.")

        # Step 1: Products Catalogue
        print("\n>>> Step 1: Products Catalogue Verification...")
        res_prod = await client.get("/api/products")
        assert res_prod.status_code == 200, f"Get products failed: {res_prod.text}"
        products = res_prod.json()
        print(f"Total components in catalog: {len(products)}")
        categories = set(p["category"] for p in products)
        print(f"Categories verified: {', '.join(sorted(categories))}")
        assert "PANEL" in categories and "INVERTER" in categories and "BATTERY" in categories

        # Step 2: Solar Packages
        print("\n>>> Step 2: Solar Packages Verification...")
        res_pkg = await client.get("/api/packages")
        assert res_pkg.status_code == 200, f"Get packages failed: {res_pkg.text}"
        packages = res_pkg.json()
        print(f"Total packages found: {len(packages)}")
        pkg_names = [p["name"] for p in packages]
        print(f"Packages: {', '.join(pkg_names)}")
        assert any("3 kW On-Grid" in name for name in pkg_names)
        assert any("5 kW On-Grid" in name for name in pkg_names)
        assert any("10 kW On-Grid" in name for name in pkg_names)
        assert any("3 kW Off-Grid" in name for name in pkg_names)
        assert any("5 kW Off-Grid" in name for name in pkg_names)

        # Step 3: Create a fresh customer, enquiry, survey, quotation, and order for BOM testing
        print("\n>>> Step 3: Create Fresh Customer & Order for Multi-Warehouse Allocation...")
        c_res = await client.post("/api/customers", json={
            "name": "Kavita Rathi",
            "phone": "+91 98221 44332",
            "email": "kavita.rathi@gmail.com",
            "address": "Greenfield Villas, Aundh",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411007",
            "consumer_number": "MSEDCL-AUN-554120",
            "avg_monthly_bill_paise": 620000,
            "sanctioned_load_kw": 8.0
        })
        cust = c_res.json()
        cust_id = cust["id"]

        e_res = await client.post("/api/enquiries", json={
            "customer_id": cust_id,
            "required_capacity_kw": 6.0,
            "property_type": "Residential",
            "roof_type": "RCC Flat",
            "grid_type": "ON_GRID",
            "budget_paise": 38000000
        })
        enq = e_res.json()
        enq_id = enq["id"]

        s_res = await client.post("/api/surveys", json={
            "enquiry_id": enq_id,
            "surveyor_name": "Mahesh Site Engineer",
            "roof_area_sqft": 900.0,
            "usable_roof_area_sqft": 750.0,
            "roof_type": "RCC Flat",
            "recommended_capacity_kw": 6.0,
            "meter_type": "THREE_PHASE"
        })
        survey = s_res.json()
        survey_id = survey["id"]

        q_res = await client.post("/api/quotations", json={
            "enquiry_id": enq_id,
            "survey_id": survey_id,
            "customer_id": cust_id,
            "system_capacity_kw": 6.0,
            "gross_amount_paise": 33000000,
            "subsidy_amount_paise": 7800000,
            "discount_paise": 500000,
            "tax_amount_paise": 0,
            "net_amount_paise": 24700000,
            "estimated_annual_units_kwh": 9000.0,
            "items": []
        })
        quote = q_res.json()
        quote_id = quote["id"]

        # Accept Quote -> Creates Order
        ord_res = await client.post(f"/api/quotations/{quote_id}/accept")
        order = ord_res.json()
        order_id = order["id"]
        print(f"Created Fresh Order {order['order_number']} (ID {order_id})")

        # Step 4: Generate BOM
        print("\n>>> Step 4: Generate BOM for Order...")
        bom_res = await client.post(f"/api/orders/{order_id}/generate-bom")
        assert bom_res.status_code == 200, f"Generate BOM failed: {bom_res.text}"
        bom = bom_res.json()
        print(f"Generated BOM: {bom['bom_number']} (Items: {bom['items_count']}, Material Cost: Rs. {bom['total_cost_inr']:,.2f})")
        assert bom["items_count"] >= 4

        # Step 5: Duplicate BOM Prevention Test
        print("\n>>> Step 5: Duplicate BOM Prevention Test...")
        bom_res2 = await client.post(f"/api/orders/{order_id}/generate-bom")
        assert bom_res2.status_code == 200
        bom2 = bom_res2.json()
        assert bom2["bom_id"] == bom["bom_id"], "Duplicate BOM was created!"
        print("[PASSED] Duplicate BOM prevention confirmed.")

        # Step 6: Multi-Warehouse Inventory Check
        print("\n>>> Step 6: Multi-Warehouse Inventory Inspection...")
        inv_res = await client.get("/api/inventory")
        assert inv_res.status_code == 200
        inventory = inv_res.json()
        print(f"Total stock lines across warehouses: {len(inventory)}")
        # Verify available stock formula for all records
        for item in inventory:
            assert item["available"] == item["qty_on_hand"] - item["qty_reserved"]
            assert item["available"] >= 0, "Available stock is negative!"
        print("[PASSED] Available stock formula verified (available = on_hand - reserved >= 0).")

        # Step 7: Stock Adjustment & Negative Stock Prevention
        print("\n>>> Step 7: Stock Adjustment & Negative Prevention Test...")
        wh_pune = next(i for i in inventory if "PUN" in i["warehouse_code"])
        # Attempt to subtract more than available
        excess_qty = -(wh_pune["available"] + 100)
        neg_res = await client.post("/api/inventory/adjustments", json={
            "warehouse_id": wh_pune["warehouse_id"],
            "component_id": wh_pune["component_id"],
            "quantity_change": excess_qty
        })
        assert neg_res.status_code == 400, "Negative stock was not blocked!"
        print(f"[PASSED] Correctly blocked adjustment that would cause negative available stock: {neg_res.json().get('detail')}")

        # Step 8: Multi-Warehouse Allocation Execution
        print("\n>>> Step 8: Execute Intelligent Multi-Warehouse Allocation...")
        alloc_res = await client.post(f"/api/orders/{order_id}/allocate-inventory", json={
            "preferred_warehouse_id": wh_pune["warehouse_id"],
            "allow_partial": False
        })
        assert alloc_res.status_code == 200, f"Allocation failed: {alloc_res.text}"
        alloc_data = alloc_res.json()
        print(f"Allocation Successful: {alloc_data['success']}")
        print(f"  Order Stage:       {alloc_data['order_stage']}")
        print(f"  BOM Status:        {alloc_data['bom_status']}")
        print(f"  Total Allocations: {alloc_data['allocations_count']}")
        assert alloc_data["is_fully_allocated"] is True
        assert alloc_data["order_stage"] == "INVENTORY_ALLOCATED"

        # Step 9: Inspect Order BOM to verify multi-warehouse allocation breakdown
        print("\n>>> Step 9: Verify Detailed BOM Allocation Breakdown...")
        bom_view = await client.get(f"/api/orders/{order_id}/bom")
        assert bom_view.status_code == 200
        bom_detail = bom_view.json()
        print(f"Inspecting {bom_detail['bom_number']}:")
        warehouses_involved = set()
        for it in bom_detail["items"]:
            for a in it["allocations"]:
                warehouses_involved.add(a["warehouse_name"])
                print(f"  - {it['component_name']}: {a['allocated_quantity']} units from {a['warehouse_name']} ({a['warehouse_city']})")
        print(f"Total Warehouses Supplying this Order: {len(warehouses_involved)} ({', '.join(warehouses_involved)})")
        assert len(warehouses_involved) >= 1

    print("\n==================================================================")
    print(" [SUCCESS] ALL 9 STAGE 3 INTEGRATION TESTS PASSED PERFECTLY!")
    print("==================================================================")


if __name__ == "__main__":
    anyio.run(run_stage3_tests)

