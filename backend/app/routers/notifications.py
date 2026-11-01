import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Notification, User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/notifications", tags=["In-App Notifications"])


class NotificationOut(BaseModel):
    id: int
    uuid: str
    user_id: Optional[int]
    target_role: Optional[str]
    category: str
    title: str
    message: str
    link_url: Optional[str]
    related_entity_type: Optional[str]
    related_entity_id: Optional[int]
    is_read: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class CreateNotificationRequest(BaseModel):
    user_id: Optional[int] = None
    target_role: Optional[str] = None
    category: str = "WORKFLOW"
    title: str
    message: str
    link_url: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None


@router.get("", response_model=List[NotificationOut])
def get_user_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch notifications targeted to the authenticated user OR their role.
    """
    user_role = current_user.role.upper()
    query = db.query(Notification).filter(
        (Notification.user_id == current_user.id) |
        (Notification.target_role == user_role) |
        (Notification.target_role == "ALL") |
        ((Notification.user_id == None) & (Notification.target_role == None))
    )

    if unread_only:
        query = query.filter(Notification.is_read == False)

    return query.order_by(Notification.created_at.desc()).limit(20).all()


@router.patch("/{id}/read", response_model=NotificationOut)
def mark_notification_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(Notification.id == id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_role = current_user.role.upper()
    db.query(Notification).filter(
        (Notification.user_id == current_user.id) |
        (Notification.target_role == user_role)
    ).update({"is_read": True})
    db.commit()
    return {"success": True, "message": "All notifications marked as read."}


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def trigger_notification(
    payload: CreateNotificationRequest,
    db: Session = Depends(get_db)
):
    notif = Notification(
        user_id=payload.user_id,
        target_role=payload.target_role.upper() if payload.target_role else None,
        category=payload.category.upper(),
        title=payload.title,
        message=payload.message,
        link_url=payload.link_url,
        related_entity_type=payload.related_entity_type,
        related_entity_id=payload.related_entity_id,
        is_read=False,
        created_at=datetime.datetime.utcnow()
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

