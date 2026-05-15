import { useEffect, useState } from "react";
import axios from "axios";

import logo from "./assets/logo.png";

import RouterManager from "./RouterManager";
import CustomerManager from "./CustomerManager";
import PlanManager from "./PlanManager";
import OnlineClients from "./OnlineClients";
import ClientTraffic from "./ClientTraffic";

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
  const [customers, setCustomers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [installations, setInstallations] = useState([]);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");

  const [stats, setStats] = useState(null);
  const [clientStatus, setClientStatus] = useState(null);

  const [generatingBilling, setGeneratingBilling] = useState(false);
  const [billingResult, setBillingResult] = useState(null);

  const [cutStatus, setCutStatus] = useState(null);
  const [updatingCutStatus, setUpdatingCutStatus] = useState(false);
  const [suspendingOverdue, setSuspendingOverdue] = useState(false);
  const [suspendResult, setSuspendResult] = useState(null);

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
  const canViewClientTraffic = ["admin", "tecnico"].includes(role);

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
        const [invoicesRes, customersRes] = await Promise.all([
          axios.get(`${API}/invoices`, headers),
          axios.get(`${API}/customers`, headers),
        ]);

        setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
        setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      }

      if (canViewTickets) {
        const res = await axios.get(`${API}/tickets`, headers);
        setTickets(Array.isArray(res.data) ? res.data : []);
      }

      if (canViewInstallations) {
        const res = await axios.get(`${API}/installations`, headers);
        setInstallations(Array.isArray(res.data) ? res.data : []);
      }

      if (canViewStats) {
        const res = await axios.get(`${API}/dashboard/stats`, headers);
        setStats(res.data);
      }

      if (canViewClientStatus) {
        const res = await axios.get(`${API}/dashboard/clients-status`, headers);
        setClientStatus(res.data);
      }
    } catch (error) {
      console.error("Error cargando dashboard:", error);

      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        onLogout();
      }
    }
  };

  const loadCutStatus = async () => {
    try {
      if (!canViewInvoices) return;

      const res = await axios.get(
        `${API}/billing/cut-status`,
        getAuthHeaders()
      );

      setCutStatus(res.data);
    } catch (error) {
      console.error("Error cargando estado de cortes:", error);
    }
  };

  useEffect(() => {
    loadData();
    loadCutStatus();

    const interval = setInterval(() => {
      loadData();
      loadCutStatus();
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

    await loadData();
  };

  const payInvoice = async (id) => {
    await axios.put(`${API}/invoices/${id}/pay`, {}, getAuthHeaders());
    await loadData();
  };

  const exportInvoicesExcel = async (status = "") => {
    try {
      const url = status
        ? `${API}/invoices/export-excel?status=${status}`
        : `${API}/invoices/export-excel`;

      const res = await axios.get(url, {
        ...getAuthHeaders(),
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;

      if (status === "pending") {
        link.download = "facturas_pendientes.xlsx";
      } else if (status === "paid") {
        link.download = "facturas_pagadas.xlsx";
      } else {
        link.download = "facturas.xlsx";
      }

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Error exportando facturas:", error);
      alert("No se pudo exportar el Excel.");
    }
  };

  const exportInvoicesPdf = async (status = "") => {
    try {
      const url = status
        ? `${API}/invoices/export-pdf?status=${status}`
        : `${API}/invoices/export-pdf`;

      const res = await axios.get(url, {
        ...getAuthHeaders(),
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/pdf",
      });

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;

      if (status === "pending") {
        link.download = "facturas_pendientes.pdf";
      } else if (status === "paid") {
        link.download = "facturas_pagadas.pdf";
      } else {
        link.download = "facturas.pdf";
      }

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Error exportando PDF:", error);
      alert("No se pudo exportar el PDF.");
    }
  };

  const generateMonthlyBilling = async () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const dueDayInput = window.prompt(
      "¿Qué día de vencimiento querés usar?",
      "15"
    );

    if (dueDayInput === null) return;

    const dueDay = Number(dueDayInput || 15);

    const ok = window.confirm(
      `¿Generar facturas para ${month}/${year} con vencimiento día ${dueDay}?`
    );

    if (!ok) return;

    try {
      setGeneratingBilling(true);
      setBillingResult(null);

      const res = await axios.post(
        `${API}/billing/generate-monthly`,
        {
          year,
          month,
          due_day: dueDay,
        },
        getAuthHeaders()
      );

      setBillingResult(res.data);

      alert(
        `Facturación generada.\nCreadas: ${
          res.data.created || 0
        }\nYa existentes: ${
          res.data.skipped_existing || 0
        }\nSin plan: ${
          res.data.skipped_without_plan || 0
        }\nSin precio: ${res.data.skipped_without_price || 0}`
      );

      await loadData();
    } catch (error) {
      console.error("Error generando facturación mensual:", error);
      alert("No se pudo generar la facturación mensual.");
    } finally {
      setGeneratingBilling(false);
    }
  };

  const enableCuts = async () => {
    const ok = window.confirm(
      "¿Habilitar cortes? Desde este momento se podrá suspender clientes vencidos."
    );

    if (!ok) return;

    try {
      setUpdatingCutStatus(true);

      await axios.post(`${API}/billing/cut-enable`, {}, getAuthHeaders());

      await loadCutStatus();

      alert("Cortes habilitados.");
    } catch (error) {
      console.error("Error habilitando cortes:", error);
      alert("No se pudieron habilitar los cortes.");
    } finally {
      setUpdatingCutStatus(false);
    }
  };

  const disableCuts = async () => {
    const ok = window.confirm(
      "¿Deshabilitar cortes? No se suspenderá ningún cliente aunque tenga facturas vencidas."
    );

    if (!ok) return;

    try {
      setUpdatingCutStatus(true);

      await axios.post(`${API}/billing/cut-disable`, {}, getAuthHeaders());

      await loadCutStatus();

      alert("Cortes deshabilitados.");
    } catch (error) {
      console.error("Error deshabilitando cortes:", error);
      alert("No se pudieron deshabilitar los cortes.");
    } finally {
      setUpdatingCutStatus(false);
    }
  };

  const suspendOverdueCustomers = async () => {
    const ok = window.confirm(
      "¿Suspender clientes con facturas vencidas e impagas? Si los cortes están deshabilitados, no se cortará nadie."
    );

    if (!ok) return;

    try {
      setSuspendingOverdue(true);
      setSuspendResult(null);

      const res = await axios.post(
        `${API}/billing/suspend-overdue`,
        {},
        getAuthHeaders()
      );

      setSuspendResult(res.data);

      alert(
        `${res.data.message}\nSuspendidos: ${
          res.data.suspended_customers || 0
        }\nMikroTik deshabilitados: ${
          res.data.mikrotik_disabled || 0
        }\nConexiones eliminadas: ${
          res.data.active_connections_removed || 0
        }`
      );

      await loadData();
      await loadCutStatus();
    } catch (error) {
      console.error("Error suspendiendo vencidos:", error);
      alert("No se pudo ejecutar la suspensión de vencidos.");
    } finally {
      setSuspendingOverdue(false);
    }
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

    await loadData();
  };

  const closeTicket = async (id) => {
    await axios.put(`${API}/tickets/${id}/close`, {}, getAuthHeaders());
    await loadData();
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

    await loadData();
  };

  const completeInstallation = async (id) => {
    await axios.put(
      `${API}/installations/${id}/complete`,
      {},
      getAuthHeaders()
    );

    await loadData();
  };

  const cancelInstallation = async (id) => {
    await axios.put(
      `${API}/installations/${id}/cancel`,
      {},
      getAuthHeaders()
    );

    await loadData();
  };

  const getInvoiceCustomer = (customerId) => {
    return customers.find(
      (customer) => Number(customer.id) === Number(customerId)
    );
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const customer = getInvoiceCustomer(invoice.customer_id);

    const text = `
      ${invoice.id || ""}
      ${invoice.customer_id || ""}
      ${invoice.amount || ""}
      ${invoice.due_date || ""}
      ${invoice.status || ""}
      ${customer?.name || ""}
      ${customer?.last_name || ""}
      ${customer?.pppoe_username || ""}
      ${customer?.remote_address || ""}
      ${customer?.phone || ""}
      ${customer?.zone || ""}
    `.toLowerCase();

    const matchesSearch = text.includes(invoiceSearch.toLowerCase());

    const matchesStatus = invoiceStatusFilter
      ? invoice.status === invoiceStatusFilter
      : true;

    return matchesSearch && matchesStatus;
  });

  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "pending"
  );

  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");

  const pendingAmount = pendingInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
  );

  const paidAmount = paidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
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
        <img src={logo} alt="HighSpeed" className="w-48 mb-8" />

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

          {canViewClientTraffic && (
            <SidebarButton
              icon="📊"
              label="Tráfico Clientes"
              active={section === "clientTraffic"}
              onClick={() => setSection("clientTraffic")}
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
            <DashboardHome
              stats={stats}
              tickets={tickets}
              clientStatus={clientStatus}
              networkData={networkData}
            />
          </>
        )}

        {section === "customers" && canViewCustomers && <CustomerManager />}

        {section === "online" && canViewOnline && <OnlineClients />}

        {section === "clientTraffic" && canViewClientTraffic && (
          <ClientTraffic />
        )}

        {section === "plans" && canViewPlans && <PlanManager />}

        {section === "invoices" && (
          <Module title="Facturas">
            {canManageInvoices && (
              <Panel title="Control de cortes">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-slate-700 font-semibold">
                      Estado actual:
                      <span
                        className={`ml-2 rounded-lg px-3 py-1 text-xs font-bold ${
                          cutStatus?.cuts_enabled
                            ? "bg-green-500 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        {cutStatus?.cuts_enabled
                          ? "CORTES HABILITADOS"
                          : "CORTES DESHABILITADOS"}
                      </span>
                    </p>

                    <p className="text-sm text-slate-500 mt-2">
                      Mientras los cortes estén deshabilitados, el sistema no
                      suspende clientes ni toca MikroTik.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {role === "admin" && (
                      <>
                        <button
                          type="button"
                          onClick={enableCuts}
                          disabled={updatingCutStatus}
                          className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-500 disabled:opacity-60"
                        >
                          Habilitar cortes
                        </button>

                        <button
                          type="button"
                          onClick={disableCuts}
                          disabled={updatingCutStatus}
                          className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-60"
                        >
                          Deshabilitar cortes
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={suspendOverdueCustomers}
                      disabled={suspendingOverdue}
                      className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white hover:bg-orange-400 disabled:opacity-60"
                    >
                      {suspendingOverdue
                        ? "Procesando..."
                        : "Suspender impagos vencidos"}
                    </button>
                  </div>
                </div>
              </Panel>
            )}

            {suspendResult && (
              <Panel title="Resultado suspensión de vencidos">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <StatBox
                    title="Facturas vencidas"
                    value={suspendResult.overdue_invoices || 0}
                    color="text-orange-500"
                  />

                  <StatBox
                    title="Clientes procesados"
                    value={suspendResult.customers_processed || 0}
                    color="text-blue-600"
                  />

                  <StatBox
                    title="Suspendidos"
                    value={suspendResult.suspended_customers || 0}
                    color="text-red-600"
                  />

                  <StatBox
                    title="MikroTik disabled"
                    value={suspendResult.mikrotik_disabled || 0}
                    color="text-red-600"
                  />

                  <StatBox
                    title="Conexiones removidas"
                    value={suspendResult.active_connections_removed || 0}
                    color="text-red-600"
                  />
                </div>

                <pre className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs overflow-auto">
                  {JSON.stringify(suspendResult, null, 2)}
                </pre>
              </Panel>
            )}

            {canManageInvoices && (
              <Panel title="Facturación mensual automática">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-slate-700">
                      Genera facturas para todos los clientes activos con plan
                      asignado.
                    </p>

                    <p className="text-sm text-slate-500 mt-1">
                      No duplica facturas si el cliente ya tiene una factura en
                      el mismo mes. El vencimiento recomendado es día 15.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={generateMonthlyBilling}
                    disabled={generatingBilling}
                    className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                  >
                    {generatingBilling
                      ? "Generando..."
                      : "Generar facturas del mes"}
                  </button>
                </div>
              </Panel>
            )}

            {billingResult && (
              <Panel title="Resultado facturación mensual">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <StatBox
                    title="Creadas"
                    value={billingResult.created || 0}
                    color="text-green-600"
                  />

                  <StatBox
                    title="Ya existentes"
                    value={billingResult.skipped_existing || 0}
                    color="text-blue-600"
                  />

                  <StatBox
                    title="Sin plan"
                    value={billingResult.skipped_without_plan || 0}
                    color="text-orange-500"
                  />

                  <StatBox
                    title="Sin precio"
                    value={billingResult.skipped_without_price || 0}
                    color="text-orange-500"
                  />

                  <StatBox
                    title="Errores"
                    value={billingResult.errors?.length || 0}
                    color="text-red-600"
                  />
                </div>

                <pre className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs overflow-auto">
                  {JSON.stringify(billingResult, null, 2)}
                </pre>
              </Panel>
            )}

            {canManageInvoices && (
              <Panel title="Crear factura manual">
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

            <Panel title="Resumen y búsqueda de facturas">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                <StatBox title="Total facturas" value={invoices.length} />

                <StatBox
                  title="Pendientes"
                  value={pendingInvoices.length}
                  color="text-orange-500"
                />

                <StatBox
                  title="Por cobrar"
                  value={`$${pendingAmount}`}
                  color="text-red-600"
                />

                <StatBox
                  title="Cobrado"
                  value={`$${paidAmount}`}
                  color="text-green-600"
                />
              </div>

              <div className="flex flex-wrap gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => exportInvoicesExcel("")}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
                >
                  Exportar todas
                </button>

                <button
                  type="button"
                  onClick={() => exportInvoicesExcel("pending")}
                  className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white hover:bg-orange-400"
                >
                  Exportar pendientes
                </button>

                <button
                  type="button"
                  onClick={() => exportInvoicesExcel("paid")}
                  className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-500"
                >
                  Exportar pagadas
                </button>

                <button
                  type="button"
                  onClick={() => exportInvoicesPdf("")}
                  className="rounded-xl bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600"
                >
                  PDF todas
                </button>

                <button
                  type="button"
                  onClick={() => exportInvoicesPdf("pending")}
                  className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500"
                >
                  PDF pendientes
                </button>

                <button
                  type="button"
                  onClick={() => exportInvoicesPdf("paid")}
                  className="rounded-xl bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-600"
                >
                  PDF pagadas
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 md:col-span-2"
                  placeholder="Buscar por cliente, usuario PPPoE, IP, teléfono o factura..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                />

                <select
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                  value={invoiceStatusFilter}
                  onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="pending">Pendientes</option>
                  <option value="paid">Pagadas</option>
                </select>
              </div>
            </Panel>

            <GridList
              items={filteredInvoices}
              render={(invoice) => {
                const customer = getInvoiceCustomer(invoice.customer_id);

                return (
                  <Panel title={`Factura #${invoice.id}`} key={invoice.id}>
                    <p>
                      <b>Cliente:</b>{" "}
                      {customer
                        ? `${customer.name} ${customer.last_name || ""}`
                        : `ID ${invoice.customer_id}`}
                    </p>

                    <p>
                      <b>Usuario PPPoE:</b>{" "}
                      {customer?.pppoe_username || "-"}
                    </p>

                    <p>
                      <b>IP:</b> {customer?.remote_address || "-"}
                    </p>

                    <p>
                      <b>Teléfono:</b> {customer?.phone || "-"}
                    </p>

                    <p>
                      <b>Zona:</b> {customer?.zone || "-"}
                    </p>

                    <p>
                      <b>Monto:</b> ${invoice.amount}
                    </p>

                    <p>
                      <b>Vence:</b> {invoice.due_date}
                    </p>

                    <p>
                      <b>Estado:</b>{" "}
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-bold ${
                          invoice.status === "paid"
                            ? "bg-green-500 text-white"
                            : "bg-orange-500 text-white"
                        }`}
                      >
                        {invoice.status === "paid" ? "Pagada" : "Pendiente"}
                      </span>
                    </p>

                    {invoice.status === "pending" && canManageInvoices && (
                      <button
                        className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500 mt-3"
                        onClick={() => payInvoice(invoice.id)}
                      >
                        Marcar pagada
                      </button>
                    )}
                  </Panel>
                );
              }}
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
              render={(ticket) => (
                <Panel
                  title={`Ticket #${ticket.id} - ${ticket.title}`}
                  key={ticket.id}
                >
                  <p>Cliente ID: {ticket.customer_id}</p>
                  <p>{ticket.description}</p>
                  <p>Estado: {ticket.status}</p>

                  {ticket.status === "open" && canManageTickets && (
                    <button
                      className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500 mt-3"
                      onClick={() => closeTicket(ticket.id)}
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
              render={(installation) => (
                <Panel
                  title={`Instalación #${installation.id}`}
                  key={installation.id}
                >
                  <p>Cliente ID: {installation.customer_id}</p>
                  <p>Técnico: {installation.technician}</p>
                  <p>Fecha: {installation.scheduled_date}</p>
                  <p>Dirección: {installation.address}</p>
                  <p>Tipo: {installation.installation_type}</p>
                  <p>Estado: {installation.status}</p>
                  <p>{installation.notes}</p>

                  {installation.status === "pending" &&
                    canManageInstallations && (
                      <div className="flex gap-3 mt-4">
                        <button
                          className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500"
                          onClick={() => completeInstallation(installation.id)}
                        >
                          Completar
                        </button>

                        <button
                          className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500"
                          onClick={() => cancelInstallation(installation.id)}
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

function DashboardHome({ stats, tickets, clientStatus, networkData }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-950">Dashboard</h1>

          <p className="text-slate-500 mt-2">Resumen general de tu ISP</p>
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

function StatBox({ title, value, color = "text-slate-950" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-slate-500 text-sm">{title}</p>
      <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
    </div>
  );
}

export default Dashboard;
