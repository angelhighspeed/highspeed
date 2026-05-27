from datetime import date, datetime
from decimal import Decimal
import json

from fastapi import APIRouter, Body, Depends, Query, Response
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

RESTORE_TABLES = [
    "customers",
    "invoices",
    "tickets",
    "installations",
]

CLEAR_ORDER = [
    "tickets",
    "installations",
    "invoices",
    "customers",
]

IMPORT_ORDER = [
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


def get_table_columns(db: Session, table_name: str) -> list[str]:
    rows = db.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = :table_name
            ORDER BY ordinal_position
            """
        ),
        {"table_name": table_name},
    ).fetchall()

    return [row[0] for row in rows]


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


def reset_sequence(db: Session, table_name: str):
    db.execute(
        text(
            f"""
            SELECT setval(
                pg_get_serial_sequence('{table_name}', 'id'),
                COALESCE((SELECT MAX(id) FROM "{table_name}"), 1),
                true
            )
            """
        )
    )


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


@router.post("/import-json")
def import_backup_json(
    payload: dict = Body(...),
    dry_run: bool = Query(True),
    clear_existing: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    if payload.get("format") != "highspeed-crm-backup-v1":
        return {
            "status": "error",
            "message": "Formato de respaldo inválido.",
        }

    tables = payload.get("tables") or {}

    if not isinstance(tables, dict):
        return {
            "status": "error",
            "message": "El respaldo no contiene tablas válidas.",
        }

    restore_plan = {}
    warnings = []

    for table_name in RESTORE_TABLES:
        rows = tables.get(table_name, [])

        if not isinstance(rows, list):
            warnings.append(f"{table_name}: formato inválido, se omitirá.")
            rows = []

        restore_plan[table_name] = {
            "exists": table_exists(db, table_name),
            "rows_in_file": len(rows),
            "will_import": table_exists(db, table_name) and len(rows) > 0,
        }

    if dry_run:
        return {
            "status": "ok",
            "mode": "dry_run",
            "message": "Simulación realizada. No se modificó la base de datos.",
            "clear_existing": clear_existing,
            "restore_plan": restore_plan,
            "warnings": warnings,
        }

    try:
        if clear_existing:
            existing_tables = [
                table_name
                for table_name in CLEAR_ORDER
                if table_exists(db, table_name)
            ]

            if existing_tables:
                joined = ", ".join(f'"{table_name}"' for table_name in existing_tables)

                db.execute(
                    text(
                        f"""
                        TRUNCATE TABLE {joined}
                        RESTART IDENTITY CASCADE
                        """
                    )
                )

        imported_counts = {}
        skipped_counts = {}

        for table_name in IMPORT_ORDER:
            rows = tables.get(table_name, [])

            imported_counts[table_name] = 0
            skipped_counts[table_name] = 0

            if not rows:
                continue

            if not table_exists(db, table_name):
                warnings.append(f"{table_name}: la tabla no existe, se omitió.")
                skipped_counts[table_name] = len(rows)
                continue

            columns = set(get_table_columns(db, table_name))

            for raw_row in rows:
                if not isinstance(raw_row, dict):
                    skipped_counts[table_name] += 1
                    continue

                row = {
                    key: value
                    for key, value in raw_row.items()
                    if key in columns
                }

                if not row:
                    skipped_counts[table_name] += 1
                    continue

                columns_sql = ", ".join(f'"{column}"' for column in row.keys())
                params_sql = ", ".join(f":{column}" for column in row.keys())
                update_sql = ", ".join(
                    f'"{column}" = EXCLUDED."{column}"'
                    for column in row.keys()
                    if column != "id"
                )

                if "id" in row and update_sql:
                    query = text(
                        f"""
                        INSERT INTO "{table_name}" ({columns_sql})
                        VALUES ({params_sql})
                        ON CONFLICT (id) DO UPDATE SET {update_sql}
                        """
                    )
                elif "id" in row:
                    query = text(
                        f"""
                        INSERT INTO "{table_name}" ({columns_sql})
                        VALUES ({params_sql})
                        ON CONFLICT (id) DO NOTHING
                        """
                    )
                else:
                    query = text(
                        f"""
                        INSERT INTO "{table_name}" ({columns_sql})
                        VALUES ({params_sql})
                        """
                    )

                db.execute(query, row)
                imported_counts[table_name] += 1

            try:
                reset_sequence(db, table_name)
            except Exception as sequence_error:
                warnings.append(
                    f"{table_name}: no se pudo actualizar secuencia ID: {sequence_error}"
                )

        db.commit()

        return {
            "status": "ok",
            "mode": "executed",
            "message": "Respaldo restaurado en el CRM. MikroTik no fue tocado.",
            "clear_existing": clear_existing,
            "imported_counts": imported_counts,
            "skipped_counts": skipped_counts,
            "warnings": warnings,
        }

    except Exception as e:
        db.rollback()

        return {
            "status": "error",
            "message": "No se pudo restaurar el respaldo.",
            "error": str(e),
            "warnings": warnings,
        }