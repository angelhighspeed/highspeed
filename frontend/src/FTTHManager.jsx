import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "highspeed_ftth_v4";

const NODE_TYPES = {
  olt: { label: "OLT / Rack", icon: "🏢", color: "#2563eb" },
  nap: { label: "Caja NAP", icon: "📦", color: "#16a34a" },
  splitter: { label: "Splitter", icon: "🔀", color: "#7c3aed" },
  mufa: { label: "Mufa / Empalme", icon: "🧬", color: "#f97316" },
  client: { label: "Cliente", icon: "🏠", color: "#0ea5e9" },
};

const CABLE_TYPES = {
  trunk: { label: "Troncal", color: "#2563eb", width: 7 },
  distribution: { label: "Distribución", color: "#16a34a", width: 6 },
  drop: { label: "Drop", color: "#f59e0b", width: 4 },
  reserve: { label: "Reserva", color: "#94a3b8", width: 4, dash: "10 8" },
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
    name: "OLT Central",
    x: 140,
    y: 220,
    splitter: "",
    ports_total: 16,
    ports_used: 8,
    power_in: "+3.2",
    power_out: "+3.2",
    address: "Central",
    status: "active",
  },
  {
    id: "nap-01",
    type: "nap",
    name: "NAP-01",
    x: 450,
    y: 330,
    splitter: "1:8",
    ports_total: 8,
    ports_used: 5,
    power_in: "-18.2",
    power_out: "-19.8",
    address: "Sector norte",
    status: "active",
  },
  {
    id: "nap-02",
    type: "nap",
    name: "NAP-02",
    x: 760,
    y: 230,
    splitter: "1:16",
    ports_total: 16,
    ports_used: 9,
    power_in: "-20.1",
    power_out: "-21.7",
    address: "Sector este",
    status: "active",
  },
];

const INITIAL_CABLES = [
  {
    id: "cable-01",
    name: "Troncal 48F",
    type: "trunk",
    from: "olt-01",
    to: "nap-01",
    fibers: 48,
    distance_m: 620,
    loss_db: 2.8,
    status: "active",
  },
  {
    id: "cable-02",
    name: "Distribución 24F",
    type: "distribution",
    from: "nap-01",
    to: "nap-02",
    fibers: 24,
    distance_m: 480,
    loss_db: 4.3,
    status: "active",
  },
];

const INITIAL_SPLICES = [
  {
    id: "splice-01",
    node_id: "nap-01",
    cable_in: "cable-01",
    fiber_in: "Azul 1",
    cable_out: "cable-02",
    fiber_out: "Azul 1",
    loss_db: 0.04,
    notes: "Fusión principal",
  },
];

const INITIAL_PORT_CONNECTIONS = [
  {
    id: "conn-01",
    node_id: "nap-01",
    from_port: "IN",
    to_port: "01",
    fiber: "Azul 1",
    color: "#008000",
    loss_db: 0.01,
    notes: "Entrada hacia splitter",
  },
  {
    id: "conn-02",
    node_id: "nap-01",
    from_port: "01",
    to_port: "02",
    fiber: "Amarillo 2",
    color: "#ffff00",
    loss_db: 0.04,
    notes: "Fusión puerto 01 a 02",
  },
];

