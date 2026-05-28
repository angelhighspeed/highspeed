import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, normalizeStatus } from "./mobileApi";

const emptyForm = {
  id: "",
  full_name: "",
  phone: "",
  address: "",
  city: "",
  zone: "",
  router_id: "",
  plan_id: "",
  pppoe_username: "",
  pppoe_password: "",
  remote_address: "",
  status: "active",
};

function getId(client) {
  return client?.id || client?.customer_id;
}

function getName(client) {
  return (
    client?.full_name ||
    client?.name ||
    client?.nombre ||
    client?.customer_name ||
    "Sin nombre"
  );
}

function getPhone(client) {
  return client?.phone || client?.telefono || client?.customer_phone || "";
}

function getAddress(client) {
  return client?.address || client?.direccion || "";
}

function getIp(client) {
  return (
    client?.remote_address ||
    client?.customer_ip ||
    client?.ip ||
    client?.ip_address ||
    client?.pppoe_ip ||
    ""
  );
}

function getPppoeUser(client) {
  return (
    client?.pppoe_username ||
    client?.pppoe_user ||
    client?.username ||
    client?.customer_pppoe_username ||
    ""
  );
}

function getStatus(client) {
  return normalizeStatus(client?.status || client?.estado || client?.customer_status);
}

function isVisibleClient(client) {
  const status = getStatus(client);
  return status !== "deleted" && status !== "pending";
}

function statusLabel(status) {
  if (status === "active") return "Activo";
  if (status === "suspended") return "Suspendido";
  if (status === "pending") return "Pendiente";
  return "Sin estado";
}

export default function MobileClients() {
  const [clients, setClients] = useState([]);
  const [routers, setRouters] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleClients = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (clients || [])
      .filter(isVisibleClient)
      .filter((client) => {
        const status = getStatus(client);

        if (filter === "active" && status !== "active") return false;
        if (filter === "suspended" && status !== "suspended") return false;

        if (!term) return true;

        const text = [
          getName(client),
          getPhone(client),
          getAddress(client),
          getIp(client),
          getPppoeUser(client),
          client.zone,
          client.zona,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(term);
      });
  }, [clients, filter, query]);

  const stats = useMemo(() => {
    const base = (clients || []).filter(isVisibleClient);

    return {
      total: base.length,
      active: base.filter((client) => getStatus(client) === "active").length,
      suspended: base.filter((client) => getStatus(client) === "suspended").length,
      other: base.filter((client) => !["active", "suspended"].includes(getStatus(client))).length,
    };
  }, [clients]);

  
