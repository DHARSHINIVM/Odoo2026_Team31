import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from app.models.tasks_appointments import Appointment
from app.models.user_auth import User
from app.database import get_utc_now
from app.services.task_service import TaskService


STANDARD_TIME_SLOTS = [
    "09:00 - 11:00",
    "11:00 - 13:00",
    "14:00 - 16:00",
    "16:00 - 18:00"
]


class AppointmentService:
    @staticmethod
    def get_available_slots(
        db: Session,
        target_date: datetime.date,
        appointment_type: str = "SITE_SURVEY",
        technician_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Calculates time slot availability for a given date and appointment type.
        Ensures technician availability, capability qualification, and double-booking avoidance.
        """
        # Qualified technicians count
        required_cap = "SURVEY_EXECUTION" if appointment_type == "SITE_SURVEY" else "INSTALLATION_EXECUTION"
        qualified_techs = [
            u for u in db.query(User).filter(User.is_active == True).all()
            if u.has_capability(required_cap)
        ]
        total_capacity = len(qualified_techs) or 2

        # Start of day and end of day in UTC
        start_of_day = datetime.datetime.combine(target_date, datetime.time.min)
        end_of_day = datetime.datetime.combine(target_date, datetime.time.max)

        # Existing active appointments on target date
        existing_query = db.query(Appointment).filter(
            Appointment.scheduled_date >= start_of_day,
            Appointment.scheduled_date <= end_of_day,
            Appointment.status.notin_(["CANCELLED"])
        )
        if technician_id:
            existing_query = existing_query.filter(Appointment.assigned_tech_id == technician_id)

        existing_appointments = existing_query.all()

        slot_usage = {slot: 0 for slot in STANDARD_TIME_SLOTS}
        for apt in existing_appointments:
            if apt.time_slot in slot_usage:
                slot_usage[apt.time_slot] += 1

        results = []
        for slot in STANDARD_TIME_SLOTS:
            booked_count = slot_usage[slot]
            if technician_id:
                # Specific technician requested
                available = booked_count == 0
                reason = "Technician available" if available else "Technician already scheduled"
            else:
                available = booked_count < total_capacity
                reason = f"{total_capacity - booked_count} of {total_capacity} slots open" if available else "Fully booked"

            results.append({
                "date": target_date.isoformat(),
                "time_slot": slot,
                "available": available,
                "capacity": total_capacity,
                "booked_count": booked_count,
                "reason": reason
            })

        return results

    @staticmethod
    def book_appointment(
        db: Session,
        customer_id: int,
        appointment_type: str,
        scheduled_date: datetime.date,
        time_slot: str,
        assigned_tech_id: Optional[int] = None,
        order_id: Optional[int] = None,
        survey_id: Optional[int] = None,
        installation_id: Optional[int] = None,
        service_address: Optional[str] = None,
        contact_phone: Optional[str] = None,
        customer_notes: Optional[str] = None
    ) -> Appointment:
        if time_slot not in STANDARD_TIME_SLOTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid time slot '{time_slot}'. Allowed slots: {', '.join(STANDARD_TIME_SLOTS)}"
            )

        start_of_day = datetime.datetime.combine(scheduled_date, datetime.time.min)
        end_of_day = datetime.datetime.combine(scheduled_date, datetime.time.max)

        # 1. Double-booking check for technician
        if assigned_tech_id:
            tech = db.query(User).filter(User.id == assigned_tech_id).first()
            if not tech:
                raise HTTPException(status_code=404, detail="Technician account not found.")

            required_cap = "SURVEY_EXECUTION" if appointment_type == "SITE_SURVEY" else "INSTALLATION_EXECUTION"
            if not tech.has_capability(required_cap):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Technician '{tech.full_name}' lacks required capability '{required_cap}' for this appointment."
                )

            conflict = db.query(Appointment).filter(
                Appointment.assigned_tech_id == assigned_tech_id,
                Appointment.scheduled_date >= start_of_day,
                Appointment.scheduled_date <= end_of_day,
                Appointment.time_slot == time_slot,
                Appointment.status.notin_(["CANCELLED"])
            ).first()

            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Double-Booking Guard: Technician {tech.full_name} is already booked on {scheduled_date} during {time_slot} (Appointment #{conflict.appointment_number})."
                )
        else:
            # Auto-assign available qualified technician
            required_cap = "SURVEY_EXECUTION" if appointment_type == "SITE_SURVEY" else "INSTALLATION_EXECUTION"
            candidates = [u for u in db.query(User).filter(User.is_active == True).all() if u.has_capability(required_cap)]
            for cand in candidates:
                booked = db.query(Appointment).filter(
                    Appointment.assigned_tech_id == cand.id,
                    Appointment.scheduled_date >= start_of_day,
                    Appointment.scheduled_date <= end_of_day,
                    Appointment.time_slot == time_slot,
                    Appointment.status.notin_(["CANCELLED"])
                ).first()
                if not booked:
                    assigned_tech_id = cand.id
                    break

        # 2. Duplicate booking check for customer
        customer_conflict = db.query(Appointment).filter(
            Appointment.customer_id == customer_id,
            Appointment.scheduled_date >= start_of_day,
            Appointment.scheduled_date <= end_of_day,
            Appointment.time_slot == time_slot,
            Appointment.status.notin_(["CANCELLED"])
        ).first()

        if customer_conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Customer already has an active appointment (#{customer_conflict.appointment_number}) in slot {time_slot} on {scheduled_date}."
            )

        # Generate unique appointment number
        count = db.query(Appointment).count() + 1
        apt_num = f"APT-2026-{count:04d}"

        scheduled_dt = datetime.datetime.combine(scheduled_date, datetime.time(9, 0))

        appointment = Appointment(
            appointment_number=apt_num,
            customer_id=customer_id,
            appointment_type=appointment_type.upper(),
            order_id=order_id,
            survey_id=survey_id,
            installation_id=installation_id,
            assigned_tech_id=assigned_tech_id,
            scheduled_date=scheduled_dt,
            time_slot=time_slot,
            status="CONFIRMED" if assigned_tech_id else "REQUESTED",
            service_address=service_address,
            contact_phone=contact_phone,
            customer_notes=customer_notes
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        # Trigger automatic operational task for assigned technician
        if assigned_tech_id:
            TaskService.create_task(
                db=db,
                title=f"{appointment_type.replace('_', ' ').title()}: {apt_num}",
                description=f"Confirmed customer appointment on {scheduled_date} ({time_slot}) at {service_address or 'Customer Site'}. Notes: {customer_notes or 'None'}",
                assigned_user_id=assigned_tech_id,
                priority="HIGH",
                category="SURVEY" if appointment_type == "SITE_SURVEY" else "INSTALLATION",
                due_date=scheduled_dt,
                customer_id=customer_id,
                order_id=order_id,
                survey_id=survey_id,
                installation_id=installation_id,
                source_event="APPOINTMENT_CONFIRMED"
            )

        return appointment

    @staticmethod
    def reschedule_appointment(
        db: Session,
        appointment_id: int,
        new_date: datetime.date,
        new_time_slot: str,
        reason: Optional[str] = None
    ) -> Appointment:
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            raise HTTPException(status_code=404, detail="Appointment record not found.")

        if apt.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reschedule an appointment with status '{apt.status}'."
            )

        start_of_day = datetime.datetime.combine(new_date, datetime.time.min)
        end_of_day = datetime.datetime.combine(new_date, datetime.time.max)

        # Check tech conflict if assigned
        if apt.assigned_tech_id:
            conflict = db.query(Appointment).filter(
                Appointment.id != apt.id,
                Appointment.assigned_tech_id == apt.assigned_tech_id,
                Appointment.scheduled_date >= start_of_day,
                Appointment.scheduled_date <= end_of_day,
                Appointment.time_slot == new_time_slot,
                Appointment.status.notin_(["CANCELLED"])
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Technician is not available in slot {new_time_slot} on {new_date}."
                )

        apt.scheduled_date = datetime.datetime.combine(new_date, datetime.time(9, 0))
        apt.time_slot = new_time_slot
        apt.status = "RESCHEDULED"
        if reason:
            apt.technician_notes = f"{apt.technician_notes or ''}\n[Rescheduled]: {reason}".strip()

        db.commit()
        db.refresh(apt)
        return apt

    @staticmethod
    def cancel_appointment(
        db: Session,
        appointment_id: int,
        cancellation_reason: str
    ) -> Appointment:
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            raise HTTPException(status_code=404, detail="Appointment record not found.")

        apt.status = "CANCELLED"
        apt.cancellation_reason = cancellation_reason
        db.commit()
        db.refresh(apt)
        return apt

