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

const API = import.meta.env.VITE_API_URL;

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
  const [form, setForm] = useState(emptyForm);

  const [trafficInterface, setTrafficInterface] = useState("sfp-sfpplus1");
  const [trafficData, setTrafficData] = useState([]);
  const [currentTraffic, setCurrentTraffic] = useState({
    rx: 0,
    tx: 0,
  });

  const lastTrafficRef = useRef(null);

  const loadRouters = async () => {
    const res = await axios.get(`${API}/routers`, getAuthHeaders());
    setRouters(res.data);
  };

  const loadTraffic = async () => {
    try {
      const res = await axios.get(
        `${API}/mikrotik/traffic?interface=${trafficInterface}`,
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
          rxDiff > 0 ? (rxDiff * 8) / seconds / 1024 / 1024 : 0;

        const txMbps =
          txDiff > 0 ? (txDiff * 8) / seconds / 1024 / 1024 : 0;

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
      console.error(error);
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
    setMode("create");
  };

  const editRouter = (router) => {
    setForm({
      ...emptyForm,
      ...router,
      password: router.password || "",
    });

    setEditingId(router.id);
    setTestResult(null);
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
      await axios.put(
        `${API}/routers/${editingId}`,
        payload,
        getAuthHeaders()
      );
    } else {
      await axios.post(
        `${API}/routers`,
        payload,
        getAuthHeaders()
      );
    }

    setMode("list");
    setEditingId(null);
    setForm(emptyForm);
    setTestResult(null);

    await loadRouters();
  };

  const deleteRouter = async (routerId) => {
    const ok = window.confirm(
      "¿Seguro que querés eliminar este router?"
    );

    if (!ok) return;

    await axios.delete(
      `${API}/routers/${routerId}`,
      getAuthHeaders()
    );

    await loadRouters();
  };

  const testRouter = async (routerId) => {
    const res = await axios.post(
      `${API}/routers/${routerId}/test`,
      {},
      getAuthHeaders()
    );

    setTestResult(res.data);
  };

  return (
    <div>
      {mode === "list" && (
        <>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold">
                ☁️ Lista Routers
              </h1>

              <p className="text-slate-400 mt-2">
                Routers MikroTik registrados en el sistema
              </p>
            </div>

            <button
              onClick={newRouter}
              className="rounded-xl bg-green-500 px-5 py-3 font-bold text-slate-950 hover:bg-green-400"
            >
              + Agregar Router
            </button>
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

                <button
                  onClick={loadTraffic}
                  className="btn-primary"
                >
                  Actualizar tráfico
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3">
                  <p className="text-xs text-cyan-300">
                    RX actual
                  </p>

                  <h3 className="text-2xl font-bold text-cyan-300">
                    {currentTraffic.rx} Mbps
                  </h3>
                </div>

                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3">
                  <p className="text-xs text-emerald-300">
                    TX actual
                  </p>

                  <h3 className="text-2xl font-bold text-emerald-300">
                    {currentTraffic.tx} Mbps
                  </h3>
                </div>
              </div>
            </div>

            <div className="h-96 rounded-2xl border border-white/10 bg-slate-950/80 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData}>
                  <defs>
                    <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>

                    <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />

                  <XAxis dataKey="time" stroke="#94a3b8" />

                  <YAxis stroke="#94a3b8" />

                  <Tooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />

                  <Legend />

                  <Area
                    type="monotone"
                    dataKey="rx"
                    stroke="#06b6d4"
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

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
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
                    <tr
                      key={r.id}
                      className="border-b border-white/5"
                    >
                      <td className="p-3 font-bold text-cyan-400">
                        {r.name}
                      </td>

                      <td className="p-3">{r.host}</td>

                      <td className="p-3">{r.username}</td>

                      <td className="p-3">{r.api_port}</td>

                      <td className="p-3">{r.zone}</td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => testRouter(r.id)}
                            className="rounded-lg bg-cyan-500 px-3 py-2 font-bold text-slate-950 hover:bg-cyan-400"
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
                </tbody>
              </table>
            </div>
          </Panel>

          {testResult && (
            <Panel title="Resultado de conexión">
              <pre className="rounded-xl bg-slate-950 p-4 text-xs overflow-auto">
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
                ☁️{" "}
                {mode === "edit"
                  ? "Editar Router"
                  : "Agregar Router"}
              </h1>

              <p className="text-slate-400 mt-2">
                Configuración del router MikroTik
              </p>
            </div>

            <button
              onClick={() => setMode("list")}
              className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600"
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
                  onChange={(e) =>
                    handleChange("name", e.target.value)
                  }
                />

                <Input
                  label="IPv4 / DDNS"
                  value={form.host}
                  onChange={(e) =>
                    handleChange("host", e.target.value)
                  }
                />

                <Input
                  label="Usuario del RB"
                  value={form.username}
                  onChange={(e) =>
                    handleChange(
                      "username",
                      e.target.value
                    )
                  }
                />

                <Input
                  label="Password del RB"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    handleChange(
                      "password",
                      e.target.value
                    )
                  }
                />

                <Input
                  label="Puerto API"
                  type="number"
                  value={form.api_port}
                  onChange={(e) =>
                    handleChange(
                      "api_port",
                      e.target.value
                    )
                  }
                />

                <Input
                  label="Puerto WWW"
                  type="number"
                  value={form.www_port}
                  onChange={(e) =>
                    handleChange(
                      "www_port",
                      e.target.value
                    )
                  }
                />

                <Input
                  label="Interfaz LAN"
                  value={form.lan_interface}
                  onChange={(e) =>
                    handleChange(
                      "lan_interface",
                      e.target.value
                    )
                  }
                />

                <Input
                  label="Zona"
                  value={form.zone}
                  onChange={(e) =>
                    handleChange(
                      "zone",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="mt-5">
                <label className="text-sm text-slate-400">
                  Rangos IP
                </label>

                <textarea
                  className="input-dark min-h-32 mt-2"
                  placeholder={`Ejemplo:
10.10.10.0/24
10.10.20.0/24`}
                  value={form.ip_ranges || ""}
                  onChange={(e) =>
                    handleChange(
                      "ip_ranges",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="mt-5">
                <label className="text-sm text-slate-400">
                  Comentarios
                </label>

                <textarea
                  className="input-dark min-h-24 mt-2"
                  value={form.comments || ""}
                  onChange={(e) =>
                    handleChange(
                      "comments",
                      e.target.value
                    )
                  }
                />
              </div>
            </Panel>

            <div className="flex flex-wrap gap-3 mt-6">
              <button className="rounded-xl bg-green-500 px-5 py-3 font-bold text-slate-950 hover:bg-green-400">
                {mode === "edit"
                  ? "Guardar cambios"
                  : "Guardar router"}
              </button>

              <button
                type="button"
                onClick={() => setMode("list")}
                className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600"
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
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 mb-5">
      {title && (
        <h3 className="mb-4 text-xl font-bold">
          {title}
        </h3>
      )}

      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && (
        <label className="text-sm text-slate-400">
          {label}
        </label>
      )}

      <input
        {...props}
        className="input-dark mt-2"
      />
    </div>
  );
}

export default RouterManager;