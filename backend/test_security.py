import pytest
from fastapi.testclient import TestClient
import os
import shutil
import jwt
from datetime import datetime, timezone, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app, UPLOAD_DIR
from database import Base, get_db
from security import SECRET_KEY, ALGORITHM

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

# Scenario 1: A new user can register successfully
def test_scenario_01_registration_success():
    resp = client.post("/api/auth/register", json={
        "email": "aurora@palace.org",
        "password": "Password123!",
        "vaultPassword": "VaultMasterSecret123"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "aurora@palace.org"
    assert data["userId"] == "user_aurora_palace_org"
    assert data["token"] is not None
    assert data["isUnlocked"] is False
    assert data["recoveryKey"] is not None
    assert len(data["recoveryKey"].split()) == 24

# Scenario 2: Registering the same email twice fails
def test_scenario_02_duplicate_registration_fails():
    client.post("/api/auth/register", json={
        "email": "cinderella@castle.org",
        "password": "GlassSlipper123!"
    })
    dup_resp = client.post("/api/auth/register", json={
        "email": "cinderella@castle.org",
        "password": "GlassSlipper123!"
    })
    assert dup_resp.status_code == 409
    assert "already exists" in dup_resp.json()["detail"].lower()

# Scenario 3: A registered user can sign in with the correct password
def test_scenario_03_login_success():
    client.post("/api/auth/register", json={
        "email": "belle@library.org",
        "password": "EnchantedRose123!"
    })
    login_resp = client.post("/api/auth/login", json={
        "email": "belle@library.org",
        "password": "EnchantedRose123!"
    })
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert data["email"] == "belle@library.org"
    assert data["token"] is not None
    assert data["isUnlocked"] is False

# Scenario 4: An unknown email cannot sign in
def test_scenario_04_unknown_email_rejected():
    login_resp = client.post("/api/auth/login", json={
        "email": "stranger@unknown.org",
        "password": "RandomPassword123!"
    })
    assert login_resp.status_code == 401
    assert "invalid" in login_resp.json()["detail"].lower()

# Scenario 5: An incorrect password cannot sign in
def test_scenario_05_incorrect_password_rejected():
    client.post("/api/auth/register", json={
        "email": "jasmine@agraba.org",
        "password": "MagicCarpet123!"
    })
    wrong_pwd = client.post("/api/auth/login", json={
        "email": "jasmine@agraba.org",
        "password": "WrongPassword999!"
    })
    assert wrong_pwd.status_code == 401
    assert "invalid" in wrong_pwd.json()["detail"].lower()

# Scenario 6: Empty or malformed credentials are rejected
def test_scenario_06_malformed_credentials_rejected():
    # Empty fields
    r1 = client.post("/api/auth/register", json={"email": "", "password": ""})
    assert r1.status_code == 400

    # Malformed email
    r2 = client.post("/api/auth/register", json={"email": "not-an-email", "password": "Password123!"})
    assert r2.status_code == 400

    # Password too short (< 8 chars)
    r3 = client.post("/api/auth/register", json={"email": "valid@test.com", "password": "short"})
    assert r3.status_code == 400

# Scenario 7: Failed authentication does not create an authenticated session
def test_scenario_07_failed_auth_issues_no_token():
    bad_login = client.post("/api/auth/login", json={
        "email": "nobody@test.com",
        "password": "BadPassword123!"
    })
    assert bad_login.status_code == 401
    assert "token" not in bad_login.json()

# Scenario 8: A newly registered user starts with an empty vault
def test_scenario_08_empty_vault_on_registration():
    reg = client.post("/api/auth/register", json={
        "email": "ariel@ocean.org",
        "password": "PartofYourWorld123!",
        "vaultPassword": "FlounderSecretVault123"
    }).json()

    # Unlock vault
    unlock_resp = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {reg['token']}"}, json={
        "vaultPassword": "FlounderSecretVault123"
    })
    unlocked_token = unlock_resp.json()["token"]
    headers = {"Authorization": f"Bearer {unlocked_token}"}

    # Verify completely empty
    diary = client.get("/api/diary", headers=headers).json()
    notes = client.get("/api/notes", headers=headers).json()
    media = client.get("/api/gallery", headers=headers).json()
    stats = client.get("/api/stats", headers=headers).json()

    assert len(diary) == 0
    assert len(notes) == 0
    assert len(media) == 0
    assert stats["entriesCount"] == 0
    assert stats["mediaCount"] == 0
    assert stats["notesCount"] == 0

