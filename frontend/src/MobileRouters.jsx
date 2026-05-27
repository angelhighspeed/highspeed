import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, normalizeStatus } from "./mobileApi";

const emptyForm = {
  id: "",
  name: "",
  host: "",
  username: "",
  password: "",
  api_port: "8728",
  www_port: "80",
  lan_interface: "",
  ip_ranges: "",
  zone: "General",
  cut_type: "pppoe",
};

function getId(router) {
  return router?.id || router?.router_id;
}

function getName(router) {
  return router?.name || router?.nombre || router?.router_name || `Router #${getId(router) || ""}`;
}

function getHost(router) {
  return router?.host || router?.ip || router?.ip_address || router?.address || "";
}

function getRouterStatus(router) {
  const raw = normalizeStatus(
    router?.connection_status ||
      router?.mikrotik_status ||
      router?.status ||
      (router?.active === true ? "active" : "")
  );

  if (raw === "active") return "Activo";
  if (raw === "online") return "Activo";
  if (raw === "ok") return "Activo";
  if (raw === "suspended") return "Error";
  if (raw === "error" || raw === "offline") return "Error";

  return "Sin comprobar";
}

function statusClass(router) {
  const label = getRouterStatus(router).toLowerCase();

  if (label.includes("activo")) return "active";
  if (label.includes("error")) return "suspended";

  return "pending";
}

