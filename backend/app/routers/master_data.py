import json
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db, get_utc_now
from app.models import (
    Package, PackageItem, Component, SystemConfiguration, WarrantyPolicy, User
)
from app.services.auth_service import require_roles, get_current_user

router = APIRouter(prefix="/master-data", tags=["Master Data & System Configuration"], dependencies=[Depends(get_current_user)])


def _get_config_value(key: str, default: Any, db: Session) -> Any:
    cfg = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    if cfg and cfg.value_json:
        try:
            return json.loads(cfg.value_json)
        except Exception:
            return default
    return default


def _set_config_value(key: str, category: str, value: Any, description: str, db: Session) -> SystemConfiguration:
    cfg = db.query(SystemConfiguration).filter(SystemConfiguration.key == key).first()
    val_str = json.dumps(value)
    if not cfg:
        cfg = SystemConfiguration(
            key=key,
            category=category,
            description=description,
            value_json=val_str
        )
        db.add(cfg)
    else:
        cfg.value_json = val_str
        cfg.description = description
        cfg.updated_at = get_utc_now()
    db.commit()
    db.refresh(cfg)
    return cfg


# -------------------------------------------------------------------------
# A. Overview
# -------------------------------------------------------------------------
@router.get("/overview")
def get_master_data_overview(db: Session = Depends(get_db)):
    """Executive overview of all master data assets and active engineering templates."""
    total_packages = db.query(Package).filter(Package.is_active == True).count()
    ongrid_packages = db.query(Package).filter(Package.is_active == True, Package.name.ilike("%on-grid%")).count()
    offgrid_packages = db.query(Package).filter(Package.is_active == True, Package.name.ilike("%off-grid%")).count()

    total_components = db.query(Component).filter(Component.is_active == True).count()
    panels_count = db.query(Component).filter(Component.is_active == True, Component.category == "PANEL").count()
    inverters_count = db.query(Component).filter(Component.is_active == True, Component.category == "INVERTER").count()
    batteries_count = db.query(Component).filter(Component.is_active == True, Component.category == "BATTERY").count()
    structures_count = db.query(Component).filter(Component.is_active == True, Component.category == "STRUCTURE").count()

    warranty_policies_count = db.query(WarrantyPolicy).filter(WarrantyPolicy.is_active == True).count()

    return {
        "packages": {
            "total": total_packages,
            "on_grid": ongrid_packages,
            "off_grid": offgrid_packages
        },
        "components": {
            "total": total_components,
            "panels": panels_count,
            "inverters": inverters_count,
            "batteries": batteries_count,
            "structures": structures_count
        },
        "warranty_policies_count": warranty_policies_count,
        "supported_capacities_kw": [1.0, 2.0, 3.0, 4.0, 5.0, 10.0]
    }


# -------------------------------------------------------------------------
# B. Solar Packages (1-5 kW On-Grid & Off-Grid)
# -------------------------------------------------------------------------
class PackageCreateRequest(BaseModel):
    code: str
    name: str
    capacity_kw: float
    description: Optional[str] = None
    total_price_paise: int
    items: Optional[List[Dict[str, Any]]] = None


