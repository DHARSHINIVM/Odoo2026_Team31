import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field


# ==========================================
# CUSTOMER SCHEMAS
# ==========================================
class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: str
    city: str
    state: str = "Maharashtra"
    pincode: str
    consumer_number: Optional[str] = None
    avg_monthly_bill_paise: int = 0
    sanctioned_load_kw: float = 0.0


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    consumer_number: Optional[str] = None
    avg_monthly_bill_paise: Optional[int] = None
    sanctioned_load_kw: Optional[float] = None


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    created_at: datetime.datetime
    enquiries_count: int = 0
    orders_count: int = 0


# ==========================================
# ENQUIRY SCHEMAS
# ==========================================
class EnquiryBase(BaseModel):
    customer_id: int
    required_capacity_kw: float
    property_type: str = "Residential"
    roof_type: str = "RCC Flat"
    grid_type: str = "ON_GRID"  # ON_GRID, OFF_GRID, HYBRID
    budget_paise: Optional[int] = None
    assigned_sales_rep_id: Optional[int] = None
    sales_rep_name: Optional[str] = "Unassigned"
    source: str = "WEBSITE"
    lead_priority: str = "MEDIUM"
    follow_up_date: Optional[datetime.datetime] = None
    follow_up_notes: Optional[str] = None
    next_action: Optional[str] = None
    interaction_history: Optional[str] = "[]"
    notes: Optional[str] = None


class EnquiryCreate(EnquiryBase):
    pass


class EnquiryUpdate(BaseModel):
    required_capacity_kw: Optional[float] = None
    property_type: Optional[str] = None
    roof_type: Optional[str] = None
    grid_type: Optional[str] = None
    budget_paise: Optional[int] = None
    assigned_sales_rep_id: Optional[int] = None
    sales_rep_name: Optional[str] = None
    source: Optional[str] = None
    lead_priority: Optional[str] = None
    follow_up_date: Optional[datetime.datetime] = None
    follow_up_notes: Optional[str] = None
    next_action: Optional[str] = None
    interaction_history: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class EnquiryStatusUpdate(BaseModel):
    status: str


class EnquiryScheduleSurvey(BaseModel):
    surveyor_name: str
    survey_date: Optional[datetime.datetime] = None
    notes: Optional[str] = None
    assigned_technician_id: Optional[int] = None


