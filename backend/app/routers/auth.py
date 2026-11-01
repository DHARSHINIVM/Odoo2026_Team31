import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db, get_utc_now
from app.models.user_auth import User, hash_password
from app.services.auth_service import (
    create_session_and_token,
    decode_access_token,
    revoke_session_by_jti,
    revoke_all_user_sessions,
    get_current_user,
    require_roles,
    ROLE_PERMISSIONS
)

router = APIRouter(prefix="/auth", tags=["Centralized Authentication & RBAC"])


class LoginRequest(BaseModel):
    username_or_email: str
    password: str
    expected_role: Optional[str] = None  # If logging in from role-specific portal


class UserOut(BaseModel):
    id: int
    uuid: str
    username: str
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    designation: Optional[str] = None
    is_active: bool
    created_at: datetime.datetime
    last_login: Optional[datetime.datetime] = None
    capabilities: List[str] = []
    customer_id: Optional[int] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            uuid=user.uuid,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            department=user.department,
            designation=user.designation,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login=user.last_login,
            capabilities=user.capability_list,
            customer_id=user.customer_id
        )


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    permissions: List[str]
    dashboard_route: str


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str
    department: Optional[str] = "Operations"
    designation: Optional[str] = None
    capabilities: Optional[List[str]] = None


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    capabilities: Optional[List[str]] = None


class UpdateUserCapabilitiesRequest(BaseModel):
    capabilities: List[str]


ROLE_DASHBOARD_ROUTES = {
    "ADMIN": "/dashboard/admin",
    "SOLAR_MANAGER": "/dashboard/admin",
    "SALES_EXECUTIVE": "/dashboard/sales",
    "TECHNICIAN": "/dashboard/technician",
    "FIELD_TECHNICIAN": "/dashboard/technician",
    "WAREHOUSE_MANAGER": "/dashboard/warehouse",
    "CUSTOMER": "/dashboard",
}


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request = None, db: Session = Depends(get_db)):
    """
    Unified multi-role login endpoint supporting all 7 role-specific portals.
    Authenticates by username or email and validates expected role portal constraints.
    Creates an active server-side database session and issues an HMAC-SHA256 bearer token.
    """
    identifier = payload.username_or_email.strip().lower()
    user = db.query(User).filter(
        (User.username.ilike(identifier)) | (User.email.ilike(identifier))
    ).first()

    if not user or not user.check_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account has been deactivated. Please contact your Solar Administrator."
        )

    # Portal validation if logging in through a role-specific portal
    if payload.expected_role:
        expected = payload.expected_role.upper()
        user_role = user.role.upper()
        # Admin can access any portal; non-admins must match expected role
        if user_role != "ADMIN" and user_role != expected:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You are assigned the role '{user.role}', but this portal is reserved for '{expected}'. Please use your designated portal."
            )

    # Update last login timestamp
    user.last_login = get_utc_now()
    db.commit()

    # Create server-side session registry record and signed bearer token
    user_agent = request.headers.get("user-agent") if request else "Test Client"
    ip_addr = request.client.host if request and request.client else "127.0.0.1"
    token = create_session_and_token(user=user, db=db, user_agent=user_agent, ip_address=ip_addr)

    user_permissions = ROLE_PERMISSIONS.get(user.role.upper(), ["view:overview"])
    dashboard_route = ROLE_DASHBOARD_ROUTES.get(user.role.upper(), "/")

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.from_user(user),
        permissions=user_permissions,
        dashboard_route=dashboard_route
    )


@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Server-side token revocation:
    Extracts the token JTI, marks the session record as revoked in the database,
    ensuring subsequent requests with this token are rejected with HTTP 401.
    """
    if authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            try:
                payload = decode_access_token(parts[1])
                token_jti = payload.get("jti")
                if token_jti:
                    revoke_session_by_jti(token_jti, db)
            except Exception:
                pass

    return {
        "success": True,
        "message": f"User {current_user.username} successfully logged out. Server session has been revoked."
    }



@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Retrieve authenticated user's profile and active role."""
    return UserOut.from_user(current_user)


@router.get("/permissions")
def get_current_user_permissions(current_user: User = Depends(get_current_user)):
    """Retrieve full permission list and role metadata for authenticated user."""
    perms = ROLE_PERMISSIONS.get(current_user.role.upper(), ["view:overview"])
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "permissions": perms
    }


