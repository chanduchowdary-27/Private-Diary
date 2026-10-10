import os
import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
import jwt

ph = PasswordHasher()

SECRET_KEY = os.environ.get(
    "JWT_SECRET",
    "princess-vault-jwt-secret-key-super-secure-32-chars-long-minimum-required!"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

WORDLIST = [
    "crystal", "rose", "emerald", "sparkle", "crown", "star", "velvet", "moon",
    "tiara", "palace", "garden", "diamond", "glimmer", "castle", "aurora", "blossom",
    "secret", "magic", "radiant", "harmony", "serenade", "twilight", "golden", "gentle",
    "feather", "whisper", "silver", "lunar", "celestial", "fairytale", "sapphire", "pearl"
]

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(hash_val: str, password: str) -> bool:
    if not hash_val or not password:
        return False
    try:
        return ph.verify(hash_val, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False

def generate_recovery_key() -> str:
    return " ".join(secrets.choice(WORDLIST) for _ in range(24))

def create_access_token(
    user_id: str,
    email: str,
    vault_unlocked: bool = False,
    expires_delta: Optional[timedelta] = None
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    payload = {
        "sub": user_id,
        "email": email,
        "vault_unlocked": vault_unlocked,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(status_code=401, detail="Invalid authentication credentials.")

# ─── RATE LIMITER ─────────────────────────────────────────────
failed_attempts = defaultdict(list)
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 60

def check_rate_limit(key: str) -> None:
    now = time.time()
    failed_attempts[key] = [t for t in failed_attempts[key] if now - t < LOCKOUT_WINDOW_SECONDS]
    if len(failed_attempts[key]) >= MAX_FAILED_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed authentication attempts. Please try again in 60 seconds."
        )

def record_failed_attempt(key: str) -> None:
    failed_attempts[key].append(time.time())

def clear_failed_attempts(key: str) -> None:
    if key in failed_attempts:
        del failed_attempts[key]
