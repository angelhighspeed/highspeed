import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "./mobileApi";

const emptyForm = {
  id: "",
  customer_id: "",
  customer_name: "",
  title: "",
  description: "",
  priority: "medium",
  category: "",
  assigned_technician: "",
  status: "open",
};

function getId(ticket) {
  return ticket?.id || ticket?.ticket_id;
}

function getCustomerName(ticket) {
  return (
    ticket?.customer_name ||
    ticket?.client_name ||
    ticket?.full_name ||
    ticket?.name ||
    ticket?.nombre ||
    "Sin cliente"
  );
}

function getTitle(ticket) {
  return ticket?.title || ticket?.titulo || ticket?.subject || "Sin título";
}

function getStatus(ticket) {
  const raw = String(ticket?.status || ticket?.estado || "").toLowerCase().trim();

  if (["open", "abierto", "nuevo"].includes(raw)) return "open";
  if (["in_progress", "proceso", "en proceso", "started"].includes(raw)) return "in_progress";
  if (["closed", "cerrado", "resuelto"].includes(raw)) return "closed";

  return raw || "open";
}

function getPriority(ticket) {
  const raw = String(ticket?.priority || ticket?.prioridad || "").toLowerCase().trim();

  if (["high", "alta", "urgent", "urgente"].includes(raw)) return "high";
  if (["low", "baja"].includes(raw)) return "low";

  return "medium";
}

function statusLabel(status) {
  if (status === "open") return "Abierto";
  if (status === "in_progress") return "En proceso";
  if (status === "closed") return "Cerrado";
  return "Sin estado";
}

function priorityLabel(priority) {
  if (priority === "high") return "Alta";
  if (priority === "low") return "Baja";
  return "Media";
}

