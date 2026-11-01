# SunPower Solutions – Solar Installation Management System
## Multi-Role RBAC, Dedicated Portals, Dynamic Dashboards and Workflow Integration

SunPower Solutions is a modern, enterprise-grade Solar Engineering, Procurement, and Construction (EPC) management platform built with React (JavaScript/Vite), FastAPI (Python), and SQLite with strict relational integrity on Windows.

---

### Tech Stack
- **Frontend**: React 18, Vite, React Router v6, Lucide React icons, Native Fetch API, pure CSS enterprise design system (Deep Navy `#0f172a`, Solar Green `#10b981`, Amber `#f59e0b`).
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2.
- **Database**: SQLite with foreign key enforcement (`PRAGMA foreign_keys = ON;`).
- **Security**: Salted PBKDF2-SHA256 password hashing (100,000 iterations), HMAC-SHA256 bearer tokens with 24h expiration, backend role-based access control.
- **Precision**: Monetary figures stored as integer paise (1 INR = 100 paise) to eliminate float rounding errors.

---

### Seven User Roles, Dedicated Login Portals & Demo Accounts

All 7 operational roles have dedicated, visually distinct login portals and pre-seeded demo accounts:

| Role | Dedicated Portal URL | Email Address | Password | Role Description & Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Solar Admin** | `/login/admin` | `admin@sunpower.com` | `Password@123` | Company-wide access, staff RBAC, business config, approvals, management reporting |
| **Sales Executive** | `/login/sales` | `sales@sunpower.com` | `Password@123` | Lead qualification, customer CRM, follow-up dates, quotations, order conversions |
| **Survey Manager** | `/login/survey-manager` | `surveymgr@sunpower.com` | `Password@123` | Surveyor assignments, technical review queue, survey approvals/rejections with notes |
| **Survey Technician** | `/login/survey-technician` | `surveytech@sunpower.com` | `Password@123` | Assigned site surveys, roof area/tilt/azimuth telemetry, shading measurements |
| **Warehouse Manager** | `/login/warehouse` | `warehouse@sunpower.com` | `Password@123` | Multi-warehouse stock, BOM allocation engine, dispatches, physical barcode capture |
| **Installation Technician** | `/login/installation` | `installtech@sunpower.com` | `Password@123` | Assigned EPC installations, 8-point checklist, electrical telemetry, customer signoff |
| **Service Manager** | `/login/service` | `servicemgr@sunpower.com` | `Password@123` | Service tickets, O&M triage, technician assignment, warranty lookup & claims |

A central role portal is also available at `/login` featuring 1-click **Quick Demo Login** for instantaneous testing.

---

### Role-Scoped Dynamic Dashboards

Each role has a purpose-built, real-time dynamic dashboard backed by dedicated database aggregation endpoints:

| Role | Dashboard Route | Key Metrics & Operational Capabilities |
| :--- | :--- | :--- |
| **Solar Admin** | `/dashboard/admin` | Total customers, enquiries, quotations, orders, active installations, revenue, project profitability, inventory shortages, pending approvals, quick management links |
| **Sales Executive** | `/dashboard/sales` | Assigned enquiries, new leads, follow-ups due, overdue follow-ups, quotation conversion rate, 1-click enquiry/quotation creation |
| **Survey Manager** | `/dashboard/survey-manager` | Awaiting assignment, in progress, review queue, approved/rejected stats, technician assignment, 1-click approval/rejection modal |
| **Survey Technician** | `/dashboard/survey-technician` | My assigned surveys, today's visits, upcoming site visits, measurement & shading submission modal |
| **Warehouse Manager** | `/dashboard/warehouse` | Available stock, reserved stock, low-stock items, depot breakdown (Pune, Mumbai, Nashik), BOM allocations, dispatches |
| **Installation Technician** | `/dashboard/installation` | My assigned jobs, today's schedule, 8-point digital checklist, electrical commissioning telemetry (V, A, kW, Hz), customer signoff |
| **Service Manager** | `/dashboard/service` | Open complaints, open tickets, warranty-eligible cases, overdue tickets, technician assignment, warranty lookup & diagnosis update |

