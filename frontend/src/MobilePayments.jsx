import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "./mobileApi";

const today = new Date().toISOString().slice(0, 10);

function getId(invoice) {
  return invoice?.id || invoice?.invoice_id;
}

function getCustomerId(invoice) {
  return invoice?.customer_id || invoice?.client_id;
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
  return "pending";
}

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export default function MobilePayments() {
  const [invoices, setInvoices] = useState([]);
  const [cashbox, setCashbox] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pendingInvoices = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (invoices || []).filter((invoice) => {
      const status = getStatus(invoice);

      if (filter === "pending" && !["pending", "overdue"].includes(status)) return false;
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
        invoice.number,
        invoice.numero,
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
      pendingCount: pending.length,
      paidCount: paid.length,
      pendingAmount: pending.reduce((acc, item) => acc + Number(getAmount(item) || 0), 0),
      paidAmount: paid.reduce((acc, item) => acc + Number(getAmount(item) || 0), 0),
      cashboxTotal:
        cashbox?.total ||
        cashbox?.total_amount ||
        cashbox?.income ||
        cashbox?.ingresos ||
        0,
    };
  }, [invoices, cashbox]);

  const loadInvoices = async () => {
    const data = await apiGet("/invoices");
    const items = Array.isArray(data) ? data : data?.items || data?.invoices || data?.data || [];
    setInvoices(items);
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

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([loadInvoices(), loadCashbox()]);
    } catch (err) {
      console.warn("Error cargando pagos/caja:", err);
      alert("No se pudieron cargar pagos y caja.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const payInvoice = async (invoice) => {
    const id = getId(invoice);

    if (!id) {
      alert("Factura sin ID.");
      return;
    }

    if (!confirm(`¿Registrar pago de ${getCustomerName(invoice)} por ${money(getAmount(invoice))}?`)) {
      return;
    }

    try {
      setSaving(true);

      await apiPut(`/invoices/${id}/pay`, {
        payment_date: today,
        paid_at: today,
        payment_method: "efectivo",
        amount: Number(getAmount(invoice) || 0),
      });

      await loadAll();

      alert("Pago registrado correctamente.");
    } catch (err) {
      console.warn("Error registrando pago:", err);
      alert(
        "No se pudo registrar el pago. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setSaving(false);
    }
  };

  const loadPaymentHistory = async (invoice) => {
    const customerId = getCustomerId(invoice);

    if (!customerId) {
      alert("La factura no tiene cliente asociado.");
      return;
    }

    try {
      setSelectedCustomer(getCustomerName(invoice));

      const data = await apiGet(`/customers/${customerId}/payment-history`);
      const items = Array.isArray(data)
        ? data
        : data?.items || data?.payments || data?.history || data?.data || [];

      setHistory(items);
    } catch (err) {
      console.warn("Error cargando historial:", err);
      setHistory([]);
      alert(
        "No se pudo cargar historial de pagos. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    }
  };

  return (
    <div className="hsm-payments-page">
      <section className="hsm-payments-head">
        <div>
          <h2>Caja / Pagos</h2>
          <p>Pagos sincronizados con facturas</p>
        </div>

        <button onClick={loadAll}>Actualizar</button>
      </section>

      <section className="hsm-payment-stats">
        <div>
          <strong>{stats.pendingCount}</strong>
          <span>Pendientes</span>
        </div>

        <div>
          <strong>{money(stats.pendingAmount)}</strong>
          <span>A cobrar</span>
        </div>

        <div>
          <strong>{money(stats.cashboxTotal || stats.paidAmount)}</strong>
          <span>Caja diaria</span>
        </div>
      </section>

      <section className="hsm-payment-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente o factura..."
        />

        <div className="hsm-payment-filter">
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

      {loading && (
        <section className="hsm-payment-empty">
          <p>Cargando pagos...</p>
        </section>
      )}

      {!loading && pendingInvoices.length === 0 && (
        <section className="hsm-payment-empty">
          <p>No hay pagos para mostrar.</p>
        </section>
      )}

      <section className="hsm-payment-list">
        {pendingInvoices.map((invoice) => {
          const id = getId(invoice);
          const status = getStatus(invoice);
          const isPaid = status === "paid";

          return (
            <article key={id} className="hsm-payment-card">
              <div className="hsm-payment-card-head">
                <div>
                  <h3>{getCustomerName(invoice)}</h3>
                  <span className={`hsm-status ${isPaid ? "active" : "pending"}`}>
                    {isPaid ? "Pagada" : "Pendiente"}
                  </span>
                </div>

                <div className="hsm-payment-icon">💵</div>
              </div>

              <div className="hsm-payment-grid">
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
                  <small>Factura</small>
                  <strong>{invoice.number || invoice.numero || id}</strong>
                </div>
              </div>

              <div className="hsm-payment-actions">
                {!isPaid && (
                  <button disabled={saving} onClick={() => payInvoice(invoice)}>
                    Registrar pago
                  </button>
                )}

                <button onClick={() => loadPaymentHistory(invoice)}>
                  Historial
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {selectedCustomer && (
        <section className="hsm-payment-card">
          <div className="hsm-payment-card-head">
            <div>
              <h3>Historial</h3>
              <p>{selectedCustomer}</p>
            </div>

            <button onClick={() => {
              setSelectedCustomer(null);
              setHistory([]);
            }}>
              ×
            </button>
          </div>

          {history.length === 0 ? (
            <p>No hay historial para mostrar.</p>
          ) : (
            <div className="hsm-payment-history">
              {history.map((item, index) => (
                <div key={item.id || index}>
                  <strong>{money(item.amount || item.total || item.monto)}</strong>
                  <span>{item.payment_date || item.date || item.created_at || "-"}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
