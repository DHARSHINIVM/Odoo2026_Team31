import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.database import get_db, get_utc_now
from app.models.tasks_appointments import Task
from app.models.user_auth import User
from app.services.auth_service import get_current_user, require_roles
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Task Management & Real-Time Coordination"])


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_user_id: Optional[int] = None
    priority: Optional[str] = "MEDIUM"
    category: Optional[str] = "GENERAL"
    due_date: Optional[datetime.datetime] = None
    customer_id: Optional[int] = None
    order_id: Optional[int] = None
    survey_id: Optional[int] = None
    installation_id: Optional[int] = None
    service_ticket_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_user_id: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime.datetime] = None


class TaskCommentRequest(BaseModel):
    comment: str


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    title: str
    description: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    assigned_user_id: Optional[int] = None
    assigned_user_name: Optional[str] = None
    priority: str
    status: str
    category: str
    due_date: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    is_overdue: bool = False
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    order_id: Optional[int] = None
    survey_id: Optional[int] = None
    installation_id: Optional[int] = None
    service_ticket_id: Optional[int] = None
    source_event: Optional[str] = None
    comments: List[Dict[str, Any]] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime


def _format_task(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        uuid=task.uuid,
        title=task.title,
        description=task.description,
        created_by_id=task.created_by_id,
        created_by_name=task.created_by.full_name if task.created_by else None,
        assigned_user_id=task.assigned_user_id,
        assigned_user_name=task.assigned_user.full_name if task.assigned_user else None,
        priority=task.priority,
        status=task.status,
        category=task.category,
        due_date=task.due_date,
        completed_at=task.completed_at,
        is_overdue=task.is_overdue,
        customer_id=task.customer_id,
        customer_name=task.customer.name if task.customer else None,
        order_id=task.order_id,
        survey_id=task.survey_id,
        installation_id=task.installation_id,
        service_ticket_id=task.service_ticket_id,
        source_event=task.source_event,
        comments=task.comment_list,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.get("", response_model=List[TaskOut])
def list_tasks(
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to_me: bool = False,
    overdue_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task)

    user_role = (current_user.role or "").upper()
    if assigned_to_me:
        query = query.filter((Task.assigned_user_id == current_user.id) | (Task.created_by_id == current_user.id))
    elif user_role in ("TECHNICIAN", "FIELD_TECHNICIAN", "SALES_EXECUTIVE"):
        query = query.filter((Task.assigned_user_id == current_user.id) | (Task.created_by_id == current_user.id))
    elif user_role == "WAREHOUSE_MANAGER":
        query = query.filter(
            (Task.assigned_user_id == current_user.id) |
            (Task.created_by_id == current_user.id) |
            (Task.category.in_(["INVENTORY", "WAREHOUSE", "DISPATCH", "RECEIPT", "LOGISTICS", "GENERAL"]))
        )

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(Task.status == status_filter.upper())
    if priority and priority.upper() != "ALL":
        query = query.filter(Task.priority == priority.upper())
    if category and category.upper() != "ALL":
        query = query.filter(Task.category == category.upper())

    tasks = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc()).all()
    if overdue_only:
        tasks = [t for t in tasks if t.is_overdue]

    return [_format_task(t) for t in tasks]


@router.get("/summary")
def get_task_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_role = (current_user.role or "").upper()
    query = db.query(Task)
    if user_role in ("TECHNICIAN", "FIELD_TECHNICIAN", "SALES_EXECUTIVE"):
        query = query.filter((Task.assigned_user_id == current_user.id) | (Task.created_by_id == current_user.id))
    elif user_role == "WAREHOUSE_MANAGER":
        query = query.filter(
            (Task.assigned_user_id == current_user.id) |
            (Task.created_by_id == current_user.id) |
            (Task.category.in_(["INVENTORY", "WAREHOUSE", "DISPATCH", "RECEIPT", "LOGISTICS", "GENERAL"]))
        )

    all_tasks = query.all()
    pending = sum(1 for t in all_tasks if t.status in ("PENDING", "ASSIGNED"))
    in_progress = sum(1 for t in all_tasks if t.status == "IN_PROGRESS")
    completed = sum(1 for t in all_tasks if t.status == "COMPLETED")
    overdue = sum(1 for t in all_tasks if t.is_overdue)
    urgent = sum(1 for t in all_tasks if t.priority in ("HIGH", "URGENT") and t.status != "COMPLETED")

    return {
        "total": len(all_tasks),
        "pending": pending,
        "in_progress": in_progress,
        "completed": completed,
        "overdue": overdue,
        "urgent": urgent
    }


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = TaskService.create_task(
        db=db,
        title=payload.title,
        description=payload.description,
        created_by_id=current_user.id,
        assigned_user_id=payload.assigned_user_id or current_user.id,
        priority=payload.priority or "MEDIUM",
        category=payload.category or "GENERAL",
        due_date=payload.due_date,
        customer_id=payload.customer_id,
        order_id=payload.order_id,
        survey_id=payload.survey_id,
        installation_id=payload.installation_id,
        service_ticket_id=payload.service_ticket_id,
        source_event="USER_CREATED"
    )
    return _format_task(task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _format_task(task)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.assigned_user_id is not None:
        task.assigned_user_id = payload.assigned_user_id
        if task.status == "PENDING":
            task.status = "ASSIGNED"
    if payload.priority is not None:
        task.priority = payload.priority.upper()
    if payload.status is not None:
        new_status = payload.status.upper()
        task.status = new_status
        if new_status == "COMPLETED":
            task.completed_at = get_utc_now()
        else:
            task.completed_at = None
    if payload.due_date is not None:
        task.due_date = payload.due_date

    db.commit()
    db.refresh(task)
    return _format_task(task)


@router.post("/{task_id}/comments", response_model=TaskOut)
def add_task_comment(
    task_id: int,
    payload: TaskCommentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.add_comment(current_user.id, current_user.full_name, payload.comment)
    db.commit()
    db.refresh(task)
    return _format_task(task)

