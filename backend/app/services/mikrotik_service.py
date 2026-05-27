from app.models.router_model import Router
from app.database import SessionLocal
import routeros_api
from datetime import datetime
from librouteros import connect
import platform
import re
import subprocess

def get_default_router():
    db = SessionLocal()
    try:
        router = db.query(Router).order_by(Router.id.asc()).first()
        if not router:
            raise Exception("No hay router configurado")
        return router
    finally:
        db.close()


def get_mikrotik_connection():
    router = get_default_router()

    return routeros_api.RouterOsApiPool(
        router.host,
        username=router.username,
        password=router.password,
        port=int(router.api_port or 8728),
        plaintext_login=True,
    )



HOST = "10.70.1.1"
USERNAME = "root"
PASSWORD = "noraan008."
PORT = 8728


def get_mikrotik_api():
    connection = get_mikrotik_connection()
    return connection.get_api()


def get_system_resources():
    connection = None
    try:
        connection = get_mikrotik_connection()
        api = connection.get_api()
        return api.get_resource("/system/resource").get()
    except Exception as e:
        return {
            "status": "offline",
            "message": "No se pudo conectar al MikroTik",
            "error": str(e),
        }
    finally:
        if connection:
            try:
                connection.disconnect()
            except Exception:
                pass


def get_pppoe_secrets():
    api = get_mikrotik_api()
    return api.get_resource("/ppp/secret").get()


def get_pppoe_active():
    api = get_mikrotik_api()

    return list(
        api.get_resource("/ppp/active").get()
    )


def find_pppoe_secret(name: str):
    api = get_mikrotik_api()

    secrets = list(
        api.get_resource("/ppp/secret").get()
    )

    for secret in secrets:
        if secret.get("name") == name:
            return secret

    return None


def create_pppoe_secret(secret):
    api = get_mikrotik_api()
    ppp_secret = api.get_resource("/ppp/secret")

    data = {
        "name": secret.name,
        "password": secret.password,
        "service": getattr(secret, "service", "pppoe"),
        "profile": getattr(secret, "profile", "default"),
        "disabled": "no",
    }

    if getattr(secret, "remote_address", None):
        data["remote-address"] = secret.remote_address

    existing = find_pppoe_secret(secret.name)

    if existing:
        ppp_secret.update(
            **{
                ".id": existing[".id"],
                **data,
            }
        )

        return {
            "message": "PPPoE secret actualizado",
            "name": secret.name,
        }

    ppp_secret.add(**data)

    return {
        "message": "PPPoE secret creado",
        "name": secret.name,
    }


def update_pppoe_secret(
    old_name: str,
    name: str,
    password: str,
    profile: str = "default",
    remote_address: str | None = None,
    disabled: bool = False,
):
    api = get_mikrotik_api()
    ppp_secret = api.get_resource("/ppp/secret")

    existing = find_pppoe_secret(old_name)

    data = {
        "name": name,
        "password": password,
        "service": "pppoe",
        "profile": profile or "default",
        "disabled": "yes" if disabled else "no",
    }

    if remote_address:
        data["remote-address"] = remote_address

    if existing:
        ppp_secret.update(
            **{
                ".id": existing[".id"],
                **data,
            }
        )

        return {
            "message": "PPPoE secret actualizado",
            "old_name": old_name,
            "name": name,
        }

    ppp_secret.add(**data)

    return {
        "message": "PPPoE secret creado porque no existía",
        "name": name,
    }


def disable_pppoe_secret(name: str):
    api = get_mikrotik_api()
    ppp_secret = api.get_resource("/ppp/secret")

    existing = find_pppoe_secret(name)

    if not existing:
        return {
            "error": "PPPoE secret no encontrado",
            "name": name,
        }

    ppp_secret.update(
        **{
            ".id": existing[".id"],
            "disabled": "yes",
        }
    )

    return {
        "message": "Cliente PPPoE deshabilitado",
        "name": name,
    }


def enable_pppoe_secret(name: str):
    api = get_mikrotik_api()
    ppp_secret = api.get_resource("/ppp/secret")

    existing = find_pppoe_secret(name)

    if not existing:
        return {
            "error": "PPPoE secret no encontrado",
            "name": name,
        }

    ppp_secret.update(
        **{
            ".id": existing[".id"],
            "disabled": "no",
        }
    )

    return {
        "message": "Cliente PPPoE habilitado",
        "name": name,
    }


