import { useEffect, useState } from "react";
import axios from "axios";

import logo from "./assets/logo.png";

import RouterManager from "./RouterManager";
import CustomerManager from "./CustomerManager";
import PlanManager from "./PlanManager";
import OnlineClients from "./OnlineClients";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

const API = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

function Dashboard({ onLogout }) {
  const role = localStorage.getItem("role");

  const [section, setSection] = useState("dashboard");

  const [invoices, setInvoices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [installations, setInstallations] = useState([]);

  const [stats, setStats] = useState(null);
  const [clientStatus, setClientStatus] = useState(null);

  const [invoiceForm, setInvoiceForm] = useState({
    customer_id: "",
    amount: "",
    due_date: "",
  });

  const [ticketForm, setTicketForm] = useState({
    customer_id: "",
    title: "",
    description: "",
  });

  const [installationForm, setInstallationForm] = useState({
    customer_id: "",
    technician: "",
    scheduled_date: "",
    address: "",
    installation_type: "",
    notes: "",
  });

  const canViewCustomers = ["admin", "tecnico", "operador"].includes(role);
  const canViewOnline = ["admin", "tecnico"].includes(role);

  const canViewPlans = [
    "admin",
    "tecnico",
    "operador",
    "cobrador",
  ].includes(role);

  const canViewInvoices = ["admin", "cobrador"].includes(role);
  const canManageInvoices = ["admin", "cobrador"].includes(role);

  const canViewTickets = ["admin", "tecnico", "operador"].includes(role);
  const canManageTickets = ["admin", "tecnico"].includes(role);

  const canViewInstallations = ["admin", "tecnico", "operador"].includes(role);
  const canManageInstallations = ["admin", "tecnico"].includes(role);

  const canViewMikrotik = role === "admin";
  const canViewStats = ["admin", "cobrador", "operador"].includes(role);

  const canViewClientStatus = [
    "admin",
    "tecnico",
    "operador",
    "cobrador",
  ].includes(role);

  const loadData = async () => {
    try {
      const headers = getAuthHeaders();

      if (canViewInvoices) {
        const res = await axios.get(`${API}/invoices`, headers);
        setInvoices(res.data);
      }

      if (canViewTickets) {
        const res = await axios.get(`${API}/tickets`, headers);
        setTickets(res.data);
      }

      if (canViewInstallations) {
        const res = await axios.get(`${API}/installations`, headers);
        setInstallations(res.data);
      }

      if (canViewStats) {
        const res = await axios.get(`${API}/dashboard/stats`, headers);
        setStats(res.data);
      }

      if (canViewClientStatus) {
        const res = await axios.get(
          `${API}/dashboard/clients-status`,
          headers
        );
        setClientStatus(res.data);
      }
    } catch (error) {
      console.error(error);

      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        onLogout();
      }
    }
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 15000);

    const ws = new WebSocket("ws://127.0.0.1:8000/ws/dashboard");

    ws.onmessage = (event) => {
      setStats(JSON.parse(event.data));
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const createInvoice = async (e) => {
    e.preventDefault();

    await axios.post(
      `${API}/invoices`,
      {
        customer_id: Number(invoiceForm.customer_id),
        amount: Number(invoiceForm.amount),
        due_date: invoiceForm.due_date,
      },
      getAuthHeaders()
    );

    setInvoiceForm({
      customer_id: "",
      amount: "",
      due_date: "",
    });

    loadData();
  };

  const payInvoice = async (id) => {
    await axios.put(`${API}/invoices/${id}/pay`, {}, getAuthHeaders());
    loadData();
  };

  const createTicket = async (e) => {
    e.preventDefault();

    await axios.post(
      `${API}/tickets`,
      {
        customer_id: Number(ticketForm.customer_id),
        title: ticketForm.title,
        description: ticketForm.description,
      },
      getAuthHeaders()
    );

    setTicketForm({
      customer_id: "",
      title: "",
      description: "",
    });

    loadData();
  };

  const closeTicket = async (id) => {
    await axios.put(`${API}/tickets/${id}/close`, {}, getAuthHeaders());
    loadData();
  };

  const createInstallation = async (e) => {
    e.preventDefault();

    await axios.post(
      `${API}/installations`,
      {
        customer_id: Number(installationForm.customer_id),
        technician: installationForm.technician,
        scheduled_date: installationForm.scheduled_date,
        address: installationForm.address,
        installation_type: installationForm.installation_type,
        notes: installationForm.notes,
      },
      getAuthHeaders()
    );

    setInstallationForm({
      customer_id: "",
      technician: "",
      scheduled_date: "",
      address: "",
      installation_type: "",
      notes: "",
    });

    loadData();
  };

  const completeInstallation = async (id) => {
    await axios.put(
      `${API}/installations/${id}/complete`,
      {},
      getAuthHeaders()
    );

    loadData();
  };

  const cancelInstallation = async (id) => {
    await axios.put(
      `${API}/installations/${id}/cancel`,
      {},
      getAuthHeaders()
    );

    loadData();
  };

  const pendingInstallations = installations.filter(
    (i) => i.status === "pending"
  );

  const completedInstallations = installations.filter(
    (i) => i.status === "completed"
  );

  const cancelledInstallations = installations.filter(
    (i) => i.status === "cancelled"
  );

  const networkData = [
    { name: "15 May", sesiones: 580 },
    { name: "16 May", sesiones: 490 },
    { name: "17 May", sesiones: 620 },
    { name: "18 May", sesiones: 800 },
    { name: "19 May", sesiones: 440 },
    { name: "20 May", sesiones: 680 },
    {
      name: "Hoy",
      sesiones: clientStatus?.active_pppoe_sessions || 0,
    },
  ];

  return (
    <div className="light-app min-h-screen bg-slate-50 text-slate-950 flex">
      <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="mb-10 flex items-center justify-center">
  <img
    src={logo}
    alt="HighSpeed"
    className="h-24 w-auto max-w-[240px] object-contain"
  />
</div>

        <div className="space-y-2 flex-1">
          <SidebarButton
            icon="🏠"
            label="Dashboard"
            active={section === "dashboard"}
            onClick={() => setSection("dashboard")}
          />

          {canViewCustomers && (
            <SidebarButton
              icon="👤"
              label="Clientes"
              active={section === "customers"}
              onClick={() => setSection("customers")}
            />
          )}

          {canViewOnline && (
            <SidebarButton
              icon="📶"
              label="PPPoE Online"
              active={section === "online"}
              onClick={() => setSection("online")}
            />
          )}

          {canViewPlans && (
            <SidebarButton
              icon="📋"
              label="Planes"
              active={section === "plans"}
              onClick={() => setSection("plans")}
            />
          )}

          {canViewInvoices && (
            <SidebarButton
              icon="🧾"
              label="Facturas"
              active={section === "invoices"}
              onClick={() => setSection("invoices")}
            />
          )}

          {canViewTickets && (
            <SidebarButton
              icon="🎫"
              label="Tickets"
              active={section === "tickets"}
              onClick={() => setSection("tickets")}
            />
          )}

          {canViewInstallations && (
            <SidebarButton
              icon="🛠️"
              label="Instalaciones"
              active={section === "installations"}
              onClick={() => setSection("installations")}
            />
          )}

          {canViewMikrotik && (
            <SidebarButton
              icon="⚙️"
              label="Routers MikroTik"
              active={section === "mikrotik"}
              onClick={() => setSection("mikrotik")}
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              🛡️
            </div>

            <div>
              <p className="font-bold text-slate-800">Sistema Seguro</p>
              <p className="text-xs text-slate-500">
                Tu información está protegida
              </p>
              <p className="text-xs text-green-600 mt-1">● En línea</p>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-bold text-red-600 hover:bg-red-100"
        >
          ↪ Cerrar sesión
        </button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {section === "dashboard" && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-bold text-slate-950">
                  Dashboard
                </h1>

                <p className="text-slate-500 mt-2">
                  Resumen general de tu ISP
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  📅 {new Date().toLocaleDateString()}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  🔔
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
                    👤
                  </div>

                  <div>
                    <p className="font-bold text-slate-800">Administrador</p>
                    <p className="text-xs text-slate-500">HighSpeed ISP</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <MetricCard
                icon="🧾"
                title="Facturas"
                value={stats?.invoices || 0}
                subtitle="Este mes"
                color="blue"
              />

              <MetricCard
                icon="🎧"
                title="Tickets"
                value={tickets.length}
                subtitle="Abiertos"
                color="blue"
              />

              <MetricCard
                icon="🕘"
                title="Pendientes"
                value={stats?.pending_invoices || 0}
                subtitle="Por cobrar"
                color="blue"
              />

              <MetricCard
                icon="✅"
                title="Pagadas"
                value={stats?.paid_invoices || 0}
                subtitle="Este mes"
                color="green"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mt-6">
              <MetricCard
                icon="👥"
                title="Clientes Totales"
                value={clientStatus?.total_customers || 0}
                subtitle="Registrados"
                color="blue"
              />

              <MetricCard
                icon="📶"
                title="Clientes Online"
                value={clientStatus?.online_customers || 0}
                subtitle="Conectados"
                color="green"
              />

              <MetricCard
                icon="📡"
                title="Clientes Offline"
                value={clientStatus?.offline_customers || 0}
                subtitle="Desconectados"
                color="red"
              />

              <MetricCard
                icon="👤"
                title="Sesiones PPPoE"
                value={clientStatus?.active_pppoe_sessions || 0}
                subtitle="Sesiones activas"
                color="blue"
              />

              <MetricCard
                icon="🛜"
                title="MikroTik"
                value={clientStatus?.mikrotik_online ? "Online" : "Offline"}
                subtitle="Estado actual"
                color={clientStatus?.mikrotik_online ? "green" : "red"}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-6">
              <LightPanel title="Estado de Facturas">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={[
                      {
                        name: "Pendientes",
                        total: stats?.pending_invoices || 0,
                      },
                      {
                        name: "Pagadas",
                        total: stats?.paid_invoices || 0,
                      },
                    ]}
                  >
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar
                      dataKey="total"
                      fill="#0ea5e9"
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </LightPanel>

              <LightPanel title="Estado de Clientes">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "Online",
                          value: clientStatus?.online_customers || 0,
                        },
                        {
                          name: "Offline",
                          value: clientStatus?.offline_customers || 0,
                        },
                        {
                          name: "Suspendidos",
                          value: clientStatus?.suspended_customers || 0,
                        },
                      ]}
                      dataKey="value"
                      innerRadius={65}
                      outerRadius={95}
                      label
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#94a3b8" />
                      <Cell fill="#f97316" />
                    </Pie>

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </LightPanel>

              <LightPanel title="Actividad de la Red">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={networkData}>
                    <defs>
                      <linearGradient
                        id="networkGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#0ea5e9"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0ea5e9"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="sesiones"
                      stroke="#0ea5e9"
                      fill="url(#networkGradient)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </LightPanel>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-6">
              <FinanceCard
                icon="$"
                title="Total Cobrado"
                value={`$${stats?.total_paid_amount || 0}`}
                subtitle="Este mes"
                color="blue"
              />

              <FinanceCard
                icon="$"
                title="Total Pendiente"
                value={`$${stats?.total_pending_amount || 0}`}
                subtitle="Por cobrar"
                color="green"
              />

              <FinanceCard
                icon="▥"
                title="Ingreso Promedio"
                value={`$${stats?.total_paid_amount || 0}`}
                subtitle="Por factura"
                color="purple"
              />

              <FinanceCard
                icon="👥"
                title="ARPU Promedio"
                value={`$${
                  clientStatus?.total_customers
                    ? Math.round(
                        (stats?.total_paid_amount || 0) /
                          clientStatus.total_customers
                      )
                    : 0
                }`}
                subtitle="Por cliente"
                color="orange"
              />
            </div>

            {clientStatus?.mikrotik_error && (
              <LightPanel title="Estado MikroTik">
                <p className="text-red-500">
                  Error MikroTik: {String(clientStatus.mikrotik_error)}
                </p>
              </LightPanel>
            )}
          </>
        )}

        {section === "customers" && canViewCustomers && <CustomerManager />}

        {section === "online" && canViewOnline && <OnlineClients />}

        {section === "plans" && canViewPlans && <PlanManager />}

        {section === "invoices" && (
          <Module title="Facturas">
            {canManageInvoices && (
              <Panel title="Crear factura">
                <form
                  onSubmit={createInvoice}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <Input
                    type="number"
                    placeholder="Cliente ID"
                    value={invoiceForm.customer_id}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        customer_id: e.target.value,
                      })
                    }
                  />

                  <Input
                    type="number"
                    placeholder="Monto"
                    value={invoiceForm.amount}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        amount: e.target.value,
                      })
                    }
                  />

                  <Input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        due_date: e.target.value,
                      })
                    }
                  />

                  <button className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-500 md:col-span-3">
                    Guardar factura
                  </button>
                </form>
              </Panel>
            )}

            <GridList
              items={invoices}
              render={(i) => (
                <Panel title={`Factura #${i.id}`} key={i.id}>
                  <p>Cliente ID: {i.customer_id}</p>
                  <p>Monto: ${i.amount}</p>
                  <p>Vence: {i.due_date}</p>
                  <p>Estado: {i.status}</p>

                  {i.status === "pending" && canManageInvoices && (
                    <button
                      className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500 mt-3"
                      onClick={() => payInvoice(i.id)}
                    >
                      Marcar pagada
                    </button>
                  )}
                </Panel>
              )}
            />
          </Module>
        )}

        {section === "tickets" && (
          <Module title="Tickets">
            <Panel title="Crear ticket">
              <form onSubmit={createTicket} className="grid grid-cols-1 gap-4">
                <Input
                  type="number"
                  placeholder="Cliente ID"
                  value={ticketForm.customer_id}
                  onChange={(e) =>
                    setTicketForm({
                      ...ticketForm,
                      customer_id: e.target.value,
                    })
                  }
                />

                <Input
                  placeholder="Título"
                  value={ticketForm.title}
                  onChange={(e) =>
                    setTicketForm({
                      ...ticketForm,
                      title: e.target.value,
                    })
                  }
                />

                <textarea
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 min-h-28"
                  placeholder="Descripción"
                  value={ticketForm.description}
                  onChange={(e) =>
                    setTicketForm({
                      ...ticketForm,
                      description: e.target.value,
                    })
                  }
                />

                <button className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-500">
                  Guardar ticket
                </button>
              </form>
            </Panel>

            <GridList
              items={tickets}
              render={(t) => (
                <Panel title={`Ticket #${t.id} - ${t.title}`} key={t.id}>
                  <p>Cliente ID: {t.customer_id}</p>
                  <p>{t.description}</p>
                  <p>Estado: {t.status}</p>

                  {t.status === "open" && canManageTickets && (
                    <button
                      className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500 mt-3"
                      onClick={() => closeTicket(t.id)}
                    >
                      Cerrar ticket
                    </button>
                  )}
                </Panel>
              )}
            />
          </Module>
        )}

        {section === "installations" && (
          <Module title="Instalaciones">
            {canManageInstallations && (
              <Panel title="Crear instalación">
                <form
                  onSubmit={createInstallation}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <Input
                    type="number"
                    placeholder="Cliente ID"
                    value={installationForm.customer_id}
                    onChange={(e) =>
                      setInstallationForm({
                        ...installationForm,
                        customer_id: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="Técnico"
                    value={installationForm.technician}
                    onChange={(e) =>
                      setInstallationForm({
                        ...installationForm,
                        technician: e.target.value,
                      })
                    }
                  />

                  <Input
                    type="date"
                    value={installationForm.scheduled_date}
                    onChange={(e) =>
                      setInstallationForm({
                        ...installationForm,
                        scheduled_date: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="Dirección"
                    value={installationForm.address}
                    onChange={(e) =>
                      setInstallationForm({
                        ...installationForm,
                        address: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="Tipo de instalación"
                    value={installationForm.installation_type}
                    onChange={(e) =>
                      setInstallationForm({
                        ...installationForm,
                        installation_type: e.target.value,
                      })
                    }
                  />

                  <textarea
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 min-h-28 md:col-span-2"
                    placeholder="Notas"
                    value={installationForm.notes}
                    onChange={(e) =>
                      setInstallationForm({
                        ...installationForm,
                        notes: e.target.value,
                      })
                    }
                  />

                  <button className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-500 md:col-span-2">
                    Guardar instalación
                  </button>
                </form>
              </Panel>
            )}

            <GridList
              items={installations}
              render={(i) => (
                <Panel title={`Instalación #${i.id}`} key={i.id}>
                  <p>Cliente ID: {i.customer_id}</p>
                  <p>Técnico: {i.technician}</p>
                  <p>Fecha: {i.scheduled_date}</p>
                  <p>Dirección: {i.address}</p>
                  <p>Tipo: {i.installation_type}</p>
                  <p>Estado: {i.status}</p>
                  <p>{i.notes}</p>

                  {i.status === "pending" && canManageInstallations && (
                    <div className="flex gap-3 mt-4">
                      <button
                        className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500"
                        onClick={() => completeInstallation(i.id)}
                      >
                        Completar
                      </button>

                      <button
                        className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500"
                        onClick={() => cancelInstallation(i.id)}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </Panel>
              )}
            />
          </Module>
        )}

        {section === "mikrotik" && canViewMikrotik && <RouterManager />}
      </main>
    </div>
  );
}

function SidebarButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-3 text-left font-semibold transition flex items-center gap-3 ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
          : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Header({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold text-slate-950">{title}</h1>
      {subtitle && <p className="text-slate-500 mt-2">{subtitle}</p>}
    </div>
  );
}

function Module({ title, children }) {
  return (
    <>
      <Header title={title} />
      {children}
    </>
  );
}

function MetricCard({ icon, title, value, subtitle, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-500",
    orange: "bg-orange-50 text-orange-500",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-center gap-4">
        <div
          className={`h-16 w-16 rounded-full flex items-center justify-center text-3xl ${
            colors[color] || colors.blue
          }`}
        >
          {icon}
        </div>

        <div>
          <p className="text-slate-500">{title}</p>
          <h2 className="text-3xl font-bold text-slate-950">{value}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({ icon, title, value, subtitle, color = "blue" }) {
  const colors = {
    blue: "bg-blue-500 text-white",
    green: "bg-green-500 text-white",
    purple: "bg-purple-500 text-white",
    orange: "bg-orange-500 text-white",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
      <div
        className={`h-16 w-16 rounded-full flex items-center justify-center text-3xl font-bold ${
          colors[color] || colors.blue
        }`}
      >
        {icon}
      </div>

      <div>
        <p className="text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-950">{value}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function LightPanel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xl font-bold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5 shadow-sm">
      <h3 className="mb-4 text-xl font-bold text-slate-950">{title}</h3>
      <div className="text-slate-700 text-sm space-y-2">{children}</div>
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
    />
  );
}

function GridList({ items, render }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-5">
      {items.map(render)}
    </div>
  );
}

export default Dashboard;