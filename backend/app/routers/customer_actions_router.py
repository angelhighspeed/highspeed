from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.auth.dependencies import require_roles
from app.models.customer_model import Customer

try:
    from app.models.router_model import Router
except Exception:
    Router = None


router = APIRouter()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def get_first_attr(obj, names, default=None):
    if obj is None:
        return default

    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)

            if value not in [None, ""]:
                return value

    return default


def set_first_existing_attr(obj, names, value):
    for name in names:
        if hasattr(obj, name):
            setattr(obj, name, value)
            return True

    return False


def get_customer_or_404(db: Session, customer_id: int):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return customer


def get_customer_name(customer: Customer):
    name = get_first_attr(customer, ["name", "first_name", "nombre"], "")
    last_name = get_first_attr(customer, ["last_name", "lastname", "apellido"], "")

    return f"{name or ''} {last_name or ''}".strip()


def get_customer_pppoe_username(customer: Customer):
    return get_first_attr(
        customer,
        ["pppoe_username", "username_pppoe", "username", "user"],
    )


def get_customer_status(customer: Customer):
    return get_first_attr(customer, ["status", "estado", "state"], "")


def set_customer_status(customer: Customer, status: str):
    return set_first_existing_attr(customer, ["status", "estado", "state"], status)


def customer_to_dict(customer: Customer):
    item = {}

    for column in Customer.__table__.columns:
        item[column.name] = getattr(customer, column.name)

    return item


def serialize_customer(customer: Customer):
    return {
        "id": customer.id,
        "name": get_customer_name(customer),
        "pppoe_username": get_customer_pppoe_username(customer),
        "ip": get_first_attr(customer, ["remote_address", "ip", "ip_address"], ""),
        "phone": get_first_attr(customer, ["phone", "telefono", "cellphone", "mobile"], ""),
        "zone": get_first_attr(customer, ["zone", "zona", "localidad"], ""),
        "status": get_customer_status(customer),
        "router_id": get_first_attr(customer, ["router_id", "mikrotik_router_id"], None),
    }


def serialize_router(router):
    if not router:
        return None

    return {
        "id": getattr(router, "id", None),
        "name": get_first_attr(
            router,
            ["name", "router_name", "identity"],
            f"Router {getattr(router, 'id', '')}",
        ),
        "host": get_first_attr(router, ["host", "ip", "address"], ""),
        "port": get_first_attr(router, ["port", "api_port"], ""),
    }


def get_customer_router(db: Session, customer: Customer):
    if Router is None:
        return None

    router_id = get_first_attr(customer, ["router_id", "mikrotik_router_id"], None)

    if not router_id:
        return None

    return db.query(Router).filter(Router.id == router_id).first()


def get_mikrotik_api_for_customer(db: Session, customer: Customer):
    """
    Usa el router_id del cliente.
    Si el cliente no tiene router_id, usa el primer router cargado en el sistema.
    Siempre devuelve un objeto routeros_api, compatible con api.get_resource().
    """

    if Router is None:
        raise Exception("No está disponible el modelo Router.")

    router_id = get_first_attr(customer, ["router_id", "mikrotik_router_id"], None)

    router = None

    if router_id:
        router = db.query(Router).filter(Router.id == router_id).first()

    if router is None:
        router = db.query(Router).order_by(Router.id.asc()).first()

    if router is None:
        raise Exception(
            "No hay router MikroTik configurado. Cargá un router en Routers MikroTik."
        )

    host = get_first_attr(router, ["host", "ip", "address"])
    username = get_first_attr(router, ["username", "user", "usuario"])
    password = get_first_attr(router, ["password", "pass", "clave"])
    port = get_first_attr(router, ["api_port", "port"], 8728)

    if not host or not username or not password:
        raise Exception(
            "El router no tiene host, usuario o password configurado."
        )

    try:
        import routeros_api
    except Exception:
        raise Exception(
            "Falta instalar routeros-api. Ejecutá: python -m pip install routeros-api"
        )

    connection = routeros_api.RouterOsApiPool(
        host=host,
        username=username,
        password=password,
        port=int(port or 8728),
        plaintext_login=True,
    )

    return connection.get_api(), router
    """
    Usa el router_id del cliente si existe.
    Si no existe router_id, usa el mikrotik_service viejo como fallback.
    """

    router = get_customer_router(db, customer)

    if router:
        host = get_first_attr(router, ["host", "ip", "address"])
        username = get_first_attr(router, ["username", "user", "usuario"])
        password = get_first_attr(router, ["password", "pass", "clave"])
        port = get_first_attr(router, ["port", "api_port"], 8728)

        if not host or not username or not password:
            raise Exception(
                "El router del cliente no tiene host, usuario o password configurado."
            )

        try:
            import routeros_api
        except Exception:
            raise Exception(
                "Falta instalar routeros-api. Ejecutá: .\\venv\\Scripts\\pip.exe install routeros-api"
            )

        connection = routeros_api.RouterOsApiPool(
            host=host,
            username=username,
            password=password,
            port=int(port or 8728),
            plaintext_login=True,
        )

        return connection.get_api(), router

    try:
        from app.services import mikrotik_service
    except Exception as e:
        raise Exception(f"No se pudo importar mikrotik_service: {str(e)}")

    return mikrotik_service.get_mikrotik_api(), None


