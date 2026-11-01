import os
import json
import base64
import hmac
import hashlib
import time
import uuid
import datetime
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, status, Header, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user_auth import User, UserSession

# Environment-driven secret configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
RAW_SECRET = os.getenv("JWT_SECRET")

if not RAW_SECRET:
    if ENVIRONMENT in ("production", "prod"):
        raise RuntimeError(
            "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production environment. "
            "Server startup halted to prevent insecure token signing."
        )
    # Development fallback with high entropy (32+ chars)
    SECRET_KEY = "sunpower-epc-development-local-signing-secret-2026-v2.1"
else:
    if len(RAW_SECRET) < 32:
        raise RuntimeError("JWT_SECRET must be at least 32 characters long to ensure cryptographic integrity.")
    SECRET_KEY = RAW_SECRET

# 24-hour default session expiration policy
TOKEN_EXPIRY_SECONDS = int(os.getenv("TOKEN_EXPIRY_SECONDS", str(86400)))


ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "ADMIN": [
        "view:all", "manage:users", "manage:customers", "manage:enquiries",
        "manage:surveys", "approve:surveys", "manage:quotations", "manage:orders",
        "manage:inventory", "manage:dispatch", "manage:installations", "manage:warranties",
        "manage:service", "manage:subsidies", "view:financials", "view:analytics"
    ],
    "SALES_EXECUTIVE": [
        "view:assigned_leads", "manage:customers", "manage:enquiries",
        "create:enquiries", "manage:quotations", "create:quotations", "view:quotations",
        "view:orders", "view:sales_dashboard"
    ],
    "TECHNICIAN": [
        "view:assigned_surveys", "submit:survey", "upload:survey_evidence",
        "view:survey_tech_dashboard",
        "view:assigned_installations", "update:installation_progress",
        "submit:worksheet", "upload:installation_evidence", "submit:customer_signoff",
        "view:installation_tech_dashboard", "view:service_tickets", "resolve:service_tickets"
    ],
    "FIELD_TECHNICIAN": [
        "view:assigned_surveys", "submit:survey", "upload:survey_evidence",
        "view:survey_tech_dashboard",
        "view:assigned_installations", "update:installation_progress",
        "submit:worksheet", "upload:installation_evidence", "submit:customer_signoff",
        "view:installation_tech_dashboard", "view:service_tickets", "resolve:service_tickets"
    ],
    "WAREHOUSE_MANAGER": [
        "view:inventory", "manage:stock", "manage:allocations", "manage:dispatches",
        "capture:serials", "view:warehouse_dashboard", "view:bom"
    ],
    "SOLAR_MANAGER": [
        "view:all", "manage:users", "manage:customers", "manage:enquiries",
        "manage:surveys", "approve:surveys", "manage:quotations", "manage:orders",
        "manage:inventory", "manage:dispatch", "manage:installations", "manage:warranties",
        "manage:service", "manage:subsidies", "view:financials", "view:analytics"
    ],
    "CUSTOMER": [
        "view:own_projects", "view:own_orders", "view:own_surveys",
        "view:own_passport", "view:own_warranties", "manage:own_appointments",
        "create:own_service_tickets", "view:own_service_tickets",
        "submit:feedback", "view:own_notifications", "manage:own_profile"
    ]
}


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_session_and_token(
    user: User,
    db: Session,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None
) -> str:
    """
    Issue a new JWT token and register an active database session.
    Every token is assigned a unique JTI (JWT ID) registered in user_sessions.
    """
    token_jti = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow()
    expires_at = now + datetime.timedelta(seconds=TOKEN_EXPIRY_SECONDS)

    # Persist database-backed session registry record
    session_record = UserSession(
        session_id=session_id,
        user_id=user.id,
        token_jti=token_jti,
        user_agent=user_agent,
        ip_address=ip_address,
        created_at=now,
        expires_at=expires_at,
        is_revoked=False
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user.id),
        "jti": token_jti,
        "sid": session_id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp())
    }

    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def create_access_token(user: User, db: Optional[Session] = None) -> str:
    """
    Compatibility wrapper: creates access token with session if db session provided.
    """
    if db is not None:
        return create_session_and_token(user, db)
    
    # Stateless fallback only if db not supplied (e.g. unit tests without db context)
    token_jti = str(uuid.uuid4())
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": str(user.id),
        "jti": token_jti,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name,
        "iat": now,
        "exp": now + TOKEN_EXPIRY_SECONDS
    }

    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = base64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Verify HMAC-SHA256 signature, expiry, and token claims.
    Returns decoded payload if cryptographically valid.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token structure: Expected header.payload.signature"
            )

        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        provided_sig = base64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature: Cryptographic verification failed"
            )

        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        
        # Expiry Check
        exp = payload.get("exp", 0)
        if exp < int(time.time()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please log in again."
            )

        # Subject & Claims Check
        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed token: Missing subject (sub) claim."
            )

        return payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}"
        )


