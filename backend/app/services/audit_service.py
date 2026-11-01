import json
import logging
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.models import AuditLog, User

logger = logging.getLogger("sunpower.audit")

SENSITIVE_KEYS = {
    "password", "password_hash", "hashed_password", "token", "secret",
    "access_token", "refresh_token", "sunpower_token", "jwt", "auth_token"
}


def sanitize_dict(data: Any) -> Any:
    if isinstance(data, dict):
        clean = {}
        for k, v in data.items():
            if any(s in k.lower() for s in SENSITIVE_KEYS):
                clean[k] = "********"
            else:
                clean[k] = sanitize_dict(v)
        return clean
    elif isinstance(data, list):
        return [sanitize_dict(item) for item in data]
    return data


class AuditService:
    @classmethod
    def log(
        cls,
        db: Session,
        action: str,
        entity_type: str,
        entity_id: Optional[int] = None,
        entity_identifier: Optional[str] = None,
        old_values: Optional[Any] = None,
        new_values: Optional[Any] = None,
        details: Optional[str] = None,
        user: Optional[User] = None,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Optional[AuditLog]:
        """
        Record a persistent audit entry across solar installation workflows.
        Never throws exceptions that abort the parent business transaction.
        """
        try:
            # Resolve user details
            final_user_id = user_id or (user.id if user else None)
            final_user_name = user_name or ((getattr(user, "full_name", None) or getattr(user, "username", None) or getattr(user, "name", None)) if user else "System/Automated")
            final_user_role = user_role or (user.role if user else "SYSTEM")

            # JSON encode state snapshots
            old_json = None
            if old_values is not None:
                try:
                    old_json = json.dumps(sanitize_dict(old_values), default=str)
                except Exception:
                    old_json = str(old_values)

            new_json = None
            if new_values is not None:
                try:
                    new_json = json.dumps(sanitize_dict(new_values), default=str)
                except Exception:
                    new_json = str(new_values)

            audit_entry = AuditLog(
                timestamp=datetime.datetime.utcnow(),
                user_id=final_user_id,
                user_name=final_user_name,
                user_role=final_user_role,
                action=action.upper(),
                entity_type=entity_type.upper(),
                entity_id=entity_id,
                entity_identifier=entity_identifier,
                old_values=old_json,
                new_values=new_json,
                details=details,
                ip_address=ip_address
            )

            db.add(audit_entry)
            db.commit()
            db.refresh(audit_entry)
            return audit_entry

        except Exception as e:
            logger.error(f"Failed to record audit log: {e}", exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass
            return None

    @classmethod
    def get_logs(
        cls,
        db: Session,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        entity_identifier: Optional[str] = None,
        action: Optional[str] = None,
        user_id: Optional[int] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Query audit log entries with comprehensive multi-criteria filtering."""
        query = db.query(AuditLog)

        if entity_type and entity_type.upper() != "ALL":
            query = query.filter(AuditLog.entity_type == entity_type.upper())

        if entity_id is not None:
            query = query.filter(AuditLog.entity_id == entity_id)

        if entity_identifier:
            query = query.filter(AuditLog.entity_identifier.ilike(f"%{entity_identifier}%"))

        if action and action.upper() != "ALL":
            query = query.filter(AuditLog.action == action.upper())

        if user_id:
            query = query.filter(AuditLog.user_id == user_id)

        if start_date:
            try:
                dt_start = datetime.datetime.fromisoformat(start_date)
                query = query.filter(AuditLog.timestamp >= dt_start)
            except Exception:
                pass

        if end_date:
            try:
                dt_end = datetime.datetime.fromisoformat(end_date)
                # include full day
                dt_end = dt_end.replace(hour=23, minute=59, second=59)
                query = query.filter(AuditLog.timestamp <= dt_end)
            except Exception:
                pass

        if search and search.strip():
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    AuditLog.entity_identifier.ilike(s),
                    AuditLog.user_name.ilike(s),
                    AuditLog.details.ilike(s),
                    AuditLog.action.ilike(s),
                    AuditLog.entity_type.ilike(s)
                )
            )

        total_count = query.count()
        logs = query.order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit).all()

        formatted = []
        for l in logs:
            old_parsed = None
            if l.old_values:
                try:
                    old_parsed = json.loads(l.old_values)
                except Exception:
                    old_parsed = l.old_values

            new_parsed = None
            if l.new_values:
                try:
                    new_parsed = json.loads(l.new_values)
                except Exception:
                    new_parsed = l.new_values

            formatted.append({
                "id": l.id,
                "uuid": l.uuid,
                "timestamp": l.timestamp.isoformat(),
                "user_id": l.user_id,
                "user_name": l.user_name,
                "user_role": l.user_role,
                "action": l.action,
                "entity_type": l.entity_type,
                "entity_id": l.entity_id,
                "entity_identifier": l.entity_identifier,
                "old_values": old_parsed,
                "new_values": new_parsed,
                "details": l.details,
                "ip_address": l.ip_address
            })

        return {
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "logs": formatted,
            "items": formatted
        }

