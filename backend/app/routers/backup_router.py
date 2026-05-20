from datetime import date, datetime
from decimal import Decimal
import json

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.database import SessionLocal

router = APIRouter(prefix="/backup", tags=["backup"])

EXPORT_TABLES = [
    "routers",
    "plans",
    "customers",
    "invoices",
    "tickets",
    "installations",
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return float(value)

    return value


def table_exists(db: Session, table_name: str) -> bool:
    result = db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = :table_name
            )
            """
        ),
        {"table_name": table_name},
    ).scalar()

    return bool(result)


def fetch_rows(db: Session, table_name: str):
    if not table_exists(db, table_name):
        return []

    try:
        rows = db.execute(
            text(f'SELECT * FROM "{table_name}" ORDER BY id ASC')
        ).mappings().all()
    except Exception:
        db.rollback()
        rows = db.execute(
            text(f'SELECT * FROM "{table_name}"')
        ).mappings().all()

    return [
        {key: json_safe(value) for key, value in dict(row).items()}
        for row in rows
    ]


@router.get("/export")
def export_backup(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    tables = {}

    for table_name in EXPORT_TABLES:
        tables[table_name] = fetch_rows(db, table_name)

    payload = {
        "format": "highspeed-crm-backup-v1",
        "created_at": datetime.utcnow().isoformat(),
        "warning": "Respaldo solo del CRM. No toca MikroTik.",
        "tables": tables,
        "counts": {
            table_name: len(rows)
            for table_name, rows in tables.items()
        },
    }

    filename = f"highspeed_backup_{timestamp}.json"

    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2, default=str),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )