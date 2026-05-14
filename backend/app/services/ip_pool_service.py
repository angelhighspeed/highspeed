import ipaddress


def parse_ip_ranges(ip_ranges_text: str | None):
    if not ip_ranges_text:
        return []

    networks = []

    lines = ip_ranges_text.replace(",", "\n").splitlines()

    for line in lines:
        value = line.strip()

        if not value:
            continue

        try:
            networks.append(ipaddress.ip_network(value, strict=False))
        except Exception:
            continue

    return networks


def get_next_available_ip(ip_ranges_text: str | None, used_ips: list[str]):
    networks = parse_ip_ranges(ip_ranges_text)

    used = set()

    for ip in used_ips:
        if ip:
            used.add(ip.strip())

    for network in networks:
        for ip in network.hosts():
            ip_text = str(ip)

            if ip_text not in used:
                return ip_text

    return None
def get_available_ips(ip_ranges_text: str | None, used_ips: list[str], limit: int = 50000):
    networks = parse_ip_ranges(ip_ranges_text)

    used = set()

    for ip in used_ips:
        if ip:
            used.add(ip.strip())

    available = []

    for network in networks:
        for ip in network.hosts():
            ip_text = str(ip)

            if ip_text not in used:
                available.append(ip_text)

            if len(available) >= limit:
                return available

    return available