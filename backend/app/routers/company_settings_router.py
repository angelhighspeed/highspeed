from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.auth.dependencies import require_roles


router = APIRouter()


DEFAULT_COMPANY_SETTINGS = {
    "brand": "HighSpeed ISP",
    "business_name": "Angel Gabriel Benitez",
    "cuit": "20-38265225-9",
    "locality": "Ituzaingo, Corrientes",
    "phone": "3786494305",
    "address": "Santa Fe entre calle 11 y 12",
    "email": "",
    "website": "",
}


class CompanySettingsUpdate(BaseModel):
    brand: str = ""
    business_name: str = ""
    cuit: str = ""
    locality: str = ""
    phone: str = ""
    address: str = ""
    email: str = ""
    website: str = ""


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def ensure_company_settings_table():
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS company_settings (
                        key VARCHAR PRIMARY KEY,
                        value TEXT
                    )
                    """
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS company_settings (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    )
                    """
                )
            )


ensure_company_settings_table()


def get_company_settings_from_db(db: Session):
    ensure_company_settings_table()

    settings = DEFAULT_COMPANY_SETTINGS.copy()

    rows = db.execute(
        text("SELECT key, value FROM company_settings")
    ).mappings().all()

    for row in rows:
        key = row["key"]
        value = row["value"]

        if key in settings:
            settings[key] = value or ""

    return settings


def save_company_settings_to_db(db: Session, data: dict):
    ensure_company_settings_table()

    current = get_company_settings_from_db(db)
    current.update(
        {
            key: str(value or "")
            for key, value in data.items()
            if key in DEFAULT_COMPANY_SETTINGS
        }
    )

    dialect = engine.dialect.name

    for key, value in current.items():
        if dialect == "postgresql":
            db.execute(
                text(
                    """
                    INSERT INTO company_settings (key, value)
                    VALUES (:key, :value)
                    ON CONFLICT (key)
                    DO UPDATE SET value = EXCLUDED.value
                    """
                ),
                {
                    "key": key,
                    "value": value,
                },
            )
        else:
            db.execute(
                text(
                    """
                    INSERT OR REPLACE INTO company_settings (key, value)
                    VALUES (:key, :value)
                    """
                ),
                {
                    "key": key,
                    "value": value,
                },
            )

    db.commit()

    return get_company_settings_from_db(db)


@router.get("/company-settings")
def get_company_settings(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "cobrador",
            "operador",
        ])
    ),
):
    return {
        "status": "ok",
        "settings": get_company_settings_from_db(db),
    }


@router.put("/company-settings")
def update_company_settings(
    data: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
        ])
    ),
):
    settings = save_company_settings_to_db(
        db,
        data.model_dump(),
    )

    return {
        "status": "ok",
        "message": "Datos de empresa actualizados.",
        "settings": settings,
    }
