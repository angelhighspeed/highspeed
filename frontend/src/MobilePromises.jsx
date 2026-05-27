import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { isOnlineSyncMode, offlineNotAllowedMessage } from "./syncMode";

import { API } from "./apiBase";
function getHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${
        localStorage.getItem("token") || localStorage.getItem("access_token") || ""
      }`,
    },
  };
}

const emptyForm = {
  customer_id: "",
  amount: "",
  promise_date: "",
  notes: "",
};

function formatMoney(value) {
  const num = Number(value || 0);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(num);
}

function getLocalPromises() {
  if (isOnlineSyncMode()) return [];

  try {
    return JSON.parse(localStorage.getItem("hsm_local_promises") || "[]");
  } catch {
    return [];
  }
}

function setLocalPromises(items) {
  if (isOnlineSyncMode()) return;
  localStorage.setItem("hsm_local_promises", JSON.stringify(items));
}

function getClientName(client) {
  const first = client?.name || client?.nombre || client?.first_name || "";
  const last = client?.last_name || client?.apellido || "";

  return (
    client?.full_name ||
    client?.nombre_completo ||
    client?.customer_name ||
    `${first} ${last}`.trim() ||
    `Cliente #${client?.id || "-"}`
  );
}

function getPromiseClientName(item, clients) {
  const direct =
    item.customer_name ||
    item.client_name ||
    item.nombre_cliente ||
    item.full_name ||
    "";

  if (direct) return direct;

  const id = item.customer_id || item.client_id;
  const client = clients.find((c) => String(c.id) === String(id));

  return client ? getClientName(client) : `Cliente #${id || "-"}`;
}

function MobilePromises() {
  const [promises, setPromises] = useState([]);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadClients = async () => {
    try {
      let res;

      const attempts = [
        `${API}/customers`,
        `${API}/customers/list-all`,
        `${API}/clients`,
      ];

      for (const url of attempts) {
        try {
          res = await axios.get(url, getHeaders());
          break;
        } catch {}
      }

      const data = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.data?.customers)
        ? res.data.customers
        : Array.isArray(res?.data?.clients)
        ? res.data.clients
        : [];

      setClients(data);
    } catch {
      setClients([]);
    }
  };

  const loadPromises = async () => {
    try {
      setLoading(true);

      let res;

      const attempts = [
        `${API}/payment-promises`,
        `${API}/promises`,
        `${API}/promesas`,
        `${API}/promesas-pago`,
      ];

      for (const url of attempts) {
        try {
          res = await axios.get(url, getHeaders());
          break;
        } catch {}
      }

      const backendData = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.data?.promises)
        ? res.data.promises
        : Array.isArray(res?.data?.promesas)
        ? res.data.promesas
        : [];

      const localData = getLocalPromises();

      setPromises([
        ...backendData,
        ...localData.filter((localItem) => {
          return !backendData.some(
            (backendItem) => String(backendItem.id) === String(localItem.id)
          );
        }),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    loadPromises();
  }, []);

  const stats = useMemo(() => {
    const total = promises.reduce(
      (sum, item) => sum + Number(item.amount || item.monto || 0),
      0
    );

    return {
      count: promises.length,
      total,
    };
  }, [promises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return promises;

    return promises.filter((item) => {
      return [
        getPromiseClientName(item, clients),
        item.amount,
        item.monto,
        item.promise_date,
        item.fecha_promesa,
        item.notes,
        item.observaciones,
        item.status,
        item.estado,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [promises, clients, query]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const savePromise = async (e) => {
    e.preventDefault();

    if (!form.customer_id) {
      alert("Seleccioná un cliente.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert("Ingresá un monto válido.");
      return;
    }

    if (!form.promise_date) {
      alert("Ingresá la fecha de promesa.");
      return;
    }

    try {
      setSaving(true);

      const client = clients.find(
        (item) => String(item.id) === String(form.customer_id)
      );

      const clientName = client
        ? getClientName(client)
        : `Cliente #${form.customer_id}`;

      const payload = {
        customer_id: Number(form.customer_id),
        client_id: Number(form.customer_id),
        customer_name: clientName,
        amount: Number(form.amount),
        monto: Number(form.amount),
        promise_date: form.promise_date,
        fecha_promesa: form.promise_date,
        notes: form.notes,
        observaciones: form.notes,
        status: "pending",
        estado: "Pendiente",
      };

      let saved = false;

      const attempts = [
        () => axios.post(`${API}/payment-promises`, payload, getHeaders()),
        () => axios.post(`${API}/promises`, payload, getHeaders()),
        () => axios.post(`${API}/promesas`, payload, getHeaders()),
        () => axios.post(`${API}/promesas-pago`, payload, getHeaders()),
      ];

      for (const attempt of attempts) {
        try {
          await attempt();
          saved = true;
          break;
        } catch {}
      }

      if (!saved) {
        if (isOnlineSyncMode()) {
          alert(offlineNotAllowedMessage("Promesas de pago"));
          return;
        }

        const localPromise = {
          id: `local-promise-${Date.now()}`,
          local_only: true,
          ...payload,
          created_at: new Date().toISOString(),
        };

        setLocalPromises([localPromise, ...getLocalPromises()]);
      }

      setForm(emptyForm);
      setShowForm(false);
      await loadPromises();

      alert(saved ? "Promesa guardada." : offlineNotAllowedMessage("Promesas de pago"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hsm-promises-page">
      <section className="hsm-invoices-head">
        <div>
          <h2>Promesas</h2>
          <p>{stats.count} promesas registradas</p>
        </div>

        <button onClick={() => setShowForm(true)}>+ Promesa</button>
      </section>

      <section className="hsm-invoices-total">
        <span>Total prometido</span>
        <strong>{formatMoney(stats.total)}</strong>
      </section>

      <section className="hsm-invoices-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar promesa, cliente o fecha..."
        />
      </section>

      {showForm && (
        <section className="hsm-invoices-form-card">
          <div className="hsm-invoices-form-head">
            <h3>Nueva promesa</h3>
            <button onClick={() => setShowForm(false)}>×</button>
          </div>

          <form onSubmit={savePromise} className="hsm-invoices-form">
            <select
              value={form.customer_id}
              onChange={(e) => updateForm("customer_id", e.target.value)}
            >
              <option value="">Seleccionar cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {getClientName(client)}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Monto prometido"
              value={form.amount}
              onChange={(e) => updateForm("amount", e.target.value)}
            />

            <input
              type="date"
              value={form.promise_date}
              onChange={(e) => updateForm("promise_date", e.target.value)}
            />

            <textarea
              placeholder="Notas"
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
            />

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar promesa"}
            </button>
          </form>
        </section>
      )}

      {loading && (
        <div className="hsm-card">
          <p>Cargando promesas...</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="hsm-card">
          <p>No hay promesas para mostrar.</p>
        </div>
      )}

      <section className="hsm-invoices-list">
        {filtered.map((item) => (
          <article key={item.id} className="hsm-invoice-card">
            <div className="hsm-invoice-top">
              <div className="hsm-invoice-icon">🤝</div>

              <div className="hsm-invoice-main">
                <h3>{getPromiseClientName(item, clients)}</h3>
                <span className="warn">
                  {item.estado || item.status || "Pendiente"}
                </span>
              </div>

              <strong>{formatMoney(item.amount || item.monto)}</strong>
            </div>

            <div className="hsm-invoice-info">
              <div>
                <b>Fecha promesa</b>
                <span>{item.promise_date || item.fecha_promesa || "-"}</span>
              </div>

              <div>
                <b>Notas</b>
                <span>{item.notes || item.observaciones || "-"}</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default MobilePromises;
