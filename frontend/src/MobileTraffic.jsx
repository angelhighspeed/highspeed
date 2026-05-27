import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "./mobileApi";

function formatBytes(value) {
  const n = Number(value || 0);

  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;

  return `${n.toFixed(0)} B`;
}

function formatRate(value) {
  const n = Number(value || 0);

  if (n >= 1000 * 1000) return `${(n / 1000 / 1000).toFixed(2)} Mbps`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)} Kbps`;

  return `${n.toFixed(0)} bps`;
}

function getName(item) {
  return (
    item?.name ||
    item?.user ||
    item?.username ||
    item?.pppoe_username ||
    item?.customer_name ||
    item?.interface ||
    "Sin nombre"
  );
}

function getIp(item) {
  return item?.address || item?.ip || item?.remote_address || item?.caller_id || "";
}

function getDownload(item) {
  return (
    item?.download ||
    item?.rx_rate ||
    item?.rx ||
    item?.["rx-rate"] ||
    item?.download_rate ||
    item?.bytes_in ||
    0
  );
}

function getUpload(item) {
  return (
    item?.upload ||
    item?.tx_rate ||
    item?.tx ||
    item?.["tx-rate"] ||
    item?.upload_rate ||
    item?.bytes_out ||
    0
  );
}

export default function MobileTraffic() {
  const [traffic, setTraffic] = useState(null);
  const [clientTraffic, setClientTraffic] = useState([]);
  const [resources, setResources] = useState(null);
  const [activePppoe, setActivePppoe] = useState([]);
  const [query, setQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);

  const resource = useMemo(() => {
    if (Array.isArray(resources)) return resources[0] || {};
    if (Array.isArray(resources?.resources)) return resources.resources[0] || {};
    return resources || {};
  }, [resources]);

  const activeUsers = useMemo(() => {
    return Array.isArray(activePppoe) ? activePppoe : [];
  }, [activePppoe]);

  const visibleClientTraffic = useMemo(() => {
    const term = query.trim().toLowerCase();

    const items = Array.isArray(clientTraffic)
      ? clientTraffic
      : clientTraffic?.items || clientTraffic?.data || [];

    return items.filter((item) => {
      if (!term) return true;

      const text = [
        getName(item),
        getIp(item),
        item?.interface,
        item?.router,
        item?.comment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [clientTraffic, query]);

  const stats = useMemo(() => {
    const totalDownload =
      traffic?.download ||
      traffic?.rx_rate ||
      traffic?.rx ||
      traffic?.["rx-rate"] ||
      traffic?.total_download ||
      visibleClientTraffic.reduce((acc, item) => acc + Number(getDownload(item) || 0), 0);

    const totalUpload =
      traffic?.upload ||
      traffic?.tx_rate ||
      traffic?.tx ||
      traffic?.["tx-rate"] ||
      traffic?.total_upload ||
      visibleClientTraffic.reduce((acc, item) => acc + Number(getUpload(item) || 0), 0);

    return {
      download: totalDownload,
      upload: totalUpload,
      active: activeUsers.length,
      cpu: resource?.["cpu-load"] ?? resource?.cpu_load ?? resource?.cpu ?? "-",
      uptime: resource?.uptime || "-",
      version: resource?.version || "-",
      freeMemory: resource?.["free-memory"] || resource?.free_memory || "",
    };
  }, [traffic, visibleClientTraffic, activeUsers, resource]);

  const loadTraffic = async () => {
    try {
      const data = await apiGet("/mikrotik/traffic");
      setTraffic(data);
    } catch (err) {
      console.warn("No se pudo cargar tráfico general:", err);
      setTraffic(null);
    }
  };

  const loadClientTraffic = async () => {
    try {
      const data = await apiGet("/mikrotik/pppoe/client-traffic");
      const items = Array.isArray(data) ? data : data?.items || data?.data || data?.clients || [];
      setClientTraffic(items);
    } catch (err) {
      console.warn("No se pudo cargar tráfico por cliente:", err);
      setClientTraffic([]);
    }
  };

  const loadResources = async () => {
    try {
      const data = await apiGet("/mikrotik/resources");
      setResources(data);
    } catch (err) {
      console.warn("No se pudo cargar recursos MikroTik:", err);
      setResources(null);
    }
  };

  const loadActivePppoe = async () => {
    try {
      const data = await apiGet("/mikrotik/pppoe/active");
      const items = Array.isArray(data) ? data : data?.items || data?.active || data?.data || [];
      setActivePppoe(items);
    } catch (err) {
      console.warn("No se pudo cargar PPPoE activos:", err);
      setActivePppoe([]);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTraffic(),
        loadClientTraffic(),
        loadResources(),
        loadActivePppoe(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      loadAll();
    }, 10000);

    return () => clearInterval(timer);
  }, [autoRefresh]);

  return (
    <div className="hsm-traffic-page">
      <section className="hsm-traffic-head">
        <div>
          <h2>Tráfico MikroTik</h2>
          <p>Monitor en tiempo real</p>
        </div>

        <div className="hsm-traffic-head-actions">
          <button onClick={loadAll}>Actualizar</button>
          <button
            className={autoRefresh ? "active" : ""}
            onClick={() => setAutoRefresh((prev) => !prev)}
          >
            Auto {autoRefresh ? "ON" : "OFF"}
          </button>
        </div>
      </section>

      <section className="hsm-traffic-stats">
        <div>
          <strong>{formatRate(stats.download)}</strong>
          <span>Descarga</span>
        </div>

        <div>
          <strong>{formatRate(stats.upload)}</strong>
          <span>Subida</span>
        </div>

        <div>
          <strong>{stats.active}</strong>
          <span>PPPoE activos</span>
        </div>
      </section>

      <section className="hsm-traffic-card">
        <h3>Recursos MikroTik</h3>

        <div className="hsm-traffic-grid">
          <div>
            <small>CPU</small>
            <strong>{stats.cpu}%</strong>
          </div>

          <div>
            <small>Memoria libre</small>
            <strong>{stats.freeMemory ? formatBytes(stats.freeMemory) : "-"}</strong>
          </div>

          <div>
            <small>Uptime</small>
            <strong>{stats.uptime}</strong>
          </div>

          <div>
            <small>Versión</small>
            <strong>{stats.version}</strong>
          </div>
        </div>
      </section>

      <section className="hsm-traffic-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente PPPoE, IP o interfaz..."
        />
      </section>

      {loading && (
        <section className="hsm-traffic-empty">
          <p>Cargando tráfico...</p>
        </section>
      )}

      {!loading && visibleClientTraffic.length === 0 && (
        <section className="hsm-traffic-empty">
          <p>No hay tráfico de clientes para mostrar.</p>
        </section>
      )}

      <section className="hsm-traffic-list">
        {visibleClientTraffic.map((item, index) => (
          <article key={item.id || item.name || index} className="hsm-traffic-card">
            <div className="hsm-traffic-card-head">
              <div>
                <h3>{getName(item)}</h3>
                <span className="hsm-status active">Online</span>
              </div>

              <div className="hsm-traffic-icon">📈</div>
            </div>

            <div className="hsm-traffic-grid">
              <div>
                <small>IP</small>
                <strong>{getIp(item) || "-"}</strong>
              </div>

              <div>
                <small>Interfaz</small>
                <strong>{item.interface || item["interface"] || "-"}</strong>
              </div>

              <div>
                <small>Descarga</small>
                <strong>{formatRate(getDownload(item))}</strong>
              </div>

              <div>
                <small>Subida</small>
                <strong>{formatRate(getUpload(item))}</strong>
              </div>

              <div>
                <small>Bytes IN</small>
                <strong>{formatBytes(item.bytes_in || item["bytes-in"] || item.rx_bytes || 0)}</strong>
              </div>

              <div>
                <small>Bytes OUT</small>
                <strong>{formatBytes(item.bytes_out || item["bytes-out"] || item.tx_bytes || 0)}</strong>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
