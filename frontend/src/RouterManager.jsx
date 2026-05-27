import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const API =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://192.168.0.113:8000";

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

const emptyForm = {
  name: "",
  host: "",
  username: "",
  password: "",
  api_port: 8728,
  www_port: 80,
  lan_interface: "ether2",
  ip_ranges: "",
  comments: "",
  coordinates: "",
  version: "",
  zone: "General",
  cut_type: "pppoe",
};

function RouterManager() {
  const [routers, setRouters] = useState([]);
  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const [importingCustomers, setImportingCustomers] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [trafficInterface, setTrafficInterface] = useState("sfp-sfpplus1");
  const [trafficData, setTrafficData] = useState([]);
  const [currentTraffic, setCurrentTraffic] = useState({
    rx: 0,
    tx: 0,
  });

  const lastTrafficRef = useRef(null);

  const loadRouters = async () => {
    try {
      const res = await axios.get(`${API}/routers`, getAuthHeaders());
      setRouters(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error cargando routers:", error);
    }
  };

  const loadTraffic = async () => {
    try {
      const res = await axios.get(
        `${API}/mikrotik/traffic?interface=${encodeURIComponent(
          trafficInterface
        )}`,
        getAuthHeaders()
      );

      const currentRx = Number(res.data.rx_bytes || 0);
      const currentTx = Number(res.data.tx_bytes || 0);

      const now = Date.now();
      const last = lastTrafficRef.current;

      if (last) {
        const seconds = (now - last.time) / 1000;

        const rxDiff = currentRx - last.rx;
        const txDiff = currentTx - last.tx;

        const rxMbps =
          rxDiff > 0 && seconds > 0
            ? (rxDiff * 8) / seconds / 1024 / 1024
            : 0;

        const txMbps =
          txDiff > 0 && seconds > 0
            ? (txDiff * 8) / seconds / 1024 / 1024
            : 0;

        const point = {
          time: new Date().toLocaleTimeString(),
          rx: Number(rxMbps.toFixed(2)),
          tx: Number(txMbps.toFixed(2)),
        };

        setCurrentTraffic({
          rx: point.rx,
          tx: point.tx,
        });

        setTrafficData((prev) => {
          const updated = [...prev, point];
          return updated.slice(-30);
        });
      }

      lastTrafficRef.current = {
        rx: currentRx,
        tx: currentTx,
        time: now,
      };
    } catch (error) {
      console.error("Error cargando tráfico MikroTik:", error);
    }
  };

  useEffect(() => {
    loadRouters();
    loadTraffic();

    const interval = setInterval(() => {
      loadTraffic();
    }, 15000);

    return () => clearInterval(interval);
  }, [trafficInterface]);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const newRouter = () => {
    setForm(emptyForm);
    setEditingId(null);
    setTestResult(null);
    setImportResult(null);
    setMode("create");
  };

  const editRouter = (router) => {
    setForm({
      ...emptyForm,
      ...router,
      password: router.password || "",
      ip_ranges: router.ip_ranges || "",
    });

    setEditingId(router.id);
    setTestResult(null);
    setImportResult(null);
    setMode("edit");
  };

  const saveRouter = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      api_port: Number(form.api_port),
      www_port: Number(form.www_port),
    };

    if (editingId) {
      await axios.put(`${API}/routers/${editingId}`, payload, getAuthHeaders());
    } else {
      await axios.post(`${API}/routers`, payload, getAuthHeaders());
    }

    setMode("list");
    setEditingId(null);
    setForm(emptyForm);
    setTestResult(null);

    await loadRouters();
  };

  const deleteRouter = async (routerId) => {
    const ok = window.confirm("¿Seguro que querés eliminar este router?");
    if (!ok) return;

    await axios.delete(`${API}/routers/${routerId}`, getAuthHeaders());
    await loadRouters();
  };

  const testRouter = async (routerId) => {
    try {
      const res = await axios.post(
        `${API}/routers/${routerId}/test`,
        {},
        getAuthHeaders()
      );

      setTestResult(res.data);
    } catch (error) {
      console.error("Error comprobando router:", error);
      setTestResult({
        status: "error",
        message: "No se pudo comprobar conexión",
        error: error.response?.data || error.message,
      });
    }
  };

  const importAllCustomersFromMikrotik = async () => {
    const ok = window.confirm(
      "¿Importar todos los PPPoE Secrets de MikroTik al CRM? Solo se crearán los clientes que todavía no existan."
    );

    if (!ok) return;

    try {
      setImportingCustomers(true);
      setImportResult(null);

      const res = await axios.post(
        `${API}/customers/import-all-from-mikrotik`,
        {},
        getAuthHeaders()
      );

      setImportResult(res.data);

      alert(
        `Importación finalizada.\nImportados: ${
          res.data.imported || 0
        }\nYa existentes: ${res.data.skipped_existing || 0}`
      );
    } catch (error) {
      console.error("Error importando clientes desde MikroTik:", error);
      alert("No se pudo importar clientes desde MikroTik.");
    } finally {
      setImportingCustomers(false);
    }
  };

  return (
    <div>
      {mode === "list" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <span>☁️</span>
                Lista Routers
              </h1>

              <p className="text-slate-500 mt-2">
                Routers MikroTik registrados en el sistema
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={importAllCustomersFromMikrotik}
                disabled={importingCustomers}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {importingCustomers
                  ? "Importando..."
                  : "Importar clientes MikroTik"}
              </button>

              <button
                onClick={newRouter}
                className="rounded-xl bg-green-500 px-5 py-3 font-bold text-white hover:bg-green-400"
              >
                + Agregar Router
              </button>
            </div>
          </div>

          <Panel title="Tráfico realtime MikroTik">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="input-dark max-w-xs"
                  value={trafficInterface}
                  onChange={(e) => {
                    setTrafficData([]);
                    setCurrentTraffic({ rx: 0, tx: 0 });
                    lastTrafficRef.current = null;
                    setTrafficInterface(e.target.value);
                  }}
                  placeholder="Interfaz, ej: sfp-sfpplus1"
                />

                <button onClick={loadTraffic} className="btn-primary">
                  Actualizar tráfico
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3">
                  <p className="text-xs text-blue-600">RX actual</p>

                  <h3 className="text-2xl font-bold text-blue-700">
                    {currentTraffic.rx} Mbps
                  </h3>
                </div>

                <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3">
                  <p className="text-xs text-green-600">TX actual</p>

                  <h3 className="text-2xl font-bold text-green-700">
                    {currentTraffic.tx} Mbps
                  </h3>
                </div>
              </div>
            </div>

            <div className="h-96 rounded-2xl border border-slate-200 bg-white p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData}>
                  <defs>
                    <linearGradient
                      id="rxGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>

                    <linearGradient
                      id="txGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="time" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Legend />

                  <Area
                    type="monotone"
                    dataKey="rx"
                    stroke="#2563eb"
                    fill="url(#rxGradient)"
                    strokeWidth={3}
                    name="RX Mbps"
                  />

                  <Area
                    type="monotone"
                    dataKey="tx"
                    stroke="#22c55e"
                    fill="url(#txGradient)"
                    strokeWidth={3}
                    name="TX Mbps"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Routers registrados">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="p-3">Nombre</th>
                    <th className="p-3">IP / Host</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3">API</th>
                    <th className="p-3">Zona</th>
                    <th className="p-3">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {routers.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="p-3 font-bold text-blue-600">{r.name}</td>
                      <td className="p-3">{r.host}</td>
                      <td className="p-3">{r.username}</td>
                      <td className="p-3">{r.api_port}</td>
                      <td className="p-3">{r.zone}</td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => testRouter(r.id)}
                            className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white hover:bg-blue-500"
                          >
                            Comprobar
                          </button>

                          <button
                            onClick={() => editRouter(r)}
                            className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-slate-950 hover:bg-yellow-400"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => deleteRouter(r.id)}
                            className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-500"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {routers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        No hay routers registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {importResult && (
            <Panel title="Resultado importación MikroTik">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <StatBox
                  title="Total Secrets"
                  value={importResult.total_mikrotik_secrets || 0}
                />

                <StatBox
                  title="Importados"
                  value={importResult.imported || 0}
                  color="text-green-600"
                />

                <StatBox
                  title="Ya existentes"
                  value={importResult.skipped_existing || 0}
                  color="text-blue-600"
                />

                <StatBox
                  title="Errores"
                  value={importResult.errors?.length || 0}
                  color="text-red-600"
                />
              </div>

              <pre className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs overflow-auto">
                {JSON.stringify(importResult, null, 2)}
              </pre>
            </Panel>
          )}

          {testResult && (
            <Panel title="Resultado de conexión">
              <pre className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </Panel>
          )}
        </>
      )}

      {(mode === "create" || mode === "edit") && (
        <>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold">
                ☁️ {mode === "edit" ? "Editar Router" : "Agregar Router"}
              </h1>

              <p className="text-slate-500 mt-2">
                Configuración del router MikroTik
              </p>
            </div>

            <button
              onClick={() => setMode("list")}
              className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-900 hover:bg-slate-300"
            >
              Volver
            </button>
          </div>

          <form onSubmit={saveRouter}>
            <Panel title="Información General">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />

                <Input
                  label="IPv4 / DDNS"
                  value={form.host}
                  onChange={(e) => handleChange("host", e.target.value)}
                />

                <Input
                  label="Usuario del RB"
                  value={form.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                />

                <Input
                  label="Password del RB"
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                />

                <Input
                  label="Puerto API"
                  type="number"
                  value={form.api_port}
                  onChange={(e) => handleChange("api_port", e.target.value)}
                />

                <Input
                  label="Puerto WWW"
                  type="number"
                  value={form.www_port}
                  onChange={(e) => handleChange("www_port", e.target.value)}
                />

                <Input
                  label="Interfaz LAN"
                  value={form.lan_interface}
                  onChange={(e) => handleChange("lan_interface", e.target.value)}
                />

                <Input
                  label="Zona"
                  value={form.zone}
                  onChange={(e) => handleChange("zone", e.target.value)}
                />
              </div>

              <div className="mt-5">
                <label className="text-sm text-slate-500">Rangos IP</label>

                <textarea
                  className="input-dark min-h-32 mt-2"
                  placeholder={`Ejemplo:
10.10.10.0/24
10.10.20.0/24`}
                  value={form.ip_ranges || ""}
                  onChange={(e) => handleChange("ip_ranges", e.target.value)}
                />
              </div>

              <div className="mt-5">
                <label className="text-sm text-slate-500">Comentarios</label>

                <textarea
                  className="input-dark min-h-24 mt-2"
                  value={form.comments || ""}
                  onChange={(e) => handleChange("comments", e.target.value)}
                />
              </div>
            </Panel>

            <div className="flex flex-wrap gap-3 mt-6">
              <button className="rounded-xl bg-green-500 px-5 py-3 font-bold text-white hover:bg-green-400">
                {mode === "edit" ? "Guardar cambios" : "Guardar router"}
              </button>

              <button
                type="button"
                onClick={() => setMode("list")}
                className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-900 hover:bg-slate-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5 shadow-sm">
      {title && <h3 className="mb-4 text-xl font-bold text-slate-950">{title}</h3>}
      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="text-sm text-slate-500">{label}</label>}
      <input {...props} className="input-dark mt-2" />
    </div>
  );
}

function StatBox({ title, value, color = "text-slate-950" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-slate-500 text-sm">{title}</p>
      <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
    </div>
  );
}

export default RouterManager;