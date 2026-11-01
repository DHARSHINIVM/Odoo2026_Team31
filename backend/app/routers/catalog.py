from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Package, Component
from app.schemas.entities import PackageOut, PackageItemOut, ComponentOut
from app.services.auth_service import get_current_user

router = APIRouter(tags=["Catalog"], dependencies=[Depends(get_current_user)])


@router.get("/packages", response_model=List[PackageOut])
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


@router.get("/components", response_model=List[ComponentOut])
@router.get("/catalog/components", response_model=List[ComponentOut], include_in_schema=False)
def list_components(db: Session = Depends(get_db)):
    components = db.query(Component).filter(Component.is_active == True).all()
    return [ComponentOut.model_validate(c) for c in components]

