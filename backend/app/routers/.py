from datetime import datetime
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.auth.dependencies import require_roles
from app.models.installation_model import Installation
from app.models.customer_model import Customer
from app.models.plan_model import Plan


router = APIRouter()


class InstallationCreate(BaseModel):
    customer_id: int
    technician: Optional[str] = ""
    scheduled_date: Optional[str] = ""
    address: Optional[str] = ""
    installation_type: Optional[str] = ""
    notes: Optional[str] = ""


class NewCustomerForInstallation(BaseModel):
    name: str
    last_name: Optional[str] = ""
    phone: Optional[str] = ""
    zone: Optional[str] = ""
    address: Optional[str] = ""
    pppoe_username: str
    pppoe_password: str
    remote_address: str
    plan_id: Optional[int] = None
    status: Optional[str] = "pending_installation"


class InstallationWithoutCustomerId(BaseModel):
    technician: Optional[str] = ""
    scheduled_date: Optional[str] = ""
    address: Optional[str] = ""
    installation_type: Optional[str] = ""
    notes: Optional[str] = ""


class InstallationWithCustomerCreate(BaseModel):
    customer: NewCustomerForInstallation
    installation: InstallationWithoutCustomerId


def ensure_installation_columns():
    dialect = engine.dialect.name

    try:
        if dialect == "postgresql":
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS technician VARCHAR"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS scheduled_date VARCHAR"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS address VARCHAR"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS installation_type VARCHAR"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS notes TEXT"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending'"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS mikrotik_status VARCHAR"))
                conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS mikrotik_message TEXT"))
            return

        if dialect == "sqlite":
            with engine.begin() as conn:
                result = conn.execute(text("PRAGMA table_info(installations)"))
                columns = [row[1] for row in result.fetchall()]

                if "technician" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN technician VARCHAR"))
                if "scheduled_date" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN scheduled_date VARCHAR"))
                if "address" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN address VARCHAR"))
                if "installation_type" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN installation_type VARCHAR"))
                if "notes" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN notes TEXT"))
                if "status" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN status VARCHAR DEFAULT 'pending'"))
                if "created_at" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN created_at DATETIME"))
                if "updated_at" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN updated_at DATETIME"))
                if "completed_at" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN completed_at DATETIME"))
                if "cancelled_at" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN cancelled_at DATETIME"))
                if "mikrotik_status" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN mikrotik_status VARCHAR"))
                if "mikrotik_message" not in columns:
                    conn.execute(text("ALTER TABLE installations ADD COLUMN mikrotik_message TEXT"))
            return

    except Exception as e:
        print("Error verificando columnas de installations:", e)


def get_db():
    ensure_installation_columns()

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def format_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")

    return str(value)


def get_first_attr(obj: Any, names: list[str], default=None):
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)

            if value not in [None, ""]:
                return value

    return default


def set_first_existing_attr(obj: Any, names: list[str], value):
    if value in [None, ""]:
        return

    for name in names:
        if hasattr(obj, name):
            setattr(obj, name, value)
            return


def get_customer_plan(db: Session, customer: Customer):
    plan_id = get_first_attr(customer, ["plan_id", "internet_plan_id"])

    if not plan_id:
        return None

    try:
        return db.query(Plan).filter(Plan.id == plan_id).first()
    except Exception:
        return None


def get_customer_pppoe_data(db: Session, customer: Customer):
    plan = get_customer_plan(db, customer)

    pppoe_username = get_first_attr(
        customer,
        ["pppoe_username", "username_pppoe", "username"],
    )

    pppoe_password = get_first_attr(
        customer,
        ["pppoe_password", "password_pppoe", "pppoe_pass", "password"],
    )

    remote_address = get_first_attr(
        customer,
        ["remote_address", "ip", "ip_address"],
    )

    profile = "default"

    if plan:
        profile = get_first_attr(
            plan,
            ["mikrotik_profile", "pppoe_profile", "profile", "name"],
            "default",
        )

    return {
        "name": pppoe_username,
        "password": pppoe_password,
        "remote_address": remote_address,
        "profile": profile,
    }


