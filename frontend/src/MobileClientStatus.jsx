import React, { useEffect, useMemo, useState } from "react";
import { apiGet, normalizeStatus } from "./mobileApi";

function getId(customer) {
  return customer?.id || customer?.customer_id;
}

function getName(customer) {
  return (
    customer?.full_name ||
    customer?.name ||
    customer?.nombre ||
    customer?.customer_name ||
    "Sin nombre"
  );
}

function getPhone(customer) {
  return customer?.phone || customer?.telefono || customer?.customer_phone || "";
}

function getIp(customer) {
  return (
    customer?.remote_address ||
    customer?.customer_ip ||
    customer?.ip ||
    customer?.ip_address ||
    customer?.pppoe_ip ||
    ""
  );
}

function getPppoeUser(customer) {
  return (
    customer?.pppoe_username ||
    customer?.pppoe_user ||
    customer?.username ||
    customer?.customer_pppoe_username ||
    ""
  );
}

function getStatus(customer) {
  return normalizeStatus(customer?.status || customer?.estado || customer?.customer_status);
}

function statusLabel(status) {
  if (status === "active") return "Activo";
  if (status === "suspended") return "Suspendido";
  if (status === "pending") return "Pendiente";
  if (status === "deleted") return "Eliminado";
  return "Sin estado";
}

function isOnline(customer, activeUsersSet) {
  const user = getPppoeUser(customer);
  const onlineValue =
    customer?.online ||
    customer?.is_online ||
    customer?.connected ||
    customer?.mikrotik_online;

  if (onlineValue === true) return true;
  if (user && activeUsersSet.has(String(user).toLowerCase())) return true;

  return false;
}

