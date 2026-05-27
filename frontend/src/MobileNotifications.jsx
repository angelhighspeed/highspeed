import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://192.168.0.113:8000";

function getHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  };
}

function getType(item) {
  const raw = String(item.type || item.tipo || item.category || "").toLowerCase();

  if (raw.includes("debt") || raw.includes("deuda")) return "Deuda";
  if (raw.includes("ticket")) return "Ticket";
  if (raw.includes("invoice") || raw.includes("factura")) return "Factura";
  if (raw.includes("install") || raw.includes("instal")) return "Instalación";
  if (raw.includes("system") || raw.includes("sistema")) return "Sistema";

  return item.type || item.tipo || "Sistema";
}

function getTitle(item) {
  return (
    item.title ||
    item.titulo ||
    item.subject ||
    item.message_title ||
    item.name ||
    "Notificación"
  );
}

function getMessage(item) {
  return (
    item.message ||
    item.mensaje ||
    item.description ||
    item.descripcion ||
    item.detail ||
    "Sin detalle"
  );
}

function getDate(item) {
  return (
    item.created_at ||
    item.date ||
    item.fecha ||
    item.timestamp ||
    "-"
  );
}

function isRead(item) {
  if (item.read === true) return true;
  if (item.is_read === true) return true;
  if (String(item.status || "").toLowerCase().includes("read")) return true;
  if (String(item.estado || "").toLowerCase().includes("leida")) return true;
  return false;
}

function typeClass(type) {
  const t = String(type).toLowerCase();

  if (t.includes("deuda")) return "debt";
  if (t.includes("ticket")) return "ticket";
  if (t.includes("factura")) return "invoice";
  if (t.includes("instal")) return "install";
  return "system";
}

function MobileNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("todas");
  const [readFilter, setReadFilter] = useState("no-leidas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [changingId, setChangingId] = useState(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      let res;
      const attempts = [
        `${API}/notifications`,
        `${API}/notificaciones`,
        `${API}/system/notifications`,
        `${API}/alerts`,
      ];

      for (const url of attempts) {
        try {
          res = await axios.get(url, getHeaders());
          break;
        } catch (err) {
          console.warn("Intento notificaciones falló:", url, err?.response?.status || err?.message);
        }
      }

      let data = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.data?.notifications)
        ? res.data.notifications
        : Array.isArray(res?.data?.alerts)
        ? res.data.alerts
        : [];

      if (!data.length) {
        data = [
          {
            id: "local-debt",
            type: "Deuda",
            title: "Clientes con deuda",
            message: "Revisá el módulo Corte automático para ver clientes pendientes.",
            created_at: new Date().toISOString().slice(0, 10),
            read: false,
          },
          {
            id: "local-ticket",
            type: "Ticket",
            title: "Tickets abiertos",
            message: "Revisá tickets abiertos y pendientes de atención.",
            created_at: new Date().toISOString().slice(0, 10),
            read: false,
          },
          {
            id: "local-install",
            type: "Instalación",
            title: "Instalaciones pendientes",
            message: "Revisá las instalaciones nuevas o programadas.",
            created_at: new Date().toISOString().slice(0, 10),
            read: false,
          },
        ];
      }

      setNotifications(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const stats = useMemo(() => {
    let unread = 0;
    let debt = 0;
    let tickets = 0;
    let invoices = 0;

    notifications.forEach((item) => {
      const type = getType(item).toLowerCase();

      if (!isRead(item)) unread += 1;
      if (type.includes("deuda")) debt += 1;
      if (type.includes("ticket")) tickets += 1;
      if (type.includes("factura")) invoices += 1;
    });

    return {
      total: notifications.length,
      unread,
      debt,
      tickets,
      invoices,
    };
  }, [notifications]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return notifications.filter((item) => {
      const type = getType(item).toLowerCase();
      const read = isRead(item);

      const text = [
        getTitle(item),
        getMessage(item),
        getType(item),
        getDate(item),
      ]
        .join(" ")
        .toLowerCase();

      const matchText = !q || text.includes(q);

      let matchType = true;
      if (typeFilter !== "todas") {
        matchType = type.includes(typeFilter);
      }

      let matchRead = true;
      if (readFilter === "no-leidas") matchRead = !read;
      if (readFilter === "leidas") matchRead = read;

      return matchText && matchType && matchRead;
    });
  }, [notifications, query, typeFilter, readFilter]);

  const markRead = async (item) => {
    const id = item.id;

    if (!id) return;

    try {
      setChangingId(id);

      let saved = false;
      const payload = {
        read: true,
        is_read: true,
        status: "read",
      };

      const attempts = [
        () => axios.patch(`${API}/notifications/${id}`, payload, getHeaders()),
        () => axios.put(`${API}/notifications/${id}`, payload, getHeaders()),
        () => axios.post(`${API}/notifications/${id}/read`, payload, getHeaders()),
        () => axios.patch(`${API}/alerts/${id}`, payload, getHeaders()),
      ];

      for (const attempt of attempts) {
        try {
          await attempt();
          saved = true;
          break;
        } catch (err) {
          console.warn("Intento marcar leída falló:", err?.response?.status || err?.message);
        }
      }

      if (!saved) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, read: true, is_read: true, status: "read" } : n
          )
        );
      } else {
        await loadNotifications();
      }
    } finally {
      setChangingId(null);
    }
  };

  return (
    <div className="hsm-notif-page">
      <section className="hsm-notif-head">
        <div>
          <h2>Notificaciones</h2>
          <p>{stats.unread} sin leer · {stats.total} total</p>
        </div>

        <button onClick={loadNotifications}>Actualizar</button>
      </section>

      <section className="hsm-notif-stats">
        <div>
          <strong>{stats.unread}</strong>
          <span>Sin leer</span>
        </div>

        <div>
          <strong>{stats.debt}</strong>
          <span>Deuda</span>
        </div>

        <div>
          <strong>{stats.tickets}</strong>
          <span>Tickets</span>
        </div>
      </section>

      <section className="hsm-notif-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar notificación..."
        />

        <div className="hsm-notif-filter">
          <button
            className={readFilter === "no-leidas" ? "active" : ""}
            onClick={() => setReadFilter("no-leidas")}
          >
            No leídas
          </button>

          <button
            className={readFilter === "todas" ? "active" : ""}
            onClick={() => setReadFilter("todas")}
          >
            Todas
          </button>

          <button
            className={readFilter === "leidas" ? "active" : ""}
            onClick={() => setReadFilter("leidas")}
          >
            Leídas
          </button>
        </div>

        <div className="hsm-notif-filter">
          <button
            className={typeFilter === "todas" ? "active" : ""}
            onClick={() => setTypeFilter("todas")}
          >
            Todas
          </button>

          <button
            className={typeFilter === "deuda" ? "active" : ""}
            onClick={() => setTypeFilter("deuda")}
          >
            Deuda
          </button>

          <button
            className={typeFilter === "ticket" ? "active" : ""}
            onClick={() => setTypeFilter("ticket")}
          >
            Tickets
          </button>

          <button
            className={typeFilter === "factura" ? "active" : ""}
            onClick={() => setTypeFilter("factura")}
          >
            Facturas
          </button>

          <button
            className={typeFilter === "instalación" ? "active" : ""}
            onClick={() => setTypeFilter("instalación")}
          >
            Instalaciones
          </button>
        </div>
      </section>

      {loading && (
        <div className="hsm-card">
          <p>Cargando notificaciones...</p>
        </div>
      )}

      {error && (
        <div className="hsm-card">
          <p style={{ color: "#dc2626", fontWeight: 800 }}>{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="hsm-card">
          <p>No hay notificaciones para mostrar.</p>
        </div>
      )}

      <section className="hsm-notif-list">
        {filtered.map((item, index) => {
          const type = getType(item);
          const read = isRead(item);
          const id = item.id || index;

          return (
            <article
              key={id}
              className={`hsm-notif-card ${read ? "read" : ""}`}
            >
              <div className={`hsm-notif-icon ${typeClass(type)}`}>
                🔔
              </div>

              <div className="hsm-notif-main">
                <div className="hsm-notif-top">
                  <h3>{getTitle(item)}</h3>
                  <span className={typeClass(type)}>{type}</span>
                </div>

                <p>{getMessage(item)}</p>

                <div className="hsm-notif-bottom">
                  <small>{getDate(item)}</small>

                  {!read && (
                    <button
                      onClick={() => markRead(item)}
                      disabled={changingId === item.id}
                    >
                      {changingId === item.id ? "..." : "Marcar leída"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

export default MobileNotifications;
