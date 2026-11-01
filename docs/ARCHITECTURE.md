# SunPower Solutions – Architecture Specification
## Solar Installation Management System

### 1. System Overview
**SunPower Solutions** is an enterprise-grade Solar Engineering, Procurement, and Construction (EPC) management platform engineered as a modular monolith. It coordinates the entire solar lifecycle from customer lead acquisition to long-term operations & maintenance (O&M).

```
   +-------------------------------------------------------------------------+
   |                     React 18 SPA (Vite + JavaScript)                   |
   |   - Enterprise Navy / Solar Green Theme                                 |
   |   - 14 Persistent Navigation Modules                                    |
   |   - Native Fetch API Client with Centralized Error Handling             |
   +------------------------------------+------------------------------------+
                                        |  REST over HTTP (JSON)
                                        v
   +-------------------------------------------------------------------------+
   |                        FastAPI Modular Monolith                         |
   |   - Centralized CORS and Exception Handling                             |
   |   - Routers: Health, Seed, Dashboard, Customers, Enquiries              |
   |   - Pydantic v2 Serialization & Request Validation                      |
   +------------------------------------+------------------------------------+
                                        |  SQLAlchemy 2.0 ORM
                                        v
   +-------------------------------------------------------------------------+
   |                        SQLite Relational Database                       |
   |   - PRAGMA foreign_keys = ON (Strict Referential Integrity)             |
   |   - 22 Relational Tables with Explicit Foreign Keys & UUIDs             |
   |   - Monetary precision stored in Integer Paise                          |
   +-------------------------------------------------------------------------+
```

---

### 2. Core Business Workflow
The application is strictly organized around the 12-stage Solar EPC delivery lifecycle:

1. **Customer Enquiry**: Inbound property owner or commercial inquiry with requested capacity (kW), roof type, and avg electric bill.
2. **Site Survey**: On-site technician roof measurement, azimuth, tilt angle, shading analysis, and usable area computation.
3. **Quotation & Proposal**: Automated system sizing, module/inverter pairing, PM Surya Ghar national subsidy deduction, and payback period calculation.
4. **Order Confirmation**: Formal commercial contract sign-off, advance payment collection, and project staging.
5. **Bill of Materials (BOM)**: Engineering derivation of components, including solar panels, inverters, racking structures, cabling, and BOS.
6. **Multi-Warehouse Allocation**: Algorithmic inventory reservation across regional warehouses (Pune, Mumbai, Nashik) to minimize transport transit times.
7. **Warehouse Dispatch**: Goods egress manifest, transport vehicle tracking, and driver assignment.
8. **Serial Number Capture**: High-accuracy barcode scanning and serial association for panels and inverters.
9. **Installation & Commissioning**: Field execution checklist, earthing resistance testing, grid sync, and net meter synchronization.
10. **Digital Solar Passport**: Cryptographically signed digital identity token for the site linking verified component serials, lifetime generation projections, and CO2 offset.
11. **Warranties**: Multi-tier equipment and workmanship warranty schedules.
12. **Service & O&M Tickets**: Post-handover customer ticketing, preventive maintenance triage, and technician dispatch.

---

### 3. Backend Architecture
- **Framework**: FastAPI (Python 3.10+) with async request handling.
- **ORM**: SQLAlchemy 2.0 declarative models with cascading deletes and relationship back-references.
- **Database Engine**: SQLite with explicit `PRAGMA foreign_keys=ON;` listener on connection.
- **Database Path**: Environment-independent relative resolution (`backend/sunpower.db`), ensuring reliable startup whether launched from repository root or the `backend` folder.
- **Monetary Unit**: All monetary fields (`gross_amount_paise`, `total_contract_paise`, etc.) are stored as integers representing **paise** (1 INR = 100 paise) to eliminate floating-point rounding errors.
- **Identifiers**: Sequential integer IDs are used for internal foreign key joins; 36-character UUID strings are generated for external exposure and API tokens.

---

### 4. Frontend Architecture
- **Framework**: React 18 with Vite.
- **Routing**: `react-router-dom` v6 with persistent layout and topbar breadcrumbs.
- **Styling**: Standard CSS with custom design tokens adhering to enterprise aesthetic (Deep navy `#0f172a`, solar green `#10b981`, and subtle amber `#f59e0b`).
- **Icons**: `lucide-react`.
- **API Communication**: Native Fetch API wrapped in `src/services/api.js` with structured error propagation and automatic JSON parsing.


---

### 5. Stage 3: Product Catalogue, BOM & Multi-Warehouse Allocation Engine

#### A. Component Credibility Evaluation Engine
- Every component in the catalog maintains an objective **Credibility Score (0-100)** computed from manufacturer tiering (`TIER_1` bankable vs `TIER_2` standard), historical failure rate percentages, official BIS/IEC compliance certification status, and documentation audit state.
- Components are indexed by category (Solar Panels, Inverters, Mounting Structures, Batteries, Cables, Protection Devices, and Balance of System accessories).

