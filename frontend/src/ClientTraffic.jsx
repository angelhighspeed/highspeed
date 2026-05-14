import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }

  return `${value} B`;
}

function ClientTraffic() {
  const [traffic, setTraffic] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [importingUser, setImportingUser] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [history, setHistory] = useState([]);

  const previousRef = useRef({});

  const findCustomer = (username) => {
    return customers.find((c) => c.pppoe_username === username);
  };

  const loadTraffic = async () => {
    try {
      setLoading(true);

      const [trafficRes, customersRes] = await Promise.all([
        axios.get(`${API}/mikrotik/pppoe/client-traffic`, getAuthHeaders()),
        axios.get(`${API}/customers`, getAuthHeaders()),
      ]);

      const trafficData = Array.isArray(trafficRes.data) ? trafficRes.data : [];
      const customersData = Array.isArray(customersRes.data)
        ? customersRes.data
        : [];

      const now = Date.now();

      const calculated = trafficData.map((item) => {
        const username = item.name;
        const previous = previousRef.current[username];

        let rxMbps = 0;
        let txMbps = 0;

        const currentRx = Number(item.rx_bytes || 0);
        const currentTx = Number(item.tx_bytes || 0);

        if (previous) {
          const seconds = (now - previous.time) / 1000;

          if (seconds > 0) {
            const rxDiff = currentRx - previous.rx;
            const txDiff = currentTx - previous.tx;

            rxMbps =
              rxDiff > 0
                ? Number(((rxDiff * 8) / seconds / 1024 / 1024).toFixed(2))
                : 0;

            txMbps =
              txDiff > 0
                ? Number(((txDiff * 8) / seconds / 1024 / 1024).toFixed(2))
                : 0;
          }
        }

        previousRef.current[username] = {
          rx: currentRx,
          tx: currentTx,
          time: now,
        };

        return {
          ...item,
          rx_mbps: rxMbps,
          tx_mbps: txMbps,
        };
      });

      const totalRx = calculated.reduce(
        (sum, item) => sum + Number(item.rx_mbps || 0),
        0
      );

      const totalTx = calculated.reduce(
        (sum, item) => sum + Number(item.tx_mbps || 0),
        0
      );

      const point = {
        time: new Date().toLocaleTimeString(),
        rx: Number(totalRx.toFixed(2)),
        tx: Number(totalTx.toFixed(2)),
      };

      setHistory((prev) => [...prev, point].slice(-30));
      setTraffic(calculated);
      setCustomers(customersData);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Error cargando tráfico de clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const importCustomerFromMikrotik = async (item) => {
    const ok = window.confirm(
      `¿Importar el cliente PPPoE "${item.name}" al CRM?`
    );

    if (!ok) return;

    try {
      setImportingUser(item.name);

      await axios.post(
        `${API}/customers/import-from-mikrotik`,
        {
          pppoe_username: item.name,
          remote_address: item.address || "",
          mac_cpe: item.caller_id || "",
          router_id: null,
          plan_id: null,
          zone: "",
        },
        getAuthHeaders()
      );

      await loadTraffic();

      alert(`Cliente ${item.name} importado correctamente.`);
    } catch (error) {
      console.error("Error importando cliente desde MikroTik:", error);
      alert("No se pudo importar el cliente.");
    } finally {
      setImportingUser(null);
    }
  };

  useEffect(() => {
    loadTraffic();

    const interval = setInterval(() => {
      loadTraffic();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const filteredTraffic = useMemo(() => {
    return traffic.filter((item) => {
      const customer = findCustomer(item.name);

      const text = `
        ${item.name || ""}
        ${item.address || ""}
        ${item.caller_id || ""}
        ${item.interface || ""}
        ${customer?.name || ""}
        ${customer?.last_name || ""}
        ${customer?.phone || ""}
        ${customer?.zone || ""}
      `.toLowerCase();

      return text.includes(search.toLowerCase());
    });
  }, [traffic, customers, search]);

  const totalRxMbps = traffic.reduce(
    (sum, item) => sum + Number(item.rx_mbps || 0),
    0
  );

  const totalTxMbps = traffic.reduce(
    (sum, item) => sum + Number(item.tx_mbps || 0),
    0
  );

  const totalRxBytes = traffic.reduce(
    (sum, item) => sum + Number(item.rx_bytes || 0),
    0
  );

  const totalTxBytes = traffic.reduce(
    (sum, item) => sum + Number(item.tx_bytes || 0),
    0
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <span className="text-blue-600">📊</span>
            Tráfico de Clientes
          </h1>

          <p className="text-slate-500 mt-2">
            Consumo realtime por cliente PPPoE desde MikroTik
          </p>

          {lastUpdate && (
            <p className="text-sm text-slate-400 mt-1">
              Última actualización: {lastUpdate}
            </p>
          )}
        </div>

        <button
          onClick={loadTraffic}
          className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <Card
          title="Clientes Online"
          value={traffic.length}
          subtitle="Sesiones PPPoE"
        />

        <Card
          title="RX Total"
          value={`${totalRxMbps.toFixed(2)} Mbps`}
          subtitle="Descarga actual"
        />

        <Card
          title="TX Total"
          value={`${totalTxMbps.toFixed(2)} Mbps`}
          subtitle="Subida actual"
        />

        <Card
          title="Consumo Total"
          value={formatBytes(totalRxBytes + totalTxBytes)}
          subtitle="RX + TX acumulado"
        />
      </div>

      <Panel title="Gráfico realtime general">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient
                  id="rxClientGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>

                <linearGradient
                  id="txClientGradient"
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

              <Area
                type="monotone"
                dataKey="rx"
                name="RX Mbps"
                stroke="#2563eb"
                fill="url(#rxClientGradient)"
                strokeWidth={3}
              />

              <Area
                type="monotone"
                dataKey="tx"
                name="TX Mbps"
                stroke="#22c55e"
                fill="url(#txClientGradient)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Clientes PPPoE con tráfico
            </h3>

            <p className="text-sm text-slate-500">
              La primera lectura puede aparecer en 0 Mbps; desde la segunda
              actualización calcula velocidad real.
            </p>
          </div>

          <input
            className="input-dark max-w-sm"
            placeholder="Buscar cliente, usuario, IP, MAC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="p-3">Estado</th>
                <th className="p-3">Usuario PPPoE</th>
                <th className="p-3">Cliente CRM</th>
                <th className="p-3">IP Activa</th>
                <th className="p-3">MAC / Caller ID</th>
                <th className="p-3">Interfaz</th>
                <th className="p-3">RX Mbps</th>
                <th className="p-3">TX Mbps</th>
                <th className="p-3">RX Total</th>
                <th className="p-3">TX Total</th>
                <th className="p-3">Uptime</th>
              </tr>
            </thead>

            <tbody>
              {filteredTraffic.map((item) => {
                const customer = findCustomer(item.name);

                return (
                  <tr
                    key={`${item.name}-${item.address}`}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-3">
                      <span className="rounded-md bg-green-500 px-3 py-1 text-xs font-bold text-white">
                        Online
                      </span>
                    </td>

                    <td className="p-3 font-bold text-blue-600">
                      {item.name || "-"}
                    </td>

                    <td className="p-3">
                      {customer ? (
                        <div>
                          <p className="font-semibold text-slate-900">
                            {customer.name} {customer.last_name || ""}
                          </p>

                          <p className="text-xs text-slate-500">
                            {customer.zone || "Sin zona"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="block text-orange-500 font-semibold">
                            No registrado
                          </span>

                          <button
                            type="button"
                            onClick={() => importCustomerFromMikrotik(item)}
                            disabled={importingUser === item.name}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                          >
                            {importingUser === item.name
                              ? "Importando..."
                              : "Importar cliente"}
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="p-3">{item.address || "-"}</td>

                    <td className="p-3">{item.caller_id || "-"}</td>

                    <td className="p-3">{item.interface || "No detectada"}</td>

                    <td className="p-3">
                      <span className="rounded-lg bg-blue-50 px-3 py-1 font-bold text-blue-600">
                        {Number(item.rx_mbps || 0).toFixed(2)}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className="rounded-lg bg-green-50 px-3 py-1 font-bold text-green-600">
                        {Number(item.tx_mbps || 0).toFixed(2)}
                      </span>
                    </td>

                    <td className="p-3">{formatBytes(item.rx_bytes)}</td>

                    <td className="p-3">{formatBytes(item.tx_bytes)}</td>

                    <td className="p-3">{item.uptime || "-"}</td>
                  </tr>
                );
              })}

              {filteredTraffic.length === 0 && (
                <tr>
                  <td colSpan="11" className="p-8 text-center text-slate-400">
                    No hay clientes con tráfico para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5 shadow-sm">
      {title && (
        <h3 className="mb-4 text-xl font-bold text-slate-950">{title}</h3>
      )}

      {children}
    </div>
  );
}

export default ClientTraffic;