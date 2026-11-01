import sys
import os
import anyio
import httpx

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, Base
from app.main import app


async def run_stage2_tests():
    print("==================================================================")
    print(" STAGE 2 END-TO-END SALES & CUSTOMER WORKFLOW TEST SUITE")
    print("==================================================================")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 0. Reset seed data first
        print("\n>>> Step 0: Resetting Seed Data...")
        res_seed = await client.post("/api/seed/reset")
        assert res_seed.status_code == 200, f"Seed failed: {res_seed.text}"
        print("Seed reset successful.")

        # 1. Create Customer
        print("\n>>> Step 1: Create New Customer...")
        cust_payload = {
            "name": "Nitin Gadre",
            "phone": "+91 98229 99887",
            "email": "nitin.gadre@gmail.com",
            "address": "Row House 4, Orchid Enclave, Kothrud",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411038",
            "consumer_number": "MSEDCL-KOT-778210",
            "avg_monthly_bill_paise": 550000,
            "sanctioned_load_kw": 7.0
        }
        res_cust = await client.post("/api/customers", json=cust_payload)
        assert res_cust.status_code == 201, f"Create customer failed: {res_cust.text}"
        customer = res_cust.json()
        cust_id = customer["id"]
        print(f"Created Customer ID {cust_id}: {customer['name']} ({customer['phone']})")

        # 2. Create Enquiry
        print("\n>>> Step 2: Create Solar Enquiry for Customer...")
        enq_payload = {
            "customer_id": cust_id,
            "required_capacity_kw": 6.0,
            "property_type": "Residential",
            "roof_type": "RCC Flat",
            "grid_type": "ON_GRID",
            "budget_paise": 35000000,
            "notes": "Looking for Waaree bifacial modules with zero net-metering export limit."
        }
        res_enq = await client.post("/api/enquiries", json=enq_payload)
        assert res_enq.status_code == 201, f"Create enquiry failed: {res_enq.text}"
        enquiry = res_enq.json()
        enq_id = enquiry["id"]
        print(f"Created Enquiry ID {enq_id}: {enquiry['enquiry_number']} (Status: {enquiry['status']})")

        # 3. Schedule Site Survey
        print("\n>>> Step 3: Schedule Site Survey...")
        sched_payload = {
            "surveyor_name": "Rohan Deshmukh",
            "notes": "Parapet wall measurement and staircase shadow mapping required."
        }
        res_sched = await client.post(f"/api/enquiries/{enq_id}/schedule-survey", json=sched_payload)
        assert res_sched.status_code == 201, f"Schedule survey failed: {res_sched.text}"
        survey = res_sched.json()
        survey_id = survey["id"]
        print(f"Scheduled Survey ID {survey_id}: {survey['survey_number']} (Status: {survey['status']})")

        # 4. BUSINESS RULE TEST: Attempt to create quotation while survey is in SCHEDULED status (should fail with 400)
        print("\n>>> Step 4: Business Rule Test - Creating Quotation before Survey Approval...")
        premature_quote = {
            "enquiry_id": enq_id,
            "survey_id": survey_id,
            "system_capacity_kw": 6.0,
            "gross_amount_paise": 32000000,
            "subsidy_amount_paise": 7800000,
            "discount_paise": 0,
            "tax_amount_paise": 0,
            "net_amount_paise": 24200000,
            "items": []
        }
        res_premature = await client.post("/api/quotations", json=premature_quote)
        print(f"Quotation attempt result: status={res_premature.status_code}, detail='{res_premature.json().get('detail')}'")
        assert res_premature.status_code == 400, "Validation failed: Quotation was incorrectly allowed without approved survey!"
        print("[PASSED] Business rule correctly blocked unapproved survey quotation!")

        # 5. Record / Approve Site Survey
        print("\n>>> Step 5: Approve Site Survey...")
        res_approve = await client.patch(f"/api/surveys/{survey_id}/approve")
        assert res_approve.status_code == 200, f"Approve survey failed: {res_approve.text}"
        approved_survey = res_approve.json()
        print(f"Survey {survey_id} status updated to: {approved_survey['status']}")

        # 6. Generate Quotation
        print("\n>>> Step 6: Generate Formal Solar Proposal / Quotation...")
        quote_payload = {
            "enquiry_id": enq_id,
            "survey_id": survey_id,
            "customer_id": cust_id,
            "system_capacity_kw": 6.0,
            "gross_amount_paise": 33000000,       # Rs. 3,30,000
            "subsidy_amount_paise": 7800000,      # Rs. 78,000 PM Surya Ghar
            "discount_paise": 1000000,            # Rs. 10,000 festive promo
            "tax_amount_paise": 0,
            "net_amount_paise": 24200000,         # Rs. 2,42,000 Net
            "estimated_annual_units_kwh": 9000.0,
            "estimated_payback_years": 3.7,
            "validity_days": 30,
            "notes": "Includes tier-1 bifacial panels, 5kW sungrow inverter, and 5-yr O&M.",
            "items": [
                {
                    "item_description": "Waaree 550W Bifacial Dual-Glass PV Modules (11 units)",
                    "quantity": 11,
                    "unit_price_paise": 1250000,
                    "total_price_paise": 13750000
                },
                {
                    "item_description": "Sungrow SG5.0RS Solar Inverter with Wi-Fi Logger",
                    "quantity": 1,
                    "unit_price_paise": 4800000,
                    "total_price_paise": 4800000
                },
                {
                    "item_description": "Elevated Hot Dip Galvanized Module Mounting Structure",
                    "quantity": 3,
                    "unit_price_paise": 520000,
                    "total_price_paise": 1560000
                }
            ]
        }
        res_quote = await client.post("/api/quotations", json=quote_payload)
        assert res_quote.status_code == 201, f"Create quotation failed: {res_quote.text}"
        quotation = res_quote.json()
        quote_id = quotation["id"]
        print(f"Generated Quotation ID {quote_id}: {quotation['quotation_number']} for Net Rs. {quotation['net_amount_paise']/100:,.2f}")

        # 7. Accept Quotation & Automatically Convert to Order
        print("\n>>> Step 7: Accept Quotation & Auto-Convert to Order...")
        res_accept = await client.post(f"/api/quotations/{quote_id}/accept")
        assert res_accept.status_code == 200, f"Accept quotation failed: {res_accept.text}"
        order = res_accept.json()
        order_id = order["id"]
        print(f"Created Order ID {order_id}: {order['order_number']}")
        print(f"  Contract Value: Rs. {order['total_contract_paise']/100:,.2f}")
        print(f"  Advance Paid:   Rs. {order['advance_received_paise']/100:,.2f}")
        print(f"  Order Stage:    {order['stage']}")

        # 8. Duplicate Order Prevention Test
        print("\n>>> Step 8: Duplicate Order Prevention Test...")
        res_accept_dup = await client.post(f"/api/quotations/{quote_id}/accept")
        assert res_accept_dup.status_code == 200
        order_dup = res_accept_dup.json()
        assert order_dup["id"] == order_id, "Duplicate order was created!"
        print(f"[PASSED] Duplicate prevention confirmed (Returned same order ID {order_dup['id']})")

        # 9. Verify Order in GET /api/orders
        print("\n>>> Step 9: Verify Order List...")
        res_orders = await client.get("/api/orders")
        assert res_orders.status_code == 200
        orders_list = res_orders.json()
        found_order = next((o for o in orders_list if o["id"] == order_id), None)
        assert found_order is not None, "Created order not found in /api/orders!"
        print(f"Found order in list: {found_order['order_number']} (Customer: {found_order['customer_name']})")

        # 10. Verify Dashboard Metrics Integration
        print("\n>>> Step 10: Verify Dashboard Metrics Integration...")
        res_dash = await client.get("/api/dashboard")
        assert res_dash.status_code == 200
        dash = res_dash.json()
        metrics = dash["metrics"]
        print(f"Dashboard Metrics: Customers={metrics['total_customers']}, Enquiries={metrics['total_enquiries']}, Confirmed Orders={metrics['confirmed_orders']}, Total Contract INR=Rs. {metrics['total_confirmed_contract_inr']:,.2f}")
        assert metrics["total_customers"] >= 5
        assert metrics["confirmed_orders"] >= 2
        assert metrics["total_confirmed_contract_inr"] > 212000.0

        # 11. Relational Integrity Safe Delete Test
        print("\n>>> Step 11: Relational Integrity Delete Protection...")
        res_del = await client.delete(f"/api/customers/{cust_id}")
        assert res_del.status_code == 400, f"Expected 400 error on deleting customer with active order, got: {res_del.status_code}"
        print(f"[PASSED] Protected customer from unsafe deletion: {res_del.json().get('detail')}")

    print("\n==================================================================")
    print(" [SUCCESS] ALL 11 STAGE 2 INTEGRATION TESTS PASSED PERFECTLY!")
    print("==================================================================")


if __name__ == "__main__":
    anyio.run(run_stage2_tests)
