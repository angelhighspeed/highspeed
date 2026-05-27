import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, normalizeStatus } from "./mobileApi";

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

function getAddress(customer) {
  return customer?.address || customer?.direccion || "";
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

function getCustomerStatus(customer) {
  return normalizeStatus(customer?.status || customer?.estado || customer?.customer_status);
}

function statusLabel(status) {
  if (status === "active") return "Activo";
  if (status === "suspended") return "Suspendido";
  if (status === "pending") return "Pendiente";
  return "Sin estado";
}

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export default function MobileAutoCut() {
  const [customers, setCustomers] = useState([]);
  const [statusSummary, setStatusSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("suspended");
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  const visibleCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (customers || [])
      .filter((customer) => {
        const status = getCustomerStatus(customer);
        return status !== "deleted";
      })
      .filter((customer) => {
        const status = getCustomerStatus(customer);

        if (filter === "active" && status !== "active") return false;
        if (filter === "suspended" && status !== "suspended") return false;
        if (filter === "pending" && status !== "pending") return false;

        if (!term) return true;

        const text = [
          getName(customer),
          getPhone(customer),
          getAddress(customer),
          getIp(customer),
          getPppoeUser(customer),
          customer.zone,
          customer.zona,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(term);
      });
  }, [customers, query, filter]);

  const stats = useMemo(() => {
    const active = customers.filter((customer) => getCustomerStatus(customer) === "active");
    const suspended = customers.filter((customer) => getCustomerStatus(customer) === "suspended");
    const pending = customers.filter((customer) => getCustomerStatus(customer) === "pending");

    return {
      total: customers.length,
      active: active.length,
      suspended: suspended.length,
      pending: pending.length,
      debt:
        statusSummary?.total_debt ||
        statusSummary?.debt_total ||
        statusSummary?.pending_amount ||
        statusSummary?.total_pending ||
        0,
    };
  }, [customers, statusSummary]);

  const loadCustomers = async () => {
    const data = await apiGet("/customers");
    const items = Array.isArray(data)
      ? data
      : data?.items || data?.customers || data?.data || [];

    setCustomers(items);
  };

  const loadStatusSummary = async () => {
    try {
      const data = await apiGet("/dashboard/clients-status");
      setStatusSummary(data);
    } catch (err) {
      console.warn("No se pudo cargar resumen de estado:", err);
      setStatusSummary(null);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([loadCustomers(), loadStatusSummary()]);
    } catch (err) {
      console.warn("Error cargando cortes:", err);
      alert("No se pudo cargar cortes/reconexión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const suspendCustomer = async (customer) => {
    const id = getId(customer);

    if (!id) {
      alert("Cliente sin ID.");
      return;
    }

    if (!confirm(`¿Suspender a ${getName(customer)}?`)) return;

    try {
      setWorkingId(id);
      await apiPut(`/customers/${id}/suspend`, {});
      await loadAll();
      alert("Cliente suspendido.");
    } catch (err) {
      console.warn("Error suspendiendo cliente:", err);
      alert(
        "No se pudo suspender. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setWorkingId(null);
    }
  };

  const activateCustomer = async (customer) => {
    const id = getId(customer);

    if (!id) {
      alert("Cliente sin ID.");
      return;
    }

    try {
      setWorkingId(id);
      const data = await apiPut(`/customers/${id}/activate`, {});
      await loadAll();

      const mikrotik = data?.mikrotik || {};

      if (mikrotik?.status === "error") {
        alert("Cliente activado, pero MikroTik respondió error: " + JSON.stringify(mikrotik));
      } else {
        alert("Cliente activado.");
      }
    } catch (err) {
      console.warn("Error activando cliente:", err);
      alert(
        "No se pudo activar. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setWorkingId(null);
    }
  };

  const reconnectCustomer = async (customer) => {
    const id = getId(customer);

    if (!id) {
      alert("Cliente sin ID.");
      return;
    }

    if (!confirm(`¿Reconectar servicio de ${getName(customer)}?`)) return;

    try {
      setWorkingId(id);
      const data = await apiPost(`/auto-cut/reconnect/${id}`, {});
      await loadAll();

      alert("Reconexión enviada. Respuesta: " + JSON.stringify(data));
    } catch (err) {
      console.warn("Error reconectando cliente:", err);
      alert(
        "No se pudo reconectar. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="hsm-autocut-page">
      <section className="hsm-autocut-head">
        <div>
          <h2>Cortes / Reconexión</h2>
          <p>Control sincronizado con clientes y MikroTik</p>
        </div>

        <button onClick={loadAll}>Actualizar</button>
      </section>

      <section className="hsm-autocut-stats">
        <div>
          <strong>{stats.active}</strong>
          <span>Activos</span>
        </div>

        <div>
          <strong>{stats.suspended}</strong>
          <span>Suspendidos</span>
        </div>

        <div>
          <strong>{money(stats.debt)}</strong>
          <span>Deuda</span>
        </div>
      </section>

      <section className="hsm-autocut-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente, PPPoE o IP..."
        />

        <div className="hsm-autocut-filter">
          <button
            className={filter === "suspended" ? "active" : ""}
            onClick={() => setFilter("suspended")}
          >
            Suspendidos
          </button>

          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Activos
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
        <section className="hsm-autocut-empty">
          <p>Cargando estado de clientes...</p>
        </section>
      )}

      {!loading && visibleCustomers.length === 0 && (
        <section className="hsm-autocut-empty">
          <p>No hay clientes para mostrar.</p>
        </section>
      )}

      <section className="hsm-autocut-list">
        {visibleCustomers.map((customer) => {
          const id = getId(customer);
          const status = getCustomerStatus(customer);
          const isActive = status === "active";
          const isSuspended = status === "suspended";

          return (
            <article key={id} className="hsm-autocut-card">
              <div className="hsm-autocut-card-head">
                <div>
                  <h3>{getName(customer)}</h3>
                  <span className={`hsm-status ${isActive ? "active" : "pending"}`}>
                    {statusLabel(status)}
                  </span>
                </div>

                <div className="hsm-autocut-icon">⚡</div>
              </div>

              <div className="hsm-autocut-grid">
                <div>
                  <small>Teléfono</small>
                  <strong>{getPhone(customer) || "-"}</strong>
                </div>

                <div>
                  <small>Dirección</small>
                  <strong>{getAddress(customer) || "-"}</strong>
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

              <div className="hsm-autocut-actions">
                {!isActive && (
                  <button disabled={workingId === id} onClick={() => activateCustomer(customer)}>
                    Activar
                  </button>
                )}

                {!isActive && (
                  <button disabled={workingId === id} onClick={() => reconnectCustomer(customer)}>
                    Reconectar
                  </button>
                )}

                {!isSuspended && (
                  <button
                    disabled={workingId === id}
                    className="danger"
                    onClick={() => suspendCustomer(customer)}
                  >
                    Suspender
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
