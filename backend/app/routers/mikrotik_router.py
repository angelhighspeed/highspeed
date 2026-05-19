from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import require_roles

from app.schemas.pppoe_schema import PPPoESecretCreate

from app.services.mikrotik_service import (
    ping_address,
    get_system_resources,
    get_pppoe_secrets,
    create_pppoe_secret,
    disable_pppoe_secret,
    enable_pppoe_secret,
    get_simple_queues,
    get_pppoe_active,
    get_interface_traffic,
    remove_pppoe_active,
    get_pppoe_client_traffic,
    get_mikrotik_interfaces_debug,
)

router = APIRouter()


@router.get("/mikrotik/resources")
def mikrotik_resources(
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return get_system_resources()

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo conectar al MikroTik",
            "error": str(e),
        }


@router.get("/mikrotik/pppoe/secrets")
def list_pppoe_secrets(
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return get_pppoe_secrets()

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo listar PPPoE secrets",
            "error": str(e),
        }


@router.post("/mikrotik/pppoe/secrets")
def add_pppoe_secret(
    secret: PPPoESecretCreate,
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return create_pppoe_secret(secret)

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo crear PPPoE secret",
            "error": str(e),
        }


@router.put("/mikrotik/pppoe/secrets/{name}/disable")
def disable_secret(
    name: str,
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return disable_pppoe_secret(name)

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo deshabilitar PPPoE secret",
            "error": str(e),
        }


@router.put("/mikrotik/pppoe/secrets/{name}/enable")
def enable_secret(
    name: str,
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return enable_pppoe_secret(name)

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo habilitar PPPoE secret",
            "error": str(e),
        }


@router.get("/mikrotik/queues/simple")
def list_simple_queues(
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return get_simple_queues()

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo listar Simple Queues",
            "error": str(e),
        }


@router.get("/mikrotik/pppoe/active")
def list_pppoe_active(
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return get_pppoe_active()

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo listar clientes PPPoE online",
            "error": str(e),
        }


@router.get("/mikrotik/pppoe/client-traffic")
def list_pppoe_client_traffic(
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return get_pppoe_client_traffic()

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo leer tráfico de clientes PPPoE",
            "error": str(e),
        }


@router.get("/mikrotik/interfaces-debug")
def list_mikrotik_interfaces_debug(
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return get_mikrotik_interfaces_debug()

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo listar interfaces MikroTik",
            "error": str(e),
        }


@router.delete("/mikrotik/pppoe/active/{name}")
def disconnect_pppoe_active(
    name: str,
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return remove_pppoe_active(name)

    except Exception as e:
        return {
            "status": "error",
            "message": "No se pudo desconectar sesión PPPoE",
            "error": str(e),
        }


@router.get("/mikrotik/traffic")
def mikrotik_traffic(
    interface: str = Query("sfp-sfpplus1"),
    current_user: dict = Depends(
        require_roles(["admin", "tecnico"])
    ),
):
    try:
        return get_interface_traffic(interface)

    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo leer tráfico MikroTik",
            "error": str(e),
        }
@router.get("/mikrotik/ping")
def mikrotik_ping(
    address: str = Query(...),
    count: int = Query(4, ge=1, le=10),
    current_user: dict = Depends(require_roles(["admin", "tecnico", "operador"])),
):
    try:
        return ping_address(address, count=count)
    except Exception as e:
        return {
            "status": "error",
            "message": "No se pudo ejecutar ping.",
            "error": str(e),
        }
