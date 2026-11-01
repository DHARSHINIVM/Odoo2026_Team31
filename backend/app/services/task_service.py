import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.tasks_appointments import Task
from app.models.user_auth import User
from app.database import get_utc_now


class TaskService:
    @staticmethod
    def create_task(
        db: Session,
        title: str,
        description: Optional[str] = None,
        created_by_id: Optional[int] = None,
        assigned_user_id: Optional[int] = None,
        priority: str = "MEDIUM",
        category: str = "GENERAL",
        due_date: Optional[datetime.datetime] = None,
        customer_id: Optional[int] = None,
        order_id: Optional[int] = None,
        survey_id: Optional[int] = None,
        installation_id: Optional[int] = None,
        service_ticket_id: Optional[int] = None,
        source_event: Optional[str] = None,
    ) -> Task:
        task = Task(
            title=title,
            description=description,
            created_by_id=created_by_id,
            assigned_user_id=assigned_user_id,
            priority=priority.upper(),
            status="ASSIGNED" if assigned_user_id else "PENDING",
            category=category.upper(),
            due_date=due_date,
            customer_id=customer_id,
            order_id=order_id,
            survey_id=survey_id,
            installation_id=installation_id,
            service_ticket_id=service_ticket_id,
            source_event=source_event,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def generate_event_task(
        db: Session,
        event_code: str,
        title: str,
        description: str,
        category: str,
        priority: str = "MEDIUM",
        assigned_user_id: Optional[int] = None,
        due_in_hours: int = 48,
        customer_id: Optional[int] = None,
        order_id: Optional[int] = None,
        survey_id: Optional[int] = None,
        installation_id: Optional[int] = None,
        service_ticket_id: Optional[int] = None,
    ) -> Optional[Task]:
        """
        Idempotent event-driven task generator. Prevents creating duplicate open tasks for the same event and entity.
        """
        # Check if an active task for this event and target already exists
        query = db.query(Task).filter(
            Task.source_event == event_code,
            Task.status.in_(["PENDING", "ASSIGNED", "IN_PROGRESS"])
        )
        if survey_id:
            query = query.filter(Task.survey_id == survey_id)
        if installation_id:
            query = query.filter(Task.installation_id == installation_id)
        if service_ticket_id:
            query = query.filter(Task.service_ticket_id == service_ticket_id)
        if order_id:
            query = query.filter(Task.order_id == order_id)

        existing = query.first()
        if existing:
            return existing

        due_date = get_utc_now() + datetime.timedelta(hours=due_in_hours)
        return TaskService.create_task(
            db=db,
            title=title,
            description=description,
            created_by_id=None,
            assigned_user_id=assigned_user_id,
            priority=priority,
            category=category,
            due_date=due_date,
            customer_id=customer_id,
            order_id=order_id,
            survey_id=survey_id,
            installation_id=installation_id,
            service_ticket_id=service_ticket_id,
            source_event=event_code
        )

    @staticmethod
    def on_survey_assigned(db: Session, survey, technician_id: int):
        return TaskService.generate_event_task(
            db=db,
            event_code="SURVEY_ASSIGNED",
            title=f"Execute Site Survey: {survey.survey_number}",
            description=f"Conduct roof measurements, shadow analysis, and upload electrical site photos for {survey.survey_number}.",
            category="SURVEY",
            priority="HIGH",
            assigned_user_id=technician_id,
            due_in_hours=48,
            customer_id=survey.enquiry.customer_id if survey.enquiry else None,
            survey_id=survey.id
        )

    @staticmethod
    def on_survey_submitted(db: Session, survey, survey_mgr_id: Optional[int] = None):
        if not survey_mgr_id:
            mgr = db.query(User).filter(User.role.in_(["ADMIN", "SOLAR_MANAGER"]), User.is_active == True).first()
            survey_mgr_id = mgr.id if mgr else None

        return TaskService.generate_event_task(
            db=db,
            event_code="SURVEY_REVIEW_PENDING",
            title=f"Review Site Survey: {survey.survey_number}",
            description=f"Survey #{survey.survey_number} has been submitted by field technician and requires engineering approval or revision.",
            category="SURVEY",
            priority="HIGH",
            assigned_user_id=survey_mgr_id,
            due_in_hours=24,
            customer_id=survey.enquiry.customer_id if survey.enquiry else None,
            survey_id=survey.id
        )

    @staticmethod
    def on_installation_scheduled(db: Session, installation, lead_tech_id: Optional[int] = None):
        return TaskService.generate_event_task(
            db=db,
            event_code="INSTALLATION_SCHEDULED",
            title=f"Rooftop Solar Installation: {installation.installation_number}",
            description=f"Execute PV modules and inverter installation, 8-point commissioning checklist, and electrical verification for {installation.installation_number}.",
            category="INSTALLATION",
            priority="URGENT",
            assigned_user_id=lead_tech_id or installation.assigned_tech_id,
            due_in_hours=72,
            order_id=installation.order_id,
            installation_id=installation.id
        )

    @staticmethod
    def on_service_ticket_created(db: Session, ticket):
        assignee = db.query(User).filter(User.role.in_(["ADMIN", "TECHNICIAN"]), User.is_active == True).first()
        return TaskService.generate_event_task(
            db=db,
            event_code="SERVICE_TICKET_CREATED",
            title=f"Resolve Service Ticket: {ticket.ticket_number}",
            description=f"Customer reported issue: '{getattr(ticket, 'description', '')}'. Priority: {ticket.priority}. Triage and schedule warranty repair.",
            category="SERVICE",
            priority=ticket.priority or "HIGH",
            assigned_user_id=assignee.id if assignee else None,
            due_in_hours=24 if ticket.priority == "URGENT" else 48,
            service_ticket_id=ticket.id
        )