---

### Role-Specific Navigation Architecture (Module 6)

The sidebar dynamically configures navigation menus tailored strictly to the authenticated user's role:

- **SALES**: Dashboard (`/dashboard/sales`), Customers (`/customers`), Enquiries (`/enquiries`), Follow-ups (`/enquiries?tab=followups`), Quotations (`/quotations`), Orders (`/orders`).
- **SURVEY MANAGER**: Dashboard (`/dashboard/survey-manager`), Survey Assignments (`/surveys?tab=assignments`), Review Queue (`/surveys?tab=review`), Survey History (`/surveys?tab=history`).
- **SURVEY TECHNICIAN**: Dashboard (`/dashboard/survey-technician`), My Surveys (`/surveys?tab=mine`), Upcoming Visits (`/surveys?tab=upcoming`), Survey History (`/surveys?tab=history`).
- **WAREHOUSE**: Dashboard (`/dashboard/warehouse`), Inventory (`/inventory`), Warehouses (`/inventory?tab=warehouses`), Allocation (`/bom`), Dispatches (`/dispatch`), Serial Numbers (`/dispatch?tab=serials`).
- **INSTALLATION**: Dashboard (`/dashboard/installation`), My Installations (`/installations?tab=mine`), Schedule (`/installations?tab=schedule`), Installation Worksheets (`/installations?tab=worksheets`), Completed Jobs (`/installations?tab=completed`).
- **SERVICE**: Dashboard (`/dashboard/service`), Service Tickets (`/service`), Warranty Lookup (`/solar-passport`), Repairs (`/service?tab=repairs`), Service History (`/service?tab=history`).
- **ADMIN / SOLAR MANAGER**: Comprehensive access to all executive modules: Dashboard, Users & RBAC, Customers, Enquiries, Surveys, Quotations, Orders, Inventory, Products & BOM, Dispatches, Installations, PM Surya Ghar Subsidies, Passports, Warranty & Service, Credibility Hub, Reports & Analytics.

---

### End-to-End Workflow & Business Rules (Modules 7 & 8)

1. **CRM & Lead Qualification**:
   - Enquiries support sales rep assignment, lead priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), next action item, and persistent interaction history logs.
   - Filter by follow-ups due or sales representative.
2. **Site Survey Gate**:
   - Technician assignment by Survey Manager.
   - Field measurements: total/usable roof area, azimuth, tilt, shading loss percentage, structural integrity, service load.
   - **Strict RBAC Rule**: Field technicians are prohibited from self-approving their own surveys (`HTTP 403 Forbidden`). Only Survey Managers or Admins can approve.
3. **Quotation Generation**:
   - **Strict Business Rule**: Quotations can ONLY be generated from surveys that have status `APPROVED`.
   - Itemized package breakdown, PM Surya Ghar central subsidy deduction (up to ₹78,000), terms and conditions, 30-day validity.
4. **Order Conversion & Payment Tracking**:
   - Accepting a quotation atomically creates an Order with advance payment recording (20% advance contract requirement) and stage progression to `CONFIRMED`.
5. **Bill of Materials & Multi-Warehouse Allocation**:
   - Automatic BOM compilation from confirmed orders.
   - Real-time stock allocation across Pune, Mumbai, and Nashik depots with shortage detection and atomic stock reservation (`available = qty_on_hand - qty_reserved >= 0`).
6. **Dispatch & Serial Number Capture**:
   - Goods dispatch manifests with driver and vehicle assignments. Unallocated orders cannot be dispatched.
   - Unique barcode capture for physical PV modules and solar inverters. Duplicate serial numbers are blocked.