const loadPlans = async () => {
    try {
      const data = await apiGet("/plans");
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.plans)
        ? data.plans
        : Array.isArray(data?.items)
        ? data.items
        : [];

      setPlans(list);
    } catch (err) {
      console.warn("No se pudieron cargar planes:", err);
      setPlans([]);
    }
  };

  const getPlanName = (client) => {
    const planId =
      client?.plan_id ??
      client?.internet_plan_id ??
      client?.planId ??
      client?.internetPlanId;

    const direct =
      client?.plan_name ||
      client?.planName ||
      client?.internet_plan ||
      client?.internetPlan ||
      client?.plan ||
      "";

    if (direct && !/^Plan\s*\d+$/i.test(String(direct).trim())) {
      return direct;
    }

    const found = plans.find((p) => String(p.id) === String(planId));

    if (!found) {
      return planId ? `Plan ${planId}` : "-";
    }

    const name = found.name || found.nombre || `Plan ${planId}`;
    const speed = found.speed || found.download_speed || "";

    return speed ? `${name} - ${speed}` : name;
  };

  const loadClients = async () => {
    try {
      setLoading(true);

      let data;

      try {
        data = await apiGet("/customers");
      } catch {
        data = await apiGet("/customers/list-all");
      }

      const items = Array.isArray(data)
        ? data
        : data?.items || data?.customers || data?.data || [];

      setClients(items);
    } catch (err) {
      console.warn("Error cargando clientes:", err);
      setClients([]);
      alert("No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  };

  const loadRouters = async () => {
    try {
      const data = await apiGet("/routers");
      setRouters(Array.isArray(data) ? data : data?.items || []);
    } catch {
      setRouters([]);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadClients(), loadRouters(), loadPlans()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

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

  const openNewClient = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(true);
  };

  const openEditClient = (client) => {
    setForm({
      id: getId(client),
      full_name: getName(client),
      phone: getPhone(client),
      address: getAddress(client),
      city: client.city || client.localidad || "",
      zone: client.zone || client.zona || client.customer_zone || "",
      router_id: client.router_id || "",
      plan_id: client.plan_id || "",
      pppoe_username: getPppoeUser(client),
      pppoe_password: client.pppoe_password || client.password || "",
      remote_address: getIp(client),
      status: getStatus(client) || "active",
    });

    setEditing(true);
    setShowForm(true);
  };

  const validateForm = () => {
    if (!form.full_name.trim()) return "Ingresá el nombre del cliente.";
    if (!form.address.trim()) return "Ingresá la dirección.";
    if (!form.pppoe_username.trim()) return "Ingresá usuario PPPoE.";
    if (!form.remote_address.trim()) return "Ingresá IP del cliente.";

    return "";
  };

  const buildPayload = () => ({
    full_name: form.full_name,
    name: form.full_name,
    nombre: form.full_name,

    phone: form.phone,
    telefono: form.phone,

    address: form.address,
    direccion: form.address,

    city: form.city,
    localidad: form.city,

    zone: form.zone,
    zona: form.zone,

    router_id: form.router_id ? Number(form.router_id) : null,
    plan_id: form.plan_id ? Number(form.plan_id) : null,

    pppoe_username: form.pppoe_username,
    pppoe_user: form.pppoe_username,
    username: form.pppoe_username,

    pppoe_password: form.pppoe_password,
    password: form.pppoe_password,

    remote_address: form.remote_address,
    ip: form.remote_address,
    ip_address: form.remote_address,
    customer_ip: form.remote_address,
    pppoe_ip: form.remote_address,

    status: form.status || "active",
    estado: form.status || "active",
  });

  const saveClient = async (event) => {
    event.preventDefault();

    const validation = validateForm();

    if (validation) {
      alert(validation);
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (editing && form.id) {
        await apiPut(`/customers/${form.id}`, payload);
        alert("Cliente actualizado.");
      } else {
        await apiPost("/customers", payload);
        alert("Cliente creado.");
      }

      resetForm();
      await loadPlans();
    loadClients();
    } catch (err) {
      console.warn("Error guardando cliente:", err);
      alert(
        "No se pudo guardar el cliente. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const activateClient = async (client) => {
    
    if (!window.confirm(`¿Seguro que querés ACTIVAR a ${getName(client)}?`)) return;
const id = getId(client);

    if (!id) {
      alert("Cliente sin ID.");
      return;
    }

    try {
      setSaving(true);
      const data = await apiPut(`/customers/${id}/activate`, {});
      await loadClients();

      const mikrotik = data?.mikrotik || data?.router || {};

      if (mikrotik?.status === "error") {
        alert("Cliente activado, pero MikroTik respondió error: " + JSON.stringify(mikrotik));
      } else {
        alert("Cliente activado.");
      }
    } catch (err) {
      console.warn("Error activando cliente:", err);
      alert(
        "No se pudo activar el cliente. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const suspendClient = async (client) => {
    const id = getId(client);

    if (!id) {
      alert("Cliente sin ID.");
      return;
    }

    if (!confirm(`¿Suspender a ${getName(client)}?`)) return;

    try {
      setSaving(true);
      await apiPut(`/customers/${id}/suspend`, {});
      await loadClients();
      alert("Cliente suspendido.");
    } catch (err) {
      console.warn("Error suspendiendo cliente:", err);
      alert(
        "No se pudo suspender el cliente. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (client) => {
    const id = getId(client);

    if (!id) {
      alert("Cliente sin ID.");
      return;
    }

    if (!confirm(`¿Eliminar a ${getName(client)}?`)) return;

    try {
      setSaving(true);
      await apiDelete(`/customers/${id}`);
      await loadClients();
      alert("Cliente eliminado.");
    } catch (err) {
      console.warn("Error eliminando cliente:", err);
      alert(
        "No se pudo eliminar el cliente. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hsm-clients-page">
      <section className="hsm-clients-head">
        <div>
          <h2>Clientes</h2>
          <p>{stats.total} clientes registrados</p>
        </div>

        <div className="hsm-client-actions-top">
          <button onClick={openNewClient}>+ Cliente</button>
          <button onClick={loadAll}>Actualizar</button>
        </div>
      </section>

      <section className="hsm-client-stats">
        <div>
          <strong>{stats.active}</strong>
          <span>Activos</span>
        </div>

        <div>
          <strong>{stats.suspended}</strong>
          <span>Suspendidos</span>
        </div>

        <div>
          <strong>{stats.other}</strong>
          <span>Otros</span>
        </div>
      </section>

      <section className="hsm-client-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente, teléfono, PPPoE o IP..."
        />

        <div className="hsm-client-filter">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todos
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
        </div>
      </section>

      {showForm && (
        <section className="hsm-client-card">
          <div className="hsm-client-form-title">
            <h3>{editing ? "Editar cliente" : "Nuevo cliente"}</h3>
            <button type="button" onClick={resetForm}>×</button>
          </div>

          <form onSubmit={saveClient} className="hsm-client-form">
            <input
              value={form.full_name}
              onChange={(e) => updateForm("full_name", e.target.value)}
              placeholder="Nombre completo"
            />

            <input
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              placeholder="Teléfono"
            />

            <input
              value={form.address}
              onChange={(e) => updateForm("address", e.target.value)}
              placeholder="Dirección"
            />

            <input
              value={form.city}
              onChange={(e) => updateForm("city", e.target.value)}
              placeholder="Localidad"
            />

            <input
              value={form.zone}
              onChange={(e) => updateForm("zone", e.target.value)}
              placeholder="Zona / Barrio"
            />

            <select
              value={form.router_id}
              onChange={(e) => updateForm("router_id", e.target.value)}
            >
              <option value="">Seleccionar router</option>
              {routers.map((router) => (
                <option key={router.id} value={router.id}>
                  {router.name || router.nombre || `Router #${router.id}`}
                </option>
              ))}
            </select>

            <select
              value={form.plan_id}
              onChange={(e) => updateForm("plan_id", e.target.value)}
            >
              <option value="">Seleccionar plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name || plan.nombre || plan.plan_name || `Plan #${plan.id}`}
                </option>
              ))}
            </select>

            <input
              value={form.pppoe_username}
              onChange={(e) => updateForm("pppoe_username", e.target.value)}
              placeholder="Usuario PPPoE"
            />

            <input
              value={form.pppoe_password}
              onChange={(e) => updateForm("pppoe_password", e.target.value)}
              placeholder="Contraseña PPPoE"
            />

            <input
              value={form.remote_address}
              onChange={(e) => updateForm("remote_address", e.target.value)}
              placeholder="IP del cliente"
            />

            <select
              value={form.status}
              onChange={(e) => updateForm("status", e.target.value)}
            >
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
            </select>

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cliente"}
            </button>
          </form>
        </section>
      )}

      {loading && (
        <section className="hsm-client-empty">
          <p>Cargando clientes...</p>
        </section>
      )}

      {!loading && visibleClients.length === 0 && (
        <section className="hsm-client-empty">
          <p>No hay clientes para mostrar.</p>
        </section>
      )}

      <section className="hsm-client-list">
        {visibleClients.map((client) => {
          const status = getStatus(client);
          const id = getId(client);

          return (
            <article key={id} className="hsm-client-card">
              <div className="hsm-client-card-head">
                <div>
                  <h3>{getName(client)}</h3>
                  <span className={`hsm-status ${status}`}>
                    {statusLabel(status)}
                  </span>
                </div>

                <div className="hsm-client-avatar">👤</div>
              </div>

              <div className="hsm-client-grid">
                <div>
                  <small>Teléfono</small>
                  <strong>{getPhone(client) || "-"}</strong>
                </div>

                <div>
                  <small>Dirección</small>
                  <strong>{getAddress(client) || "-"}</strong>
                </div>

                <div>
                  <small>Usuario PPPoE</small>
                  <strong>{getPppoeUser(client) || "-"}</strong>
                </div>

                <div>
                  <small>IP</small>
                  <strong>{getIp(client) || "-"}</strong>
                </div>

                <div>
                  <small>Router</small>
                  <strong>{client.router_id || "-"}</strong>
                </div>

                <div>
                  <small>Plan</small>
                  <strong>{getPlanName(client)}</strong>
                </div>
              </div>

              <div className="hsm-client-actions">
                <button disabled={saving} onClick={() => openEditClient(client)}>
                  Editar
                </button>

                {status !== "active" && (
                  <button disabled={saving} onClick={() => activateClient(client)}>
                    Activar
                  </button>
                )}

                {status !== "suspended" && (
                  <button disabled={saving} onClick={() => suspendClient(client)}>
                    Suspender
                  </button>
                )}

                <button disabled={saving} className="danger" onClick={() => deleteClient(client)}>
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
