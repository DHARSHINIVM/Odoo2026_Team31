from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Customer, Enquiry, Quotation, Order
from app.schemas.entities import CustomerCreate, CustomerUpdate, CustomerOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[CustomerOut])
def list_customers(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Customer)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(search_filter),
                Customer.phone.ilike(search_filter),
                Customer.email.ilike(search_filter),
                Customer.consumer_number.ilike(search_filter)
            )
        )
    if city:
        query = query.filter(Customer.city.ilike(f"%{city}%"))

    customers = query.order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for c in customers:
        out = CustomerOut.model_validate(c)
        out.enquiries_count = len(c.enquiries)
        out.orders_count = len(c.orders)
        results.append(out)
    return results


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    out = CustomerOut.model_validate(customer)
    out.enquiries_count = 0
    out.orders_count = 0
    return out


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    out = CustomerOut.model_validate(customer)
    out.enquiries_count = len(customer.enquiries)
    out.orders_count = len(customer.orders)
    return out


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    out = CustomerOut.model_validate(customer)
    out.enquiries_count = len(customer.enquiries)
    out.orders_count = len(customer.orders)
    return out


@router.delete("/{customer_id}", status_code=status.HTTP_200_OK)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Relational integrity check: cannot delete if orders exist or accepted quotations exist
    if customer.orders:
        raise HTTPException(
            status_code=400,
            detail=f"Relational Integrity Protection: Cannot delete customer '{customer.name}' because {len(customer.orders)} active order(s) exist."
        )

    accepted_quotes = [q for q in customer.quotations if q.status == "ACCEPTED"]
    if accepted_quotes:
        raise HTTPException(
            status_code=400,
            detail=f"Relational Integrity Protection: Cannot delete customer '{customer.name}' because they have accepted quotations."
        )

    db.delete(customer)
    db.commit()
    return {"success": True, "message": f"Customer '{customer.name}' deleted successfully."}