7. **8-Stage Installation Lifecycle & Digital Worksheet**:
   - Stage progression: `CONFIRMED` → `READY_FOR_DISPATCH` → `DISPATCHED` → `SCHEDULED` → `IN_PROGRESS` → `QUALITY_CHECK` → `CUSTOMER_SIGNOFF` → `COMPLETED`.
   - 8-point mandatory checklist (Mounting structure, Solar panels, Inverter, Cabling, Earthing < 5Ω, Safety SPDs, Grid sync, Customer handover).
   - Electrical telemetry: AC Voltage (V), AC Current (A), Power Output (kW), Grid Frequency (Hz), Earthing Resistance (Ω).
   - Customer sign-off capture (Signee name, 1-5 star rating, remarks, sign-off date).
   - **Strict Commissioning Gate**: Commissioning and passport generation are blocked until all 8 checklist items are completed.
8. **Digital Solar Passport & Warranties**:
   - Cryptographic QR code generation, 25-year lifetime generation forecast, carbon offset metrics, linked serial numbers, and equipment warranty policies.
   - Public read-only QR verification route at `/passport/public/:token`.
9. **O&M Service Ticketing & Warranty Lookup**:
   - Ticket management with priority triage, customer and equipment linkage, and serial-number warranty validity queries.
10. **Database-Backed In-App Notifications**:
    - Centralized notifications bell in layout topbar with unread badges, category filtering (Enquiries, Surveys, Dispatches, Installations, Service), and mark-as-read actions.

---

### API Architecture & Endpoint Reference

#### Authentication, Session Registry & RBAC (`/api/auth`)
- `POST /api/auth/login` - Authenticate user, register active database session in `user_sessions`, return signed HMAC-SHA256 bearer token with `jti` and `sid`.
- `POST /api/auth/logout` - Server-side token revocation by JTI in session registry.
- `GET /api/auth/me` - Retrieve current authenticated user profile and permissions (verifies active session).
- `GET /api/auth/permissions` - Return role permissions dictionary.
- `GET /api/auth/users` - Admin user directory (supports `?role=` filter).
- `POST /api/auth/users` - Admin create new staff user account with hashed password.
- `PATCH /api/auth/users/{id}` - Admin update staff account (role, active status); invalidates active sessions on deactivation or role change.
- `GET /api/auth/team/{role_name}` - List active personnel for a given role (e.g. `SALES_EXECUTIVE`, `SURVEY_TECHNICIAN`).

#### Role Dashboards (`/api/dashboard`)
- `GET /api/dashboard/admin` - Executive KPIs, revenue, pipeline, pending approvals.
- `GET /api/dashboard/sales` - My assigned enquiries, conversion rate, follow-up calendar.
- `GET /api/dashboard/survey-manager` - Surveyor workload, review queue, approval queue.
- `GET /api/dashboard/survey-technician` - Technician assigned visits and submission queue.
- `GET /api/dashboard/warehouse` - Warehouse stock levels, reservations, low-stock alerts.
- `GET /api/dashboard/installation` - Technician assigned jobs, worksheets, checklist progress.
- `GET /api/dashboard/service` - Service ticket backlog, priority distribution, warranty cases.

