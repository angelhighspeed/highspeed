import React, { useEffect, useMemo, useState } from "react";
import { apiGet, normalizeStatus } from "./mobileApi";
import { APP_NAME, APP_VERSION, APP_BUILD } from "./appVersion";

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatRate(value) {
  const n = Number(value || 0);

  if (n >= 1000 * 1000) return `${(n / 1000 / 1000).toFixed(2)} Mbps`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)} Kbps`;

  return `${n.toFixed(0)} bps`;
}

function getAmount(invoice) {
  return invoice?.amount || invoice?.total || invoice?.monto || invoice?.price || 0;
}

function getInvoiceStatus(invoice) {
  const raw = String(invoice?.status || invoice?.estado || "").toLowerCase();

  if (["paid", "pagada", "pagado"].includes(raw)) return "paid";
  if (["overdue", "vencida", "vencido"].includes(raw)) return "overdue";

  return "pending";
}

function getCustomerStatus(customer) {
  return normalizeStatus(customer?.status || customer?.estado || customer?.customer_status);
}

export default function MobileHome() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cashbox, setCashbox] = useState(null);
  const [clientStatus, setClientStatus] = useState(null);
  const [resources, setResources] = useState(null);
  const [activePppoe, setActivePppoe] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  const resource = useMemo(() => {
    if (Array.isArray(resources)) return resources[0] || {};
    if (Array.isArray(resources?.resources)) return resources.resources[0] || {};
    return resources || {};
  }, [resources]);

  const stats = useMemo(() => {
    const visibleCustomers = (customers || []).filter(
      (customer) => getCustomerStatus(customer) !== "deleted"
    );

    const activeCustomers = visibleCustomers.filter(
      (customer) => getCustomerStatus(customer) === "active"
    );

    const suspendedCustomers = visibleCustomers.filter(
      (customer) => getCustomerStatus(customer) === "suspended"
    );

    const pendingInvoices = (invoices || []).filter((invoice) =>
      ["pending", "overdue"].includes(getInvoiceStatus(invoice))
    );

    const paidInvoices = (invoices || []).filter(
      (invoice) => getInvoiceStatus(invoice) === "paid"
    );

    const pendingAmount = pendingInvoices.reduce(
      (acc, item) => acc + Number(getAmount(item) || 0),
      0
    );

    const paidAmount = paidInvoices.reduce(
      (acc, item) => acc + Number(getAmount(item) || 0),
      0
    );

    const cashboxTotal =
      cashbox?.total ||
      cashbox?.total_amount ||
      cashbox?.income ||
      cashbox?.ingresos ||
      paidAmount ||
      0;

    const download =
      traffic?.download ||
      traffic?.rx_rate ||
      traffic?.rx ||
      traffic?.["rx-rate"] ||
      traffic?.total_download ||
      0;

    const upload =
      traffic?.upload ||
      traffic?.tx_rate ||
      traffic?.tx ||
      traffic?.["tx-rate"] ||
      traffic?.total_upload ||
      0;

    return {
      customers: visibleCustomers.length,
      activeCustomers: activeCustomers.length,
      suspendedCustomers: suspendedCustomers.length,
      pendingInvoices: pendingInvoices.length,
      pendingAmount,
      cashboxTotal,
      pppoeActive: Array.isArray(activePppoe) ? activePppoe.length : 0,
      download,
      upload,
      cpu: resource?.["cpu-load"] ?? resource?.cpu_load ?? resource?.cpu ?? "-",
      memory: resource?.["free-memory"] || resource?.free_memory || "",
      uptime: resource?.uptime || "-",
      version: resource?.version || "-",
      online:
        clientStatus?.online ||
        clientStatus?.connected ||
        clientStatus?.clientes_online ||
        (Array.isArray(activePppoe) ? activePppoe.length : 0),
    };
  }, [customers, invoices, cashbox, clientStatus, resources, activePppoe, traffic]);

  const loadCustomers = async () => {
    const data = await apiGet("/customers");
    setCustomers(Array.isArray(data) ? data : data?.items || data?.customers || data?.data || []);
  };

  const loadInvoices = async () => {
    const data = await apiGet("/invoices");
    setInvoices(Array.isArray(data) ? data : data?.items || data?.invoices || data?.data || []);
  };

  const loadCashbox = async () => {
    try {
      const data = await apiGet("/cashbox/daily");
      setCashbox(data);
    } catch (err) {
      console.warn("No se pudo cargar caja diaria:", err);
      setCashbox(null);
    }
  };

  const loadClientStatus = async () => {
    try {
      const data = await apiGet("/dashboard/clients-status");
      setClientStatus(data);
    } catch (err) {
      console.warn("No se pudo cargar estado de clientes:", err);
      setClientStatus(null);
    }
  };

  const loadResources = async () => {
    try {
      const data = await apiGet("/mikrotik/resources");
      setResources(data);
    } catch (err) {
      console.warn("No se pudo cargar recursos:", err);
      setResources(null);
    }
  };

  const loadActivePppoe = async () => {
    try {
      const data = await apiGet("/mikrotik/pppoe/active");
      setActivePppoe(Array.isArray(data) ? data : data?.items || data?.active || data?.data || []);
    } catch (err) {
      console.warn("No se pudo cargar PPPoE activos:", err);
      setActivePppoe([]);
    }
  };

  const loadTraffic = async () => {
    try {
      const data = await apiGet("/mikrotik/traffic");
      setTraffic(data);
    } catch (err) {
      console.warn("No se pudo cargar tráfico:", err);
      setTraffic(null);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);

      await Promise.all([
        loadCustomers(),
        loadInvoices(),
        loadCashbox(),
        loadClientStatus(),
        loadResources(),
        loadActivePppoe(),
        loadTraffic(),
      ]);

      setUpdatedAt(new Date().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }));
    } catch (err) {
      console.warn("Error cargando inicio:", err);
      alert("No se pudo cargar el inicio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="hsm-home-page">
      <section className="hsm-home-head">
        <div>
          <h2>{APP_NAME}</h2>
          <p>Resumen real del sistema</p>
          <small>Clientes · Facturas · Caja · MikroTik · Tráfico</small>
          <small>Versión {APP_VERSION} · {APP_BUILD}</small>
          {updatedAt && <small>Actualizado: {updatedAt}</small>}
        </div>

        <button onClick={loadAll} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar todo"}
        </button>
      </section>

      <section className="hsm-home-main-stats">
        <div>
          <strong>{stats.activeCustomers}</strong>
          <span>Clientes activos</span>
        </div>

        <div>
          <strong>{stats.suspendedCustomers}</strong>
          <span>Suspendidos</span>
        </div>

        <div>
          <strong>{stats.pppoeActive}</strong>
          <span>PPPoE online</span>
        </div>
      </section>

      <section className="hsm-home-card">
        <div className="hsm-home-card-title">
          <h3>Finanzas</h3>
          <span>Hoy / pendiente</span>
        </div>

        <div className="hsm-home-grid">
          <div>
            <small>Facturas pendientes</small>
            <strong>{stats.pendingInvoices}</strong>
          </div>

          <div>
            <small>A cobrar</small>
            <strong>{money(stats.pendingAmount)}</strong>
          </div>

          <div>
            <small>Caja diaria</small>
            <strong>{money(stats.cashboxTotal)}</strong>
          </div>

          <div>
            <small>Total clientes</small>
            <strong>{stats.customers}</strong>
          </div>
        </div>
      </section>

      <section className="hsm-home-card">
        <div className="hsm-home-card-title">
          <h3>Tráfico MikroTik</h3>
          <span>General</span>
        </div>

        <div className="hsm-home-traffic-bars">
          <div>
            <label>Descarga</label>
            <strong>{formatRate(stats.download)}</strong>
            <span>
              <i style={{ width: `${Math.min(Number(stats.download || 0) / 1000000 * 10, 100)}%` }} />
            </span>
          </div>

          <div>
            <label>Subida</label>
            <strong>{formatRate(stats.upload)}</strong>
            <span>
              <i style={{ width: `${Math.min(Number(stats.upload || 0) / 1000000 * 10, 100)}%` }} />
            </span>
          </div>
        </div>
      </section>

      <section className="hsm-home-card">
        <div className="hsm-home-card-title">
          <h3>Router / Recursos</h3>
          <span>{stats.version}</span>
        </div>

        <div className="hsm-home-grid">
          <div>
            <small>CPU</small>
            <strong>{stats.cpu}%</strong>
          </div>

          <div>
            <small>Online</small>
            <strong>{stats.online}</strong>
          </div>

          <div>
            <small>Uptime</small>
            <strong>{stats.uptime}</strong>
          </div>

          <div>
            <small>Memoria libre</small>
            <strong>{stats.memory ? `${Math.round(Number(stats.memory) / 1024 / 1024)} MB` : "-"}</strong>
          </div>
        </div>
      </section>

      <section className="hsm-home-card">
        <div className="hsm-home-card-title">
          <h3>Estado general</h3>
          <span>Backend + MikroTik</span>
        </div>

        <div className="hsm-home-health">
          <div>
            <span className="dot ok" />
            <strong>Backend sincronizado</strong>
          </div>

          <div>
            <span className={`dot ${stats.pppoeActive > 0 ? "ok" : "warn"}`} />
            <strong>{stats.pppoeActive > 0 ? "MikroTik con sesiones activas" : "Sin sesiones PPPoE activas"}</strong>
          </div>

          <div>
            <span className={`dot ${stats.suspendedCustomers > 0 ? "warn" : "ok"}`} />
            <strong>{stats.suspendedCustomers} clientes suspendidos</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
