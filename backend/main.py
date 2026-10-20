from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
import os
import re
import uuid
from datetime import datetime, timezone


try:
    from .database import engine, Base, get_db, init_db
    from .models import UserModel, DiaryEntryModel, MediaModel, NoteModel
    from .schemas import (
        DiaryEntryCreate, DiaryEntryResponse,
        NoteCreate, NoteResponse,
        MediaResponse, RegisterRequest, LoginRequest, UnlockRequest,
        AuthRequest, AuthResponse
    )
    from .security import (
        hash_password, verify_password, generate_recovery_key,
        create_access_token, decode_access_token,
        check_rate_limit, record_failed_attempt, clear_failed_attempts
    )
except ImportError:
    from database import engine, Base, get_db, init_db
    from models import UserModel, DiaryEntryModel, MediaModel, NoteModel
    from schemas import (
        DiaryEntryCreate, DiaryEntryResponse,
        NoteCreate, NoteResponse,
        MediaResponse, RegisterRequest, LoginRequest, UnlockRequest,
        AuthRequest, AuthResponse
    )
    from security import (
        hash_password, verify_password, generate_recovery_key,
        create_access_token, decode_access_token,
        check_rate_limit, record_failed_attempt, clear_failed_attempts
    )

# Run database table initialization and migrations safely
init_db()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="My Private Princess Diary API", version="2.0.0")

# Allow CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://private-diary-chi.vercel.app",
        "https://private-diary-17aeamufe-chand14.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# ─── AUTHENTICATION DEPENDENCIES ──────────────────────────────

