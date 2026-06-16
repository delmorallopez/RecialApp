# routes/documents.py

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import os, uuid, shutil

from database import get_db
from models.documents import DispatchDocument, DOC_TYPES, DOC_LABELS

router = APIRouter(prefix="/documents", tags=["Documents"])

# ── Storage path ──────────────────────────────────────────
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


# ── GET /documents/dispatch/{dispatch_id} ─────────────────
# List all documents for a dispatch
@router.get("/dispatch/{dispatch_id}")
def get_documents(
    dispatch_id: int,
    db: Session = Depends(get_db),
):
    docs = db.query(DispatchDocument).filter(
        DispatchDocument.dispatch_id == dispatch_id
    ).order_by(DispatchDocument.doc_type, DispatchDocument.uploaded_at).all()

    # Group by doc_type and include label
    result = {}
    for doc_type in DOC_TYPES:
        result[doc_type] = {
            "doc_type": doc_type,
            "label":    DOC_LABELS[doc_type],
            "files":    [],
        }

    for doc in docs:
        if doc.doc_type in result:
            result[doc.doc_type]["files"].append({
                "id":          doc.id,
                "filename":    doc.filename,
                "mime_type":   doc.mime_type,
                "file_size":   doc.file_size,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            })

    return {
        "dispatch_id": dispatch_id,
        "documents":   list(result.values()),
        "total_files": len(docs),
        "uploaded_types": list({d.doc_type for d in docs}),
    }


# ── POST /documents/dispatch/{dispatch_id}/{doc_type} ─────
# Upload a document
@router.post("/dispatch/{dispatch_id}/{doc_type}", status_code=201)
async def upload_document(
    dispatch_id: int,
    doc_type:    str,
    file:        UploadFile = File(...),
    db:          Session = Depends(get_db),
):
    if doc_type not in DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Must be one of: {', '.join(DOC_TYPES)}"
        )

    # Check mime type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: PDF, JPG, PNG, Word, Excel"
        )

    # Read and check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is 20MB."
        )

    # Generate unique stored filename
    ext = os.path.splitext(file.filename)[1].lower()
    stored_name = f"{dispatch_id}_{doc_type}_{uuid.uuid4().hex}{ext}"
    file_path   = os.path.join(UPLOAD_DIR, stored_name)

    # Save to disk
    with open(file_path, "wb") as f:
        f.write(contents)

    # Save record to DB
    doc = DispatchDocument(
        dispatch_id = dispatch_id,
        doc_type    = doc_type,
        filename    = file.filename,
        stored_name = stored_name,
        mime_type   = file.content_type,
        file_size   = len(contents),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "id":          doc.id,
        "filename":    doc.filename,
        "doc_type":    doc.doc_type,
        "label":       DOC_LABELS[doc_type],
        "file_size":   doc.file_size,
        "mime_type":   doc.mime_type,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
    }


# ── GET /documents/{document_id}/download ─────────────────
# Download a document
@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
):
    doc = db.query(DispatchDocument).filter(
        DispatchDocument.id == document_id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.join(UPLOAD_DIR, doc.stored_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path         = file_path,
        filename     = doc.filename,
        media_type   = doc.mime_type or "application/octet-stream",
        headers      = {"Content-Disposition": f'attachment; filename="{doc.filename}"'}
    )


# ── DELETE /documents/{document_id} ───────────────────────
# Delete a document
@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db:          Session = Depends(get_db),
):
    doc = db.query(DispatchDocument).filter(
        DispatchDocument.id == document_id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    file_path = os.path.join(UPLOAD_DIR, doc.stored_name)
    if os.path.exists(file_path):
        os.remove(file_path)

    # Delete DB record
    db.delete(doc)
    db.commit()
    return None
