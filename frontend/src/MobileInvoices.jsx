import React, { useEffect, useMemo, useState } from "react";
import { API, apiGet, apiPost, apiPut, getToken } from "./mobileApi";

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  customer_id: "",
  customer_name: "",
  concept: "Servicio de internet",
  amount: "",
  due_date: today,
  notes: "",
};

function getId(invoice) {
  return invoice?.id || invoice?.invoice_id;
}

function getCustomerName(invoice) {
  return (
    invoice?.customer_name ||
    invoice?.client_name ||
    invoice?.full_name ||
    invoice?.name ||
    invoice?.nombre ||
    "Sin cliente"
  );
}

function getAmount(invoice) {
  return invoice?.amount || invoice?.total || invoice?.price || invoice?.monto || 0;
}

function getStatus(invoice) {
  const raw = String(invoice?.status || invoice?.estado || "").toLowerCase();

  if (["paid", "pagada", "pagado"].includes(raw)) return "paid";
  if (["overdue", "vencida", "vencido"].includes(raw)) return "overdue";
  if (["cancelled", "cancelada"].includes(raw)) return "cancelled";

  return "pending";
}

function statusLabel(status) {
  if (status === "paid") return "Pagada";
  if (status === "overdue") return "Vencida";
  if (status === "cancelled") return "Cancelada";
  return "Pendiente";
}

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function openPdf(path) {
  const token = getToken();
  const url = `${API}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  window.open(url, "_blank");
}

export default function MobileInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleInvoices = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (invoices || []).filter((invoice) => {
      const status = getStatus(invoice);

      if (filter === "pending" && status !== "pending" && status !== "overdue") return false;
      if (filter === "paid" && status !== "paid") return false;
      if (filter === "all") {
        // sin filtro
      }

      if (!term) return true;

      const text = [
        getCustomerName(invoice),
        invoice.concept,
        invoice.description,
        invoice.notes,
        invoice.numero,
        invoice.number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [invoices, query, filter]);

  const stats = useMemo(() => {
    const pending = invoices.filter((invoice) => ["pending", "overdue"].includes(getStatus(invoice)));
    const paid = invoices.filter((invoice) => getStatus(invoice) === "paid");

    return {
      total: invoices.length,
      pending: pending.length,
      paid: paid.length,
      pendingAmount: pending.reduce((acc, item) => acc + Number(getAmount(item) || 0), 0),
      paidAmount: paid.reduce((acc, item) => acc + Number(getAmount(item) || 0), 0),
    };
  }, [invoices]);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const data = await apiGet("/invoices");
      const items = Array.isArray(data) ? data : data?.items || data?.invoices || data?.data || [];

      setInvoices(items);
    } catch (err) {
      console.warn("Error cargando facturas:", err);
      setInvoices([]);
      alert("No se pudieron cargar las facturas.");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await apiGet("/customers");
      const items = Array.isArray(data) ? data : data?.items || data?.customers || data?.data || [];
      setCustomers(items.filter((c) => String(c.status || c.estado || "").toLowerCase() !== "deleted"));
    } catch {
      setCustomers([]);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadInvoices(), loadCustomers()]);
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
    setShowForm(false);
  };

  const selectCustomer = (customerId) => {
    const customer = customers.find((item) => String(item.id || item.customer_id) === String(customerId));

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

  const buildPayload = () => ({
    customer_id: form.customer_id ? Number(form.customer_id) : null,
    customer_name: form.customer_name,
    client_name: form.customer_name,

    concept: form.concept,
    description: form.concept,
    descripcion: form.concept,

    amount: Number(form.amount || 0),
    total: Number(form.amount || 0),
    monto: Number(form.amount || 0),

    due_date: form.due_date,
    fecha_vencimiento: form.due_date,

    notes: form.notes,
    observaciones: form.notes,

    status: "pending",
    estado: "pending",
  });

  const validateForm = () => {
    if (!form.customer_id && !form.customer_name.trim()) return "Seleccioná o ingresá un cliente.";
    if (!String(form.amount).trim()) return "Ingresá el importe.";
    if (!form.due_date) return "Ingresá la fecha de vencimiento.";
    return "";
  };

  const createInvoice = async (event) => {
    event.preventDefault();

    const validation = validateForm();

    if (validation) {
      alert(validation);
      return;
    }

    try {
      setSaving(true);

      await apiPost("/invoices", buildPayload());

      resetForm();
      await loadInvoices();

      alert("Factura creada.");
    } catch (err) {
      console.warn("Error creando factura:", err);
      alert(
        "No se pudo crear la factura. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const payInvoice = async (invoice) => {
    const id = getId(invoice);

    if (!id) {
      alert("Factura sin ID.");
      return;
    }

    if (!confirm(`¿Marcar factura de ${getCustomerName(invoice)} como pagada?`)) return;

    try {
      setSaving(true);

      await apiPut(`/invoices/${id}/pay`, {
        payment_date: today,
        paid_at: today,
        payment_method: "efectivo",
      });

      await loadInvoices();

      alert("Factura marcada como pagada.");
    } catch (err) {
      console.warn("Error pagando factura:", err);
      alert(
        "No se pudo pagar la factura. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hsm-invoices-page">
      <section className="hsm-invoices-head">
        <div>
          <h2>Facturas</h2>
          <p>{stats.total} facturas registradas</p>
        </div>

        <div className="hsm-invoice-actions-top">
          <button onClick={() => setShowForm(true)}>+ Factura</button>
          <button onClick={loadAll}>Actualizar</button>
        </div>
      </section>

      <section className="hsm-invoice-stats">
        <div>
          <strong>{stats.pending}</strong>
          <span>Pendientes</span>
        </div>

        <div>
          <strong>{stats.paid}</strong>
          <span>Pagadas</span>
        </div>

        <div>
          <strong>{money(stats.pendingAmount)}</strong>
          <span>A cobrar</span>
        </div>
      </section>

      <section className="hsm-invoice-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar factura o cliente..."
        />

        <div className="hsm-invoice-filter">
          <button
            className={filter === "pending" ? "active" : ""}
            onClick={() => setFilter("pending")}
          >
            Pendientes
          </button>

          <button
            className={filter === "paid" ? "active" : ""}
            onClick={() => setFilter("paid")}
          >
            Pagadas
          </button>

          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todas
          </button>
        </div>
      </section>

      {showForm && (
        <section className="hsm-invoice-card">
          <div className="hsm-invoice-form-title">
            <h3>Nueva factura</h3>
            <button type="button" onClick={resetForm}>×</button>
          </div>

          <form onSubmit={createInvoice} className="hsm-invoice-form">
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
              value={form.concept}
              onChange={(e) => updateForm("concept", e.target.value)}
              placeholder="Concepto"
            />

            <input
              type="number"
              value={form.amount}
              onChange={(e) => updateForm("amount", e.target.value)}
              placeholder="Importe"
            />

            <input
              type="date"
              value={form.due_date}
              onChange={(e) => updateForm("due_date", e.target.value)}
            />

            <textarea
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              placeholder="Notas"
            />

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear factura"}
            </button>
          </form>
        </section>
      )}

      {loading && (
        <section className="hsm-invoice-empty">
          <p>Cargando facturas...</p>
        </section>
      )}

      {!loading && visibleInvoices.length === 0 && (
        <section className="hsm-invoice-empty">
          <p>No hay facturas para mostrar.</p>
        </section>
      )}

      <section className="hsm-invoice-list">
        {visibleInvoices.map((invoice) => {
          const id = getId(invoice);
          const status = getStatus(invoice);

          return (
            <article key={id} className="hsm-invoice-card">
              <div className="hsm-invoice-card-head">
                <div>
                  <h3>{getCustomerName(invoice)}</h3>
                  <span className={`hsm-status ${status === "paid" ? "active" : "pending"}`}>
                    {statusLabel(status)}
                  </span>
                </div>

                <div className="hsm-invoice-icon">🧾</div>
              </div>

              <div className="hsm-invoice-grid">
                <div>
                  <small>Importe</small>
                  <strong>{money(getAmount(invoice))}</strong>
                </div>

                <div>
                  <small>Vencimiento</small>
                  <strong>{invoice.due_date || invoice.fecha_vencimiento || "-"}</strong>
                </div>

                <div>
                  <small>Concepto</small>
                  <strong>{invoice.concept || invoice.description || "-"}</strong>
                </div>

                <div>
                  <small>Número</small>
                  <strong>{invoice.number || invoice.numero || id}</strong>
                </div>
              </div>

              <div className="hsm-invoice-actions">
                {status !== "paid" && (
                  <button disabled={saving} onClick={() => payInvoice(invoice)}>
                    Pagar
                  </button>
                )}

                <button onClick={() => openPdf(`/invoices/${id}/receipt-pdf`)}>
                  Recibo
                </button>

                <button onClick={() => openPdf(`/invoices/${id}/factura-pdf`)}>
                  PDF
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
