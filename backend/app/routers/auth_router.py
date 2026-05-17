from datetime import datetime, timedelta
import hashlib
import os
import secrets

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

try:
    from jose import jwt
except Exception:
    import jwt

from app.database import SessionLocal, engine

try:
    from app.auth import dependencies as auth_dependencies
except Exception:
    auth_dependencies = None


router = APIRouter()


SECRET_KEY = getattr(
    auth_dependencies,
    "SECRET_KEY",
    os.getenv("SECRET_KEY", "highspeed-secret-key"),
)

ALGORITHM = getattr(
    auth_dependencies,
    "ALGORITHM",
    os.getenv("ALGORITHM", "HS256"),
)


class LoginRequest(BaseModel):
    username: str
    password: str


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def hash_password(password: str):
    salt = os.urandom(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        120000,
    )

    return f"pbkdf2_sha256${salt.hex()}${password_hash.hex()}"


def verify_password(password: str, stored_hash: str):
    if not stored_hash:
        return False

    # Compatibilidad con password plano si existiera.
    if not stored_hash.startswith("pbkdf2_sha256$"):
        return secrets.compare_digest(password, stored_hash)

    try:
        _, salt_hex, hash_hex = stored_hash.split("$", 2)
        salt = bytes.fromhex(salt_hex)

        check_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            120000,
        ).hex()

        return secrets.compare_digest(check_hash, hash_hex)
    except Exception:
        return False


def ensure_users_table():
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS system_users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role VARCHAR NOT NULL DEFAULT 'operador',
                        full_name VARCHAR DEFAULT '',
                        email VARCHAR DEFAULT '',
                        status VARCHAR DEFAULT 'active',
                        created_at VARCHAR DEFAULT '',
                        updated_at VARCHAR DEFAULT ''
                    )
                    """
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS system_users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'operador',
                        full_name TEXT DEFAULT '',
                        email TEXT DEFAULT '',
                        status TEXT DEFAULT 'active',
                        created_at TEXT DEFAULT '',
                        updated_at TEXT DEFAULT ''
                    )
                    """
                )
            )


def seed_admin_user(db: Session):
    ensure_users_table()

    count = db.execute(
        text("SELECT COUNT(*) FROM system_users")
    ).scalar()

    if count and int(count) > 0:
        return

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    db.execute(
        text(
            """
            INSERT INTO system_users (
                username,
                password_hash,
                role,
                full_name,
                email,
                status,
                created_at,
                updated_at
            )
            VALUES (
                :username,
                :password_hash,
                :role,
                :full_name,
                :email,
                :status,
                :created_at,
                :updated_at
            )
            """
        ),
        {
            "username": "admin",
            "password_hash": hash_password("admin"),
            "role": "admin",
            "full_name": "Administrador",
            "email": "",
            "status": "active",
            "created_at": now,
            "updated_at": now,
        },
    )

    db.commit()


def create_access_token(username: str, role: str):
    expire = datetime.utcnow() + timedelta(hours=24)

    payload = {
        "sub": username,
        "role": role,
        "exp": expire,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_username(db: Session, username: str):
    ensure_users_table()
    seed_admin_user(db)

    row = db.execute(
        text("SELECT * FROM system_users WHERE username = :username"),
        {
            "username": username,
        },
    ).mappings().first()

    if not row:
        return None

    return dict(row)


@router.post("/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    username = data.username.strip()

    user = get_user_by_username(db, username)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Usuario o contraseña incorrectos.",
        )

    if user.get("status") != "active":
        raise HTTPException(
            status_code=403,
            detail="Usuario deshabilitado.",
        )

    if not verify_password(data.password, user.get("password_hash")):
        raise HTTPException(
            status_code=401,
            detail="Usuario o contraseña incorrectos.",
        )

    token = create_access_token(user["username"], user["role"])

    return {
        "status": "ok",
        "access_token": token,
        "token": token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"],
        "full_name": user.get("full_name") or "",
    }


@router.post("/auth/login")
def auth_login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    return login(data, db)