def add_customer_to_mikrotik(db: Session, customer: Customer):
    pppoe_data = get_customer_pppoe_data(db, customer)

    username = pppoe_data["name"]
    password = pppoe_data["password"]
    remote_address = pppoe_data["remote_address"]
    profile = pppoe_data["profile"]

    missing = []

    if not username:
        missing.append("usuario PPPoE")

    if not password:
        missing.append("password PPPoE")

    if not remote_address:
        missing.append("IP")

    if missing:
        return {
            "status": "skipped",
            "message": "No se agregó a MikroTik. Faltan datos: " + ", ".join(missing),
        }

    try:
        from app.services import mikrotik_service
    except Exception as e:
        return {
            "status": "error",
            "message": f"No se pudo importar mikrotik_service: {str(e)}",
        }

    payload = {
        "name": username,
        "password": password,
        "service": "pppoe",
        "profile": profile or "default",
        "remote_address": remote_address,
        "comment": f"Cliente ID {customer.id}",
    }

    candidate_functions = [
        "add_pppoe_secret",
        "add_mikrotik_pppoe_secret",
        "create_pppoe_secret",
        "add_mikrotik_secret",
        "add_secret",
    ]

    last_error = None

    for function_name in candidate_functions:
        function = getattr(mikrotik_service, function_name, None)

        if not callable(function):
            continue

        try:
            result = function(**payload)
            return {
                "status": "ok",
                "message": f"Cliente agregado a MikroTik con {function_name}",
                "result": result,
            }

        except TypeError:
            try:
                result = function(payload)
                return {
                    "status": "ok",
                    "message": f"Cliente agregado a MikroTik con {function_name}",
                    "result": result,
                }
            except Exception as e:
                last_error = str(e)

        except Exception as e:
            last_error = str(e)

    return {
        "status": "error",
        "message": (
            "No se pudo agregar a MikroTik. No se encontró una función compatible en mikrotik_service."
            if not last_error
            else f"No se pudo agregar a MikroTik: {last_error}"
        ),
    }


def serialize_installation(installation: Installation, customer: Optional[Customer] = None):
    customer_name = None

    if customer:
        customer_name = f"{customer.name or ''} {customer.last_name or ''}".strip()

    return {
        "id": installation.id,
        "customer_id": installation.customer_id,

        "customer_name": customer_name,
        "customer_pppoe_username": get_first_attr(customer, ["pppoe_username", "username_pppoe", "username"]) if customer else None,
        "customer_ip": get_first_attr(customer, ["remote_address", "ip", "ip_address"]) if customer else None,
        "customer_phone": customer.phone if customer and hasattr(customer, "phone") else None,
        "customer_zone": customer.zone if customer and hasattr(customer, "zone") else None,
        "customer_status": customer.status if customer and hasattr(customer, "status") else None,

        "technician": installation.technician,
        "scheduled_date": installation.scheduled_date,
        "address": installation.address,
        "installation_type": installation.installation_type,
        "notes": installation.notes,

        "status": installation.status,

        "created_at": format_datetime(installation.created_at),
        "updated_at": format_datetime(installation.updated_at),
        "completed_at": format_datetime(installation.completed_at),
        "cancelled_at": format_datetime(installation.cancelled_at),

        "mikrotik_status": installation.mikrotik_status,
        "mikrotik_message": installation.mikrotik_message,
    }


