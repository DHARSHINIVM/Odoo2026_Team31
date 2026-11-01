from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import Component
from app.services.credibility_service import CredibilityService
from app.services.audit_service import AuditService
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/credibility", tags=["Component Credibility Evaluation Hub"], dependencies=[Depends(get_current_user)])


class ComponentQualityUpdate(BaseModel):
    tier_grade: Optional[str] = None
    failure_rate_pct: Optional[float] = None
    certification_status: Optional[str] = None
    documentation_status: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_rating: Optional[float] = None
    notes: Optional[str] = None
    updated_by: Optional[str] = "Solar Quality Engineer"


@router.get("")
def get_all_credibility_evaluations(category: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns explainable component credibility scores for all active equipment in the catalog
    based on the illustrative configurable heuristic model.
    """
    return CredibilityService.evaluate_all(db, category=category)


@router.get("/{component_id}")
def get_component_credibility(component_id: int, db: Session = Depends(get_db)):
    """
    Detailed explainable score breakdown and contributions for a single component.
    """
    comp = db.query(Component).filter(Component.id == component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
    return CredibilityService.evaluate_component(comp)


@router.patch("/components/{component_id}")
def update_component_quality_factors(
    component_id: int,
    payload: ComponentQualityUpdate,
    db: Session = Depends(get_db)
):
    """
    Feature 7: Maintain component manufacturer, supplier, certification, and failure-rate telemetry.
    Re-evaluates and updates persistent credibility score with audit trail.
    """
    comp = db.query(Component).filter(Component.id == component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")

    old_state = {
        "tier_grade": comp.tier_grade,
        "failure_rate_pct": comp.failure_rate_pct,
        "certification_status": comp.certification_status,
        "documentation_status": comp.documentation_status,
        "supplier_name": getattr(comp, "supplier_name", None),
        "supplier_rating": getattr(comp, "supplier_rating", None),
        "credibility_score": comp.credibility_score
    }

    if payload.tier_grade is not None:
        comp.tier_grade = payload.tier_grade.upper()
    if payload.failure_rate_pct is not None:
        comp.failure_rate_pct = payload.failure_rate_pct
    if payload.certification_status is not None:
        comp.certification_status = payload.certification_status
    if payload.documentation_status is not None:
        comp.documentation_status = payload.documentation_status
    if payload.supplier_name is not None:
        comp.supplier_name = payload.supplier_name
    if payload.supplier_rating is not None:
        comp.supplier_rating = payload.supplier_rating

    # Recalculate credibility score with updated factors
    eval_res = CredibilityService.evaluate_component(comp)
    comp.credibility_score = int(round(eval_res["final_score"]))

    db.commit()
    db.refresh(comp)

    new_state = {
        "tier_grade": comp.tier_grade,
        "failure_rate_pct": comp.failure_rate_pct,
        "certification_status": comp.certification_status,
        "documentation_status": comp.documentation_status,
        "supplier_name": comp.supplier_name,
        "supplier_rating": comp.supplier_rating,
        "credibility_score": comp.credibility_score
    }

    # Record Audit Log
    AuditService.log(
        db=db,
        action="UPDATE",
        entity_type="COMPONENT",
        entity_id=comp.id,
        entity_identifier=comp.sku,
        old_values=old_state,
        new_values=new_state,
        details=f"Updated quality telemetry for component '{comp.name}' ({comp.sku}). Score revised to {comp.credibility_score}/100. Notes: {payload.notes or 'None'}",
        user_name=payload.updated_by
    )

    return {
        "success": True,
        "message": f"Component '{comp.name}' quality parameters updated successfully.",
        "evaluation": eval_res
    }


@router.post("/simulate")
def simulate_credibility_score(payload: dict):
    """
    Allows interactive experimentation with the scoring weights, failure rates,
    tiers, and certification statuses in real time.
    """
    tier_grade = payload.get("tier_grade", "TIER_1")
    failure_rate_pct = float(payload.get("failure_rate_pct", 0.5))
    documentation_status = payload.get("documentation_status", "Verified")
    certification_status = payload.get("certification_status", "BIS / IEC Approved")

    custom_weights = None
    if "weights" in payload:
        w = payload["weights"]
        custom_weights = {
            "tier": float(w.get("tier", 0.40)),
            "failure": float(w.get("failure", 0.35)),
            "docs": float(w.get("docs", 0.25))
        }

    # Dummy component object for calculation
    dummy = Component(
        id=0,
        sku="SIM-SKU",
        name="Simulated Component",
        category=payload.get("category", "PANEL"),
        manufacturer=payload.get("manufacturer", "Simulated Manufacturer"),
        model_number="SIM-MOD-01",
        tier_grade=tier_grade,
        failure_rate_pct=failure_rate_pct,
        documentation_status=documentation_status,
        certification_status=certification_status
    )

    return CredibilityService.evaluate_component(dummy, custom_weights=custom_weights)
