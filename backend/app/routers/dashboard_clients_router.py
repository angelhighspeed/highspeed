from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.customer_model import Customer
from app.auth.dependencies import require_roles
from app.services.mikrotik_service import get_pppoe_active

router = APIRouter()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.get("/dashboard/clients-status")
def get_clients_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico", "operador", "cobrador"])
    ),
):
    customers = db.query(Customer).all()

    total_customers = len(customers)

    suspended_customers = [
        c for c in customers
        if c.status == "suspended"
    ]

    active_customers = [
        c for c in customers
        if c.status == "active"
    ]

    customers_with_pppoe = [
        c for c in customers
        if c.pppoe_username
    ]

    crm_usernames = {
        c.pppoe_username
        for c in customers_with_pppoe
        if c.pppoe_username
    }

    mikrotik_error = None
    online_sessions = []

    try:
        result = get_pppoe_active()

        if isinstance(result, list):
            online_sessions = result
        else:
            mikrotik_error = result

    except Exception as e:
        mikrotik_error = str(e)

    online_usernames = {
        item.get("name")
        for item in online_sessions
        if item.get("name")
    }

    online_customers = [
        c for c in customers
        if c.pppoe_username in online_usernames
    ]

    offline_customers = [
        c for c in active_customers
        if c.pppoe_username and c.pppoe_username not in online_usernames
    ]

    online_not_registered = [
        item for item in online_sessions
        if item.get("name") not in crm_usernames
    ]

    return {
        "total_customers": total_customers,
        "active_customers": len(active_customers),
        "suspended_customers": len(suspended_customers),
        "customers_with_pppoe": len(customers_with_pppoe),

        "online_customers": len(online_customers),
        "offline_customers": len(offline_customers),

        "active_pppoe_sessions": len(online_sessions),
        "online_not_registered": len(online_not_registered),

        "mikrotik_online": mikrotik_error is None,
        "mikrotik_error": mikrotik_error,

        "online_users": list(online_usernames),
    }