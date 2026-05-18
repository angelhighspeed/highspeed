import { useState } from "react";

const NODE_TYPES = {
  olt: { label: "OLT / Rack", icon: "🏢", color: "#2563eb" },
  nap: { label: "Caja NAP", icon: "📦", color: "#16a34a" },
  splitter: { label: "Splitter", icon: "🔀", color: "#7c3aed" },
  mufa: { label: "Mufa / Empalme", icon: "🧬", color: "#f97316" },
  client: { label: "Cliente", icon: "🏠", color: "#0ea5e9" },
};

function FTTHManager() {
  const [selected, setSelected] = useState("nap-01");

  const nodes = [
    {
      id: "olt-01",
      type: "olt",
      name: "OLT Central",
      splitter: "-",
      ports: "8/16",
      powerIn: "+3.2 dBm",
      powerOut: "+3.2 dBm",
      status: "Activo",
    },
    {
      id: "nap-01",
      type: "nap",
      name: "NAP-01",
      splitter: "1:8",
      ports: "5/8",
      powerIn: "-18.2 dBm",
      powerOut: "-19.8 dBm",
      status: "Activo",
    },
    {
      id: "nap-02",
      type: "nap",
      name: "NAP-02",
      splitter: "1:16",
      ports: "9/16",
      powerIn: "-20.1 dBm",
      powerOut: "-21.7 dBm",
      status: "Activo",
    },
  ];

  const cables = [
    { id: "cable-01", name: "Troncal 48F", from: "OLT Central", to: "NAP-01", type: "Troncal", loss: "2.8 dB" },
    { id: "cable-02", name: "Distribución 24F", from: "NAP-01", to: "NAP-02", type: "Distribución", loss: "4.3 dB" },
  ];

  const selectedNode = nodes.find((node) => node.id === selected) || nodes[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-950">Red FTTH</h1>
          <p className="mt-2 text-slate-500">
            Módulo base estable para volver a construir mapa, cajas NAP, cables, splitters, fusiones y pérdidas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Nuevo punto</button>
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700">Nuevo cable</button>
          <button className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700">Guardar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat title="Puntos" value={nodes.length} />
        <Stat title="Cables" value={cables.length} />
        <Stat title="NAPs" value={nodes.filter((node) => node.type === "nap").length} />
        <Stat title="Puertos usados" value="14/40" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr_340px]">
        <Panel title="Herramientas">
          <div className="grid grid-cols-2 gap-2">
            <Tool>📦 NAP</Tool>
            <Tool>🏢 OLT</Tool>
            <Tool>🔀 Splitter</Tool>
            <Tool>🧬 Mufa</Tool>
            <Tool>🧵 Cable</Tool>
            <Tool>🏠 Cliente</Tool>
            <Tool>✂️ Corte</Tool>
            <Tool>📟 OTDR</Tool>
          </div>

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Esta es la base estable. Si esto abre bien, después agregamos el mapa editable y el interior de las cajas.
          </div>
        </Panel>

        <Panel title="Mapa FTTH base">
          <div className="relative h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-[#e6f6e9]">
            <svg className="absolute inset-0 h-full w-full">
              <path d="M0 120 C220 90 430 140 900 100" stroke="#94a3b8" strokeWidth="28" fill="none" strokeLinecap="round" />
              <path d="M0 120 C220 90 430 140 900 100" stroke="#e2e8f0" strokeWidth="18" fill="none" strokeLinecap="round" />

              <line x1="150" y1="170" x2="430" y2="310" stroke="#2563eb" strokeWidth="7" strokeLinecap="round" />
              <line x1="430" y1="310" x2="700" y2="230" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" />

              <text x="270" y="225" className="fill-slate-800 text-sm font-bold">Troncal 48F</text>
              <text x="545" y="260" className="fill-slate-800 text-sm font-bold">Distribución 24F</text>
            </svg>

            <MapNode node={nodes[0]} x={150} y={170} selected={selected === nodes[0].id} onClick={() => setSelected(nodes[0].id)} />
            <MapNode node={nodes[1]} x={430} y={310} selected={selected === nodes[1].id} onClick={() => setSelected(nodes[1].id)} />
            <MapNode node={nodes[2]} x={700} y={230} selected={selected === nodes[2].id} onClick={() => setSelected(nodes[2].id)} />
          </div>
        </Panel>

        <Panel title="Inspector">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl text-white"
                style={{ backgroundColor: NODE_TYPES[selectedNode.type]?.color }}
              >
                {NODE_TYPES[selectedNode.type]?.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">{selectedNode.name}</h2>
                <p className="text-sm text-slate-500">{NODE_TYPES[selectedNode.type]?.label}</p>
              </div>
            </div>

            <Info label="Estado" value={selectedNode.status} />
            <Info label="Splitter" value={selectedNode.splitter} />
            <Info label="Puertos" value={selectedNode.ports} />
            <Info label="Potencia IN" value={selectedNode.powerIn} />
            <Info label="Potencia OUT" value={selectedNode.powerOut} />

            <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">
              Ver interior de caja
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="Cables">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-3">Nombre</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Origen</th>
                <th className="p-3">Destino</th>
                <th className="p-3">Pérdida</th>
              </tr>
            </thead>
            <tbody>
              {cables.map((cable) => (
                <tr key={cable.id} className="border-b">
                  <td className="p-3 font-bold">{cable.name}</td>
                  <td className="p-3">{cable.type}</td>
                  <td className="p-3">{cable.from}</td>
                  <td className="p-3">{cable.to}</td>
                  <td className="p-3">{cable.loss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function MapNode({ node, x, y, selected, onClick }) {
  const type = NODE_TYPES[node.type] || NODE_TYPES.nap;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
      style={{ left: x, top: y }}
    >
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl border-4 text-xl shadow-lg ${
          selected ? "border-yellow-400" : "border-white"
        }`}
        style={{ backgroundColor: type.color }}
      >
        {type.icon}
      </div>
      <div className="mt-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-900 shadow">
        {node.name}
      </div>
    </button>
  );
}

function Stat({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-950">{value}</h3>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-slate-950">{title}</h2>
      {children}
    </div>
  );
}

function Tool({ children }) {
  return (
    <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
      {children}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <b className="text-right text-slate-900">{value}</b>
    </div>
  );
}

export default FTTHManager;