def remove_pppoe_active(name: str):
    api = get_mikrotik_api()
    active = api.get_resource("/ppp/active")

    sessions = list(
        active.get()
    )

    removed = 0

    for session in sessions:
        if session.get("name") == name:
            active.remove(session[".id"])
            removed += 1

    if removed > 0:
        return {
            "message": "Conexión PPPoE activa eliminada",
            "name": name,
            "removed": removed,
        }

    return {
        "message": "No había conexión activa PPPoE",
        "name": name,
        "removed": 0,
    }


def get_simple_queues():
    api = get_mikrotik_api()
    return api.get_resource("/queue/simple").get()


def get_interface_traffic(interface_name: str = "sfp-sfpplus1"):
    api = get_mikrotik_api()

    interfaces = list(
        api.get_resource("/interface").get()
    )

    target = None

    for item in interfaces:
        if item.get("name") == interface_name:
            target = item
            break

    if not target:
        return {
            "timestamp": datetime.now().isoformat(),
            "interface": interface_name,
            "rx_bytes": 0,
            "tx_bytes": 0,
            "error": "Interfaz no encontrada",
        }

    return {
        "timestamp": datetime.now().isoformat(),
        "interface": interface_name,
        "rx_bytes": int(target.get("rx-byte", 0) or 0),
        "tx_bytes": int(target.get("tx-byte", 0) or 0),
    }


def get_pppoe_client_traffic():
    api = get_mikrotik_api()

    active_sessions = list(
        api.get_resource("/ppp/active").get()
    )

    interfaces = list(
        api.get_resource("/interface").get()
    )

    results = []

    for session in active_sessions:
        username = str(session.get("name", "")).strip()
        username_clean = username.lower()

        interface_match = None

        for interface in interfaces:
            interface_name = str(interface.get("name", "")).strip()

            interface_clean = (
                interface_name
                .replace("<", "")
                .replace(">", "")
                .replace("pppoe-", "")
                .replace("ppp-", "")
                .lower()
                .strip()
            )

            if (
                interface_clean == username_clean
                or username_clean in interface_clean
                or interface_clean in username_clean
            ):
                interface_match = interface
                break

        rx_bytes = 0
        tx_bytes = 0
        interface_name = None

        if interface_match:
            rx_bytes = int(interface_match.get("rx-byte", 0) or 0)
            tx_bytes = int(interface_match.get("tx-byte", 0) or 0)
            interface_name = interface_match.get("name")

        results.append(
            {
                "name": username,
                "address": session.get("address"),
                "uptime": session.get("uptime"),
                "service": session.get("service"),
                "caller_id": session.get("caller-id"),
                "interface": interface_name,
                "rx_bytes": rx_bytes,
                "tx_bytes": tx_bytes,
            }
        )

    return results
def get_mikrotik_interfaces_debug():
    api = get_mikrotik_api()

    return list(
        api.get_resource("/interface").get()
    )
def ping_address(address: str, count: int = 4):
    target = str(address or "").strip()
    if not target:
        return {"status": "error", "message": "Dirección vacía."}

    safe_count = max(1, min(int(count or 4), 10))
    system = platform.system().lower()

    command = ["ping", "-n", str(safe_count), target] if "windows" in system else ["ping", "-c", str(safe_count), target]

    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=12)
    except subprocess.TimeoutExpired:
        return {
            "status": "offline",
            "address": target,
            "message": "Tiempo de espera agotado.",
            "avg_ms": None,
            "packet_loss": 100,
        }

    output = f"{completed.stdout}\n{completed.stderr}"
    packet_loss = None
    avg_ms = None

    loss_match = re.search(r"(\d+)%\s*(?:loss|perdidos|perdida|pérdida)", output, re.IGNORECASE)
    if loss_match:
        packet_loss = int(loss_match.group(1))

    avg_match = re.search(r"(?:Media|Average)\s*=\s*(\d+)\s*ms", output, re.IGNORECASE)
    if avg_match:
        avg_ms = int(avg_match.group(1))

    linux_avg_match = re.search(r"=\s*[\d.]+/([\d.]+)/[\d.]+", output)
    if avg_ms is None and linux_avg_match:
        avg_ms = float(linux_avg_match.group(1))

    is_online = completed.returncode == 0 and (packet_loss is None or packet_loss < 100)

    return {
        "status": "online" if is_online else "offline",
        "address": target,
        "avg_ms": avg_ms,
        "packet_loss": packet_loss if packet_loss is not None else (0 if is_online else 100),
        "raw": output[-2000:],
    }