class EnquiryOut(EnquiryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    enquiry_number: str
    status: str
    created_at: datetime.datetime
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_city: Optional[str] = None
    has_survey: bool = False
    survey_status: Optional[str] = None
    has_quotation: bool = False


# ==========================================
# SITE SURVEY SCHEMAS
# ==========================================
class SiteSurveyBase(BaseModel):
    enquiry_id: int
    assigned_technician_id: Optional[int] = None
    surveyor_name: str
    survey_date: Optional[datetime.datetime] = None
    roof_dimensions: Optional[str] = "12m x 8m"
    roof_area_sqft: float
    usable_roof_area_sqft: float
    shadow_free_area_sqft: Optional[float] = 0.0
    roof_type: str = "RCC Flat"
    roof_azimuth_deg: float = 180.0
    tilt_angle_deg: float = 15.0
    shading_loss_pct: float = 5.0
    structural_integrity: str = "GOOD"
    recommended_capacity_kw: float
    structure_recommendation: Optional[str] = "Standard Elevated HDG Structure"
    meter_type: str = "THREE_PHASE"
    inverter_distance_meters: float = 12.0
    sanctioned_electrical_load_kw: Optional[float] = 5.0
    electrical_observations: Optional[str] = None
    technician_observations: Optional[str] = None
    site_photographs: Optional[str] = "[]"
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class SiteSurveyCreate(SiteSurveyBase):
    pass


class SiteSurveyUpdate(BaseModel):
    assigned_technician_id: Optional[int] = None
    surveyor_name: Optional[str] = None
    roof_dimensions: Optional[str] = None
    roof_area_sqft: Optional[float] = None
    usable_roof_area_sqft: Optional[float] = None
    shadow_free_area_sqft: Optional[float] = None
    roof_type: Optional[str] = None
    roof_azimuth_deg: Optional[float] = None
    tilt_angle_deg: Optional[float] = None
    shading_loss_pct: Optional[float] = None
    structural_integrity: Optional[str] = None
    recommended_capacity_kw: Optional[float] = None
    structure_recommendation: Optional[str] = None
    meter_type: Optional[str] = None
    inverter_distance_meters: Optional[float] = None
    sanctioned_electrical_load_kw: Optional[float] = None
    electrical_observations: Optional[str] = None
    technician_observations: Optional[str] = None
    site_photographs: Optional[str] = None
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    status: Optional[str] = None


class SiteSurveyOut(SiteSurveyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    survey_number: str
    status: str
    created_at: datetime.datetime
    enquiry_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_city: Optional[str] = None


# ==========================================
# QUOTATION SCHEMAS
# ==========================================
class QuotationItemCreate(BaseModel):
    component_id: Optional[int] = None
    item_description: str
    quantity: int = 1
    unit_price_paise: int
    total_price_paise: int


class QuotationItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quotation_id: int
    component_id: Optional[int] = None
    item_description: str
    quantity: int
    unit_price_paise: int
    total_price_paise: int


class QuotationCreate(BaseModel):
    enquiry_id: int
    survey_id: int
    package_id: Optional[int] = None
    customer_id: Optional[int] = None  # derived if omitted
    system_capacity_kw: float
    gross_amount_paise: int
    subsidy_amount_paise: int = 0
    discount_paise: int = 0
    tax_amount_paise: int = 0
    net_amount_paise: int
    estimated_annual_units_kwh: float = 0.0
    estimated_payback_years: float = 4.2
    validity_days: int = 30
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None
    items: List[QuotationItemCreate] = []


class QuotationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    quotation_number: str
    enquiry_id: int
    survey_id: Optional[int] = None
    package_id: Optional[int] = None
    customer_id: int
    system_capacity_kw: float
    gross_amount_paise: int
    subsidy_amount_paise: int
    discount_paise: int
    tax_amount_paise: int = 0
    net_amount_paise: int
    estimated_annual_units_kwh: float
    estimated_payback_years: float
    validity_days: int
    status: str
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime.datetime
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    enquiry_number: Optional[str] = None
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    items: List[QuotationItemOut] = []


# ==========================================
# ORDER SCHEMAS
# ==========================================
class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    order_number: str
    quotation_id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_city: Optional[str] = None
    system_capacity_kw: Optional[float] = None
    total_contract_paise: int
    advance_required_paise: int
    advance_received_paise: int
    payment_status: str
    stage: str
    quotation_number: Optional[str] = None
    enquiry_number: Optional[str] = None
    created_at: datetime.datetime


# ==========================================
# COMPONENT & WAREHOUSE SCHEMAS
# ==========================================
class ComponentBase(BaseModel):
    sku: str
    name: str
    category: str
    manufacturer: str
    model_number: str
    rated_power_w: Optional[float] = None
    unit_cost_paise: int
    unit_price_paise: int
    warranty_years: int = 5
    tier_grade: str = "TIER_1"
    failure_rate_pct: float = 0.5
    credibility_score: int = 90


class ComponentCreate(ComponentBase):
    pass


class ComponentOut(ComponentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    is_active: bool


class PackageItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    component_id: int
    quantity: int
    component_name: Optional[str] = None
    component_category: Optional[str] = None
    component_price_paise: Optional[int] = None


class PackageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    name: str
    code: str
    capacity_kw: float
    description: Optional[str] = None
    total_price_paise: int
    is_active: bool
    items: List[PackageItemOut] = []


class WarehouseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    code: str
    name: str
    city: str
    state: str
    pincode: str
    manager_name: str
    contact_phone: str
    is_primary: bool


# ==========================================
# DISPATCH & SERIAL TRACKING SCHEMAS (STAGE 4)
# ==========================================
class DispatchCreate(BaseModel):
    order_id: int
    warehouse_id: Optional[int] = None
    vehicle_number: Optional[str] = "MH-12-SP-2026"
    driver_name: Optional[str] = "Kishore Gaikwad"
    driver_phone: Optional[str] = "+91 98220 77112"
    dispatch_date: Optional[datetime.datetime] = None
    expected_delivery_date: Optional[datetime.datetime] = None
    notes: Optional[str] = "Consolidated project dispatch"


class SerialCaptureItem(BaseModel):
    component_id: int
    serial_number: str
    barcode_format: Optional[str] = "CODE128"
    warehouse_id: Optional[int] = None


class SerialCaptureRequest(BaseModel):
    serials: List[SerialCaptureItem]


class SerializedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    dispatch_id: Optional[int] = None
    dispatch_number: Optional[str] = None
    order_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    component_id: int
    component_name: Optional[str] = None
    component_category: Optional[str] = None
    serial_number: str
    barcode_format: str
    scanned_at: datetime.datetime
    lifecycle_status: str
    verification_status: str
    warehouse_id: Optional[int] = None
    installation_id: Optional[int] = None


class DispatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    dispatch_number: str
    order_id: int
    order_number: Optional[str] = None
    customer_name: Optional[str] = None
    warehouse_id: int
    warehouse_name: Optional[str] = None
    source_warehouses: Optional[str] = None
    vehicle_number: str
    driver_name: str
    driver_phone: str
    dispatch_date: datetime.datetime
    estimated_delivery_date: Optional[datetime.datetime] = None
    expected_delivery_date: Optional[datetime.datetime] = None
    actual_delivery_date: Optional[datetime.datetime] = None
    delivery_date: Optional[datetime.datetime] = None
    status: str
    notes: Optional[str] = None
    serialized_items_count: int = 0
    serialized_items: List[SerializedItemOut] = []


# ==========================================
# INSTALLATION & COMMISSIONING SCHEMAS (STAGE 4)
# ==========================================
class InstallationCreate(BaseModel):
    order_id: int
    assigned_tech_id: Optional[int] = None
    assigned_technician: Optional[str] = "Ramesh Patil (Lead Solar Engineer)"
    team_technician_ids: Optional[List[int]] = None
    team_size: Optional[int] = 4
    installation_address: Optional[str] = None
    scheduled_start_date: Optional[datetime.datetime] = None
    team_notes: Optional[str] = None


class InstallationAssignRequest(BaseModel):
    assigned_tech_id: int
    assigned_technician: Optional[str] = None
    team_technician_ids: Optional[List[int]] = None
    scheduled_start_date: Optional[datetime.datetime] = None
    team_notes: Optional[str] = None


class UpdateUserCapabilitiesRequest(BaseModel):
    capabilities: List[str]


class InstallationChecklistUpdate(BaseModel):
    chk_structure_installed: Optional[bool] = None
    chk_panels_installed: Optional[bool] = None
    chk_inverter_installed: Optional[bool] = None
    chk_electrical_completed: Optional[bool] = None
    chk_earthing_completed: Optional[bool] = None
    chk_safety_checks_completed: Optional[bool] = None
    chk_system_tested: Optional[bool] = None
    chk_customer_handover_completed: Optional[bool] = None
    earthing_resistance_ohms: Optional[float] = None
    peak_power_tested_kw: Optional[float] = None
    grid_sync_successful: Optional[bool] = None
    voltage_reading_volts: Optional[float] = None
    current_reading_amps: Optional[float] = None
    power_output_kw: Optional[float] = None
    grid_frequency_hz: Optional[float] = None
    customer_signed_by_name: Optional[str] = None
    customer_signoff_date: Optional[datetime.datetime] = None
    customer_feedback_rating: Optional[int] = None
    customer_remarks: Optional[str] = None
    commissioning_signed: Optional[bool] = None
    team_notes: Optional[str] = None
    status: Optional[str] = None


class InstallationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    installation_number: str
    order_id: int
    order_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_city: Optional[str] = None
    assigned_tech_id: Optional[int] = None
    assigned_technician: str
    lead_engineer: str
    team_technician_ids: List[int] = []
    team_size: int
    installation_address: Optional[str] = None
    scheduled_start_date: datetime.datetime
    completion_date: Optional[datetime.datetime] = None
    commissioning_date: Optional[datetime.datetime] = None
    status: str

    chk_structure_installed: bool
    chk_panels_installed: bool
    chk_inverter_installed: bool
    chk_electrical_completed: bool
    chk_earthing_completed: bool
    chk_safety_checks_completed: bool
    chk_system_tested: bool
    chk_customer_handover_completed: bool

    all_mandatory_checks_passed: bool = False
    earthing_resistance_ohms: Optional[float] = None
    peak_power_tested_kw: float = 0.0
    grid_sync_successful: bool = False
    voltage_reading_volts: float = 230.0
    current_reading_amps: float = 20.0
    power_output_kw: float = 0.0
    grid_frequency_hz: float = 50.0
    customer_signed_by_name: Optional[str] = None
    customer_signoff_date: Optional[datetime.datetime] = None
    customer_feedback_rating: Optional[int] = 5
    customer_remarks: Optional[str] = None
    commissioning_signed: bool = False
    team_notes: Optional[str] = None
    notes: Optional[str] = None
    evidence_files: List[Any] = []
    passport_number: Optional[str] = None


# ==========================================
# DIGITAL SOLAR PASSPORT & WARRANTY SCHEMAS (STAGE 4)
# ==========================================
class WarrantyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    passport_id: int
    component_id: int
    component_name: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    warranty_type: str
    duration_years: int
    start_date: datetime.datetime
    end_date: datetime.datetime
    terms_summary: Optional[str] = None
    status: str
    is_valid: bool = True


class DigitalSolarPassportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    passport_number: str
    order_id: int
    order_number: Optional[str] = None
    customer_id: int
    customer_name: Optional[str] = None
    customer_city: Optional[str] = None
    installation_id: Optional[int] = None
    qr_code_token: str
    qr_code_svg: Optional[str] = None
    public_lookup_url: Optional[str] = None
    system_capacity_kw: float
    grid_type: str
    commissioning_date: datetime.datetime
    pv_module_summary: Optional[str] = None
    inverter_summary: Optional[str] = None
    estimated_lifetime_mwh: float
    co2_offset_tonnes: float
    system_health_score: int
    is_active: bool
    serialized_components: List[Any] = []
    warranties: List[WarrantyOut] = []
    service_history: List[Any] = []
    evidence_files: List[Any] = []


class PublicSolarPassportOut(BaseModel):
    passport_number: str
    qr_code_token: str
    system_capacity_kw: float
    grid_type: str
    commissioning_date: datetime.datetime
    pv_module_summary: Optional[str] = None
    inverter_summary: Optional[str] = None
    estimated_lifetime_mwh: float
    co2_offset_tonnes: float
    system_health_score: int
    is_active: bool
    customer_display_name: str  # e.g. "R*** S***" or "Sharma Residence (Pune)"
    city: str
    state: str
    serialized_components: List[Any] = []
    warranties: List[WarrantyOut] = []


# ==========================================
# SERVICE TICKET SCHEMAS (STAGE 4 & MODULE 8)
# ==========================================
class ServiceTicketCreate(BaseModel):
    customer_id: int
    passport_id: Optional[int] = None
    installation_id: Optional[int] = None
    component_id: Optional[int] = None
    serial_number: Optional[str] = None
    issue_category: str  # INVERTER_FAULT, PANEL_DAMAGE, GRID_TRIP, WIRING_ISSUE, GENERATION_DROP, GENERAL_QUERY
    priority: Optional[str] = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    assigned_technician: Optional[str] = None
    assigned_tech_id: Optional[int] = None
    is_warranty_covered: Optional[bool] = True


class ServiceTicketUpdate(BaseModel):
    status: Optional[str] = None  # NEW_COMPLAINT, WARRANTY_CHECK, ASSIGNED, DIAGNOSIS, REPAIR_IN_PROGRESS, QUALITY_CHECK, CUSTOMER_CONFIRMATION, RESOLVED, CLOSED
    priority: Optional[str] = None
    assigned_technician: Optional[str] = None
    assigned_tech_id: Optional[int] = None
    is_warranty_covered: Optional[bool] = None
    diagnosis_notes: Optional[str] = None
    parts_used: Optional[str] = None
    labour_hours: Optional[float] = None
    labour_cost_paise: Optional[int] = None
    repair_expenses_paise: Optional[int] = None
    customer_confirmation_notes: Optional[str] = None
    resolution_notes: Optional[str] = None


class ServiceTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    ticket_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_city: Optional[str] = None
    passport_id: Optional[int] = None
    passport_number: Optional[str] = None
    installation_id: Optional[int] = None
    component_id: Optional[int] = None
    component_name: Optional[str] = None
    serial_number: Optional[str] = None
    issue_category: str
    priority: str
    description: str
    assigned_technician: Optional[str] = None
    assigned_tech_id: Optional[int] = None
    is_warranty_covered: bool = True
    diagnosis_notes: Optional[str] = None
    parts_used: Optional[str] = "[]"
    labour_hours: float = 0.0
    labour_cost_paise: int = 0
    repair_expenses_paise: int = 0
    customer_confirmation_notes: Optional[str] = None
    resolution_notes: Optional[str] = None
    status: str
    created_at: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None