#### B. Predefined Solar Packages
- Pre-configured turnkey kits:
  - 3 kW On-Grid Residential Rooftop
  - 5 kW On-Grid Standard Home
  - 10 kW On-Grid Commercial Small Biz
  - 3 kW Off-Grid Rural Solar Backup
  - 5 kW Off-Grid Farmhouse & Microgrid
- Each package bundles exact component bill of materials, system capacity (kW), and pricing.

#### C. Engineering Bill of Materials (BOM) Derivation
- When an order is confirmed, the system derives an itemized engineering BOM linking module wattages, string quantities, inverter capacity, rail lengths, and cable runs.
- Duplicate prevention guarantees an order cannot spawn multiple redundant BOMs.

#### D. Intelligent Multi-Warehouse Allocation Algorithm (Key USP)
1. **Demand Evaluation**: Retrieves complete list of BOM line items and required quantities.
2. **Stock Availability Check**: Queries live warehouse stocks across regional depots (`Pune Central`, `Mumbai Port`, `Nashik Depot`), calculating net available stock strictly as:
   $$\text{Available Stock} = \text{Quantity On Hand} - \text{Quantity Reserved}$$
3. **Priority Ordering**: Prioritizes the user-selected or primary depot (e.g., Pune Central Hub) to minimize split dispatches.
4. **Split Sourcing**: If the primary depot has insufficient stock for a component, it takes 100% of available units from the primary depot, and pulls the remaining deficit from secondary depots.
5. **Shortage Detection & All-or-Nothing Safety**:
   - If total available stock across all depots is less than the required quantity for any item, a shortage is reported.
   - The engine **blocks partial reservation** unless `allow_partial=True` is explicitly confirmed by the operator.
6. **Transactional Commitment**: Simulates the plan first in memory. Once validated, atomically commits the reservations (`qty_reserved += allocated`), generates `BOMAllocation` records, and records an immutable audit log in `StockMovement`.

---

### 6. Stage 4: Installation Lifecycle, Digital Solar Passport & Warranty Architecture

#### A. Dispatch & Serial Number Tracking
- Dispatches (`Dispatch`) link allocated customer orders with source warehouse hubs and logistics freight vehicles.
- **Precondition Guard**: An order cannot be dispatched unless it has confirmed allocated inventory.
- Physical components (`SerializedItem`) are recorded with unique serial numbers, barcode formats (`CODE128`, `QR_CODE`), warehouse references, and lifecycle tracking (`IN_TRANSIT` -> `DELIVERED` -> `INSTALLED`).
- Database uniqueness guarantees that a physical component cannot be double-scanned or assigned to multiple dispatches.

#### B. Installation & Commissioning Quality Checklist Gate
- Field installations (`Installation`) track certified lead engineers, crew sizes, and site physical addresses.
- **Persistent 8-Point Commissioning Checklist**:
  1. Mounting structure installed & torqued
  2. Solar panels installed & aligned
  3. Inverter installed & mounted
  4. Electrical connections completed
  5. Earthing completed & tested (< 5Ω)
  6. Safety checks completed
  7. System tested & grid synchronized
  8. Customer handover & briefing completed
- **Hard Commissioning Gate**: Calling `/installations/{id}/commission` strictly checks that all 8 checklist booleans are `True`. If any item is unverified, the transaction aborts with HTTP 400.

#### C. Local Installation Evidence & File Security
- Site photos and earthing test documents are uploaded via FastAPI `UploadFile`.
- Files are stored under `backend/uploads/` with sanitized timestamped UUID filenames (`evid_{id}_{uuid}_{clean_name}.jpg`).
- Path traversal attacks (`../`) are systematically prevented.
- File size is capped at 5 MB and MIME types are whitelisted (`JPG`, `PNG`, `WEBP`, `PDF`).

#### D. Digital Solar Passport (Key Product Feature)
- Unique digital certificate (`DigitalSolarPassport`) generated upon successful commissioning.
- Contains:
  - Unique passport ID (e.g. `DSP-2026-0001`).
  - Cryptographically random lookup token (`secrets.token_urlsafe(32)`).
  - Embedded pure SVG QR code pointing to the public verification URL.
  - Sizing parameters, grid architecture, 25-year lifetime generation (MWh), and CO2 offset tonnes.
  - **Actual physical serial numbers** for modules, inverters, and meters.
  - Equipment and workmanship warranties with start dates accurately linked to goods delivery.
- **Public Lookup Security**:
  - `GET /api/passports/public/{token}` validates the token.
  - Returns a sanitized view displaying the verified technical asset credentials while withholding sensitive consumer phone numbers and financial details.

