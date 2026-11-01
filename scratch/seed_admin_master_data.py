import json
from app.database import engine
from sqlalchemy.orm import Session
from app.models import (
    Package, PackageItem, Component, SystemConfiguration, WarrantyPolicy
)

def seed_master_data():
    session = Session(engine)
    try:
        # 1. Seed Missing 1kW, 2kW, 4kW Packages (On-Grid and Off-Grid)
        panels = session.query(Component).filter(Component.category == "PANEL").all()
        inverters = session.query(Component).filter(Component.category == "INVERTER").all()
        structures = session.query(Component).filter(Component.category == "STRUCTURE").all()
        cables = session.query(Component).filter(Component.category == "CABLE").all()
        meters = session.query(Component).filter(Component.category == "METER").all()
        batteries = session.query(Component).filter(Component.category == "BATTERY").all()

        panel_c = panels[0] if panels else None
        inv_c = inverters[0] if inverters else None
        str_c = structures[0] if structures else None
        cbl_c = cables[0] if cables else None
        mtr_c = meters[0] if meters else None
        bat_c = batteries[0] if batteries else None

        packages_to_add = [
            {
                "code": "PKG-1KW-ONGRID",
                "name": "1 kW On-Grid Residential Kit",
                "capacity_kw": 1.0,
                "description": "Compact 1kW On-Grid solar rooftop package with high-efficiency bifacial panels and string inverter.",
                "total_price_paise": 6500000, # Rs. 65,000
                "items": [(panel_c, 2), (inv_c, 1), (str_c, 1), (cbl_c, 1), (mtr_c, 1)]
            },
            {
                "code": "PKG-2KW-ONGRID",
                "name": "2 kW On-Grid Residential Kit",
                "capacity_kw": 2.0,
                "description": "Standard 2kW On-Grid rooftop setup qualifying for PM Surya Ghar subsidy.",
                "total_price_paise": 12500000, # Rs. 1,25,000
                "items": [(panel_c, 4), (inv_c, 1), (str_c, 1), (cbl_c, 1), (mtr_c, 1)]
            },
            {
                "code": "PKG-4KW-ONGRID",
                "name": "4 kW On-Grid Rooftop Pro",
                "capacity_kw": 4.0,
                "description": "High-yield 4kW On-Grid residential and light commercial setup.",
                "total_price_paise": 24000000, # Rs. 2,40,000
                "items": [(panel_c, 8), (inv_c, 1), (str_c, 2), (cbl_c, 2), (mtr_c, 1)]
            },
            {
                "code": "PKG-1KW-OFFGRID",
                "name": "1 kW Off-Grid Storage Kit",
                "capacity_kw": 1.0,
                "description": "1kW standalone solar package with lithium energy storage for remote or rural locations.",
                "total_price_paise": 9500000, # Rs. 95,000
                "items": [(panel_c, 2), (inv_c, 1), (str_c, 1), (cbl_c, 1), (bat_c, 1)]
            },
            {
                "code": "PKG-2KW-OFFGRID",
                "name": "2 kW Off-Grid Hybrid Kit",
                "capacity_kw": 2.0,
                "description": "2kW Off-Grid solar installation with hybrid inverter and energy storage.",
                "total_price_paise": 17500000, # Rs. 1,75,000
                "items": [(panel_c, 4), (inv_c, 1), (str_c, 1), (cbl_c, 1), (bat_c, 1)]
            },
            {
                "code": "PKG-4KW-OFFGRID",
                "name": "4 kW Off-Grid Heavy Duty Hybrid",
                "capacity_kw": 4.0,
                "description": "Heavy-duty 4kW Off-Grid solar plant with multi-battery bank for uninterrupted power.",
                "total_price_paise": 31500000, # Rs. 3,15,000
                "items": [(panel_c, 8), (inv_c, 1), (str_c, 2), (cbl_c, 2), (bat_c, 2)]
            }
        ]

        added_pkg_count = 0
        for p_def in packages_to_add:
            existing = session.query(Package).filter(Package.code == p_def["code"]).first()
            if not existing:
                pkg = Package(
                    code=p_def["code"],
                    name=p_def["name"],
                    capacity_kw=p_def["capacity_kw"],
                    description=p_def["description"],
                    total_price_paise=p_def["total_price_paise"],
                    is_active=True
                )
                session.add(pkg)
                session.flush()

                for comp, qty in p_def["items"]:
                    if comp:
                        item = PackageItem(
                            package_id=pkg.id,
                            component_id=comp.id,
                            quantity=qty
                        )
                        session.add(item)
                added_pkg_count += 1

        print(f"Added {added_pkg_count} new solar packages.")

        # 2. Seed System Configurations
        configs = [
            {
                "key": "pricing_tax_configuration",
                "category": "PRICING_TAX",
                "description": "National solar EPC GST rate splits, benchmark pricing per kW, and subsidy parameters.",
                "value": {
                    "gst_rates": {
                        "solar_pv_modules_pct": 5.0,
                        "inverters_and_bos_pct": 12.0,
                        "installation_and_epc_services_pct": 18.0,
                        "effective_composite_rate_pct": 8.9
                    },
                    "benchmark_prices_inr_per_kw": {
                        "residential_rooftop_1_3kw": 58000,
                        "residential_rooftop_4_10kw": 52000,
                        "commercial_industrial": 45000,
                        "offgrid_hybrid_battery": 85000
                    },
                    "epc_margin_target_pct": 22.0,
                    "max_sales_rep_discount_pct": 5.0,
                    "pm_surya_ghar_subsidy": {
                        "tier1_up_to_2kw_per_kw_inr": 30000,
                        "tier2_3kw_additional_inr": 18000,
                        "max_total_subsidy_inr": 78000
                    }
                }
            },
            {
                "key": "bom_templates",
                "category": "BOM_TEMPLATE",
                "description": "Standardized engineering Bill of Materials templates for 1kW through 5kW systems.",
                "value": {
                    "templates": [
                        {
                            "capacity_kw": 1.0,
                            "type": "ON_GRID",
                            "name": "1 kW On-Grid Standard BOM",
                            "items": [
                                {"category": "PANEL", "name": "Waaree 540W Mono PERC", "qty": 2, "unit": "Nos"},
                                {"category": "INVERTER", "name": "1.5 kW String Inverter", "qty": 1, "unit": "Nos"},
                                {"category": "STRUCTURE", "name": "HDG Rooftop Mounting Kit", "qty": 1, "unit": "Set"},
                                {"category": "CABLE", "name": "Polycab 4 sq mm DC Solar Cable", "qty": 30, "unit": "Mtr"},
                                {"category": "PROTECTION", "name": "AC/DC Distribution Box SPD Type 2", "qty": 1, "unit": "Box"},
                                {"category": "EARTHING", "name": "Chemical Earthing Electrode Kit", "qty": 2, "unit": "Kit"}
                            ]
                        },
                        {
                            "capacity_kw": 2.0,
                            "type": "ON_GRID",
                            "name": "2 kW On-Grid Standard BOM",
                            "items": [
                                {"category": "PANEL", "name": "Waaree 540W Mono PERC", "qty": 4, "unit": "Nos"},
                                {"category": "INVERTER", "name": "2.5 kW String Inverter", "qty": 1, "unit": "Nos"},
                                {"category": "STRUCTURE", "name": "HDG Rooftop Mounting Kit", "qty": 1, "unit": "Set"},
                                {"category": "CABLE", "name": "Polycab 4 sq mm DC Solar Cable", "qty": 40, "unit": "Mtr"},
                                {"category": "PROTECTION", "name": "AC/DC Distribution Box SPD Type 2", "qty": 1, "unit": "Box"},
                                {"category": "EARTHING", "name": "Chemical Earthing Electrode Kit", "qty": 2, "unit": "Kit"}
                            ]
                        },
                        {
                            "capacity_kw": 3.0,
                            "type": "ON_GRID",
                            "name": "3 kW On-Grid Standard BOM",
                            "items": [
                                {"category": "PANEL", "name": "Waaree 550W Bifacial Dual Glass", "qty": 6, "unit": "Nos"},
                                {"category": "INVERTER", "name": "Sungrow 3.3kW Single Phase Inverter", "qty": 1, "unit": "Nos"},
                                {"category": "STRUCTURE", "name": "HDG Elevated Structure Kit", "qty": 1, "unit": "Set"},
                                {"category": "CABLE", "name": "Polycab 4 sq mm DC Solar Cable", "qty": 50, "unit": "Mtr"},
                                {"category": "PROTECTION", "name": "Dual String AC/DC DB with MCB & SPD", "qty": 1, "unit": "Box"},
                                {"category": "METER", "name": "Secure 3-Phase Bidirectional Net Meter", "qty": 1, "unit": "Nos"},
                                {"category": "EARTHING", "name": "Chemical Earthing Electrode Kit", "qty": 3, "unit": "Kit"}
                            ]
                        },
                        {
                            "capacity_kw": 4.0,
                            "type": "ON_GRID",
                            "name": "4 kW On-Grid Standard BOM",
                            "items": [
                                {"category": "PANEL", "name": "Waaree 550W Bifacial Dual Glass", "qty": 8, "unit": "Nos"},
                                {"category": "INVERTER", "name": "Sungrow 4kW Single Phase Inverter", "qty": 1, "unit": "Nos"},
                                {"category": "STRUCTURE", "name": "HDG Elevated Structure Kit", "qty": 2, "unit": "Set"},
                                {"category": "CABLE", "name": "Polycab 4 sq mm DC Solar Cable", "qty": 60, "unit": "Mtr"},
                                {"category": "PROTECTION", "name": "Dual String AC/DC DB with MCB & SPD", "qty": 1, "unit": "Box"},
                                {"category": "METER", "name": "Secure 3-Phase Bidirectional Net Meter", "qty": 1, "unit": "Nos"},
                                {"category": "EARTHING", "name": "Chemical Earthing Electrode Kit", "qty": 3, "unit": "Kit"}
                            ]
                        },
                        {
                            "capacity_kw": 5.0,
                            "type": "ON_GRID",
                            "name": "5 kW On-Grid Standard BOM",
                            "items": [
                                {"category": "PANEL", "name": "Tata Power 540W Mono PERC", "qty": 10, "unit": "Nos"},
                                {"category": "INVERTER", "name": "Growatt 5kW 3-Phase Inverter", "qty": 1, "unit": "Nos"},
                                {"category": "STRUCTURE", "name": "HDG Elevated Superstructure Kit", "qty": 2, "unit": "Set"},
                                {"category": "CABLE", "name": "Polycab 4 sq mm DC Solar Cable", "qty": 80, "unit": "Mtr"},
                                {"category": "PROTECTION", "name": "3-Phase AC/DC DB with Surge Arrestors", "qty": 1, "unit": "Box"},
                                {"category": "METER", "name": "Secure 3-Phase Bidirectional Net Meter", "qty": 1, "unit": "Nos"},
                                {"category": "EARTHING", "name": "Chemical Earthing Electrode Kit", "qty": 3, "unit": "Kit"}
                            ]
                        }
                    ]
                }
            },
            {
                "key": "technical_checklists",
                "category": "CHECKLIST",
                "description": "Standard field checklists for site survey and installation execution.",
                "value": {
                    "survey_checklist": [
                        {"id": "CHK_SUR_01", "label": "Roof structural load-bearing inspection", "category": "CIVIL", "mandatory": True},
                        {"id": "CHK_SUR_02", "label": "Shadow profile analysis (10 AM to 4 PM)", "category": "ELECTRICAL", "mandatory": True},
                        {"id": "CHK_SUR_03", "label": "Roof slope and true south azimuth compass reading", "category": "CIVIL", "mandatory": True},
                        {"id": "CHK_SUR_04", "label": "Main distribution board (MDB) & cable routing length", "category": "ELECTRICAL", "mandatory": True},
                        {"id": "CHK_SUR_05", "label": "Earthing pit ground feasibility inspection", "category": "SAFETY", "mandatory": True},
                        {"id": "CHK_SUR_06", "label": "DISCOM consumer number & sanctioned kW load verification", "category": "REGULATORY", "mandatory": True},
                        {"id": "CHK_SUR_07", "label": "Minimum 6 geo-tagged photographs captured", "category": "EVIDENCE", "mandatory": True}
                    ],
                    "installation_checklist": [
                        {"id": "CHK_INS_01", "label": "BOM component verification & serial scan", "category": "INVENTORY", "mandatory": True},
                        {"id": "CHK_INS_02", "label": "Structural anchor torque check (45 Nm)", "category": "MECHANICAL", "mandatory": True},
                        {"id": "CHK_INS_03", "label": "Module mid & end clamp tightness verification", "category": "MECHANICAL", "mandatory": True},
                        {"id": "CHK_INS_04", "label": "DC MC4 connector crimp & UV conduit protection", "category": "ELECTRICAL", "mandatory": True},
                        {"id": "CHK_INS_05", "label": "Chemical earthing pit compound hydration & connection", "category": "SAFETY", "mandatory": True},
                        {"id": "CHK_INS_06", "label": "Lightning arrestor (LA) elevation & continuity test", "category": "SAFETY", "mandatory": True},
                        {"id": "CHK_INS_07", "label": "Customer sign-off & warranty handbook handover", "category": "HANDOVER", "mandatory": True}
                    ]
                }
            },
            {
                "key": "commissioning_test_templates",
                "category": "CHECKLIST",
                "description": "Mandatory electrical testing parameters for plant commissioning.",
                "value": {
                    "electrical_tests": [
                        {
                            "test_name": "String Open Circuit Voltage (Voc)",
                            "unit": "Volts DC",
                            "tolerance": "Within +/- 5% of calculated STC string Voc",
                            "mandatory": True
                        },
                        {
                            "test_name": "String Short Circuit Current (Isc)",
                            "unit": "Amps DC",
                            "tolerance": "Proportional to solar irradiance (> 6 A typical)",
                            "mandatory": True
                        },
                        {
                            "test_name": "DC Insulation Resistance (Riso)",
                            "unit": "Mega-Ohms (MΩ)",
                            "tolerance": "Minimum > 1.0 MΩ tested at 1000V DC",
                            "mandatory": True
                        },
                        {
                            "test_name": "Earthing Resistance Test",
                            "unit": "Ohms (Ω)",
                            "tolerance": "Must be less than 5.0 Ω (target < 2.0 Ω)",
                            "mandatory": True
                        },
                        {
                            "test_name": "Inverter Anti-Islanding Trip Time",
                            "unit": "Seconds",
                            "tolerance": "Must disconnect within 2.0 seconds upon grid loss",
                            "mandatory": True
                        },
                        {
                            "test_name": "Grid Synchronization AC Frequency",
                            "unit": "Hertz (Hz)",
                            "tolerance": "49.5 Hz to 50.5 Hz",
                            "mandatory": True
                        }
                    ]
                }
            },
            {
                "key": "warranty_terms_configuration",
                "category": "APP_SETTINGS",
                "description": "Baseline manufacturer and EPC warranty coverage terms.",
                "value": {
                    "terms": [
                        {"category": "PANEL", "standard_years": 10, "performance_years": 25, "sla_days": 14, "terms": "10-year product replacement; 25-year 80% linear power performance warranty"},
                        {"category": "INVERTER", "standard_years": 5, "performance_years": 10, "sla_days": 7, "terms": "5-year manufacturer replacement; extendable up to 10 years"},
                        {"category": "BATTERY", "standard_years": 5, "performance_years": 7, "sla_days": 10, "terms": "6000 cycles at 80% DoD with BMS telemetry coverage"},
                        {"category": "STRUCTURE", "standard_years": 10, "performance_years": 10, "sla_days": 14, "terms": "Hot-dip galvanized structural integrity against corrosion"},
                        {"category": "EPC_WORKMANSHIP", "standard_years": 5, "performance_years": 5, "sla_days": 2, "terms": "SunPower Solutions workmanship, cable terminations, and zero-leakage roof warranty"}
                    ]
                }
            },
            {
                "key": "system_application_settings",
                "category": "APP_SETTINGS",
                "description": "Company profile, currency, working hours, and operational SLAs.",
                "value": {
                    "company_name": "SunPower Solutions EPC Pvt Ltd",
                    "gstin": "27AAACS1234F1Z5",
                    "registered_office": "Plot 42, Hinjewadi Phase 1, Pune, Maharashtra 411057",
                    "helpline_phone": "+91 20 6700 8900",
                    "support_email": "support@sunpowersolutions.com",
                    "currency_symbol": "₹",
                    "default_discom": "MSEDCL",
                    "slas": {
                        "survey_assignment_hours": 24,
                        "survey_completion_hours": 48,
                        "quotation_preparation_hours": 24,
                        "bom_allocation_hours": 48,
                        "dispatch_preparation_days": 3,
                        "installation_execution_days": 7,
                        "critical_service_ticket_hours": 24
                    },
                    "features_enabled": {
                        "auto_passport_creation": True,
                        "auto_subsidy_application_draft": True,
                        "sms_notifications": True,
                        "email_quotations": True
                    }
                }
            },
            {
                "key": "role_permissions_configuration",
                "category": "BUSINESS_RULES",
                "description": "Granular capability matrix across the five approved platform roles.",
                "value": {
                    "roles": {
                        "ADMIN": {
                            "label": "Administrator",
                            "description": "Full system configuration, security, user management, and executive oversight.",
                            "modules": ["DASHBOARD", "USERS", "RBAC", "MASTER_DATA", "CUSTOMERS", "ENQUIRIES", "SURVEYS", "QUOTATIONS", "ORDERS", "INVENTORY", "DISPATCH", "INSTALLATIONS", "PASSPORTS", "WARRANTIES", "SERVICE", "AUDIT", "ANALYTICS"]
                        },
                        "SALES_EXECUTIVE": {
                            "label": "Sales Executive",
                            "description": "Customer enquiries, site survey bookings, quotations, orders, and subsidy applications.",
                            "modules": ["DASHBOARD", "CUSTOMERS", "ENQUIRIES", "SURVEYS", "QUOTATIONS", "ORDERS", "SUBSIDIES", "DOCUMENTS"],
                            "special_permissions": ["can_apply_special_discount", "can_approve_quotation", "can_override_survey"]
                        },
                        "FIELD_TECHNICIAN": {
                            "label": "Field Technician (Unified)",
                            "description": "Consolidated identity for roof survey execution, electrical testing, and plant commissioning.",
                            "modules": ["DASHBOARD", "SURVEYS", "INSTALLATIONS", "PASSPORTS", "SERVICE"],
                            "special_permissions": ["survey_execution", "installation_execution", "electrical_testing", "passport_updates"]
                        },
                        "WAREHOUSE_MANAGER": {
                            "label": "Warehouse Manager",
                            "description": "Depot inventory, BOM allocation, serial barcode scanning, and logistics dispatch.",
                            "modules": ["DASHBOARD", "INVENTORY", "BOM", "DISPATCH", "DOCUMENTS"]
                        },
                        "CUSTOMER": {
                            "label": "Customer",
                            "description": "Digital Solar Passport portal, generation verification, warranty certificates, and service ticketing.",
                            "modules": ["PASSPORT", "WARRANTY", "SERVICE_TICKETS"]
                        }
                    }
                }
            }
        ]

        added_cfg_count = 0
        for cfg in configs:
            existing = session.query(SystemConfiguration).filter(SystemConfiguration.key == cfg["key"]).first()
            if not existing:
                c_record = SystemConfiguration(
                    key=cfg["key"],
                    category=cfg["category"],
                    description=cfg["description"],
                    value_json=json.dumps(cfg["value"])
                )
                session.add(c_record)
                added_cfg_count += 1
            else:
                existing.value_json = json.dumps(cfg["value"])
                existing.description = cfg["description"]

        session.commit()
        print(f"Master Data seeded successfully! Configs added/updated: {len(configs)}")
    except Exception as e:
        session.rollback()
        print(f"Error seeding master data: {e}")
        raise e
    finally:
        session.close()

if __name__ == "__main__":
    seed_master_data()

