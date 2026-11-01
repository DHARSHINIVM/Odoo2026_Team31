import os
import uuid
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.database import get_db
from app.models import Document
from app.services.audit_service import AuditService
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/documents", tags=["Document Management"], dependencies=[Depends(get_current_user)])

# Local uploads directory configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "documents")
os.makedirs(DOCS_UPLOAD_DIR, exist_ok=True)

ALLOWED_DOC_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".webp",
    ".docx", ".xlsx", ".csv", ".txt"
}
MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

VALID_CATEGORIES = [
    "SURVEY_REPORT",
    "QUOTATION_DOC",
    "INSTALLATION_PHOTO",
    "COMMISSIONING_REPORT",
    "WARRANTY_CERTIFICATE",
    "SERVICE_DOCUMENT",
    "CUSTOMER_ID_PROOF",
    "ELECTRICITY_BILL",
    "TECHNICAL_SPECIFICATION",
    "GOVERNMENT_SUBSIDY_APPROVAL",
    "OTHER"
]

VALID_ENTITY_TYPES = [
    "CUSTOMER",
    "ENQUIRY",
    "SURVEY",
    "QUOTATION",
    "ORDER",
    "INSTALLATION",
    "PASSPORT",
    "WARRANTY",
    "SERVICE_TICKET",
    "COMPONENT"
]


def _format_document(d: Document) -> dict:
    return {
        "id": d.id,
        "uuid": d.uuid,
        "title": d.title,
        "category": d.category,
        "file_name": d.file_name,
        "original_file_name": d.original_file_name,
        "file_url": d.file_url,
        "file_size_bytes": d.file_size_bytes,
        "file_size_display": f"{round(d.file_size_bytes / 1024, 1)} KB" if d.file_size_bytes < 1024 * 1024 else f"{round(d.file_size_bytes / (1024 * 1024), 2)} MB",
        "mime_type": d.mime_type,
        "entity_type": d.entity_type,
        "entity_id": d.entity_id,
        "entity_identifier": d.entity_identifier,
        "uploaded_by_user_id": d.uploaded_by_user_id,
        "uploaded_by_name": d.uploaded_by_name or "Staff",
        "notes": d.notes,
        "is_archived": d.is_archived,
        "created_at": d.created_at.isoformat() if d.created_at else None
    }


