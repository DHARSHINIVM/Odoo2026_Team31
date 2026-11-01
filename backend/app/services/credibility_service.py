from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models import Component


class CredibilityService:
    # Illustrative Configurable Heuristic Model Weights
    WEIGHT_TIER = 0.40
    WEIGHT_FAILURE = 0.35
    WEIGHT_DOCS = 0.25

    @classmethod
    def evaluate_component(cls, component: Component, custom_weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Feature 7: Evaluates an explainable component credibility score using the configurable heuristic model:
        Score = (Weight_Tier * Tier_Score) + (Weight_Failure * Failure_Score) + (Weight_Docs * Docs_Score)

        Handles missing and incomplete data gracefully:
        - Detects missing source parameters (tier, failure rate, certification, documentation).
        - Explicitly flags completeness: COMPLETE, PARTIAL, or INSUFFICIENT.
        - Provides inventory recommendation without hard auto-rejections.
        """
        weights = custom_weights or {
            "tier": cls.WEIGHT_TIER,
            "failure": cls.WEIGHT_FAILURE,
            "docs": cls.WEIGHT_DOCS
        }

        # 0. Source Data Completeness Validation
        missing_factors = []
        if not component.tier_grade:
            missing_factors.append("Manufacturer Tier")
        if component.failure_rate_pct is None:
            missing_factors.append("Field Failure Telemetry")
        if not component.documentation_status or component.documentation_status.strip().lower() in ("missing", "none", ""):
            missing_factors.append("Compliance Datasheet")
        if not component.certification_status or component.certification_status.strip().lower() in ("missing", "none", "pending", "unverified"):
            missing_factors.append("Statutory Certification (BIS/IEC)")

        if len(missing_factors) == 0:
            data_completeness = "COMPLETE"
            incomplete_warning = None
        elif len(missing_factors) == 1:
            data_completeness = "PARTIAL"
            incomplete_warning = f"Partial source data: {missing_factors[0]} is unverified or estimated from regional baseline."
        else:
            data_completeness = "INSUFFICIENT"
            incomplete_warning = f"Insufficient source data: Missing {', '.join(missing_factors)}. Heuristic score is provisional and should not be treated as a lab-validated rating."

        # 1. Tier Score (Tier 1 = 100, Tier 2 = 75, Tier 3 = 50, Missing = 40)
        tier_normalized = (component.tier_grade or "UNRATED").upper()
        if tier_normalized == "TIER_1":
            tier_score = 100.0
            tier_label = "Tier 1 (Bankable / Bloomberg NEF Tier-1)"
        elif tier_normalized == "TIER_2":
            tier_score = 75.0
            tier_label = "Tier 2 (Standard Regional Manufacturer)"
        elif tier_normalized == "TIER_3":
            tier_score = 50.0
            tier_label = "Tier 3 (Economy / Unrated Manufacturer)"
        else:
            tier_score = 40.0
            tier_label = "Unrated / Unknown Manufacturer Tier"

        # 2. Failure Score: max(0, min(100, 100 - failure_rate_pct * 10))
        if component.failure_rate_pct is not None:
            failure_pct = float(component.failure_rate_pct)
            failure_score = max(0.0, min(100.0, 100.0 - (failure_pct * 10.0)))
            failure_source = "Field O&M Telemetry"
        else:
            failure_pct = 1.5  # Estimated unverified baseline
            failure_score = 50.0
            failure_source = "Estimated Baseline (Unmeasured)"

        # 3. Certification & Documentation Score (Verified = 100, Partial = 50, Missing = 0)
        doc_str = (component.documentation_status or "").strip().lower()
        if "verified" in doc_str:
            doc_score = 100.0
            doc_label = "Verified"
        elif "partial" in doc_str:
            doc_score = 50.0
            doc_label = "Partial"
        else:
            doc_score = 0.0
            doc_label = "Missing"

        # Weighted Sum
        tier_contrib = round(weights["tier"] * tier_score, 2)
        failure_contrib = round(weights["failure"] * failure_score, 2)
        doc_contrib = round(weights["docs"] * doc_score, 2)
        final_score = round(tier_contrib + failure_contrib + doc_contrib, 1)

        # Categorical Risk & Recommendation
        if data_completeness == "INSUFFICIENT":
            rating_label = "Incomplete Data"
            rating_badge = "badge-warning"
            color = "var(--amber-600)"
            inventory_recommendation = "AUDIT_REQUIRED"
            inventory_recommendation_label = "Quality Audit Required — Missing Official Test Data"
        elif final_score >= 85.0:
            rating_label = "High"
            rating_badge = "badge-success"
            color = "var(--solar-green-600)"
            inventory_recommendation = "RECOMMENDED_PRIMARY"
            inventory_recommendation_label = "Recommended for Commercial & Premium Rooftop EPC"
        elif final_score >= 70.0:
            rating_label = "Moderate"
            rating_badge = "badge-info"
            color = "var(--blue-600)"
            inventory_recommendation = "SUITABLE_STANDARD"
            inventory_recommendation_label = "Standard Deployment — Verified Reliability"
        elif final_score >= 50.0:
            rating_label = "Low"
            rating_badge = "badge-warning"
            color = "var(--amber-600)"
            inventory_recommendation = "BACKUP_ONLY"
            inventory_recommendation_label = "Backup / Secondary Buffer — Verify Warranty Terms"
        else:
            rating_label = "High Risk"
            rating_badge = "badge-danger"
            color = "var(--red-600)"
            inventory_recommendation = "HIGH_RISK_HOLD"
            inventory_recommendation_label = "High Risk — Warehouse Quarantine / Supplier Review Recommended"

        explanation = (
            f"Manufacturer Tier: {tier_score:.0f} pts × {int(weights['tier']*100)}% = {tier_contrib:.1f} pts; "
            f"Field Failure Rate ({failure_pct:.2f}%): {failure_score:.1f} pts × {int(weights['failure']*100)}% = {failure_contrib:.1f} pts; "
            f"Compliance & Documentation: {doc_score:.0f} pts × {int(weights['docs']*100)}% = {doc_contrib:.1f} pts. "
            f"Total Heuristic Score: {final_score}/100 ({rating_label})."
        )

        return {
            "component_id": component.id,
            "sku": component.sku,
            "name": component.name,
            "category": component.category,
            "manufacturer": component.manufacturer,
            "model_number": component.model_number,
            "supplier_name": component.supplier_name or component.manufacturer,
            "supplier_rating": component.supplier_rating if hasattr(component, 'supplier_rating') and component.supplier_rating else 4.5,
            "tier_grade": component.tier_grade,
            "tier_label": tier_label,
            "tier_score": tier_score,
            "tier_weight_pct": int(weights["tier"] * 100),
            "tier_contribution": tier_contrib,
            "failure_rate_pct": failure_pct,
            "failure_score": round(failure_score, 1),
            "failure_source": failure_source,
            "failure_weight_pct": int(weights["failure"] * 100),
            "failure_contribution": failure_contrib,
            "certification_status": component.certification_status,
            "documentation_status": component.documentation_status,
            "documentation_label": doc_label,
            "documentation_score": doc_score,
            "documentation_weight_pct": int(weights["docs"] * 100),
            "documentation_contribution": doc_contrib,
            "final_score": final_score,
            "rating_label": rating_label,
            "rating_badge": rating_badge,
            "color": color,
            "data_completeness": data_completeness,
            "missing_factors": missing_factors,
            "incomplete_data_warning": incomplete_warning,
            "inventory_recommendation": inventory_recommendation,
            "inventory_recommendation_label": inventory_recommendation_label,
            "explanation": explanation,
            "disclaimer": (
                "Illustrative configurable heuristic scoring model based on tier bankability, "
                "field failure data, and statutory BIS/IEC certification status; "
                "not a validated third-party laboratory reliability rating."
            )
        }

    @classmethod
    def evaluate_all(cls, db: Session, category: Optional[str] = None) -> Dict[str, Any]:
        """Evaluates all active components in the catalog and provides aggregate stats."""
        query = db.query(Component).filter(Component.is_active == True)
        if category and category.upper() != "ALL":
            query = query.filter(Component.category == category.upper())

        components = query.all()
        evaluations = [cls.evaluate_component(c) for c in components]
        evaluations.sort(key=lambda x: x["final_score"], reverse=True)

        total_evaluated = len(evaluations)
        avg_score = round(sum(e["final_score"] for e in evaluations) / total_evaluated, 1) if total_evaluated else 0.0

        high_count = sum(1 for e in evaluations if e["rating_label"] == "High")
        moderate_count = sum(1 for e in evaluations if e["rating_label"] == "Moderate")
        low_count = sum(1 for e in evaluations if e["rating_label"] == "Low")
        incomplete_count = sum(1 for e in evaluations if e["data_completeness"] == "INSUFFICIENT")
        high_risk_count = sum(1 for e in evaluations if e["rating_label"] == "High Risk" and e["data_completeness"] != "INSUFFICIENT")

        return {
            "total_evaluated": total_evaluated,
            "average_score": avg_score,
            "distribution": {
                "high": high_count,
                "moderate": moderate_count,
                "low": low_count,
                "incomplete_data": incomplete_count,
                "high_risk": high_risk_count
            },
            "model_weights": {
                "manufacturer_tier_pct": 40,
                "failure_rate_pct": 35,
                "documentation_certification_pct": 25
            },
            "disclaimer": (
                "Illustrative configurable heuristic scoring model based on tier bankability, "
                "field failure data, and statutory BIS/IEC certification status; "
                "not a validated third-party laboratory reliability rating."
            ),
            "components": evaluations
        }
