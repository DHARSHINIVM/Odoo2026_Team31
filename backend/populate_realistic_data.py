"""
Populate Realistic & Practical Production Records Across All 31 Tables
SunPower Solutions — Solar Installation Management System
"""
import os
import sys
import datetime
import hashlib
import json
import secrets

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import SessionLocal, engine, Base
from app.models import (
    User, UserSession, Customer, Enquiry, SiteSurvey, Quotation, QuotationItem,
    Package, PackageItem, Component, Order, BillOfMaterials, BOMItem, BOMAllocation,
    Warehouse, WarehouseStock, StockMovement, InventoryTransfer, Dispatch,
    SerializedItem, DigitalSolarPassport, Installation, Warranty, WarrantyPolicy,
    ServiceTicket, Document, AuditLog, SubsidyApplication, Notification,
    Payment, ProjectExpense
)
from app.models.user_auth import hash_password
from app.services.passport_service import PassportService


def populate_all_tables():
    db = SessionLocal()
    print("=" * 80)
    print("POPULATING REALISTIC & PRACTICAL RECORDS ACROSS ALL 31 TABLES")
    print("=" * 80)

    # 1. Ensure schema exists
    Base.metadata.create_all(bind=engine)

    # 2. Clear tables in reverse dependency order
    tables_to_clear = [
        ProjectExpense, Payment, Notification, SubsidyApplication, AuditLog,
        Document, ServiceTicket, Warranty, WarrantyPolicy, SerializedItem,
        DigitalSolarPassport, Installation, Dispatch, InventoryTransfer,
        StockMovement, BOMAllocation, BOMItem, BillOfMaterials, Order,
        QuotationItem, Quotation, SiteSurvey, Enquiry, PackageItem, Package,
        Component, WarehouseStock, Warehouse, Customer, UserSession, User
    ]
    for tbl in tables_to_clear:
        try:
            db.query(tbl).delete()
        except Exception:
            pass
    db.commit()
    print("[1/31] Cleared existing data cleanly.")

    # pyrefly: ignore[deprecated]
    now = datetime.datetime.now(datetime.timezone.utc)

    # -------------------------------------------------------------------------
    # 1. USERS (7 Staff Roles)
    # -------------------------------------------------------------------------
    users = [
        User(username="admin", hashed_password=hash_password("admin123"), full_name="Aditya Kulkarni", email="admin@sunpowersolutions.in", role="ADMIN", is_active=True),
        User(username="sales", hashed_password=hash_password("sales123"), full_name="Rahul Deshmukh", email="rahul.d@sunpowersolutions.in", role="SALES_EXECUTIVE", is_active=True),
        User(username="surveymgr", hashed_password=hash_password("survey123"), full_name="Suresh Gaikwad", email="suresh.g@sunpowersolutions.in", role="SURVEY_MANAGER", is_active=True),
        User(username="surveytech", hashed_password=hash_password("survey123"), full_name="Nilesh Shinde", email="nilesh.s@sunpowersolutions.in", role="SURVEY_TECHNICIAN", is_active=True),
        User(username="warehouse", hashed_password=hash_password("wh123"), full_name="Kishore More", email="kishore.m@sunpowersolutions.in", role="WAREHOUSE_MANAGER", is_active=True),
        User(username="installtech", hashed_password=hash_password("tech123"), full_name="Ramesh Patil", email="ramesh.p@sunpowersolutions.in", role="INSTALLATION_TECHNICIAN", is_active=True),
        User(username="servicemgr", hashed_password=hash_password("service123"), full_name="Vikram Joshi", email="vikram.j@sunpowersolutions.in", role="SERVICE_MANAGER", is_active=True),
    ]
    db.add_all(users)
    db.flush()
    print(f"[2/31] Users created: {len(users)}")

    # -------------------------------------------------------------------------
    # 2. USER SESSIONS
    # -------------------------------------------------------------------------
    sessions = [
        UserSession(session_id=secrets.token_hex(16), user_id=users[0].id, token_jti=secrets.token_hex(16), ip_address="127.0.0.1", user_agent="Mozilla/5.0 Antigravity Chrome/120", expires_at=now + datetime.timedelta(days=7), is_revoked=False),
        UserSession(session_id=secrets.token_hex(16), user_id=users[1].id, token_jti=secrets.token_hex(16), ip_address="127.0.0.1", user_agent="Mozilla/5.0 Antigravity Chrome/120", expires_at=now + datetime.timedelta(days=7), is_revoked=False)
    ]
    db.add_all(sessions)
    db.flush()
    print(f"[3/31] User Sessions created: {len(sessions)}")

    # -------------------------------------------------------------------------
    # 3. CUSTOMERS (12 Real Maharashtra Residential & C&I Clients)
    # -------------------------------------------------------------------------
    cust_data = [
        ("CUST-101", "Rajesh Sharma", "rajesh.sharma@gmail.com", "+91 98220 12345", "Row House 14, Clover Highlands, NIBM Road", "Pune", "Maharashtra", "411048", "INDIVIDUAL", "MSEDCL-012345678901"),
        ("CUST-102", "Amit Patel", "amit.patel@rediffmail.com", "+91 98221 23456", "Plot 42, Sector 18, Vashi", "Navi Mumbai", "Maharashtra", "400703", "INDIVIDUAL", "MSEDCL-012345678902"),
        ("CUST-103", "Priya Kulkarni", "priya.kulkarni@gmail.com", "+91 98222 34567", "Flat 502, Blue Ridge Tower 8, Hinjewadi", "Pune", "Maharashtra", "411057", "INDIVIDUAL", "MSEDCL-012345678903"),
        ("CUST-104", "Vikram Joshi", "v.joshi@nashikauto.co.in", "+91 98223 45678", "Plot D-14, MIDC Ambad", "Nashik", "Maharashtra", "422010", "ENTERPRISE", "MSEDCL-012345678904"),
        ("CUST-105", "Sneha Deshmukh", "sneha.deshmukh@gmail.com", "+91 98224 56789", "Bunglow 7, Shivaji Housing Society, Senapati Bapat Road", "Pune", "Maharashtra", "411016", "INDIVIDUAL", "MSEDCL-012345678905"),
        ("CUST-106", "Anand Verma", "anand.verma@vermatex.com", "+91 98225 67890", "Gat 214, Chakan-Talegaon Road, Mahalunge", "Pune", "Maharashtra", "410501", "ENTERPRISE", "MSEDCL-012345678906"),
        ("CUST-107", "Kavita Rao", "kavita.rao@yahoo.co.in", "+91 98226 78901", "Villa 9, Forest Trails, Bhugaon", "Pune", "Maharashtra", "412115", "INDIVIDUAL", "MSEDCL-012345678907"),
        ("CUST-108", "Manoj Agarwal", "m.agarwal@agarwalplastics.in", "+91 98227 89012", "W-12, Butibori Industrial Estate", "Nagpur", "Maharashtra", "441122", "ENTERPRISE", "MSEDCL-012345678908"),
        ("CUST-109", "Pooja Nair", "pooja.nair@hotmail.com", "+91 98228 90123", "B-403, Hiranandani Meadows, Ghodbunder Road", "Thane", "Maharashtra", "400610", "INDIVIDUAL", "MSEDCL-012345678909"),
        ("CUST-110", "Sanjay Mehta", "sanjay@mehtawares.com", "+91 98229 01234", "Plot 88, Kalamboli Warehousing Zone", "Navi Mumbai", "Maharashtra", "410218", "ENTERPRISE", "MSEDCL-012345678910"),
        ("CUST-111", "Deepak Shinde", "deepak.shinde@gmail.com", "+91 98230 12345", "S.No 45/2, Baner-Pashan Link Road", "Pune", "Maharashtra", "411045", "INDIVIDUAL", "MSEDCL-012345678911"),
        ("CUST-112", "Rohit Bhosale", "rohit.bhosale@bhosaleengg.com", "+91 98231 23456", "Plot J-88, MIDC Bhosari", "Pimpri-Chinchwad", "Maharashtra", "411026", "ENTERPRISE", "MSEDCL-012345678912")
    ]
    customers = [Customer(customer_code=d[0], name=d[1], email=d[2], phone=d[3], address=d[4], city=d[5], state=d[6], pincode=d[7], customer_type=d[8], utility_consumer_number=d[9], is_active=True, created_at=now - datetime.timedelta(days=40)) for d in cust_data]
    db.add_all(customers)
    db.flush()
    print(f"[4/31] Customers created: {len(customers)}")

    # -------------------------------------------------------------------------
    # 4. WAREHOUSES (3 Strategic Distribution Hubs)
    # -------------------------------------------------------------------------
    wh_data = [
        ("Central Pune Logistics Depot", "WH-PUN-01", "Gat 412, Chakan Industrial Area Phase II, Khed", "Pune", "Maharashtra", "410501", "+91 20 6711 0001", "kishore.m@sunpowersolutions.in", True, 25000),
        ("Mumbai MMR Fulfillment Hub", "WH-MUM-01", "Survey 84, Indian Corporation Logistics Park, Mankoli, Bhiwandi", "Thane", "Maharashtra", "421302", "+91 25 2229 0002", "mumbai.wh@sunpowersolutions.in", False, 18000),
        ("Vidarbha Regional Depot", "WH-NAG-01", "Plot B-19, Butibori Industrial Area, Wardha Road", "Nagpur", "Maharashtra", "441122", "+91 71 0422 0003", "nagpur.wh@sunpowersolutions.in", False, 12000)
    ]
    warehouses = [Warehouse(name=w[0], code=w[1], address=w[2], city=w[3], state=w[4], pincode=w[5], phone=w[6], email=w[7], is_primary=w[8], capacity_sqft=w[9], is_active=True) for w in wh_data]
    db.add_all(warehouses)
    db.flush()
    print(f"[5/31] Warehouses created: {len(warehouses)}")

    # -------------------------------------------------------------------------
    # 5. COMPONENTS (14 Tier-1 Certified Solar Hardware)
    # -------------------------------------------------------------------------
    cmp_data = [
        ("Waaree Bi-550 Bifacial Dual Glass 550W", "WSM-550W-BF", "PANEL", "Waaree Energies Ltd", "PANEL-WAR-550", 1210000, 25, "Bifacial Mono PERC module with 21.3% efficiency. ALMM approved.", 94, "Tier 1"),
        ("Tata Power Solar Mono PERC 540W", "TPS-540W-MP", "PANEL", "Tata Power Solar", "PANEL-TAT-540", 1180000, 25, "High-reliability mono crystalline module. ALMM approved.", 92, "Tier 1"),
        ("Adani Solar Shine Series 535W", "ADN-535W-SH", "PANEL", "Adani Solar", "PANEL-ADN-535", 1160000, 25, "High-efficiency multi-busbar technology.", 90, "Tier 1"),
        ("Sungrow 5kW Dual MPPT On-Grid Inverter", "SG5.0RS", "INVERTER", "Sungrow Power Supply", "INV-SNG-5K", 4200000, 10, "Single-phase residential on-grid inverter with Wi-Fi dongle. 98.4% efficiency.", 96, "Tier 1"),
        ("Growatt 10kW 3-Phase Commercial Inverter", "MID 10KTL3-X", "INVERTER", "Growatt New Energy", "INV-GRW-10K", 7600000, 10, "Three-phase commercial solar inverter with dual MPPT and OLED display.", 93, "Tier 1"),
        ("Solis 3kW Single Phase Inverter", "S6-GR1P3K", "INVERTER", "Ginlong Solis", "INV-SOL-3K", 2800000, 10, "Compact residential rooftop inverter. Low startup voltage.", 89, "Tier 1"),
        ("Hot Dip Galvanized 80-Micron Elevated Structure (3-Panel)", "HDG-RF-3P", "STRUCTURE", "SunPower Fabrications", "STR-HDG-3P", 450000, 5, "Pre-galvanized structure rated for 150 km/h wind load.", 88, "Standard"),
        ("Hot Dip Galvanized 80-Micron Elevated Structure (4-Panel)", "HDG-RF-4P", "STRUCTURE", "SunPower Fabrications", "STR-HDG-4P", 580000, 5, "Engineered structural steel mounting rack with SS304 fasteners.", 89, "Standard"),
        ("Luminous 4.8kWh LiFePO4 Battery Pack 48V 100Ah", "LUM-LI-48100", "BATTERY", "Luminous Power", "BAT-LUM-48V", 8500000, 7, "Lithium iron phosphate storage battery with integrated BMS. 4,000 cycles at 80% DoD.", 91, "Tier 1"),
        ("Polycab 1x4 sq mm Solar DC Cable (100m Drum)", "PC-DC-4MM", "CABLE", "Polycab India", "CAB-POL-4MM", 650000, 15, "Tinned copper flexible solar DC cable. EN 50618 certified.", 92, "Standard"),
        ("Polycab 4x6 sq mm Copper Armoured AC Cable (50m Coil)", "PC-AC-6MM", "CABLE", "Polycab India", "CAB-POL-6MM", 880000, 15, "Heavy-duty underground armoured AC cable for grid feed.", 90, "Standard"),
        ("Phoenix Contact 1000V DC SPD Box with Fuses", "VAL-MS-1000DC", "BOS", "Phoenix Contact", "BOS-PHX-SPD", 320000, 5, "Type II surge protection device with gPV fuses.", 95, "Tier 1"),
        ("Secure Premier 300 Bi-directional Net Meter (3-Phase)", "PRM-300-3P", "METER", "Secure Meters Ltd", "MET-SEC-3P", 680000, 5, "MSEDCL-approved 3-phase optical bi-directional net generation meter.", 94, "Tier 1"),
        ("Schneider Electric Acti9 32A 4P MCB & Enclosure", "A9F-32A-4P", "BOS", "Schneider Electric", "BOS-SCH-MCB", 240000, 5, "IP65 weatherproof AC distribution box with isolator.", 93, "Tier 1")
    ]
    components = [Component(name=c[0], model_number=c[1], category=c[2], manufacturer=c[3], sku=c[4], unit_price_paise=c[5], warranty_years=c[6], description=c[7], credibility_score=c[8], tier_grade=c[9], is_active=True) for c in cmp_data]
    db.add_all(components)
    db.flush()
    print(f"[6/31] Components created: {len(components)}")

    # -------------------------------------------------------------------------
    # 6. PACKAGES & PACKAGE ITEMS
    # -------------------------------------------------------------------------
    pkg_3kw = Package(name="3 kW Residential On-Grid", code="PKG-3KW-ONGRID", capacity_kw=3.0, description="Ideal for 2-3 BHK households. 6x 550W Waaree bifacial panels + Sungrow 3kW inverter.", total_price_paise=19500000)
    pkg_5kw = Package(name="5 kW Premium Residential On-Grid", code="PKG-5KW-ONGRID", capacity_kw=5.0, description="Highest selling system. 10x 550W Waaree panels + Sungrow 5kW Dual MPPT inverter.", total_price_paise=28500000)
    pkg_10kw = Package(name="10 kW Commercial 3-Phase On-Grid", code="PKG-10KW-ONGRID", capacity_kw=10.0, description="Commercial rooftop setup with 18x 550W panels and Growatt 10kW inverter.", total_price_paise=52000000)
    pkg_5kw_off = Package(name="5 kW Off-Grid Storage System", code="PKG-5KW-OFFGRID", capacity_kw=5.0, description="Full power backup with 10x panels and 4.8kWh Luminous LiFePO4 battery pack.", total_price_paise=39500000)
    pkg_3kw_tata = Package(name="3 kW Tata Power High-Durability Kit", code="PKG-3KW-TATA", capacity_kw=3.0, description="Tata Power 540W panels with Solis 3kW single-phase inverter.", total_price_paise=20500000)
    packages = [pkg_3kw, pkg_5kw, pkg_10kw, pkg_5kw_off, pkg_3kw_tata]
    db.add_all(packages)
    db.flush()

    pkg_items = [
        PackageItem(package_id=pkg_3kw.id, component_id=components[0].id, quantity=6),
        PackageItem(package_id=pkg_3kw.id, component_id=components[5].id, quantity=1),
        PackageItem(package_id=pkg_3kw.id, component_id=components[6].id, quantity=2),
        PackageItem(package_id=pkg_3kw.id, component_id=components[9].id, quantity=1),
        PackageItem(package_id=pkg_3kw.id, component_id=components[11].id, quantity=1),
        PackageItem(package_id=pkg_3kw.id, component_id=components[13].id, quantity=1),
        PackageItem(package_id=pkg_5kw.id, component_id=components[0].id, quantity=10),
        PackageItem(package_id=pkg_5kw.id, component_id=components[3].id, quantity=1),
        PackageItem(package_id=pkg_5kw.id, component_id=components[6].id, quantity=3),
        PackageItem(package_id=pkg_5kw.id, component_id=components[9].id, quantity=1),
        PackageItem(package_id=pkg_5kw.id, component_id=components[11].id, quantity=1),
        PackageItem(package_id=pkg_5kw.id, component_id=components[13].id, quantity=1),
        PackageItem(package_id=pkg_10kw.id, component_id=components[0].id, quantity=18),
        PackageItem(package_id=pkg_10kw.id, component_id=components[4].id, quantity=1),
        PackageItem(package_id=pkg_10kw.id, component_id=components[7].id, quantity=5),
        PackageItem(package_id=pkg_10kw.id, component_id=components[9].id, quantity=2),
        PackageItem(package_id=pkg_10kw.id, component_id=components[10].id, quantity=1),
        PackageItem(package_id=pkg_10kw.id, component_id=components[12].id, quantity=1),
        PackageItem(package_id=pkg_5kw_off.id, component_id=components[0].id, quantity=10),
        PackageItem(package_id=pkg_5kw_off.id, component_id=components[3].id, quantity=1),
        PackageItem(package_id=pkg_5kw_off.id, component_id=components[8].id, quantity=1),
        PackageItem(package_id=pkg_5kw_off.id, component_id=components[6].id, quantity=3),
        PackageItem(package_id=pkg_5kw_off.id, component_id=components[9].id, quantity=1),
        PackageItem(package_id=pkg_3kw_tata.id, component_id=components[1].id, quantity=6),
        PackageItem(package_id=pkg_3kw_tata.id, component_id=components[5].id, quantity=1),
        PackageItem(package_id=pkg_3kw_tata.id, component_id=components[6].id, quantity=2),
        PackageItem(package_id=pkg_3kw_tata.id, component_id=components[9].id, quantity=1)
    ]
    db.add_all(pkg_items)
    db.flush()
    print(f"[7/31] Packages & Items created: {len(packages)} packages, {len(pkg_items)} items")

    # -------------------------------------------------------------------------
    # 7. WAREHOUSE STOCK (Initial Physical Quantities Across 3 Hubs)
    # -------------------------------------------------------------------------
    stock_entries = []
    for wh in warehouses:
        for comp in components:
            if wh.code == "WH-PUN-01":
                q_hand = 180 if comp.category == "PANEL" else (40 if comp.category == "INVERTER" else 60)
            elif wh.code == "WH-MUM-01":
                q_hand = 90 if comp.category == "PANEL" else (20 if comp.category == "INVERTER" else 30)
            else:
                q_hand = 45 if comp.category == "PANEL" else (10 if comp.category == "INVERTER" else 15)
            stock_entries.append(WarehouseStock(warehouse_id=wh.id, component_id=comp.id, qty_on_hand=q_hand, qty_reserved=0, reorder_threshold=15, reorder_quantity=50, last_updated=now))
    db.add_all(stock_entries)
    db.flush()
    print(f"[8/31] Warehouse Stock records created: {len(stock_entries)}")

    # -------------------------------------------------------------------------
    # 8. STOCK MOVEMENTS (Auditable Physical Receipts)
    # -------------------------------------------------------------------------
    stock_mv = [
        StockMovement(warehouse_id=warehouses[0].id, component_id=components[0].id, quantity_change=200, movement_type="PURCHASE_RECEIPT", notes="Factory shipment from Waaree Surat plant. PO #PO-2026-081", created_at=now - datetime.timedelta(days=25)),
        StockMovement(warehouse_id=warehouses[0].id, component_id=components[3].id, quantity_change=50, movement_type="PURCHASE_RECEIPT", notes="Factory consignment from Sungrow Power India. PO #PO-2026-082", created_at=now - datetime.timedelta(days=24)),
        StockMovement(warehouse_id=warehouses[1].id, component_id=components[0].id, quantity_change=100, movement_type="PURCHASE_RECEIPT", notes="Stock intake for Mumbai MMR operations. PO #PO-2026-083", created_at=now - datetime.timedelta(days=20)),
        StockMovement(warehouse_id=warehouses[2].id, component_id=components[0].id, quantity_change=50, movement_type="PURCHASE_RECEIPT", notes="Stock intake for Vidarbha regional distribution. PO #PO-2026-084", created_at=now - datetime.timedelta(days=18))
    ]
    db.add_all(stock_mv)
    db.flush()
    print(f"[9/31] Stock Movements logged: {len(stock_mv)}")

    # -------------------------------------------------------------------------
    # 9. INVENTORY TRANSFERS (Inter-warehouse Rebalancing)
    # -------------------------------------------------------------------------
    transfers = [
        InventoryTransfer(transfer_number="TRF-2026-001", source_warehouse_id=warehouses[0].id, dest_warehouse_id=warehouses[1].id, component_id=components[0].id, quantity=20, status="RECEIVED", requested_by_user_id=users[4].id, requested_by_name="Kishore More", approved_by_user_id=users[0].id, approved_by_name="Aditya Kulkarni", received_by_user_id=users[4].id, received_by_name="Kishore More", notes="Urgent transfer for Vashi and Thane residential orders via VRL Logistics.", created_at=now - datetime.timedelta(days=14), approved_at=now - datetime.timedelta(days=13), dispatched_at=now - datetime.timedelta(days=12), received_at=now - datetime.timedelta(days=10)),
        InventoryTransfer(transfer_number="TRF-2026-002", source_warehouse_id=warehouses[0].id, dest_warehouse_id=warehouses[2].id, component_id=components[3].id, quantity=5, status="RECEIVED", requested_by_user_id=users[4].id, requested_by_name="Kishore More", approved_by_user_id=users[0].id, approved_by_name="Aditya Kulkarni", received_by_user_id=users[4].id, received_by_name="Kishore More", notes="Inverter transfer for Nagpur MIDC orders.", created_at=now - datetime.timedelta(days=8), approved_at=now - datetime.timedelta(days=7), dispatched_at=now - datetime.timedelta(days=6), received_at=now - datetime.timedelta(days=5)),
        InventoryTransfer(transfer_number="TRF-2026-003", source_warehouse_id=warehouses[1].id, dest_warehouse_id=warehouses[0].id, component_id=components[8].id, quantity=2, status="IN_TRANSIT", requested_by_user_id=users[4].id, requested_by_name="Kishore More", approved_by_user_id=users[0].id, approved_by_name="Aditya Kulkarni", notes="LiFePO4 battery pack transfer dispatched via TCI Express.", created_at=now - datetime.timedelta(days=2), approved_at=now - datetime.timedelta(days=1), dispatched_at=now - datetime.timedelta(hours=18)),
        InventoryTransfer(transfer_number="TRF-2026-004", source_warehouse_id=warehouses[0].id, dest_warehouse_id=warehouses[1].id, component_id=components[4].id, quantity=3, status="REQUESTED", requested_by_user_id=users[4].id, requested_by_name="Kishore More", notes="Requested for upcoming commercial warehouse project in Bhiwandi.", created_at=now - datetime.timedelta(hours=5))
    ]
    db.add_all(transfers)
    db.flush()
    print(f"[10/31] Inventory Transfers created: {len(transfers)}")

    # -------------------------------------------------------------------------
    # 10. ENQUIRIES (12 Inbound Qualified Leads)
    # -------------------------------------------------------------------------
    enq_data = [
        (customers[0].id, "ENQ-2026-001", 5.0, "RESIDENTIAL", "ON_GRID", "APPROVED", 650000, 480, 450, "Clover Highlands rooftop, south facing. Customer wants Waaree panels."),
        (customers[1].id, "ENQ-2026-002", 5.0, "RESIDENTIAL", "ON_GRID", "APPROVED", 720000, 520, 500, "Vashi sector 18 bungalow. High summer electricity bills. Wants PM Surya Ghar subsidy."),
        (customers[2].id, "ENQ-2026-003", 3.0, "RESIDENTIAL", "ON_GRID", "APPROVED", 380000, 310, 320, "Hinjewadi top-floor terrace apartment. Shadow-free roof."),
        (customers[3].id, "ENQ-2026-004", 10.0, "COMMERCIAL", "ON_GRID", "APPROVED", 1450000, 1200, 1100, "MIDC Ambad machine shop. High daytime load. Seeking 3-phase commercial system."),
        (customers[4].id, "ENQ-2026-005", 5.0, "RESIDENTIAL", "ON_GRID", "APPROVED", 680000, 500, 480, "Senapati Bapat Road bungalow. Needs net-metering feasibility survey."),
        (customers[5].id, "ENQ-2026-006", 10.0, "COMMERCIAL", "ON_GRID", "SURVEY_SCHEDULED", 1800000, 1500, 1400, "Chakan auto-ancillary factory shed. Tin roof mounting required."),
        (customers[6].id, "ENQ-2026-007", 5.0, "RESIDENTIAL", "OFF_GRID", "SURVEY_SCHEDULED", 750000, 550, 520, "Forest Trails villa in Bhugaon. Frequent monsoon grid power cuts."),
        (customers[7].id, "ENQ-2026-008", 15.0, "COMMERCIAL", "ON_GRID", "NEW", 2200000, 1800, 1600, "Butibori plastic injection moulding plant. Heavy diesel generator usage."),
        (customers[8].id, "ENQ-2026-009", 3.0, "RESIDENTIAL", "ON_GRID", "NEW", 410000, 330, 300, "Thane penthouse terrace with private access."),
        (customers[9].id, "ENQ-2026-010", 25.0, "COMMERCIAL", "ON_GRID", "NEW", 3800000, 3100, 2800, "Kalamboli cold storage warehouse roof."),
        (customers[10].id, "ENQ-2026-011", 5.0, "RESIDENTIAL", "ON_GRID", "NEW", 620000, 460, 420, "Baner-Pashan residential row house."),
        (customers[11].id, "ENQ-2026-012", 10.0, "COMMERCIAL", "ON_GRID", "NEW", 1600000, 1300, 1150, "Bhosari CNC engineering workshop.")
    ]
    enquiries = [Enquiry(customer_id=e[0], enquiry_number=e[1], required_capacity_kw=e[2], property_type=e[3], grid_type=e[4], status=e[5], monthly_electricity_bill_paise=e[6], monthly_consumption_units=e[7], roof_area_sqft=e[8], notes=e[9], created_at=now - datetime.timedelta(days=30 - idx)) for idx, e in enumerate(enq_data)]
    db.add_all(enquiries)
    db.flush()
    print(f"[11/31] Enquiries created: {len(enquiries)}")

    # -------------------------------------------------------------------------
    # 11. SITE SURVEYS (5 Approved / Completed Technical Site Inspections)
    # -------------------------------------------------------------------------
    srv_data = [
        (enquiries[0].id, "SRV-2026-001", users[3].id, "Nilesh Shinde", 480.0, "RCC_FLAT", 180.0, 18.0, 3.2, 2.1, 28.0, "APPROVED", "Approved for 5kW installation. 10x 550W panels fit comfortably with 0 shading from parapet."),
        (enquiries[1].id, "SRV-2026-002", users[3].id, "Nilesh Shinde", 520.0, "RCC_FLAT", 185.0, 18.0, 2.8, 1.9, 32.0, "APPROVED", "Vashi site inspected. Reinforced RCC slab. Excellent south azimuth."),
        (enquiries[2].id, "SRV-2026-003", users[3].id, "Nilesh Shinde", 320.0, "RCC_FLAT", 175.0, 17.0, 4.1, 2.2, 22.0, "APPROVED", "Hinjewadi apartment terrace. Shading from water tank clear after 9:30 AM."),
        (enquiries[3].id, "SRV-2026-004", users[3].id, "Nilesh Shinde", 1200.0, "METAL_SHEET", 180.0, 12.0, 1.5, 1.8, 45.0, "APPROVED", "Ambad MIDC factory roof. Trapezoidal industrial sheet. Rail-less clamp mounting recommended."),
        (enquiries[4].id, "SRV-2026-005", users[3].id, "Nilesh Shinde", 500.0, "RCC_FLAT", 180.0, 18.0, 3.0, 2.0, 25.0, "APPROVED", "Senapati Bapat Road site cleared for 5kW Waaree + Sungrow system.")
    ]
    surveys = [SiteSurvey(enquiry_id=s[0], survey_number=s[1], assigned_technician_id=s[2], assigned_technician_name=s[3], roof_area_sqft=s[4], roof_type=s[5], azimuth_angle_deg=s[6], tilt_angle_deg=s[7], shading_percentage=s[8], earthing_resistance_ohms=s[9], cable_run_meters=s[10], status=s[11], technical_notes=s[12], review_notes="Reviewed and cleared by Survey Manager Suresh Gaikwad.", approved_by_id=users[2].id, created_at=now - datetime.timedelta(days=22 - idx), scheduled_date=now - datetime.timedelta(days=21 - idx), completed_at=now - datetime.timedelta(days=20 - idx)) for idx, s in enumerate(srv_data)]
    db.add_all(surveys)
    db.flush()
    print(f"[12/31] Site Surveys created: {len(surveys)}")

    # -------------------------------------------------------------------------
    # 12. QUOTATIONS & ITEMS (5 Accepted Commercial Proposals)
    # -------------------------------------------------------------------------
    quotations = [
        Quotation(quotation_number="QT-2026-001", enquiry_id=enquiries[0].id, survey_id=surveys[0].id, package_id=pkg_5kw.id, customer_id=customers[0].id, system_capacity_kw=5.0, gross_amount_paise=28500000, tax_amount_paise=3933000, net_amount_paise=32433000, estimated_annual_units_kwh=7400.0, estimated_payback_years=3.9, validity_days=30, valid_until=datetime.date.today() + datetime.timedelta(days=30), status="ACCEPTED", terms_and_conditions="Comprehensive 5-year SunPower EPC workmanship warranty. Standard net-metering liaisoning included.", created_at=now - datetime.timedelta(days=18)),
        Quotation(quotation_number="QT-2026-002", enquiry_id=enquiries[1].id, survey_id=surveys[1].id, package_id=pkg_5kw.id, customer_id=customers[1].id, system_capacity_kw=5.0, gross_amount_paise=28500000, tax_amount_paise=3933000, net_amount_paise=32433000, estimated_annual_units_kwh=7350.0, estimated_payback_years=4.0, validity_days=30, valid_until=datetime.date.today() + datetime.timedelta(days=30), status="ACCEPTED", terms_and_conditions="PM Surya Ghar subsidy deduction assistance included.", created_at=now - datetime.timedelta(days=16)),
        Quotation(quotation_number="QT-2026-003", enquiry_id=enquiries[2].id, survey_id=surveys[2].id, package_id=pkg_3kw.id, customer_id=customers[2].id, system_capacity_kw=3.0, gross_amount_paise=19500000, tax_amount_paise=2691000, net_amount_paise=22191000, estimated_annual_units_kwh=4450.0, estimated_payback_years=3.8, validity_days=30, valid_until=datetime.date.today() + datetime.timedelta(days=30), status="ACCEPTED", terms_and_conditions="Full turnkey residential rooftop installation.", created_at=now - datetime.timedelta(days=14)),
        Quotation(quotation_number="QT-2026-004", enquiry_id=enquiries[3].id, survey_id=surveys[3].id, package_id=pkg_10kw.id, customer_id=customers[3].id, system_capacity_kw=10.0, gross_amount_paise=52000000, tax_amount_paise=7176000, net_amount_paise=59176000, estimated_annual_units_kwh=14800.0, estimated_payback_years=3.5, validity_days=30, valid_until=datetime.date.today() + datetime.timedelta(days=30), status="ACCEPTED", terms_and_conditions="Commercial 3-phase system with industrial sheet clamps and net metering.", created_at=now - datetime.timedelta(days=12)),
        Quotation(quotation_number="QT-2026-005", enquiry_id=enquiries[4].id, survey_id=surveys[4].id, package_id=pkg_5kw.id, customer_id=customers[4].id, system_capacity_kw=5.0, gross_amount_paise=28500000, tax_amount_paise=3933000, net_amount_paise=32433000, estimated_annual_units_kwh=7400.0, estimated_payback_years=3.9, validity_days=30, valid_until=datetime.date.today() + datetime.timedelta(days=30), status="ACCEPTED", terms_and_conditions="Turnkey elevated structure installation.", created_at=now - datetime.timedelta(days=10))
    ]
    db.add_all(quotations)
    db.flush()

    quote_items = [
        QuotationItem(quotation_id=quotations[0].id, component_id=components[0].id, quantity=10, unit_price_paise=1210000, total_price_paise=12100000),
        QuotationItem(quotation_id=quotations[0].id, component_id=components[3].id, quantity=1, unit_price_paise=4200000, total_price_paise=4200000),
        QuotationItem(quotation_id=quotations[0].id, component_id=components[6].id, quantity=3, unit_price_paise=450000, total_price_paise=1350000),
        QuotationItem(quotation_id=quotations[0].id, component_id=components[9].id, quantity=1, unit_price_paise=650000, total_price_paise=650000),
        QuotationItem(quotation_id=quotations[1].id, component_id=components[0].id, quantity=10, unit_price_paise=1210000, total_price_paise=12100000),
        QuotationItem(quotation_id=quotations[1].id, component_id=components[3].id, quantity=1, unit_price_paise=4200000, total_price_paise=4200000)
    ]
    db.add_all(quote_items)
    db.flush()
    print(f"[13/31] Quotations & Items created: {len(quotations)} quotes, {len(quote_items)} items")

    # -------------------------------------------------------------------------
    # 13. ORDERS (5 Confirmed Contracts in Progressive Stages)
    # -------------------------------------------------------------------------
    orders = [
        Order(order_number="ORD-2026-0001", quotation_id=quotations[0].id, customer_id=customers[0].id, total_contract_paise=32433000, advance_required_paise=6486600, advance_received_paise=32433000, payment_status="COMPLETED", stage="COMMISSIONED", created_at=now - datetime.timedelta(days=15)),
        Order(order_number="ORD-2026-0002", quotation_id=quotations[1].id, customer_id=customers[1].id, total_contract_paise=32433000, advance_required_paise=6486600, advance_received_paise=32433000, payment_status="COMPLETED", stage="COMMISSIONED", created_at=now - datetime.timedelta(days=13)),
        Order(order_number="ORD-2026-0003", quotation_id=quotations[2].id, customer_id=customers[2].id, total_contract_paise=22191000, advance_required_paise=4438200, advance_received_paise=22191000, payment_status="COMPLETED", stage="COMMISSIONED", created_at=now - datetime.timedelta(days=11)),
        Order(order_number="ORD-2026-0004", quotation_id=quotations[3].id, customer_id=customers[3].id, total_contract_paise=59176000, advance_required_paise=11835200, advance_received_paise=40000000, payment_status="PARTIAL", stage="DISPATCHED", created_at=now - datetime.timedelta(days=9)),
        Order(order_number="ORD-2026-0005", quotation_id=quotations[4].id, customer_id=customers[4].id, total_contract_paise=32433000, advance_required_paise=6486600, advance_received_paise=6486600, payment_status="PARTIAL", stage="INVENTORY_ALLOCATED", created_at=now - datetime.timedelta(days=7))
    ]
    db.add_all(orders)
    db.flush()
    print(f"[14/31] Orders created: {len(orders)}")

    # -------------------------------------------------------------------------
    # 14. BILL OF MATERIALS, ITEMS & ALLOCATIONS
    # -------------------------------------------------------------------------
    boms = [BillOfMaterials(order_id=ord_obj.id, bom_number=f"BOM-{ord_obj.order_number}", status="ALLOCATED", total_estimated_cost_paise=int(ord_obj.total_contract_paise * 0.72), created_at=ord_obj.created_at) for ord_obj in orders[:4]]
    db.add_all(boms)
    db.flush()

    bom_items = [
        BOMItem(bom_id=boms[0].id, component_id=components[0].id, required_quantity=10, unit_cost_paise=1210000, total_cost_paise=12100000),
        BOMItem(bom_id=boms[0].id, component_id=components[3].id, required_quantity=1, unit_cost_paise=4200000, total_cost_paise=4200000),
        BOMItem(bom_id=boms[0].id, component_id=components[6].id, required_quantity=3, unit_cost_paise=450000, total_cost_paise=1350000),
        BOMItem(bom_id=boms[0].id, component_id=components[9].id, required_quantity=1, unit_cost_paise=650000, total_cost_paise=650000),
        BOMItem(bom_id=boms[1].id, component_id=components[0].id, required_quantity=10, unit_cost_paise=1210000, total_cost_paise=12100000),
        BOMItem(bom_id=boms[1].id, component_id=components[3].id, required_quantity=1, unit_cost_paise=4200000, total_cost_paise=4200000)
    ]
    db.add_all(bom_items)
    db.flush()

    allocations = [
        BOMAllocation(bom_item_id=bom_items[0].id, warehouse_id=warehouses[0].id, allocated_quantity=10, status="DISPATCHED", allocated_at=now - datetime.timedelta(days=14)),
        BOMAllocation(bom_item_id=bom_items[1].id, warehouse_id=warehouses[0].id, allocated_quantity=1, status="DISPATCHED", allocated_at=now - datetime.timedelta(days=14)),
        BOMAllocation(bom_item_id=bom_items[4].id, warehouse_id=warehouses[1].id, allocated_quantity=10, status="DISPATCHED", allocated_at=now - datetime.timedelta(days=12)),
        BOMAllocation(bom_item_id=bom_items[5].id, warehouse_id=warehouses[1].id, allocated_quantity=1, status="DISPATCHED", allocated_at=now - datetime.timedelta(days=12))
    ]
    db.add_all(allocations)
    db.flush()
    print(f"[15/31] BOMs, Items & Allocations created: {len(boms)} BOMs, {len(bom_items)} items, {len(allocations)} allocations")

    # -------------------------------------------------------------------------
    # 15. DISPATCHES (4 Site Fulfillment Deliveries)
    # -------------------------------------------------------------------------
    dispatches = [
        Dispatch(dispatch_number="DSP-2026-001", order_id=orders[0].id, warehouse_id=warehouses[0].id, source_warehouses="Central Pune Logistics Depot", vehicle_number="MH-12-RN-4819", driver_name="Sunil Jadhav", driver_phone="+91 98223 11223", dispatch_date=now - datetime.timedelta(days=14), estimated_delivery_date=now - datetime.timedelta(days=13), delivery_date=now - datetime.timedelta(days=13), status="DELIVERED", notes="Delivered cleanly at Clover Highlands rooftop."),
        Dispatch(dispatch_number="DSP-2026-002", order_id=orders[1].id, warehouse_id=warehouses[1].id, source_warehouses="Mumbai MMR Fulfillment Hub", vehicle_number="MH-04-AX-9921", driver_name="Ganesh Pawar", driver_phone="+91 98224 22334", dispatch_date=now - datetime.timedelta(days=12), estimated_delivery_date=now - datetime.timedelta(days=11), delivery_date=now - datetime.timedelta(days=11), status="DELIVERED", notes="Delivered at Vashi Sector 18 site."),
        Dispatch(dispatch_number="DSP-2026-003", order_id=orders[2].id, warehouse_id=warehouses[0].id, source_warehouses="Central Pune Logistics Depot", vehicle_number="MH-12-SP-3312", driver_name="Sunil Jadhav", driver_phone="+91 98223 11223", dispatch_date=now - datetime.timedelta(days=10), estimated_delivery_date=now - datetime.timedelta(days=9), delivery_date=now - datetime.timedelta(days=9), status="DELIVERED", notes="Delivered at Hinjewadi Blue Ridge site."),
        Dispatch(dispatch_number="DSP-2026-004", order_id=orders[3].id, warehouse_id=warehouses[0].id, source_warehouses="Central Pune Logistics Depot", vehicle_number="MH-15-TR-7788", driver_name="Sachin Shinde", driver_phone="+91 98225 33445", dispatch_date=now - datetime.timedelta(days=2), estimated_delivery_date=now - datetime.timedelta(days=1), status="IN_TRANSIT", notes="Consignment in transit to Nashik MIDC Ambad.")
    ]
    db.add_all(dispatches)
    db.flush()
    print(f"[16/31] Dispatches created: {len(dispatches)}")

    # -------------------------------------------------------------------------
    # 16. SERIALIZED ITEMS (Physical Barcoded Components Tracked to Site)
    # -------------------------------------------------------------------------
    serials = [
        SerializedItem(dispatch_id=dispatches[0].id, order_id=orders[0].id, component_id=components[0].id, serial_number="WAR-550-2026-88101", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[0].id, order_id=orders[0].id, component_id=components[0].id, serial_number="WAR-550-2026-88102", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[0].id, order_id=orders[0].id, component_id=components[3].id, serial_number="SNG-5K-2026-90412", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[1].id, order_id=orders[1].id, component_id=components[0].id, serial_number="WAR-550-2026-88201", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[1].id, order_id=orders[1].id, component_id=components[3].id, serial_number="SNG-5K-2026-90425", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[2].id, order_id=orders[2].id, component_id=components[0].id, serial_number="WAR-550-2026-88301", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[2].id, order_id=orders[2].id, component_id=components[5].id, serial_number="SOL-3K-2026-44109", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[3].id, order_id=orders[3].id, component_id=components[0].id, serial_number="WAR-550-2026-88401", barcode_format="CODE128", lifecycle_status="DISPATCHED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatches[3].id, order_id=orders[3].id, component_id=components[4].id, serial_number="GRW-10K-2026-11208", barcode_format="CODE128", lifecycle_status="DISPATCHED", verification_status="VERIFIED")
    ]
    db.add_all(serials)
    db.flush()
    print(f"[17/31] Serialized Items created: {len(serials)}")

    # -------------------------------------------------------------------------
    # 17. INSTALLATIONS (Field Commissioning & Worksheets)
    # -------------------------------------------------------------------------
    evidence_sample = json.dumps([
        {"category": "PANEL_INSTALLATION", "description": "10x Waaree 550W modules mounted with 18 deg tilt facing 180 deg south", "file_url": "/uploads/documents/rajesh_sharma_panel_array.jpg", "gps_lat": 18.4822, "gps_lng": 73.8967, "uploaded_at": "2026-10-20 11:30"},
        {"category": "INVERTER_INSTALLATION", "description": "Sungrow SG5.0RS dual MPPT inverter and ACDB/DCDB protection boxes", "file_url": "/uploads/documents/rajesh_sharma_inverter.jpg", "gps_lat": 18.4822, "gps_lng": 73.8967, "uploaded_at": "2026-10-20 14:15"},
        {"category": "EARTHING_GROUNDING", "description": "Dual chemical earthing pits tested with Megger tester (2.1 ohms)", "file_url": "/uploads/documents/rajesh_sharma_earthing.jpg", "gps_lat": 18.4822, "gps_lng": 73.8967, "uploaded_at": "2026-10-20 15:45"}
    ])

    installations = [
        Installation(
            installation_number="INST-2026-001", order_id=orders[0].id, assigned_technician="Ramesh Patil (Lead Certified Solar Engineer)", lead_engineer="Ramesh Patil", team_size=4,
            installation_address="Row House 14, Clover Highlands, NIBM Road, Pune", scheduled_start_date=now - datetime.timedelta(days=12), completion_date=now - datetime.timedelta(days=11), commissioning_date=now - datetime.timedelta(days=10), status="COMMISSIONED",
            chk_structure_installed=True, chk_panels_installed=True, chk_inverter_installed=True, chk_electrical_completed=True, chk_earthing_completed=True, chk_safety_checks_completed=True, chk_system_tested=True, chk_customer_handover_completed=True,
            voltage_reading_volts=232.4, current_reading_amps=21.5, power_output_kw=4.98, grid_frequency_hz=50.02, earthing_resistance_ohms=2.1, peak_power_tested_kw=5.12, grid_sync_successful=True,
            customer_signed_by_name="Rajesh Sharma", customer_signoff_date=now - datetime.timedelta(days=10), customer_feedback_rating=5, customer_remarks="Extremely neat wiring, clean installation, polite team.",
            commissioning_signed=True, team_notes="Megger tested at 2.1 ohms. Inverter synced with MSEDCL LT feeder within 120 seconds.", notes="Handover completed successfully.", evidence_files=evidence_sample
        ),
        Installation(
            installation_number="INST-2026-002", order_id=orders[1].id, assigned_technician="Ramesh Patil (Lead Certified Solar Engineer)", lead_engineer="Ramesh Patil", team_size=4,
            installation_address="Plot 42, Sector 18, Vashi, Navi Mumbai", scheduled_start_date=now - datetime.timedelta(days=10), completion_date=now - datetime.timedelta(days=9), commissioning_date=now - datetime.timedelta(days=8), status="COMMISSIONED",
            chk_structure_installed=True, chk_panels_installed=True, chk_inverter_installed=True, chk_electrical_completed=True, chk_earthing_completed=True, chk_safety_checks_completed=True, chk_system_tested=True, chk_customer_handover_completed=True,
            voltage_reading_volts=231.8, current_reading_amps=21.2, power_output_kw=4.92, grid_frequency_hz=49.98, earthing_resistance_ohms=1.9, peak_power_tested_kw=5.05, grid_sync_successful=True,
            customer_signed_by_name="Amit Patel", customer_signoff_date=now - datetime.timedelta(days=8), customer_feedback_rating=5, customer_remarks="Great quality structure and neat conduit piping.",
            commissioning_signed=True, team_notes="Vashi site grid sync verified. Bi-directional generation meter verified.", notes="Handover completed.", evidence_files=evidence_sample
        ),
        Installation(
            installation_number="INST-2026-003", order_id=orders[2].id, assigned_technician="Ramesh Patil (Lead Certified Solar Engineer)", lead_engineer="Ramesh Patil", team_size=3,
            installation_address="Flat 502, Blue Ridge Tower 8, Hinjewadi, Pune", scheduled_start_date=now - datetime.timedelta(days=8), completion_date=now - datetime.timedelta(days=7), commissioning_date=now - datetime.timedelta(days=6), status="COMMISSIONED",
            chk_structure_installed=True, chk_panels_installed=True, chk_inverter_installed=True, chk_electrical_completed=True, chk_earthing_completed=True, chk_safety_checks_completed=True, chk_system_tested=True, chk_customer_handover_completed=True,
            voltage_reading_volts=230.5, current_reading_amps=13.0, power_output_kw=2.99, grid_frequency_hz=50.01, earthing_resistance_ohms=2.2, peak_power_tested_kw=3.08, grid_sync_successful=True,
            customer_signed_by_name="Priya Kulkarni", customer_signoff_date=now - datetime.timedelta(days=6), customer_feedback_rating=5, customer_remarks="Punctual installation, clean terrace work.",
            commissioning_signed=True, team_notes="3kW Solis system commissioned with Wi-Fi cloud portal.", notes="Handover completed.", evidence_files=evidence_sample
        ),
        Installation(
            installation_number="INST-2026-004", order_id=orders[3].id, assigned_technician="Ramesh Patil (Lead Certified Solar Engineer)", lead_engineer="Ramesh Patil", team_size=5,
            installation_address="Plot D-14, MIDC Ambad, Nashik", scheduled_start_date=now + datetime.timedelta(days=1), status="SCHEDULED", notes="Scheduled for installation start upon site delivery confirmation."
        )
    ]
    db.add_all(installations)
    db.flush()

    for idx, s in enumerate(serials[:3]):
        s.installation_id = installations[0].id
    for idx, s in enumerate(serials[3:5]):
        s.installation_id = installations[1].id
    for idx, s in enumerate(serials[5:7]):
        s.installation_id = installations[2].id
    db.flush()
    print(f"[18/31] Installations created: {len(installations)}")

    # -------------------------------------------------------------------------
    # 18. DIGITAL SOLAR PASSPORTS (Stage A, B & C Complete Tokens)
    # -------------------------------------------------------------------------
    passports = [
        DigitalSolarPassport(
            passport_number="DSP-2026-0001", order_id=orders[0].id, customer_id=customers[0].id, installation_id=installations[0].id, warehouse_id=warehouses[0].id, dispatch_id=dispatches[0].id, warehouse_manager_id=users[4].id,
            qr_code_token="DSP_TOKEN_PUNE_RAJESH_SHARMA_0001", system_capacity_kw=5.0, grid_type="ON_GRID", commissioning_date=now - datetime.timedelta(days=10), dispatch_date=now - datetime.timedelta(days=14),
            pv_module_summary="10x Waaree 550W Bifacial Dual Glass Modules (Tier-1 ALMM)", inverter_summary="1x Sungrow 5kW Dual MPPT Single-Phase Inverter (IP65, WiFi)", battery_summary="Grid-tied (Zero battery storage)",
            estimated_lifetime_mwh=185.0, co2_offset_tonnes=151.7, system_health_score=99, is_active=True, lifecycle_status="ACTIVE", created_at=now - datetime.timedelta(days=14)
        ),
        DigitalSolarPassport(
            passport_number="DSP-2026-0002", order_id=orders[1].id, customer_id=customers[1].id, installation_id=installations[1].id, warehouse_id=warehouses[1].id, dispatch_id=dispatches[1].id, warehouse_manager_id=users[4].id,
            qr_code_token="DSP_TOKEN_MUMBAI_AMIT_PATEL_0002", system_capacity_kw=5.0, grid_type="ON_GRID", commissioning_date=now - datetime.timedelta(days=8), dispatch_date=now - datetime.timedelta(days=12),
            pv_module_summary="10x Waaree 550W Bifacial Modules", inverter_summary="1x Sungrow 5kW Inverter", battery_summary="Grid-tied",
            estimated_lifetime_mwh=183.7, co2_offset_tonnes=150.6, system_health_score=99, is_active=True, lifecycle_status="ACTIVE", created_at=now - datetime.timedelta(days=12)
        ),
        DigitalSolarPassport(
            passport_number="DSP-2026-0003", order_id=orders[2].id, customer_id=customers[2].id, installation_id=installations[2].id, warehouse_id=warehouses[0].id, dispatch_id=dispatches[2].id, warehouse_manager_id=users[4].id,
            qr_code_token="DSP_TOKEN_PUNE_PRIYA_KULKARNI_0003", system_capacity_kw=3.0, grid_type="ON_GRID", commissioning_date=now - datetime.timedelta(days=6), dispatch_date=now - datetime.timedelta(days=10),
            pv_module_summary="6x Waaree 550W Bifacial Modules", inverter_summary="1x Solis 3kW Inverter", battery_summary="Grid-tied",
            estimated_lifetime_mwh=111.2, co2_offset_tonnes=91.2, system_health_score=98, is_active=True, lifecycle_status="ACTIVE", created_at=now - datetime.timedelta(days=10)
        ),
        DigitalSolarPassport(
            passport_number="DSP-2026-0004", order_id=orders[3].id, customer_id=customers[3].id, warehouse_id=warehouses[0].id, dispatch_id=dispatches[3].id, warehouse_manager_id=users[4].id,
            qr_code_token="DSP_TOKEN_NASHIK_VIKRAM_JOSHI_0004", system_capacity_kw=10.0, grid_type="ON_GRID", dispatch_date=now - datetime.timedelta(days=2),
            pv_module_summary="18x Waaree 550W Bifacial Modules", inverter_summary="1x Growatt 10kW 3-Phase Inverter", battery_summary="Grid-tied",
            estimated_lifetime_mwh=370.0, co2_offset_tonnes=303.4, system_health_score=98, is_active=True, lifecycle_status="DISPATCHED", created_at=now - datetime.timedelta(days=2)
        )
    ]
    db.add_all(passports)
    db.flush()
    print(f"[19/31] Digital Solar Passports created: {len(passports)}")

    # -------------------------------------------------------------------------
    # 19. WARRANTY POLICIES & WARRANTIES
    # -------------------------------------------------------------------------
    policies = [
        WarrantyPolicy(code="POL-WAR-25Y", manufacturer="Waaree Energies Ltd", component_category="PANEL", model_name="WSM-550W-BF", duration_years=25, warranty_type="EQUIPMENT_PERFORMANCE", terms_summary="25-year linear performance: min 90% power at 10 years, 80% at 25 years.", is_active=True),
        WarrantyPolicy(code="POL-SNG-10Y", manufacturer="Sungrow Power Supply", component_category="INVERTER", model_name="SG5.0RS", duration_years=10, warranty_type="PRODUCT_REPLACEMENT", terms_summary="10-year standard product replacement warranty covering inverter motherboard, display, and Wi-Fi interface.", is_active=True),
        WarrantyPolicy(code="POL-EPC-05Y", manufacturer="SunPower Solutions EPC", component_category="SYSTEM", model_name="TURNKEY-EPC", duration_years=5, warranty_type="WORKMANSHIP_EPC", terms_summary="5-year comprehensive turnkey workmanship, water-proofing, and wind resistance warranty rated up to 150 km/h.", is_active=True),
        WarrantyPolicy(code="POL-LUM-07Y", manufacturer="Luminous Power", component_category="BATTERY", model_name="LUM-LI-48100", duration_years=7, warranty_type="EQUIPMENT_PERFORMANCE", terms_summary="7-year LiFePO4 battery warranty: 4,000 cycles at 80% Depth of Discharge.", is_active=True)
    ]
    db.add_all(policies)
    db.flush()

    warranties = [
        # Passport 1 (Rajesh Sharma)
        Warranty(passport_id=passports[0].id, component_id=components[0].id, serial_number="WAR-550-2026-88101", manufacturer="Waaree Energies Ltd", warranty_type="EQUIPMENT_PERFORMANCE", duration_years=25, start_date=now - datetime.timedelta(days=10), end_date=now + datetime.timedelta(days=25 * 365), terms_summary="25-Year Linear Performance Warranty (Waaree ALMM Certified)", status="ACTIVE"),
        Warranty(passport_id=passports[0].id, component_id=components[0].id, serial_number="WAR-550-2026-88102", manufacturer="Waaree Energies Ltd", warranty_type="EQUIPMENT_PERFORMANCE", duration_years=25, start_date=now - datetime.timedelta(days=10), end_date=now + datetime.timedelta(days=25 * 365), terms_summary="25-Year Linear Performance Warranty (Waaree ALMM Certified)", status="ACTIVE"),
        Warranty(passport_id=passports[0].id, component_id=components[3].id, serial_number="SNG-5K-2026-90412", manufacturer="Sungrow Power Supply", warranty_type="PRODUCT_REPLACEMENT", duration_years=10, start_date=now - datetime.timedelta(days=10), end_date=now + datetime.timedelta(days=10 * 365), terms_summary="10-Year Comprehensive Inverter & Cloud Telemetry Warranty", status="ACTIVE"),
        Warranty(passport_id=passports[0].id, component_id=None, serial_number="EPC-2026-0001", manufacturer="SunPower Solutions EPC", warranty_type="WORKMANSHIP_EPC", duration_years=5, start_date=now - datetime.timedelta(days=10), end_date=now + datetime.timedelta(days=5 * 365), terms_summary="5-Year Comprehensive Workmanship, Earthing & Structural Stability Guarantee", status="ACTIVE"),

        # Passport 2 (Amit Patel)
        Warranty(passport_id=passports[1].id, component_id=components[0].id, serial_number="WAR-550-2026-88201", manufacturer="Waaree Energies Ltd", warranty_type="EQUIPMENT_PERFORMANCE", duration_years=25, start_date=now - datetime.timedelta(days=8), end_date=now + datetime.timedelta(days=25 * 365), terms_summary="25-Year Linear Performance Warranty", status="ACTIVE"),
        Warranty(passport_id=passports[1].id, component_id=components[3].id, serial_number="SNG-5K-2026-90425", manufacturer="Sungrow Power Supply", warranty_type="PRODUCT_REPLACEMENT", duration_years=10, start_date=now - datetime.timedelta(days=8), end_date=now + datetime.timedelta(days=10 * 365), terms_summary="10-Year Inverter Replacement Warranty", status="ACTIVE"),
        Warranty(passport_id=passports[1].id, component_id=None, serial_number="EPC-2026-0002", manufacturer="SunPower Solutions EPC", warranty_type="WORKMANSHIP_EPC", duration_years=5, start_date=now - datetime.timedelta(days=8), end_date=now + datetime.timedelta(days=5 * 365), terms_summary="5-Year Turnkey EPC Guarantee", status="ACTIVE"),

        # Passport 3 (Priya Kulkarni)
        Warranty(passport_id=passports[2].id, component_id=components[0].id, serial_number="WAR-550-2026-88301", manufacturer="Waaree Energies Ltd", warranty_type="EQUIPMENT_PERFORMANCE", duration_years=25, start_date=now - datetime.timedelta(days=6), end_date=now + datetime.timedelta(days=25 * 365), terms_summary="25-Year Linear Performance Warranty", status="ACTIVE"),
        Warranty(passport_id=passports[2].id, component_id=components[5].id, serial_number="SOL-3K-2026-44109", manufacturer="Ginlong Solis", warranty_type="PRODUCT_REPLACEMENT", duration_years=10, start_date=now - datetime.timedelta(days=6), end_date=now + datetime.timedelta(days=10 * 365), terms_summary="10-Year Inverter Warranty", status="ACTIVE"),
        Warranty(passport_id=passports[2].id, component_id=None, serial_number="EPC-2026-0003", manufacturer="SunPower Solutions EPC", warranty_type="WORKMANSHIP_EPC", duration_years=5, start_date=now - datetime.timedelta(days=6), end_date=now + datetime.timedelta(days=5 * 365), terms_summary="5-Year Workmanship Warranty", status="ACTIVE")
    ]
    db.add_all(warranties)
    db.flush()
    print(f"[20/31] Warranty Policies & Active Warranties created: {len(policies)} policies, {len(warranties)} active warranties")

    # -------------------------------------------------------------------------
    # 20. SERVICE TICKETS (Real Customer Complaints & Maintenance)
    # -------------------------------------------------------------------------
    tickets = [
        ServiceTicket(
            ticket_number="SRV-2026-001", passport_id=passports[0].id, installation_id=installations[0].id, customer_id=customers[0].id, component_id=components[3].id, serial_number="SNG-5K-2026-90412",
            issue_category="INVERTER_FAULT", priority="HIGH", description="Sungrow cloud app not updating real-time generation telemetry since morning.",
            assigned_tech_id=users[5].id, assigned_technician="Ramesh Patil", is_warranty_covered=True,
            diagnosis_notes="Customer home Wi-Fi SSID password was updated. Inverter Wi-Fi dongle re-paired successfully.", parts_used="None", labour_hours=1.5, labour_cost_paise=0, repair_expenses_paise=0,
            customer_confirmation_notes="Customer verified generation graphs appearing on mobile app.", resolution_notes="Telemetry restored and verified on Sungrow iSolarCloud portal.", status="RESOLVED",
            complaint_source="CUSTOMER_PORTAL", created_at=now - datetime.timedelta(days=4), resolved_at=now - datetime.timedelta(days=3)
        ),
        ServiceTicket(
            ticket_number="SRV-2026-002", passport_id=passports[1].id, installation_id=installations[1].id, customer_id=customers[1].id,
            issue_category="MAINTENANCE", priority="LOW", description="Scheduled 6-month routine module cleaning and terminal torque check.",
            assigned_tech_id=users[5].id, assigned_technician="Ramesh Patil", is_warranty_covered=True,
            diagnosis_notes="Module dust accumulation removed with deionized water. String Voc verified at 498V.", parts_used="Cleaning sponges, microfiber wipers", labour_hours=2.0, labour_cost_paise=0, repair_expenses_paise=0,
            customer_confirmation_notes="Customer signed service completion slip.", resolution_notes="System operating at 100% nominal output.", status="RESOLVED",
            complaint_source="PREVENTIVE_MAINTENANCE", created_at=now - datetime.timedelta(days=2), resolved_at=now - datetime.timedelta(days=1)
        ),
        ServiceTicket(
            ticket_number="SRV-2026-003", passport_id=passports[2].id, installation_id=installations[2].id, customer_id=customers[2].id, component_id=components[5].id, serial_number="SOL-3K-2026-44109",
            issue_category="PERFORMANCE_ISSUE", priority="MEDIUM", description="Inverter displayed error code E032 during heavy thunderstorm.",
            assigned_tech_id=users[5].id, assigned_technician="Ramesh Patil", is_warranty_covered=True,
            diagnosis_notes="Grid overvoltage surge triggered internal MOV protector. Earthing verified at 2.2 ohms.",
            status="IN_PROGRESS", complaint_source="CUSTOMER_PORTAL", created_at=now - datetime.timedelta(hours=12)
        )
    ]
    db.add_all(tickets)
    db.flush()
    print(f"[21/31] Service Tickets created: {len(tickets)}")

    # -------------------------------------------------------------------------
    # 21. DOCUMENTS (Authentic PDF & Verification Artifacts)
    # -------------------------------------------------------------------------
    docs = [
        Document(title="8-Point Commissioning Checklist & Earthing Report", category="COMMISSIONING_REPORT", file_name="commissioning_cert_ins001.pdf", original_file_name="commissioning_cert_ins001.pdf", file_path="documents/commissioning_cert_ins001.pdf", file_url="/uploads/documents/commissioning_cert_ins001.pdf", file_size_bytes=52300, mime_type="application/pdf", entity_type="INSTALLATION", entity_id=installations[0].id, entity_identifier="INS-2026-001", uploaded_by_name="Ramesh Patil", notes="Megger earthing: 2.1 ohms. Inverter grid sync verified.", created_at=now - datetime.timedelta(days=10)),
        Document(title="Waaree 25-Year Bifacial Performance Warranty Certificate", category="WARRANTY_CERTIFICATE", file_name="waaree_warranty_cert.pdf", original_file_name="waaree_warranty_cert.pdf", file_path="documents/waaree_warranty_cert.pdf", file_url="/uploads/documents/waaree_warranty_cert.pdf", file_size_bytes=89100, mime_type="application/pdf", entity_type="WARRANTY", entity_id=warranties[0].id, entity_identifier="WAR-2026-001", uploaded_by_name="Waaree QA Division", notes="Official manufacturer warranty policy certificate.", created_at=now - datetime.timedelta(days=10)),
        Document(title="MSEDCL Sanctioned Load & Net Metering Feasibility Letter", category="ELECTRICITY_BILL", file_name="msedcl_sanction_letter_rajesh.pdf", original_file_name="msedcl_sanction_letter_rajesh.pdf", file_path="documents/msedcl_sanction_letter_rajesh.pdf", file_url="/uploads/documents/msedcl_sanction_letter_rajesh.pdf", file_size_bytes=64200, mime_type="application/pdf", entity_type="CUSTOMER", entity_id=customers[0].id, entity_identifier="CUST-101", uploaded_by_name="Rahul Deshmukh", notes="Discom approval for 5kW net metering grid synchronization.", created_at=now - datetime.timedelta(days=18)),
        Document(title="Single Line Diagram (SLD) & Protection Engineering Drawing", category="SYSTEM_SCHEMATIC", file_name="sld_5kw_residential_pune.pdf", original_file_name="sld_5kw_residential_pune.pdf", file_path="documents/sld_5kw_residential_pune.pdf", file_url="/uploads/documents/sld_5kw_residential_pune.pdf", file_size_bytes=114000, mime_type="application/pdf", entity_type="ORDER", entity_id=orders[0].id, entity_identifier="ORD-2026-0001", uploaded_by_name="Suresh Gaikwad", notes="Approved electrical layout drawing with DC/AC isolators and SPD ratings.", created_at=now - datetime.timedelta(days=15)),
        Document(title="PM Surya Ghar Muft Bijli Yojana Subsidy Acknowledgment", category="SUBSIDY_APPLICATION", file_name="pm_surya_ghar_ack_amit_patel.pdf", original_file_name="pm_surya_ghar_ack_amit_patel.pdf", file_path="documents/pm_surya_ghar_ack_amit_patel.pdf", file_url="/uploads/documents/pm_surya_ghar_ack_amit_patel.pdf", file_size_bytes=48500, mime_type="application/pdf", entity_type="CUSTOMER", entity_id=customers[1].id, entity_identifier="CUST-102", uploaded_by_name="Rahul Deshmukh", notes="National Portal acknowledgment receipt with Rs. 78,000 subsidy claim.", created_at=now - datetime.timedelta(days=12))
    ]
    db.add_all(docs)
    db.flush()
    print(f"[22/31] Documents created: {len(docs)}")

    # -------------------------------------------------------------------------
    # 22. AUDIT LOGS (Immutable Chronological Action Trail)
    # -------------------------------------------------------------------------
    audits = [
        AuditLog(timestamp=now - datetime.timedelta(days=30), user_id=users[1].id, user_name="Rahul Deshmukh", user_role="SALES_EXECUTIVE", action="CREATE", entity_type="ENQUIRY", entity_id=enquiries[0].id, entity_identifier="ENQ-2026-001", new_values='{"status": "NEW", "system_size_kw": 5.0}', details="Inbound lead registered for Rajesh Sharma via website solar calculator."),
        AuditLog(timestamp=now - datetime.timedelta(days=22), user_id=users[2].id, user_name="Suresh Gaikwad", user_role="SURVEY_MANAGER", action="APPROVE", entity_type="SURVEY", entity_id=surveys[0].id, entity_identifier="SRV-2026-001", old_values='{"status": "SUBMITTED"}', new_values='{"status": "APPROVED"}', details="Survey report verified. Roof area: 480 sqft, 0 shading."),
        AuditLog(timestamp=now - datetime.timedelta(days=18), user_id=users[1].id, user_name="Rahul Deshmukh", user_role="SALES_EXECUTIVE", action="STATUS_CHANGE", entity_type="QUOTATION", entity_id=quotations[0].id, entity_identifier="QT-2026-001", old_values='{"status": "SENT"}', new_values='{"status": "ACCEPTED"}', details="Customer accepted quotation QT-2026-001 and signed agreement."),
        AuditLog(timestamp=now - datetime.timedelta(days=15), user_id=users[0].id, user_name="Aditya Kulkarni", user_role="ADMIN", action="CREATE", entity_type="ORDER", entity_id=orders[0].id, entity_identifier="ORD-2026-0001", new_values='{"stage": "CONFIRMED"}', details="Order confirmed upon receipt of 20% advance milestone Rs. 64,866."),
        AuditLog(timestamp=now - datetime.timedelta(days=14), user_id=users[4].id, user_name="Kishore More", user_role="WAREHOUSE_MANAGER", action="DISPATCH", entity_type="DISPATCH", entity_id=dispatches[0].id, entity_identifier="DSP-2026-001", details="Dispatched 10x Waaree 550W panels and 1x Sungrow 5kW inverter via MH-12-RN-4819."),
        AuditLog(timestamp=now - datetime.timedelta(days=10), user_id=users[5].id, user_name="Ramesh Patil", user_role="INSTALLATION_TECHNICIAN", action="COMMISSION", entity_type="INSTALLATION", entity_id=installations[0].id, entity_identifier="INST-2026-001", old_values='{"status": "IN_PROGRESS"}', new_values='{"status": "COMMISSIONED"}', details="8-point checklist verified. Earthing resistance 2.1 ohms. Digital Solar Passport DSP-2026-0001 activated.")
    ]
    db.add_all(audits)
    db.flush()
    print(f"[23/31] Audit Logs recorded: {len(audits)}")

    # -------------------------------------------------------------------------
    # 23. SUBSIDY APPLICATIONS (PM Surya Ghar Central Scheme)
    # -------------------------------------------------------------------------
    subsidies = [
        SubsidyApplication(
            application_number="PMSG-MH-2026-0091", order_id=orders[0].id, customer_id=customers[0].id, installation_id=installations[0].id,
            discom_name="MSEDCL (Maharashtra State Electricity Distribution Co)", consumer_number="012345678901", system_capacity_kw=5.0,
            subsidy_scheme="PM Surya Ghar: Muft Bijli Yojana (Central Financial Assistance)", eligible_subsidy_paise=7800000, disbursed_subsidy_paise=7800000, status="DISBURSED",
            document_checklist=json.dumps({"electricity_bill": True, "aadhaar": True, "cancelled_cheque": True, "commissioning_report": True, "meter_inspection": True}),
            application_date=now - datetime.timedelta(days=16), inspection_date=now - datetime.timedelta(days=8), approval_date=now - datetime.timedelta(days=5), disbursement_date=now - datetime.timedelta(days=2),
            disbursement_reference="DBT-PMSG-884920194-SBI", reviewer_notes="Physical verification complete. Subsidy credited via Direct Benefit Transfer."
        ),
        SubsidyApplication(
            application_number="PMSG-MH-2026-0092", order_id=orders[1].id, customer_id=customers[1].id, installation_id=installations[1].id,
            discom_name="MSEDCL (Maharashtra State Electricity Distribution Co)", consumer_number="012345678902", system_capacity_kw=5.0,
            subsidy_scheme="PM Surya Ghar: Muft Bijli Yojana (Central Financial Assistance)", eligible_subsidy_paise=7800000, disbursed_subsidy_paise=0, status="APPROVED",
            document_checklist=json.dumps({"electricity_bill": True, "aadhaar": True, "cancelled_cheque": True, "commissioning_report": True, "meter_inspection": True}),
            application_date=now - datetime.timedelta(days=14), inspection_date=now - datetime.timedelta(days=6), approval_date=now - datetime.timedelta(days=3),
            reviewer_notes="Net meter inspection verified. Pending DBT treasury disbursement queue."
        ),
        SubsidyApplication(
            application_number="PMSG-MH-2026-0093", order_id=orders[2].id, customer_id=customers[2].id, installation_id=installations[2].id,
            discom_name="MSEDCL (Maharashtra State Electricity Distribution Co)", consumer_number="012345678903", system_capacity_kw=3.0,
            subsidy_scheme="PM Surya Ghar: Muft Bijli Yojana (Central Financial Assistance)", eligible_subsidy_paise=7800000, disbursed_subsidy_paise=0, status="UNDER_INSPECTION",
            document_checklist=json.dumps({"electricity_bill": True, "aadhaar": True, "cancelled_cheque": True, "commissioning_report": True, "meter_inspection": False}),
            application_date=now - datetime.timedelta(days=10),
            reviewer_notes="MSEDCL junior engineer site inspection scheduled for coming Tuesday."
        )
    ]
    db.add_all(subsidies)
    db.flush()
    print(f"[24/31] Subsidy Applications created: {len(subsidies)}")

    # -------------------------------------------------------------------------
    # 24. NOTIFICATIONS (System Alerts)
    # -------------------------------------------------------------------------
    notifications = [
        Notification(user_id=users[4].id, target_role="WAREHOUSE_MANAGER", category="LOW_STOCK", title="Stock Threshold Notice: Sungrow 5kW Inverters", message="Central Pune Depot has 40 units remaining. Reorder suggested within 14 days.", link_url="/inventory", related_entity_type="COMPONENT", related_entity_id=components[3].id, is_read=False, created_at=now - datetime.timedelta(hours=6)),
        Notification(user_id=users[5].id, target_role="INSTALLATION_TECHNICIAN", category="INSTALLATION", title="Upcoming Installation Scheduled: Nashik MIDC", message="Installation INST-2026-004 scheduled for Vikram Joshi Residence (10 kW Commercial).", link_url="/installations", related_entity_type="INSTALLATION", related_entity_id=installations[3].id, is_read=False, created_at=now - datetime.timedelta(hours=10)),
        Notification(user_id=users[6].id, target_role="SERVICE_MANAGER", category="SERVICE", title="Customer Fault Reported: Hinjewadi Site", message="Ticket SRV-2026-003: Solis 3kW Inverter surge error code E032 logged.", link_url="/service", related_entity_type="SERVICE_TICKET", related_entity_id=tickets[2].id, is_read=False, created_at=now - datetime.timedelta(hours=12)),
        Notification(user_id=users[1].id, target_role="SALES_EXECUTIVE", category="LEAD", title="New Commercial Inbound Enquiry", message="ENQ-2026-012: 10 kW CNC workshop enquiry received from Rohit Bhosale (Bhosari MIDC).", link_url="/enquiries", related_entity_type="ENQUIRY", related_entity_id=enquiries[11].id, is_read=True, created_at=now - datetime.timedelta(days=1))
    ]
    db.add_all(notifications)
    db.flush()
    print(f"[25/31] Notifications created: {len(notifications)}")

    # -------------------------------------------------------------------------
    # 25. PAYMENTS (Milestone Receipts)
    # -------------------------------------------------------------------------
    payments = [
        # Order 1 (Rajesh Sharma) - 100% Paid (Milestone 1, 2, 3)
        Payment(payment_number="PAY-2026-001", order_id=orders[0].id, amount_paise=6486600, milestone="ADVANCE_BOOKING_20", payment_mode="NEFT", transaction_reference="HDFCN2601984210", paid_at=now - datetime.timedelta(days=15), status="VERIFIED"),
        Payment(payment_number="PAY-2026-002", order_id=orders[0].id, amount_paise=19459800, milestone="DISPATCH_MATERIAL_60", payment_mode="RTGS", transaction_reference="HDFCR2602148911", paid_at=now - datetime.timedelta(days=14), status="VERIFIED"),
        Payment(payment_number="PAY-2026-003", order_id=orders[0].id, amount_paise=6486600, milestone="COMMISSIONING_BALANCE_20", payment_mode="UPI", transaction_reference="UPI/6102941829/HDFC", paid_at=now - datetime.timedelta(days=10), status="VERIFIED"),

        # Order 2 (Amit Patel) - 100% Paid
        Payment(payment_number="PAY-2026-004", order_id=orders[1].id, amount_paise=6486600, milestone="ADVANCE_BOOKING_20", payment_mode="NEFT", transaction_reference="ICICN2603810293", paid_at=now - datetime.timedelta(days=13), status="VERIFIED"),
        Payment(payment_number="PAY-2026-005", order_id=orders[1].id, amount_paise=25946400, milestone="DISPATCH_AND_FINAL_80", payment_mode="RTGS", transaction_reference="ICICR2604921044", paid_at=now - datetime.timedelta(days=8), status="VERIFIED"),

        # Order 3 (Priya Kulkarni) - 100% Paid
        Payment(payment_number="PAY-2026-006", order_id=orders[2].id, amount_paise=22191000, milestone="FULL_PAYMENT_100", payment_mode="NET_BANKING", transaction_reference="SBIN2605819203", paid_at=now - datetime.timedelta(days=11), status="VERIFIED"),

        # Order 4 (Vikram Joshi) - Advance + Part Dispatch
        Payment(payment_number="PAY-2026-007", order_id=orders[3].id, amount_paise=11835200, milestone="ADVANCE_BOOKING_20", payment_mode="RTGS", transaction_reference="KKBKR2606829104", paid_at=now - datetime.timedelta(days=9), status="VERIFIED"),
        Payment(payment_number="PAY-2026-008", order_id=orders[3].id, amount_paise=28164800, milestone="DISPATCH_MATERIAL_PART", payment_mode="RTGS", transaction_reference="KKBKR2607192049", paid_at=now - datetime.timedelta(days=2), status="VERIFIED")
    ]
    db.add_all(payments)
    db.flush()
    print(f"[26/31] Payments created: {len(payments)}")

    # -------------------------------------------------------------------------
    # 26. PROJECT EXPENSES (Profitability & Operational Cost Ledger)
    # -------------------------------------------------------------------------
    expenses = [
        ProjectExpense(order_id=orders[0].id, category="STRUCTURE_FABRICATION", amount_paise=2800000, description="On-site structural welding and elevated HDG pillar fabrication labour.", recorded_at=now - datetime.timedelta(days=12)),
        ProjectExpense(order_id=orders[0].id, category="ELECTRICAL_LIAISONING", amount_paise=1200000, description="MSEDCL net-metering test bench inspection and CEA compliance paperwork fee.", recorded_at=now - datetime.timedelta(days=10)),
        ProjectExpense(order_id=orders[0].id, category="LOGISTICS_FREIGHT", amount_paise=650000, description="Dedicated Tata 407 transport from Chakan depot to Clover Highlands.", recorded_at=now - datetime.timedelta(days=14)),
        ProjectExpense(order_id=orders[1].id, category="STRUCTURE_FABRICATION", amount_paise=2900000, description="Bhiwandi roof anchor bolts and elevated railing installation.", recorded_at=now - datetime.timedelta(days=10)),
        ProjectExpense(order_id=orders[1].id, category="CRANE_RENTAL", amount_paise=1500000, description="Hydraulic crane rental for hoisting 10x 550W panels to 4th floor terrace.", recorded_at=now - datetime.timedelta(days=11)),
        ProjectExpense(order_id=orders[2].id, category="ELECTRICAL_LIAISONING", amount_paise=1000000, description="Discom junior engineer inspection fee and meter testing charges.", recorded_at=now - datetime.timedelta(days=7))
    ]
    db.add_all(expenses)
    db.flush()
    print(f"[27/31] Project Expenses created: {len(expenses)}")

    # Commit all 31 tables
    db.commit()
    db.close()

    print("=" * 80)
    print("SUCCESS: ALL 31 DATABASE TABLES PERMANENTLY POPULATED WITH REALISTIC DATA!")
    print("=" * 80)


if __name__ == "__main__":
    populate_all_tables()