def find_pppoe_secret(api, username: str):
    secret_resource = api.get_resource("/ppp/secret")

    try:
        secrets = secret_resource.get(name=username)
    except Exception:
        secrets = []

    if secrets:
        return secrets[0]

    try:
        all_secrets = secret_resource.get()
    except Exception:
        all_secrets = []

    for secret in all_secrets:
        if str(secret.get("name", "")).strip() == str(username).strip():
            return secret

    return None


def get_pppoe_active_sessions(api, username: str):
    active_resource = api.get_resource("/ppp/active")

    try:
        active_sessions = active_resource.get(name=username)
    except Exception:
        active_sessions = []

    if active_sessions:
        return active_sessions

    try:
        all_active = active_resource.get()
    except Exception:
        all_active = []

    result = []

    for active in all_active:
        if str(active.get("name", "")).strip() == str(username).strip():
            result.append(active)

    return result


def remove_resource_item(resource, item_id):
    """
    routeros_api puede aceptar remove(id=...) o remove("*.ID")
    según versión. Probamos las dos formas.
    """

    try:
        resource.remove(id=item_id)
        return True, None
    except TypeError:
        try:
            resource.remove(item_id)
            return True, None
        except Exception as e:
            return False, str(e)
    except Exception as e:
        return False, str(e)


def remove_pppoe_active_sessions(api, username: str):
    active_resource = api.get_resource("/ppp/active")
    active_sessions = get_pppoe_active_sessions(api, username)

    removed = 0
    errors = []

    for active in active_sessions:
        active_id = active.get(".id") or active.get("id")

        if not active_id:
            continue

        ok, error = remove_resource_item(active_resource, active_id)

        if ok:
            removed += 1
        elif error:
            errors.append(error)

    return {
        "removed": removed,
        "errors": errors,
    }


def set_pppoe_secret_disabled(api, username: str, disabled: bool):
    secret_resource = api.get_resource("/ppp/secret")
    secret = find_pppoe_secret(api, username)

    if not secret:
        return {
            "status": "warning",
            "message": "PPPoE secret no encontrado en el MikroTik seleccionado.",
            "name": username,
            "secret_found": False,
        }

    secret_id = secret.get(".id") or secret.get("id")

    if not secret_id:
        return {
            "status": "error",
            "message": "El PPPoE secret existe pero no tiene .id para modificarlo.",
            "name": username,
            "secret_found": True,
            "secret": secret,
        }

    disabled_value = "yes" if disabled else "no"

    try:
        secret_resource.set(id=secret_id, disabled=disabled_value)
    except TypeError:
        try:
            secret_resource.set(secret_id, disabled=disabled_value)
        except Exception as e:
            return {
                "status": "error",
                "message": f"No se pudo modificar el PPPoE secret: {str(e)}",
                "name": username,
                "secret_found": True,
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"No se pudo modificar el PPPoE secret: {str(e)}",
            "name": username,
            "secret_found": True,
        }

    return {
        "status": "ok",
        "message": (
            "Secret PPPoE deshabilitado en MikroTik."
            if disabled
            else "Secret PPPoE habilitado en MikroTik."
        ),
        "name": username,
        "secret_found": True,
        "disabled": disabled,
    }


def delete_pppoe_secret(api, username: str):
    """
    Elimina el PPPoE Secret del MikroTik.
    Esto es permanente: para volver a activar al cliente se debe crear de nuevo.
    """

    secret_resource = api.get_resource("/ppp/secret")
    secret = find_pppoe_secret(api, username)

    if not secret:
        return {
            "status": "warning",
            "message": "PPPoE secret no encontrado en el MikroTik seleccionado.",
            "name": username,
            "secret_found": False,
            "deleted": False,
        }

    secret_id = secret.get(".id") or secret.get("id")

    if not secret_id:
        return {
            "status": "error",
            "message": "El PPPoE secret existe pero no tiene .id para eliminarlo.",
            "name": username,
            "secret_found": True,
            "deleted": False,
            "secret": secret,
        }

    ok, error = remove_resource_item(secret_resource, secret_id)

    if not ok:
        return {
            "status": "error",
            "message": f"No se pudo eliminar el PPPoE secret: {error}",
            "name": username,
            "secret_found": True,
            "deleted": False,
        }

    return {
        "status": "ok",
        "message": "PPPoE secret eliminado de MikroTik.",
        "name": username,
        "secret_found": True,
        "deleted": True,
    }