export default function MobileClientStatus() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activePppoe, setActivePppoe] = useState([]);
  const [mikrotikChecks, setMikrotikChecks] = useState({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("online");
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState(null);

  const activeUsersSet = useMemo(() => {
    return new Set(
      (activePppoe || [])
        .map((item) => item.name || item.user || item.username || item.pppoe_username)
        .filter(Boolean)
        .map((item) => String(item).toLowerCase())
    );
  }, [activePppoe]);

  const visibleCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (customers || [])
      .filter((customer) => getStatus(customer) !== "deleted")
      .filter((customer) => {
        const status = getStatus(customer);
        const online = isOnline(customer, activeUsersSet);
        const check = mikrotikChecks[getId(customer)];

        if (filter === "online" && !online) return false;
        if (filter === "offline" && online) return false;
        if (filter === "active" && status !== "active") return false;
        if (filter === "suspended" && status !== "suspended") return false;
        if (filter === "mikrotik-error" && check?.status !== "error") return false;

        if (!term) return true;

        const text = [
          getName(customer),
          getPhone(customer),
          getIp(customer),
          getPppoeUser(customer),
          customer.address,
          customer.direccion,
          customer.zone,
          customer.zona,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(term);
      });
  }, [customers, query, filter, activeUsersSet, mikrotikChecks]);

  const stats = useMemo(() => {
    const base = (customers || []).filter((customer) => getStatus(customer) !== "deleted");
    const online = base.filter((customer) => isOnline(customer, activeUsersSet));
    const active = base.filter((customer) => getStatus(customer) === "active");
    const suspended = base.filter((customer) => getStatus(customer) === "suspended");

    return {
      total: base.length,
      online: online.length,
      offline: Math.max(base.length - online.length, 0),
      active: active.length,
      suspended: suspended.length,
      summaryOnline:
        summary?.online ||
        summary?.connected ||
        summary?.clientes_online ||
        online.length,
    };
  }, [customers, activeUsersSet, summary]);

  const loadCustomers = async () => {
    const data = await apiGet("/customers");
    const items = Array.isArray(data)
      ? data
      : data?.items || data?.customers || data?.data || [];

    setCustomers(items);
  };

  const loadSummary = async () => {
    try {
      const data = await apiGet("/dashboard/clients-status");
      setSummary(data);
    } catch (err) {
      console.warn("No se pudo cargar resumen de clientes:", err);
      setSummary(null);
    }
  };

  const loadActivePppoe = async () => {
    try {
      const data = await apiGet("/mikrotik/pppoe/active");
      const items = Array.isArray(data)
        ? data
        : data?.items || data?.active || data?.sessions || data?.data || [];

      setActivePppoe(items);
    } catch (err) {
      console.warn("No se pudo cargar PPPoE activos:", err);
      setActivePppoe([]);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([loadCustomers(), loadSummary(), loadActivePppoe()]);
    } catch (err) {
      console.warn("Error cargando estado de clientes:", err);
      alert("No se pudo cargar el estado de clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const checkCustomerMikrotik = async (customer) => {
    const id = getId(customer);

    if (!id) {
      alert("Cliente sin ID.");
      return;
    }

    try {
      setCheckingId(id);

      const data = await apiGet(`/customers/${id}/mikrotik-check`);

      setMikrotikChecks((prev) => ({
        ...prev,
        [id]: data,
      }));

      alert("Chequeo MikroTik: " + JSON.stringify(data));
    } catch (err) {
      console.warn("Error chequeando MikroTik:", err);

      const errorData = {
        status: "error",
        detail: err?.response?.data || err?.message || "Error",
      };

      setMikrotikChecks((prev) => ({
        ...prev,
        [id]: errorData,
      }));

      alert("No se pudo chequear MikroTik. Error: " + JSON.stringify(errorData.detail));
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="hsm-status-page">
      <section className="hsm-status-head">
        <div>
          <h2>Estado de clientes</h2>
          <p>Online / Offline sincronizado con MikroTik</p>
        </div>

        <button onClick={loadAll}>Actualizar</button>
      </section>

      <section className="hsm-status-stats">
        <div>
          <strong>{stats.online}</strong>
          <span>Online</span>
        </div>

        <div>
          <strong>{stats.offline}</strong>
          <span>Offline</span>
        </div>

        <div>
          <strong>{stats.suspended}</strong>
          <span>Suspendidos</span>
        </div>
      </section>

      <section className="hsm-status-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente, PPPoE o IP..."
        />

        <div className="hsm-status-filter">
          <button
            className={filter === "online" ? "active" : ""}
            onClick={() => setFilter("online")}
          >
            Online
          </button>

          <button
            className={filter === "offline" ? "active" : ""}
            onClick={() => setFilter("offline")}
          >
            Offline
          </button>

          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Activos
          </button>

          <button
            className={filter === "suspended" ? "active" : ""}
            onClick={() => setFilter("suspended")}
          >
            Suspendidos
          </button>

          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
        </div>
      </section>

      {loading && (
        <section className="hsm-status-empty">
          <p>Cargando estado de clientes...</p>
        </section>
      )}

      {!loading && visibleCustomers.length === 0 && (
        <section className="hsm-status-empty">
          <p>No hay clientes para mostrar.</p>
        </section>
      )}

      <section className="hsm-status-list">
        {visibleCustomers.map((customer) => {
          const id = getId(customer);
          const status = getStatus(customer);
          const online = isOnline(customer, activeUsersSet);
          const check = mikrotikChecks[id];

          return (
            <article key={id} className="hsm-status-card">
              <div className="hsm-status-card-head">
                <div>
                  <h3>{getName(customer)}</h3>
                  <span className={`hsm-status ${online ? "active" : "pending"}`}>
                    {online ? "Online" : "Offline"}
                  </span>
                </div>

                <div className="hsm-status-icon">📶</div>
              </div>

              <div className="hsm-status-grid">
                <div>
                  <small>Estado CRM</small>
                  <strong>{statusLabel(status)}</strong>
                </div>

                <div>
                  <small>Teléfono</small>
                  <strong>{getPhone(customer) || "-"}</strong>
                </div>

                <div>
                  <small>Usuario PPPoE</small>
                  <strong>{getPppoeUser(customer) || "-"}</strong>
                </div>

                <div>
                  <small>IP</small>
                  <strong>{getIp(customer) || "-"}</strong>
                </div>

                <div>
                  <small>Router</small>
                  <strong>{customer.router_id || "-"}</strong>
                </div>

                <div>
                  <small>Plan</small>
                  <strong>{customer.plan_id || "-"}</strong>
                </div>
              </div>

              {check && (
                <div className={`hsm-status-check ${check.status === "error" ? "error" : ""}`}>
                  <small>Chequeo MikroTik</small>
                  <pre>{JSON.stringify(check, null, 2)}</pre>
                </div>
              )}

              <div className="hsm-status-actions">
                <button disabled={checkingId === id} onClick={() => checkCustomerMikrotik(customer)}>
                  {checkingId === id ? "Chequeando..." : "Chequear MikroTik"}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
