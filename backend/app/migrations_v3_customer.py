"""
Database Schema Migration & Customer Account Provisioning (Stage 3):
- Adds customer_id, reset_token, reset_token_expires_at to users table.
- Adds installation_address, contact_preferences to customers table.
- Creates customer_feedback table.
- Provisions canonical Customer user account linked to Customer #1 (Rajesh Sharma).
"""
import sqlite3
import os
import datetime
from app.models.user_auth import hash_password

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "sunpower.db")

def run_migrations():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Update users table
    cur.execute("PRAGMA table_info(users)")
    user_cols = [c[1] for c in cur.fetchall()]
    new_user_cols = [
        ("customer_id", "INTEGER REFERENCES customers(id) ON DELETE SET NULL"),
        ("reset_token", "VARCHAR(100)"),
        ("reset_token_expires_at", "DATETIME")
    ]
    for col_name, col_def in new_user_cols:
        if col_name not in user_cols:
            cur.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            print(f"Added column users.{col_name}")

    # 2. Update customers table
    cur.execute("PRAGMA table_info(customers)")
    cust_cols = [c[1] for c in cur.fetchall()]
    new_cust_cols = [
        ("installation_address", "TEXT"),
        ("contact_preferences", "TEXT DEFAULT '{\"preferred_channel\": \"WHATSAPP\", \"notify_sms\": true, \"notify_email\": true, \"notify_push\": true}'")
    ]
    for col_name, col_def in new_cust_cols:
        if col_name not in cust_cols:
            cur.execute(f"ALTER TABLE customers ADD COLUMN {col_name} {col_def}")
            print(f"Added column customers.{col_name}")

    # 3. Create customer_feedback table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS customer_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid VARCHAR(36) UNIQUE NOT NULL,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        installation_id INTEGER REFERENCES installations(id) ON DELETE SET NULL,
        service_ticket_id INTEGER REFERENCES service_tickets(id) ON DELETE SET NULL,
        feedback_type VARCHAR(40) NOT NULL DEFAULT 'INSTALLATION',
        rating INTEGER NOT NULL,
        category_ratings TEXT DEFAULT '{}',
        comments TEXT,
        is_verified BOOLEAN DEFAULT 1,
        created_at DATETIME NOT NULL
    );
    """)
    print("Verified customer_feedback table.")

    # 4. Provision or update demo customer account (Rajesh Sharma)
    cur.execute("SELECT id FROM users WHERE username = 'rajesh' OR email = 'rajesh.sharma@gmail.com'")
    existing = cur.fetchone()
    hashed = hash_password("Password@123")
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if not existing:
        import uuid
        user_uuid = str(uuid.uuid4())
        cur.execute("""
        INSERT INTO users (
            uuid, username, email, hashed_password, full_name, phone, role,
            capabilities, department, designation, is_active, customer_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_uuid, 'rajesh', 'rajesh.sharma@gmail.com', hashed,
            'Rajesh Sharma', '+91 98230 11223', 'CUSTOMER',
            '["CUSTOMER_PORTAL", "VIEW_OWN_PROJECTS", "MANAGE_OWN_APPOINTMENTS", "CREATE_SERVICE_TICKET", "SUBMIT_FEEDBACK", "VIEW_OWN_PASSPORT"]',
            'Customer', 'Solar Rooftop Owner', 1, 1, now_iso
        ))
        print("Provisioned customer user 'rajesh' linked to Customer 1.")
    else:
        cur.execute("""
        UPDATE users SET
            customer_id = 1,
            role = 'CUSTOMER',
            is_active = 1,
            capabilities = '["CUSTOMER_PORTAL", "VIEW_OWN_PROJECTS", "MANAGE_OWN_APPOINTMENTS", "CREATE_SERVICE_TICKET", "SUBMIT_FEEDBACK", "VIEW_OWN_PASSPORT"]'
        WHERE id = ?
        """, (existing[0],))
        print(f"Updated existing user id={existing[0]} with customer_id=1 and role=CUSTOMER.")

    # Also provision a generic 'customer' username for demo ease
    cur.execute("SELECT id FROM users WHERE username = 'customer'")
    cust_gen = cur.fetchone()
    if not cust_gen:
        import uuid
        gen_uuid = str(uuid.uuid4())
        cur.execute("""
        INSERT INTO users (
            uuid, username, email, hashed_password, full_name, phone, role,
            capabilities, department, designation, is_active, customer_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            gen_uuid, 'customer', 'customer@sunpower.com', hashed,
            'Rajesh Sharma', '+91 98230 11223', 'CUSTOMER',
            '["CUSTOMER_PORTAL", "VIEW_OWN_PROJECTS", "MANAGE_OWN_APPOINTMENTS", "CREATE_SERVICE_TICKET", "SUBMIT_FEEDBACK", "VIEW_OWN_PASSPORT"]',
            'Customer', 'Solar Rooftop Owner', 1, 1, now_iso
        ))
        print("Provisioned generic demo user 'customer' linked to Customer 1.")

    conn.commit()
    conn.close()
    print("Stage 3 Customer migration successfully completed.")

if __name__ == "__main__":
    run_migrations()