@router.get("/packages")
def list_master_packages(
    system_type: Optional[str] = None, # ON_GRID, OFF_GRID
    min_kw: Optional[float] = None,
    max_kw: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Retrieve all configurable solar packages with nested component specifications."""
    query = db.query(Package).filter(Package.is_active == True)
    if system_type:
        st = system_type.upper()
        if st in ("ON_GRID", "ONGRID"):
            query = query.filter(Package.name.ilike("%on-grid%"))
        elif st in ("OFF_GRID", "OFFGRID"):
            query = query.filter(Package.name.ilike("%off-grid%"))

    if min_kw is not None:
        query = query.filter(Package.capacity_kw >= min_kw)
    if max_kw is not None:
        query = query.filter(Package.capacity_kw <= max_kw)

    packages = query.order_by(Package.capacity_kw).all()
    results = []
    for p in packages:
        pkg_dict = {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "capacity_kw": p.capacity_kw,
            "description": p.description,
            "total_price_paise": p.total_price_paise,
            "total_price_inr": round(p.total_price_paise / 100, 2),
            "is_active": p.is_active,
            "system_type": "OFF_GRID" if "off-grid" in p.name.lower() else "ON_GRID",
            "items": [
                {
                    "item_id": it.id,
                    "component_id": it.component_id,
                    "component_name": it.component.name if it.component else f"Component #{it.component_id}",
                    "category": it.component.category if it.component else "N/A",
                    "quantity": it.quantity,
                    "unit_price_inr": round(it.component.unit_price_paise / 100, 2) if it.component else 0
                }
                for it in p.items
            ]
        }
        results.append(pkg_dict)
    return results


@router.post("/packages", status_code=status.HTTP_201_CREATED)
def create_master_package(
    payload: PackageCreateRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Create a new Solar Package template."""
    existing = db.query(Package).filter(Package.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Package code '{payload.code}' already exists.")

    new_pkg = Package(
        code=payload.code.strip(),
        name=payload.name.strip(),
        capacity_kw=payload.capacity_kw,
        description=payload.description,
        total_price_paise=payload.total_price_paise,
        is_active=True
    )
    db.add(new_pkg)
    db.flush()

    if payload.items:
        for it in payload.items:
            comp_id = it.get("component_id")
            qty = it.get("quantity", 1)
            if comp_id:
                pi = PackageItem(package_id=new_pkg.id, component_id=comp_id, quantity=qty)
                db.add(pi)

    db.commit()
    db.refresh(new_pkg)
    return {"success": True, "package_id": new_pkg.id, "code": new_pkg.code, "message": "Package created successfully."}


@router.patch("/packages/{package_id}")
def update_master_package(
    package_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Update pricing, capacity, or specifications of a solar package."""
    pkg = db.query(Package).filter(Package.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Solar Package not found.")

    for field in ("name", "description", "capacity_kw", "total_price_paise", "is_active"):
        if field in payload:
            setattr(pkg, field, payload[field])

    db.commit()
    db.refresh(pkg)
    return {"success": True, "package_id": pkg.id, "message": "Package updated successfully."}


# -------------------------------------------------------------------------
# C. Components Specifications & Pricing
# -------------------------------------------------------------------------
@router.get("/components")
def list_master_components(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List component specifications with technical ratings, warranty years, and pricing."""
    query = db.query(Component).filter(Component.is_active == True)
    if category and category.upper() != "ALL":
        query = query.filter(Component.category == category.upper())
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Component.name.ilike(s),
                Component.sku.ilike(s),
                Component.manufacturer.ilike(s),
                Component.model_number.ilike(s)
            )
        )
    comps = query.order_by(Component.category, Component.name).all()
    return [
        {
            "id": c.id,
            "sku": c.sku,
            "name": c.name,
            "category": c.category,
            "manufacturer": c.manufacturer,
            "model_number": c.model_number,
            "rated_power_w": c.rated_power_w,
            "unit_cost_inr": round(c.unit_cost_paise / 100, 2),
            "unit_price_inr": round(c.unit_price_paise / 100, 2),
            "warranty_years": c.warranty_years,
            "tier_grade": c.tier_grade,
            "credibility_score": c.credibility_score,
            "certification_status": c.certification_status,
            "is_active": c.is_active
        }
        for c in comps
    ]


# -------------------------------------------------------------------------
# D. BOM Templates
# -------------------------------------------------------------------------
@router.get("/bom-templates")
def get_bom_templates(db: Session = Depends(get_db)):
    """Retrieve standard engineering BOM templates for 1kW through 5kW systems."""
    return _get_config_value("bom_templates", {"templates": []}, db)


@router.post("/bom-templates")
def update_bom_templates(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Update standard engineering BOM templates."""
    _set_config_value("bom_templates", "BOM_TEMPLATE", payload, "Standard BOM recipes for 1kW through 5kW systems.", db)
    return {"success": True, "message": "BOM templates updated successfully."}


# -------------------------------------------------------------------------
# E. Pricing and Tax Configuration
# -------------------------------------------------------------------------
@router.get("/pricing-tax")
def get_pricing_tax_configuration(db: Session = Depends(get_db)):
    """Retrieve GST splits, benchmark EPC pricing per kW, and PM Surya Ghar subsidy rules."""
    return _get_config_value("pricing_tax_configuration", {}, db)


@router.post("/pricing-tax")
def update_pricing_tax_configuration(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Update GST splits and benchmark pricing parameters."""
    _set_config_value("pricing_tax_configuration", "PRICING_TAX", payload, "National solar EPC GST rate splits and benchmark pricing.", db)
    return {"success": True, "message": "Pricing & Tax configuration updated successfully."}


# -------------------------------------------------------------------------
# F. Technical Checklists (Survey & Pre-Installation)
# -------------------------------------------------------------------------
@router.get("/checklists")
def get_technical_checklists(db: Session = Depends(get_db)):
    """Retrieve mandatory field survey and pre-installation quality checklists."""
    return _get_config_value("technical_checklists", {}, db)


@router.post("/checklists")
def update_technical_checklists(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Update technical checklist criteria."""
    _set_config_value("technical_checklists", "CHECKLIST", payload, "Standard field checklists for site survey and installation.", db)
    return {"success": True, "message": "Technical checklists updated successfully."}


# -------------------------------------------------------------------------
# G. Commissioning Test Templates
# -------------------------------------------------------------------------
@router.get("/commissioning-tests")
def get_commissioning_test_templates(db: Session = Depends(get_db)):
    """Retrieve electrical testing parameters: Voc, Isc, Insulation, Earth resistance, and Anti-islanding."""
    return _get_config_value("commissioning_test_templates", {}, db)


@router.post("/commissioning-tests")
def update_commissioning_test_templates(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Update mandatory commissioning test templates."""
    _set_config_value("commissioning_test_templates", "CHECKLIST", payload, "Mandatory electrical testing parameters for plant commissioning.", db)
    return {"success": True, "message": "Commissioning test templates updated successfully."}


# -------------------------------------------------------------------------
# H. Warranty Terms & Policies
# -------------------------------------------------------------------------
@router.get("/warranty-terms")
def get_warranty_terms(db: Session = Depends(get_db)):
    """Retrieve baseline manufacturer and EPC warranty terms."""
    terms_cfg = _get_config_value("warranty_terms_configuration", {"terms": []}, db)
    policies = db.query(WarrantyPolicy).filter(WarrantyPolicy.is_active == True).all()
    policies_list = [
        {
            "id": p.id,
            "code": p.code,
            "manufacturer": p.manufacturer,
            "component_category": p.component_category,
            "duration_years": p.duration_years,
            "warranty_type": p.warranty_type,
            "terms_summary": p.terms_summary
        }
        for p in policies
    ]
    return {
        "standard_terms": terms_cfg.get("terms", []),
        "manufacturer_policies": policies_list
    }


# -------------------------------------------------------------------------
# I. System Configuration & Business Rules
# -------------------------------------------------------------------------
@router.get("/system-config")
def get_system_configuration(db: Session = Depends(get_db)):
    """Retrieve company profile, operational SLAs, and system feature toggles."""
    return _get_config_value("system_application_settings", {}, db)


@router.post("/system-config")
def update_system_configuration(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Update system application settings and SLAs."""
    _set_config_value("system_application_settings", "APP_SETTINGS", payload, "Company profile, currency, working hours, and operational SLAs.", db)
    return {"success": True, "message": "System configuration updated successfully."}

