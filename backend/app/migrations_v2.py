"""
Database Schema Migration for SunPower Solutions Stage 2.5:
Adds lifecycle tracking, warehouse dispatch provenance, and complaint evidence fields.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "sunpower.db")

def run_migrations():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Inspect digital_solar_passports columns
    cur.execute("PRAGMA table_info(digital_solar_passports)")
    dsp_cols = [c[1] for c in cur.fetchall()]

    new_dsp_cols = [
        ("lifecycle_status", "VARCHAR(50) DEFAULT 'ACTIVE'"),
        ("warehouse_id", "INTEGER REFERENCES warehouses(id) ON DELETE SET NULL"),
        ("dispatch_id", "INTEGER REFERENCES dispatches(id) ON DELETE SET NULL"),
        ("warehouse_manager_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
        ("created_at", "DATETIME"),
        ("dispatch_date", "DATETIME"),
        ("battery_summary", "TEXT"),
        ("other_components_summary", "TEXT"),
        ("installation_start_time", "DATETIME"),
        ("installation_completed_time", "DATETIME"),
        ("technical_readings", "TEXT"),
        ("customer_acknowledgement", "TEXT"),
    ]

    for col_name, col_def in new_dsp_cols:
        if col_name not in dsp_cols:
            cur.execute(f"ALTER TABLE digital_solar_passports ADD COLUMN {col_name} {col_def}")
            print(f"Added column digital_solar_passports.{col_name}")

    # 2. Inspect service_tickets columns
    cur.execute("PRAGMA table_info(service_tickets)")
    st_cols = [c[1] for c in cur.fetchall()]

    new_st_cols = [
        ("complaint_source", "VARCHAR(50) DEFAULT 'INTERNAL'"),
        ("evidence_files", "TEXT DEFAULT '[]'"),
    ]

    for col_name, col_def in new_st_cols:
        if col_name not in st_cols:
            cur.execute(f"ALTER TABLE service_tickets ADD COLUMN {col_name} {col_def}")
            print(f"Added column service_tickets.{col_name}")

    # Set existing passport (id=1) to ACTIVE if lifecycle_status is null
    cur.execute("UPDATE digital_solar_passports SET lifecycle_status = 'ACTIVE' WHERE lifecycle_status IS NULL")

    conn.commit()
    conn.close()
    print("Database migration completed successfully!")

if __name__ == "__main__":
    run_migrations()
