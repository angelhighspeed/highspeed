import { useState } from "react";

const NODE_TYPES = {
  olt: { label: "OLT / Rack", icon: "🏢", color: "#2563eb" },
  nap: { label: "Caja NAP", icon: "📦", color: "#16a34a" },
  splitter: { label: "Splitter", icon: "🔀", color: "#7c3aed" },
  mufa: { label: "Mufa / Empalme", icon: "🧬", color: "#f97316" },
  client: { label: "Cliente", icon: "🏠", color: "#0ea5e9" },
};

const FIBER_COLORS = [
  "#008000",
  "#ffff00",
  "#ffffff",
  "#0000ff",
  "#ff0000",
  "#ff66ff",
  "#8b3f3f",
  "#ffb6c1",
  "#111111",
  "#888888",
  "#ffa500",
  "#00d5ff",
];

const INITIAL_NODES = [
  {
    id: "olt-01",
    type: "olt",
    name: "OLT-01",
    x: 100,
    y: 160,
    splitter: "",
    ports_total: 8,
    ports_used: 2,
    power_in: "+3.2",
    power_out: "+3.2",
  },
  {
    id: "nap-01",
    type: "nap",
    name: "NAP-01",
    x: 390,
    y: 300,
    splitter: "1:8",
    ports_total: 8,
    ports_used: 5,
    power_in: "-18.2",
    power_out: "-19.8",
  },
  {
    id: "nap-02",
    type: "nap",
    name: "NAP-02",
    x: 690,
    y: 240,
    splitter: "1:12",
    ports_total: 12,
    ports_used: 7,
    power_in: "-20.1",
    power_out: "-21.7",
  },
];

const INITIAL_CABLES = [
  {
    id: "cab-01",
    name: "Troncal 48F",
    type: "trunk",
    from: "olt-01",
    to: "nap-01",
    fibers: 48,
    color: "#2563eb",
    loss_db: 2.8,
  },
  {
    id: "cab-02",
    name: "Distribución 24F",
    type: "distribution",
    from: "nap-01",
    to: "nap-02",
    fibers: 24,
    color: "#16a34a",
    loss_db: 4.3,
  },
];