#### Core Business & Analytics Modules
- `GET /api/enquiries`, `POST /api/enquiries`, `PATCH /api/enquiries/{id}` (supports `sales_rep_id` filtering and CRM fields).
- `GET /api/surveys`, `POST /api/surveys`, `PATCH /api/surveys/{id}/assign`, `POST /api/surveys/{id}/submit`, `PATCH /api/surveys/{id}/approve`, `PATCH /api/surveys/{id}/reject`.
- `GET /api/quotations`, `POST /api/quotations`, `POST /api/quotations/{id}/accept`, `POST /api/quotations/{id}/reject`.
- `GET /api/orders`, `POST /api/orders`, `POST /api/orders/{id}/payments`.
- `GET /api/installations`, `PATCH /api/installations/{id}/checklist`, `PATCH /api/installations/{id}/stage`, `POST /api/installations/{id}/commission`, `POST /api/installations/{id}/upload-evidence`.
- `GET /api/analytics/financial`, `GET /api/analytics/operational`.
- `GET /api/analytics/installations/profitability` - Standardized installation-level contribution profitability audit under Ind AS 115 Completed-Contract Revenue Recognition.
- `GET /api/notifications`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/read-all`.
- `GET /api/subsidies`, `PATCH /api/subsidies/{id}/status`.

#### Phase 1 Integrated Features & Operations
- **Digital Solar Passports (`/api/passports`)**:
  - `GET /api/passports` - Directory listing with search across Passport #, Customer Name, City, Order #, Installation #, and Serial #.
  - `GET /api/passports/{identifier}` & `GET /api/passports/detail/{identifier}` - Comprehensive passport details containing real installed physical serialized items, active/expired warranties, service repair history, and commissioning evidence files.
  - `GET /api/passports/public/{token}` - Public unauthenticated verification endpoint for QR code scans by homeowners and third-party auditors.
- **Warranty Management (`/api/warranties`)**:
  - `GET /api/warranties` - Comprehensive warranty ledger with status filter (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `REPLACED`, `VOID`), category filter, search, and configurable expiration threshold (`expiring_days_threshold`, defaults to 90 days).
  - `GET /api/warranties/check/{serial_number}` - Live eligibility verification for serial numbers returning coverage status, policy name, days remaining, and coverage terms.
  - `POST /api/warranties/replace` - Component replacement workflow: transitions original serial number to `REPLACED` state with reason and RMA notes, automatically creates a new warranty policy for the replacement serial.
  - `GET /api/warranties/{identifier}` - Direct lookup by serial number or warranty ID.
- **Service Tickets & Repair Management (`/api/service/tickets`)**:
  - `GET /api/service/tickets` - List service tickets with filters for status, priority, customer, warranty coverage, and free-text search.
  - `POST /api/service/tickets` - Log new service ticket with automatic customer/installation inference from passport, and live warranty eligibility check.
  - `PATCH /api/service/tickets/{id}` - Full triage and repair worksheet update: technical diagnosis notes, parts replaced/used, labour hours, labour costs, warranty-covered vs chargeable toggle, customer acceptance notes, and final closure notes.
  - `PATCH /api/service/tickets/{id}/assign` - Dispatch field service technician and transition ticket to `ASSIGNED`.
- **Project Financials & Profitability (`/api/orders/{id}`)**:
  - `GET /api/orders/{id}/financials` - Comprehensive project financial summary under Ind AS 115 Completed-Contract Revenue Recognition standard: Total Contract Value, Milestone Payments Received, Outstanding Balance, Direct BOM COGS, Actual Recorded Site Expenses, Total Recorded Costs, Estimated Gross Profit and Margin %, Recognized Revenue and Handover Margin, itemized payment ledger, and itemized project expense ledger.
  - `POST /api/orders/{id}/payments` - Record milestone advance payments without double-counting; automatically updates order advance received and payment status (`PAID`, `PARTIALLY_PAID`, `PENDING`).
  - `GET /api/orders/{id}/payments` - List recorded milestone payments.
  - `POST /api/orders/{id}/expenses` - Record actual site expenses across standard categories (`LABOUR`, `TRANSPORT`, `COMPONENTS_BOS`, `PERMITS_DISCOM`, `CRANE_EQUIPMENT`, `MISCELLANEOUS`).
  - `GET /api/orders/{id}/expenses` - List recorded project expenses.
- **Multi-Warehouse Inventory Transfers (`/api/inventory/transfers`)**:
  - `GET /api/inventory/transfers` - Inter-warehouse transfer log filtered by status (`REQUESTED`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`), source/dest warehouse, or component.
  - `POST /api/inventory/transfers` - Initiate transfer request between regional depots (Pune, Mumbai, Nashik); validates distinct origin/destination, checks available stock (`qty_on_hand - qty_reserved`), and supports auto-approval.
  - `PATCH /api/inventory/transfers/{id}/approve` - Locks stock reservation at source warehouse depot (`qty_reserved += qty`).
  - `PATCH /api/inventory/transfers/{id}/dispatch` - Deducts on-hand and reserved quantity from source warehouse, records `TRANSFER_OUT` stock movement, and sets status to `IN_TRANSIT`.
  - `PATCH /api/inventory/transfers/{id}/receive` - Restocks destination warehouse depot (`qty_on_hand += qty`), records `TRANSFER_IN` stock movement, prevents duplicate receipt, and marks transfer `RECEIVED`.
  - `PATCH /api/inventory/transfers/{id}/cancel` - Releases stock reservation at origin depot if approved, and marks transfer `CANCELLED`.
  - `GET /api/inventory/transfers/{id}` - Retrieve transfer details by ID.

