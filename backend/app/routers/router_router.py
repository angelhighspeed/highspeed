from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal

from app.models.router_model import Router
from app.models.customer_model import Customer

from app.schemas.router_schema import (
    RouterCreate,
    RouterResponse,
)

from app.auth.dependencies import require_roles

from app.services.mikrotik_service import (
    get_system_resources,
)

from app.services.ip_pool_service import (
    get_next_available_ip,
    get_available_ips,
)

router = APIRouter()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.get("/routers", response_model=list[RouterResponse])
def get_routers(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico", "operador"])
    ),
):
    return db.query(Router).all()


@router.post("/routers", response_model=RouterResponse)
def create_router(
    router_data: RouterCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin"])
    ),
):
    new_router = Router(**router_data.model_dump())

    db.add(new_router)
    db.commit()
    db.refresh(new_router)

    return new_router


@router.get("/routers/{router_id}", response_model=RouterResponse)
def get_router(
    router_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico", "operador"])
    ),
):
    router_item = (
        db.query(Router)
        .filter(Router.id == router_id)
        .first()
    )

    if not router_item:
        return {"error": "Router no encontrado"}

    return router_item


@router.put("/routers/{router_id}", response_model=RouterResponse)
def update_router(
    router_id: int,
    router_data: RouterCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin"])
    ),
):
    router_item = (
        db.query(Router)
        .filter(Router.id == router_id)
        .first()
    )

    if not router_item:
        return {"error": "Router no encontrado"}

    data = router_data.model_dump()

    for key, value in data.items():
        setattr(router_item, key, value)

    db.commit()
    db.refresh(router_item)

    return router_item


@router.delete("/routers/{router_id}")
def delete_router(
    router_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin"])
    ),
):
    router_item = (
        db.query(Router)
        .filter(Router.id == router_id)
        .first()
    )

    if not router_item:
        return {"error": "Router no encontrado"}

    db.delete(router_item)
    db.commit()

    return {"message": "Router eliminado"}


@router.get("/routers/{router_id}/next-free-ip")
def get_router_next_free_ip(
    router_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    router_item = (
        db.query(Router)
        .filter(Router.id == router_id)
        .first()
    )

    if not router_item:
        return {"error": "Router no encontrado"}

    used_ips = [
        item.remote_address
        for item in db.query(Customer)
        .filter(Customer.remote_address.isnot(None))
        .all()
        if item.remote_address
    ]

    next_ip = get_next_available_ip(
        router_item.ip_ranges,
        used_ips,
    )

    if not next_ip:
        return {
            "available": False,
            "message": "No hay IPs disponibles",
        }

    return {
        "available": True,
        "router_id": router_id,
        "ip": next_ip,
    }


@router.get("/routers/{router_id}/available-ips")
def get_router_available_ips(
    router_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    router_item = (
        db.query(Router)
        .filter(Router.id == router_id)
        .first()
    )

    if not router_item:
        return {"error": "Router no encontrado"}

    used_ips = [
        item.remote_address
        for item in db.query(Customer)
        .filter(Customer.remote_address.isnot(None))
        .all()
        if item.remote_address
    ]

    available_ips = get_available_ips(
        router_item.ip_ranges,
        used_ips,
        limit=50000,
    )

    return {
        "available": True,
        "router_id": router_id,
        "total": len(available_ips),
        "ips": available_ips,
    }


@router.post("/routers/{router_id}/test")
def test_router_connection(
    router_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    router_item = (
        db.query(Router)
        .filter(Router.id == router_id)
        .first()
    )

    if not router_item:
        return {"error": "Router no encontrado"}

    try:
        resources = get_system_resources()

        return {
            "status": "online",
            "router": router_item.name,
            "resources": resources,
        }

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo conectar al MikroTik",
            "error": str(e),
        }