function FTTHManager() {
  const [nodes, setNodes] = useState(loadLocal("hs_ftth_recovery_nodes", INITIAL_NODES));
  const [cables, setCables] = useState(loadLocal("hs_ftth_recovery_cables", INITIAL_CABLES));
  const [selectedNodeId, setSelectedNodeId] = useState("nap-01");
  const [selectedCableId, setSelectedCableId] = useState("");
  const [insideNodeId, setInsideNodeId] = useState("");
  const [tool, setTool] = useState("select");
  const [dragNodeId, setDragNodeId] = useState("");

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedCable = cables.find((cable) => cable.id === selectedCableId);
  const insideNode = nodes.find((node) => node.id === insideNodeId);

  const saveAll = (nextNodes = nodes, nextCables = cables) => {
    localStorage.setItem("hs_ftth_recovery_nodes", JSON.stringify(nextNodes));
    localStorage.setItem("hs_ftth_recovery_cables", JSON.stringify(nextCables));
  };

  const getNode = (id) => nodes.find((node) => node.id === id);

  const addNode = () => {
    const name = prompt("Nombre de la nueva NAP:", `NAP-${nodes.length + 1}`);
    if (!name) return;

    const splitter = prompt("Splitter. Ej: 1:8, 1:16, 1:32", "1:8") || "1:8";
    const portsTotal = getSplitterPorts(splitter);

    const nextNode = {
      id: `node-${Date.now()}`,
      type: "nap",
      name,
      x: 240 + Math.round(Math.random() * 520),
      y: 160 + Math.round(Math.random() * 310),
      splitter,
      ports_total: portsTotal,
      ports_used: 0,
      power_in: "",
      power_out: "",
    };

    const nextNodes = [...nodes, nextNode];
    setNodes(nextNodes);
    setSelectedNodeId(nextNode.id);
    setSelectedCableId("");
    saveAll(nextNodes, cables);
  };

  const addCable = () => {
    if (nodes.length < 2) {
      alert("Necesitás al menos dos puntos.");
      return;
    }

    const list = nodes.map((node) => `${node.id} = ${node.name}`).join("\n");
    const from = prompt(`Origen:\n${list}`, nodes[0].id);
    if (!nodes.some((node) => node.id === from)) return alert("Origen inválido.");

    const to = prompt(`Destino:\n${list}`, nodes[1]?.id || nodes[0].id);
    if (!nodes.some((node) => node.id === to)) return alert("Destino inválido.");
    if (from === to) return alert("Origen y destino no pueden ser iguales.");

    const name = prompt("Nombre del cable:", `Cable ${cables.length + 1}`) || `Cable ${cables.length + 1}`;
    const fibers = Number(prompt("Cantidad de fibras:", "12") || 12);

    const nextCable = {
      id: `cable-${Date.now()}`,
      name,
      type: "distribution",
      from,
      to,
      fibers,
      color: "#16a34a",
      loss_db: 0,
    };

    const nextCables = [...cables, nextCable];
    setCables(nextCables);
    setSelectedCableId(nextCable.id);
    setSelectedNodeId("");
    saveAll(nodes, nextCables);
  };

  const addSplitterOnCable = () => {
    if (!selectedCable) {
      alert("Seleccioná un cable primero.");
      return;
    }

    const from = getNode(selectedCable.from);
    const to = getNode(selectedCable.to);
    if (!from || !to) return;

    const name = prompt("Nombre del nuevo splitter:", `SPL-${Date.now().toString().slice(-4)}`);
    if (!name) return;

    const splitter = prompt("Splitter: 1:2, 1:4, 1:8, 1:16, 1:32", "1:8") || "1:8";
    const portsTotal = getSplitterPorts(splitter);

    const newNode = {
      id: `splitter-${Date.now()}`,
      type: "splitter",
      name,
      x: Math.round((from.x + to.x) / 2),
      y: Math.round((from.y + to.y) / 2),
      splitter,
      ports_total: portsTotal,
      ports_used: 0,
      power_in: "",
      power_out: "",
    };

    const cableA = {
      ...selectedCable,
      id: `${selectedCable.id}-A-${Date.now()}`,
      name: `${selectedCable.name} A`,
      to: newNode.id,
    };

    const cableB = {
      ...selectedCable,
      id: `${selectedCable.id}-B-${Date.now()}`,
      name: `${selectedCable.name} B`,
      from: newNode.id,
    };

    const nextNodes = [...nodes, newNode];
    const nextCables = cables.filter((cable) => cable.id !== selectedCable.id).concat([cableA, cableB]);

    setNodes(nextNodes);
    setCables(nextCables);
    setSelectedNodeId(newNode.id);
    setSelectedCableId("");
    saveAll(nextNodes, nextCables);
  };

  const cutCable = () => {
    if (!selectedCable) {
      alert("Seleccioná un cable primero.");
      return;
    }

    const nextCables = cables.map((cable) =>
      cable.id === selectedCable.id
        ? {
            ...cable,
            cut: !cable.cut,
            color: cable.cut ? "#16a34a" : "#ef4444",
          }
        : cable
    );

    setCables(nextCables);
    saveAll(nodes, nextCables);
  };

  const onMouseMove = (event) => {
    if (!dragNodeId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(event.clientX - rect.left);
    const y = Math.round(event.clientY - rect.top);

    const nextNodes = nodes.map((node) =>
      node.id === dragNodeId
        ? {
            ...node,
            x: Math.max(30, Math.min(860, x)),
            y: Math.max(30, Math.min(530, y)),
          }
        : node
    );

    setNodes(nextNodes);
  };

  const stopDrag = () => {
    if (!dragNodeId) return;
    setDragNodeId("");
    saveAll();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-bold text-slate-950">Red FTTH</h1>
        <p className="mt-2 text-slate-500">
          Versión segura para recuperar el sistema: mapa editable, NAPs, cables, splitters e interior visual.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[250px_1fr_320px]">
        <Panel title="Herramientas">
          <div className="grid grid-cols-1 gap-2">
            <ToolButton active={tool === "select"} onClick={() => setTool("select")}>Seleccionar</ToolButton>
            <ToolButton onClick={addNode}>+ Agregar NAP</ToolButton>
            <ToolButton onClick={addCable}>+ Agregar cable</ToolButton>
            <ToolButton onClick={addSplitterOnCable}>Agregar splitter en cable</ToolButton>
            <ToolButton onClick={cutCable}>{selectedCable?.cut ? "Reparar cable" : "Cortar cable"}</ToolButton>
            <ToolButton onClick={() => saveAll()}>Guardar</ToolButton>
          </div>

          <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            Arrastrá las NAPs con el mouse. Doble clic en una NAP para ver el interior.
          </div>
        </Panel>

        <Panel title="Mapa de red">
          <div
            className="relative h-[610px] overflow-hidden rounded-2xl border border-slate-200 bg-[#dff5e4]"
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            <MapRoads />

            <svg className="absolute inset-0 h-full w-full">
              {cables.map((cable) => {
                const from = getNode(cable.from);
                const to = getNode(cable.to);
                if (!from || !to) return null;

                const selected = selectedCableId === cable.id;

                return (
                  <g key={cable.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={cable.cut ? "#ef4444" : selected ? "#111827" : cable.color}
                      strokeWidth={selected ? 9 : 6}
                      strokeDasharray={cable.cut ? "12 8" : ""}
                      strokeLinecap="round"
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        setSelectedCableId(cable.id);
                        setSelectedNodeId("");
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <text
                      x={(from.x + to.x) / 2 + 8}
                      y={(from.y + to.y) / 2 - 8}
                      className="fill-slate-800 text-sm font-bold"
                    >
                      {cable.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => {
              const type = NODE_TYPES[node.type] || NODE_TYPES.nap;
              const selected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: node.x, top: node.y }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSelectedCableId("");
                    setDragNodeId(node.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setInsideNodeId(node.id);
                  }}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border-4 text-xl shadow-lg ${
                      selected ? "border-yellow-400" : "border-white"
                    }`}
                    style={{ backgroundColor: type.color }}
                  >
                    {type.icon}
                  </div>
                  <div className="mt-1 rounded-lg bg-white px-2 py-1 text-center text-xs font-bold shadow">
                    {node.name}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Inspector">
          {selectedNode && (
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">{selectedNode.name}</h2>
              <Info label="Tipo" value={NODE_TYPES[selectedNode.type]?.label || selectedNode.type} />
              <Info label="Splitter" value={selectedNode.splitter || "-"} />
              <Info label="Puertos" value={`${selectedNode.ports_used || 0}/${selectedNode.ports_total || 0}`} />
              <Info label="Potencia IN" value={`${selectedNode.power_in || "-"} dBm`} />
              <Info label="Potencia OUT" value={`${selectedNode.power_out || "-"} dBm`} />
              <SmallButton onClick={() => setInsideNodeId(selectedNode.id)}>Ver interior</SmallButton>
            </div>
          )}

          {selectedCable && (
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">{selectedCable.name}</h2>
              <Info label="Fibras" value={`${selectedCable.fibers}F`} />
              <Info label="Pérdida" value={`${selectedCable.loss_db} dB`} />
              <Info label="Estado" value={selectedCable.cut ? "Cortado" : "Activo"} />
              <SmallButton onClick={addSplitterOnCable}>Agregar splitter</SmallButton>
              <SmallButton onClick={cutCable}>{selectedCable.cut ? "Reparar cable" : "Cortar cable"}</SmallButton>
            </div>
          )}

          {!selectedNode && !selectedCable && <p className="text-slate-500">Seleccioná una NAP o cable.</p>}
        </Panel>
      </div>

      {insideNode && <InsideBox node={insideNode} close={() => setInsideNodeId("")} />}
    </div>
  );
}

function InsideBox({ node, close }) {
  const portsTotal = Math.min(getSplitterPorts(node.splitter || "1:8"), 12);
  const ports = Array.from({ length: portsTotal }, (_, index) => ({
    port: String(index + 1).padStart(2, "0"),
    used: index < Number(node.ports_used || 0),
    color: FIBER_COLORS[index % FIBER_COLORS.length],
  }));

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/60 p-3">
      <div className="flex h-full flex-col overflow-hidden rounded-xl bg-[#c9c9c9] shadow-2xl">
        <div className="flex items-center justify-between bg-[#6a9f35] px-5 py-3 text-white">
          <div>
            <h2 className="font-bold">Punto de Acceso: {node.name}</h2>
            <p className="text-xs text-white/80">Vista interna visual de caja, splitter, fusiones y fibras.</p>
          </div>
          <button onClick={close} className="rounded bg-red-500 px-3 py-1 font-bold text-white">✕</button>
        </div>

        <div className="flex items-center justify-between bg-slate-100 px-5 py-4">
          <div className="flex gap-2">
            <IconTool>◀</IconTool>
            <IconTool>✕</IconTool>
            <IconTool>🖨</IconTool>
            <IconTool>🖼</IconTool>
            <IconTool>↶</IconTool>
            <IconTool>✂</IconTool>
          </div>
          <button className="rounded bg-sky-600 px-4 py-2 text-sm font-bold text-white">Nuevo diseño 🔗</button>
        </div>

        <div className="relative flex-1 overflow-auto bg-[#c7c7c7] p-8">
          <div className="relative min-h-[720px] min-w-[1220px]">
            <svg className="absolute left-0 top-0 h-[720px] w-[1220px] overflow-visible">
              <path d="M 95 360 C 160 430 230 490 286 548" stroke="#8b8b8b" strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M 285 548 C 270 465 225 405 155 350" stroke="#087a0a" strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M 170 105 L 315 55" stroke="#6b7280" strokeWidth="2" fill="none" />
              <path d="M 170 105 L 315 235" stroke="#6b7280" strokeWidth="2" fill="none" />
              <path d="M 805 170 L 925 65" stroke="#6b7280" strokeWidth="2" fill="none" />
              <path d="M 805 170 L 925 290" stroke="#6b7280" strokeWidth="2" fill="none" />

              {ports.map((port, index) => {
                const y1 = 375 + index * 28;
                const y2 = 345 + index * 28;
                const midX = 585;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={port.port}>
                    <path
                      d={`M 292 ${y1} C 455 ${y1 - 10}, 680 ${y2 + 10}, 887 ${y2}`}
                      stroke={port.color}
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <circle cx={midX} cy={midY} r="9" fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
                    <text x={midX - 4} y={midY + 4} className="fill-slate-600 text-[11px]">✂</text>
                  </g>
                );
              })}

              <path d="M 292 345 C 450 255 655 245 895 315" stroke="#087a0a" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M 292 320 C 470 285 690 275 915 300" stroke="#7a7a7a" strokeWidth="5" fill="none" strokeLinecap="round" />
            </svg>

            <div className="absolute left-[95px] top-[310px]">
              <Tube title="asa" side="right" ports={ports} />
            </div>

            <div className="absolute left-[860px] top-[310px]">
              <Tube title="asa" side="left" ports={ports} />
            </div>

            <div className="absolute left-[760px] top-[70px]">
              <Splitter title={`${node.name}_spl`} ports={ports.slice(0, 8)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tube({ title, side, ports }) {
  return (
    <div className="relative h-[385px] w-[260px]">
      <div className="absolute left-[55px] top-0 z-10 flex w-[155px] items-center justify-between bg-[#3d3d3d] px-2 py-1 text-white">
        <span className="font-bold">{title}</span>
        <div className="flex gap-1 text-xs"><span>⇆</span><span>✥</span><span>↥</span><span className="text-red-500">🗑</span></div>
      </div>

      <div
        className={`absolute top-[28px] h-[355px] w-[230px] bg-[#68b7ce] shadow-md ${
          side === "right" ? "left-0 rounded-l-[72px]" : "right-0 rounded-r-[72px]"
        }`}
        style={{
          borderLeft: side === "right" ? "22px solid #0f172a" : undefined,
          borderRight: side === "left" ? "22px solid #0f172a" : undefined,
        }}
      >
        <div className={`absolute top-[18px] flex flex-col gap-[8px] ${side === "right" ? "right-[-17px]" : "left-[-17px]"}`}>
          {ports.map((item, index) => (
            <span key={item.port} className="rounded-md bg-slate-600 px-2 text-sm font-bold text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
          ))}
        </div>

        <div className={`absolute top-[25px] flex flex-col gap-[9px] ${side === "right" ? "left-[104px]" : "right-[104px]"}`}>
          {ports.map((item) => (
            <div key={item.port} className="flex items-center gap-2">
              <span className="rounded bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">{item.used ? "P" : "F"}</span>
              <span className="h-[18px] w-[15px] border border-slate-700 bg-white"></span>
              <span className="h-[4px] w-[4px] rounded-full bg-sky-700"></span>
            </div>
          ))}
        </div>

        <div className={`absolute top-[28px] rounded bg-sky-600 px-2 py-1 text-xs font-bold text-white ${side === "right" ? "left-[24px]" : "right-[24px]"}`}>
          0.01dB
        </div>
      </div>
    </div>
  );
}

function Splitter({ title, ports }) {
  return (
    <div className="relative w-[230px]">
      <div className="flex items-center justify-between bg-[#3d3d3d] px-2 py-1 text-white">
        <span className="font-bold">{title}</span>
        <div className="flex gap-1 text-xs"><span>✎</span><span>⇆</span><span>✥</span><span>↥</span><span className="text-red-500">🗑</span></div>
      </div>

      <div className="relative h-[285px] bg-slate-100 shadow" style={{ clipPath: "polygon(0 48%, 68% 0, 100% 0, 100% 100%, 68% 100%, 0 52%)" }}>
        <div className="absolute left-5 top-1/2 -translate-y-1/2 rounded bg-green-500 px-2 py-1 text-sm font-bold text-white">IN</div>

        <div className="absolute left-[82px] top-[40px] flex flex-col gap-[7px]">
          {ports.map((item) => <span key={item.port} className="h-[18px] w-[15px] border border-slate-700 bg-white"></span>)}
        </div>

        <div className="absolute left-[118px] top-[42px] flex flex-col gap-[9px]">
          {ports.map((item) => <span key={item.port} className="h-[4px] w-[4px] rounded-full bg-sky-500"></span>)}
        </div>

        <div className="absolute right-[-20px] top-[34px] flex flex-col gap-[8px]">
          {ports.map((item) => (
            <div key={item.port} className="flex items-center">
              <span className="rounded-md bg-sky-600 px-2 text-sm font-bold text-white">{item.port}</span>
              <div className="h-[5px] w-[36px] rounded bg-slate-500"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapRoads() {
  return (
    <svg className="absolute inset-0 h-full w-full">
      <path d="M0 140 C200 100 420 160 900 110" stroke="#94a3b8" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M0 140 C200 100 420 160 900 110" stroke="#e2e8f0" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M100 610 C300 420 520 420 920 360" stroke="#94a3b8" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M100 610 C300 420 520 420 920 360" stroke="#e2e8f0" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M180 0 C260 210 340 360 440 610" stroke="#94a3b8" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M180 0 C260 210 340 360 440 610" stroke="#e2e8f0" strokeWidth="18" fill="none" strokeLinecap="round" />
    </svg>
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

function ToolButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-sm font-bold ${
        active ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function SmallButton({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">
      {children}
    </button>
  );
}

function IconTool({ children }) {
  return <button type="button" className="rounded bg-[#0d99bd] px-3 py-2 font-bold text-white">{children}</button>;
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <b className="text-right text-slate-900">{value}</b>
    </div>
  );
}

function getSplitterPorts(splitter) {
  const match = String(splitter || "1:8").match(/1:(\d+)/);
  return match ? Number(match[1]) : 8;
}

function loadLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export default FTTHManager;
