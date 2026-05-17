from datetime import datetime
import hashlib
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.auth.dependencies import require_roles


router = APIRouter()


ALLOWED_ROLES = [
    "admin",
    "tecnico",
    "operador",
    "cobrador",
]


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "operador"
    full_name: str = ""
    email: str = ""


class UserUpdate(BaseModel):
    username: str = ""
    role: str = ""
    full_name: str = ""
    email: str = ""
    status: str = ""


class PasswordUpdate(BaseModel):
    password: str


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def now_string():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


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

    # Compatibilidad si alguna vez hubo password plano.
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
            "created_at": now_string(),
            "updated_at": now_string(),
        },
    )

    db.commit()


def serialize_user(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
        "full_name": row.get("full_name") or "",
        "email": row.get("email") or "",
        "status": row.get("status") or "active",
        "created_at": row.get("created_at") or "",
        "updated_at": row.get("updated_at") or "",
    }


def get_user_row_or_404(db: Session, user_id: int):
    row = db.execute(
        text("SELECT * FROM system_users WHERE id = :id"),
        {
            "id": user_id,
        },
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado",
        )

    return dict(row)


ensure_users_table()


@router.get("/users-management/roles")
def get_roles(
    current_user: dict = Depends(require_roles(["admin"])),
):
    return {
        "status": "ok",
        "roles": ALLOWED_ROLES,
    }


@router.get("/users-management")
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    seed_admin_user(db)

    rows = db.execute(
        text("SELECT * FROM system_users ORDER BY id ASC")
    ).mappings().all()

    return [
        serialize_user(dict(row))
        for row in rows
    ]


@router.post("/users-management")
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    seed_admin_user(db)

    username = data.username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Ingresá el usuario.",
        )

    if not data.password:
        raise HTTPException(
            status_code=400,
            detail="Ingresá la contraseña.",
        )

    if data.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Rol inválido.",
        )

    existing = db.execute(
        text("SELECT id FROM system_users WHERE username = :username"),
        {
            "username": username,
        },
    ).mappings().first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un usuario con ese nombre.",
        )

    dialect = engine.dialect.name

    params = {
        "username": username,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "full_name": data.full_name or "",
        "email": data.email or "",
        "status": "active",
        "created_at": now_string(),
        "updated_at": now_string(),
    }

    if dialect == "postgresql":
        result = db.execute(
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
                RETURNING id
                """
            ),
            params,
        )

        user_id = result.scalar()
    else:
        result = db.execute(
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
            params,
        )

        user_id = result.lastrowid

    db.commit()

    row = get_user_row_or_404(db, user_id)

    return {
        "status": "ok",
        "message": "Usuario creado correctamente.",
        "user": serialize_user(row),
    }


@router.put("/users-management/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    seed_admin_user(db)
    get_user_row_or_404(db, user_id)

    updates = {}

    if data.username:
        updates["username"] = data.username.strip()

    if data.role:
        if data.role not in ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail="Rol inválido.",
            )

        updates["role"] = data.role

    if data.full_name != "":
        updates["full_name"] = data.full_name or ""

    if data.email != "":
        updates["email"] = data.email or ""

    if data.status:
        if data.status not in ["active", "disabled"]:
            raise HTTPException(
                status_code=400,
                detail="Estado inválido.",
            )

        updates["status"] = data.status

    updates["updated_at"] = now_string()

    set_clause = ", ".join([f"{key} = :{key}" for key in updates.keys()])

    db.execute(
        text(f"UPDATE system_users SET {set_clause} WHERE id = :id"),
        {
            "id": user_id,
            **updates,
        },
    )

    db.commit()

    row = get_user_row_or_404(db, user_id)

    return {
        "status": "ok",
        "message": "Usuario actualizado.",
        "user": serialize_user(row),
    }


@router.put("/users-management/{user_id}/password")
def update_user_password(
    user_id: int,
    data: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    seed_admin_user(db)
    get_user_row_or_404(db, user_id)

    if not data.password:
        raise HTTPException(
            status_code=400,
            detail="Ingresá la nueva contraseña.",
        )

    db.execute(
        text(
            """
            UPDATE system_users
            SET password_hash = :password_hash,
                updated_at = :updated_at
            WHERE id = :id
            """
        ),
        {
            "id": user_id,
            "password_hash": hash_password(data.password),
            "updated_at": now_string(),
        },
    )

    db.commit()

    return {
        "status": "ok",
        "message": "Contraseña actualizada.",
    }


@router.put("/users-management/{user_id}/disable")
def disable_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    seed_admin_user(db)

    row = get_user_row_or_404(db, user_id)

    if row["username"] == "admin":
        raise HTTPException(
            status_code=400,
            detail="No se puede deshabilitar el usuario admin principal.",
        )

    db.execute(
        text(
            """
            UPDATE system_users
            SET status = 'disabled',
                updated_at = :updated_at
            WHERE id = :id
            """
        ),
        {
            "id": user_id,
            "updated_at": now_string(),
        },
    )

    db.commit()

    return {
        "status": "ok",
        "message": "Usuario deshabilitado.",
    }


@router.put("/users-management/{user_id}/enable")
def enable_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    seed_admin_user(db)
    get_user_row_or_404(db, user_id)

    db.execute(
        text(
            """
            UPDATE system_users
            SET status = 'active',
                updated_at = :updated_at
            WHERE id = :id
            """
        ),
        {
            "id": user_id,
            "updated_at": now_string(),
        },
    )

    db.commit()

    return {
        "status": "ok",
        "message": "Usuario habilitado.",
    }