# Scenarios 9 & 10 & 11 & 12 & 13: User A vs User B Isolation & Protection
def test_scenarios_09_to_13_multi_user_isolation():
    # User A registers & unlocks
    reg_a = client.post("/api/auth/register", json={
        "email": "userA@royal.org",
        "password": "PasswordUserA123!",
        "vaultPassword": "VaultSecretA123"
    }).json()
    unlocked_a = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {reg_a['token']}"}, json={
        "vaultPassword": "VaultSecretA123"
    }).json()["token"]
    headers_a = {"Authorization": f"Bearer {unlocked_a}"}

    # User A creates resources (Scenario 9)
    diary_a = client.post("/api/diary", headers=headers_a, json={
        "title": "Secret of User A",
        "content": "Only User A can see this.",
        "mood": "peaceful"
    }).json()
    note_a = client.post("/api/notes", headers=headers_a, json={
        "type": "todo",
        "title": "User A Private Task",
        "content": "Secret Task Details",
        "completed": False
    }).json()
    fake_png = b"\x89PNG\r\n\x1a\nUserAPhotoData"
    media_a = client.post(
        "/api/gallery/upload",
        headers=headers_a,
        data={"album": "PrivateA"},
        files={"file": ("photo_a.png", fake_png, "image/png")}
    ).json()

    # User B registers & unlocks (Scenario 10)
    reg_b = client.post("/api/auth/register", json={
        "email": "userB@royal.org",
        "password": "PasswordUserB123!",
        "vaultPassword": "VaultSecretB123"
    }).json()
    unlocked_b = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {reg_b['token']}"}, json={
        "vaultPassword": "VaultSecretB123"
    }).json()["token"]
    headers_b = {"Authorization": f"Bearer {unlocked_b}"}

    # Scenario 10: User B cannot see any of User A's data in listings
    diary_b_list = client.get("/api/diary", headers=headers_b).json()
    notes_b_list = client.get("/api/notes", headers=headers_b).json()
    media_b_list = client.get("/api/gallery", headers=headers_b).json()
    assert len(diary_b_list) == 0
    assert len(notes_b_list) == 0
    assert len(media_b_list) == 0

    # Scenario 11: User B cannot read User A's records by guessing IDs
    get_entry_leak = client.get(f"/api/diary/{diary_a['id']}", headers=headers_b)
    assert get_entry_leak.status_code == 404

    # Scenario 12: User B cannot edit or delete User A's records
    tamper_diary = client.post("/api/diary", headers=headers_b, json={
        "id": diary_a["id"],
        "title": "Hacked Title",
        "content": "Hacked content"
    })
    assert tamper_diary.status_code == 403

    delete_diary_attempt = client.delete(f"/api/diary/{diary_a['id']}", headers=headers_b)
    assert delete_diary_attempt.status_code == 404

    tamper_note = client.post("/api/notes", headers=headers_b, json={
        "id": note_a["id"],
        "type": "todo",
        "title": "Hacked Note",
        "content": "Hacked note text"
    })
    assert tamper_note.status_code == 403

    toggle_note_attempt = client.patch(f"/api/notes/{note_a['id']}/toggle", headers=headers_b)
    assert toggle_note_attempt.status_code == 404

    # Scenario 13: User B cannot access User A's uploaded photos through direct requests
    direct_file_leak = client.get(f"/api/gallery/file/{media_a['id']}", headers=headers_b)
    assert direct_file_leak.status_code == 404

    # User A CAN access their own file
    legit_file = client.get(f"/api/gallery/file/{media_a['id']}", headers=headers_a)
    assert legit_file.status_code == 200
    assert legit_file.content == fake_png

# Scenario 14: Unauthenticated API requests cannot access private resources
def test_scenario_14_unauthenticated_requests_rejected():
    assert client.get("/api/diary").status_code == 401
    assert client.get("/api/notes").status_code == 401
    assert client.get("/api/gallery").status_code == 401
    assert client.get("/api/stats").status_code == 401
    assert client.post("/api/diary", json={"title": "Test", "content": "Test"}).status_code == 401

