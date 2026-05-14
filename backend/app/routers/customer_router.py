from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.customer_model import Customer
from app.models.plan_model import Plan

from app.schemas.customer_schema import (
    CustomerCreate,
    CustomerResponse,
)

from app.auth.dependencies import require_roles

from app.services.mikrotik_service import (
    create_pppoe_secret,
    update_pppoe_secret,
    disable_pppoe_secret,
    enable_pppoe_secret,
    remove_pppoe_active,
)

router = APIRouter()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def get_customer_profile(db: Session, plan_id):
    if not plan_id:
        return "default"

    plan = (
        db.query(Plan)
        .filter(Plan.id == plan_id)
        .first()
    )

    if not plan:
        return "default"

    return plan.profile or plan.name or "default"


@router.get("/customers", response_model=list[CustomerResponse])
def get_customers(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
            "operador",
            "cobrador",
        ])
    ),
):
    return db.query(Customer).all()


@router.post("/customers", response_model=CustomerResponse)
def create_customer(
    customer: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
        ])
    ),
):
    new_customer = Customer(**customer.model_dump())

    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)

    if customer.pppoe_username and customer.pppoe_password:
        try:
            profile = get_customer_profile(
                db,
                customer.plan_id,
            )

            class Secret:
                name = customer.pppoe_username
                password = customer.pppoe_password
                service = "pppoe"
                profile = profile
                remote_address = customer.remote_address

            create_pppoe_secret(Secret)

            if customer.status == "suspended":
                disable_pppoe_secret(
                    customer.pppoe_username
                )

                remove_pppoe_active(
                    customer.pppoe_username
                )

        except Exception as e:
            print(
                "Error sincronizando PPPoE en MikroTik:",
                e
            )

    return new_customer


@router.put(
    "/customers/{customer_id}",
    response_model=CustomerResponse
)
def update_customer(
    customer_id: int,
    customer: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
        ])
    ),
):
    customer_item = (
        db.query(Customer)
        .filter(Customer.id == customer_id)
        .first()
    )

    if not customer_item:
        return {"error": "Cliente no encontrado"}

    old_pppoe_username = (
        customer_item.pppoe_username
    )

    data = customer.model_dump()

    for key, value in data.items():
        setattr(customer_item, key, value)

    db.commit()
    db.refresh(customer_item)

    if customer.pppoe_username and customer.pppoe_password:
        try:
            profile = get_customer_profile(
                db,
                customer.plan_id,
            )

            update_pppoe_secret(
                old_name=(
                    old_pppoe_username
                    or customer.pppoe_username
                ),
                name=customer.pppoe_username,
                password=customer.pppoe_password,
                profile=profile,
                remote_address=customer.remote_address,
                disabled=(
                    customer.status
                    == "suspended"
                ),
            )

            if customer.status == "suspended":
                remove_pppoe_active(
                    customer.pppoe_username
                )

        except Exception as e:
            print(
                "Error actualizando PPPoE en MikroTik:",
                e
            )

    return customer_item


@router.put(
    "/customers/{customer_id}/suspend",
    response_model=CustomerResponse
)
def suspend_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
        ])
    ),
):
    customer_item = (
        db.query(Customer)
        .filter(Customer.id == customer_id)
        .first()
    )

    if not customer_item:
        return {"error": "Cliente no encontrado"}

    customer_item.status = "suspended"

    if customer_item.pppoe_username:
        try:
            disable_pppoe_secret(
                customer_item.pppoe_username
            )

            remove_pppoe_active(
                customer_item.pppoe_username
            )

        except Exception as e:
            print(
                "Error suspendiendo PPPoE:",
                e
            )

    db.commit()
    db.refresh(customer_item)

    return customer_item


@router.put(
    "/customers/{customer_id}/activate",
    response_model=CustomerResponse
)
def activate_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
            "tecnico",
        ])
    ),
):
    customer_item = (
        db.query(Customer)
        .filter(Customer.id == customer_id)
        .first()
    )

    if not customer_item:
        return {"error": "Cliente no encontrado"}

    customer_item.status = "active"

    if customer_item.pppoe_username:
        try:
            enable_pppoe_secret(
                customer_item.pppoe_username
            )

        except Exception as e:
            print(
                "Error activando PPPoE:",
                e
            )

    db.commit()
    db.refresh(customer_item)

    return customer_item


@router.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles([
            "admin",
        ])
    ),
):
    customer_item = (
        db.query(Customer)
        .filter(Customer.id == customer_id)
        .first()
    )

    if not customer_item:
        return {"error": "Cliente no encontrado"}

    if customer_item.pppoe_username:
        try:
            disable_pppoe_secret(
                customer_item.pppoe_username
            )

            remove_pppoe_active(
                customer_item.pppoe_username
            )

        except Exception as e:
            print(
                "Error eliminando conexión activa PPPoE:",
                e
            )

    db.delete(customer_item)
    db.commit()

    return {
        "message": "Cliente eliminado"
    }