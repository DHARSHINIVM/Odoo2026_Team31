import datetime
import uuid
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.models import (
    Customer, Enquiry, SiteSurvey, Component, Package, PackageItem,
    Quotation, QuotationItem, Order, Warehouse, WarehouseStock,
    BillOfMaterials, BOMItem, BOMAllocation, Dispatch, SerializedItem,
    Installation, DigitalSolarPassport, Warranty, ServiceTicket,
    Payment, ProjectExpense, User, WarrantyPolicy, SubsidyApplication, Notification,
    Document, AuditLog, InventoryTransfer, StockMovement, UserSession
)


def seed_database(db: Session):
    # Recreate all tables cleanly on seed reset to guarantee schema alignment
    Base.metadata.drop_all(bind=db.get_bind())
    Base.metadata.create_all(bind=db.get_bind())

    # -------------------------------------------------------------
    # 0. USERS (5 Documented Roles for RBAC: Admin, Sales, Technician, Warehouse, Customer)
    # -------------------------------------------------------------
    u_admin = User(
        username="admin", email="admin@sunpower.com",
        full_name="Vikram Malhotra", phone="+91 98200 11001",
        role="ADMIN", department="Executive", designation="General Manager"
    )
    u_admin.set_password("Password@123")

    u_sales = User(
        username="sales", email="sales@sunpower.com",
        full_name="Rahul Deshmukh", phone="+91 98200 22002",
        role="SALES_EXECUTIVE", department="Sales", designation="Senior Sales Representative"
    )
    u_sales.set_password("Password@123")

    u_technician = User(
        username="technician", email="technician@sunpower.com",
        full_name="Deepak Chavan", phone="+91 98200 44004",
        role="TECHNICIAN", department="Engineering", designation="Lead Solar Field Technician"
    )
    u_technician.set_password("Password@123")

    u_warehouse = User(
        username="warehouse", email="warehouse@sunpower.com",
        full_name="Manoj Gokhale", phone="+91 98200 55005",
        role="WAREHOUSE_MANAGER", department="Logistics", designation="Warehouse Operations Head"
    )
    u_warehouse.set_password("Password@123")

    u_customer = User(
        username="customer", email="customer@sunpower.com",
        full_name="Rajesh Sharma", phone="+91 98230 11223",
        role="CUSTOMER", department="Customer", designation="Solar Rooftop Owner"
    )
    u_customer.set_password("Password@123")

    db.add_all([u_admin, u_sales, u_technician, u_warehouse, u_customer])
    db.flush()

    # -------------------------------------------------------------
    # 1. CUSTOMERS (12 across Residential, Commercial, Agricultural)
    # -------------------------------------------------------------
    c1 = Customer(
        name="Rajesh Sharma",
        phone="+91 98230 11223",
        email="rajesh.sharma@gmail.com",
        address="Flat 402, Sunshine Heights, Baner Road",
        city="Pune",
        state="Maharashtra",
        pincode="411045",
        consumer_number="MSEDCL-PUN-849201",
        avg_monthly_bill_paise=480000,  # Rs. 4,800
        sanctioned_load_kw=6.0
    )
    c2 = Customer(
        name="Amit Patel",
        phone="+91 98980 44556",
        email="amit.patel@pateltextiles.in",
        address="Plot 18, GIDC Industrial Estate, Vatva",
        city="Ahmedabad",
        state="Gujarat",
        pincode="382445",
        consumer_number="UGVCL-AHM-992144",
        avg_monthly_bill_paise=3500000,  # Rs. 35,000
        sanctioned_load_kw=30.0
    )
    c3 = Customer(
        name="Priya Kulkarni",
        phone="+91 97654 33210",
        email="priya.kulkarni@outlook.com",
        address="Bungalow 7, Gulmohar Park, Aundh",
        city="Pune",
        state="Maharashtra",
        pincode="411007",
        consumer_number="MSEDCL-PUN-104928",
        avg_monthly_bill_paise=320000,  # Rs. 3,200
        sanctioned_load_kw=4.0
    )
    c4 = Customer(
        name="Sunita Deshmukh",
        phone="+91 94222 78901",
        email="sunita.agro@gmail.com",
        address="Farm Sector 4, Dindori Road",
        city="Nashik",
        state="Maharashtra",
        pincode="422004",
        consumer_number="MSEDCL-NSK-554219",
        avg_monthly_bill_paise=950000,  # Rs. 9,500
        sanctioned_load_kw=10.0
    )
    c5 = Customer(
        name="Vikramaditya Singhania",
        phone="+91 98200 99881",
        email="v.singhania@singhaniapolymer.com",
        address="Plot C-12, TTC Industrial Area, Pawane",
        city="Navi Mumbai",
        state="Maharashtra",
        pincode="400705",
        consumer_number="MSEDCL-MUM-449120",
        avg_monthly_bill_paise=8500000,  # Rs. 85,000
        sanctioned_load_kw=50.0
    )
    c6 = Customer(
        name="Anand Joshi",
        phone="+91 98221 44552",
        email="anand.joshi.pune@gmail.com",
        address="Row House 14, Mayur Colony, Kothrud",
        city="Pune",
        state="Maharashtra",
        pincode="411038",
        consumer_number="MSEDCL-PUN-772910",
        avg_monthly_bill_paise=420000,  # Rs. 4,200
        sanctioned_load_kw=5.0
    )
    c7 = Customer(
        name="Rameshwar Patil",
        phone="+91 94231 66778",
        email="rameshwar.patil@sugarcoop.org",
        address="Gat No. 112, Shirol Taluka",
        city="Kolhapur",
        state="Maharashtra",
        pincode="416103",
        consumer_number="MSEDCL-KLP-881920",
        avg_monthly_bill_paise=1100000,  # Rs. 11,000
        sanctioned_load_kw=12.0
    )
    c8 = Customer(
        name="Meera Nair",
        phone="+91 98205 33441",
        email="meera.nair@nairassociates.com",
        address="Penthouse B-16, Sea View Towers, Bandra West",
        city="Mumbai",
        state="Maharashtra",
        pincode="400050",
        consumer_number="ADANI-MUM-339182",
        avg_monthly_bill_paise=510000,  # Rs. 5,100
        sanctioned_load_kw=6.0
    )
    c9 = Customer(
        name="Arvind Kejriwal Textiles Ltd",
        phone="+91 98251 77663",
        email="factory@aktextiles.co.in",
        address="Ring Road Textile Hub, GIDC Pandesara",
        city="Surat",
        state="Gujarat",
        pincode="394221",
        consumer_number="DGVCL-SUR-990214",
        avg_monthly_bill_paise=6200000,  # Rs. 62,000
        sanctioned_load_kw=40.0
    )
    c10 = Customer(
        name="Deepak Chordia",
        phone="+91 98810 55449",
        email="deepak.chordia@chordiafoods.com",
        address="Bungalow 22, Salisbury Park",
        city="Pune",
        state="Maharashtra",
        pincode="411037",
        consumer_number="MSEDCL-PUN-664210",
        avg_monthly_bill_paise=780000,  # Rs. 7,800
        sanctioned_load_kw=8.0
    )
    c11 = Customer(
        name="Balaji Cold Storage",
        phone="+91 94220 88991",
        email="procurement@balajicoldstorage.in",
        address="MIDC Industrial Area, Phase II",
        city="Baramati",
        state="Maharashtra",
        pincode="413133",
        consumer_number="MSEDCL-BRM-440192",
        avg_monthly_bill_paise=12000000,  # Rs. 1,20,000
        sanctioned_load_kw=60.0
    )
    c12 = Customer(
        name="Sneha Kulkarni",
        phone="+91 98199 22334",
        email="sneha.kulkarni@techcorp.com",
        address="Flat 801, Rutu Enclave, Ghodbunder Road",
        city="Thane",
        state="Maharashtra",
        pincode="400615",
        consumer_number="MSEDCL-THN-119482",
        avg_monthly_bill_paise=390000,  # Rs. 3,900
        sanctioned_load_kw=4.0
    )
    db.add_all([c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12])
    db.flush()
    u_customer.customer_id = c1.id
    db.flush()

    # -------------------------------------------------------------
    # 2. COMPONENTS CATALOG (Tier 1, Tier 2, Tier 3 spectrum)
    # -------------------------------------------------------------
    cmp_panel_waaree = Component(
        sku="CMP-PANEL-WRE550",
        name="Waaree Bi-550 Bifacial Dual Glass",
        category="PANEL",
        manufacturer="Waaree Energies",
        model_number="WSM-550W-BF",
        rated_power_w=550.0,
        unit_cost_paise=990000,   # Rs. 9,900
        unit_price_paise=1250000, # Rs. 12,500
        warranty_years=25,
        tier_grade="TIER_1",
        failure_rate_pct=0.28,
        credibility_score=96,
        certification_status="BIS / IEC 61215 / IEC 61730 Verified",
        documentation_status="Verified"
    )
    cmp_panel_tata = Component(
        sku="CMP-PANEL-TAT540",
        name="Tata Power Solar Mono PERC 540W",
        category="PANEL",
        manufacturer="Tata Power Solar",
        model_number="TPS-540-PERC",
        rated_power_w=540.0,
        unit_cost_paise=980000,
        unit_price_paise=1220000,
        warranty_years=25,
        tier_grade="TIER_1",
        failure_rate_pct=0.31,
        credibility_score=95,
        certification_status="BIS / ALMM Listed / IEC 61215",
        documentation_status="Verified"
    )
    cmp_panel_vikram = Component(
        sku="CMP-PANEL-VKR540",
        name="Vikram Solar Somera Grand 540W",
        category="PANEL",
        manufacturer="Vikram Solar",
        model_number="VKS-540-MB",
        rated_power_w=540.0,
        unit_cost_paise=920000,
        unit_price_paise=1150000,
        warranty_years=25,
        tier_grade="TIER_2",
        failure_rate_pct=0.85,
        credibility_score=78,
        certification_status="BIS / ALMM Certified",
        documentation_status="Partial"
    )
    cmp_inv_sungrow = Component(
        sku="CMP-INV-SG5K",
        name="Sungrow SG5.0RS Residential Inverter 5kW",
        category="INVERTER",
        manufacturer="Sungrow",
        model_number="SG5.0RS-1P",
        rated_power_w=5000.0,
        unit_cost_paise=3800000,  # Rs. 38,000
        unit_price_paise=4800000,  # Rs. 48,000
        warranty_years=10,
        tier_grade="TIER_1",
        failure_rate_pct=0.45,
        credibility_score=94,
        certification_status="IEC 62109-1/2, CE, VDE",
        documentation_status="Verified"
    )
    cmp_inv_growatt = Component(
        sku="CMP-INV-GW10K",
        name="Growatt MOD 10KTL3-X 10kW 3-Phase Inverter",
        category="INVERTER",
        manufacturer="Growatt",
        model_number="MOD-10KTL3-X",
        rated_power_w=10000.0,
        unit_cost_paise=6200000,  # Rs. 62,000
        unit_price_paise=7800000,  # Rs. 78,000
        warranty_years=10,
        tier_grade="TIER_1",
        failure_rate_pct=0.55,
        credibility_score=91,
        certification_status="IEC 62109, VDE-AR-N 4105",
        documentation_status="Verified"
    )
    cmp_inv_luminous = Component(
        sku="CMP-INV-LUM3K",
        name="Luminous Solar NXG Pro 3kVA Hybrid Inverter",
        category="INVERTER",
        manufacturer="Luminous Power",
        model_number="NXG-PRO-3000",
        rated_power_w=3000.0,
        unit_cost_paise=2600000,
        unit_price_paise=3300000,
        warranty_years=5,
        tier_grade="TIER_2",
        failure_rate_pct=1.20,
        credibility_score=72,
        certification_status="IS 16221 Tested",
        documentation_status="Partial"
    )
    cmp_struct_hdg = Component(
        sku="CMP-STR-HDG-MNT",
        name="Hot Dip Galvanized Rooftop Structure Kit (4-Panel)",
        category="STRUCTURE",
        manufacturer="Strolar Structures",
        model_number="STR-HDG-80U",
        rated_power_w=0.0,
        unit_cost_paise=350000,   # Rs. 3,500
        unit_price_paise=520000,   # Rs. 5,200
        warranty_years=15,
        tier_grade="TIER_1",
        failure_rate_pct=0.10,
        credibility_score=98,
        certification_status="IS 2062 / IS 4759 Galvanization",
        documentation_status="Verified"
    )
    cmp_bos_cable = Component(
        sku="CMP-BOS-CBL4MM",
        name="Polycab 4 sq mm DC Solar Cable (100m Roll)",
        category="CABLE",
        manufacturer="Polycab India",
        model_number="PLC-DC-4MM-RED",
        rated_power_w=0.0,
        unit_cost_paise=420000,   # Rs. 4,200
        unit_price_paise=590000,   # Rs. 5,900
        warranty_years=5,
        tier_grade="TIER_1",
        failure_rate_pct=0.15,
        credibility_score=97,
        certification_status="TUV / EN 50618 Certified",
        documentation_status="Verified"
    )
    cmp_cable_generic = Component(
        sku="CMP-CBL-GEN4MM",
        name="Budget Copper Solar DC Wire (100m Roll)",
        category="CABLE",
        manufacturer="Generic Local Cables",
        model_number="GEN-4MM-SOLAR",
        rated_power_w=0.0,
        unit_cost_paise=210000,
        unit_price_paise=320000,
        warranty_years=1,
        tier_grade="TIER_3",
        failure_rate_pct=4.20,
        credibility_score=48,  # High Risk (< 50)
        certification_status="Uncertified / Non-standard",
        documentation_status="Missing"
    )
    cmp_acc_clamps = Component(
        sku="CMP-ACC-CLM-ECO",
        name="EcoClamp End & Mid Aluminium Clamps (Pack of 50)",
        category="STRUCTURE",
        manufacturer="Local Fab Industries",
        model_number="CLM-ECO-50",
        rated_power_w=0.0,
        unit_cost_paise=65000,
        unit_price_paise=110000,
        warranty_years=2,
        tier_grade="TIER_3",
        failure_rate_pct=1.50,
        credibility_score=62,  # Low (50 - 69)
        certification_status="Internal Mill Certificate",
        documentation_status="Partial"
    )
    cmp_meter_net = Component(
        sku="CMP-MTR-SEC3P",
        name="Secure Premier 300 3-Phase Bidirectional Net Meter",
        category="METER",
        manufacturer="Secure Meters",
        model_number="PRM-300-3P",
        rated_power_w=0.0,
        unit_cost_paise=750000,   # Rs. 7,500
        unit_price_paise=1100000,  # Rs. 11,000
        warranty_years=5,
        tier_grade="TIER_1",
        failure_rate_pct=0.40,
        credibility_score=93,
        certification_status="BIS / CEA Approved",
        documentation_status="Verified"
    )
    cmp_bat_luminous = Component(
        sku="CMP-BAT-LUM48V",
        name="Luminous Li-ON 48V 100Ah Lithium Storage Battery",
        category="BATTERY",
        manufacturer="Luminous Power",
        model_number="LUM-LI-48100",
        rated_power_w=4800.0,
        unit_cost_paise=7200000,  # Rs. 72,000
        unit_price_paise=8900000,  # Rs. 89,000
        warranty_years=7,
        tier_grade="TIER_1",
        failure_rate_pct=0.35,
        credibility_score=95,
        certification_status="IEC 62619 / UN38.3",
        documentation_status="Verified"
    )
    cmp_spd_phoenix = Component(
        sku="CMP-PRT-PHX2P",
        name="Phoenix Contact AC/DC Distribution Box with Type 2 SPD",
        category="PROTECTION",
        manufacturer="Phoenix Contact",
        model_number="PHX-SPD-T2-1000V",
        rated_power_w=0.0,
        unit_cost_paise=320000,   # Rs. 3,200
        unit_price_paise=480000,   # Rs. 4,800
        warranty_years=5,
        tier_grade="TIER_1",
        failure_rate_pct=0.20,
        credibility_score=97,
        certification_status="IEC 61643-11",
        documentation_status="Verified"
    )
    cmp_acc_earthing = Component(
        sku="CMP-ACC-EARTH",
        name="Marconite Chemical Earthing Kit with 2m Copper Bonded Electrode",
        category="ACCESSORIES",
        manufacturer="Marconite India",
        model_number="MRC-EARTH-KIT",
        rated_power_w=0.0,
        unit_cost_paise=240000,   # Rs. 2,400
        unit_price_paise=360000,   # Rs. 3,600
        warranty_years=10,
        tier_grade="TIER_1",
        failure_rate_pct=0.05,
        credibility_score=99,
        certification_status="CPRI Tested & Approved",
        documentation_status="Verified"
    )
    db.add_all([
        cmp_panel_waaree, cmp_panel_tata, cmp_panel_vikram,
        cmp_inv_sungrow, cmp_inv_growatt, cmp_inv_luminous,
        cmp_struct_hdg, cmp_bos_cable, cmp_cable_generic, cmp_acc_clamps,
        cmp_meter_net, cmp_bat_luminous, cmp_spd_phoenix, cmp_acc_earthing
    ])
    db.flush()

    # -------------------------------------------------------------
    # 3. WAREHOUSES & MULTI-WAREHOUSE STOCK
    # -------------------------------------------------------------
    wh_pune = Warehouse(
        code="WH-PUN-01",
        name="Pune Central Logistics & Fulfillment",
        city="Pune",
        state="Maharashtra",
        pincode="411026",
        manager_name="Vikas Ranade",
        contact_phone="+91 98220 55443",
        is_primary=True
    )
    wh_mumbai = Warehouse(
        code="WH-MUM-02",
        name="Bhiwandi Western Gateway Hub",
        city="Mumbai",
        state="Maharashtra",
        pincode="421302",
        manager_name="Kishore Salve",
        contact_phone="+91 98670 99887",
        is_primary=False
    )
    wh_nashik = Warehouse(
        code="WH-NSK-03",
        name="Nashik Regional Depot",
        city="Nashik",
        state="Maharashtra",
        pincode="422010",
        manager_name="Sachin Jadhav",
        contact_phone="+91 94230 44332",
        is_primary=False
    )
    db.add_all([wh_pune, wh_mumbai, wh_nashik])
    db.flush()

    # Stocks across warehouses (Note: low stock triggered in Pune Central for Waaree & Tata panels)
    stocks = [
        # Pune Central (Hub) - Low stock alerts on panels
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_panel_waaree.id, qty_on_hand=12, qty_reserved=2, min_threshold=15),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_panel_tata.id, qty_on_hand=8, qty_reserved=0, min_threshold=15),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_inv_sungrow.id, qty_on_hand=8, qty_reserved=1, min_threshold=5),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_struct_hdg.id, qty_on_hand=15, qty_reserved=3, min_threshold=10),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_bos_cable.id, qty_on_hand=20, qty_reserved=2, min_threshold=10),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_meter_net.id, qty_on_hand=10, qty_reserved=1, min_threshold=5),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_bat_luminous.id, qty_on_hand=5, qty_reserved=0, min_threshold=3),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_spd_phoenix.id, qty_on_hand=15, qty_reserved=1, min_threshold=5),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_acc_earthing.id, qty_on_hand=12, qty_reserved=0, min_threshold=5),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_acc_clamps.id, qty_on_hand=40, qty_reserved=0, min_threshold=20),
        WarehouseStock(warehouse_id=wh_pune.id, component_id=cmp_cable_generic.id, qty_on_hand=10, qty_reserved=0, min_threshold=5),

        # Mumbai Bhiwandi (Gateway Regional Distribution) - High stock reserve
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_panel_waaree.id, qty_on_hand=250, qty_reserved=2, min_threshold=50),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_panel_tata.id, qty_on_hand=180, qty_reserved=0, min_threshold=40),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_panel_vikram.id, qty_on_hand=120, qty_reserved=0, min_threshold=30),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_inv_sungrow.id, qty_on_hand=30, qty_reserved=0, min_threshold=5),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_inv_growatt.id, qty_on_hand=20, qty_reserved=1, min_threshold=5),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_struct_hdg.id, qty_on_hand=60, qty_reserved=5, min_threshold=15),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_bos_cable.id, qty_on_hand=80, qty_reserved=2, min_threshold=15),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_meter_net.id, qty_on_hand=25, qty_reserved=1, min_threshold=10),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_bat_luminous.id, qty_on_hand=20, qty_reserved=0, min_threshold=5),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_spd_phoenix.id, qty_on_hand=40, qty_reserved=2, min_threshold=10),
        WarehouseStock(warehouse_id=wh_mumbai.id, component_id=cmp_acc_earthing.id, qty_on_hand=30, qty_reserved=0, min_threshold=10),

        # Nashik Regional Depot
        WarehouseStock(warehouse_id=wh_nashik.id, component_id=cmp_panel_waaree.id, qty_on_hand=25, qty_reserved=0, min_threshold=15),
        WarehouseStock(warehouse_id=wh_nashik.id, component_id=cmp_inv_sungrow.id, qty_on_hand=6, qty_reserved=0, min_threshold=2),
        WarehouseStock(warehouse_id=wh_nashik.id, component_id=cmp_inv_growatt.id, qty_on_hand=6, qty_reserved=0, min_threshold=2),
        WarehouseStock(warehouse_id=wh_nashik.id, component_id=cmp_struct_hdg.id, qty_on_hand=10, qty_reserved=0, min_threshold=5),
        WarehouseStock(warehouse_id=wh_nashik.id, component_id=cmp_bos_cable.id, qty_on_hand=15, qty_reserved=0, min_threshold=5),
        WarehouseStock(warehouse_id=wh_nashik.id, component_id=cmp_bat_luminous.id, qty_on_hand=4, qty_reserved=0, min_threshold=2),
        WarehouseStock(warehouse_id=wh_nashik.id, component_id=cmp_spd_phoenix.id, qty_on_hand=8, qty_reserved=0, min_threshold=3),
    ]
    db.add_all(stocks)
    db.flush()

    # -------------------------------------------------------------
    # 4. PREDEFINED SOLAR PACKAGES (Stage 3 Specification)
    # -------------------------------------------------------------
    pkg_3kw_on = Package(
        name="3 kW On-Grid",
        code="PKG-3KW-ONGRID",
        capacity_kw=3.0,
        description="Standard 3kW rooftop kit with 6x Waaree 550W bifacial panels, Sungrow inverter, and net metering.",
        total_price_paise=18500000  # Rs. 1,85,000
    )
    pkg_5kw_on = Package(
        name="5 kW On-Grid",
        code="PKG-5KW-ONGRID",
        capacity_kw=5.0,
        description="High-performance 5kW rooftop kit with 10x Waaree 550W bifacial panels & Sungrow inverter.",
        total_price_paise=29500000  # Rs. 2,95,000
    )
    pkg_10kw_on = Package(
        name="10 kW On-Grid",
        code="PKG-10KW-ONGRID",
        capacity_kw=10.0,
        description="Commercial 10kW 3-phase solar array with 18x Waaree 550W panels & Growatt inverter.",
        total_price_paise=56000000  # Rs. 5,60,000
    )
    pkg_3kw_off = Package(
        name="3 kW Off-Grid",
        code="PKG-3KW-OFFGRID",
        capacity_kw=3.0,
        description="Standalone 3kW off-grid kit with 6x Waaree 550W panels, hybrid inverter, and 4.8kWh Lithium storage.",
        total_price_paise=24500000  # Rs. 2,45,000
    )
    pkg_5kw_off = Package(
        name="5 kW Off-Grid",
        code="PKG-5KW-OFFGRID",
        capacity_kw=5.0,
        description="Full-resilience 5kW off-grid kit with 10x Waaree 550W panels and 9.6kWh dual-battery storage.",
        total_price_paise=38500000  # Rs. 3,85,000
    )
    db.add_all([pkg_3kw_on, pkg_5kw_on, pkg_10kw_on, pkg_3kw_off, pkg_5kw_off])
    db.flush()

    # Package Items
    pkg_items = [
        # 3 kW On-Grid
        PackageItem(package_id=pkg_3kw_on.id, component_id=cmp_panel_waaree.id, quantity=6),
        PackageItem(package_id=pkg_3kw_on.id, component_id=cmp_inv_sungrow.id, quantity=1),
        PackageItem(package_id=pkg_3kw_on.id, component_id=cmp_struct_hdg.id, quantity=2),
        PackageItem(package_id=pkg_3kw_on.id, component_id=cmp_bos_cable.id, quantity=1),
        PackageItem(package_id=pkg_3kw_on.id, component_id=cmp_meter_net.id, quantity=1),
        PackageItem(package_id=pkg_3kw_on.id, component_id=cmp_spd_phoenix.id, quantity=1),

        # 5 kW On-Grid
        PackageItem(package_id=pkg_5kw_on.id, component_id=cmp_panel_waaree.id, quantity=10),
        PackageItem(package_id=pkg_5kw_on.id, component_id=cmp_inv_sungrow.id, quantity=1),
        PackageItem(package_id=pkg_5kw_on.id, component_id=cmp_struct_hdg.id, quantity=3),
        PackageItem(package_id=pkg_5kw_on.id, component_id=cmp_bos_cable.id, quantity=1),
        PackageItem(package_id=pkg_5kw_on.id, component_id=cmp_meter_net.id, quantity=1),
        PackageItem(package_id=pkg_5kw_on.id, component_id=cmp_spd_phoenix.id, quantity=1),

        # 10 kW On-Grid
        PackageItem(package_id=pkg_10kw_on.id, component_id=cmp_panel_waaree.id, quantity=18),
        PackageItem(package_id=pkg_10kw_on.id, component_id=cmp_inv_growatt.id, quantity=1),
        PackageItem(package_id=pkg_10kw_on.id, component_id=cmp_struct_hdg.id, quantity=5),
        PackageItem(package_id=pkg_10kw_on.id, component_id=cmp_bos_cable.id, quantity=2),
        PackageItem(package_id=pkg_10kw_on.id, component_id=cmp_meter_net.id, quantity=1),
        PackageItem(package_id=pkg_10kw_on.id, component_id=cmp_spd_phoenix.id, quantity=2),

        # 3 kW Off-Grid
        PackageItem(package_id=pkg_3kw_off.id, component_id=cmp_panel_waaree.id, quantity=6),
        PackageItem(package_id=pkg_3kw_off.id, component_id=cmp_inv_sungrow.id, quantity=1),
        PackageItem(package_id=pkg_3kw_off.id, component_id=cmp_bat_luminous.id, quantity=1),
        PackageItem(package_id=pkg_3kw_off.id, component_id=cmp_struct_hdg.id, quantity=2),
        PackageItem(package_id=pkg_3kw_off.id, component_id=cmp_bos_cable.id, quantity=1),
        PackageItem(package_id=pkg_3kw_off.id, component_id=cmp_spd_phoenix.id, quantity=1),

        # 5 kW Off-Grid
        PackageItem(package_id=pkg_5kw_off.id, component_id=cmp_panel_waaree.id, quantity=10),
        PackageItem(package_id=pkg_5kw_off.id, component_id=cmp_inv_sungrow.id, quantity=1),
        PackageItem(package_id=pkg_5kw_off.id, component_id=cmp_bat_luminous.id, quantity=2),
        PackageItem(package_id=pkg_5kw_off.id, component_id=cmp_struct_hdg.id, quantity=3),
        PackageItem(package_id=pkg_5kw_off.id, component_id=cmp_bos_cable.id, quantity=1),
        PackageItem(package_id=pkg_5kw_off.id, component_id=cmp_spd_phoenix.id, quantity=1),
    ]
    db.add_all(pkg_items)
    db.flush()

    # -------------------------------------------------------------
    # 5. ENQUIRIES (16 across various stages)
    # -------------------------------------------------------------
    enquiries = [
        Enquiry(customer_id=c1.id, enquiry_number="ENQ-2026-001", required_capacity_kw=5.0, property_type="Residential", roof_type="RCC Flat", budget_paise=30000000, status="ORDER_PLACED", notes="Customer ordered 5.5 kW bifacial system; commissioned successfully.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="WEBSITE", lead_priority="HIGH", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=7), follow_up_notes="System commissioned; follow up on PM Surya Ghar subsidy.", next_action="Subsidy tracker inspection check"),
        Enquiry(customer_id=c2.id, enquiry_number="ENQ-2026-002", required_capacity_kw=10.0, property_type="Commercial", roof_type="Metal Shed", budget_paise=55000000, status="ORDER_PLACED", notes="Commercial 10kW factory rooftop project; currently in installation.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="REFERRAL", lead_priority="HIGH", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=2), follow_up_notes="Factory installation in progress. Awaiting DISCOM net meter.", next_action="Coordinate DISCOM inspection"),
        Enquiry(customer_id=c3.id, enquiry_number="ENQ-2026-003", required_capacity_kw=5.0, property_type="Residential", roof_type="RCC Flat", budget_paise=25000000, status="ORDER_PLACED", notes="Bungalow rooftop, ordered 5kW on-grid; dispatched and in transit.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="COLD_CALL", lead_priority="MEDIUM", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=1), follow_up_notes="Consignment dispatched from Pune warehouse.", next_action="Track shipment delivery"),
        Enquiry(customer_id=c4.id, enquiry_number="ENQ-2026-004", required_capacity_kw=6.0, property_type="Agricultural", roof_type="Ground Mount", budget_paise=32000000, status="ORDER_PLACED", notes="Agro farm pump solarization; quotation accepted, BOM generated.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="EXHIBITION", lead_priority="HIGH", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=3), follow_up_notes="BOM approved, awaiting dispatch allocation.", next_action="Schedule warehouse dispatch"),
        Enquiry(customer_id=c5.id, enquiry_number="ENQ-2026-005", required_capacity_kw=25.0, property_type="Commercial", roof_type="RCC Flat", budget_paise=150000000, status="QUOTED", notes="TTC Industrial plant proposal submitted, awaiting board approval.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="WEBSITE", lead_priority="HIGH", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=4), follow_up_notes="Proposal presented to VP of Operations.", next_action="Board approval follow-up"),
        Enquiry(customer_id=c6.id, enquiry_number="ENQ-2026-006", required_capacity_kw=3.0, property_type="Residential", roof_type="RCC Flat", budget_paise=19000000, status="QUOTED", notes="Quotation shared with PM Surya Ghar subsidy details.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="REFERRAL", lead_priority="MEDIUM", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=2), follow_up_notes="Customer reviewing 3kW net-metering quotation.", next_action="Collect signed quote"),
        Enquiry(customer_id=c7.id, enquiry_number="ENQ-2026-007", required_capacity_kw=10.0, property_type="Agricultural", roof_type="Ground Mount", budget_paise=58000000, status="SURVEY_COMPLETED", notes="Site surveyed for ground-mount array near irrigation pump.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="COLD_CALL", lead_priority="MEDIUM", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=1), follow_up_notes="Survey completed with zero shading. Ready for quotation.", next_action="Generate 10kW quote"),
        Enquiry(customer_id=c8.id, enquiry_number="ENQ-2026-008", required_capacity_kw=5.0, property_type="Residential", roof_type="RCC Flat", budget_paise=31000000, status="SURVEY_COMPLETED", notes="Bandra penthouse survey done; shading loss analyzed.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="EXHIBITION", lead_priority="MEDIUM", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=2), follow_up_notes="Terrace survey complete; preparing 3D layout.", next_action="Generate quotation"),
        Enquiry(customer_id=c9.id, enquiry_number="ENQ-2026-009", required_capacity_kw=20.0, property_type="Commercial", roof_type="Metal Shed", budget_paise=110000000, status="SURVEY_SCHEDULED", notes="Textile mill roof survey scheduled with field engineer.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="WEBSITE", lead_priority="HIGH", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=1), follow_up_notes="Technician Nilesh Shinde assigned for survey.", next_action="Conduct site survey"),
        Enquiry(customer_id=c10.id, enquiry_number="ENQ-2026-010", required_capacity_kw=7.0, property_type="Residential", roof_type="Tiled Roof", budget_paise=42000000, status="SURVEY_SCHEDULED", notes="Salisbury park bungalow survey slotted for weekend.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="REFERRAL", lead_priority="LOW", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=3), follow_up_notes="Customer preferred Saturday morning survey.", next_action="Confirm survey slot"),
        Enquiry(customer_id=c11.id, enquiry_number="ENQ-2026-011", required_capacity_kw=50.0, property_type="Commercial", roof_type="Metal Shed", budget_paise=280000000, status="NEW", notes="Inquired about OPEX vs CAPEX model for cold storage facility.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="WEBSITE", lead_priority="HIGH", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=1), follow_up_notes="High value commercial prospect. Introductory deck sent.", next_action="Schedule initial discovery call"),
        Enquiry(customer_id=c12.id, enquiry_number="ENQ-2026-012", required_capacity_kw=3.0, property_type="Residential", roof_type="RCC Flat", budget_paise=18000000, status="NEW", notes="Initial portal enquiry for 3kW rooftop with subsidy.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="WEBSITE", lead_priority="MEDIUM", follow_up_date=datetime.datetime.utcnow() + datetime.timedelta(days=2), follow_up_notes="Customer interested in central solar subsidy scheme.", next_action="Call customer to verify address"),
        Enquiry(customer_id=c1.id, enquiry_number="ENQ-2026-013", required_capacity_kw=4.0, property_type="Agricultural", roof_type="Ground Mount", budget_paise=22000000, status="NEW", notes="Customer wants additional solar pump for rural farmhouse.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="REFERRAL", lead_priority="MEDIUM"),
        Enquiry(customer_id=c2.id, enquiry_number="ENQ-2026-014", required_capacity_kw=15.0, property_type="Commercial", roof_type="Metal Shed", budget_paise=80000000, status="NEW", notes="Phase 2 expansion for adjacent warehouse unit.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="REFERRAL", lead_priority="HIGH"),
        Enquiry(customer_id=c3.id, enquiry_number="ENQ-2026-015", required_capacity_kw=3.0, property_type="Residential", roof_type="RCC Flat", budget_paise=18500000, status="NEW", notes="Sister residence enquiry in Pune Camp area.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="REFERRAL", lead_priority="LOW"),
        Enquiry(customer_id=c6.id, enquiry_number="ENQ-2026-016", required_capacity_kw=2.0, property_type="Residential", roof_type="RCC Flat", budget_paise=10000000, status="REJECTED", notes="Rejected: Roof heavily shadowed by adjacent 14-story building.", assigned_sales_rep_id=u_sales.id, sales_rep_name=u_sales.full_name, source="COLD_CALL", lead_priority="LOW")
    ]
    db.add_all(enquiries)
    db.flush()

    # -------------------------------------------------------------
    # 6. SITE SURVEYS (8 surveys: Approved, Assigned, Submitted, Rejected)
    # -------------------------------------------------------------
    survey1 = SiteSurvey(
        enquiry_id=enquiries[0].id, survey_number="SRV-2026-001", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() - datetime.timedelta(days=28),
        roof_area_sqft=850.0, usable_roof_area_sqft=620.0, shadow_free_area_sqft=590.0,
        roof_azimuth_deg=178.0, tilt_angle_deg=16.0, shading_loss_pct=3.2, structural_integrity="EXCELLENT",
        recommended_capacity_kw=5.5, meter_type="THREE_PHASE",
        inverter_distance_meters=8.5,
        notes="RCC slab is robust. Clear southern exposure with minimal parapet shading.",
        roof_type="RCC Flat", structure_recommendation="Elevated Galvanized Rooftop Structure",
        status="APPROVED", reviewed_by_id=u_admin.id, reviewed_at=datetime.datetime.utcnow() - datetime.timedelta(days=27),
        review_notes="Approved by Survey Manager Suresh Patil after structural check."
    )
    survey2 = SiteSurvey(
        enquiry_id=enquiries[1].id, survey_number="SRV-2026-002", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() - datetime.timedelta(days=20),
        roof_area_sqft=3200.0, usable_roof_area_sqft=2600.0, shadow_free_area_sqft=2500.0,
        roof_azimuth_deg=180.0, tilt_angle_deg=12.0, shading_loss_pct=1.8, structural_integrity="GOOD",
        recommended_capacity_kw=10.0, meter_type="THREE_PHASE",
        inverter_distance_meters=18.0,
        notes="Trapezoidal sheet roof. Klip-lok non-penetrative clamps recommended.",
        roof_type="Metal Shed", structure_recommendation="Klip-lok Non-Penetrative Rail Kit",
        status="APPROVED", reviewed_by_id=u_admin.id, reviewed_at=datetime.datetime.utcnow() - datetime.timedelta(days=19),
        review_notes="Factory roof purlin capacity verified. Approved."
    )
    survey3 = SiteSurvey(
        enquiry_id=enquiries[2].id, survey_number="SRV-2026-003", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() - datetime.timedelta(days=15),
        roof_area_sqft=900.0, usable_roof_area_sqft=580.0, shadow_free_area_sqft=550.0,
        roof_azimuth_deg=175.0, tilt_angle_deg=15.0, shading_loss_pct=4.1, structural_integrity="EXCELLENT",
        recommended_capacity_kw=5.0, meter_type="SINGLE_PHASE",
        inverter_distance_meters=6.0,
        notes="Terrace has clear sun path from 9am to 5pm.",
        roof_type="RCC Flat", structure_recommendation="Standard HDG Rooftop Truss",
        status="APPROVED", reviewed_by_id=u_admin.id, reviewed_at=datetime.datetime.utcnow() - datetime.timedelta(days=14),
        review_notes="Reviewed and cleared for 5kW On-Grid quotation."
    )
    survey4 = SiteSurvey(
        enquiry_id=enquiries[3].id, survey_number="SRV-2026-004", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() - datetime.timedelta(days=10),
        roof_area_sqft=1500.0, usable_roof_area_sqft=1200.0, shadow_free_area_sqft=1200.0,
        roof_azimuth_deg=180.0, tilt_angle_deg=18.0, shading_loss_pct=0.5, structural_integrity="EXCELLENT",
        recommended_capacity_kw=6.0, meter_type="THREE_PHASE",
        inverter_distance_meters=12.0,
        notes="Open farm land near pump room with zero shading throughout the year.",
        roof_type="Ground Mount", structure_recommendation="Ground Mounted Ballasted Piles",
        status="APPROVED", reviewed_by_id=u_admin.id, reviewed_at=datetime.datetime.utcnow() - datetime.timedelta(days=9),
        review_notes="Agricultural soil and foundation approved."
    )
    survey5 = SiteSurvey(
        enquiry_id=enquiries[4].id, survey_number="SRV-2026-005", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() - datetime.timedelta(days=7),
        roof_area_sqft=6500.0, usable_roof_area_sqft=5200.0, shadow_free_area_sqft=5100.0,
        roof_azimuth_deg=182.0, tilt_angle_deg=14.0, shading_loss_pct=2.0, structural_integrity="EXCELLENT",
        recommended_capacity_kw=25.0, meter_type="THREE_PHASE",
        inverter_distance_meters=25.0,
        notes="Industrial plant terrace structurally rated for 25kW array.",
        roof_type="RCC Flat", structure_recommendation="High-Elevation HDG Canopy",
        status="APPROVED", reviewed_by_id=u_admin.id, reviewed_at=datetime.datetime.utcnow() - datetime.timedelta(days=6),
        review_notes="Approved for high-elevation canopy structure."
    )
    survey6 = SiteSurvey(
        enquiry_id=enquiries[6].id, survey_number="SRV-2026-006", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        roof_area_sqft=2000.0, usable_roof_area_sqft=1600.0, shadow_free_area_sqft=1500.0,
        roof_azimuth_deg=180.0, tilt_angle_deg=15.0, shading_loss_pct=0.0, structural_integrity="GOOD",
        recommended_capacity_kw=10.0, meter_type="THREE_PHASE",
        inverter_distance_meters=10.0,
        notes="Agricultural survey scheduled with site engineer.",
        roof_type="Ground Mount", structure_recommendation="Ground Mounting Columns", status="ASSIGNED"
    )
    survey7 = SiteSurvey(
        enquiry_id=enquiries[15].id, survey_number="SRV-2026-007", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() - datetime.timedelta(days=18),
        roof_area_sqft=400.0, usable_roof_area_sqft=150.0, shadow_free_area_sqft=50.0,
        roof_azimuth_deg=90.0, tilt_angle_deg=10.0, shading_loss_pct=38.5, structural_integrity="MODERATE",
        recommended_capacity_kw=0.0, meter_type="SINGLE_PHASE",
        inverter_distance_meters=5.0,
        notes="Excessive shading (>35%) from high-rise building on South side renders solar EPC infeasible.",
        roof_type="RCC Flat", structure_recommendation="None (Unsuitable for solar)", status="REJECTED",
        reviewed_by_id=u_admin.id, reviewed_at=datetime.datetime.utcnow() - datetime.timedelta(days=17),
        review_notes="Rejected due to prohibitive shading profile."
    )
    survey8 = SiteSurvey(
        enquiry_id=enquiries[5].id, survey_number="SRV-2026-008", surveyor_name="Nilesh Shinde (Field Survey Tech)",
        assigned_technician_id=u_technician.id,
        survey_date=datetime.datetime.utcnow() - datetime.timedelta(hours=5),
        roof_area_sqft=650.0, usable_roof_area_sqft=480.0, shadow_free_area_sqft=450.0,
        roof_azimuth_deg=180.0, tilt_angle_deg=15.0, shading_loss_pct=2.1, structural_integrity="EXCELLENT",
        recommended_capacity_kw=3.5, meter_type="SINGLE_PHASE",
        inverter_distance_meters=6.0,
        notes="Survey field measurements recorded. Southern azimuth confirmed. Ready for manager review.",
        roof_type="RCC Flat", structure_recommendation="Standard HDG Rooftop Truss", status="SUBMITTED"
    )
    db.add_all([survey1, survey2, survey3, survey4, survey5, survey6, survey7, survey8])
    db.flush()

    # -------------------------------------------------------------
    # 7. QUOTATIONS (6 quotations: 4 Accepted, 1 Sent/Shared, 1 Rejected)
    # -------------------------------------------------------------
    # Quote 1: 5.5 kW for Rajesh Sharma (Accepted -> Order 1)
    quote1 = Quotation(
        quotation_number="QT-2026-001", enquiry_id=enquiries[0].id, survey_id=survey1.id,
        package_id=pkg_5kw_on.id, customer_id=c1.id, system_capacity_kw=5.5,
        gross_amount_paise=29500000, subsidy_amount_paise=7800000, discount_paise=500000, net_amount_paise=21200000,
        estimated_annual_units_kwh=8250.0, estimated_payback_years=3.8, validity_days=30, status="ACCEPTED",
        notes="Includes 10x 550W bifacial modules, Sungrow inverter and 5-yr free comprehensive O&M."
    )
    # Quote 2: 10 kW for Amit Patel (Accepted -> Order 2)
    quote2 = Quotation(
        quotation_number="QT-2026-002", enquiry_id=enquiries[1].id, survey_id=survey2.id,
        package_id=pkg_10kw_on.id, customer_id=c2.id, system_capacity_kw=10.0,
        gross_amount_paise=56000000, subsidy_amount_paise=0, discount_paise=4000000, net_amount_paise=52000000,
        estimated_annual_units_kwh=15500.0, estimated_payback_years=3.2, validity_days=30, status="ACCEPTED",
        notes="Commercial 10kW system for industrial textile power offset."
    )
    # Quote 3: 5.0 kW for Priya Kulkarni (Accepted -> Order 3)
    quote3 = Quotation(
        quotation_number="QT-2026-003", enquiry_id=enquiries[2].id, survey_id=survey3.id,
        package_id=pkg_5kw_on.id, customer_id=c3.id, system_capacity_kw=5.0,
        gross_amount_paise=29500000, subsidy_amount_paise=7000000, discount_paise=0, net_amount_paise=22500000,
        estimated_annual_units_kwh=7500.0, estimated_payback_years=4.0, validity_days=30, status="ACCEPTED",
        notes="Residential rooftop installation with net-metering synchronization."
    )
    # Quote 4: 6.0 kW for Sunita Deshmukh (Accepted -> Order 4)
    quote4 = Quotation(
        quotation_number="QT-2026-004", enquiry_id=enquiries[3].id, survey_id=survey4.id,
        package_id=pkg_5kw_on.id, customer_id=c4.id, system_capacity_kw=6.0,
        gross_amount_paise=35000000, subsidy_amount_paise=7000000, discount_paise=0, net_amount_paise=28000000,
        estimated_annual_units_kwh=9000.0, estimated_payback_years=3.5, validity_days=30, status="ACCEPTED",
        notes="Agro pump system with ground mount ballasted structure."
    )
    # Quote 5: 25.0 kW for Vikramaditya Singhania (Shared / Sent)
    quote5 = Quotation(
        quotation_number="QT-2026-005", enquiry_id=enquiries[4].id, survey_id=survey5.id,
        package_id=pkg_10kw_on.id, customer_id=c5.id, system_capacity_kw=25.0,
        gross_amount_paise=145000000, subsidy_amount_paise=0, discount_paise=10000000, net_amount_paise=135000000,
        estimated_annual_units_kwh=38000.0, estimated_payback_years=3.0, validity_days=30, status="SENT",
        notes="Detailed techno-commercial proposal sent for factory rooftop."
    )
    # Quote 6: 3.0 kW for Anand Joshi (Rejected due to customer budget constraints)
    quote6 = Quotation(
        quotation_number="QT-2026-006", enquiry_id=enquiries[5].id, survey_id=survey1.id,
        package_id=pkg_3kw_on.id, customer_id=c6.id, system_capacity_kw=3.0,
        gross_amount_paise=18500000, subsidy_amount_paise=7800000, discount_paise=0, net_amount_paise=10700000,
        estimated_annual_units_kwh=4500.0, estimated_payback_years=4.2, validity_days=15, status="REJECTED",
        notes="Customer deferred decision due to unexpected building society maintenance work."
    )
    db.add_all([quote1, quote2, quote3, quote4, quote5, quote6])
    db.flush()

    # Itemize Quote 1
    db.add_all([
        QuotationItem(quotation_id=quote1.id, component_id=cmp_panel_waaree.id, item_description="Waaree 550W Bifacial Solar PV Modules (10 Units)", quantity=10, unit_price_paise=1250000, total_price_paise=12500000),
        QuotationItem(quotation_id=quote1.id, component_id=cmp_inv_sungrow.id, item_description="Sungrow 5kW 1-Phase Grid-Tied Inverter with Wi-Fi Logger", quantity=1, unit_price_paise=4800000, total_price_paise=4800000),
        QuotationItem(quotation_id=quote1.id, component_id=cmp_struct_hdg.id, item_description="Hot Dip Galvanized Module Mounting Structure (3 Sets)", quantity=3, unit_price_paise=520000, total_price_paise=1560000),
        QuotationItem(quotation_id=quote1.id, component_id=cmp_bos_cable.id, item_description="DC & AC Cabling, Conduit, Earthing Kit", quantity=1, unit_price_paise=590000, total_price_paise=590000),
    ])
    db.flush()

    # -------------------------------------------------------------
    # 8. ORDERS (4 Orders across the EPC Lifecycle)
    # -------------------------------------------------------------
    # Order 1: Commissioned (Full lifecycle: BOM, Dispatch, Serial numbers, Installation, Passport, Warranties, Ticket, Financials)
    order1 = Order(
        order_number="ORD-2026-001", quotation_id=quote1.id, customer_id=c1.id,
        total_contract_paise=21200000, advance_required_paise=4240000, advance_received_paise=4240000,
        payment_status="PAID", stage="COMMISSIONED",
        installation_target_date=datetime.datetime.utcnow() - datetime.timedelta(days=3),
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=25)
    )

    # Order 2: In-Progress / Installed (7/8 checklist items complete, partial payments, expenses)
    order2 = Order(
        order_number="ORD-2026-002", quotation_id=quote2.id, customer_id=c2.id,
        total_contract_paise=52000000, advance_required_paise=10400000, advance_received_paise=10400000,
        payment_status="PARTIAL", stage="INSTALLED",
        installation_target_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=14)
    )

    # Order 3: Dispatched / In-Transit (Multi-warehouse split allocation across Pune & Bhiwandi, Advance received)
    order3 = Order(
        order_number="ORD-2026-003", quotation_id=quote3.id, customer_id=c3.id,
        total_contract_paise=22500000, advance_required_paise=4500000, advance_received_paise=4500000,
        payment_status="PARTIAL", stage="DISPATCHED",
        installation_target_date=datetime.datetime.utcnow() + datetime.timedelta(days=6),
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=8)
    )

    # Order 4: Confirmed / BOM Generated (Awaiting inventory allocation)
    order4 = Order(
        order_number="ORD-2026-004", quotation_id=quote4.id, customer_id=c4.id,
        total_contract_paise=28000000, advance_required_paise=5600000, advance_received_paise=0,
        payment_status="PENDING", stage="BOM_GENERATED",
        installation_target_date=datetime.datetime.utcnow() + datetime.timedelta(days=15),
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=2)
    )
    db.add_all([order1, order2, order3, order4])
    db.flush()

    # -------------------------------------------------------------
    # 9. BILLS OF MATERIALS & ALLOCATIONS
    # -------------------------------------------------------------
    # BOM 1 for Order 1 (Fully Dispatched)
    bom1 = BillOfMaterials(bom_number="BOM-2026-001", order_id=order1.id, system_capacity_kw=5.5, total_cost_paise=16800000, status="COMPLETED")
    db.add(bom1)
    db.flush()
    bi1_panel = BOMItem(bom_id=bom1.id, component_id=cmp_panel_waaree.id, quantity_required=10, quantity_allocated=10, quantity_dispatched=10, status="DISPATCHED")
    bi1_inv = BOMItem(bom_id=bom1.id, component_id=cmp_inv_sungrow.id, quantity_required=1, quantity_allocated=1, quantity_dispatched=1, status="DISPATCHED")
    bi1_str = BOMItem(bom_id=bom1.id, component_id=cmp_struct_hdg.id, quantity_required=3, quantity_allocated=3, quantity_dispatched=3, status="DISPATCHED")
    bi1_cbl = BOMItem(bom_id=bom1.id, component_id=cmp_bos_cable.id, quantity_required=1, quantity_allocated=1, quantity_dispatched=1, status="DISPATCHED")
    db.add_all([bi1_panel, bi1_inv, bi1_str, bi1_cbl])
    db.flush()
    db.add_all([
        BOMAllocation(bom_item_id=bi1_panel.id, warehouse_id=wh_pune.id, allocated_quantity=10, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi1_inv.id, warehouse_id=wh_pune.id, allocated_quantity=1, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi1_str.id, warehouse_id=wh_pune.id, allocated_quantity=3, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi1_cbl.id, warehouse_id=wh_pune.id, allocated_quantity=1, status="DISPATCHED"),
    ])
    db.flush()

    # BOM 2 for Order 2 (10 kW Commercial - Dispatched & Installed)
    bom2 = BillOfMaterials(bom_number="BOM-2026-002", order_id=order2.id, system_capacity_kw=10.0, total_cost_paise=32000000, status="COMPLETED")
    db.add(bom2)
    db.flush()
    bi2_panel = BOMItem(bom_id=bom2.id, component_id=cmp_panel_waaree.id, quantity_required=18, quantity_allocated=18, quantity_dispatched=18, status="DISPATCHED")
    bi2_inv = BOMItem(bom_id=bom2.id, component_id=cmp_inv_growatt.id, quantity_required=1, quantity_allocated=1, quantity_dispatched=1, status="DISPATCHED")
    bi2_str = BOMItem(bom_id=bom2.id, component_id=cmp_struct_hdg.id, quantity_required=5, quantity_allocated=5, quantity_dispatched=5, status="DISPATCHED")
    bi2_cbl = BOMItem(bom_id=bom2.id, component_id=cmp_bos_cable.id, quantity_required=2, quantity_allocated=2, quantity_dispatched=2, status="DISPATCHED")
    db.add_all([bi2_panel, bi2_inv, bi2_str, bi2_cbl])
    db.flush()
    db.add_all([
        BOMAllocation(bom_item_id=bi2_panel.id, warehouse_id=wh_mumbai.id, allocated_quantity=18, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi2_inv.id, warehouse_id=wh_mumbai.id, allocated_quantity=1, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi2_str.id, warehouse_id=wh_mumbai.id, allocated_quantity=5, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi2_cbl.id, warehouse_id=wh_mumbai.id, allocated_quantity=2, status="DISPATCHED"),
    ])
    db.flush()

    # BOM 3 for Order 3 (5 kW - MULTI-WAREHOUSE SPLIT ALLOCATION: Pune Central & Bhiwandi Hub)
    bom3 = BillOfMaterials(bom_number="BOM-2026-003", order_id=order3.id, system_capacity_kw=5.0, total_cost_paise=16400000, status="COMPLETED")
    db.add(bom3)
    db.flush()
    bi3_panel = BOMItem(bom_id=bom3.id, component_id=cmp_panel_waaree.id, quantity_required=10, quantity_allocated=10, quantity_dispatched=10, status="DISPATCHED")
    bi3_inv = BOMItem(bom_id=bom3.id, component_id=cmp_inv_sungrow.id, quantity_required=1, quantity_allocated=1, quantity_dispatched=1, status="DISPATCHED")
    bi3_str = BOMItem(bom_id=bom3.id, component_id=cmp_struct_hdg.id, quantity_required=3, quantity_allocated=3, quantity_dispatched=3, status="DISPATCHED")
    bi3_cbl = BOMItem(bom_id=bom3.id, component_id=cmp_bos_cable.id, quantity_required=1, quantity_allocated=1, quantity_dispatched=1, status="DISPATCHED")
    db.add_all([bi3_panel, bi3_inv, bi3_str, bi3_cbl])
    db.flush()
    # Notice: 8 panels from Pune Central, 2 panels from Bhiwandi Western Gateway -> Demonstrates split allocation!
    db.add_all([
        BOMAllocation(bom_item_id=bi3_panel.id, warehouse_id=wh_pune.id, allocated_quantity=8, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi3_panel.id, warehouse_id=wh_mumbai.id, allocated_quantity=2, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi3_inv.id, warehouse_id=wh_pune.id, allocated_quantity=1, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi3_str.id, warehouse_id=wh_pune.id, allocated_quantity=3, status="DISPATCHED"),
        BOMAllocation(bom_item_id=bi3_cbl.id, warehouse_id=wh_pune.id, allocated_quantity=1, status="DISPATCHED"),
    ])
    db.flush()

    # BOM 4 for Order 4 (6 kW - Generated, Ready for Allocation)
    bom4 = BillOfMaterials(bom_number="BOM-2026-004", order_id=order4.id, system_capacity_kw=6.0, total_cost_paise=19800000, status="GENERATED")
    db.add(bom4)
    db.flush()
    bi4_panel = BOMItem(bom_id=bom4.id, component_id=cmp_panel_waaree.id, quantity_required=12, quantity_allocated=0, quantity_dispatched=0, status="PENDING")
    bi4_inv = BOMItem(bom_id=bom4.id, component_id=cmp_inv_sungrow.id, quantity_required=1, quantity_allocated=0, quantity_dispatched=0, status="PENDING")
    bi4_str = BOMItem(bom_id=bom4.id, component_id=cmp_struct_hdg.id, quantity_required=3, quantity_allocated=0, quantity_dispatched=0, status="PENDING")
    bi4_cbl = BOMItem(bom_id=bom4.id, component_id=cmp_bos_cable.id, quantity_required=1, quantity_allocated=0, quantity_dispatched=0, status="PENDING")
    db.add_all([bi4_panel, bi4_inv, bi4_str, bi4_cbl])
    db.flush()

    # -------------------------------------------------------------
    # 10. DISPATCHES & SERIAL BARCODE CAPTURE
    # -------------------------------------------------------------
    # Dispatch 1: Delivered (Order 1)
    dispatch1 = Dispatch(
        dispatch_number="DSP-2026-001", order_id=order1.id, warehouse_id=wh_pune.id,
        source_warehouses="Pune Central Logistics Hub", vehicle_number="MH-12-RN-4821",
        driver_name="Ramesh Shinde", driver_phone="+91 98224 88712",
        dispatch_date=datetime.datetime.utcnow() - datetime.timedelta(days=10),
        delivery_date=datetime.datetime.utcnow() - datetime.timedelta(days=9),
        estimated_delivery_date=datetime.datetime.utcnow() - datetime.timedelta(days=9),
        status="DELIVERED", notes="Delivered safely on site. Received by client Rajesh Sharma."
    )
    # Dispatch 2: Delivered (Order 2)
    dispatch2 = Dispatch(
        dispatch_number="DSP-2026-002", order_id=order2.id, warehouse_id=wh_mumbai.id,
        source_warehouses="Bhiwandi Western Gateway Hub", vehicle_number="MH-04-AX-5519",
        driver_name="Ganesh Kadam", driver_phone="+91 98201 11293",
        dispatch_date=datetime.datetime.utcnow() - datetime.timedelta(days=5),
        delivery_date=datetime.datetime.utcnow() - datetime.timedelta(days=4),
        estimated_delivery_date=datetime.datetime.utcnow() - datetime.timedelta(days=4),
        status="DELIVERED", notes="Commercial 10kW consignment unloaded at Vatva factory site."
    )
    # Dispatch 3: In Transit (Order 3 - Split Dispatch)
    dispatch3 = Dispatch(
        dispatch_number="DSP-2026-003", order_id=order3.id, warehouse_id=wh_pune.id,
        source_warehouses="Pune Central & Bhiwandi Gateway Hub (Split)", vehicle_number="MH-14-CW-9012",
        driver_name="Santosh Mane", driver_phone="+91 98902 44318",
        dispatch_date=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        estimated_delivery_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        status="IN_TRANSIT", notes="Consignment in transit to Aundh bungalow site."
    )
    db.add_all([dispatch1, dispatch2, dispatch3])
    db.flush()

    # -------------------------------------------------------------
    # 11. INSTALLATION RECORDS & 8-POINT COMMISSIONING CHECKLIST
    # -------------------------------------------------------------
    # Installation 1: Commissioned (Order 1)
    install1 = Installation(
        installation_number="INS-2026-001", order_id=order1.id,
        assigned_tech_id=u_technician.id,
        assigned_technician="Deepak Chavan (Lead Solar Tech)", lead_engineer="Deepak Chavan", team_size=4,
        installation_address="Flat 402, Sunshine Heights, Baner Road, Pune",
        scheduled_start_date=datetime.datetime.utcnow() - datetime.timedelta(days=8),
        completion_date=datetime.datetime.utcnow() - datetime.timedelta(days=3),
        commissioning_date=datetime.datetime.utcnow() - datetime.timedelta(days=3),
        chk_structure_installed=True, chk_panels_installed=True, chk_inverter_installed=True,
        chk_electrical_completed=True, chk_earthing_completed=True, chk_safety_checks_completed=True,
        chk_system_tested=True, chk_customer_handover_completed=True,
        voltage_reading_volts=235.2, current_reading_amps=21.4, power_output_kw=5.03, grid_frequency_hz=50.02,
        earthing_resistance_ohms=2.1, peak_power_tested_kw=5.42, grid_sync_successful=True,
        customer_signed_by_name="Rajesh Sharma",
        customer_signoff_date=datetime.datetime.utcnow() - datetime.timedelta(days=3),
        customer_remarks="Installation completed neatly. Sungrow monitoring app configured and explained.",
        customer_feedback_rating=5,
        commissioning_signed=True,
        status="COMMISSIONED", commissioning_report_url="/reports/commissioning-ins-2026-001.pdf",
        notes="Net metering tested and synchronized with MSEDCL grid. Generation output meets design target."
    )
    # Installation 2: In-Progress (Order 2 - 7 of 8 checklist items completed, awaiting grid sync handover)
    install2 = Installation(
        installation_number="INS-2026-002", order_id=order2.id,
        assigned_tech_id=u_technician.id,
        assigned_technician="Deepak Chavan (Lead Solar Tech)", lead_engineer="Deepak Chavan", team_size=6,
        installation_address="Plot 18, GIDC Industrial Estate, Vatva, Ahmedabad",
        scheduled_start_date=datetime.datetime.utcnow() - datetime.timedelta(days=3),
        chk_structure_installed=True, chk_panels_installed=True, chk_inverter_installed=True,
        chk_electrical_completed=True, chk_earthing_completed=True, chk_safety_checks_completed=True,
        chk_system_tested=True, chk_customer_handover_completed=False,  # Awaiting DISCOM net meter
        voltage_reading_volts=415.0, current_reading_amps=14.2, power_output_kw=9.85, grid_frequency_hz=50.01,
        earthing_resistance_ohms=1.8, peak_power_tested_kw=9.85, grid_sync_successful=False,
        status="IN_PROGRESS",
        notes="All mechanical structures and electrical wiring complete. UGVCL DISCOM inspector visit scheduled tomorrow."
    )
    db.add_all([install1, install2])
    db.flush()

    # Captured Serial Numbers
    serials = [
        # Order 1 (Installed & Commissioned)
        SerializedItem(dispatch_id=dispatch1.id, component_id=cmp_inv_sungrow.id, warehouse_id=wh_pune.id, installation_id=install1.id, serial_number="SNG-5K-2026-90412", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch1.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_pune.id, installation_id=install1.id, serial_number="WRE-550-2026A-001", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch1.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_pune.id, installation_id=install1.id, serial_number="WRE-550-2026A-002", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch1.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_pune.id, installation_id=install1.id, serial_number="WRE-550-2026A-003", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch1.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_pune.id, installation_id=install1.id, serial_number="WRE-550-2026A-004", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch1.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_pune.id, installation_id=install1.id, serial_number="WRE-550-2026A-005", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),

        # Order 2 (Dispatched & Mounted)
        SerializedItem(dispatch_id=dispatch2.id, component_id=cmp_inv_growatt.id, warehouse_id=wh_mumbai.id, installation_id=install2.id, serial_number="GWT-10K-2026-88129", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch2.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_mumbai.id, installation_id=install2.id, serial_number="WRE-550-2026B-101", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch2.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_mumbai.id, installation_id=install2.id, serial_number="WRE-550-2026B-102", barcode_format="CODE128", lifecycle_status="INSTALLED", verification_status="VERIFIED"),

        # Order 3 (In Transit)
        SerializedItem(dispatch_id=dispatch3.id, component_id=cmp_inv_sungrow.id, warehouse_id=wh_pune.id, serial_number="SNG-5K-2026-90884", barcode_format="CODE128", lifecycle_status="DISPATCHED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch3.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_pune.id, serial_number="WRE-550-2026C-201", barcode_format="CODE128", lifecycle_status="DISPATCHED", verification_status="VERIFIED"),
        SerializedItem(dispatch_id=dispatch3.id, component_id=cmp_panel_waaree.id, warehouse_id=wh_mumbai.id, serial_number="WRE-550-2026C-202", barcode_format="CODE128", lifecycle_status="DISPATCHED", verification_status="VERIFIED"),
    ]
    db.add_all(serials)
    db.flush()

    # -------------------------------------------------------------
    # 12. DIGITAL SOLAR PASSPORT & WARRANTIES
    # -------------------------------------------------------------
    passport1 = DigitalSolarPassport(
        passport_number="DSP-MH-2026-0081",
        order_id=order1.id,
        customer_id=c1.id,
        installation_id=install1.id,
        qr_code_token="token_dsp_rajesh_sharma_5kw_pune_2026",
        system_capacity_kw=5.5,
        grid_type="ON_GRID",
        commissioning_date=datetime.datetime.utcnow() - datetime.timedelta(days=3),
        pv_module_summary="10x Waaree 550W Bifacial Dual-Glass Tier-1 Modules",
        inverter_summary="1x Sungrow 5kW SG5.0RS High-Efficiency Solar Inverter",
        estimated_lifetime_mwh=206.25,
        co2_offset_tonnes=165.0,
        system_health_score=98,
        is_active=True
    )
    passport2 = DigitalSolarPassport(
        passport_number="DSP-GJ-2026-0092",
        order_id=order2.id,
        customer_id=c2.id,
        installation_id=install2.id,
        qr_code_token="token_dsp_amit_patel_10kw_ahmedabad_2026",
        system_capacity_kw=10.0,
        grid_type="ON_GRID",
        commissioning_date=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        pv_module_summary="18x Waaree 550W Bifacial Dual-Glass Tier-1 Modules",
        inverter_summary="1x Growatt 10kW MOD 10KTL3-X Commercial Solar Inverter",
        estimated_lifetime_mwh=385.0,
        co2_offset_tonnes=308.0,
        system_health_score=96,
        is_active=True
    )
    db.add_all([passport1, passport2])
    db.flush()

    w1 = Warranty(
        passport_id=passport1.id, component_id=cmp_panel_waaree.id, serial_number="WRE-550-2026A-001",
        manufacturer="Waaree Energies", warranty_type="EQUIPMENT_PERFORMANCE", duration_years=25,
        start_date=dispatch1.delivery_date, end_date=dispatch1.delivery_date + datetime.timedelta(days=365 * 25),
        terms_summary="Guaranteed 84.8% power output at 25 years with linear degradation under STC.", status="ACTIVE"
    )
    w2 = Warranty(
        passport_id=passport1.id, component_id=cmp_inv_sungrow.id, serial_number="SNG-5K-2026-90412",
        manufacturer="Sungrow Power", warranty_type="PRODUCT_REPLACEMENT", duration_years=10,
        start_date=dispatch1.delivery_date, end_date=dispatch1.delivery_date + datetime.timedelta(days=365 * 10),
        terms_summary="Comprehensive warranty covering inverter electronics, display, and Wi-Fi interface.", status="ACTIVE"
    )
    w3 = Warranty(
        passport_id=passport1.id, component_id=cmp_struct_hdg.id, serial_number="STR-HDG-PUN-001",
        manufacturer="SunPower Solutions EPC", warranty_type="WORKMANSHIP_EPC", duration_years=5,
        start_date=install1.commissioning_date, end_date=install1.commissioning_date + datetime.timedelta(days=365 * 5),
        terms_summary="SunPower Solutions comprehensive workmanship and wind resistance warranty up to 150 km/h.", status="ACTIVE"
    )
    w4 = Warranty(
        passport_id=passport2.id, component_id=cmp_panel_waaree.id, serial_number="WRE-550-2026B-101",
        manufacturer="Waaree Energies", warranty_type="EQUIPMENT_PERFORMANCE", duration_years=25,
        start_date=dispatch2.delivery_date, end_date=dispatch2.delivery_date + datetime.timedelta(days=365 * 25),
        terms_summary="Guaranteed 84.8% power output at 25 years with linear degradation under STC.", status="ACTIVE"
    )
    w5 = Warranty(
        passport_id=passport2.id, component_id=cmp_inv_growatt.id, serial_number="GWT-10K-2026-88129",
        manufacturer="Growatt New Energy", warranty_type="PRODUCT_REPLACEMENT", duration_years=10,
        start_date=dispatch2.delivery_date, end_date=dispatch2.delivery_date + datetime.timedelta(days=365 * 10),
        terms_summary="Growatt 10kW three-phase commercial inverter warranty.", status="ACTIVE"
    )
    w6 = Warranty(
        passport_id=passport2.id, component_id=cmp_struct_hdg.id, serial_number="STR-HDG-AHM-002",
        manufacturer="SunPower Solutions EPC", warranty_type="WORKMANSHIP_EPC", duration_years=5,
        start_date=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=365 * 5),
        terms_summary="SunPower Solutions comprehensive 5-year workmanship warranty.", status="ACTIVE"
    )
    db.add_all([w1, w2, w3, w4, w5, w6])
    db.flush()

    # -------------------------------------------------------------
    # 13. SERVICE TICKETS (3 Active: 1 In-Progress, 1 Open; 1 Resolved)
    # -------------------------------------------------------------
    ticket1 = ServiceTicket(
        ticket_number="TKT-2026-001", passport_id=passport1.id, customer_id=c1.id,
        issue_category="GENERAL_QUERY", priority="LOW",
        description="Customer requested walkthrough on Sungrow iSolarCloud mobile app setup for real-time generation monitoring.",
        assigned_tech_id=u_technician.id, assigned_technician="Deepak Chavan (Field Technician)",
        is_warranty_covered=True, diagnosis_notes="Walked customer through Sungrow cloud monitoring configuration.",
        parts_used="[]", labour_hours=1.0, labour_cost_paise=50000,
        resolution_notes="Walked customer through mobile app credentials and live dashboard verification.",
        status="RESOLVED",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=2),
        resolved_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    ticket2 = ServiceTicket(
        ticket_number="TKT-2026-002", passport_id=passport2.id, customer_id=c2.id,
        issue_category="INVERTER_FAULT", priority="HIGH",
        description="DISCOM inspection coordination: UGVCL requires dual earthing electrode test certificate prior to bi-directional meter release.",
        assigned_tech_id=u_technician.id, assigned_technician="Deepak Chavan (Field Technician)",
        is_warranty_covered=True, diagnosis_notes="Site dual earthing resistance tested at 1.8 ohms. Ready for inspector signoff.",
        parts_used="[]", labour_hours=2.5, labour_cost_paise=150000,
        status="IN_PROGRESS",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    ticket3 = ServiceTicket(
        ticket_number="TKT-2026-003", passport_id=None, customer_id=c3.id,
        issue_category="PHYSICAL_DAMAGE", priority="MEDIUM",
        description="Customer requested site delivery confirmation call 2 hours prior to arrival at Aundh address.",
        assigned_tech_id=u_technician.id, assigned_technician="Deepak Chavan (Field Technician)",
        is_warranty_covered=False, diagnosis_notes="Dispatch delivery coordination request logged.",
        parts_used="[]", labour_hours=0.5, labour_cost_paise=25000,
        status="OPEN",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=6)
    )
    db.add_all([ticket1, ticket2, ticket3])
    db.flush()

    # -------------------------------------------------------------
    # 14. FINANCIALS: PAYMENTS & PROJECT EXPENSES
    # -------------------------------------------------------------
    # Payments
    pay1 = Payment(
        payment_number="PAY-2026-001", order_id=order1.id, amount_paise=4240000, # Rs. 42,400 Advance (20%)
        milestone="ADVANCE", payment_mode="BANK_TRANSFER", transaction_reference="NEFT-HDFC-9921048",
        paid_at=datetime.datetime.utcnow() - datetime.timedelta(days=24), status="COMPLETED"
    )
    pay2 = Payment(
        payment_number="PAY-2026-002", order_id=order1.id, amount_paise=12720000, # Rs. 1,27,200 Dispatch (60%)
        milestone="STRUCTURE_DELIVERY", payment_mode="UPI", transaction_reference="UPI-ICICI-884920",
        paid_at=datetime.datetime.utcnow() - datetime.timedelta(days=10), status="COMPLETED"
    )
    pay3 = Payment(
        payment_number="PAY-2026-003", order_id=order1.id, amount_paise=4240000, # Rs. 42,400 Handover (20%)
        milestone="FINAL_COMMISSIONING", payment_mode="BANK_TRANSFER", transaction_reference="IMPS-SBI-110293",
        paid_at=datetime.datetime.utcnow() - datetime.timedelta(days=2), status="COMPLETED"
    )
    pay4 = Payment(
        payment_number="PAY-2026-004", order_id=order2.id, amount_paise=10400000, # Rs. 1,04,000 Advance (20%)
        milestone="ADVANCE", payment_mode="RTGS", transaction_reference="RTGS-AXIS-774910",
        paid_at=datetime.datetime.utcnow() - datetime.timedelta(days=13), status="COMPLETED"
    )
    pay5 = Payment(
        payment_number="PAY-2026-005", order_id=order3.id, amount_paise=4500000, # Rs. 45,000 Advance (20%)
        milestone="ADVANCE", payment_mode="UPI", transaction_reference="UPI-PAYTM-661298",
        paid_at=datetime.datetime.utcnow() - datetime.timedelta(days=7), status="COMPLETED"
    )
    db.add_all([pay1, pay2, pay3, pay4, pay5])
    db.flush()

    # Real Project Expenses
    exp1 = ProjectExpense(
        order_id=order1.id, category="LABOUR", amount_paise=1800000, # Rs. 18,000
        description="Site installation labor (4 certified technicians for 3 days)",
        recorded_at=datetime.datetime.utcnow() - datetime.timedelta(days=4)
    )
    exp2 = ProjectExpense(
        order_id=order1.id, category="TRANSPORT", amount_paise=450000, # Rs. 4,500
        description="Tempo freight transport from Pune warehouse to Baner site",
        recorded_at=datetime.datetime.utcnow() - datetime.timedelta(days=10)
    )
    exp3 = ProjectExpense(
        order_id=order2.id, category="LABOUR", amount_paise=3500000, # Rs. 35,000
        description="Commercial solar mounting team and high-elevation rigging (6 techs)",
        recorded_at=datetime.datetime.utcnow() - datetime.timedelta(days=3)
    )
    exp4 = ProjectExpense(
        order_id=order2.id, category="EQUIPMENT", amount_paise=1200000, # Rs. 12,000
        description="Hydraulic crane rental for hoisting 18x 550W panels onto factory metal roof",
        recorded_at=datetime.datetime.utcnow() - datetime.timedelta(days=4)
    )
    exp5 = ProjectExpense(
        order_id=order3.id, category="TRANSPORT", amount_paise=650000, # Rs. 6,500
        description="Inter-warehouse logistics transfer and last-mile freight to Aundh",
        recorded_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    db.add_all([exp1, exp2, exp3, exp4, exp5])
    db.flush()

    # -------------------------------------------------------------
    # 15. WARRANTY POLICIES (Module 7: Standard Policies)
    # -------------------------------------------------------------
    pol_waaree = WarrantyPolicy(
        code="POL-WAR-001", manufacturer="Waaree Energies", component_category="PANEL",
        model_name="WSM-550W-BF", duration_years=25, warranty_type="EQUIPMENT_PERFORMANCE",
        terms_summary="25-year linear performance warranty: minimum 90% power output at 10 years, 80% at 25 years.",
        is_active=True
    )
    pol_sungrow = WarrantyPolicy(
        code="POL-SUN-002", manufacturer="Sungrow Power", component_category="INVERTER",
        model_name="SG5.0RS", duration_years=10, warranty_type="PRODUCT_REPLACEMENT",
        terms_summary="10-year standard product replacement warranty covering inverter motherboard, display, and Wi-Fi.",
        is_active=True
    )
    pol_strolar = WarrantyPolicy(
        code="POL-STR-003", manufacturer="Strolar Mounting", component_category="STRUCTURE",
        model_name="HDG-RF-3P", duration_years=5, warranty_type="PRODUCT_REPLACEMENT",
        terms_summary="5-year structural anti-corrosion and mechanical integrity warranty rated up to 150 km/h wind.",
        is_active=True
    )
    pol_luminous = WarrantyPolicy(
        code="POL-LUM-004", manufacturer="Luminous Power", component_category="BATTERY",
        model_name="LUM-LI-48100", duration_years=7, warranty_type="EQUIPMENT_PERFORMANCE",
        terms_summary="7-year LiFePO4 battery warranty: 4,000 cycles at 80% Depth of Discharge.",
        is_active=True
    )
    db.add_all([pol_waaree, pol_sungrow, pol_strolar, pol_luminous])
    db.flush()

    w1.policy_id = pol_waaree.id
    w2.policy_id = pol_sungrow.id
    w3.policy_id = pol_strolar.id

    # -------------------------------------------------------------
    # 16. SUBSIDY APPLICATIONS (Module 9: PM Surya Ghar)
    # -------------------------------------------------------------
    sub1 = SubsidyApplication(
        application_number="SUB-2026-001", order_id=order1.id, customer_id=c1.id, installation_id=install1.id,
        discom_name="MSEDCL", consumer_number="MSEDCL-PUN-849201", system_capacity_kw=5.0,
        subsidy_scheme="PM Surya Ghar: Muft Bijli Yojana", eligible_subsidy_paise=7800000,
        disbursed_subsidy_paise=0, status="SUBMITTED",
        document_checklist='[{"name":"Electricity Bill","verified":true},{"name":"Aadhaar Card","verified":true},{"name":"Bank Passbook","verified":true},{"name":"Net Meter Agreement","verified":true}]',
        application_date=datetime.datetime.utcnow() - datetime.timedelta(days=20),
        reviewer_notes="Uploaded to PM Surya Ghar portal. Waiting for DISCOM inspector clearance."
    )
    sub2 = SubsidyApplication(
        application_number="SUB-2026-002", order_id=order2.id, customer_id=c2.id, installation_id=install2.id,
        discom_name="UGVCL", consumer_number="UGVCL-AHM-992144", system_capacity_kw=10.0,
        subsidy_scheme="PM Surya Ghar: Muft Bijli Yojana", eligible_subsidy_paise=7800000,
        disbursed_subsidy_paise=0, status="INSPECTION_CLEARED",
        document_checklist='[{"name":"Electricity Bill","verified":true},{"name":"Aadhaar Card","verified":true},{"name":"Bank Passbook","verified":true},{"name":"DISCOM Clearance Certificate","verified":true}]',
        application_date=datetime.datetime.utcnow() - datetime.timedelta(days=15),
        inspection_date=datetime.datetime.utcnow() - datetime.timedelta(days=2),
        reviewer_notes="DISCOM physical inspection cleared successfully on site."
    )
    sub3 = SubsidyApplication(
        application_number="SUB-2026-003", order_id=order3.id, customer_id=c3.id, installation_id=None,
        discom_name="MSEDCL", consumer_number="MSEDCL-PUN-104928", system_capacity_kw=3.0,
        subsidy_scheme="PM Surya Ghar: Muft Bijli Yojana", eligible_subsidy_paise=7800000,
        disbursed_subsidy_paise=0, status="APPROVED",
        document_checklist='[{"name":"Electricity Bill","verified":true},{"name":"Aadhaar Card","verified":true},{"name":"Bank Passbook","verified":true}]',
        application_date=datetime.datetime.utcnow() - datetime.timedelta(days=10),
        approval_date=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        reviewer_notes="Approved by MNRE sanction officer. Disbursement queued."
    )
    sub4 = SubsidyApplication(
        application_number="SUB-2026-004", order_id=order4.id, customer_id=c4.id, installation_id=None,
        discom_name="MSEDCL", consumer_number="MSEDCL-NSK-554219", system_capacity_kw=6.0,
        subsidy_scheme="PM Surya Ghar: Muft Bijli Yojana", eligible_subsidy_paise=7800000,
        disbursed_subsidy_paise=0, status="DRAFT",
        document_checklist='[{"name":"Electricity Bill","verified":true},{"name":"Aadhaar Card","verified":false}]',
        application_date=datetime.datetime.utcnow() - datetime.timedelta(days=3),
        reviewer_notes="Customer Aadhaar copy pending from sales executive."
    )
    db.add_all([sub1, sub2, sub3, sub4])
    db.flush()

    # -------------------------------------------------------------
    # 17. IN-APP NOTIFICATIONS (Module 11: Real-Time Alerts)
    # -------------------------------------------------------------
    n1 = Notification(
        user_id=u_sales.id, target_role="SALES_EXECUTIVE", category="ENQUIRY",
        title="New Priority Lead Assigned",
        message="Enquiry ENQ-2026-011 for Balaji Cold Storage (50 kW) has been assigned to you.",
        link_url="/enquiries", related_entity_type="Enquiry", related_entity_id=enquiries[10].id,
        is_read=False
    )
    n2 = Notification(
        user_id=u_admin.id, target_role="ADMIN", category="SURVEY",
        title="Site Survey Submitted for Review",
        message="Technician Deepak Chavan submitted site survey SRV-2026-008 for approval.",
        link_url="/surveys", related_entity_type="SiteSurvey", related_entity_id=survey8.id,
        is_read=False
    )
    n3 = Notification(
        user_id=u_technician.id, target_role="TECHNICIAN", category="SURVEY",
        title="New Site Survey Assigned",
        message="You have been assigned to conduct site survey SRV-2026-006 at Kolhapur.",
        link_url="/surveys", related_entity_type="SiteSurvey", related_entity_id=survey6.id,
        is_read=False
    )
    n4 = Notification(
        user_id=u_warehouse.id, target_role="WAREHOUSE_MANAGER", category="INVENTORY",
        title="Low Inventory Warning",
        message="Sungrow 5kW inverters at Pune Central Hub are below reorder threshold (3 units remaining).",
        link_url="/inventory", related_entity_type="WarehouseStock", related_entity_id=None,
        is_read=False
    )
    n5 = Notification(
        user_id=u_technician.id, target_role="TECHNICIAN", category="INSTALLATION",
        title="New Installation Scheduled",
        message="Installation INS-2026-002 scheduled for Amit Patel (10 kW) at Vatva GIDC.",
        link_url="/installations", related_entity_type="Installation", related_entity_id=install2.id,
        is_read=False
    )
    n6 = Notification(
        user_id=u_technician.id, target_role="TECHNICIAN", category="SERVICE",
        title="High-Priority Ticket Open",
        message="Ticket TKT-2026-002 requires DISCOM dual earthing inspection coordination.",
        link_url="/service", related_entity_type="ServiceTicket", related_entity_id=ticket2.id,
        is_read=False
    )
    n7 = Notification(
        user_id=u_admin.id, target_role="ADMIN", category="SUBSIDY",
        title="Subsidy Milestone Cleared",
        message="PM Surya Ghar subsidy SUB-2026-003 for Priya Kulkarni has been APPROVED by MNRE.",
        link_url="/subsidies", related_entity_type="SubsidyApplication", related_entity_id=sub3.id,
        is_read=True
    )
    db.add_all([n1, n2, n3, n4, n5, n6, n7])
    db.commit()

    # -------------------------------------------------------------
    # 13. SEED DOCUMENTS & AUDIT LOGS (Phase 2 Features 6 & 8)
    # -------------------------------------------------------------
    import os
    docs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "documents")
    os.makedirs(docs_dir, exist_ok=True)

    seed_docs = [
        Document(
            title="Rooftop Shading & Structural Feasibility Report (5kW)",
            category="SURVEY_REPORT",
            file_name="survey_report_srv001.pdf",
            original_file_name="survey_report_srv001.pdf",
            file_path="documents/survey_report_srv001.pdf",
            file_url="/uploads/documents/survey_report_srv001.pdf",
            file_size_bytes=42100,
            mime_type="application/pdf",
            entity_type="SURVEY",
            entity_id=survey1.id,
            entity_identifier="SRV-2026-001",
            uploaded_by_name="Suresh Gaikwad",
            notes="3D shade analysis and structural integrity verification.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=12)
        ),
        Document(
            title="Engineering EPC Quotation & Package Specification",
            category="QUOTATION_DOC",
            file_name="quotation_quo001.pdf",
            original_file_name="quotation_quo001.pdf",
            file_path="documents/quotation_quo001.pdf",
            file_url="/uploads/documents/quotation_quo001.pdf",
            file_size_bytes=68500,
            mime_type="application/pdf",
            entity_type="QUOTATION",
            entity_id=quote1.id,
            entity_identifier="QUO-2026-001",
            uploaded_by_name="Rahul Deshmukh",
            notes="Signed customer quotation specification document.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=10)
        ),
        Document(
            title="8-Point Commissioning Checklist & Earthing Report",
            category="COMMISSIONING_REPORT",
            file_name="commissioning_cert_ins001.pdf",
            original_file_name="commissioning_cert_ins001.pdf",
            file_path="documents/commissioning_cert_ins001.pdf",
            file_url="/uploads/documents/commissioning_cert_ins001.pdf",
            file_size_bytes=52300,
            mime_type="application/pdf",
            entity_type="INSTALLATION",
            entity_id=install1.id,
            entity_identifier="INS-2026-001",
            uploaded_by_name="Ramesh Patil",
            notes="Megger earthing: 2.1 ohms. Inverter grid sync verified.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=4)
        ),
        Document(
            title="Waaree 25-Year Bifacial Performance Warranty Certificate",
            category="WARRANTY_CERTIFICATE",
            file_name="waaree_warranty_cert.pdf",
            original_file_name="waaree_warranty_cert.pdf",
            file_path="documents/waaree_warranty_cert.pdf",
            file_url="/uploads/documents/waaree_warranty_cert.pdf",
            file_size_bytes=89100,
            mime_type="application/pdf",
            entity_type="WARRANTY",
            entity_id=w1.id,
            entity_identifier="WAR-2026-001",
            uploaded_by_name="Waaree QA Division",
            notes="Official manufacturer warranty policy certificate.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=3)
        ),
        Document(
            title="MSEDCL Sanctioned Load & Tariff Electricity Bill",
            category="ELECTRICITY_BILL",
            file_name="msedcl_electricity_bill.pdf",
            original_file_name="msedcl_electricity_bill.pdf",
            file_path="documents/msedcl_electricity_bill.pdf",
            file_url="/uploads/documents/msedcl_electricity_bill.pdf",
            file_size_bytes=34200,
            mime_type="application/pdf",
            entity_type="CUSTOMER",
            entity_id=c1.id,
            entity_identifier="CUST-101",
            uploaded_by_name="Rahul Deshmukh",
            notes="Customer utility bill verified for PM Surya Ghar subsidy claim.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=14)
        )
    ]
    db.add_all(seed_docs)

    seed_audits = [
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=15),
            user_id=u_sales.id, user_name="Rahul Deshmukh", user_role="SALES_EXECUTIVE",
            action="CREATE", entity_type="ENQUIRY", entity_id=enquiries[0].id, entity_identifier="ENQ-2026-001",
            new_values='{"status": "NEW", "system_size_kw": 5.0}',
            details="Inbound qualified lead created for Rajesh Sharma."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=14),
            user_id=u_admin.id, user_name="Vikram Malhotra", user_role="ADMIN",
            action="ASSIGN", entity_type="SURVEY", entity_id=survey1.id, entity_identifier="SRV-2026-001",
            new_values='{"assigned_technician": "Deepak Chavan"}',
            details="Site survey visit assigned to field technician Deepak Chavan."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=12),
            user_id=u_admin.id, user_name="Vikram Malhotra", user_role="ADMIN",
            action="APPROVE", entity_type="SURVEY", entity_id=survey1.id, entity_identifier="SRV-2026-001",
            old_values='{"status": "SUBMITTED"}', new_values='{"status": "APPROVED"}',
            details="Survey verified and approved. Roof area: 450 sq ft, 3.2% shading."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=10),
            user_id=u_sales.id, user_name="Rahul Deshmukh", user_role="SALES_EXECUTIVE",
            action="STATUS_CHANGE", entity_type="QUOTATION", entity_id=quote1.id, entity_identifier="QUO-2026-001",
            old_values='{"status": "SENT"}', new_values='{"status": "ACCEPTED"}',
            details="Customer accepted quotation and remitted 20% advance milestone."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=10),
            user_id=u_admin.id, user_name="System/Automated", user_role="SYSTEM",
            action="CREATE", entity_type="ORDER", entity_id=order1.id, entity_identifier="ORD-2026-0001",
            new_values='{"stage": "CONFIRMED", "contract_value_inr": 295000}',
            details="Converted quotation to confirmed installation order."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=9),
            user_id=u_sales.id, user_name="Rahul Deshmukh", user_role="SALES_EXECUTIVE",
            action="PAYMENT", entity_type="ORDER", entity_id=order1.id, entity_identifier="ORD-2026-0001",
            new_values='{"amount_inr": 59000, "type": "ADVANCE", "ref": "HDFC982141"}',
            details="Recorded initial milestone advance payment of Rs. 59,000."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=8),
            user_id=u_warehouse.id, user_name="Sunil Kulkarni", user_role="WAREHOUSE_MANAGER",
            action="ALLOCATE", entity_type="ORDER", entity_id=order1.id, entity_identifier="ORD-2026-0001",
            old_values='{"stage": "BOM_GENERATED"}', new_values='{"stage": "INVENTORY_ALLOCATED"}',
            details="Allocated 10x Waaree panels and Sungrow inverter from Pune Central Depot."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=6),
            user_id=u_warehouse.id, user_name="Sunil Kulkarni", user_role="WAREHOUSE_MANAGER",
            action="DISPATCH", entity_type="DISPATCH", entity_id=dispatch1.id, entity_identifier="DSP-2026-001",
            new_values='{"vehicle": "MH-12-SP-2026", "driver": "Kishore Gaikwad"}',
            details="Dispatched materials to site and scanned serial barcodes."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=4),
            user_id=u_technician.id, user_name="Deepak Chavan", user_role="TECHNICIAN",
            action="COMMISSION", entity_type="INSTALLATION", entity_id=install1.id, entity_identifier="INS-2026-001",
            old_values='{"status": "QUALITY_CHECK"}', new_values='{"status": "COMMISSIONED"}',
            details="Completed 8-point checklist and energized 5kW solar array."
        ),
        AuditLog(
            timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=4),
            user_id=u_admin.id, user_name="System/Automated", user_role="SYSTEM",
            action="CREATE", entity_type="PASSPORT", entity_id=passport1.id, entity_identifier="DSP-2026-0001",
            new_values='{"passport_number": "DSP-2026-0001", "health_score": 98}',
            details="Cryptographic Digital Solar Passport and QR verification token generated."
        )
    ]
    db.add_all(seed_audits)

    # -------------------------------------------------------------
    # 17. INTER-WAREHOUSE TRANSFERS (Traceable Stock Rebalancing)
    # -------------------------------------------------------------
    seed_transfers = [
        InventoryTransfer(
            transfer_number="TRF-2026-001",
            source_warehouse_id=wh_pune.id,
            dest_warehouse_id=wh_mumbai.id,
            component_id=cmp_panel_waaree.id,
            quantity=25,
            status="RECEIVED",
            requested_by_user_id=u_warehouse.id,
            requested_by_name="Manoj Gokhale",
            approved_by_user_id=u_admin.id,
            approved_by_name="Vikram Malhotra",
            received_by_user_id=u_warehouse.id,
            received_by_name="Manoj Gokhale",
            notes="Rebalanced 25 Waaree 550W bifacial modules to Bhiwandi depot for upcoming C&I installations.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=12),
            approved_at=datetime.datetime.utcnow() - datetime.timedelta(days=11),
            dispatched_at=datetime.datetime.utcnow() - datetime.timedelta(days=10),
            received_at=datetime.datetime.utcnow() - datetime.timedelta(days=9)
        ),
        InventoryTransfer(
            transfer_number="TRF-2026-002",
            source_warehouse_id=wh_mumbai.id,
            dest_warehouse_id=wh_nashik.id,
            component_id=cmp_inv_sungrow.id,
            quantity=5,
            status="IN_TRANSIT",
            requested_by_user_id=u_warehouse.id,
            requested_by_name="Manoj Gokhale",
            approved_by_user_id=u_admin.id,
            approved_by_name="Vikram Malhotra",
            notes="Transfer of 5 Sungrow 5kW inverters to Nashik Regional Depot for pending residential projects.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=3),
            approved_at=datetime.datetime.utcnow() - datetime.timedelta(days=2),
            dispatched_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
        ),
        InventoryTransfer(
            transfer_number="TRF-2026-003",
            source_warehouse_id=wh_pune.id,
            dest_warehouse_id=wh_nashik.id,
            component_id=cmp_spd_phoenix.id,
            quantity=10,
            status="APPROVED",
            requested_by_user_id=u_warehouse.id,
            requested_by_name="Manoj Gokhale",
            approved_by_user_id=u_admin.id,
            approved_by_name="Vikram Malhotra",
            notes="Pre-allocation of 10 Phoenix Contact SPD units for Nashik commercial projects.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1),
            approved_at=datetime.datetime.utcnow() - datetime.timedelta(hours=4)
        )
    ]
    db.add_all(seed_transfers)

    # -------------------------------------------------------------
    # 18. STOCK MOVEMENTS (Auditable Physical Stock Movements)
    # -------------------------------------------------------------
    seed_movements = [
        StockMovement(
            warehouse_id=wh_pune.id,
            component_id=cmp_panel_waaree.id,
            quantity_change=150,
            movement_type="INITIAL",
            notes="Primary consignment received from Waaree manufacturing plant, Surat.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=30)
        ),
        StockMovement(
            warehouse_id=wh_pune.id,
            component_id=cmp_inv_sungrow.id,
            quantity_change=25,
            movement_type="INITIAL",
            notes="Received shipment of Sungrow SG5.0RS residential inverters.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=28)
        ),
        StockMovement(
            warehouse_id=wh_pune.id,
            component_id=cmp_panel_waaree.id,
            quantity_change=-25,
            movement_type="MANUAL_ADJUSTMENT",
            notes="Inter-warehouse transfer TRF-2026-001 to Bhiwandi depot.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=10)
        ),
        StockMovement(
            warehouse_id=wh_mumbai.id,
            component_id=cmp_panel_waaree.id,
            quantity_change=25,
            movement_type="MANUAL_ADJUSTMENT",
            notes="Received inter-warehouse transfer TRF-2026-001 from Pune hub.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=9)
        ),
        StockMovement(
            warehouse_id=wh_pune.id,
            component_id=cmp_panel_waaree.id,
            quantity_change=-10,
            movement_type="DISPATCH",
            notes="Dispatched materials for Order ORD-2026-001 (Rajesh Sharma).",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=6)
        ),
        StockMovement(
            warehouse_id=wh_mumbai.id,
            component_id=cmp_panel_waaree.id,
            quantity_change=-18,
            movement_type="DISPATCH",
            notes="Dispatched materials for Order ORD-2026-002 (Amit Patel).",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=4)
        )
    ]
    db.add_all(seed_movements)

    # -------------------------------------------------------------
    # 19. USER SESSIONS (Active JWT Sessions)
    # -------------------------------------------------------------
    seed_sessions = [
        UserSession(
            session_id=str(uuid.uuid4()),
            user_id=u_admin.id,
            token_jti=str(uuid.uuid4()).replace("-", ""),
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
            ip_address="127.0.0.1",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            is_revoked=False
        ),
        UserSession(
            session_id=str(uuid.uuid4()),
            user_id=u_sales.id,
            token_jti=str(uuid.uuid4()).replace("-", ""),
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
            ip_address="127.0.0.1",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            is_revoked=False
        ),
        UserSession(
            session_id=str(uuid.uuid4()),
            user_id=u_warehouse.id,
            token_jti=str(uuid.uuid4()).replace("-", ""),
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
            ip_address="127.0.0.1",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=45),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            is_revoked=False
        ),
        UserSession(
            session_id=str(uuid.uuid4()),
            user_id=u_technician.id,
            token_jti=str(uuid.uuid4()).replace("-", ""),
            user_agent="Mozilla/5.0 (Android 14; Mobile) Chrome/120.0.0.0",
            ip_address="192.168.1.105",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=30),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            is_revoked=False
        )
    ]
    db.add_all(seed_sessions)
    db.commit()

    return {
        "users": db.query(User).count(),
        "customers": db.query(Customer).count(),
        "enquiries": db.query(Enquiry).count(),
        "site_surveys": db.query(SiteSurvey).count(),
        "components": db.query(Component).count(),
        "packages": db.query(Package).count(),
        "quotations": db.query(Quotation).count(),
        "orders": db.query(Order).count(),
        "warehouses": db.query(Warehouse).count(),
        "stocks": db.query(WarehouseStock).count(),
        "boms": db.query(BillOfMaterials).count(),
        "dispatches": db.query(Dispatch).count(),
        "serialized_items": db.query(SerializedItem).count(),
        "installations": db.query(Installation).count(),
        "passports": db.query(DigitalSolarPassport).count(),
        "warranties": db.query(Warranty).count(),
        "warranty_policies": db.query(WarrantyPolicy).count(),
        "service_tickets": db.query(ServiceTicket).count(),
        "subsidies": db.query(SubsidyApplication).count(),
        "notifications": db.query(Notification).count(),
        "payments": db.query(Payment).count(),
        "expenses": db.query(ProjectExpense).count(),
        "documents": db.query(Document).count(),
        "audit_logs": db.query(AuditLog).count(),
    }
