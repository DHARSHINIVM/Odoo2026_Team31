# SunPower Solutions – API Contract Specification
## REST API Endpoints (Base URL: `http://127.0.0.1:8000/api`)

---

### 1. System & Seed Endpoints

#### `GET /api/health`
- **Description**: Verifies API operational status, SQLite connection, PRAGMA foreign keys, and count of initialized tables.
- **Response `200 OK`**:
```json
{
  "status": "HEALTHY",
  "app_name": "SunPower Solutions – Solar Installation Management System",
  "version": "1.0.0-stage1",
  "database": "SQLite (foreign_keys=ON)",
  "tables_count": 22,
  "models_initialized": true,
  "timestamp": "2026-10-31T13:13:55.123456"
}
```

#### `POST /api/seed/reset`
- **Description**: Recreates and re-seeds the entire database with realistic demonstration data across all 12 EPC stages.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Successfully re-seeded SunPower Solutions with realistic end-to-end solar dataset.",
  "counts": {
    "customers": 4,
    "enquiries": 4,
    "site_surveys": 2,
    "components": 7,
    "packages": 2,
    "quotations": 1,
    "orders": 1,
    "warehouses": 3,
    "stocks": 15,
    "boms": 1,
    "dispatches": 1,
    "serialized_items": 6,
    "installations": 1,
    "passports": 1,
    "warranties": 3,
    "service_tickets": 1,
    "payments": 2,
    "expenses": 2
  },
  "timestamp": "2026-10-31T13:13:55.789012"
}
```

---

### 2. Dashboard Endpoints

#### `GET /api/dashboard` (or `GET /api/dashboard/summary`)
- **Description**: Returns live aggregated operational metrics and recent confirmed orders.
- **Response `200 OK`**:
```json
{
  "metrics": {
    "total_customers": 5,
    "new_enquiries": 1,
    "total_enquiries": 5,
    "pending_surveys": 1,
    "quotations_awaiting": 1,
    "total_quotations": 2,
    "confirmed_orders": 2,
    "total_confirmed_contract_inr": 454000.0,
    "avg_component_credibility": 94.9
  },
  "recent_orders": [
    {
      "id": 2,
      "order_number": "ORD-2026-002",
      "customer_name": "Nitin Gadre",
      "contract_inr": 242000.0,
      "stage": "CONFIRMED",
      "payment_status": "PARTIAL",
      "created_at": "2026-10-31"
    }
  ]
}
```

---

### 3. Customer Management Endpoints

#### `GET /api/customers`
- **Query Parameters**: `search`, `city`, `skip`, `limit`
- **Response `200 OK`**: Array of `CustomerOut` objects with linked counts (`enquiries_count`, `orders_count`).

#### `POST /api/customers`
- **Request Body**:
```json
{
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
```
- **Response `201 Created`**: Created customer record.

#### `GET /api/customers/{id}`
- **Response `200 OK`**: Single customer profile.

#### `PATCH /api/customers/{id}`
- **Request Body**: Partial customer fields.
- **Response `200 OK`**: Updated customer.

#### `DELETE /api/customers/{id}`
- **Behavior**: Verifies relational integrity. Returns HTTP 400 if customer has active orders or accepted quotations.

---

### 4. Enquiry Management Endpoints

#### `GET /api/enquiries`
- **Query Parameters**: `status` (`ALL`, `NEW`, `SURVEY_SCHEDULED`, `SURVEY_COMPLETED`, `QUOTED`, `ORDER_PLACED`, `REJECTED`), `search`, `skip`, `limit`.
- **Response `200 OK`**: Array of `EnquiryOut` records with customer details and survey/quotation status flags.

#### `POST /api/enquiries`
- **Request Body**:
```json
{
  "customer_id": 1,
  "required_capacity_kw": 6.0,
  "property_type": "Residential",
  "roof_type": "RCC Flat",
  "grid_type": "ON_GRID",
  "budget_paise": 35000000,
  "notes": "Looking for Waaree bifacial modules."
}
```
- **Response `201 Created`**: Returns enquiry with assigned `ENQ-2026-XXX`.

#### `PATCH /api/enquiries/{id}/status`
- **Request Body**: `{"status": "SURVEY_SCHEDULED"}`
- **Response `200 OK`**: Updated enquiry.

#### `POST /api/enquiries/{id}/schedule-survey`
- **Request Body**:
```json
{
  "surveyor_name": "Rohan Deshmukh",
  "notes": "Inspect parapet wall and meter distance."
}
```
- **Behavior**: Transitions enquiry status to `SURVEY_SCHEDULED`, creates linked `SiteSurvey` in `SCHEDULED` status.
- **Response `201 Created`**: Created `SiteSurveyOut`.

---

### 5. Site Survey Endpoints

#### `GET /api/surveys`
- **Query Parameters**: `status` (`ALL`, `SCHEDULED`, `IN_PROGRESS`, `APPROVED`, `REJECTED`), `skip`, `limit`.
- **Response `200 OK`**: Array of `SiteSurveyOut` objects.

#### `POST /api/surveys`
- **Request Body**:
```json
{
  "enquiry_id": 1,
  "surveyor_name": "Sanjay Gaikwad",
  "roof_area_sqft": 850.0,
  "usable_roof_area_sqft": 640.0,
  "roof_type": "RCC Flat",
  "roof_azimuth_deg": 180.0,
  "tilt_angle_deg": 15.0,
  "shading_loss_pct": 3.2,
  "structural_integrity": "EXCELLENT",
  "recommended_capacity_kw": 5.5,
  "structure_recommendation": "Elevated HDG Structure (80 Micron)",
  "meter_type": "THREE_PHASE",
  "inverter_distance_meters": 10.0,
  "notes": "Sturdy foundation with clear southern exposure."
}
```
- **Behavior**: Creates survey in `APPROVED` status, advances enquiry status to `SURVEY_COMPLETED`.
- **Response `201 Created`**: Created `SiteSurveyOut`.

#### `PATCH /api/surveys/{id}/approve`
- **Behavior**: Sets survey status to `APPROVED`, enables quotation generation.
- **Response `200 OK`**: Updated survey.

#### `PATCH /api/surveys/{id}/reject`
- **Behavior**: Sets survey status to `REJECTED`, marks linked enquiry as `REJECTED`.
- **Response `200 OK`**: Updated survey.

---

### 6. Quotation Endpoints

#### `GET /api/quotations`
- **Query Parameters**: `status` (`ALL`, `DRAFT`, `SHARED`, `ACCEPTED`, `REJECTED`), `skip`, `limit`.
- **Response `200 OK`**: Array of quotations with customer info, equipment items, and order reference.

#### `POST /api/quotations`
- **BUSINESS RULE VALIDATION**: Verifies `survey_id` is provided AND `survey.status == "APPROVED"`. If not approved, returns `400 Bad Request`.
- **Request Body**:
```json
{
  "enquiry_id": 1,
  "survey_id": 1,
  "system_capacity_kw": 6.0,
  "gross_amount_paise": 33000000,
  "subsidy_amount_paise": 7800000,
  "discount_paise": 1000000,
  "tax_amount_paise": 0,
  "net_amount_paise": 24200000,
  "estimated_annual_units_kwh": 9000.0,
  "estimated_payback_years": 3.7,
  "validity_days": 30,
  "notes": "Includes 11 Waaree bifacial panels and Sungrow inverter.",
  "items": [
    {
      "item_description": "Waaree 550W Bifacial Dual-Glass PV Modules (11 units)",
      "quantity": 11,
      "unit_price_paise": 1250000,
      "total_price_paise": 13750000
    }
  ]
}
```
- **Response `201 Created`**: Created `QuotationOut` with assigned `QT-2026-XXX`.

#### `POST /api/quotations/{id}/accept`
- **Behavior**:
  - Sets quotation status to `ACCEPTED`.
  - Converts quotation into an official `Order` (`ORD-2026-XXX`).
  - Records contract value (`net_amount_paise`), calculates advance payment (20%), sets stage to `CONFIRMED`.
  - Advances enquiry status to `ORDER_PLACED`.
  - **Duplicate Prevention**: If an order already exists for this quotation, returns existing order without creating a duplicate.
- **Response `200 OK`**: Created/existing `OrderOut`.

#### `POST /api/quotations/{id}/reject`
- **Response `200 OK`**: Updated quotation with status `REJECTED`.

---

### 7. Order Endpoints

#### `GET /api/orders`
- **Query Parameters**: `stage` (`ALL`, `CONFIRMED`, `BOM_GENERATED`, `INVENTORY_ALLOCATED`, `DISPATCHED`, `COMMISSIONED`), `skip`, `limit`.
- **Response `200 OK`**: Array of confirmed `OrderOut` objects.

#### `GET /api/orders/{id}`
- **Response `200 OK`**: Single order file with linked quotation, enquiry, and customer information.

---

### 8. Products & Components Endpoints (Stage 3)

#### `GET /api/products` (and `GET /api/components`)
- **Query Parameters**: `category` (`SOLAR_PANEL`, `INVERTER`, `MOUNTING_STRUCTURE`, `BATTERY`, `CABLES`, `PROTECTION`, `ACCESSORIES`), `tier` (`TIER_1`, `TIER_2`, `TIER_3`), `search`.
- **Response `200 OK`**: Array of `ComponentOut` items sorted by credibility score.

#### `POST /api/products` (and `POST /api/components`)
- **Request Body**:
```json
{
  "sku": "SP-SKU-9901",
  "name": "Waaree 540W Mono PERC Bifacial Solar Panel",
  "manufacturer": "Waaree Energies",
  "model_number": "WSMD-540",
  "category": "SOLAR_PANEL",
  "rating_capacity": "540W",
  "unit_cost_paise": 1050000,
  "unit_price_paise": 1250000,
  "tier_grade": "TIER_1",
  "failure_rate_pct": 0.25,
  "credibility_score": 96,
  "certification_status": "BIS / IEC 61215 Certified",
  "documentation_status": "Datasheet & Warranty Verified",
  "warranty_years": 25,
  "description": "High-efficiency bifacial panel with dual glass architecture."
}
```
- **Response `201 Created`**: Created `ComponentOut`.

#### `PATCH /api/products/{id}`
- **Request Body**: Partial dictionary of fields to update.
- **Response `200 OK`**: Updated `ComponentOut`.

---

### 9. Solar Packages Endpoints (Stage 3)

#### `GET /api/packages`
- **Response `200 OK`**: Array of turnkey `PackageOut` packages with bundled items and pricing.

#### `POST /api/packages`
- **Request Body**:
```json
{
  "code": "PKG-5KW-ONGRID",
  "name": "5 kW On-Grid Standard Home Solar",
  "capacity_kw": 5.0,
  "grid_type": "ON_GRID",
  "base_price_paise": 29500000,
  "description": "Standard 5 kW solar installation with Tier-1 bifacial panels.",
  "items": []
}
```
- **Response `201 Created`**: Created `PackageOut`.

---

### 10. Multi-Warehouse Inventory Endpoints (Stage 3)

#### `GET /api/warehouses`
- **Response `200 OK`**: List of regional warehouses (`Pune Central`, `Mumbai Port`, `Nashik Depot`).

#### `POST /api/warehouses`
- **Request Body**: Warehouse metadata (code, name, city, state, manager_name, contact_phone, is_primary).
- **Response `201 Created`**: Created warehouse record.

#### `GET /api/inventory`
- **Query Parameters**: `warehouse_id`, `category`, `low_stock_only` (`true`/`false`).
- **Response `200 OK`**: Array of inventory records with on-hand, reserved, available (`qty_on_hand - qty_reserved`), and `is_low_stock` boolean.

#### `POST /api/inventory/adjustments`
- **BUSINESS RULE VALIDATION**: Ensures `new_on_hand - qty_reserved >= 0`. Rejects any adjustment resulting in negative available stock with `400 Bad Request`.
- **Request Body**:
```json
{
  "warehouse_id": 1,
  "component_id": 2,
  "quantity_change": 15,
  "notes": "Direct supplier restock received at Pune central hub"
}
```
- **Response `200 OK`**: Stock balance after adjustment and low stock alert status.

#### `GET /api/inventory/movements`
- **Response `200 OK`**: Chronological audit trail of all manual adjustments and order reservations.

---

### 11. Order BOM & Intelligent Multi-Warehouse Allocation Endpoints (Stage 3)

#### `POST /api/orders/{order_id}/generate-bom`
- **Behavior**:
  - Derives required component quantities from the accepted solar package or system capacity.
  - Generates itemized BOM with panels, inverters, structures, cables, net meter, and protection BOS items.
  - Updates order stage to `BOM_GENERATED`.
  - **Duplicate Prevention**: If BOM already exists, returns existing BOM safely without duplicates.
- **Response `200 OK`**: Generated BOM with list of line items, estimated material cost, and status.

#### `GET /api/orders/{order_id}/bom`
- **Response `200 OK`**: BOM details with items, required vs allocated quantities, unit costs, and warehouse allocations.

#### `GET /api/orders/{order_id}/allocation-simulation`
- **Query Parameters**: `preferred_warehouse_id` (optional).
- **Behavior**: Simulates multi-warehouse sourcing in memory without altering database stock. Slices requirement from preferred depot first, draws remainder from secondary depots, and flags any shortages.
- **Response `200 OK`**:
```json
{
  "order_id": 2,
  "order_number": "ORD-2026-002",
  "bom_id": 2,
  "bom_number": "BOM-2026-002",
  "preferred_warehouse_id": 1,
  "preferred_warehouse_name": "Pune Central Logistics & Fulfillment",
  "overall_status": "FULL_ALLOCATION_POSSIBLE",
  "has_shortages": false,
  "items_breakdown": [
    {
      "bom_item_id": 7,
      "component_name": "Waaree Bi-550 Bifacial Dual Glass",
      "sku": "PV-MOD-550W-WAAREE",
      "category": "PANEL",
      "quantity_required": 11,
      "allocations": [
        { "warehouse_id": 1, "warehouse_name": "Pune Central", "quantity_allocated": 10 },
        { "warehouse_id": 2, "warehouse_name": "Mumbai Port Hub", "quantity_allocated": 1 }
      ],
      "total_allocated_across_warehouses": 11,
      "shortage_quantity": 0,
      "status": "ALLOCATED"
    }
  ]
}
```

#### `POST /api/orders/{order_id}/allocate-inventory`
- **Request Body**:
```json
{
  "preferred_warehouse_id": 1,
  "allow_partial": false
}
```
- **Behavior**:
  - Verifies stock availability atomically across warehouses.
  - If shortage detected and `allow_partial == false`, rejects allocation with `400 Bad Request` and reserves 0 units.
  - If valid, commits stock reservations transactionally (`qty_reserved += allocated`), inserts `BOMAllocation` records, logs `ORDER_RESERVATION` stock movements, and transitions Order stage to `INVENTORY_ALLOCATED`.
- **Response `200 OK`**: Allocation success summary, updated order stage, and allocation manifest.

---

### 12. Warehouse Dispatch & Serial Number Tracking Endpoints (Stage 4)

#### `GET /api/dispatches`
- **Query Parameters**: `order_id`, `status` (`ALL`, `PREPARING`, `DISPATCHED`, `IN_TRANSIT`, `DELIVERED`, `RETURNED`).
- **Response `200 OK`**: Array of `DispatchOut` objects with vehicle, driver, and captured serials count.

#### `POST /api/dispatches`
- **BUSINESS RULE VALIDATION**: Verifies `order` has an itemized BOM and allocated inventory (`order.stage in ["INVENTORY_ALLOCATED", "DISPATCHED"]` or `bom.allocations` exist). Unallocated orders are rejected with `400 Bad Request`.
- **Request Body**:
```json
{
  "order_id": 2,
  "vehicle_number": "MH-12-SP-9912",
  "driver_name": "Mahesh Gaikwad",
  "driver_phone": "+91 98220 99441",
  "notes": "Express delivery for Koregaon Park villa rooftop project."
}
```
- **Response `201 Created`**: Created `DispatchOut` with auto-assigned `DSP-2026-XXX` and order transitioned to `DISPATCHED`.

#### `POST /api/dispatches/{id}/capture-serials`
- **BUSINESS RULE VALIDATION**: Validates physical serial uniqueness across the entire system. Duplicate serial numbers are blocked with `400 Bad Request`.
- **Request Body**:
```json
{
  "serials": [
    {
      "component_id": 3,
      "serial_number": "SNG-5K-2026-V9921",
      "barcode_format": "CODE128"
    },
    {
      "component_id": 1,
      "serial_number": "WRE-550-2026V-001",
      "barcode_format": "CODE128"
    }
  ]
}
```
- **Response `200 OK`**: Captured and verified counts.

#### `PATCH /api/dispatches/{id}/deliver`
- **Behavior**: Marks dispatch as `DELIVERED`, records actual delivery timestamp, sets serialized items to `DELIVERED`, and auto-schedules the initial `Installation` record.
- **Response `200 OK`**: Delivery confirmation.

---

### 13. Installation & Commissioning Checklist Endpoints (Stage 4)

#### `GET /api/installations`
- **Query Parameters**: `status` (`ALL`, `SCHEDULED`, `IN_PROGRESS`, `INSTALLED`, `COMMISSIONED`), `order_id`.
- **Response `200 OK`**: Array of `InstallationOut` objects with 8-point checklist states and technician details.

#### `GET /api/installations/{id}`
- **Response `200 OK`**: Installation file with technical measurements, evidence files, and passport reference.

#### `PATCH /api/installations/{id}/checklist`
- **Behavior**: Persistently updates any of the 8 mandatory checklist milestones, earthing resistance, peak power tested, or field notes.
- **Request Body**:
```json
{
  "chk_structure_installed": true,
  "chk_panels_installed": true,
  "chk_inverter_installed": true,
  "chk_electrical_completed": true,
  "chk_earthing_completed": true,
  "chk_safety_checks_completed": true,
  "chk_system_tested": true,
  "chk_customer_handover_completed": true,
  "earthing_resistance_ohms": 1.95,
  "peak_power_tested_kw": 5.12,
  "grid_sync_successful": true
}
```
- **Response `200 OK`**: Updated `InstallationOut`.

#### `POST /api/installations/{id}/upload-evidence`
- **Behavior**: Accepts multipart file upload (`file: UploadFile`, `description: str`). Validates file format (`.jpg`, `.png`, `.webp`, `.pdf`) and file size (`<= 5 MB`). Generates safe UUID filenames inside `backend/uploads/` to prevent directory traversal.
- **Response `200 OK`**: File record with local URL and metadata.

#### `POST /api/installations/{id}/commission`
- **BUSINESS RULE VALIDATION**: Strictly blocked if ANY of the 8 mandatory commissioning checklist items is incomplete. Returns `400 Bad Request` specifying missing checklist items.
- **Behavior on Success**: Sets status to `COMMISSIONED`, commissions the grid connection, and auto-generates the `DigitalSolarPassport` with actual physical serial numbers and equipment warranties.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Installation INST-2026-002 successfully COMMISSIONED. Digital Solar Passport DSP-2026-0002 generated.",
  "installation_number": "INST-2026-002",
  "commissioning_date": "2026-10-31T13:56:11",
  "passport_number": "DSP-2026-0002",
  "qr_code_token": "Q4qrzht8m-jUqs3eRHAvXc7TFGm_blKfCXr4T5HsFZI",
  "public_lookup_url": "/passport/public/Q4qrzht8m-jUqs3eRHAvXc7TFGm_blKfCXr4T5HsFZI",
  "warranties_created": 6
}
```

---

### 14. Digital Solar Passport & Warranty Endpoints (Stage 4)

#### `GET /api/passports/{order_id}`
- **Response `200 OK`**: Complete Digital Solar Passport including embedded pure SVG QR code, 25-year lifetime clean energy yield (MWh), lifetime carbon offset (Tonnes CO2), verified physical component serial numbers, manufacturer warranties, and installation evidence files.

#### `GET /api/passports/public/{token}`
- **Security Guardrail**: Public verification endpoint designed for QR code scanning. Validates random token; sanitizes customer contact numbers and billing records, while verifying authentic system capacity, commissioning date, physical hardware serial numbers, and active warranty terms.
- **Response `200 OK`**: `PublicSolarPassportOut`.

#### `GET /api/warranties/{serial_number}`
- **Behavior**: Queries equipment warranty status by physical component serial number. Warranty start date accurately reflects actual goods delivery date.
- **Response `200 OK`**: Active warranty policy, duration in years, start/end dates, days remaining, and linked passport certificate.

---

### 15. Service & O&M Management Endpoints (Stage 4)

#### `GET /api/service/tickets`
- **Query Parameters**: `status` (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), `priority`, `customer_id`.
- **Response `200 OK`**: List of service tickets.

#### `POST /api/service/tickets`
- **Request Body**:
```json
{
  "customer_id": 1,
  "passport_id": 1,
  "serial_number": "SNG-5K-2026-90412",
  "issue_category": "GENERAL_QUERY",
  "priority": "LOW",
  "description": "Customer requested walkthrough on mobile app Wi-Fi pairing.",
  "assigned_technician": "Amit Jadhav"
}
```
- **Response `201 Created`**: Created `ServiceTicketOut` with assigned `TCK-2026-XXX`.

#### `PATCH /api/service/tickets/{id}`
- **Request Body**: Update status (`RESOLVED`), resolution notes, technician.
- **Response `200 OK`**: Updated ticket record with `resolved_at` timestamp.
