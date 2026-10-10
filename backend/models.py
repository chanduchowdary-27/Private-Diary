from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime
from datetime import datetime, timezone
import json

try:
    from .database import Base
except ImportError:
    from database import Base

def utc_now():
    return datetime.now(timezone.utc)

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    vault_password_hash = Column(String, nullable=True)
    recovery_key_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)

class DiaryEntryModel(Base):
    __tablename__ = "diary_entries"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    mood = Column(String, default="peaceful")
    tags_json = Column(Text, default="[]")
    date = Column(DateTime, default=utc_now)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    is_draft = Column(Boolean, default=False)

    @property
    def tags(self):
        try:
            return json.loads(self.tags_json)
        except Exception:
            return []

    @tags.setter
    def tags(self, val):
        self.tags_json = json.dumps(val or [])

class MediaModel(Base):
    __tablename__ = "gallery_media"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    media_type = Column(String, nullable=False)  # 'image' or 'video'
    mime_type = Column(String, nullable=False)
    size = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    album = Column(String, default="All")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now)

class NoteModel(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    note_type = Column(String, default="note")  # 'note', 'todo', 'goal', 'gratitude', 'mood'
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    tags_json = Column(Text, default="[]")
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    @property
    def tags(self):
        try:
            return json.loads(self.tags_json)
        except Exception:
            return []

    @tags.setter
    def tags(self, val):
        self.tags_json = json.dumps(val or [])
