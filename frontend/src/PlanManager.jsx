import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

const emptyPlan = {
  name: "",
  price: "",
  speed: "",

  profile: "",
  download_speed: "",
  upload_speed: "",
  address_list: "",
  dhcpv6_pd_pool: "",
  internal_code: "",
  description: "",
  late_fee: 0,

  reuse: "1:1",
  use_rules: true,

  limit_upload: "0",
  limit_download: "0",

  burst_limit_upload: "0",
  burst_limit_download: "0",

  burst_threshold_upload: "0",
  burst_threshold_download: "0",

  burst_time_upload: "10",
  burst_time_download: "10",

  queue_type_upload: "default-small",
  queue_type_download: "default-small",

  parent: "none",
  priority_download: "8",

  plan_type: "pppoe",
};

function PlanManager() {
  const [plans, setPlans] = useState([]);
  const [mode, setMode] = useState("list");
  const [tab, setTab] = useState("basic");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyPlan);
  const [editingId, setEditingId] = useState(null);
  const [scriptResult, setScriptResult] = useState(null);

  const loadPlans = async () => {
    const res = await axios.get(`${API}/plans`, getAuthHeaders());
    setPlans(res.data);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const filteredPlans = plans.filter((p) => {
    const text = `
      ${p.id || ""}
      ${p.name || ""}
      ${p.speed || ""}
      ${p.profile || ""}
      ${p.download_speed || ""}
      ${p.upload_speed || ""}
      ${p.price || ""}
      ${p.plan_type || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const newPlan = () => {
    setForm(emptyPlan);
    setEditingId(null);
    setScriptResult(null);
    setTab("basic");
    setMode("create");
  };

  const editPlan = (plan) => {
    setForm({
      ...emptyPlan,
      ...plan,
      price: plan.price ?? "",
      late_fee: plan.late_fee ?? 0,
    });

    setEditingId(plan.id);
    setScriptResult(null);
    setTab("basic");
    setMode("edit");
  };

  const savePlan = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      price: Number(form.price || 0),
      late_fee: Number(form.late_fee || 0),
      use_rules: Boolean(form.use_rules),
    };

    if (editingId) {
      await axios.put(`${API}/plans/${editingId}`, payload, getAuthHeaders());
    } else {
      await axios.post(`${API}/plans`, payload, getAuthHeaders());
    }

    setForm(emptyPlan);
    setEditingId(null);
    setMode("list");
    await loadPlans();
  };

  const deletePlan = async (id) => {
    const ok = window.confirm("¿Seguro que querés eliminar este plan?");
    if (!ok) return;

    await axios.delete(`${API}/plans/${id}`, getAuthHeaders());
    await loadPlans();
  };

  const exportRules = async (id) => {
    const res = await axios.get(
      `${API}/plans/${id}/mikrotik-rules`,
      getAuthHeaders()
    );

    setScriptResult(res.data);
  };

  return (
    <div>
      {mode === "list" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <span className="text-green-400">📡</span>
                Lista Plan de Internet
              </h1>
              <p className="text-slate-400 mt-2">
                Planes PPPoE, perfiles, velocidades, burst y reglas MikroTik
              </p>
            </div>

            <button
              onClick={newPlan}
              className="rounded-xl bg-green-500 px-5 py-3 font-bold text-slate-950 hover:bg-green-400"
            >
              + Agregar Plan
            </button>
          </div>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <ButtonGreen>Mostrar 10 registros</ButtonGreen>
                <IconButton>📋</IconButton>
                <IconButton>📄</IconButton>
                <IconButton>📊</IconButton>
                <ButtonGreen>▦ Tabla</ButtonGreen>
              </div>

              <label className="flex items-center gap-2 font-bold">
                Buscar:
                <input
                  className="input-dark w-72"
                  placeholder="Buscar plan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
          </Panel>

          <Panel>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/70">
                  <tr className="border-b border-white/10 text-left text-slate-300">
                    <th className="p-3">ID</th>
                    <th className="p-3">Nombre Plan</th>
                    <th className="p-3">Perfil</th>
                    <th className="p-3">Descarga</th>
                    <th className="p-3">Subida</th>
                    <th className="p-3">Precio</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPlans.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-white/5 hover:bg-slate-800/60"
                    >
                      <td className="p-3">{p.id}</td>

                      <td className="p-3 font-bold text-cyan-300">
                        {p.name}
                      </td>

                      <td className="p-3">{p.profile || "-"}</td>

                      <td className="p-3">
                        {p.download_speed || p.speed || "-"}
                      </td>

                      <td className="p-3">
                        {p.upload_speed || p.speed || "-"}
                      </td>

                      <td className="p-3">${p.price}</td>

                      <td className="p-3 uppercase">
                        {p.plan_type || "pppoe"}
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => editPlan(p)}
                            className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-slate-950 hover:bg-yellow-400"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => exportRules(p.id)}
                            className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white hover:bg-blue-500"
                          >
                            Reglas
                          </button>

                          <button
                            onClick={() => deletePlan(p.id)}
                            className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-500"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredPlans.length === 0 && (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        No hay planes para mostrar
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {scriptResult && (
            <Panel title="Script MikroTik">
              <p className="text-slate-400 mb-3">
                Plan: {scriptResult.plan} | Perfil: {scriptResult.profile}
              </p>

              <pre className="rounded-xl bg-slate-950 p-4 text-sm overflow-auto">
                {scriptResult.script}
              </pre>
            </Panel>
          )}
        </>
      )}

      {(mode === "create" || mode === "edit") && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold">
                {mode === "edit" ? "Editar Plan" : "Agregar Plan PPPoE"}
              </h1>
              <p className="text-slate-400 mt-2">
                Configuración completa de velocidad, burst, queue y perfil
              </p>
            </div>

            <button
              onClick={() => setMode("list")}
              className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600"
            >
              Volver
            </button>
          </div>

          <form onSubmit={savePlan}>
            <div className="flex flex-wrap gap-2 mb-6">
              <TabButton
                label="Configuración Básica"
                active={tab === "basic"}
                onClick={() => setTab("basic")}
              />

              <TabButton
                label="Configuración Avanzada"
                active={tab === "advanced"}
                onClick={() => setTab("advanced")}
              />

              <TabButton
                label="Burst / Queue"
                active={tab === "burst"}
                onClick={() => setTab("burst")}
              />
            </div>

            {tab === "basic" && (
              <Panel title="Configuración Básica del Plan">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nombre Plan"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />

                  <Input
                    label="Precio"
                    type="number"
                    value={form.price}
                    onChange={(e) => handleChange("price", e.target.value)}
                  />

                  <Input
                    label="Velocidad visible"
                    placeholder="Ej: 100M"
                    value={form.speed}
                    onChange={(e) => handleChange("speed", e.target.value)}
                  />

                  <Input
                    label="Profile PPPoE"
                    placeholder="Ej: Plan_100M"
                    value={form.profile}
                    onChange={(e) => handleChange("profile", e.target.value)}
                  />

                  <Input
                    label="Velocidad Descarga"
                    placeholder="Ej: 100M"
                    value={form.download_speed}
                    onChange={(e) =>
                      handleChange("download_speed", e.target.value)
                    }
                  />

                  <Input
                    label="Velocidad Subida"
                    placeholder="Ej: 20M"
                    value={form.upload_speed}
                    onChange={(e) =>
                      handleChange("upload_speed", e.target.value)
                    }
                  />

                  <Input
                    label="Address List"
                    placeholder="Ej: clientes_100M"
                    value={form.address_list}
                    onChange={(e) => handleChange("address_list", e.target.value)}
                  />

                  <Input
                    label="DHCPv6 PD Pool"
                    value={form.dhcpv6_pd_pool}
                    onChange={(e) =>
                      handleChange("dhcpv6_pd_pool", e.target.value)
                    }
                  />

                  <Input
                    label="Código interno"
                    value={form.internal_code}
                    onChange={(e) =>
                      handleChange("internal_code", e.target.value)
                    }
                  />

                  <Input
                    label="Cargo por mora"
                    type="number"
                    value={form.late_fee}
                    onChange={(e) => handleChange("late_fee", e.target.value)}
                  />
                </div>

                <div className="mt-5">
                  <label className="text-sm text-slate-400">
                    Descripción
                  </label>

                  <textarea
                    className="input-dark min-h-28 mt-2"
                    value={form.description}
                    onChange={(e) =>
                      handleChange("description", e.target.value)
                    }
                  />
                </div>
              </Panel>
            )}

            {tab === "advanced" && (
              <Panel title="Configuración Avanzada">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Tipo de Plan"
                    value={form.plan_type}
                    onChange={(e) => handleChange("plan_type", e.target.value)}
                  >
                    <option value="pppoe">PPPoE</option>
                    <option value="simple_queue">Simple Queue</option>
                    <option value="hotspot">HotSpot</option>
                    <option value="dhcp">DHCP</option>
                  </Select>

                  <Input
                    label="Reuso"
                    placeholder="Ej: 1:1, 1:4, 1:8"
                    value={form.reuse}
                    onChange={(e) => handleChange("reuse", e.target.value)}
                  />

                  <Select
                    label="Usar reglas MikroTik"
                    value={form.use_rules ? "yes" : "no"}
                    onChange={(e) =>
                      handleChange("use_rules", e.target.value === "yes")
                    }
                  >
                    <option value="yes">Sí</option>
                    <option value="no">No</option>
                  </Select>

                  <Input
                    label="Parent Queue"
                    value={form.parent}
                    onChange={(e) => handleChange("parent", e.target.value)}
                  />

                  <Input
                    label="Prioridad Descarga"
                    value={form.priority_download}
                    onChange={(e) =>
                      handleChange("priority_download", e.target.value)
                    }
                  />
                </div>
              </Panel>
            )}

            {tab === "burst" && (
              <Panel title="Burst / Queue">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Limit Upload"
                    value={form.limit_upload}
                    onChange={(e) => handleChange("limit_upload", e.target.value)}
                  />

                  <Input
                    label="Limit Download"
                    value={form.limit_download}
                    onChange={(e) =>
                      handleChange("limit_download", e.target.value)
                    }
                  />

                  <Input
                    label="Burst Limit Upload"
                    value={form.burst_limit_upload}
                    onChange={(e) =>
                      handleChange("burst_limit_upload", e.target.value)
                    }
                  />

                  <Input
                    label="Burst Limit Download"
                    value={form.burst_limit_download}
                    onChange={(e) =>
                      handleChange("burst_limit_download", e.target.value)
                    }
                  />

                  <Input
                    label="Burst Threshold Upload"
                    value={form.burst_threshold_upload}
                    onChange={(e) =>
                      handleChange("burst_threshold_upload", e.target.value)
                    }
                  />

                  <Input
                    label="Burst Threshold Download"
                    value={form.burst_threshold_download}
                    onChange={(e) =>
                      handleChange("burst_threshold_download", e.target.value)
                    }
                  />

                  <Input
                    label="Burst Time Upload"
                    value={form.burst_time_upload}
                    onChange={(e) =>
                      handleChange("burst_time_upload", e.target.value)
                    }
                  />

                  <Input
                    label="Burst Time Download"
                    value={form.burst_time_download}
                    onChange={(e) =>
                      handleChange("burst_time_download", e.target.value)
                    }
                  />

                  <Input
                    label="Queue Type Upload"
                    value={form.queue_type_upload}
                    onChange={(e) =>
                      handleChange("queue_type_upload", e.target.value)
                    }
                  />

                  <Input
                    label="Queue Type Download"
                    value={form.queue_type_download}
                    onChange={(e) =>
                      handleChange("queue_type_download", e.target.value)
                    }
                  />
                </div>
              </Panel>
            )}

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setMode("list")}
                className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600"
              >
                Cancelar
              </button>

              <button className="rounded-xl bg-green-500 px-5 py-3 font-bold text-slate-950 hover:bg-green-400">
                {mode === "edit" ? "Guardar cambios" : "Guardar plan"}
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
    <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-5 mb-5 shadow-xl">
      {title && <h3 className="mb-4 text-xl font-bold">{title}</h3>}
      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="text-sm text-slate-400">{label}</label>}
      <input {...props} className="input-dark mt-2" />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="text-sm text-slate-400">{label}</label>}
      <select {...props} className="input-dark mt-2">
        {children}
      </select>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-3 font-bold transition ${
        active
          ? "bg-cyan-500 text-slate-950"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function ButtonGreen({ children }) {
  return (
    <button className="rounded-lg bg-green-600 px-4 py-2 font-bold hover:bg-green-500">
      {children}
    </button>
  );
}

function IconButton({ children }) {
  return (
    <button className="rounded-lg bg-green-600 px-3 py-2 font-bold hover:bg-green-500">
      {children}
    </button>
  );
}

export default PlanManager;