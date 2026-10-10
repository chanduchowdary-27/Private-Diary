from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DiaryEntryCreate(BaseModel):
    id: Optional[str] = None
    title: str
    content: str
    mood: Optional[str] = "peaceful"
    tags: Optional[List[str]] = []
    date: Optional[datetime] = None

class DiaryEntryResponse(BaseModel):
    id: str
    userId: str
    title: str
    content: str
    mood: str
    tags: List[str]
    date: str
    createdAt: str
    updatedAt: str

class NoteCreate(BaseModel):
    id: Optional[str] = None
    type: str = "note"
    title: str
    content: str
    tags: Optional[List[str]] = []
    completed: Optional[bool] = False

class NoteResponse(BaseModel):
    id: str
    userId: str
    type: str
    title: str
    content: str
    tags: List[str]
    completed: bool
    createdAt: str
    updatedAt: str

class MediaResponse(BaseModel):
    id: str
    userId: str
    name: str
    type: str
    mimeType: str
    size: int
    album: str
    createdAt: str
    updatedAt: str
    url: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    vaultPassword: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class UnlockRequest(BaseModel):
    vaultPassword: Optional[str] = None
    recoveryKey: Optional[str] = None

class AuthRequest(BaseModel):
    email: str
    password: Optional[str] = None
    vaultPassword: Optional[str] = None

class AuthResponse(BaseModel):
    userId: str
    email: str
    token: str
    isUnlocked: bool = False
    recoveryKey: Optional[str] = None
    message: Optional[str] = None