function FTTHManager() {
  const mapRef = useRef(null);
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [cables, setCables] = useState(INITIAL_CABLES);
  const [splices, setSplices] = useState(INITIAL_SPLICES);
  const [portConnections, setPortConnections] = useState(INITIAL_PORT_CONNECTIONS);
  const [selectedNodeId, setSelectedNodeId] = useState("nap-01");
  const [selectedCableId, setSelectedCableId] = useState("");
  const [insideNodeId, setInsideNodeId] = useState("");
  const [dragNodeId, setDragNodeId] = useState("");
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [showCableForm, setShowCableForm] = useState(false);
  const [nodeForm, setNodeForm] = useState(emptyNodeForm());
  const [cableForm, setCableForm] = useState(emptyCableForm());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      if (Array.isArray(data.nodes)) setNodes(data.nodes);
      if (Array.isArray(data.cables)) setCables(data.cables);
      if (Array.isArray(data.splices)) setSplices(data.splices);
      if (Array.isArray(data.port_connections)) setPortConnections(data.port_connections);
      if (data.nodes?.[0]?.id) setSelectedNodeId(data.nodes[0].id);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedCable = cables.find((cable) => cable.id === selectedCableId);
  const insideNode = nodes.find((node) => node.id === insideNodeId);

  const stats = useMemo(() => {
    const totalPorts = nodes.reduce((sum, node) => sum + Number(node.ports_total || 0), 0);
    const usedPorts = nodes.reduce((sum, node) => sum + Number(node.ports_used || 0), 0);
    const meters = cables.reduce((sum, cable) => sum + Number(cable.distance_m || 0), 0);

    return {
      points: nodes.length,
      cables: cables.length,
      naps: nodes.filter((node) => node.type === "nap").length,
      clients: nodes.filter((node) => node.type === "client").length,
      freePorts: Math.max(totalPorts - usedPorts, 0),
      km: (meters / 1000).toFixed(2),
      splices: splices.length,
      connections: portConnections.length,
    };
  }, [nodes, cables, splices, portConnections]);

  const saveNetwork = (
    nextNodes = nodes,
    nextCables = cables,
    nextSplices = splices,
    nextPortConnections = portConnections
  ) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes: nextNodes,
        cables: nextCables,
        splices: nextSplices,
        port_connections: nextPortConnections,
        updated_at: new Date().toISOString(),
      })
    );
  };

  const nodeById = (id) => nodes.find((node) => node.id === id);

  const handleMouseMove = (event) => {
    if (!dragNodeId || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.round(event.clientX - rect.left);
    const y = Math.round(event.clientY - rect.top);

    setNodes((prev) =>
      prev.map((node) =>
        node.id === dragNodeId
          ? {
              ...node,
              x: Math.max(40, Math.min(rect.width - 40, x)),
              y: Math.max(40, Math.min(rect.height - 40, y)),
            }
          : node
      )
    );
  };

  const stopDrag = () => {
    if (!dragNodeId) return;
    setDragNodeId("");
    setTimeout(() => saveNetwork(), 0);
  };

  const resetDemo = () => {
    if (!window.confirm("¿Restaurar la red demo? Se reemplaza lo guardado localmente.")) return;
    setNodes(INITIAL_NODES);
    setCables(INITIAL_CABLES);
    setSplices(INITIAL_SPLICES);
    setPortConnections(INITIAL_PORT_CONNECTIONS);
    setSelectedNodeId("nap-01");
    setSelectedCableId("");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes: INITIAL_NODES,
        cables: INITIAL_CABLES,
        splices: INITIAL_SPLICES,
        port_connections: INITIAL_PORT_CONNECTIONS,
        updated_at: new Date().toISOString(),
      })
    );
  };

  const startCreateNode = () => {
    const centerX = mapRef.current?.clientWidth ? Math.round(mapRef.current.clientWidth / 2) : 500;
    const centerY = mapRef.current?.clientHeight ? Math.round(mapRef.current.clientHeight / 2) : 300;

    setNodeForm({
      ...emptyNodeForm(),
      x: centerX,
      y: centerY,
    });
    setShowNodeForm(true);
    setShowCableForm(false);
  };

  const createNode = (event) => {
    event.preventDefault();

    if (!nodeForm.name.trim()) {
      alert("Ingresá el nombre del punto.");
      return;
    }

    const splitter = nodeForm.splitter || "";
    const portsTotal = Number(nodeForm.ports_total || getSplitterPorts(splitter) || 0);

    const nextNode = {
      ...nodeForm,
      id: `${nodeForm.type}-${Date.now()}`,
      x: Number(nodeForm.x || 500),
      y: Number(nodeForm.y || 300),
      ports_total: portsTotal,
      ports_used: Number(nodeForm.ports_used || 0),
    };

    const nextNodes = [...nodes, nextNode];

    setNodes(nextNodes);
    setSelectedNodeId(nextNode.id);
    setSelectedCableId("");
    setShowNodeForm(false);
    setNodeForm(emptyNodeForm());
    saveNetwork(nextNodes, cables, splices);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    if (!window.confirm(`¿Eliminar ${selectedNode.name}? También se eliminan sus cables y fusiones.`)) return;

    const nextNodes = nodes.filter((node) => node.id !== selectedNode.id);
    const nextCables = cables.filter((cable) => cable.from !== selectedNode.id && cable.to !== selectedNode.id);
    const nextSplices = splices.filter((splice) => splice.node_id !== selectedNode.id);
    const nextPortConnections = portConnections.filter((connection) => connection.node_id !== selectedNode.id);

    setNodes(nextNodes);
    setCables(nextCables);
    setSplices(nextSplices);
    setPortConnections(nextPortConnections);
    setSelectedNodeId(nextNodes[0]?.id || "");
    setSelectedCableId("");
    saveNetwork(nextNodes, nextCables, nextSplices, nextPortConnections);
  };

  const startCreateCable = () => {
    setCableForm({
      ...emptyCableForm(),
      from: nodes[0]?.id || "",
      to: nodes[1]?.id || "",
    });
    setShowCableForm(true);
    setShowNodeForm(false);
  };

  const createCable = (event) => {
    event.preventDefault();

    if (!cableForm.name.trim()) {
      alert("Ingresá el nombre del cable.");
      return;
    }

    if (!cableForm.from || !cableForm.to) {
      alert("Seleccioná origen y destino.");
      return;
    }

    if (cableForm.from === cableForm.to) {
      alert("Origen y destino no pueden ser iguales.");
      return;
    }

    const nextCable = {
      ...cableForm,
      id: `cable-${Date.now()}`,
      fibers: Number(cableForm.fibers || 0),
      distance_m: Number(cableForm.distance_m || 0),
      loss_db: Number(cableForm.loss_db || 0),
      status: "active",
    };

    const nextCables = [...cables, nextCable];

    setCables(nextCables);
    setSelectedCableId(nextCable.id);
    setSelectedNodeId("");
    setShowCableForm(false);
    setCableForm(emptyCableForm());
    saveNetwork(nodes, nextCables, splices);
  };

  const deleteSelectedCable = () => {
    if (!selectedCable) return;
    if (!window.confirm(`¿Eliminar cable ${selectedCable.name}?`)) return;

    const nextCables = cables.filter((cable) => cable.id !== selectedCable.id);
    const nextSplices = splices.filter((splice) => splice.cable_in !== selectedCable.id && splice.cable_out !== selectedCable.id);

    setCables(nextCables);
    setSplices(nextSplices);
    setSelectedCableId("");
    saveNetwork(nodes, nextCables, nextSplices);
  };

  const toggleCableCut = () => {
    if (!selectedCable) return;

    const nextCables = cables.map((cable) =>
      cable.id === selectedCable.id
        ? {
            ...cable,
            status: cable.status === "cut" ? "active" : "cut",
          }
        : cable
    );

    setCables(nextCables);
    saveNetwork(nodes, nextCables, splices);
  };

  const addSplitterOnCable = () => {
    if (!selectedCable) {
      alert("Seleccioná un cable primero.");
      return;
    }

    const fromNode = nodeById(selectedCable.from);
    const toNode = nodeById(selectedCable.to);

    if (!fromNode || !toNode) return;

    const splitterName = window.prompt("Nombre del nuevo splitter:", `SPL-${Date.now().toString().slice(-4)}`);
    if (!splitterName) return;

    const splitter = window.prompt("Tipo de splitter: 1:2, 1:4, 1:8, 1:16, 1:32", "1:8") || "1:8";
    const portsTotal = getSplitterPorts(splitter);

    const newNode = {
      id: `splitter-${Date.now()}`,
      type: "splitter",
      name: splitterName,
      x: Math.round((Number(fromNode.x) + Number(toNode.x)) / 2),
      y: Math.round((Number(fromNode.y) + Number(toNode.y)) / 2),
      splitter,
      ports_total: portsTotal,
      ports_used: 0,
      power_in: "",
      power_out: "",
      address: `Sobre ${selectedCable.name}`,
      status: "active",
    };

    const distanceHalf = Math.round(Number(selectedCable.distance_m || 0) / 2);
    const lossHalf = Number((Number(selectedCable.loss_db || 0) / 2).toFixed(2));

    const cableA = {
      ...selectedCable,
      id: `${selectedCable.id}-a-${Date.now()}`,
      name: `${selectedCable.name} A`,
      to: newNode.id,
      distance_m: distanceHalf,
      loss_db: lossHalf,
    };

    const cableB = {
      ...selectedCable,
      id: `${selectedCable.id}-b-${Date.now()}`,
      name: `${selectedCable.name} B`,
      from: newNode.id,
      distance_m: distanceHalf,
      loss_db: lossHalf,
    };

    const nextNodes = [...nodes, newNode];
    const nextCables = cables.filter((cable) => cable.id !== selectedCable.id).concat([cableA, cableB]);

    setNodes(nextNodes);
    setCables(nextCables);
    setSelectedNodeId(newNode.id);
    setSelectedCableId("");
    saveNetwork(nextNodes, nextCables, splices);
  };

  const saveSplicesFromModal = (nextSplices) => {
    setSplices(nextSplices);
    saveNetwork(nodes, cables, nextSplices, portConnections);
  };

  const savePortConnectionsFromModal = (nextPortConnections) => {
    setPortConnections(nextPortConnections);
    saveNetwork(nodes, cables, splices, nextPortConnections);
  };

  const updateNodeFromModal = (updatedNode) => {
    const nextNodes = nodes.map((node) => (node.id === updatedNode.id ? updatedNode : node));

    setNodes(nextNodes);
    saveNetwork(nextNodes, cables, splices, portConnections);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-950">Red FTTH</h1>
          <p className="mt-2 text-slate-500">
            Mapa editable: NAPs movibles, cables, splitters sobre cable, interior de caja y fusiones básicas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <TopButton onClick={startCreateNode}>+ Punto</TopButton>
          <TopButton onClick={startCreateCable}>+ Cable</TopButton>
          <TopButton onClick={() => saveNetwork()}>Guardar</TopButton>
          <TopButton onClick={resetDemo}>Reset demo</TopButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
        <Stat title="Puntos" value={stats.points} />
        <Stat title="Cables" value={stats.cables} />
        <Stat title="NAPs" value={stats.naps} />
        <Stat title="Clientes" value={stats.clients} />
        <Stat title="Puertos libres" value={stats.freePorts} />
        <Stat title="Fusiones" value={stats.splices} />
        <Stat title="Uniones" value={stats.connections} />
        <Stat title="Cable" value={`${stats.km} km`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr_340px]">
        <Panel title="Herramientas">
          <div className="grid grid-cols-2 gap-2">
            <ToolButton onClick={startCreateNode}>📦 NAP</ToolButton>
            <ToolButton onClick={startCreateNode}>🏢 OLT</ToolButton>
            <ToolButton onClick={startCreateNode}>🔀 Splitter</ToolButton>
            <ToolButton onClick={startCreateNode}>🧬 Mufa</ToolButton>
            <ToolButton onClick={startCreateCable}>🧵 Cable</ToolButton>
            <ToolButton onClick={addSplitterOnCable}>➕ Splitter en cable</ToolButton>
            <ToolButton onClick={toggleCableCut}>✂️ Cortar/reparar</ToolButton>
            <ToolButton onClick={() => alert("OTDR lo agregamos en el próximo paso.")}>📟 OTDR</ToolButton>
          </div>

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Entrá a una NAP con “Ver interior” para cargar fusiones entre cables y ver puertos.
          </div>

          <div className="mt-5 space-y-2 text-sm">
            {Object.entries(CABLE_TYPES).map(([key, cableType]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="h-1.5 w-10 rounded" style={{ backgroundColor: cableType.color }}></span>
                <span>{cableType.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Mapa FTTH editable">
          <div
            ref={mapRef}
            className="relative h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-[#e6f6e9]"
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            <MapRoads />

            <svg className="absolute inset-0 h-full w-full">
              {cables.map((cable) => {
                const from = nodeById(cable.from);
                const to = nodeById(cable.to);

                if (!from || !to) return null;

                const type = CABLE_TYPES[cable.type] || CABLE_TYPES.distribution;
                const selected = selectedCableId === cable.id;
                const isCut = cable.status === "cut";

                return (
                  <g key={cable.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={isCut ? "#ef4444" : selected ? "#111827" : type.color}
                      strokeWidth={selected ? type.width + 3 : type.width}
                      strokeDasharray={isCut ? "12 8" : type.dash || ""}
                      strokeLinecap="round"
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        setSelectedCableId(cable.id);
                        setSelectedNodeId("");
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <text
                      x={(Number(from.x) + Number(to.x)) / 2 + 8}
                      y={(Number(from.y) + Number(to.y)) / 2 - 8}
                      className="fill-slate-800 text-sm font-bold"
                    >
                      {cable.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {nodes.map((node) => (
              <MapNode
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setSelectedNodeId(node.id);
                  setSelectedCableId("");
                  setDragNodeId(node.id);
                }}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Inspector">
          {selectedNode && (
            <div className="space-y-4">
              <NodeHeader node={selectedNode} />
              <Info label="Estado" value={selectedNode.status || "active"} />
              <Info label="Dirección" value={selectedNode.address || "-"} />
              <Info label="Splitter" value={selectedNode.splitter || "-"} />
              <Info label="Puertos" value={`${selectedNode.ports_used || 0}/${selectedNode.ports_total || 0}`} />
              <Info label="Potencia IN" value={`${selectedNode.power_in || "-"} dBm`} />
              <Info label="Potencia OUT" value={`${selectedNode.power_out || "-"} dBm`} />
              <Info label="Posición" value={`X ${selectedNode.x} / Y ${selectedNode.y}`} />

              <div className="grid grid-cols-2 gap-2">
                <SmallButton onClick={() => setInsideNodeId(selectedNode.id)}>
                  Ver interior
                </SmallButton>
                <SmallButton danger onClick={deleteSelectedNode}>
                  Eliminar
                </SmallButton>
              </div>

              <Section title="Cables conectados">
                {cables
                  .filter((cable) => cable.from === selectedNode.id || cable.to === selectedNode.id)
                  .map((cable) => (
                    <button
                      key={cable.id}
                      type="button"
                      onClick={() => {
                        setSelectedCableId(cable.id);
                        setSelectedNodeId("");
                      }}
                      className="mb-2 w-full rounded-lg bg-slate-50 p-3 text-left text-sm hover:bg-blue-50"
                    >
                      <b>{cable.name}</b>
                      <br />
                      {CABLE_TYPES[cable.type]?.label || cable.type} · {cable.fibers}F · {cable.distance_m}m
                    </button>
                  ))}
              </Section>
            </div>
          )}

          {selectedCable && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-950">{selectedCable.name}</h2>
              <Info label="Tipo" value={CABLE_TYPES[selectedCable.type]?.label || selectedCable.type} />
              <Info label="Estado" value={selectedCable.status === "cut" ? "Cortado" : "Activo"} />
              <Info label="Origen" value={nodeById(selectedCable.from)?.name || selectedCable.from} />
              <Info label="Destino" value={nodeById(selectedCable.to)?.name || selectedCable.to} />
              <Info label="Fibras" value={`${selectedCable.fibers}F`} />
              <Info label="Distancia" value={`${selectedCable.distance_m} m`} />
              <Info label="Pérdida" value={`${selectedCable.loss_db} dB`} />

              <div className="grid grid-cols-2 gap-2">
                <SmallButton onClick={addSplitterOnCable}>Agregar splitter</SmallButton>
                <SmallButton onClick={toggleCableCut}>Cortar/reparar</SmallButton>
                <SmallButton danger onClick={deleteSelectedCable}>Eliminar</SmallButton>
              </div>
            </div>
          )}

          {!selectedNode && !selectedCable && <p className="text-slate-500">Seleccioná una NAP o cable.</p>}

          {showNodeForm && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-3 font-bold text-slate-900">Nuevo punto</h3>
              <NodeForm form={nodeForm} setForm={setNodeForm} onSubmit={createNode} onCancel={() => setShowNodeForm(false)} />
            </div>
          )}

          {showCableForm && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-3 font-bold text-slate-900">Nuevo cable</h3>
              <CableForm form={cableForm} setForm={setCableForm} nodes={nodes} onSubmit={createCable} onCancel={() => setShowCableForm(false)} />
            </div>
          )}
        </Panel>
      </div>

      {insideNode && (
        <InsideBoxModal
          node={insideNode}
          cables={cables.filter((cable) => cable.from === insideNode.id || cable.to === insideNode.id)}
          allCables={cables}
          splices={splices.filter((splice) => splice.node_id === insideNode.id)}
          allSplices={splices}
          portConnections={portConnections.filter((connection) => connection.node_id === insideNode.id)}
          allPortConnections={portConnections}
          savePortConnections={savePortConnectionsFromModal}
          saveSplices={saveSplicesFromModal}
          updateNode={updateNodeFromModal}
          close={() => setInsideNodeId("")}
        />
      )}
    </div>
  );
}

function InsideBoxModal({
  node,
  cables,
  allCables,
  splices,
  allSplices,
  portConnections,
  allPortConnections,
  savePortConnections,
  saveSplices,
  updateNode,
  close,
}) {
  const portsTotal = Math.min(Number(node.ports_total || getSplitterPorts(node.splitter || "1:8") || 8), 16);
  const portsUsed = Number(node.ports_used || 0);
  const [spliceForm, setSpliceForm] = useState({
    cable_in: cables[0]?.id || "",
    fiber_in: "",
    cable_out: cables[1]?.id || cables[0]?.id || "",
    fiber_out: "",
    loss_db: "0.04",
    notes: "",
  });
  const [connectionForm, setConnectionForm] = useState({
    from_port: "IN",
    to_port: "01",
    fiber: "",
    color: FIBER_COLORS[0],
    loss_db: "0.01",
    notes: "",
  });
  const [splitterForm, setSplitterForm] = useState({
    splitter: node.splitter || "1:8",
    ports_total: Number(node.ports_total || getSplitterPorts(node.splitter || "1:8") || 8),
    ports_used: Number(node.ports_used || 0),
    power_in: node.power_in || "",
    power_out: node.power_out || "",
  });

  const currentPortsTotal = Math.min(Number(splitterForm.ports_total || getSplitterPorts(splitterForm.splitter) || 8), 64);
  const currentPortsUsed = Math.min(Number(splitterForm.ports_used || 0), currentPortsTotal);

  const ports = Array.from({ length: currentPortsTotal }, (_, index) => ({
    port: String(index + 1).padStart(2, "0"),
    used: index < currentPortsUsed,
    color: FIBER_COLORS[index % FIBER_COLORS.length],
    power: index < currentPortsUsed ? (-19.2 - index * 0.32).toFixed(2) : "",
  }));

  const splitterLoss = getSplitterLoss(splitterForm.splitter || "1:8");
  const inputPower = Number(String(splitterForm.power_in || "").replace(",", "."));
  const outputPower = Number.isFinite(inputPower) && splitterLoss
    ? (inputPower - splitterLoss).toFixed(2)
    : splitterForm.power_out || "-";

  const addSplice = (event) => {
    event.preventDefault();

    if (!spliceForm.cable_in || !spliceForm.cable_out || !spliceForm.fiber_in || !spliceForm.fiber_out) {
      alert("Completá cable entrada/salida y fibra entrada/salida.");
      return;
    }

    const nextSplice = {
      id: `splice-${Date.now()}`,
      node_id: node.id,
      cable_in: spliceForm.cable_in,
      fiber_in: spliceForm.fiber_in,
      cable_out: spliceForm.cable_out,
      fiber_out: spliceForm.fiber_out,
      loss_db: Number(spliceForm.loss_db || 0),
      notes: spliceForm.notes || "",
    };

    saveSplices([...allSplices, nextSplice]);

    setSpliceForm({
      cable_in: cables[0]?.id || "",
      fiber_in: "",
      cable_out: cables[1]?.id || cables[0]?.id || "",
      fiber_out: "",
      loss_db: "0.04",
      notes: "",
    });
  };

  const saveSplitterConfig = (event) => {
    event.preventDefault();

    const nextPortsTotal = Number(splitterForm.ports_total || getSplitterPorts(splitterForm.splitter) || 0);
    const nextPortsUsed = Math.min(Number(splitterForm.ports_used || 0), nextPortsTotal);

    if (!splitterForm.splitter) {
      alert("Seleccioná un splitter.");
      return;
    }

    if (nextPortsTotal <= 0) {
      alert("La cantidad de puertos debe ser mayor a cero.");
      return;
    }

    updateNode({
      ...node,
      splitter: splitterForm.splitter,
      ports_total: nextPortsTotal,
      ports_used: nextPortsUsed,
      power_in: splitterForm.power_in,
      power_out: splitterForm.power_out,
    });

    alert("Splitter y puertos actualizados.");
  };

  const addPortConnection = (event) => {
    event.preventDefault();

    if (!connectionForm.from_port || !connectionForm.to_port || !connectionForm.fiber) {
      alert("Completá puerto origen, puerto destino y fibra.");
      return;
    }

    if (connectionForm.from_port === connectionForm.to_port) {
      alert("El puerto origen y destino no pueden ser iguales.");
      return;
    }

    const nextConnection = {
      id: `conn-${Date.now()}`,
      node_id: node.id,
      from_port: connectionForm.from_port,
      to_port: connectionForm.to_port,
      fiber: connectionForm.fiber,
      color: connectionForm.color || FIBER_COLORS[0],
      loss_db: Number(connectionForm.loss_db || 0),
      notes: connectionForm.notes || "",
    };

    savePortConnections([...allPortConnections, nextConnection]);

    setConnectionForm({
      from_port: "IN",
      to_port: "01",
      fiber: "",
      color: FIBER_COLORS[0],
      loss_db: "0.01",
      notes: "",
    });
  };

  const deletePortConnection = (connectionId) => {
    if (!window.confirm("¿Eliminar esta unión de fibra?")) return;
    savePortConnections(allPortConnections.filter((connection) => connection.id !== connectionId));
  };

  const deleteSplice = (spliceId) => {
    if (!window.confirm("¿Eliminar esta fusión?")) return;
    saveSplices(allSplices.filter((splice) => splice.id !== spliceId));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/60 p-3">
      <div className="flex h-full flex-col overflow-hidden rounded-xl bg-[#c9c9c9] shadow-2xl">
        <div className="flex items-center justify-between bg-[#6a9f35] px-5 py-3 text-white">
          <div>
            <h2 className="font-bold">Punto de Acceso: {node.name}</h2>
            <p className="text-xs text-white/80">
              Interior de caja: splitter, puertos, fibras visuales, cables conectados y fusiones.
            </p>
          </div>

          <button type="button" onClick={close} className="rounded bg-red-500 px-3 py-1 font-bold text-white">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <IconTool>◀</IconTool>
            <IconTool>✕</IconTool>
            <IconTool>🖨</IconTool>
            <IconTool>🖼</IconTool>
            <IconTool>↶</IconTool>
            <IconTool>✂</IconTool>
          </div>

          <div className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700">
            Splitter {splitterForm.splitter || "-"} · {currentPortsUsed}/{currentPortsTotal} puertos
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1fr_380px]">
          <div className="overflow-auto bg-[#c7c7c7] p-8">
            <div className="relative min-h-[720px] min-w-[1180px]">
              <svg className="absolute left-0 top-0 h-[720px] w-[1180px] overflow-visible">
                <path d="M 95 360 C 160 430 230 490 286 548" stroke="#8b8b8b" strokeWidth="6" fill="none" strokeLinecap="round" />
                <path d="M 285 548 C 270 465 225 405 155 350" stroke="#087a0a" strokeWidth="6" fill="none" strokeLinecap="round" />
                <path d="M 170 105 L 315 55" stroke="#6b7280" strokeWidth="2" fill="none" />
                <path d="M 170 105 L 315 235" stroke="#6b7280" strokeWidth="2" fill="none" />
                <path d="M 805 170 L 925 65" stroke="#6b7280" strokeWidth="2" fill="none" />
                <path d="M 805 170 L 925 290" stroke="#6b7280" strokeWidth="2" fill="none" />

                {ports.slice(0, 12).map((port, index) => {
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

                {portConnections.map((connection, index) => {
                  const fromY = portToY(connection.from_port, index);
                  const toY = portToY(connection.to_port, index + 2);
                  const midX = 585;
                  const midY = (fromY + toY) / 2;

                  return (
                    <g key={connection.id}>
                      <path
                        d={`M 292 ${fromY} C 455 ${fromY - 20}, 690 ${toY + 20}, 887 ${toY}`}
                        stroke={connection.color || FIBER_COLORS[index % FIBER_COLORS.length]}
                        strokeWidth="7"
                        fill="none"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      <circle cx={midX} cy={midY} r="11" fill="#fff7ed" stroke="#f97316" strokeWidth="2" />
                      <text x={midX - 4} y={midY + 4} className="fill-orange-700 text-[11px]">✂</text>
                    </g>
                  );
                })}

                <path d="M 292 345 C 450 255 655 245 895 315" stroke="#087a0a" strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M 292 320 C 470 285 690 275 915 300" stroke="#7a7a7a" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>

              <div className="absolute left-[95px] top-[310px]">
                <Tube title="Entrada" side="right" ports={ports.slice(0, 12)} />
              </div>

              <div className="absolute left-[860px] top-[310px]">
                <Tube title="Salida" side="left" ports={ports.slice(0, 12)} />
              </div>

              <div className="absolute left-[760px] top-[70px]">
                <InternalSplitter title={`${node.name}_spl`} ports={ports.slice(0, 8)} />
              </div>
            </div>
          </div>

          <div className="overflow-y-auto border-l border-slate-300 bg-white p-4">
            <Panel title="Editar splitter y puertos">
              <form onSubmit={saveSplitterConfig} className="space-y-3">
                <Select
                  value={splitterForm.splitter}
                  onChange={(event) => {
                    const splitter = event.target.value;
                    setSplitterForm({
                      ...splitterForm,
                      splitter,
                      ports_total: getSplitterPorts(splitter),
                      ports_used: Math.min(Number(splitterForm.ports_used || 0), getSplitterPorts(splitter)),
                    });
                  }}
                >
                  <option value="1:2">Splitter 1:2</option>
                  <option value="1:4">Splitter 1:4</option>
                  <option value="1:8">Splitter 1:8</option>
                  <option value="1:16">Splitter 1:16</option>
                  <option value="1:32">Splitter 1:32</option>
                  <option value="1:64">Splitter 1:64</option>
                </Select>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Puertos total"
                    value={splitterForm.ports_total}
                    onChange={(event) => setSplitterForm({ ...splitterForm, ports_total: event.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Puertos usados"
                    value={splitterForm.ports_used}
                    onChange={(event) => setSplitterForm({ ...splitterForm, ports_used: event.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Potencia IN"
                    value={splitterForm.power_in}
                    onChange={(event) => setSplitterForm({ ...splitterForm, power_in: event.target.value })}
                  />
                  <Input
                    placeholder="Potencia OUT"
                    value={splitterForm.power_out}
                    onChange={(event) => setSplitterForm({ ...splitterForm, power_out: event.target.value })}
                  />
                </div>

                <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
                  Pérdida splitter: <b>{splitterLoss || "-"} dB</b>
                  <br />
                  Salida estimada: <b>{outputPower} dBm</b>
                  <br />
                  Puertos libres: <b>{Math.max(currentPortsTotal - currentPortsUsed, 0)}</b>
                </div>

                <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">
                  Guardar splitter
                </button>
              </form>
            </Panel>

            <Panel title="Unir fibra entre puertos">
              <form onSubmit={addPortConnection} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={connectionForm.from_port} onChange={(event) => setConnectionForm({ ...connectionForm, from_port: event.target.value })}>
                    <option value="IN">IN</option>
                    {ports.map((port) => (
                      <option key={port.port} value={port.port}>Puerto {port.port}</option>
                    ))}
                  </Select>

                  <Select value={connectionForm.to_port} onChange={(event) => setConnectionForm({ ...connectionForm, to_port: event.target.value })}>
                    {ports.map((port) => (
                      <option key={port.port} value={port.port}>Puerto {port.port}</option>
                    ))}
                  </Select>
                </div>

                <Input placeholder="Fibra. Ej: Azul 1" value={connectionForm.fiber} onChange={(event) => setConnectionForm({ ...connectionForm, fiber: event.target.value })} />
                <Input type="number" step="0.01" placeholder="Pérdida dB" value={connectionForm.loss_db} onChange={(event) => setConnectionForm({ ...connectionForm, loss_db: event.target.value })} />
                <Input type="color" value={connectionForm.color} onChange={(event) => setConnectionForm({ ...connectionForm, color: event.target.value })} />
                <Input placeholder="Notas" value={connectionForm.notes} onChange={(event) => setConnectionForm({ ...connectionForm, notes: event.target.value })} />

                <button type="submit" className="w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white">
                  Unir fibra
                </button>
              </form>
            </Panel>

            <Panel title="Uniones de fibra">
              {portConnections.map((connection) => (
                <div key={connection.id} className="mb-2 rounded-xl bg-green-50 p-3 text-sm">
                  <b>{connection.from_port}</b> → <b>{connection.to_port}</b>
                  <br />
                  Fibra: {connection.fiber}
                  <br />
                  Pérdida: {connection.loss_db} dB
                  {connection.notes ? <><br />Notas: {connection.notes}</> : null}
                  <br />
                  <button type="button" onClick={() => deletePortConnection(connection.id)} className="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-bold text-white">
                    Eliminar
                  </button>
                </div>
              ))}

              {!portConnections.length && <p className="text-sm text-slate-500">Sin uniones cargadas.</p>}
            </Panel>

            <Panel title="Registrar fusión">
              <form onSubmit={addSplice} className="space-y-3">
                <Select value={spliceForm.cable_in} onChange={(event) => setSpliceForm({ ...spliceForm, cable_in: event.target.value })}>
                  <option value="">Cable entrada</option>
                  {cables.map((cable) => (
                    <option key={cable.id} value={cable.id}>{cable.name}</option>
                  ))}
                </Select>

                <Input placeholder="Fibra entrada. Ej: Azul 1" value={spliceForm.fiber_in} onChange={(event) => setSpliceForm({ ...spliceForm, fiber_in: event.target.value })} />

                <Select value={spliceForm.cable_out} onChange={(event) => setSpliceForm({ ...spliceForm, cable_out: event.target.value })}>
                  <option value="">Cable salida</option>
                  {cables.map((cable) => (
                    <option key={cable.id} value={cable.id}>{cable.name}</option>
                  ))}
                </Select>

                <Input placeholder="Fibra salida. Ej: Verde 2" value={spliceForm.fiber_out} onChange={(event) => setSpliceForm({ ...spliceForm, fiber_out: event.target.value })} />
                <Input type="number" step="0.01" placeholder="Pérdida dB" value={spliceForm.loss_db} onChange={(event) => setSpliceForm({ ...spliceForm, loss_db: event.target.value })} />
                <Input placeholder="Notas" value={spliceForm.notes} onChange={(event) => setSpliceForm({ ...spliceForm, notes: event.target.value })} />

                <button type="submit" className="w-full rounded-xl bg-purple-600 px-4 py-3 font-bold text-white">
                  Guardar fusión
                </button>
              </form>
            </Panel>

            <Panel title="Fusiones documentadas">
              {splices.map((splice) => (
                <div key={splice.id} className="mb-2 rounded-xl bg-purple-50 p-3 text-sm">
                  <b>{allCables.find((cable) => cable.id === splice.cable_in)?.name || splice.cable_in}</b>
                  <br />
                  {splice.fiber_in} → {splice.fiber_out}
                  <br />
                  <b>{allCables.find((cable) => cable.id === splice.cable_out)?.name || splice.cable_out}</b>
                  <br />
                  Pérdida: {splice.loss_db} dB
                  {splice.notes ? <><br />Notas: {splice.notes}</> : null}
                  <br />
                  <button type="button" onClick={() => deleteSplice(splice.id)} className="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-bold text-white">
                    Eliminar
                  </button>
                </div>
              ))}

              {!splices.length && <p className="text-sm text-slate-500">Sin fusiones cargadas.</p>}
            </Panel>

            <Panel title="Puertos">
              <div className="grid grid-cols-4 gap-2">
                {ports.map((port) => (
                  <div
                    key={port.port}
                    className={`rounded-lg border p-2 text-center text-xs font-bold ${
                      port.used ? "border-green-300 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    P{port.port}
                    <br />
                    {port.used ? `${port.power} dBm` : "Libre"}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function portToY(port, fallbackIndex = 0) {
  if (port === "IN") return 345;

  const number = Number(port);
  if (!Number.isFinite(number) || number <= 0) {
    return 375 + fallbackIndex * 28;
  }

  return 375 + (number - 1) * 28;
}

function Tube({ title, side, ports }) {
  return (
    <div className="relative h-[385px] w-[260px]">
      <div className="absolute left-[55px] top-0 z-10 flex w-[155px] items-center justify-between bg-[#3d3d3d] px-2 py-1 text-white">
        <span className="font-bold">{title}</span>
        <div className="flex gap-1 text-xs">
          <span>⇆</span><span>✥</span><span>↥</span><span className="text-red-500">🗑</span>
        </div>
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

function InternalSplitter({ title, ports }) {
  return (
    <div className="relative w-[230px]">
      <div className="flex items-center justify-between bg-[#3d3d3d] px-2 py-1 text-white">
        <span className="font-bold">{title}</span>
        <div className="flex gap-1 text-xs">
          <span>✎</span><span>⇆</span><span>✥</span><span>↥</span><span className="text-red-500">🗑</span>
        </div>
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

function MapNode({ node, selected, onMouseDown }) {
  const type = NODE_TYPES[node.type] || NODE_TYPES.nap;

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move text-center"
      style={{ left: node.x, top: node.y }}
      onMouseDown={onMouseDown}
    >
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl border-4 text-xl shadow-lg ${
          selected ? "border-yellow-400 ring-4 ring-yellow-200" : "border-white"
        }`}
        style={{ backgroundColor: type.color }}
      >
        {type.icon}
      </div>
      <div className="mt-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-900 shadow">
        {node.name}
      </div>
    </div>
  );
}

function MapRoads() {
  return (
    <svg className="absolute inset-0 h-full w-full">
      <path d="M0 120 C220 90 430 140 900 100" stroke="#94a3b8" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M0 120 C220 90 430 140 900 100" stroke="#e2e8f0" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M70 620 C300 420 520 420 940 360" stroke="#94a3b8" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M70 620 C300 420 520 420 940 360" stroke="#e2e8f0" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M180 0 C260 210 340 360 440 610" stroke="#94a3b8" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M180 0 C260 210 340 360 440 610" stroke="#e2e8f0" strokeWidth="18" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function NodeHeader({ node }) {
  const type = NODE_TYPES[node.type] || NODE_TYPES.nap;

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl text-white"
        style={{ backgroundColor: type.color }}
      >
        {type.icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-950">{node.name}</h2>
        <p className="text-sm text-slate-500">{type.label}</p>
      </div>
    </div>
  );
}

function NodeForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />

      <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
        {Object.entries(NODE_TYPES).map(([key, item]) => (
          <option key={key} value={key}>{item.label}</option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="X" value={form.x} onChange={(event) => setForm({ ...form, x: event.target.value })} />
        <Input type="number" placeholder="Y" value={form.y} onChange={(event) => setForm({ ...form, y: event.target.value })} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Splitter" value={form.splitter} onChange={(event) => setForm({ ...form, splitter: event.target.value })} />
        <Input type="number" placeholder="Puertos" value={form.ports_total} onChange={(event) => setForm({ ...form, ports_total: event.target.value })} />
        <Input type="number" placeholder="Usados" value={form.ports_used} onChange={(event) => setForm({ ...form, ports_used: event.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Potencia IN" value={form.power_in} onChange={(event) => setForm({ ...form, power_in: event.target.value })} />
        <Input placeholder="Potencia OUT" value={form.power_out} onChange={(event) => setForm({ ...form, power_out: event.target.value })} />
      </div>

      <Input placeholder="Dirección" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />

      <div className="grid grid-cols-2 gap-2">
        <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Guardar</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">Cancelar</button>
      </div>
    </form>
  );
}

function CableForm({ form, setForm, nodes, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />

      <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
        {Object.entries(CABLE_TYPES).map(([key, item]) => (
          <option key={key} value={key}>{item.label}</option>
        ))}
      </Select>

      <Select value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })}>
        <option value="">Origen</option>
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>{node.name}</option>
        ))}
      </Select>

      <Select value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })}>
        <option value="">Destino</option>
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>{node.name}</option>
        ))}
      </Select>

      <div className="grid grid-cols-3 gap-2">
        <Input type="number" placeholder="Fibras" value={form.fibers} onChange={(event) => setForm({ ...form, fibers: event.target.value })} />
        <Input type="number" placeholder="Metros" value={form.distance_m} onChange={(event) => setForm({ ...form, distance_m: event.target.value })} />
        <Input type="number" placeholder="Pérdida" value={form.loss_db} onChange={(event) => setForm({ ...form, loss_db: event.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="submit" className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white">Guardar</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">Cancelar</button>
      </div>
    </form>
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

function Section({ title, children }) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="mb-2 font-bold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function TopButton({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700">
      {children}
    </button>
  );
}

function ToolButton({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
      {children}
    </button>
  );
}

function SmallButton({ children, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-bold ${
        danger ? "bg-red-600 text-white" : "bg-blue-600 text-white"
      }`}
    >
      {children}
    </button>
  );
}

function IconTool({ children }) {
  return (
    <button type="button" className="rounded bg-[#0d99bd] px-3 py-2 font-bold text-white">
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
    />
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

function getSplitterPorts(splitter) {
  const match = String(splitter || "").match(/1:(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getSplitterLoss(splitter) {
  const losses = {
    "1:2": 3.6,
    "1:4": 7.2,
    "1:8": 10.5,
    "1:16": 13.8,
    "1:32": 17.1,
    "1:64": 20.5,
  };

  return losses[splitter] || null;
}

function emptyNodeForm() {
  return {
    type: "nap",
    name: "",
    x: 500,
    y: 300,
    splitter: "1:8",
    ports_total: 8,
    ports_used: 0,
    power_in: "",
    power_out: "",
    address: "",
    status: "active",
  };
}

function emptyCableForm() {
  return {
    name: "",
    type: "distribution",
    from: "",
    to: "",
    fibers: 12,
    distance_m: 0,
    loss_db: 0,
  };
}

export default FTTHManager;
