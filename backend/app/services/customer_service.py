from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Customer
from app.schemas.entities import CustomerCreate


class CustomerService:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100) -> List[Customer]:
        return db.query(Customer).order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, customer_id: int) -> Optional[Customer]:
        return db.query(Customer).filter(Customer.id == customer_id).first()

    @staticmethod
    def create(db: Session, data: CustomerCreate) -> Customer:
        customer = Customer(**data.model_dump())
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer

