import sys
import os
import anyio
import httpx
from sqlalchemy import text

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, SessionLocal, Base
from app.main import app


async def run_tests():
    print("=== 1. Checking Database Tables & Foreign Key Enforcement ===")
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        fk_val = conn.execute(text("PRAGMA foreign_keys;")).scalar()
        print(f"PRAGMA foreign_keys = {fk_val} (Required: 1)")
        assert fk_val == 1, "Foreign key enforcement is not active!"

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        print("\n=== 2. Testing GET /api/health ===")
        res = await client.get("/api/health")
        print(f"Status: {res.status_code}")
        data = res.json()
        print(f"Response: {data}")
        assert res.status_code == 200
        assert data["status"] == "HEALTHY"
        assert data["tables_count"] >= 15
        assert data["models_initialized"] is True

        print("\n=== 3. Testing POST /api/seed/reset ===")
        res_seed = await client.post("/api/seed/reset")
        print(f"Status: {res_seed.status_code}")
        seed_data = res_seed.json()
        print(f"Response: {seed_data}")
        assert res_seed.status_code == 200
        assert seed_data["success"] is True
        assert seed_data["counts"]["customers"] >= 4
        assert seed_data["counts"]["orders"] >= 1
        assert seed_data["counts"]["components"] >= 7
        assert seed_data["counts"]["warehouses"] >= 3

        print("\n=== 4. Testing GET /api/customers ===")
        res_cust = await client.get("/api/customers")
        print(f"Status: {res_cust.status_code}, Count: {len(res_cust.json())}")
        assert res_cust.status_code == 200
        assert len(res_cust.json()) >= 4

        print("\n=== 5. Testing GET /api/enquiries ===")
        res_enq = await client.get("/api/enquiries")
        print(f"Status: {res_enq.status_code}, Count: {len(res_enq.json())}")
        assert res_enq.status_code == 200
        assert len(res_enq.json()) >= 4

        print("\n=== 6. Testing GET /api/dashboard/summary ===")
        res_dash = await client.get("/api/dashboard/summary")
        print(f"Status: {res_dash.status_code}")
        dash_data = res_dash.json()
        print(f"Metrics: {dash_data['metrics']}")
        assert res_dash.status_code == 200
        assert dash_data["metrics"]["customers"] >= 4
        assert dash_data["metrics"]["total_contract_inr"] > 0

    print("\n[SUCCESS] ALL FOUNDATION TESTS PASSED PERFECTLY!")


if __name__ == "__main__":
    anyio.run(run_tests)