def extract_token_from_header_or_query(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> str:
    """Extract Bearer token from Authorization header or ?token= query parameter."""
    if authorization and authorization.startswith("Bearer "):
        return authorization.split("Bearer ")[1].strip()
    if token:
        return token.strip()
    raise HTTPException(
        status_code=401,
        detail="Authentication required. Please sign in to your diary."
    )

def get_authenticated_user(
    token_str: str = Depends(extract_token_from_header_or_query),
    db: Session = Depends(get_db)
) -> Tuple[UserModel, dict]:
    """Verify JWT and return (UserModel, payload)."""
    payload = decode_access_token(token_str)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token.")

    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")

    return user, payload

def get_unlocked_user(
    auth_data: Tuple[UserModel, dict] = Depends(get_authenticated_user)
) -> UserModel:
    """Ensure user is authenticated AND vault is unlocked before accessing private data."""
    user, payload = auth_data
    if not payload.get("vault_unlocked", False):
        raise HTTPException(
            status_code=403,
            detail="Vault is locked. Please enter your vault password to decrypt content."
        )
    return user

# ═══════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.post("/api/auth/register", response_model=AuthResponse)
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    if not EMAIL_REGEX.match(email_clean):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Account password must be at least 8 characters.")

    # Check for duplicate email
    existing = db.query(UserModel).filter(UserModel.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email address already exists.")

    vault_pwd = req.vaultPassword if req.vaultPassword else req.password
    if len(vault_pwd) < 8:
        raise HTTPException(status_code=400, detail="Vault password must be at least 8 characters.")

    # Generate 24-word recovery key
    recovery_key = generate_recovery_key()

    # Hash passwords using Argon2id
    pwd_hash = hash_password(req.password)
    vault_hash = hash_password(vault_pwd)
    recovery_hash = hash_password(" ".join(recovery_key.strip().split()))

    # Consistent user ID generation preserving existing accounts where applicable
    slug = re.sub(r'[^a-zA-Z0-9_]', '_', email_clean)
    user_id = f"user_{slug}"

    now = datetime.now(timezone.utc)
    new_user = UserModel(
        id=user_id,
        email=email_clean,
        password_hash=pwd_hash,
        vault_password_hash=vault_hash,
        recovery_key_hash=recovery_hash,
        created_at=now,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Initial token: authenticated but vault is locked
    token = create_access_token(user_id=new_user.id, email=new_user.email, vault_unlocked=False)

    return AuthResponse(
        userId=new_user.id,
        email=new_user.email,
        token=token,
        isUnlocked=False,
        recoveryKey=recovery_key,
        message="Account created successfully. Please unlock your vault."
    )

@app.post("/api/auth/login", response_model=AuthResponse)
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    if not email_clean or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    # Rate limiting protection
    check_rate_limit(email_clean)

    user = db.query(UserModel).filter(UserModel.email == email_clean).first()
    if not user:
        record_failed_attempt(email_clean)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(user.password_hash, req.password):
        record_failed_attempt(email_clean)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Successful login: reset rate limiter
    clear_failed_attempts(email_clean)

    # Issue initial session token with vault locked
    token = create_access_token(user_id=user.id, email=user.email, vault_unlocked=False)

    return AuthResponse(
        userId=user.id,
        email=user.email,
        token=token,
        isUnlocked=False,
        message="Sign in successful. Please unlock your vault."
    )

@app.post("/api/auth/unlock", response_model=AuthResponse)
def unlock_vault(
    req: UnlockRequest,
    auth_data: Tuple[UserModel, dict] = Depends(get_authenticated_user)
):
    user, _ = auth_data
    rate_key = f"unlock_{user.id}"
    check_rate_limit(rate_key)

    verified = False
    if req.vaultPassword:
        # Check against vault password or account password fallback
        target_hash = user.vault_password_hash or user.password_hash
        if verify_password(target_hash, req.vaultPassword):
            verified = True
    elif req.recoveryKey:
        norm_key = " ".join(req.recoveryKey.strip().split())
        if user.recovery_key_hash and verify_password(user.recovery_key_hash, norm_key):
            verified = True

    if not verified:
        record_failed_attempt(rate_key)
        raise HTTPException(status_code=401, detail="Incorrect vault password or invalid recovery key.")

    clear_failed_attempts(rate_key)

    # Issue new token with vault_unlocked = True
    unlocked_token = create_access_token(user_id=user.id, email=user.email, vault_unlocked=True)

    return AuthResponse(
        userId=user.id,
        email=user.email,
        token=unlocked_token,
        isUnlocked=True,
        message="Vault unlocked successfully."
    )

@app.get("/api/auth/me")
def get_current_user_profile(
    auth_data: Tuple[UserModel, dict] = Depends(get_authenticated_user)
):
    user, payload = auth_data
    return {
        "userId": user.id,
        "email": user.email,
        "isUnlocked": payload.get("vault_unlocked", False),
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }

@app.post("/api/auth/logout")
def logout_user():
    return {"success": True, "message": "Logged out successfully."}

# ═══════════════════════════════════════════════════════════════
# DIARY ENDPOINTS (Protected by get_unlocked_user)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/diary", response_model=List[DiaryEntryResponse])
def get_diary_entries(
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    entries = db.query(DiaryEntryModel).filter(
        DiaryEntryModel.user_id == user.id
    ).order_by(DiaryEntryModel.date.desc()).all()

    return [
        DiaryEntryResponse(
            id=e.id,
            userId=e.user_id,
            title=e.title,
            content=e.content,
            mood=e.mood,
            tags=e.tags,
            date=e.date.isoformat(),
            createdAt=e.created_at.isoformat(),
            updatedAt=e.updated_at.isoformat(),
        ) for e in entries
    ]

@app.get("/api/diary/{entry_id}", response_model=DiaryEntryResponse)
def get_diary_entry(
    entry_id: str,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    e = db.query(DiaryEntryModel).filter(
        DiaryEntryModel.id == entry_id,
        DiaryEntryModel.user_id == user.id
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Diary entry not found.")

    return DiaryEntryResponse(
        id=e.id,
        userId=e.user_id,
        title=e.title,
        content=e.content,
        mood=e.mood,
        tags=e.tags,
        date=e.date.isoformat(),
        createdAt=e.created_at.isoformat(),
        updatedAt=e.updated_at.isoformat(),
    )

@app.post("/api/diary", response_model=DiaryEntryResponse)
def create_or_update_diary(
    entry: DiaryEntryCreate,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    entry_id = entry.id if (entry.id and entry.id != "new") else str(uuid.uuid4())
    existing = db.query(DiaryEntryModel).filter(DiaryEntryModel.id == entry_id).first()
    now = datetime.now(timezone.utc)

    if existing:
        # Strict ownership check: prevent editing another user's entry
        if existing.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied to this entry.")

        existing.title = entry.title
        existing.content = entry.content
        if entry.mood:
            existing.mood = entry.mood
        if entry.tags is not None:
            existing.tags = entry.tags
        if entry.date:
            existing.date = entry.date
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        e = existing
    else:
        e = DiaryEntryModel(
            id=entry_id,
            user_id=user.id,
            title=entry.title,
            content=entry.content,
            mood=entry.mood or "peaceful",
            tags=entry.tags or [],
            date=entry.date or now,
            created_at=now,
            updated_at=now,
        )
        db.add(e)
        db.commit()
        db.refresh(e)

    return DiaryEntryResponse(
        id=e.id,
        userId=e.user_id,
        title=e.title,
        content=e.content,
        mood=e.mood,
        tags=e.tags,
        date=e.date.isoformat(),
        createdAt=e.created_at.isoformat(),
        updatedAt=e.updated_at.isoformat(),
    )

@app.delete("/api/diary/{entry_id}")
def delete_diary_entry(
    entry_id: str,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    e = db.query(DiaryEntryModel).filter(
        DiaryEntryModel.id == entry_id,
        DiaryEntryModel.user_id == user.id
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Diary entry not found.")

    db.delete(e)
    db.commit()
    return {"success": True}

# ═══════════════════════════════════════════════════════════════
# GALLERY ENDPOINTS (Protected by get_unlocked_user)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/gallery", response_model=List[MediaResponse])
def get_gallery_items(
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    items = db.query(MediaModel).filter(
        MediaModel.user_id == user.id
    ).order_by(MediaModel.created_at.desc()).all()

    return [
        MediaResponse(
            id=m.id,
            userId=m.user_id,
            name=m.name,
            type=m.media_type,
            mimeType=m.mime_type,
            size=m.size,
            album=m.album,
            createdAt=m.created_at.isoformat(),
            updatedAt=m.updated_at.isoformat(),
            url=f"/api/gallery/file/{m.id}",
        ) for m in items
    ]

@app.post("/api/gallery/upload", response_model=MediaResponse)
async def upload_gallery_media(
    file: UploadFile = File(...),
    album: str = Form("All"),
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    media_id = str(uuid.uuid4())
    content = await file.read()
    size = len(content)

    if size > 200 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 200MB limit.")

    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{media_id}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(dest_path, "wb") as f:
        f.write(content)

    media_type = "video" if file.content_type.startswith("video/") else "image"
    now = datetime.now(timezone.utc)

    media = MediaModel(
        id=media_id,
        user_id=user.id,
        name=file.filename,
        media_type=media_type,
        mime_type=file.content_type,
        size=size,
        file_path=safe_filename,
        album=album,
        created_at=now,
        updated_at=now,
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    return MediaResponse(
        id=media.id,
        userId=media.user_id,
        name=media.name,
        type=media.media_type,
        mimeType=media.mime_type,
        size=media.size,
        album=media.album,
        createdAt=media.created_at.isoformat(),
        updatedAt=media.updated_at.isoformat(),
        url=f"/api/gallery/file/{media.id}",
    )

@app.get("/api/gallery/file/{media_id}")
def get_media_file(
    media_id: str,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    # Enforce strict ownership: User B CANNOT download User A's file
    media = db.query(MediaModel).filter(
        MediaModel.id == media_id,
        MediaModel.user_id == user.id
    ).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media file not found or access denied.")

    full_path = os.path.join(UPLOAD_DIR, media.file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File on storage disk missing.")

    return FileResponse(full_path, media_type=media.mime_type)

@app.delete("/api/gallery/{media_id}")
def delete_gallery_media(
    media_id: str,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    media = db.query(MediaModel).filter(
        MediaModel.id == media_id,
        MediaModel.user_id == user.id
    ).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media item not found.")

    full_path = os.path.join(UPLOAD_DIR, media.file_path)
    if os.path.exists(full_path):
        try:
            os.remove(full_path)
        except Exception:
            pass

    db.delete(media)
    db.commit()
    return {"success": True}

# ═══════════════════════════════════════════════════════════════
# NOTES & TO-DO ENDPOINTS (Protected by get_unlocked_user)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/notes", response_model=List[NoteResponse])
def get_notes(
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    notes = db.query(NoteModel).filter(
        NoteModel.user_id == user.id
    ).order_by(NoteModel.created_at.desc()).all()

    return [
        NoteResponse(
            id=n.id,
            userId=n.user_id,
            type=n.note_type,
            title=n.title,
            content=n.content,
            tags=n.tags,
            completed=n.completed,
            createdAt=n.created_at.isoformat(),
            updatedAt=n.updated_at.isoformat(),
        ) for n in notes
    ]

@app.post("/api/notes", response_model=NoteResponse)
def create_or_update_note(
    note: NoteCreate,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    note_id = note.id or str(uuid.uuid4())
    existing = db.query(NoteModel).filter(NoteModel.id == note_id).first()
    now = datetime.now(timezone.utc)

    if existing:
        if existing.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied to this note.")

        existing.title = note.title
        existing.content = note.content
        existing.note_type = note.type
        if note.tags is not None:
            existing.tags = note.tags
        if note.completed is not None:
            existing.completed = note.completed
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        n = existing
    else:
        n = NoteModel(
            id=note_id,
            user_id=user.id,
            note_type=note.type,
            title=note.title,
            content=note.content,
            tags=note.tags or [],
            completed=note.completed or False,
            created_at=now,
            updated_at=now,
        )
        db.add(n)
        db.commit()
        db.refresh(n)

    return NoteResponse(
        id=n.id,
        userId=n.user_id,
        type=n.note_type,
        title=n.title,
        content=n.content,
        tags=n.tags,
        completed=n.completed,
        createdAt=n.created_at.isoformat(),
        updatedAt=n.updated_at.isoformat(),
    )

@app.patch("/api/notes/{note_id}/toggle", response_model=NoteResponse)
def toggle_note_completed(
    note_id: str,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    n = db.query(NoteModel).filter(
        NoteModel.id == note_id,
        NoteModel.user_id == user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")

    n.completed = not n.completed
    n.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(n)

    return NoteResponse(
        id=n.id,
        userId=n.user_id,
        type=n.note_type,
        title=n.title,
        content=n.content,
        tags=n.tags,
        completed=n.completed,
        createdAt=n.created_at.isoformat(),
        updatedAt=n.updated_at.isoformat(),
    )

@app.delete("/api/notes/{note_id}")
def delete_note(
    note_id: str,
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    n = db.query(NoteModel).filter(
        NoteModel.id == note_id,
        NoteModel.user_id == user.id
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")

    db.delete(n)
    db.commit()
    return {"success": True}

# ═══════════════════════════════════════════════════════════════
# STATS ENDPOINT (Protected by get_unlocked_user)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/stats")
def get_stats(
    user: UserModel = Depends(get_unlocked_user),
    db: Session = Depends(get_db)
):
    entries_count = db.query(DiaryEntryModel).filter(DiaryEntryModel.user_id == user.id).count()
    media_count = db.query(MediaModel).filter(MediaModel.user_id == user.id).count()
    notes_count = db.query(NoteModel).filter(NoteModel.user_id == user.id).count()
    return {
        "entriesCount": entries_count,
        "mediaCount": media_count,
        "notesCount": notes_count,
    }