#### Phase 2 Integrated Features & Operations
- **Document Management (`/api/documents`)**:
  - `GET /api/documents` - List and filter repository documents by entity type (`ORDER`, `PASSPORT`, `SERVICE_TICKET`, `CUSTOMER`, `SURVEY`, `INSTALLATION`), category, search term, or entity ID.
  - `POST /api/documents/upload` - Multipart form file upload storing files under `uploads/documents/` on local disk and metadata in the SQLite `documents` table. Validates file format (.pdf, .jpg, .png, .docx, .xlsx), enforces 10MB maximum limit, sanitizes file names, and generates an audit log entry.
  - `GET /api/documents/{id}/download` - Stream downloadable file attachment with appropriate MIME headers and original filename.
  - `DELETE /api/documents/{id}` - Soft-archive or permanently delete document files with audit log trail.
- **Component Credibility Scoring (`/api/credibility`)**:
  - `GET /api/credibility` - 0–100 equipment reliability evaluation matrix based on manufacturer bankability (40%), field failure telemetry (35%), and statutory certifications (25%). Displays contributing factors, data completeness (`COMPLETE`, `PARTIAL`, `INSUFFICIENT`), and inventory recommendation labels (`PREFERRED_PROCUREMENT`, `STANDARD_APPROVED`, `CONDITIONAL_USE`, `AUDIT_REQUIRED`).
  - `POST /api/credibility/simulate` - Live interactive mathematical sandbox evaluating custom weights, tiers, failure rates, and documentation levels.
  - `PATCH /api/credibility/components/{id}` - Update component manufacturer, supplier name, supplier rating, tier grade, field failure rate %, and certification status; automatically recalculates credibility score and writes to audit logs.
- **Audit History & Compliance (`/api/audit-logs`)**:
  - `GET /api/audit-logs` - Query immutable audit trails with multi-parameter filtering (entity type, action, date range, user ID, free-text search) and pagination.
  - `GET /api/audit-logs/entity/{entity_type}/{entity_id}` - Retrieve the complete lifecycle change log for any specific business entity record.
  - `AuditService.log()` - Secure helper method that redacts sensitive credentials (passwords, tokens, secrets) from JSON snapshots and guarantees application transactions never fail due to logging.
- **Enterprise Reports & CSV Exports (`/api/analytics`)**:
  - `GET /api/analytics/reports/operational` - Real database metrics covering inbound lead conversion, survey approval rates, quotation acceptance, installation stage progression, inter-warehouse transfer status, service ticket backlogs by priority, and 90-day warranty expirations.
  - `GET /api/analytics/reports/financial` - Filterable project financial ledger (by start date, end date, customer) reporting confirmed contract values, milestone payments collected, material COGS, site expenses, estimated net profit, and Ind AS 115 recognized revenue.
  - `GET /api/analytics/reports/components` - Component quality audit report detailing credibility score distributions, incomplete supplier telemetry alerts, and warehouse depot stock allocations.
  - `GET /api/analytics/export/csv` - Direct CSV stream generation for `financial`, `operational`, `components`, and `service` reports.
- **Search, Filters, and DataTable Improvements**:
  - Universal client-side and server-side sorting (click table headers to toggle ascending/descending).
  - Page size selection (10, 25, 50, 100 rows per page) with prev/next navigation.
  - Integrated search clear button (`X`) and state reset behavior.

