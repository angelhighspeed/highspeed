from datetime import datetime
from librouteros import connect

HOST = "10.70.1.1"
USERNAME = "root"
PASSWORD = "noraan008."
PORT = 8728


def get_mikrotik_api():
    return connect(
        username=USERNAME,
        password=PASSWORD,
        host=HOST,
        port=PORT,
        timeout=5
    )


def get_system_resources():
    api = get_mikrotik_api()

    return list(
        api.path("/system/resource").select(
            "uptime",
            "version",
            "cpu-load",
            "free-memory"
        )
    )


def get_pppoe_secrets():
    api = get_mikrotik_api()
    return list(api.path("/ppp/secret"))


def get_pppoe_active():
    api = get_mikrotik_api()

    return list(
        api.path("/ppp/active").select(
            ".id",
            "name",
            "address",
            "uptime",
            "service",
            "caller-id"
        )
    )


def find_pppoe_secret(name: str):
    api = get_mikrotik_api()
    secrets = list(api.path("/ppp/secret").select(".id", "name"))

    for secret in secrets:
        if secret.get("name") == name:
            return secret

    return None


def create_pppoe_secret(secret):
    api = get_mikrotik_api()
    ppp_secret = api.path("/ppp/secret")

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
        ppp_secret.update(**{
            ".id": existing[".id"],
            **data
        })

        return {
            "message": "PPPoE secret actualizado",
            "name": secret.name
        }

    ppp_secret.add(**data)

    return {
        "message": "PPPoE secret creado",
        "name": secret.name
    }


def update_pppoe_secret(
    old_name: str,
    name: str,
    password: str,
    profile: str = "default",
    remote_address: str | None = None,
    disabled: bool = False
):
    api = get_mikrotik_api()
    ppp_secret = api.path("/ppp/secret")

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
        ppp_secret.update(**{
            ".id": existing[".id"],
            **data
        })

        return {
            "message": "PPPoE secret actualizado",
            "old_name": old_name,
            "name": name
        }

    ppp_secret.add(**data)

    return {
        "message": "PPPoE secret creado porque no existía",
        "name": name
    }


def disable_pppoe_secret(name: str):
    api = get_mikrotik_api()
    ppp_secret = api.path("/ppp/secret")

    existing = find_pppoe_secret(name)

    if not existing:
        return {"error": "PPPoE secret no encontrado"}

    ppp_secret.update(**{
        ".id": existing[".id"],
        "disabled": "yes"
    })

    return {
        "message": "Cliente PPPoE deshabilitado",
        "name": name
    }


def enable_pppoe_secret(name: str):
    api = get_mikrotik_api()
    ppp_secret = api.path("/ppp/secret")

    existing = find_pppoe_secret(name)

    if not existing:
        return {"error": "PPPoE secret no encontrado"}

    ppp_secret.update(**{
        ".id": existing[".id"],
        "disabled": "no"
    })

    return {
        "message": "Cliente PPPoE habilitado",
        "name": name
    }


def remove_pppoe_active(name: str):
    api = get_mikrotik_api()
    active = api.path("/ppp/active")

    sessions = list(active.select(".id", "name"))

    for session in sessions:
        if session.get("name") == name:
            active.remove(session[".id"])

            return {
                "message": "Conexión PPPoE activa eliminada",
                "name": name
            }

    return {
        "message": "No había conexión activa PPPoE",
        "name": name
    }


def get_simple_queues():
    api = get_mikrotik_api()
    return list(api.path("/queue/simple"))


def get_interface_traffic(interface_name: str = "sfp-sfpplus1"):
    api = get_mikrotik_api()

    interfaces = list(
        api.path("/interface").select(
            ".id",
            "name",
            "rx-byte",
            "tx-byte"
        )
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
            "error": "Interfaz no encontrada"
        }

    return {
        "timestamp": datetime.now().isoformat(),
        "interface": interface_name,
        "rx_bytes": int(target.get("rx-byte", 0)),
        "tx_bytes": int(target.get("tx-byte", 0)),
    }