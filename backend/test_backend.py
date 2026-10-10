import pytest
from fastapi.testclient import TestClient
import os
import shutil

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app, UPLOAD_DIR
from database import Base, get_db

TEST_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_diary.db")
TEST_DB_URL = f"sqlite:///{TEST_DB_PATH}"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    if os.path.exists(UPLOAD_DIR):
        shutil.rmtree(UPLOAD_DIR)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    yield

def get_auth_headers():
    reg = client.post("/api/auth/register", json={
        "email": "test_princess@palace.org",
        "password": "Password123!",
        "vaultPassword": "VaultSecret123!"
    }).json()
    unlocked = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {reg['token']}"}, json={
        "vaultPassword": "VaultSecret123!"
    }).json()
    return {"Authorization": f"Bearer {unlocked['token']}"}

def test_auth_and_diary_crud():
    headers = get_auth_headers()

    # 1. Create diary entry
    create_resp = client.post("/api/diary", headers=headers, json={
        "title": "Royal Gala Evening",
        "content": "Dancing under crystal chandeliers.",
        "mood": "excited",
        "tags": ["ball", "gala"]
    })
    assert create_resp.status_code == 200
    entry = create_resp.json()
    assert entry["title"] == "Royal Gala Evening"
    entry_id = entry["id"]

    # 2. Get diary entries
    list_resp = client.get("/api/diary", headers=headers)
    assert list_resp.status_code == 200
    entries = list_resp.json()
    assert len(entries) == 1
    assert entries[0]["id"] == entry_id

    # 3. Update diary entry
    update_resp = client.post("/api/diary", headers=headers, json={
        "id": entry_id,
        "title": "Royal Gala Evening (Extended)",
        "content": "Dancing under crystal chandeliers all night.",
        "mood": "grateful",
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Royal Gala Evening (Extended)"

    # 4. Delete diary entry
    del_resp = client.delete(f"/api/diary/{entry_id}", headers=headers)
    assert del_resp.status_code == 200

    list_after = client.get("/api/diary", headers=headers).json()
    assert len(list_after) == 0

def test_notes_and_todo():
    headers = get_auth_headers()

    # Create note
    note_resp = client.post("/api/notes", headers=headers, json={
        "type": "note",
        "title": "Piano Notes",
        "content": "Mozart Sonata in C Major",
        "tags": ["music"]
    })
    assert note_resp.status_code == 200
    note_id = note_resp.json()["id"]

    # Create to-do
    todo_resp = client.post("/api/notes", headers=headers, json={
        "type": "todo",
        "title": "Prepare tiara",
        "content": "Polish emeralds",
        "completed": False
    })
    assert todo_resp.status_code == 200
    todo_id = todo_resp.json()["id"]

    # Toggle to-do
    toggle_resp = client.patch(f"/api/notes/{todo_id}/toggle", headers=headers)
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["completed"] is True

    # Check both exist
    notes = client.get("/api/notes", headers=headers).json()
    assert len(notes) == 2

    # Delete
    del_resp = client.delete(f"/api/notes/{note_id}", headers=headers)
    assert del_resp.status_code == 200
    notes_after = client.get("/api/notes", headers=headers).json()
    assert len(notes_after) == 1
    assert notes_after[0]["id"] == todo_id

def test_gallery_upload_and_download():
    headers = get_auth_headers()
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"

    upload_resp = client.post(
        "/api/gallery/upload",
        headers=headers,
        data={"album": "Memories"},
        files={"file": ("tiara.png", fake_png, "image/png")}
    )
    assert upload_resp.status_code == 200
    media = upload_resp.json()
    assert media["name"] == "tiara.png"
    assert media["type"] == "image"
    media_id = media["id"]

    # Download file
    dl_resp = client.get(f"/api/gallery/file/{media_id}", headers=headers)
    assert dl_resp.status_code == 200
    assert dl_resp.content == fake_png

    # Delete
    del_resp = client.delete(f"/api/gallery/{media_id}", headers=headers)
    assert del_resp.status_code == 200
