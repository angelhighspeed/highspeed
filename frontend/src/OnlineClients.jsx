import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

function OnlineClients() {
  const [online, setOnline] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadOnline = async () => {
    try {
      setLoading(true);

      const [onlineRes, customersRes] = await Promise.all([
        axios.get(`${API}/mikrotik/pppoe/active`, getAuthHeaders()),
        axios.get(`${API}/customers`, getAuthHeaders()),
      ]);

      setOnline(Array.isArray(onlineRes.data) ? onlineRes.data : []);
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOnline();

    const interval = setInterval(() => {
      loadOnline();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const disconnectClient = async (name) => {
    const ok = window.confirm(`¿Desconectar sesión PPPoE de ${name}?`);
    if (!ok) return;

    await axios.delete(
      `${API}/mikrotik/pppoe/active/${encodeURIComponent(name)}`,
      getAuthHeaders()
    );

    await loadOnline();
  };

  const findCustomer = (username) => {
    return customers.find((c) => c.pppoe_username === username);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <span className="text-green-400">🟢</span>
            Clientes PPPoE Online
          </h1>

          <p className="text-slate-400 mt-2">
            Sesiones activas en MikroTik actualizadas cada 15 segundos
          </p>
        </div>

        <button
          onClick={loadOnline}
          className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-400"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <Card title="Online" value={online.length} />
        <Card title="Clientes CRM" value={customers.length} />
        <Card
          title="Vinculados"
          value={online.filter((o) => findCustomer(o.name)).length}
        />
        <Card
          title="No registrados"
          value={online.filter((o) => !findCustomer(o.name)).length}
        />
      </div>

      <Panel>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/70">
              <tr className="border-b border-white/10 text-left text-slate-300">
                <th className="p-3">Estado</th>
                <th className="p-3">Usuario PPPoE</th>
                <th className="p-3">Cliente CRM</th>
                <th className="p-3">IP Activa</th>
                <th className="p-3">MAC / Caller ID</th>
                <th className="p-3">Uptime</th>
                <th className="p-3">Servicio</th>
                <th className="p-3">Acción</th>
              </tr>
            </thead>

            <tbody>
              {online.map((item) => {
                const customer = findCustomer(item.name);

                return (
                  <tr
                    key={`${item.name}-${item.address}`}
                    className="border-b border-white/5 hover:bg-slate-800/60"
                  >
                    <td className="p-3">
                      <span className="rounded-md bg-green-500 px-3 py-1 text-xs font-bold text-white">
                        Online
                      </span>
                    </td>

                    <td className="p-3 font-bold text-cyan-300">
                      {item.name || "-"}
                    </td>

                    <td className="p-3">
                      {customer ? (
                        <span>
                          {customer.name} {customer.last_name || ""}
                        </span>
                      ) : (
                        <span className="text-orange-400">
                          No registrado
                        </span>
                      )}
                    </td>

                    <td className="p-3">{item.address || "-"}</td>

                    <td className="p-3">{item["caller-id"] || "-"}</td>

                    <td className="p-3">{item.uptime || "-"}</td>

                    <td className="p-3">{item.service || "-"}</td>

                    <td className="p-3">
                      <button
                        onClick={() => disconnectClient(item.name)}
                        className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-500"
                      >
                        Desconectar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {online.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">
                    No hay clientes PPPoE online o no se pudo conectar al MikroTik.
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

function Card({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
      <p className="text-slate-400">{title}</p>
      <h2 className="mt-3 text-4xl font-bold text-cyan-400">{value}</h2>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-5 mb-5 shadow-xl">
      {title && <h3 className="mb-4 text-xl font-bold">{title}</h3>}
      {children}
    </div>
  );
}

export default OnlineClients;