@router.get("/installations")
def get_installations(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    installations = db.query(Installation).order_by(Installation.id.desc()).all()

    customer_ids = list({
        installation.customer_id
        for installation in installations
        if installation.customer_id
    })

    customers = (
        db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
        if customer_ids
        else []
    )

    customers_by_id = {customer.id: customer for customer in customers}

    return [
        serialize_installation(installation, customers_by_id.get(installation.customer_id))
        for installation in installations
    ]


@router.post("/installations")
def create_installation(
    installation_data: InstallationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    customer = db.query(Customer).filter(Customer.id == installation_data.customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    installation = Installation(
        customer_id=installation_data.customer_id,
        technician=installation_data.technician or "",
        scheduled_date=installation_data.scheduled_date or "",
        address=installation_data.address or "",
        installation_type=installation_data.installation_type or "",
        notes=installation_data.notes or "",
        status="pending",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        mikrotik_status="pending",
        mikrotik_message="Pendiente de completar instalación",
    )

    db.add(installation)
    db.commit()
    db.refresh(installation)

    return serialize_installation(installation, customer)


@router.post("/installations/create-with-customer")
def create_installation_with_customer(
    data: InstallationWithCustomerCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    customer = Customer()

    set_first_existing_attr(customer, ["name"], data.customer.name)
    set_first_existing_attr(customer, ["last_name"], data.customer.last_name)
    set_first_existing_attr(customer, ["phone"], data.customer.phone)
    set_first_existing_attr(customer, ["zone"], data.customer.zone)
    set_first_existing_attr(customer, ["address", "direction"], data.customer.address)
    set_first_existing_attr(customer, ["pppoe_username", "username_pppoe", "username"], data.customer.pppoe_username)
    set_first_existing_attr(customer, ["pppoe_password", "password_pppoe", "pppoe_pass", "password"], data.customer.pppoe_password)
    set_first_existing_attr(customer, ["remote_address", "ip", "ip_address"], data.customer.remote_address)
    set_first_existing_attr(customer, ["plan_id", "internet_plan_id"], data.customer.plan_id)
    set_first_existing_attr(customer, ["status"], data.customer.status or "pending_installation")

    db.add(customer)
    db.commit()
    db.refresh(customer)

    installation = Installation(
        customer_id=customer.id,
        technician=data.installation.technician or "",
        scheduled_date=data.installation.scheduled_date or "",
        address=data.installation.address or data.customer.address or "",
        installation_type=data.installation.installation_type or "",
        notes=data.installation.notes or "",
        status="pending",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        mikrotik_status="pending",
        mikrotik_message="Pendiente de completar instalación",
    )

    db.add(installation)
    db.commit()
    db.refresh(installation)

    return {
        "status": "ok",
        "message": "Cliente nuevo e instalación creados correctamente.",
        "customer_id": customer.id,
        "installation": serialize_installation(installation, customer),
    }


@router.put("/installations/{installation_id}/complete")
def complete_installation(
    installation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico"])),
):
    installation = db.query(Installation).filter(Installation.id == installation_id).first()

    if not installation:
        raise HTTPException(status_code=404, detail="Instalación no encontrada")

    customer = db.query(Customer).filter(Customer.id == installation.customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if hasattr(customer, "status"):
        customer.status = "active"

    installation.status = "completed"
    installation.updated_at = datetime.now()
    installation.completed_at = datetime.now()
    installation.cancelled_at = None

    mikrotik_result = add_customer_to_mikrotik(db, customer)

    installation.mikrotik_status = mikrotik_result.get("status")
    installation.mikrotik_message = mikrotik_result.get("message")

    db.commit()
    db.refresh(installation)
    db.refresh(customer)

    return {
        "status": "ok",
        "message": "Instalación completada. Cliente activado.",
        "installation": serialize_installation(installation, customer),
        "mikrotik": mikrotik_result,
    }


@router.put("/installations/{installation_id}/cancel")
def cancel_installation(
    installation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "tecnico"])),
):
    installation = db.query(Installation).filter(Installation.id == installation_id).first()

    if not installation:
        raise HTTPException(status_code=404, detail="Instalación no encontrada")

    customer = db.query(Customer).filter(Customer.id == installation.customer_id).first()

    installation.status = "cancelled"
    installation.updated_at = datetime.now()
    installation.cancelled_at = datetime.now()

    installation.mikrotik_status = "cancelled"
    installation.mikrotik_message = "Instalación cancelada. No se agregó a MikroTik."

    db.commit()
    db.refresh(installation)

    return {
        "status": "ok",
        "message": "Instalación cancelada.",
        "installation": serialize_installation(installation, customer),
    }