function parseRanges(router) {
  const raw =
    router?.ip_ranges ||
    router?.ranges ||
    router?.rangos_ip ||
    router?.ip_pool ||
    "";

  return String(raw)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getResource(router, key) {
  const resource = Array.isArray(router?.resources) ? router.resources[0] || {} : {};
  return router?.[key] ?? resource?.[key] ?? "";
}

export default function MobileRouters() {
  const [routers, setRouters] = useState([]);
  const [availableIpsByRouter, setAvailableIpsByRouter] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [testingId, setTestingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleRouters = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (routers || []).filter((router) => {
      if (!term) return true;

      const text = [
        getName(router),
        getHost(router),
        router.username,
        router.zone,
        router.zona,
        router.lan_interface,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [routers, query]);

  const stats = useMemo(() => {
    return {
      total: routers.length,
      active: routers.filter((router) => getRouterStatus(router) === "Activo").length,
      error: routers.filter((router) => getRouterStatus(router) === "Error").length,
      unchecked: routers.filter((router) => getRouterStatus(router) === "Sin comprobar").length,
    };
  }, [routers]);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(false);
  };

  const openNewRouter = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(true);
  };

  const openEditRouter = (router) => {
    setForm({
      id: getId(router),
      name: getName(router),
      host: getHost(router),
      username: router.username || "",
      password: router.password || "",
      api_port: String(router.api_port || 8728),
      www_port: String(router.www_port || 80),
      lan_interface: router.lan_interface || "",
      ip_ranges: router.ip_ranges || "",
      zone: router.zone || router.zona || "General",
      cut_type: router.cut_type || "pppoe",
    });

    setEditing(true);
    setShowForm(true);
  };

  const buildPayload = () => ({
    name: form.name,
    nombre: form.name,
    host: form.host,
    ip: form.host,
    username: form.username,
    password: form.password,
    api_port: Number(form.api_port || 8728),
    www_port: Number(form.www_port || 80),
    lan_interface: form.lan_interface,
    ip_ranges: form.ip_ranges,
    zone: form.zone,
    zona: form.zone,
    cut_type: form.cut_type || "pppoe",
    add_client_mikrotik: true,
    traffic_history: true,
    simple_queue_control: true,
    pppoe_control: true,
  });

  const loadRouters = async () => {
    try {
      setLoading(true);

      const data = await apiGet("/routers");
      const items = Array.isArray(data) ? data : data?.items || data?.routers || [];

      setRouters(items);
    } catch (err) {
      console.warn("Error cargando routers:", err);
      setRouters([]);
      alert("No se pudieron cargar los routers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRouters();
  }, []);

  const saveRouter = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Ingresá el nombre del router.");
      return;
    }

    if (!form.host.trim()) {
      alert("Ingresá la IP/host del router.");
      return;
    }

    if (!form.username.trim()) {
      alert("Ingresá el usuario del router.");
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (editing && form.id) {
        await apiPut(`/routers/${form.id}`, payload);
        alert("Router actualizado.");
      } else {
        await apiPost("/routers", payload);
        alert("Router creado.");
      }

      resetForm();
      await loadRouters();
    } catch (err) {
      console.warn("Error guardando router:", err);
      alert(
        "No se pudo guardar el router. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const testRouter = async (router) => {
    const id = getId(router);

    if (!id) {
      alert("Router sin ID.");
      return;
    }

    try {
      setTestingId(id);

      const data = await apiPost(`/routers/${id}/test`, {});
      const resource = Array.isArray(data?.resources) ? data.resources[0] || {} : {};

      setRouters((prev) =>
        prev.map((item) =>
          String(getId(item)) === String(id)
            ? {
                ...item,
                status: data.status || "online",
                connection_status: data.status || "online",
                mikrotik_status: data.status || "online",
                active: data.status === "online" || data.status === "ok",
                resources: data.resources || [],
                uptime: resource.uptime || item.uptime || "",
                version: resource.version || item.version || "",
                cpu_load: resource["cpu-load"] ?? item.cpu_load ?? "",
                free_memory: resource["free-memory"] ?? item.free_memory ?? "",
                error_message: "",
              }
            : item
        )
      );

      alert(`Router ${getName(router)} conectado correctamente.`);
    } catch (err) {
      console.warn("Error probando router:", err);

      setRouters((prev) =>
        prev.map((item) =>
          String(getId(item)) === String(id)
            ? {
                ...item,
                status: "error",
                connection_status: "error",
                mikrotik_status: "error",
                active: false,
                error_message:
                  err?.response?.data?.detail || err?.message || "Error de conexión",
              }
            : item
        )
      );

      alert(
        "No se pudo conectar al router. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setTestingId(null);
    }
  };

  const loadAvailableIps = async (router) => {
    const id = getId(router);

    if (!id) {
      alert("Router sin ID.");
      return;
    }

    try {
      const data = await apiGet(`/routers/${id}/available-ips`);
      const ips =
        data?.available_ips ||
        data?.ips ||
        data?.items ||
        data?.data ||
        [];

      setAvailableIpsByRouter((prev) => ({
        ...prev,
        [id]: Array.isArray(ips) ? ips.map((item) => String(item)) : [],
      }));
    } catch (err) {
      console.warn("Error cargando IPs disponibles:", err);
      alert(
        "No se pudieron cargar las IPs disponibles. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    }
  };

  const getNextIp = async (router) => {
    const id = getId(router);

    if (!id) {
      alert("Router sin ID.");
      return;
    }

    try {
      const data = await apiGet(`/routers/${id}/next-free-ip`);
      const ip = data?.ip || data?.next_ip || data?.next_free_ip || data?.remote_address;

      if (ip) {
        alert(`Próxima IP disponible: ${ip}`);
      } else {
        alert("No se encontró próxima IP disponible.");
      }
    } catch (err) {
      console.warn("Error obteniendo próxima IP:", err);
      alert(
        "No se pudo obtener próxima IP. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    }
  };

  const deleteRouter = async (router) => {
    const id = getId(router);

    if (!id) {
      alert("Router sin ID.");
      return;
    }

    if (!confirm(`¿Eliminar router ${getName(router)}?`)) return;

    try {
      setSaving(true);
      await apiDelete(`/routers/${id}`);
      await loadRouters();
      alert("Router eliminado.");
    } catch (err) {
      console.warn("Error eliminando router:", err);
      alert(
        "No se pudo eliminar el router. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hsm-routers-page">
      <section className="hsm-routers-head">
        <div>
          <h2>Enrutadores</h2>
          <p>{stats.total} routers registrados</p>
        </div>

        <div className="hsm-router-actions-top">
          <button onClick={openNewRouter}>+ Router</button>
          <button onClick={loadRouters}>Actualizar</button>
        </div>
      </section>

      <section className="hsm-router-stats">
        <div>
          <strong>{stats.active}</strong>
          <span>Activos</span>
        </div>

        <div>
          <strong>{stats.error}</strong>
          <span>Error</span>
        </div>

        <div>
          <strong>{stats.unchecked}</strong>
          <span>Sin comprobar</span>
        </div>
      </section>

      <section className="hsm-router-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar router por nombre, IP o zona..."
        />
      </section>

      {showForm && (
        <section className="hsm-router-card">
          <div className="hsm-router-form-title">
            <h3>{editing ? "Editar router" : "Nuevo router"}</h3>
            <button type="button" onClick={resetForm}>×</button>
          </div>

          <form onSubmit={saveRouter} className="hsm-router-form">
            <input
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Nombre del router"
            />

            <input
              value={form.host}
              onChange={(e) => updateForm("host", e.target.value)}
              placeholder="IP / Host MikroTik"
            />

            <input
              value={form.username}
              onChange={(e) => updateForm("username", e.target.value)}
              placeholder="Usuario"
            />

            <input
              value={form.password}
              onChange={(e) => updateForm("password", e.target.value)}
              placeholder="Contraseña"
            />

            <input
              value={form.api_port}
              onChange={(e) => updateForm("api_port", e.target.value)}
              placeholder="Puerto API"
            />

            <input
              value={form.www_port}
              onChange={(e) => updateForm("www_port", e.target.value)}
              placeholder="Puerto Web"
            />

            <input
              value={form.lan_interface}
              onChange={(e) => updateForm("lan_interface", e.target.value)}
              placeholder="Interfaz LAN / Bridge"
            />

            <textarea
              value={form.ip_ranges}
              onChange={(e) => updateForm("ip_ranges", e.target.value)}
              placeholder={"Rangos IP, uno por línea\n192.168.177.0/24"}
            />

            <input
              value={form.zone}
              onChange={(e) => updateForm("zone", e.target.value)}
              placeholder="Zona"
            />

            <select
              value={form.cut_type}
              onChange={(e) => updateForm("cut_type", e.target.value)}
            >
              <option value="pppoe">PPPoE</option>
              <option value="simple_queue">Simple Queue</option>
              <option value="hotspot">Hotspot</option>
            </select>

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear router"}
            </button>
          </form>
        </section>
      )}

      {loading && (
        <section className="hsm-router-empty">
          <p>Cargando routers...</p>
        </section>
      )}

      {!loading && visibleRouters.length === 0 && (
        <section className="hsm-router-empty">
          <p>No hay routers para mostrar.</p>
        </section>
      )}

      <section className="hsm-router-list">
        {visibleRouters.map((router) => {
          const id = getId(router);
          const ranges = parseRanges(router);
          const availableIps = availableIpsByRouter[id] || [];

          return (
            <article key={id} className="hsm-router-card">
              <div className="hsm-router-card-head">
                <div>
                  <h3>{getName(router)}</h3>
                  <span className={`hsm-status ${statusClass(router)}`}>
                    {getRouterStatus(router)}
                  </span>
                </div>

                <div className="hsm-router-icon">📡</div>
              </div>

              <div className="hsm-router-grid">
                <div>
                  <small>Host</small>
                  <strong>{getHost(router) || "-"}</strong>
                </div>

                <div>
                  <small>API</small>
                  <strong>{router.api_port || 8728}</strong>
                </div>

                <div>
                  <small>Usuario</small>
                  <strong>{router.username || "-"}</strong>
                </div>

                <div>
                  <small>Zona</small>
                  <strong>{router.zone || router.zona || "-"}</strong>
                </div>

                <div>
                  <small>Versión</small>
                  <strong>{router.version || getResource(router, "version") || "-"}</strong>
                </div>

                <div>
                  <small>Uptime</small>
                  <strong>{router.uptime || getResource(router, "uptime") || "-"}</strong>
                </div>

                <div>
                  <small>CPU</small>
                  <strong>{router.cpu_load || getResource(router, "cpu-load") || "-"}</strong>
                </div>

                <div>
                  <small>Rangos</small>
                  <strong>{ranges.length}</strong>
                </div>
              </div>

              {router.error_message && (
                <p className="hsm-router-error">{router.error_message}</p>
              )}

              {ranges.length > 0 && (
                <div className="hsm-router-ranges">
                  <small>Rangos IP</small>
                  {ranges.slice(0, 6).map((range) => (
                    <span key={range}>{range}</span>
                  ))}
                </div>
              )}

              {availableIps.length > 0 && (
                <div className="hsm-router-ranges">
                  <small>IPs disponibles</small>
                  {availableIps.slice(0, 12).map((ip) => (
                    <span key={ip}>{ip}</span>
                  ))}
                </div>
              )}

              <div className="hsm-router-actions">
                <button disabled={testingId === id} onClick={() => testRouter(router)}>
                  {testingId === id ? "Probando..." : "Probar"}
                </button>

                <button onClick={() => loadAvailableIps(router)}>
                  Ver IPs
                </button>

                <button onClick={() => getNextIp(router)}>
                  Próxima IP
                </button>

                <button onClick={() => openEditRouter(router)}>
                  Editar
                </button>

                <button className="danger" onClick={() => deleteRouter(router)}>
                  Eliminar
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