export default function MobileTickets() {
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleTickets = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (tickets || []).filter((ticket) => {
      const status = getStatus(ticket);
      const priority = getPriority(ticket);

      if (filter === "open" && status !== "open" && status !== "in_progress") return false;
      if (filter === "closed" && status !== "closed") return false;
      if (filter === "in_progress" && status !== "in_progress") return false;

      if (priorityFilter !== "all" && priority !== priorityFilter) return false;

      if (!term) return true;

      const text = [
        getCustomerName(ticket),
        getTitle(ticket),
        ticket.description,
        ticket.descripcion,
        ticket.category,
        ticket.categoria,
        ticket.assigned_technician,
        ticket.technician,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [tickets, query, filter, priorityFilter]);

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((ticket) => getStatus(ticket) === "open").length,
      progress: tickets.filter((ticket) => getStatus(ticket) === "in_progress").length,
      closed: tickets.filter((ticket) => getStatus(ticket) === "closed").length,
      high: tickets.filter((ticket) => getPriority(ticket) === "high").length,
    };
  }, [tickets]);

  const loadTickets = async () => {
    const data = await apiGet("/tickets");
    const items = Array.isArray(data) ? data : data?.items || data?.tickets || data?.data || [];
    setTickets(items);
  };

  const loadCustomers = async () => {
    try {
      let data;

      try {
        data = await apiGet("/customers/list-all");
      } catch {
        data = await apiGet("/customers");
      }

      const items = Array.isArray(data) ? data : data?.items || data?.customers || data?.data || [];
      setCustomers(
        items.filter((customer) => {
          const status = String(customer.status || customer.estado || "").toLowerCase();
          return status !== "deleted" && status !== "eliminado";
        })
      );
    } catch (err) {
      console.warn("No se pudieron cargar clientes:", err);
      setCustomers([]);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([loadTickets(), loadCustomers()]);
    } catch (err) {
      console.warn("Error cargando tickets:", err);
      alert("No se pudieron cargar los tickets.");
    } finally {
      setLoading(false);
    }
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

  const openNewTicket = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(true);
  };

  const openEditTicket = (ticket) => {
    setForm({
      id: getId(ticket),
      customer_id: ticket.customer_id || ticket.client_id || "",
      customer_name: getCustomerName(ticket),
      title: getTitle(ticket),
      description: ticket.description || ticket.descripcion || "",
      priority: getPriority(ticket),
      category: ticket.category || ticket.categoria || "",
      assigned_technician: ticket.assigned_technician || ticket.technician || "",
      status: getStatus(ticket),
    });

    setEditing(true);
    setShowForm(true);
  };

  const selectCustomer = (customerId) => {
    const customer = customers.find(
      (item) => String(item.id || item.customer_id) === String(customerId)
    );

    setForm((prev) => ({
      ...prev,
      customer_id: customerId,
      customer_name:
        customer?.full_name ||
        customer?.name ||
        customer?.nombre ||
        customer?.customer_name ||
        "",
    }));
  };

  const validateForm = () => {
    if (!form.title.trim()) return "Ingresá el título del ticket.";
    if (!form.description.trim()) return "Ingresá la descripción.";
    return "";
  };

  const buildPayload = () => ({
    customer_id: form.customer_id ? Number(form.customer_id) : null,
    client_id: form.customer_id ? Number(form.customer_id) : null,

    customer_name: form.customer_name,
    client_name: form.customer_name,

    title: form.title,
    titulo: form.title,
    subject: form.title,

    description: form.description,
    descripcion: form.description,

    priority: form.priority,
    prioridad: form.priority,

    category: form.category,
    categoria: form.category,

    assigned_technician: form.assigned_technician,
    technician: form.assigned_technician,

    status: form.status || "open",
    estado: form.status || "open",
  });

  const saveTicket = async (event) => {
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
        await apiPut(`/tickets/${form.id}`, payload);
        alert("Ticket actualizado.");
      } else {
        await apiPost("/tickets", payload);
        alert("Ticket creado.");
      }

      resetForm();
      await loadTickets();
      setFilter("open");
    } catch (err) {
      console.warn("Error guardando ticket:", err);
      alert(
        "No se pudo guardar el ticket. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const startTicket = async (ticket) => {
    const id = getId(ticket);

    if (!id) {
      alert("Ticket sin ID.");
      return;
    }

    try {
      setSaving(true);
      await apiPut(`/tickets/${id}/start`, {});
      await loadTickets();
      alert("Ticket iniciado.");
    } catch (err) {
      console.warn("Error iniciando ticket:", err);
      alert(
        "No se pudo iniciar el ticket. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const closeTicket = async (ticket) => {
    const id = getId(ticket);

    if (!id) {
      alert("Ticket sin ID.");
      return;
    }

    if (!confirm(`¿Cerrar ticket "${getTitle(ticket)}"?`)) return;

    try {
      setSaving(true);
      await apiPut(`/tickets/${id}/close`, {});
      await loadTickets();
      alert("Ticket cerrado.");
    } catch (err) {
      console.warn("Error cerrando ticket:", err);
      alert(
        "No se pudo cerrar el ticket. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const reopenTicket = async (ticket) => {
    const id = getId(ticket);

    if (!id) {
      alert("Ticket sin ID.");
      return;
    }

    try {
      setSaving(true);
      await apiPut(`/tickets/${id}/reopen`, {});
      await loadTickets();
      alert("Ticket reabierto.");
    } catch (err) {
      console.warn("Error reabriendo ticket:", err);
      alert(
        "No se pudo reabrir el ticket. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hsm-tickets-page">
      <section className="hsm-tickets-head">
        <div>
          <h2>Tickets / Soporte</h2>
          <p>Reclamos técnicos sincronizados</p>
        </div>

        <div className="hsm-ticket-actions-top">
          <button onClick={openNewTicket}>+ Ticket</button>
          <button onClick={loadAll}>Actualizar</button>
        </div>
      </section>

      <section className="hsm-ticket-stats">
        <div>
          <strong>{stats.open}</strong>
          <span>Abiertos</span>
        </div>

        <div>
          <strong>{stats.progress}</strong>
          <span>En proceso</span>
        </div>

        <div>
          <strong>{stats.high}</strong>
          <span>Alta prioridad</span>
        </div>
      </section>

      <section className="hsm-ticket-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ticket, cliente o técnico..."
        />

        <div className="hsm-ticket-filter">
          <button
            className={filter === "open" ? "active" : ""}
            onClick={() => setFilter("open")}
          >
            Abiertos
          </button>

          <button
            className={filter === "in_progress" ? "active" : ""}
            onClick={() => setFilter("in_progress")}
          >
            En proceso
          </button>

          <button
            className={filter === "closed" ? "active" : ""}
            onClick={() => setFilter("closed")}
          >
            Cerrados
          </button>

          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
        </div>

        <div className="hsm-ticket-filter">
          <button
            className={priorityFilter === "all" ? "active" : ""}
            onClick={() => setPriorityFilter("all")}
          >
            Todas
          </button>

          <button
            className={priorityFilter === "high" ? "active" : ""}
            onClick={() => setPriorityFilter("high")}
          >
            Alta
          </button>

          <button
            className={priorityFilter === "medium" ? "active" : ""}
            onClick={() => setPriorityFilter("medium")}
          >
            Media
          </button>

          <button
            className={priorityFilter === "low" ? "active" : ""}
            onClick={() => setPriorityFilter("low")}
          >
            Baja
          </button>
        </div>
      </section>

      {showForm && (
        <section className="hsm-ticket-card">
          <div className="hsm-ticket-form-title">
            <h3>{editing ? "Editar ticket" : "Nuevo ticket"}</h3>
            <button type="button" onClick={resetForm}>×</button>
          </div>

          <form onSubmit={saveTicket} className="hsm-ticket-form">
            <select
              value={form.customer_id}
              onChange={(e) => selectCustomer(e.target.value)}
            >
              <option value="">Seleccionar cliente</option>
              {customers.map((customer) => (
                <option key={customer.id || customer.customer_id} value={customer.id || customer.customer_id}>
                  {customer.full_name || customer.name || customer.nombre || customer.customer_name}
                </option>
              ))}
            </select>

            <input
              value={form.customer_name}
              onChange={(e) => updateForm("customer_name", e.target.value)}
              placeholder="Cliente manual"
            />

            <input
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="Título del reclamo"
            />

            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="Descripción del problema"
            />

            <select
              value={form.priority}
              onChange={(e) => updateForm("priority", e.target.value)}
            >
              <option value="low">Prioridad baja</option>
              <option value="medium">Prioridad media</option>
              <option value="high">Prioridad alta</option>
            </select>

            <input
              value={form.category}
              onChange={(e) => updateForm("category", e.target.value)}
              placeholder="Categoría"
            />

            <input
              value={form.assigned_technician}
              onChange={(e) => updateForm("assigned_technician", e.target.value)}
              placeholder="Técnico asignado"
            />

            {editing && (
              <select
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value)}
              >
                <option value="open">Abierto</option>
                <option value="in_progress">En proceso</option>
                <option value="closed">Cerrado</option>
              </select>
            )}

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear ticket"}
            </button>
          </form>
        </section>
      )}

      {loading && (
        <section className="hsm-ticket-empty">
          <p>Cargando tickets...</p>
        </section>
      )}

      {!loading && visibleTickets.length === 0 && (
        <section className="hsm-ticket-empty">
          <p>No hay tickets para mostrar.</p>
        </section>
      )}

      <section className="hsm-ticket-list">
        {visibleTickets.map((ticket) => {
          const id = getId(ticket);
          const status = getStatus(ticket);
          const priority = getPriority(ticket);
          const isClosed = status === "closed";
          const isProgress = status === "in_progress";

          return (
            <article key={id} className="hsm-ticket-card">
              <div className="hsm-ticket-card-head">
                <div>
                  <h3>{getTitle(ticket)}</h3>
                  <span className={`hsm-status ${isClosed ? "active" : priority === "high" ? "pending" : "pending"}`}>
                    {statusLabel(status)}
                  </span>
                </div>

                <div className="hsm-ticket-icon">🎫</div>
              </div>

              <div className="hsm-ticket-grid">
                <div>
                  <small>Cliente</small>
                  <strong>{getCustomerName(ticket)}</strong>
                </div>

                <div>
                  <small>Prioridad</small>
                  <strong>{priorityLabel(priority)}</strong>
                </div>

                <div>
                  <small>Categoría</small>
                  <strong>{ticket.category || ticket.categoria || "-"}</strong>
                </div>

                <div>
                  <small>Técnico</small>
                  <strong>{ticket.assigned_technician || ticket.technician || "-"}</strong>
                </div>

                <div>
                  <small>Creado</small>
                  <strong>{ticket.created_at || ticket.date || "-"}</strong>
                </div>

                <div>
                  <small>ID</small>
                  <strong>{id}</strong>
                </div>
              </div>

              <p className="hsm-ticket-description">
                {ticket.description || ticket.descripcion || "-"}
              </p>

              <div className="hsm-ticket-actions">
                <button onClick={() => openEditTicket(ticket)}>Editar</button>

                {!isProgress && !isClosed && (
                  <button onClick={() => startTicket(ticket)}>Iniciar</button>
                )}

                {!isClosed && (
                  <button className="danger" onClick={() => closeTicket(ticket)}>
                    Cerrar
                  </button>
                )}

                {isClosed && (
                  <button onClick={() => reopenTicket(ticket)}>Reabrir</button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