# Scenario 15: Expired or invalid tokens are rejected
def test_scenario_15_invalid_and_expired_tokens_rejected():
    # Completely bogus token
    bogus_headers = {"Authorization": "Bearer not.a.valid.jwt.token"}
    assert client.get("/api/diary", headers=bogus_headers).status_code == 401

    # Expired token
    expired_payload = {
        "sub": "user_expired",
        "email": "expired@test.com",
        "vault_unlocked": True,
        "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp())
    }
    expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=ALGORITHM)
    expired_headers = {"Authorization": f"Bearer {expired_token}"}
    assert client.get("/api/diary", headers=expired_headers).status_code == 401

# Scenario 16: Logging out and switching accounts does not reveal cached data
def test_scenario_16_switching_accounts_clean_isolation():
    reg1 = client.post("/api/auth/register", json={
        "email": "account1@palace.org",
        "password": "PasswordOne123!",
        "vaultPassword": "VaultOneSecret123"
    }).json()
    unlocked1 = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {reg1['token']}"}, json={
        "vaultPassword": "VaultOneSecret123"
    }).json()["token"]
    client.post("/api/diary", headers={"Authorization": f"Bearer {unlocked1}"}, json={
        "title": "Account 1 Diary", "content": "Text 1"
    })

    # Logout
    client.post("/api/auth/logout")

    # Account 2 registers & unlocks
    reg2 = client.post("/api/auth/register", json={
        "email": "account2@palace.org",
        "password": "PasswordTwo123!",
        "vaultPassword": "VaultTwoSecret123"
    }).json()
    unlocked2 = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {reg2['token']}"}, json={
        "vaultPassword": "VaultTwoSecret123"
    }).json()["token"]

    diary2 = client.get("/api/diary", headers={"Authorization": f"Bearer {unlocked2}"}).json()
    assert len(diary2) == 0

# Scenario 17: Failed vault unlocking does not expose content
def test_scenario_17_failed_vault_unlock_protects_content():
    reg = client.post("/api/auth/register", json={
        "email": "locked@palace.org",
        "password": "AccountPassword123!",
        "vaultPassword": "CorrectVaultPassword123"
    }).json()
    token_locked = reg["token"]

    # Wrong vault password attempt
    bad_unlock = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {token_locked}"}, json={
        "vaultPassword": "WrongVaultPassword!"
    })
    assert bad_unlock.status_code == 401

    # Attempting to read diary with locked token fails with 403 Forbidden
    diary_attempt = client.get("/api/diary", headers={"Authorization": f"Bearer {token_locked}"})
    assert diary_attempt.status_code == 403
    assert "vault is locked" in diary_attempt.json()["detail"].lower()

# Scenario 18: Valid authentication and authorization continue working after refresh
def test_scenario_18_token_persists_across_sessions():
    reg = client.post("/api/auth/register", json={
        "email": "persistent@palace.org",
        "password": "PasswordPersist123!",
        "vaultPassword": "VaultPasswordPersist123"
    }).json()
    unlocked_token = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {reg['token']}"}, json={
        "vaultPassword": "VaultPasswordPersist123"
    }).json()["token"]

    # Save a record
    client.post("/api/diary", headers={"Authorization": f"Bearer {unlocked_token}"}, json={
        "title": "Persistent Memory", "content": "Survives refresh"
    })

    # Emulate browser refresh: use the same token stored in localStorage
    refreshed_list = client.get("/api/diary", headers={"Authorization": f"Bearer {unlocked_token}"})
    assert refreshed_list.status_code == 200
    entries = refreshed_list.json()
    assert len(entries) == 1
    assert entries[0]["title"] == "Persistent Memory"

# Scenario 19: Recovery Key unlocks vault
def test_scenario_19_recovery_key_unlocks_vault():
    reg = client.post("/api/auth/register", json={
        "email": "recovery_test@palace.org",
        "password": "PasswordRecovery123!",
        "vaultPassword": "ComplexVaultPassword123"
    }).json()
    recovery_key = reg["recoveryKey"]
    token_locked = reg["token"]

    # Unlock using 24-word recovery key
    unlock_resp = client.post("/api/auth/unlock", headers={"Authorization": f"Bearer {token_locked}"}, json={
        "recoveryKey": recovery_key
    })
    assert unlock_resp.status_code == 200
    unlocked_token = unlock_resp.json()["token"]

    # Access private data
    res = client.get("/api/diary", headers={"Authorization": f"Bearer {unlocked_token}"})
    assert res.status_code == 200