@router.get("/users", response_model=List[UserOut])
def list_company_users(
    role: Optional[str] = None,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: List all employee accounts across all 7 roles."""
    query = db.query(User)
    if role and role.upper() != "ALL":
        query = query.filter(User.role == role.upper())
    return [UserOut.from_user(u) for u in query.order_by(User.role, User.full_name).all()]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_employee_user(
    payload: CreateUserRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Create new employee account with assigned role."""
    # Check duplicate
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail=f"Username '{payload.username}' is already in use.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail=f"Email '{payload.email}' is already in use.")

    new_user = User(
        username=payload.username.strip().lower(),
        email=payload.email.strip().lower(),
        full_name=payload.full_name.strip(),
        role=payload.role.upper(),
        department=payload.department,
        designation=payload.designation,
        is_active=True
    )
    if payload.capabilities is not None:
        new_user.set_capabilities(payload.capabilities)
    new_user.set_password(payload.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserOut.from_user(new_user)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_employee_user(
    user_id: int,
    payload: UpdateUserRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Update employee profile, role assignment, active status, or reset password."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee user account not found.")

    if payload.full_name is not None:
        target_user.full_name = payload.full_name
    if payload.email is not None:
        target_user.email = payload.email.strip().lower()
    if payload.role is not None:
        target_user.role = payload.role.upper()
        # Role modification revokes all active sessions to force re-authentication with new permissions
        revoke_all_user_sessions(user_id, db)
    if payload.department is not None:
        target_user.department = payload.department
    if payload.designation is not None:
        target_user.designation = payload.designation
    if payload.is_active is not None:
        target_user.is_active = payload.is_active
        if not payload.is_active:
            # Account deactivation immediately revokes all active sessions
            revoke_all_user_sessions(user_id, db)
    if payload.capabilities is not None:
        target_user.set_capabilities(payload.capabilities)
    if payload.password:
        target_user.set_password(payload.password)

    db.commit()
    db.refresh(target_user)
    return UserOut.from_user(target_user)


@router.patch("/users/{user_id}/capabilities", response_model=UserOut)
def update_user_capabilities(
    user_id: int,
    payload: UpdateUserCapabilitiesRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin/Manager: Configure individual technician capabilities."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee user account not found.")

    target_user.set_capabilities(payload.capabilities)
    db.commit()
    db.refresh(target_user)
    return UserOut.from_user(target_user)


@router.get("/team/{role_name}")
def get_team_members_by_role(
    role_name: str,
    capability: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Helper endpoint to fetch list of active staff members for assignment dropdowns with capability filtering."""
    req_role = role_name.upper()
    users = db.query(User).filter(User.is_active == True).all()

    matched = []
    for u in users:
        u_role = (u.role or "").upper()
        # Direct role match
        if u_role == req_role:
            matched.append(u)
            continue
        # Unified Technician matches technician queries
        if req_role in ("TECHNICIAN", "FIELD_TECHNICIAN", "TECH", "SURVEY", "INSTALLATION", "SERVICE") and (
            u_role in ("TECHNICIAN", "FIELD_TECHNICIAN") or
            u.has_capability("SURVEY_EXECUTION") or
            u.has_capability("INSTALLATION_EXECUTION")
        ):
            matched.append(u)
            continue

    if capability:
        matched = [u for u in matched if u.has_capability(capability.upper())]

    # Deduplicate and sort
    seen_ids = set()
    deduped = []
    for u in matched:
        if u.id not in seen_ids:
            seen_ids.add(u.id)
            deduped.append(u)
    deduped.sort(key=lambda x: x.full_name)

    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "designation": u.designation,
            "capabilities": u.capability_list
        }
        for u in deduped
    ]


# -------------------------------------------------------------------------
# Administrator Session & Security Management
# -------------------------------------------------------------------------
class ResetPasswordRequest(BaseModel):
    new_password: str


@router.get("/users/{user_id}/sessions")
def list_user_sessions(
    user_id: int,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Retrieve active and historical sessions for an employee."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found.")

    from app.models.user_auth import UserSession
    sessions = db.query(UserSession).filter(UserSession.user_id == user_id).order_by(UserSession.created_at.desc()).limit(20).all()

    now = get_utc_now()
    return [
        {
            "session_id": s.session_id,
            "token_jti": s.token_jti,
            "user_agent": s.user_agent or "Unknown Client",
            "ip_address": s.ip_address or "127.0.0.1",
            "created_at": s.created_at.strftime("%d %b %Y, %H:%M") if s.created_at else "N/A",
            "expires_at": s.expires_at.strftime("%d %b %Y, %H:%M") if s.expires_at else "N/A",
            "is_revoked": s.is_revoked,
            "is_active": (not s.is_revoked) and (s.expires_at.replace(tzinfo=datetime.timezone.utc) > now if s.expires_at.tzinfo is None else s.expires_at > now)
        }
        for s in sessions
    ]


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions_endpoint(
    user_id: int,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Force immediate logout by revoking all active sessions for a user."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found.")

    revoked_count = revoke_all_user_sessions(user_id, db)
    return {
        "success": True,
        "message": f"Successfully revoked {revoked_count} active sessions for {target_user.full_name} ({target_user.username}).",
        "revoked_count": revoked_count
    }


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    payload: ResetPasswordRequest,
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"])),
    db: Session = Depends(get_db)
):
    """Admin-only: Reset user password securely and revoke existing sessions."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found.")

    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    target_user.set_password(payload.new_password)
    # Revoke sessions so user must log in with new password
    revoke_all_user_sessions(user_id, db)

    db.commit()
    db.refresh(target_user)
    return {
        "success": True,
        "message": f"Password reset successfully for {target_user.full_name}. Active sessions invalidated."
    }


@router.get("/roles-permissions")
def get_roles_permissions_matrix(
    current_user: User = Depends(require_roles(["ADMIN", "SOLAR_MANAGER"]))
):
    """Admin-only: Complete matrix of the 5 approved roles, default permissions, and granular capabilities."""
    five_approved_roles = [
        {
            "role": "ADMIN",
            "label": "Administrator",
            "department": "Executive Management",
            "description": "Full system configuration, security, user management, and company-wide oversight.",
            "default_permissions": ROLE_PERMISSIONS.get("ADMIN", [])
        },
        {
            "role": "SALES_EXECUTIVE",
            "label": "Sales Executive",
            "department": "Sales & Business Development",
            "description": "Leads, customer CRM, quotations, orders, and subsidy applications.",
            "default_permissions": ROLE_PERMISSIONS.get("SALES_EXECUTIVE", []),
            "special_permissions": [
                {"id": "can_approve_quotation", "label": "Quotation Self-Approval", "desc": "Authorize quotations directly without manager approval"},
                {"id": "can_apply_special_discount", "label": "Special Discount Authority", "desc": "Apply commercial discounts up to 10% on solar packages"},
                {"id": "can_override_survey", "label": "Override Survey Requirement", "desc": "Fast-track standard residential quotations before survey visit"}
            ]
        },
        {
            "role": "TECHNICIAN",
            "label": "Technician",
            "department": "Field Engineering",
            "description": "Unified single technician identity for site surveys, mechanical installation, electrical testing, commissioning, maintenance, and service repairs.",
            "default_permissions": ROLE_PERMISSIONS.get("TECHNICIAN", []),
            "special_permissions": [
                {"id": "SURVEY_EXECUTION", "label": "Site Survey Execution", "desc": "Perform roof measurement & shadow analysis"},
                {"id": "INSTALLATION_EXECUTION", "label": "Installation Execution", "desc": "Lead & execute on-site solar setup"},
                {"id": "ELECTRICAL_TESTING", "label": "Electrical Testing", "desc": "VOC, ISC, voltage & earthing testing"},
                {"id": "CAMERA_CAPTURE", "label": "Evidence Capture", "desc": "Upload mandatory site photos and checklists"},
                {"id": "COMPONENT_VERIFICATION", "label": "Component Verification", "desc": "Scan and verify serials against BOM"},
                {"id": "PASSPORT_UPDATES", "label": "Digital Passport Updates", "desc": "Update lifecycle status and sign-off"},
                {"id": "SERVICE_EXECUTION", "label": "Service & Maintenance", "desc": "Perform O&M diagnosis, parts replacement, and repairs"},
                {"id": "CUSTOMER_ACK", "label": "Customer Sign-off", "desc": "Collect customer handover signatures"}
            ]
        },
        {
            "role": "WAREHOUSE_MANAGER",
            "label": "Warehouse Manager",
            "department": "Logistics & Supply Chain",
            "description": "Inventory stock, warehouse allocation, serial scanning, and dispatches.",
            "default_permissions": ROLE_PERMISSIONS.get("WAREHOUSE_MANAGER", []),
            "special_permissions": [
                {"id": "inventory:force_stock_adjustment", "label": "Manual Stock Adjustment", "desc": "Reconcile physical stock counts"},
                {"id": "dispatch:bypass_serial_scan", "label": "Emergency Dispatch", "desc": "Authorize urgent deliveries with deferred scanning"}
            ]
        },
        {
            "role": "CUSTOMER",
            "label": "Customer",
            "department": "Client Access",
            "description": "Digital Solar Passport portal, generation tracking, and service complaints.",
            "default_permissions": ["view:passport", "submit:service_ticket"]
        }
    ]

    return {
        "approved_roles": five_approved_roles,
        "all_system_permissions": [
            "view:all", "manage:users", "manage:customers", "manage:enquiries",
            "manage:surveys", "approve:surveys", "manage:quotations", "manage:orders",
            "manage:inventory", "manage:dispatch", "manage:installations", "manage:warranties",
            "manage:service", "manage:subsidies", "view:financials", "view:analytics"
        ]
    }