#### E. Service & Operations & Maintenance (O&M)
- Post-handover ticketing (`ServiceTicket`) categorized by technical discipline (`INVERTER_FAULT`, `PANEL_DAMAGE`, `GRID_TRIP`, `GENERATION_DROP`, `GENERAL_QUERY`).
- Ticket lifecycle states: `OPEN` -> `ASSIGNED` -> `RESOLVED` -> `CLOSED`.
- Serial-number-based warranty lookup (`/api/warranties/{serial_number}`) allows instant lookup of manufacturer policy duration and remaining days of coverage.

---

### 7. Phase 2: Multi-Role Authentication, RBAC Portals & Dynamic Dashboards

#### A. Centralized RBAC Security Model
- **Token Signing**: Standard-library cryptographic HMAC-SHA256 signed bearer tokens with 7-day expiration and tamper resistance.
- **Password Security**: Salted PBKDF2-SHA256 password hashing with 100,000 iterations via Python's standard `hashlib`.
- **Backend Dependency Guard**: `require_roles(["ROLE_A", "ROLE_B"])` strictly enforces HTTP 401 unauthenticated and HTTP 403 unauthorized access across all endpoints.
- **Hard Self-Approval Block**: Survey technicians are cryptographically and logically prohibited from approving their own surveys (`HTTP 403 Forbidden`). Only a Survey Manager or Solar Admin can approve site surveys.

#### B. The 7 Documented Enterprise Roles & Demo Credentials
| Role | Portal URL | Seed Email | Password | Full Name & Designation |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | `/login/admin` | `admin@sunpower.com` | `Password@123` | Vikram Malhotra (General Manager) |
| **SALES_EXECUTIVE** | `/login/sales` | `sales@sunpower.com` | `Password@123` | Rahul Deshmukh (Senior Sales Rep) |
| **SURVEY_MANAGER** | `/login/survey-manager` | `surveymgr@sunpower.com` | `Password@123` | Suresh Patil (Survey & Design Lead) |
| **SURVEY_TECHNICIAN** | `/login/survey-technician` | `surveytech@sunpower.com` | `Password@123` | Nilesh Shinde (Field Survey Tech) |
| **WAREHOUSE_MANAGER** | `/login/warehouse` | `warehouse@sunpower.com` | `Password@123` | Manoj Gokhale (Warehouse Ops Head) |
| **INSTALLATION_TECHNICIAN** | `/login/installation` | `installtech@sunpower.com` | `Password@123` | Deepak Chavan (Lead Installation Engineer) |
| **SERVICE_MANAGER** | `/login/service` | `servicemgr@sunpower.com` | `Password@123` | Arun Kulkarni (O&M Service Manager) |

#### C. Seven Tailored Dynamic Dashboards
1. **Admin / Solar Manager Dashboard** (`GET /api/dashboard/admin`): Company-wide recognized revenue, advance collections, contribution margins, conversion funnel, and subsidy summaries.
2. **Sales Executive Dashboard** (`GET /api/dashboard/sales`): CRM pipeline throughput, follow-ups due today/overdue, high-priority leads, and active quotations.
3. **Survey Manager Dashboard** (`GET /api/dashboard/survey-manager`): Site surveys awaiting review gate, surveyor workloads, and one-click technical sign-offs.
4. **Survey Technician Dashboard** (`GET /api/dashboard/survey-technician`): Assigned rooftop survey jobs, digital measurements submission, and azimuth validation.
5. **Warehouse Manager Dashboard** (`GET /api/dashboard/warehouse`): Multi-depot stocks (Pune, Mumbai, Nashik), BOM reservations, reorder alerts, and vehicle staging.
6. **Installation Technician Dashboard** (`GET /api/dashboard/installation`): Job assignments, digital commissioning worksheet with voltage/current/kW/Hz readings, 8-point checklist, and customer sign-off.
7. **Service Manager Dashboard** (`GET /api/dashboard/service`): Live breakdown ticketing, warranty validity checks, repair diagnostics, and parts usage.

#### D. Phase 2 Core Extended Modules
- **Module 9: PM Surya Ghar Subsidy Management** (`/subsidies`): Tracks MNRE applications through `DRAFT` -> `SUBMITTED` -> `INSPECTION_CLEARED` -> `APPROVED` -> `DISBURSED` / `REJECTED` with inspector sign-offs and DBT reference tracking.
- **Module 10: Installation-Level Profitability Analytics** (`/analytics`): Calculates real contribution profit and margin percentage per project:
  $$\text{Contribution Profit} = \text{Recognized Revenue} - \text{Material COGS} - \text{Technician Labour} - \text{Direct Expenses}$$
- **Module 11: Real-Time In-App Notifications** (`/notifications`): Header bell drawer alerting users on lead assignments, survey reviews, low stock warnings, and warranty events.