---

### How to Run the Application

#### 1. Backend Server
In PowerShell:
```powershell
cd "c:\life ends with this\Solar\backend"
..\venv\Scripts\python.exe run.py
```
- API Base URL: `http://127.0.0.1:8000/api`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`

#### 2. Frontend Development Server
In a second PowerShell window:
```powershell
cd "c:\life ends with this\Solar\frontend"
npm run dev
```
- Web Application: `http://127.0.0.1:5173`

---

### Summary of Completed Deliverables
- [x] **Feature 1: Digital Solar Passport** – Unique identity, customer/site data, physical installed serialized barcode components (`SerializedItem`), active & historical warranties, O&M service tickets and repair history, commissioning evidence files, searchable passport directory (`/solar-passport`) and public QR verification view (`/passport/public/:token`).
- [x] **Feature 2: Warranty Management** – Manufacturer policy registry, configurable expiration threshold (30/60/90/180 days), status engine (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `REPLACED`, `VOID`), quick serial verification tool, component replacement modal preserving original history and logging audit notes (`/warranties`).
- [x] **Feature 3: Service Tickets & Repair Worksheets** – After-sales ticket lifecycle (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `WAITING_FOR_PARTS`, `RESOLVED`, `CLOSED`), live warranty eligibility check on serials, technical diagnosis, parts used, labour hours, labour costs, warranty-covered vs chargeable toggle, customer acceptance notes, final closure notes (`/service`).
- [x] **Feature 4: Project Financials & Profitability** – Stored payment milestones, outstanding balance calculation, site expense tracking across 6 standard categories, project financial summary under Ind AS 115 Completed-Contract standard preventing interim margin distortions, direct BOM COGS vs actual site expense separation, integrated modal in Installation Orders (`/orders`).
- [x] **Feature 5: Multi-Warehouse Inventory Transfers** – Inter-depot stock transfers across Pune, Mumbai, and Nashik hubs, status lifecycle (`REQUESTED`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`), preventing invalid/negative stock, reserving stock at source depot on approval, deducting upon dispatch, restock on destination receipt, preventing double receipt, and immutable `StockMovement` logging (`/inventory?tab=transfers`).
- [x] **Feature 6: Document Management** – Unified company-wide document repository at `/documents` with local storage (`uploads/documents/`), metadata in SQLite, 10MB limits, type validation (.pdf, .jpg, .png, .docx, .xlsx), download streaming, archival, and reusable `DocumentManager` embedded in Passports, Orders, and Service Tickets.
- [x] **Feature 7: Component Credibility Scoring** – Transparent 0–100 heuristic score (Tier 40%, Failure 35%, Docs 25%), interactive sandbox simulator, score breakdown audits, data completeness flags (`COMPLETE`, `PARTIAL`, `INSUFFICIENT`) without assuming missing values are 100%, supplier telemetry tracking, and "Edit Quality Telemetry" modal (`/credibility-hub`).
- [x] **Feature 8: Audit History & Compliance** – Immutable event tracking in `audit_logs` table capturing timestamp, user ID, role, action, entity type across 14 business models, before-and-after state JSON diffs, secret/credential sanitization, and dedicated search UI (`/audit-logs`).
- [x] **Feature 9: Reports and Analytics** – Real database-driven operational EPC reporting, Ind AS 115 Completed-Contract margin ledgers with date range and customer filters, component quality/stock distribution reports, and direct CSV file exports (`/analytics`).
- [x] **Feature 10: Search, Filters, and Final UI Improvements** – Universal sortable columns, client-side pagination with rows-per-page selector, search clear buttons, and consistent Stitch-inspired layout across all 7 user roles.
- [x] **Multi-Role RBAC & Portals (Stage 2)** – 7 operational roles with dedicated login portals, dynamic role dashboards, PBKDF2-SHA256 authentication, session registry, technician self-approval prevention.
