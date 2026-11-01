import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Component, Package, PackageItem
from app.schemas.entities import ComponentCreate, ComponentOut, PackageOut, PackageItemOut
from app.services.auth_service import get_current_user

router = APIRouter(tags=["Products & Packages"], dependencies=[Depends(get_current_user)])


@router.get("/products", response_model=List[ComponentOut])
@router.get("/components", response_model=List[ComponentOut])
def list_products(
    category: Optional[str] = None,
    tier: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Component).filter(Component.is_active == True)
    if category and category.upper() != "ALL":
        query = query.filter(Component.category == category.upper())
    if tier and tier.upper() != "ALL":
        query = query.filter(Component.tier_grade == tier.upper())
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Component.name.ilike(search_filter),
                Component.model_number.ilike(search_filter),
                Component.manufacturer.ilike(search_filter),
                Component.sku.ilike(search_filter)
            )
        )
    components = query.order_by(Component.credibility_score.desc()).all()
    return [ComponentOut.model_validate(c) for c in components]


@router.post("/products", response_model=ComponentOut, status_code=status.HTTP_201_CREATED)
@router.post("/components", response_model=ComponentOut, status_code=status.HTTP_201_CREATED)
@router.post("/catalog/components", response_model=ComponentOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_product(payload: ComponentCreate, db: Session = Depends(get_db)):
    existing = db.query(Component).filter(Component.sku == payload.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Component with SKU '{payload.sku}' already exists.")

    component = Component(**payload.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    return ComponentOut.model_validate(component)


@router.get("/products/{component_id}", response_model=ComponentOut)
@router.get("/components/{component_id}", response_model=ComponentOut, include_in_schema=False)
@router.get("/catalog/components/{component_id}", response_model=ComponentOut, include_in_schema=False)
def get_product(component_id: int, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return ComponentOut.model_validate(component)


@router.patch("/products/{component_id}", response_model=ComponentOut)
@router.patch("/components/{component_id}", response_model=ComponentOut, include_in_schema=False)
@router.patch("/catalog/components/{component_id}", response_model=ComponentOut, include_in_schema=False)
def update_product(component_id: int, payload: dict, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    for key, value in payload.items():
        if hasattr(component, key):
            setattr(component, key, value)

    db.commit()
    db.refresh(component)
    return ComponentOut.model_validate(component)


@router.get("/packages", response_model=List[PackageOut], operation_id="list_products_packages")
@router.get("/catalog/packages", response_model=List[PackageOut], include_in_schema=False)
def list_packages(db: Session = Depends(get_db)):
    packages = db.query(Package).filter(Package.is_active == True).all()
    results = []
    for pkg in packages:
        out = PackageOut.model_validate(pkg)
        out.items = []
        for item in pkg.items:
            item_out = PackageItemOut.model_validate(item)
            if item.component:
                item_out.component_name = item.component.name
                item_out.component_category = item.component.category
                item_out.component_price_paise = item.component.unit_price_paise
            out.items.append(item_out)
        results.append(out)
    return results


@router.get("/packages/{package_id}", response_model=PackageOut)
@router.get("/catalog/packages/{package_id}", response_model=PackageOut, include_in_schema=False)
def get_package(package_id: int, db: Session = Depends(get_db)):
    pkg = db.query(Package).filter(Package.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    out = PackageOut.model_validate(pkg)
    out.items = []
    for item in pkg.items:
        item_out = PackageItemOut.model_validate(item)
        if item.component:
            item_out.component_name = item.component.name
            item_out.component_category = item.component.category
            item_out.component_price_paise = item.component.unit_price_paise
        out.items.append(item_out)
    return out


@router.post("/packages", response_model=PackageOut, status_code=status.HTTP_201_CREATED)
@router.post("/catalog/packages", response_model=PackageOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_package(payload: dict, db: Session = Depends(get_db)):
    code = payload.get("code")
    if not code:
        count = db.query(Package).count() + 1
        code = f"PKG-CUSTOM-{count:02d}"

    pkg = Package(
        name=payload["name"],
        code=code,
        capacity_kw=float(payload.get("capacity_kw", 5.0)),
        description=payload.get("description", ""),
        total_price_paise=int(payload.get("total_price_paise", 0))
    )
    db.add(pkg)
    db.flush()

    items = payload.get("items", [])
    for it in items:
        p_item = PackageItem(
            package_id=pkg.id,
            component_id=int(it["component_id"]),
            quantity=int(it.get("quantity", 1))
        )
        db.add(p_item)

    db.commit()
    db.refresh(pkg)

    out = PackageOut.model_validate(pkg)
    out.items = []
    for item in pkg.items:
        item_out = PackageItemOut.model_validate(item)
        if item.component:
            item_out.component_name = item.component.name
            item_out.component_category = item.component.category
            item_out.component_price_paise = item.component.unit_price_paise
        out.items.append(item_out)
    return out

