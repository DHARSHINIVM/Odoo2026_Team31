from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.audit_service import AuditService
from app.services.auth_service import require_roles

router = APIRouter(prefix="/audit-logs", tags=["Audit History & Traceability"], dependencies=[Depends(require_roles(["ADMIN", "SOLAR_MANAGER"]))])


@router.get("")
def list_audit_logs(
    entity_type: Optional[str] = Query(None, description="Module/Entity e.g. ORDER, INSTALLATION, WARRANTY"),
    entity_id: Optional[int] = Query(None, description="Record primary key ID"),
    entity_identifier: Optional[str] = Query(None, description="Order #, Passport #, etc."),
    action: Optional[str] = Query(None, description="Action e.g. CREATE, STATUS_CHANGE, APPROVE"),
    user_id: Optional[int] = Query(None, description="User ID"),
    search: Optional[str] = Query(None, description="Search keyword"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Feature 8: Searchable and filterable audit trail of all business transactions,
    status changes, approvals, and technician dispatches across modules.
    """
    return AuditService.get_logs(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_identifier=entity_identifier,
        action=action,
        user_id=user_id,
        search=search,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )


@router.get("/entity/{entity_type}/{entity_id}")
def get_entity_audit_trail(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db)
):
    """
    Get targeted chronological audit timeline for a specific business record
    (e.g. an Order, Installation, Service Ticket, or Solar Passport).
    """
    return AuditService.get_logs(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=50
    )