def mikrotik_action(db: Session, customer: Customer, action: str):
    username = get_customer_pppoe_username(customer)

    if not username:
        return {
            "status": "skipped",
            "message": "Cliente sin usuario PPPoE. No se tocó MikroTik.",
        }

    try:
        api, router = get_mikrotik_api_for_customer(db, customer)
    except Exception as e:
        return {
            "status": "error",
            "message": f"No se pudo conectar al MikroTik: {str(e)}",
        }

    try:
        if action == "enable":
            result = set_pppoe_secret_disabled(api, username, disabled=False)
            result["router"] = serialize_router(router)
            return result

        if action == "disable":
            secret_result = set_pppoe_secret_disabled(api, username, disabled=True)
            active_result = remove_pppoe_active_sessions(api, username)

            return {
                "status": secret_result.get("status"),
                "message": secret_result.get("message"),
                "name": username,
                "secret": secret_result,
                "remove_active": active_result,
                "router": serialize_router(router),
            }

        if action == "delete":
            active_result = remove_pppoe_active_sessions(api, username)
            delete_result = delete_pppoe_secret(api, username)

            return {
                "status": delete_result.get("status"),
                "message": delete_result.get("message"),
                "name": username,
                "secret": delete_result,
                "remove_active": active_result,
                "router": serialize_router(router),
            }

        return {
            "status": "skipped",
            "message": f"Acción MikroTik no compatible: {action}",
            "router": serialize_router(router),
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error MikroTik: {str(e)}",
            "router": serialize_router(router),
        }


@router.get("/customers/list-all")
def get_customers_list_all(
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "operador", "tecnico", "cobrador"])
    ),
):
    customers = db.query(Customer).order_by(Customer.id.desc()).all()
    result = []

    for customer in customers:
        status = str(get_customer_status(customer) or "").lower()

        if not include_deleted and status == "deleted":
            continue

        result.append(customer_to_dict(customer))

    return result


@router.get("/customers/{customer_id}/mikrotik-check")
def check_customer_mikrotik(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "operador", "tecnico"])),
):
    customer = get_customer_or_404(db, customer_id)
    username = get_customer_pppoe_username(customer)

    if not username:
        return {
            "status": "skipped",
            "message": "Cliente sin usuario PPPoE.",
            "customer": serialize_customer(customer),
        }

    try:
        api, router = get_mikrotik_api_for_customer(db, customer)
        secret = find_pppoe_secret(api, username)
        active_sessions = get_pppoe_active_sessions(api, username)

        return {
            "status": "ok",
            "customer": serialize_customer(customer),
            "router": serialize_router(router),
            "pppoe_username": username,
            "secret_found": bool(secret),
            "secret": secret,
            "active_count": len(active_sessions),
            "active_sessions": active_sessions,
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "customer": serialize_customer(customer),
        }


@router.get("/customers")
def get_customers_with_status(
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(["admin", "operador", "tecnico", "cobrador"])
    ),
):
    customers = db.query(Customer).order_by(Customer.id.desc()).all()
    result = []

    for customer in customers:
        status = str(get_customer_status(customer) or "").lower()

        if not include_deleted and status == "deleted":
            continue

        result.append(customer_to_dict(customer))

    return result


@router.put("/customers/{customer_id}/activate")
def activate_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "operador"])),
):
    customer = get_customer_or_404(db, customer_id)

    if not set_customer_status(customer, "active"):
        raise HTTPException(
            status_code=500,
            detail="No se pudo cambiar el estado del cliente a active.",
        )

    mikrotik_result = mikrotik_action(db, customer, "enable")

    db.commit()
    db.refresh(customer)

    return {
        "status": "ok",
        "message": "Cliente activado.",
        "customer": serialize_customer(customer),
        "mikrotik": mikrotik_result,
    }


@router.put("/customers/{customer_id}/suspend")
def suspend_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "operador", "cobrador"])),
):
    customer = get_customer_or_404(db, customer_id)

    if not set_customer_status(customer, "suspended"):
        raise HTTPException(
            status_code=500,
            detail="No se pudo cambiar el estado del cliente a suspended.",
        )

    mikrotik_result = mikrotik_action(db, customer, "disable")

    db.commit()
    db.refresh(customer)

    return {
        "status": "ok",
        "message": "Cliente suspendido.",
        "customer": serialize_customer(customer),
        "mikrotik": mikrotik_result,
    }


@router.put("/customers/{customer_id}/unsuspend")
def unsuspend_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin", "operador"])),
):
    customer = get_customer_or_404(db, customer_id)

    if not set_customer_status(customer, "active"):
        raise HTTPException(
            status_code=500,
            detail="No se pudo cambiar el estado del cliente a active.",
        )

    mikrotik_result = mikrotik_action(db, customer, "enable")

    db.commit()
    db.refresh(customer)

    return {
        "status": "ok",
        "message": "Cliente reactivado.",
        "customer": serialize_customer(customer),
        "mikrotik": mikrotik_result,
    }


@router.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["admin"])),
):
    customer = get_customer_or_404(db, customer_id)

    if not set_customer_status(customer, "deleted"):
        raise HTTPException(
            status_code=500,
            detail="No se pudo cambiar el estado del cliente a deleted.",
        )

    # Al eliminar del CRM, también elimina el PPPoE Secret en MikroTik.
    mikrotik_result = mikrotik_action(db, customer, "delete")

    db.commit()
    db.refresh(customer)

    return {
        "status": "ok",
        "message": "Cliente eliminado del listado principal.",
        "customer": serialize_customer(customer),
        "mikrotik": mikrotik_result,
    }