@router.get("")
def list_documents(
    entity_type: Optional[str] = Query(None, description="Filter by business entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    category: Optional[str] = Query(None, description="Filter by document category"),
    search: Optional[str] = Query(None, description="Search by title, original filename, or notes"),
    include_archived: bool = Query(False, description="Include soft-deleted documents"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Feature 6: Search and retrieve project document records across all modules.
    """
    query = db.query(Document)

    if not isinstance(include_archived, bool) or not include_archived:
        query = query.filter(Document.is_archived == False)

    if entity_type and isinstance(entity_type, str) and entity_type.upper() != "ALL":
        query = query.filter(Document.entity_type == entity_type.upper())

    if entity_id is not None and isinstance(entity_id, int):
        query = query.filter(Document.entity_id == entity_id)

    if category and isinstance(category, str) and category.upper() != "ALL":
        query = query.filter(Document.category == category.upper())

    if search and isinstance(search, str) and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Document.title.ilike(s),
                Document.original_file_name.ilike(s),
                Document.entity_identifier.ilike(s),
                Document.notes.ilike(s)
            )
        )

    total_count = query.count()
    docs = query.order_by(desc(Document.created_at)).offset(skip).limit(limit).all()

    return {
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "documents": [_format_document(d) for d in docs]
    }


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("OTHER"),
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    entity_identifier: Optional[str] = Form(None),
    uploaded_by_name: Optional[str] = Form("Solar Operations"),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Feature 6: Unified document upload endpoint:
    - Stores file content on local disk with sanitized filename (no blob in SQLite).
    - Stores metadata record in SQLite.
    - Emits persistent AuditLog entry.
    """
    # 1. Validate Category and Entity Type
    cat_upper = category.upper()
    if cat_upper not in VALID_CATEGORIES:
        cat_upper = "OTHER"

    ent_upper = entity_type.upper()
    if ent_upper not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type '{entity_type}'. Allowed: {', '.join(VALID_ENTITY_TYPES)}"
        )

    # 2. Validate Extension
    orig_name = file.filename or "uploaded_document.pdf"
    _, ext = os.path.splitext(orig_name)
    ext_lower = ext.lower()
    if ext_lower not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext_lower}'. Allowed: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}"
        )

    # 3. Read and validate size
    content = await file.read()
    file_size = len(content)
    if file_size > MAX_DOC_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed limit of 10 MB (size: {round(file_size / (1024*1024), 2)} MB)."
        )

    # 4. Safe Filename Generation
    safe_token = uuid.uuid4().hex[:12]
    clean_base = "".join(c for c in os.path.splitext(orig_name)[0] if c.isalnum() or c in ("-", "_"))[:32]
    safe_filename = f"{ent_upper.lower()}_{entity_id}_{safe_token}_{clean_base}{ext_lower}"
    rel_path = os.path.join("documents", safe_filename)
    full_path = os.path.join(DOCS_UPLOAD_DIR, safe_filename)

    with open(full_path, "wb") as f_out:
        f_out.write(content)

    # 5. Persist Document Record
    mime = file.content_type or "application/octet-stream"
    doc = Document(
        title=title.strip() or orig_name,
        category=cat_upper,
        file_name=safe_filename,
        original_file_name=orig_name,
        file_path=rel_path,
        file_url=f"/uploads/documents/{safe_filename}",
        file_size_bytes=file_size,
        mime_type=mime,
        entity_type=ent_upper,
        entity_id=entity_id,
        entity_identifier=entity_identifier,
        uploaded_by_name=uploaded_by_name,
        notes=notes,
        is_archived=False,
        created_at=datetime.datetime.utcnow()
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 6. Audit Trail Recording
    AuditService.log(
        db=db,
        action="UPLOAD",
        entity_type=ent_upper,
        entity_id=entity_id,
        entity_identifier=entity_identifier or f"{ent_upper}-{entity_id}",
        new_values={
            "document_id": doc.id,
            "title": doc.title,
            "category": doc.category,
            "filename": orig_name,
            "size_bytes": file_size
        },
        details=f"Uploaded {doc.category} document '{doc.title}' ({orig_name}) for {ent_upper} #{entity_id}",
        user_name=uploaded_by_name
    )

    return {
        "success": True,
        "message": f"Document '{doc.title}' uploaded successfully.",
        "document": _format_document(doc)
    }


@router.get("/{document_id}")
def get_document_details(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found")
    return _format_document(doc)


@router.get("/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db)):
    """Safe document retrieval and download stream."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found")

    file_path = os.path.join(DOCS_UPLOAD_DIR, doc.file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Stored document file missing from server storage.")

    return FileResponse(
        path=file_path,
        filename=doc.original_file_name,
        media_type=doc.mime_type
    )


@router.delete("/{document_id}")
def archive_document(
    document_id: int,
    permanent: bool = Query(False, description="Whether to permanently purge"),
    user_name: Optional[str] = Query("Staff", description="Operating user"),
    db: Session = Depends(get_db)
):
    """Archive or remove document with mandatory audit log."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found")

    ent_type = doc.entity_type
    ent_id = doc.entity_id
    title = doc.title

    if permanent:
        # Delete local file if present
        file_path = os.path.join(DOCS_UPLOAD_DIR, doc.file_name)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        db.delete(doc)
        action_name = "DELETE_PERMANENT"
        msg = f"Document '{title}' permanently purged."
    else:
        doc.is_archived = True
        action_name = "ARCHIVE"
        msg = f"Document '{title}' moved to archive."

    db.commit()

    AuditService.log(
        db=db,
        action=action_name,
        entity_type=ent_type,
        entity_id=ent_id,
        details=f"{msg} Action executed by {user_name}.",
        user_name=user_name
    )

    return {
        "success": True,
        "message": msg
    }