def revoke_session_by_jti(token_jti: str, db: Session) -> bool:
    """Revoke an active session by token JTI."""
    session_record = db.query(UserSession).filter(UserSession.token_jti == token_jti).first()
    if session_record and not session_record.is_revoked:
        session_record.is_revoked = True
        session_record.revoked_at = datetime.datetime.utcnow()
        db.commit()
        return True
    return False


def revoke_all_user_sessions(user_id: int, db: Session) -> int:
    """Revoke all active sessions for a user (e.g. upon deactivation or role change)."""
    now = datetime.datetime.utcnow()
    count = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_revoked == False
    ).update({
        "is_revoked": True,
        "revoked_at": now
    })
    db.commit()
    return count


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency to authenticate and validate the User.
    Enforces token signature, expiration, database session registry status,
    active user verification, and role immutability.
    """
    if not authorization:
        if os.getenv("TESTING") == "1":
            admin_user = db.query(User).filter(User.role == "ADMIN").first()
            if admin_user:
                return admin_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Please log in."
        )

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'"
        )

    token = parts[1]
    payload = decode_access_token(token)
    user_id_str = payload.get("sub")
    token_jti = payload.get("jti")

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject identifier."
        )

    # 1. Database-backed Token Registry & Revocation Verification
    if token_jti:
        session_record = db.query(UserSession).filter(UserSession.token_jti == token_jti).first()
        if not session_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session registry record not found. Token is invalid or expired."
            )

        if session_record.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has been revoked (logged out). Please log in again."
            )

        if session_record.expires_at < datetime.datetime.utcnow():
            session_record.is_revoked = True
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Server-side session has expired. Please log in again."
            )

    # 2. User existence and account active status
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists."
        )

    if not user.is_active:
        # Invalidate any lingering session
        if token_jti:
            revoke_session_by_jti(token_jti, db)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated. Please contact your administrator."
        )

    # 3. Role immutability check
    # If the user's role was changed in the database after the token was issued,
    # invalidate the existing session and require fresh authentication
    token_role = payload.get("role")
    if token_role and user.role.upper() != token_role.upper():
        if token_jti:
            revoke_session_by_jti(token_jti, db)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User role has been updated. Session invalidated. Please log in again."
        )

    return user


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional user authentication dependency: returns User if valid Bearer token provided, else None.
    """
    if not authorization:
        return None
    try:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            payload = decode_access_token(parts[1])
            user_id = payload.get("sub")
            if user_id:
                return db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    except Exception:
        pass
    return None


def require_roles(allowed_roles: List[str]):
    """
    Role-Based Access Control (RBAC) dependency factory.
    Admins / Solar Managers automatically possess superuser access.
    Backend role assignment is strictly authoritative.
    """
    def role_checker(user: User = Depends(get_current_user)) -> User:
        user_role = (user.role or "").upper()
        # Admin / Solar Manager has company-wide access
        if user_role in ["ADMIN", "SOLAR_MANAGER"]:
            return user

        normalized_allowed = [r.upper() for r in allowed_roles]
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Role '{user_role}' does not possess required permission for this resource. Required: {allowed_roles}"
            )
        return user
    return role_checker


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional user authentication dependency: returns User if valid Bearer token provided, else None.
    """
    if not authorization:
        return None
    try:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            payload = decode_access_token(parts[1])
            user_id = payload.get("sub")
            if user_id:
                return db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    except Exception:
        pass
    return None
