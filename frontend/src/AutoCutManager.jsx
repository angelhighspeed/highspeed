import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

function AutoCutManager() {
  const [graceDays, setGraceDays] = useState(0);
  const [applyMikrotik, setApplyMikrotik] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const candidates = preview?.candidates || [];

  const totalDebt = useMemo(() => {
    return candidates.reduce((sum, item) => sum + Number(item.total_debt || 0), 0);
  }, [candidates]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await axios.get(
        `${API}/auto-cut/preview?grace_days=${Number(graceDays || 0)}`,
        getAuthHeaders()
      );

      setPreview(res.data);
    } catch (err) {
      console.error("Error cargando vista previa de corte:", err);
      setError(err?.response?.data?.detail || err?.response?.data?.message || "No se pudo cargar la vista previa.");
    } finally {
      setLoading(false);
    }
  };

  const simulateCut = async () => {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await axios.post(
        `${API}/auto-cut/run?dry_run=true&grace_days=${Number(graceDays || 0)}&apply_mikrotik=${applyMikrotik}`,
        {},
        getAuthHeaders()
      );

      setResult(res.data);
      setPreview({
        ...res.data,
        candidates: res.data.candidates || [],
      });
    } catch (err) {
      console.error("Error simulando corte:", err);
      setError(err?.response?.data?.detail || err?.response?.data?.message || "No se pudo simular el corte.");
    } finally {
      setLoading(false);
    }
  };

  const executeCut = async () => {
    if (candidates.length === 0) {
      alert("No hay clientes candidatos a corte.");
      return;
    }

    const message = applyMikrotik
      ? `Vas a cortar ${candidates.length} cliente(s) y deshabilitar PPPoE en MikroTik. ¿Confirmás?`
      : `Vas a suspender ${candidates.length} cliente(s) solo dentro del CRM. ¿Confirmás?`;

    if (!window.confirm(message)) return;

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await axios.post(
        `${API}/auto-cut/run?dry_run=false&grace_days=${Number(graceDays || 0)}&apply_mikrotik=${applyMikrotik}`,
        {},
        getAuthHeaders()
      );

      setResult(res.data);
      await loadPreview();
    } catch (err) {
      console.error("Error ejecutando corte:", err);
      setError(err?.response?.data?.detail || err?.response?.data?.message || "No se pudo ejecutar el corte.");
    } finally {
      setLoading(false);
    }
  };

  const reconnectCustomer = async (customer) => {
    const customerName = customer.customer_name || `Cliente ${customer.customer_id}`;

    if (!window.confirm(`¿Reconectar a ${customerName}?`)) return;

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await axios.post(
        `${API}/auto-cut/reconnect/${customer.customer_id}?apply_mikrotik=${applyMikrotik}`,
        {},
        getAuthHeaders()
      );

      setResult(res.data);
      await loadPreview();
    } catch (err) {
      console.error("Error reconectando cliente:", err);
      setError(err?.response?.data?.detail || err?.response?.data?.message || "No se pudo reconectar el cliente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-bold text-slate-950">
            <span>✂️</span>
            Corte automático
          </h1>

          <p className="mt-2 text-slate-500">
            Vista previa, simulación, corte real en MikroTik y reconexión de clientes con facturas vencidas.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPreview}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-4">
        <Card title="Candidatos" value={candidates.length} subtitle="Clientes a cortar" />
        <Card title="Deuda total" value={`$ ${formatMoney(totalDebt)}`} subtitle="Facturas vencidas" />
        <Card title="Días de gracia" value={graceDays} subtitle="Luego del vencimiento" />
        <Card title="MikroTik" value={applyMikrotik ? "Activado" : "Solo CRM"} subtitle="Modo de corte" />
      </div>

      <Panel title="Configuración del corte">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">
              Días de gracia
            </span>

            <input
              type="number"
              min="0"
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              checked={applyMikrotik}
              onChange={(e) => setApplyMikrotik(e.target.checked)}
              className="h-5 w-5"
            />

            <span>
              <b>Aplicar en MikroTik</b>
              <br />
              <span className="text-sm text-slate-500">
                Si está activo, deshabilita/habilita el PPPoE Secret. Si está apagado, solo cambia el estado dentro del CRM.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            Vista previa
          </button>

          <button
            type="button"
            onClick={simulateCut}
            disabled={loading}
            className="rounded-xl bg-slate-800 px-4 py-3 font-bold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Simular
          </button>

          <button
            type="button"
            onClick={executeCut}
            disabled={loading || candidates.length === 0}
            className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-60"
          >
            Ejecutar corte
          </button>
        </div>
      </Panel>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <b>Error:</b> {error}
        </div>
      )}

      {result && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <b>{result.message || "Resultado"}</b>
          <br />
          Modo: {result.mode || "-"} · Cantidad: {result.count ?? "-"}
        </div>
      )}

      <Panel title="Clientes candidatos a corte">
        {candidates.length === 0 ? (
          <div className="rounded-xl bg-green-50 p-4 text-green-800">
            No hay clientes candidatos a corte con la configuración actual.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">PPPoE</th>
                  <th className="p-3">Router</th>
                  <th className="p-3">Vencimiento más viejo</th>
                  <th className="p-3">Facturas</th>
                  <th className="p-3">Deuda</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.customer_id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-3">
                      <p className="font-bold text-slate-900">
                        {candidate.customer_name || `Cliente ${candidate.customer_id}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        ID {candidate.customer_id}
                      </p>
                    </td>

                    <td className="p-3">
                      <span className="rounded-lg bg-orange-50 px-3 py-1 font-bold text-orange-700">
                        {candidate.current_status || "-"}
                      </span>
                    </td>

                    <td className="p-3 font-semibold text-blue-600">
                      {candidate.pppoe_username || "-"}
                    </td>

                    <td className="p-3">{candidate.router_id || "-"}</td>

                    <td className="p-3">{candidate.oldest_due_date || "-"}</td>

                    <td className="p-3">{candidate.overdue_invoices?.length || 0}</td>

                    <td className="p-3 font-bold">$ {formatMoney(candidate.total_debt)}</td>

                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => reconnectCustomer(candidate)}
                        disabled={loading}
                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-60"
                      >
                        Reconectar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-slate-500">{title}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{value}</h2>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {title && <h3 className="mb-4 text-xl font-bold text-slate-950">{title}</h3>}
      {children}
    </div>
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default AutoCutManager;
