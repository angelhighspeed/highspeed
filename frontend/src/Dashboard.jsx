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

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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
  const [installationRouters, setInstallationRouters] = useState([]);
  const [installationPlans, setInstallationPlans] = useState([]);
  const [mikrotikPools, setMikrotikPools] = useState([]);
  const [selectedPoolName, setSelectedPoolName] = useState("");
  const [availableIps, setAvailableIps] = useState([]);
  const [availableIpsLoading, setAvailableIpsLoading] = useState(false);
  const [showNewInstallationForm, setShowNewInstallationForm] = useState(false);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");

  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("");
  const [ticketCustomerSearch, setTicketCustomerSearch] = useState("");
  const [ticketFormOpen, setTicketFormOpen] = useState(false);

  const [companySettings, setCompanySettings] = useState({
    brand: "",
    business_name: "",
    cuit: "",
    locality: "",
    phone: "",
    address: "",
    email: "",
    website: "",
  });

  const [systemUsers, setSystemUsers] = useState([]);
  const [userForm, setUserForm] = useState({
    id: null,
    username: "",
    password: "",
    role: "operador",
    full_name: "",
    email: "",
  });
  const [userFormMode, setUserFormMode] = useState("create");
  const [showUserForm, setShowUserForm] = useState(false);

  const [notificationCustomerSearch, setNotificationCustomerSearch] =
    useState("");
  const [notificationForm, setNotificationForm] = useState({
    customer_id: "",
    type: "payment_reminder",
    invoice_id: "",
    custom_message: "",
  });
  const [generatedNotificationMessage, setGeneratedNotificationMessage] =
    useState("");

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
    priority: "medium",
    assigned_technician: "",
    category: "",
  });

  const [installationForm, setInstallationForm] = useState({
    customer_name: "",
    customer_last_name: "",
    customer_dni: "",
    customer_email: "",
    customer_email_cc: "",
    customer_phone: "",
    customer_zone: "",
    customer_city: "",
    customer_address: "",
    customer_external_id: "",
    customer_coordinates: "",
    contract_type: "",
    installation_cost: "",
    comments: "",
    pppoe_username: "",
    pppoe_password: "",
    remote_address: "",
    mac_cpe: "",
    local_address_pppoe: "",
    router_id: "",
    client_zone: "",
    plan_id: "",
    technician: "",
    scheduled_date: "",
    installation_status: "Nueva",
    sector_node_nap: "",
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
  const canViewCompanySettings = role === "admin";
  const canManageUsers = role === "admin";
  const canViewNotifications = ["admin", "cobrador", "operador", "tecnico"].includes(role);
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
          axios.get(`${API}/invoice-promises/invoices`, headers).catch(() => axios.get(`${API}/invoices`, headers)),
          axios.get(`${API}/customers`, headers),
        ]);

        setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
        setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      }

      if (canViewTickets) {
        const [ticketsRes, customersTicketsRes] = await Promise.all([
          axios.get(`${API}/tickets`, headers),
          axios
            .get(`${API}/customers/list-all`, headers)
            .catch(() => axios.get(`${API}/customers`, headers)),
        ]);

        setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : []);

        if (!canViewInvoices) {
          setCustomers(
            Array.isArray(customersTicketsRes.data)
              ? customersTicketsRes.data
              : Array.isArray(customersTicketsRes.data?.value)
              ? customersTicketsRes.data.value
              : []
          );
        }
      }

      if (canViewInstallations) {
        const [installationsRes, routersRes, plansRes] = await Promise.all([
          axios.get(`${API}/installations`, headers),
          axios.get(`${API}/routers`, headers).catch(() => ({ data: [] })),
          axios.get(`${API}/plans`, headers).catch(() => ({ data: [] })),
        ]);

        const routersData = Array.isArray(routersRes.data)
          ? routersRes.data
          : Array.isArray(routersRes.data?.value)
          ? routersRes.data.value
          : Array.isArray(routersRes.data?.routers)
          ? routersRes.data.routers
          : [];

        const plansData = Array.isArray(plansRes.data)
          ? plansRes.data
          : Array.isArray(plansRes.data?.value)
          ? plansRes.data.value
          : Array.isArray(plansRes.data?.plans)
          ? plansRes.data.plans
          : [];

        setInstallations(
          Array.isArray(installationsRes.data) ? installationsRes.data : []
        );
        setInstallationRouters(routersData);
        setInstallationPlans(plansData);
      }

      if (canViewStats) {
        const res = await axios.get(`${API}/dashboard/stats`, headers);
        setStats(res.data);
      }

      if (canViewClientStatus) {
        const res = await axios.get(`${API}/dashboard/clients-status`, headers);
        setClientStatus(res.data);
      }

      if (canViewCompanySettings) {
        const res = await axios
          .get(`${API}/company-settings`, headers)
          .catch(() => null);

        if (res?.data?.settings) {
          setCompanySettings(res.data.settings);
        }
      }

      if (canManageUsers) {
        const usersRes = await axios
          .get(`${API}/users-management`, headers)
          .catch(() => ({ data: [] }));

        setSystemUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
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

  const setPaymentPromise = async (invoice) => {
    const currentDate = invoice.payment_promise_date || "";
    const promiseDate = window.prompt(
      "Fecha de promesa de pago. Formato recomendado: AAAA-MM-DD",
      currentDate
    );

    if (promiseDate === null) return;

    if (!promiseDate.trim()) {
      alert("Ingresá una fecha válida.");
      return;
    }

    const currentNote = invoice.payment_promise_note || "";
    const note = window.prompt(
      "Nota de la promesa de pago",
      currentNote || "Cliente avisa que paga en unos días"
    );

    if (note === null) return;

    try {
      await axios.put(
        `${API}/invoice-promises/invoices/${invoice.id}`,
        {
          promise_date: promiseDate.trim(),
          note: note || "",
        },
        getAuthHeaders()
      );

      await loadData();

      alert("Promesa de pago registrada.");
    } catch (error) {
      console.error("Error registrando promesa de pago:", error);

      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Error desconocido";

      alert(`No se pudo registrar la promesa de pago.

${detail}`);
    }
  };

  const clearPaymentPromise = async (invoiceId) => {
    const ok = window.confirm("¿Cancelar la promesa de pago de esta factura?");

    if (!ok) return;

    try {
      await axios.put(
        `${API}/invoice-promises/invoices/${invoiceId}/clear`,
        {},
        getAuthHeaders()
      );

      await loadData();

      alert("Promesa de pago cancelada.");
    } catch (error) {
      console.error("Error cancelando promesa de pago:", error);
      alert("No se pudo cancelar la promesa de pago.");
    }
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

  const downloadInvoiceComprobante = async (invoiceId) => {
    try {
      const res = await axios.get(
        `${API}/invoices/${invoiceId}/comprobante-pdf`,
        {
          ...getAuthHeaders(),
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], {
        type: "application/pdf",
      });

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `comprobante_factura_${invoiceId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Error descargando comprobante:", error);

      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Error desconocido";

      alert(`No se pudo descargar el comprobante.\n\n${detail}`);
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

    try {
      if (!ticketForm.customer_id) {
        alert("Seleccioná un cliente para el ticket.");
        return;
      }

      if (!ticketForm.title) {
        alert("Ingresá el título del ticket.");
        return;
      }

      await axios.post(
        `${API}/tickets`,
        {
          customer_id: Number(ticketForm.customer_id),
          title: ticketForm.title,
          description: ticketForm.description,
          priority: ticketForm.priority || "medium",
          assigned_technician: ticketForm.assigned_technician || "",
          category: ticketForm.category || "",
        },
        getAuthHeaders()
      );

      setTicketForm({
        customer_id: "",
        title: "",
        description: "",
        priority: "medium",
        assigned_technician: "",
        category: "",
      });

      setTicketCustomerSearch("");
      setTicketFormOpen(false);

      await loadData();

      alert("Ticket creado correctamente.");
    } catch (error) {
      console.error("Error creando ticket:", error);

      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Error desconocido";

      alert(`No se pudo crear el ticket.\n\n${detail}`);
    }
  };

  const startTicket = async (id) => {
    try {
      await axios.put(`${API}/tickets/${id}/start`, {}, getAuthHeaders());
      await loadData();
    } catch (error) {
      alert("No se pudo poner el ticket en proceso.");
    }
  };

  const closeTicket = async (id) => {
    try {
      await axios.put(`${API}/tickets/${id}/close`, {}, getAuthHeaders());
      await loadData();
    } catch (error) {
      alert("No se pudo cerrar el ticket.");
    }
  };

  const reopenTicket = async (id) => {
    try {
      await axios.put(`${API}/tickets/${id}/reopen`, {}, getAuthHeaders());
      await loadData();
    } catch (error) {
      alert("No se pudo reabrir el ticket.");
    }
  };

  const updateInstallationForm = (field, value) => {
    setInstallationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getPlanText = (plan) => {
    return `${plan?.name || ""} ${plan?.plan_name || ""} ${
      plan?.nombre || ""
    }`.trim();
  };

  const getSuggestedPoolName = (planId = installationForm.plan_id) => {
    const selectedPlan = installationPlans.find(
      (plan) => Number(plan.id) === Number(planId)
    );

    const planText = getPlanText(selectedPlan);
    const speedMatch = planText.match(/(\d+)\s*M/i);
    const speed = speedMatch ? speedMatch[1] : "";

    return speed ? `Pool-${speed}M` : "";
  };

  const loadMikrotikPools = async (routerId) => {
    try {
      if (!routerId) {
        setMikrotikPools([]);
        setSelectedPoolName("");
        return;
      }

      const res = await axios.get(
        `${API}/installations/mikrotik-pools?router_id=${routerId}`,
        getAuthHeaders()
      );

      const pools = Array.isArray(res.data?.pools) ? res.data.pools : [];

      setMikrotikPools(pools);

      const suggested = getSuggestedPoolName();
      const matchingPool = suggested
        ? pools.find(
            (pool) =>
              String(pool.name || "").toLowerCase() === suggested.toLowerCase()
          )
        : null;

      if (matchingPool) {
        setSelectedPoolName(matchingPool.name);
      } else if (pools.length > 0) {
        setSelectedPoolName(pools[0].name);
      } else {
        setSelectedPoolName("");
      }

      setAvailableIps([]);
    } catch (error) {
      console.error("Error cargando pools MikroTik:", error);
      alert("No se pudieron cargar los pools del router seleccionado.");
    }
  };

  const loadAvailableIps = async () => {
    try {
      if (!installationForm.router_id) {
        alert("Seleccioná primero el router MikroTik.");
        return;
      }

      let poolName = selectedPoolName || getSuggestedPoolName();

      if (!poolName) {
        alert("Seleccioná un pool o un plan para buscar IPs libres.");
        return;
      }

      setAvailableIpsLoading(true);

      const res = await axios.get(
        `${API}/installations/remote-address-pool/available?router_id=${
          installationForm.router_id
        }&pool_name=${encodeURIComponent(poolName)}&limit=5000`,
        getAuthHeaders()
      );

      const ips = Array.isArray(res.data?.available_ips)
        ? res.data.available_ips
        : [];

      setSelectedPoolName(res.data?.pool_name || poolName);
      setAvailableIps(ips);

      if (ips.length > 0 && !installationForm.remote_address) {
        updateInstallationForm("remote_address", ips[0]);
      }

      if (ips.length === 0) {
        alert(res.data?.message || "No se encontraron IPs libres.");
      }
    } catch (error) {
      console.error("Error buscando IPs disponibles:", error);
      alert("No se pudieron buscar IPs disponibles.");
    } finally {
      setAvailableIpsLoading(false);
    }
  };

  const buildInstallationNotes = () => {
    const parts = [];

    if (installationForm.customer_dni) {
      parts.push(`DNI/C.I./C.C.: ${installationForm.customer_dni}`);
    }

    if (installationForm.customer_email) {
      parts.push(`Email: ${installationForm.customer_email}`);
    }

    if (installationForm.customer_email_cc) {
      parts.push(`Emails C.C.: ${installationForm.customer_email_cc}`);
    }

    if (installationForm.customer_external_id) {
      parts.push(`External ID: ${installationForm.customer_external_id}`);
    }

    if (installationForm.customer_coordinates) {
      parts.push(`Coordenadas: ${installationForm.customer_coordinates}`);
    }

    if (installationForm.customer_city) {
      parts.push(`Ciudad/Municipio: ${installationForm.customer_city}`);
    }

    if (installationForm.contract_type) {
      parts.push(`Forma de contratación: ${installationForm.contract_type}`);
    }

    if (installationForm.installation_cost) {
      parts.push(`Costo instalación: ${installationForm.installation_cost}`);
    }

    if (installationForm.mac_cpe) {
      parts.push(`MAC CPE: ${installationForm.mac_cpe}`);
    }

    if (installationForm.local_address_pppoe) {
      parts.push(`Local Address PPPoE: ${installationForm.local_address_pppoe}`);
    }

    if (installationForm.client_zone) {
      parts.push(`Zona cliente: ${installationForm.client_zone}`);
    }

    if (installationForm.installation_status) {
      parts.push(`Estado instalación inicial: ${installationForm.installation_status}`);
    }

    if (installationForm.sector_node_nap) {
      parts.push(`Sectorial/Nodo/NAP: ${installationForm.sector_node_nap}`);
    }

    if (installationForm.comments) {
      parts.push(`Comentarios: ${installationForm.comments}`);
    }

    if (installationForm.notes) {
      parts.push(`Notas internas: ${installationForm.notes}`);
    }

    return parts.join("\\n");
  };

  const resetInstallationForm = () => {
    setInstallationForm({
      customer_name: "",
      customer_last_name: "",
      customer_dni: "",
      customer_email: "",
      customer_email_cc: "",
      customer_phone: "",
      customer_zone: "",
      customer_city: "",
      customer_address: "",
      customer_external_id: "",
      customer_coordinates: "",
      contract_type: "",
      installation_cost: "",
      comments: "",
      pppoe_username: "",
      pppoe_password: "",
      remote_address: "",
      mac_cpe: "",
      local_address_pppoe: "",
      router_id: "",
      client_zone: "",
      plan_id: "",
      technician: "",
      scheduled_date: "",
      installation_status: "Nueva",
      sector_node_nap: "",
      installation_type: "",
      notes: "",
    });

    setSelectedPoolName("");
    setMikrotikPools([]);
    setAvailableIps([]);
  };

  const createInstallation = async (e) => {
    e.preventDefault();

    try {
      if (!installationForm.customer_name) {
        alert("Ingresá el nombre del cliente.");
        return;
      }

      if (!installationForm.pppoe_username) {
        alert("Ingresá el Nombre Secret PPPoE.");
        return;
      }

      if (!installationForm.pppoe_password) {
        alert("Ingresá el Password PPPoE.");
        return;
      }

      if (!installationForm.remote_address) {
        alert("Seleccioná o ingresá el Remote Address PPPoE.");
        return;
      }

      await axios.post(
        `${API}/installations/create-with-customer`,
        {
          customer: {
            name: installationForm.customer_name,
            last_name: installationForm.customer_last_name,
            phone: installationForm.customer_phone,
            zone: installationForm.customer_zone || installationForm.client_zone,
            address: installationForm.customer_address,
            pppoe_username: installationForm.pppoe_username,
            pppoe_password: installationForm.pppoe_password,
            remote_address: installationForm.remote_address,
            plan_id: installationForm.plan_id
              ? Number(installationForm.plan_id)
              : null,
            router_id: installationForm.router_id
              ? Number(installationForm.router_id)
              : null,
            status: "pending_installation",
          },
          installation: {
            router_id: installationForm.router_id
              ? Number(installationForm.router_id)
              : null,
            technician: installationForm.technician,
            scheduled_date: installationForm.scheduled_date,
            address: installationForm.customer_address,
            installation_type: installationForm.installation_type,
            notes: buildInstallationNotes(),
          },
        },
        getAuthHeaders()
      );

      resetInstallationForm();
      setShowNewInstallationForm(false);
      await loadData();

      alert("Instalación guardada correctamente.");
    } catch (error) {
      console.error("Error guardando instalación:", error);

      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Error desconocido";

      alert(`No se pudo guardar la instalación.\\n\\n${detail}`);
    }
  };

  const completeInstallation = async (id) => {
    try {
      const res = await axios.put(
        `${API}/installations/${id}/complete`,
        {},
        getAuthHeaders()
      );

      await loadData();

      const mikrotikStatus = res.data?.mikrotik?.status || "-";
      const mikrotikMessage = res.data?.mikrotik?.message || "-";

      alert(
        `Instalación completada.

Cliente: activo
MikroTik: ${mikrotikStatus}
${mikrotikMessage}`
      );
    } catch (error) {
      console.error("Error completando instalación:", error);

      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Error desconocido";

      alert(`No se pudo completar la instalación.

${detail}`);
    }
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

  const getTicketCustomer = (customerId) => {
    return customers.find(
      (customer) => Number(customer.id) === Number(customerId)
    );
  };

  const ticketCustomerMatches = customers
    .filter((customer) => {
      const status = String(customer.status || "").toLowerCase();

      if (status === "deleted" || status === "pending_installation") {
        return false;
      }

      const text = `
        ${customer.id || ""}
        ${customer.name || ""}
        ${customer.last_name || ""}
        ${customer.pppoe_username || ""}
        ${customer.remote_address || ""}
        ${customer.phone || ""}
        ${customer.zone || ""}
      `.toLowerCase();

      return text.includes(ticketCustomerSearch.toLowerCase());
    })
    .slice(0, 8);

  const selectedTicketCustomer = getTicketCustomer(ticketForm.customer_id);

  const filteredTickets = tickets.filter((ticket) => {
    const text = `
      ${ticket.id || ""}
      ${ticket.customer_id || ""}
      ${ticket.customer_name || ""}
      ${ticket.customer_pppoe_username || ""}
      ${ticket.customer_ip || ""}
      ${ticket.customer_phone || ""}
      ${ticket.customer_zone || ""}
      ${ticket.title || ""}
      ${ticket.description || ""}
      ${ticket.status || ""}
      ${ticket.priority || ""}
      ${ticket.assigned_technician || ""}
      ${ticket.category || ""}
    `.toLowerCase();

    const matchesSearch = text.includes(ticketSearch.toLowerCase());

    const matchesStatus = ticketStatusFilter
      ? ticket.status === ticketStatusFilter
      : ticket.status !== "closed";

    const matchesPriority = ticketPriorityFilter
      ? ticket.priority === ticketPriorityFilter
      : true;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const openTickets = tickets.filter((ticket) => ticket.status === "open");
  const inProgressTickets = tickets.filter(
    (ticket) => ticket.status === "in_progress"
  );
  const closedTickets = tickets.filter((ticket) => ticket.status === "closed");
  const highPriorityTickets = tickets.filter(
    (ticket) => ticket.priority === "high"
  );

  const visibleInstallations = installations.filter(
    (installation) =>
      installation.status !== "completed" &&
      installation.status !== "cancelled"
  );

  const updateCompanySetting = (field, value) => {
    setCompanySettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveCompanySettings = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.put(
        `${API}/company-settings`,
        companySettings,
        getAuthHeaders()
      );

      setCompanySettings(res.data?.settings || companySettings);

      alert("Datos de empresa guardados correctamente.");
    } catch (error) {
      console.error("Error guardando datos de empresa:", error);

      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Error desconocido";

      alert(`No se pudieron guardar los datos de empresa.\n\n${detail}`);
    }
  };

  const resetUserForm = () => {
    setUserForm({
      id: null,
      username: "",
      password: "",
      role: "operador",
      full_name: "",
      email: "",
    });

    setUserFormMode("create");
  };

  const editSystemUser = (user) => {
    setUserForm({
      id: user.id,
      username: user.username || "",
      password: "",
      role: user.role || "operador",
      full_name: user.full_name || "",
      email: user.email || "",
    });

    setUserFormMode("edit");
    setShowUserForm(true);
  };

  const saveSystemUser = async (e) => {
    e.preventDefault();

    try {
      if (!userForm.username) {
        alert("Ingresá el usuario.");
        return;
      }

      if (userFormMode === "create" && !userForm.password) {
        alert("Ingresá la contraseña.");
        return;
      }

      if (userFormMode === "create") {
        await axios.post(
          `${API}/users-management`,
          {
            username: userForm.username,
            password: userForm.password,
            role: userForm.role,
            full_name: userForm.full_name,
            email: userForm.email,
          },
          getAuthHeaders()
        );
      } else {
        await axios.put(
          `${API}/users-management/${userForm.id}`,
          {
            username: userForm.username,
            role: userForm.role,
            full_name: userForm.full_name,
            email: userForm.email,
          },
          getAuthHeaders()
        );

        if (userForm.password) {
          await axios.put(
            `${API}/users-management/${userForm.id}/password`,
            {
              password: userForm.password,
            },
            getAuthHeaders()
          );
        }
      }

      resetUserForm();
      setShowUserForm(false);
      await loadData();

      alert("Usuario guardado correctamente.");
    } catch (error) {
      console.error("Error guardando usuario:", error);

      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Error desconocido";

      alert(`No se pudo guardar el usuario.\n\n${detail}`);
    }
  };

  const disableSystemUser = async (userId) => {
    const ok = window.confirm("¿Deshabilitar este usuario?");

    if (!ok) return;

    try {
      await axios.put(
        `${API}/users-management/${userId}/disable`,
        {},
        getAuthHeaders()
      );

      await loadData();
    } catch (error) {
      alert(error.response?.data?.detail || "No se pudo deshabilitar el usuario.");
    }
  };

  const enableSystemUser = async (userId) => {
    try {
      await axios.put(
        `${API}/users-management/${userId}/enable`,
        {},
        getAuthHeaders()
      );

      await loadData();
    } catch (error) {
      alert("No se pudo habilitar el usuario.");
    }
  };

  const normalizeWhatsAppPhone = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");

    if (!digits) return "";

    if (digits.startsWith("549")) return digits;

    if (digits.startsWith("54")) return digits;

    // Argentina: si el número local no trae país, agregamos 54.
    return `54${digits}`;
  };

  const getCustomerById = (customerId) => {
    return customers.find(
      (customer) => Number(customer.id) === Number(customerId)
    );
  };

  const getInvoiceById = (invoiceId) => {
    return invoices.find((invoice) => Number(invoice.id) === Number(invoiceId));
  };

  const getCustomerFullName = (customer) => {
    if (!customer) return "";

    return `${customer.name || ""} ${customer.last_name || ""}`.trim();
  };

  const getCustomerInvoices = (customerId) => {
    return invoices.filter(
      (invoice) => Number(invoice.customer_id) === Number(customerId)
    );
  };

  const getPendingCustomerInvoices = (customerId) => {
    return getCustomerInvoices(customerId).filter(
      (invoice) => String(invoice.status || "").toLowerCase() === "pending"
    );
  };

  const formatNotificationMoney = (value) => {
    return `$ ${Number(value || 0).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const selectedNotificationCustomer = getCustomerById(
    notificationForm.customer_id
  );

  const selectedNotificationInvoice = getInvoiceById(
    notificationForm.invoice_id
  );

  const notificationCustomerMatches = customers
    .filter((customer) => {
      const status = String(customer.status || "").toLowerCase();

      if (status === "deleted" || status === "pending_installation") {
        return false;
      }

      const text = `
        ${customer.id || ""}
        ${customer.name || ""}
        ${customer.last_name || ""}
        ${customer.pppoe_username || ""}
        ${customer.remote_address || ""}
        ${customer.phone || ""}
        ${customer.zone || ""}
      `.toLowerCase();

      return text.includes(notificationCustomerSearch.toLowerCase());
    })
    .slice(0, 10);

  const pendingInvoiceNotifications = invoices
    .filter((invoice) => String(invoice.status || "").toLowerCase() === "pending")
    .slice(0, 10);

  const promiseNotifications = invoices
    .filter((invoice) => invoice.payment_promise_status === "active")
    .slice(0, 10);

  const ticketNotifications = tickets
    .filter((ticket) => String(ticket.status || "").toLowerCase() !== "closed")
    .slice(0, 10);

  const buildNotificationMessage = (
    type = notificationForm.type,
    customer = selectedNotificationCustomer,
    invoice = selectedNotificationInvoice
  ) => {
    const companyName =
      companySettings.brand ||
      companySettings.business_name ||
      "HighSpeed ISP";

    const customerName = getCustomerFullName(customer) || "cliente";
    const pppoe = customer?.pppoe_username || "-";
    const ip = customer?.remote_address || "-";
    const amount = invoice ? formatNotificationMoney(invoice.amount) : "-";
    const dueDate = invoice?.due_date || "-";
    const promiseDate = invoice?.payment_promise_date || "-";

    if (type === "payment_reminder") {
      return `Hola ${customerName}, te contactamos de ${companyName}. Te recordamos que tenés una factura pendiente por ${amount}, con vencimiento ${dueDate}. Usuario PPPoE: ${pppoe}.`;
    }

    if (type === "overdue_notice") {
      return `Hola ${customerName}, te contactamos de ${companyName}. Registramos una factura vencida por ${amount}, vencida el ${dueDate}. Para evitar suspensión del servicio, por favor regularizá el pago. Usuario PPPoE: ${pppoe}.`;
    }

    if (type === "payment_promise") {
      return `Hola ${customerName}, de ${companyName}. Tenemos registrada tu promesa de pago para el día ${promiseDate}. Te recordamos el importe pendiente: ${amount}. Muchas gracias.`;
    }

    if (type === "cut_warning") {
      return `Hola ${customerName}, de ${companyName}. Tu servicio de internet figura con deuda pendiente por ${amount}. Si no se regulariza, puede aplicarse suspensión. Usuario PPPoE: ${pppoe}.`;
    }

    if (type === "ticket_update") {
      return `Hola ${customerName}, de ${companyName}. Te informamos que estamos revisando tu solicitud técnica. Usuario PPPoE: ${pppoe}. IP: ${ip}.`;
    }

    if (type === "installation_reminder") {
      return `Hola ${customerName}, de ${companyName}. Te recordamos que tenés una instalación/visita técnica programada. Ante cualquier cambio, avisanos por este medio.`;
    }

    if (type === "custom") {
      return notificationForm.custom_message || "";
    }

    return "";
  };

  const updateGeneratedNotification = () => {
    const message = buildNotificationMessage();

    setGeneratedNotificationMessage(message);

    return message;
  };

  const openWhatsAppNotification = (
    customer = selectedNotificationCustomer,
    message = generatedNotificationMessage || buildNotificationMessage()
  ) => {
    if (!customer) {
      alert("Seleccioná un cliente.");
      return;
    }

    const phone = normalizeWhatsAppPhone(customer.phone);

    if (!phone) {
      alert("El cliente no tiene teléfono cargado.");
      return;
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyNotificationMessage = async () => {
    const message = generatedNotificationMessage || buildNotificationMessage();

    try {
      await navigator.clipboard.writeText(message);
      alert("Mensaje copiado.");
    } catch (error) {
      const textArea = document.createElement("textarea");
      textArea.value = message;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
      alert("Mensaje copiado.");
    }
  };

  const quickWhatsAppForInvoice = (invoice, type = "payment_reminder") => {
    const customer =
      getCustomerById(invoice.customer_id) ||
      {
        id: invoice.customer_id,
        name: invoice.customer_name || "",
        phone: invoice.customer_phone || "",
        pppoe_username: invoice.customer_pppoe_username || "",
        remote_address: invoice.customer_ip || "",
      };

    const message = buildNotificationMessage(type, customer, invoice);

    openWhatsAppNotification(customer, message);
  };

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

          {canViewNotifications && (
            <SidebarButton
              icon="💬"
              label="Notificaciones"
              active={section === "notifications"}
              onClick={() => setSection("notifications")}
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

          {canManageUsers && (
            <SidebarButton
              icon="👥"
              label="Usuarios"
              active={section === "users"}
              onClick={() => setSection("users")}
            />
          )}

          {canViewCompanySettings && (
            <SidebarButton
              icon="🏢"
              label="Empresa"
              active={section === "company"}
              onClick={() => setSection("company")}
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
              invoices={invoices}
              customers={customers}
              installations={installations}
              systemUsers={systemUsers}
              installationRouters={installationRouters}
              setSection={setSection}
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

                    {invoice.payment_promise_status === "active" && (
                      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                        <p className="font-bold">Promesa de pago activa</p>
                        <p>
                          <b>Fecha prometida:</b>{" "}
                          {invoice.payment_promise_date || "-"}
                        </p>
                        <p>
                          <b>Nota:</b>{" "}
                          {invoice.payment_promise_note || "-"}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 mt-4">
                      <button
                        className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500"
                        onClick={() => downloadInvoiceComprobante(invoice.id)}
                      >
                        Descargar comprobante PDF
                      </button>

                      {invoice.status === "pending" && canManageInvoices && (
                        <button
                          className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-500"
                          onClick={() => setPaymentPromise(invoice)}
                        >
                          {invoice.payment_promise_status === "active"
                            ? "Actualizar promesa"
                            : "Promesa de pago"}
                        </button>
                      )}

                      {invoice.payment_promise_status === "active" &&
                        canManageInvoices && (
                          <button
                            className="rounded-xl bg-slate-700 px-4 py-2 font-bold text-white hover:bg-slate-600"
                            onClick={() => clearPaymentPromise(invoice.id)}
                          >
                            Cancelar promesa
                          </button>
                        )}

                      {invoice.status === "pending" && canManageInvoices && (
                        <button
                          className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500"
                          onClick={() => payInvoice(invoice.id)}
                        >
                          Marcar pagada
                        </button>
                      )}
                    </div>
                  </Panel>
                );
              }}
            />
          </Module>
        )}

        {section === "notifications" && canViewNotifications && (
          <Module title="Notificaciones manuales">
            <Panel title="WhatsApp manual">
              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block font-bold text-slate-700">
                      Buscar cliente
                    </label>

                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                      placeholder="Buscar por nombre, PPPoE, IP, teléfono o zona..."
                      value={notificationCustomerSearch}
                      onChange={(e) =>
                        setNotificationCustomerSearch(e.target.value)
                      }
                    />

                    {notificationCustomerSearch &&
                      notificationCustomerMatches.length > 0 && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {notificationCustomerMatches.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  setNotificationForm({
                                    ...notificationForm,
                                    customer_id: customer.id,
                                    invoice_id: "",
                                  });

                                  setNotificationCustomerSearch(
                                    getCustomerFullName(customer)
                                  );

                                  setGeneratedNotificationMessage("");
                                }}
                                className="rounded-lg bg-white p-3 text-left text-sm hover:bg-blue-50 border border-slate-200"
                              >
                                <b>{getCustomerFullName(customer)}</b>
                                <br />
                                PPPoE: {customer.pppoe_username || "-"} · IP:{" "}
                                {customer.remote_address || "-"}
                                <br />
                                Tel: {customer.phone || "-"} · Zona:{" "}
                                {customer.zone || "-"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {selectedNotificationCustomer && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                      <h3 className="font-bold">Cliente seleccionado</h3>

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <p>
                          <b>Nombre:</b>{" "}
                          {getCustomerFullName(selectedNotificationCustomer)}
                        </p>
                        <p>
                          <b>PPPoE:</b>{" "}
                          {selectedNotificationCustomer.pppoe_username || "-"}
                        </p>
                        <p>
                          <b>IP:</b>{" "}
                          {selectedNotificationCustomer.remote_address || "-"}
                        </p>
                        <p>
                          <b>Teléfono:</b>{" "}
                          {selectedNotificationCustomer.phone || "-"}
                        </p>
                        <p>
                          <b>Zona:</b>{" "}
                          {selectedNotificationCustomer.zone || "-"}
                        </p>
                        <p>
                          <b>Estado:</b>{" "}
                          {selectedNotificationCustomer.status || "-"}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                      value={notificationForm.type}
                      onChange={(e) => {
                        setNotificationForm({
                          ...notificationForm,
                          type: e.target.value,
                        });

                        setGeneratedNotificationMessage("");
                      }}
                    >
                      <option value="payment_reminder">
                        Recordatorio de pago
                      </option>
                      <option value="overdue_notice">Factura vencida</option>
                      <option value="payment_promise">
                        Recordar promesa de pago
                      </option>
                      <option value="cut_warning">Aviso de posible corte</option>
                      <option value="ticket_update">Actualización técnica</option>
                      <option value="installation_reminder">
                        Recordatorio de instalación
                      </option>
                      <option value="custom">Mensaje personalizado</option>
                    </select>

                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                      value={notificationForm.invoice_id}
                      onChange={(e) => {
                        setNotificationForm({
                          ...notificationForm,
                          invoice_id: e.target.value,
                        });

                        setGeneratedNotificationMessage("");
                      }}
                    >
                      <option value="">Seleccionar factura opcional</option>
                      {getPendingCustomerInvoices(
                        notificationForm.customer_id
                      ).map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          Factura #{invoice.id} · $
                          {invoice.amount || 0} · vence {invoice.due_date || "-"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {notificationForm.type === "custom" && (
                    <textarea
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 min-h-28"
                      placeholder="Escribí el mensaje personalizado..."
                      value={notificationForm.custom_message}
                      onChange={(e) => {
                        setNotificationForm({
                          ...notificationForm,
                          custom_message: e.target.value,
                        });

                        setGeneratedNotificationMessage(e.target.value);
                      }}
                    />
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={updateGeneratedNotification}
                      className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
                    >
                      Generar mensaje
                    </button>

                    <button
                      type="button"
                      onClick={() => openWhatsAppNotification()}
                      className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-500"
                    >
                      Abrir WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={copyNotificationMessage}
                      className="rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-700"
                    >
                      Copiar mensaje
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 font-bold text-slate-900">
                    Vista previa del mensaje
                  </h3>

                  <div className="min-h-64 rounded-2xl border border-slate-200 bg-slate-50 p-5 whitespace-pre-wrap text-slate-700">
                    {generatedNotificationMessage ||
                      buildNotificationMessage() ||
                      "Seleccioná un cliente y generá un mensaje."}
                  </div>

                  <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                    Esta función abre WhatsApp manualmente. No envía mensajes
                    automáticos ni usa API paga.
                  </div>
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <Panel title="Facturas pendientes">
                <div className="space-y-3">
                  {pendingInvoiceNotifications.map((invoice) => (
                    <div
                      key={`pending-notification-${invoice.id}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <p className="font-bold text-slate-900">
                        {invoice.customer_name ||
                          `Cliente ${invoice.customer_id}`}
                      </p>
                      <p className="text-sm text-slate-500">
                        Factura #{invoice.id} · $
                        {invoice.amount || 0} · vence {invoice.due_date || "-"}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          quickWhatsAppForInvoice(invoice, "payment_reminder")
                        }
                        className="mt-3 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-500"
                      >
                        WhatsApp
                      </button>
                    </div>
                  ))}

                  {pendingInvoiceNotifications.length === 0 && (
                    <p className="text-slate-500">
                      No hay facturas pendientes para notificar.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel title="Promesas de pago">
                <div className="space-y-3">
                  {promiseNotifications.map((invoice) => (
                    <div
                      key={`promise-notification-${invoice.id}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <p className="font-bold text-slate-900">
                        {invoice.customer_name ||
                          `Cliente ${invoice.customer_id}`}
                      </p>
                      <p className="text-sm text-slate-500">
                        Prometió pagar:{" "}
                        {invoice.payment_promise_date || "-"}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          quickWhatsAppForInvoice(invoice, "payment_promise")
                        }
                        className="mt-3 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-500"
                      >
                        WhatsApp
                      </button>
                    </div>
                  ))}

                  {promiseNotifications.length === 0 && (
                    <p className="text-slate-500">
                      No hay promesas de pago activas.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel title="Tickets abiertos">
                <div className="space-y-3">
                  {ticketNotifications.map((ticket) => (
                    <div
                      key={`ticket-notification-${ticket.id}`}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <p className="font-bold text-slate-900">
                        {ticket.title || `Ticket #${ticket.id}`}
                      </p>
                      <p className="text-sm text-slate-500">
                        {ticket.customer_name || `Cliente ${ticket.customer_id}`} ·{" "}
                        {ticket.status || "-"}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          const customer =
                            getCustomerById(ticket.customer_id) ||
                            {
                              id: ticket.customer_id,
                              name: ticket.customer_name || "",
                              phone: ticket.customer_phone || "",
                              pppoe_username:
                                ticket.customer_pppoe_username || "",
                              remote_address: ticket.customer_ip || "",
                            };

                          const message = buildNotificationMessage(
                            "ticket_update",
                            customer,
                            null
                          );

                          openWhatsAppNotification(customer, message);
                        }}
                        className="mt-3 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-500"
                      >
                        WhatsApp
                      </button>
                    </div>
                  ))}

                  {ticketNotifications.length === 0 && (
                    <p className="text-slate-500">
                      No hay tickets abiertos para notificar.
                    </p>
                  )}
                </div>
              </Panel>
            </div>
          </Module>
        )}

        {section === "tickets" && (
          <Module title="Tickets / Soporte">
            <Panel title="Resumen de soporte">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatBox title="Total tickets" value={tickets.length} />

                <StatBox
                  title="Abiertos"
                  value={openTickets.length}
                  color="text-orange-500"
                />

                <StatBox
                  title="En proceso"
                  value={inProgressTickets.length}
                  color="text-blue-600"
                />

                <StatBox
                  title="Cerrados"
                  value={closedTickets.length}
                  color="text-green-600"
                />

                <StatBox
                  title="Alta prioridad"
                  value={highPriorityTickets.length}
                  color="text-red-600"
                />
              </div>
            </Panel>

            <Panel title="Tickets">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    🎫 Soporte técnico
                  </h2>
                  <p className="text-slate-500">
                    Asociá cada ticket a un cliente para ver sus datos de red.
                  </p>
                </div>

                {canManageTickets && (
                  <button
                    type="button"
                    onClick={() => setTicketFormOpen(!ticketFormOpen)}
                    className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
                  >
                    {ticketFormOpen ? "Cerrar formulario" : "➕ Nuevo ticket"}
                  </button>
                )}
              </div>
            </Panel>

            {canManageTickets && ticketFormOpen && (
              <Panel title="Crear ticket asociado a cliente">
                <form onSubmit={createTicket} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="mb-2 block font-bold text-slate-700">
                        Buscar cliente
                      </label>

                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                        placeholder="Buscar por nombre, usuario PPPoE, IP, teléfono o zona..."
                        value={ticketCustomerSearch}
                        onChange={(e) => setTicketCustomerSearch(e.target.value)}
                      />

                      {ticketCustomerSearch && ticketCustomerMatches.length > 0 && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {ticketCustomerMatches.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  setTicketForm({
                                    ...ticketForm,
                                    customer_id: customer.id,
                                  });

                                  setTicketCustomerSearch(
                                    `${customer.name || ""} ${
                                      customer.last_name || ""
                                    }`.trim()
                                  );
                                }}
                                className="rounded-lg bg-white p-3 text-left text-sm hover:bg-blue-50 border border-slate-200"
                              >
                                <b>
                                  {customer.name} {customer.last_name}
                                </b>
                                <br />
                                PPPoE: {customer.pppoe_username || "-"} · IP:{" "}
                                {customer.remote_address || "-"}
                                <br />
                                Tel: {customer.phone || "-"} · Zona:{" "}
                                {customer.zone || "-"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedTicketCustomer && (
                      <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <h3 className="font-bold text-blue-900">
                          Cliente seleccionado
                        </h3>

                        <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-slate-700">
                          <p>
                            <b>ID:</b> {selectedTicketCustomer.id}
                          </p>
                          <p>
                            <b>Nombre:</b> {selectedTicketCustomer.name}{" "}
                            {selectedTicketCustomer.last_name}
                          </p>
                          <p>
                            <b>PPPoE:</b>{" "}
                            {selectedTicketCustomer.pppoe_username || "-"}
                          </p>
                          <p>
                            <b>IP:</b>{" "}
                            {selectedTicketCustomer.remote_address || "-"}
                          </p>
                          <p>
                            <b>Teléfono:</b>{" "}
                            {selectedTicketCustomer.phone || "-"}
                          </p>
                          <p>
                            <b>Zona:</b> {selectedTicketCustomer.zone || "-"}
                          </p>
                          <p>
                            <b>Estado:</b>{" "}
                            {selectedTicketCustomer.status || "-"}
                          </p>
                          <p>
                            <b>Router:</b>{" "}
                            {selectedTicketCustomer.router_id || "-"}
                          </p>
                        </div>
                      </div>
                    )}

                    <Input
                      placeholder="Título del problema"
                      value={ticketForm.title}
                      onChange={(e) =>
                        setTicketForm({
                          ...ticketForm,
                          title: e.target.value,
                        })
                      }
                    />

                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                      value={ticketForm.priority}
                      onChange={(e) =>
                        setTicketForm({
                          ...ticketForm,
                          priority: e.target.value,
                        })
                      }
                    >
                      <option value="low">Prioridad baja</option>
                      <option value="medium">Prioridad media</option>
                      <option value="high">Prioridad alta</option>
                    </select>

                    <Input
                      placeholder="Técnico asignado"
                      value={ticketForm.assigned_technician}
                      onChange={(e) =>
                        setTicketForm({
                          ...ticketForm,
                          assigned_technician: e.target.value,
                        })
                      }
                    />

                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                      value={ticketForm.category}
                      onChange={(e) =>
                        setTicketForm({
                          ...ticketForm,
                          category: e.target.value,
                        })
                      }
                    >
                      <option value="">Tipo de problema</option>
                      <option value="sin_internet">Sin internet</option>
                      <option value="lento">Internet lento</option>
                      <option value="corte">Corte intermitente</option>
                      <option value="router_cliente">Router cliente</option>
                      <option value="facturacion">Facturación</option>
                      <option value="otro">Otro</option>
                    </select>

                    <textarea
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 min-h-28 md:col-span-2"
                      placeholder="Descripción del problema"
                      value={ticketForm.description}
                      onChange={(e) =>
                        setTicketForm({
                          ...ticketForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500">
                      💾 Guardar ticket
                    </button>

                    <button
                      type="button"
                      onClick={() => setTicketFormOpen(false)}
                      className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-700 hover:bg-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Panel>
            )}

            <Panel title="Buscar y filtrar tickets">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 md:col-span-2"
                  placeholder="Buscar por cliente, PPPoE, IP, técnico, título o descripción..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                />

                <select
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value)}
                >
                  <option value="">Activos sin cerrar</option>
                  <option value="open">Abiertos</option>
                  <option value="in_progress">En proceso</option>
                  <option value="closed">Cerrados</option>
                </select>

                <select
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                  value={ticketPriorityFilter}
                  onChange={(e) => setTicketPriorityFilter(e.target.value)}
                >
                  <option value="">Todas las prioridades</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </div>
            </Panel>

            <GridList
              items={filteredTickets}
              render={(ticket) => (
                <Panel
                  title={`Ticket #${ticket.id} - ${ticket.title}`}
                  key={ticket.id}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <p className="mb-3 whitespace-pre-wrap">
                        {ticket.description || "Sin descripción"}
                      </p>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-lg bg-slate-100 px-3 py-1 font-bold">
                          Estado: {ticket.status}
                        </span>

                        <span className="rounded-lg bg-slate-100 px-3 py-1 font-bold">
                          Prioridad: {ticket.priority || "medium"}
                        </span>

                        <span className="rounded-lg bg-slate-100 px-3 py-1 font-bold">
                          Técnico: {ticket.assigned_technician || "-"}
                        </span>

                        <span className="rounded-lg bg-slate-100 px-3 py-1 font-bold">
                          Tipo: {ticket.category || "-"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <h3 className="font-bold text-slate-900 mb-2">
                        Datos del cliente
                      </h3>

                      <p>
                        <b>ID:</b> {ticket.customer_id || "-"}
                      </p>
                      <p>
                        <b>Nombre:</b> {ticket.customer_name || "-"}
                      </p>
                      <p>
                        <b>PPPoE:</b>{" "}
                        {ticket.customer_pppoe_username || "-"}
                      </p>
                      <p>
                        <b>IP:</b> {ticket.customer_ip || "-"}
                      </p>
                      <p>
                        <b>Teléfono:</b> {ticket.customer_phone || "-"}
                      </p>
                      <p>
                        <b>Zona:</b> {ticket.customer_zone || "-"}
                      </p>
                    </div>
                  </div>

                  {canManageTickets && (
                    <div className="flex flex-wrap gap-3 mt-5">
                      {ticket.status === "open" && (
                        <button
                          className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500"
                          onClick={() => startTicket(ticket.id)}
                        >
                          En proceso
                        </button>
                      )}

                      {ticket.status !== "closed" && (
                        <button
                          className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500"
                          onClick={() => closeTicket(ticket.id)}
                        >
                          Cerrar
                        </button>
                      )}

                      {ticket.status === "closed" && (
                        <button
                          className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-white hover:bg-orange-400"
                          onClick={() => reopenTicket(ticket.id)}
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  )}
                </Panel>
              )}
            />
          </Module>
        )}

        {section === "installations" && (
          <Module title="Instalaciones">
            {canManageInstallations && (
              <Panel title="Gestión de instalaciones">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-950">
                      🧩 Agendar Instalación
                    </h2>
                    <p className="text-slate-500">
                      Creá una instalación con cliente nuevo, datos PPPoE,
                      router MikroTik, plan e IP disponible.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowNewInstallationForm(!showNewInstallationForm)
                    }
                    className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-500"
                  >
                    {showNewInstallationForm
                      ? "Cerrar formulario"
                      : "➕ Nueva instalación"}
                  </button>
                </div>
              </Panel>
            )}

            {canManageInstallations && showNewInstallationForm && (
              <Panel title="Agendar Instalación">
                <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
                  <button
                    type="button"
                    className="border-b-4 border-green-500 px-4 py-3 text-sm font-bold text-slate-900"
                  >
                    ⚙ Configuración Básica
                  </button>

                  <button
                    type="button"
                    className="px-4 py-3 text-sm font-bold text-slate-500"
                  >
                    ⚙ Configuración Avanzada
                  </button>
                </div>

                <form onSubmit={createInstallation} className="space-y-8">
                  <section>
                    <h3 className="mb-4 text-xl font-bold text-slate-900">
                      ℹ️ Datos del cliente
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-4 items-center">
                      <label className="font-bold text-slate-700 md:text-right">
                        Nombre
                      </label>
                      <Input
                        placeholder="Nombre"
                        value={installationForm.customer_name}
                        onChange={(e) =>
                          updateInstallationForm("customer_name", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Apellido
                      </label>
                      <Input
                        placeholder="Apellido"
                        value={installationForm.customer_last_name}
                        onChange={(e) =>
                          updateInstallationForm(
                            "customer_last_name",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        DNI/C.I./C.C.
                      </label>
                      <Input
                        placeholder="Documento"
                        value={installationForm.customer_dni}
                        onChange={(e) =>
                          updateInstallationForm("customer_dni", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Dirección de correo electrónico
                      </label>
                      <Input
                        type="email"
                        placeholder="correo@cliente.com"
                        value={installationForm.customer_email}
                        onChange={(e) =>
                          updateInstallationForm("customer_email", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Emails C.C
                      </label>
                      <Input
                        placeholder="Correos adicionales para enviar notificaciones"
                        value={installationForm.customer_email_cc}
                        onChange={(e) =>
                          updateInstallationForm(
                            "customer_email_cc",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Dirección
                      </label>
                      <textarea
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 min-h-20"
                        placeholder="Dirección del cliente"
                        value={installationForm.customer_address}
                        onChange={(e) =>
                          updateInstallationForm(
                            "customer_address",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        External ID
                      </label>
                      <Input
                        placeholder="Identificador de usuario externo"
                        value={installationForm.customer_external_id}
                        onChange={(e) =>
                          updateInstallationForm(
                            "customer_external_id",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Coordenadas
                      </label>
                      <Input
                        placeholder="Ej. -34.60,-58.38"
                        value={installationForm.customer_coordinates}
                        onChange={(e) =>
                          updateInstallationForm(
                            "customer_coordinates",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Barrio/Localidad/Departamento
                      </label>
                      <Input
                        placeholder="Escribe el nombre de la localidad"
                        value={installationForm.customer_zone}
                        onChange={(e) =>
                          updateInstallationForm("customer_zone", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Ciudad/Municipio
                      </label>
                      <Input
                        placeholder="Ciudad o municipio"
                        value={installationForm.customer_city}
                        onChange={(e) =>
                          updateInstallationForm("customer_city", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Teléfono Celular
                      </label>
                      <Input
                        placeholder="Teléfono"
                        value={installationForm.customer_phone}
                        onChange={(e) =>
                          updateInstallationForm("customer_phone", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Forma de contratación
                      </label>
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                        value={installationForm.contract_type}
                        onChange={(e) =>
                          updateInstallationForm("contract_type", e.target.value)
                        }
                      >
                        <option value="">Seleccionar</option>
                        <option value="Mensual">Mensual</option>
                        <option value="Prepago">Prepago</option>
                        <option value="Contrato">Contrato</option>
                        <option value="Otro">Otro</option>
                      </select>

                      <label className="font-bold text-slate-700 md:text-right">
                        Fecha instalación
                      </label>
                      <Input
                        type="date"
                        value={installationForm.scheduled_date}
                        onChange={(e) =>
                          updateInstallationForm("scheduled_date", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Costo instalación
                      </label>
                      <Input
                        type="number"
                        placeholder="$ Costo de instalación"
                        value={installationForm.installation_cost}
                        onChange={(e) =>
                          updateInstallationForm(
                            "installation_cost",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right self-start pt-3">
                        Comentarios
                      </label>
                      <textarea
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 min-h-44"
                        placeholder="Comentarios"
                        value={installationForm.comments}
                        onChange={(e) =>
                          updateInstallationForm("comments", e.target.value)
                        }
                      />
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-4 text-xl font-bold text-slate-900">
                      📶 Datos de Conexión
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-4 items-center">
                      <label className="font-bold text-slate-700 md:text-right">
                        Nombre Secret PPPoE
                      </label>
                      <Input
                        placeholder="Usuario PPPoE"
                        value={installationForm.pppoe_username}
                        onChange={(e) =>
                          updateInstallationForm("pppoe_username", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Password PPPoE
                      </label>
                      <Input
                        placeholder="Password PPPoE"
                        value={installationForm.pppoe_password}
                        onChange={(e) =>
                          updateInstallationForm("pppoe_password", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Routers MikroTik
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                        <select
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                          value={installationForm.router_id}
                          onChange={(e) => {
                            const routerId = e.target.value;
                            updateInstallationForm("router_id", routerId);
                            updateInstallationForm("remote_address", "");
                            loadMikrotikPools(routerId);
                          }}
                        >
                          <option value="">Seleccionar router MikroTik</option>
                          {installationRouters.map((router) => (
                            <option key={router.id} value={router.id}>
                              {router.name || `Router ${router.id}`}
                              {router.host ? ` - ${router.host}` : ""}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            loadMikrotikPools(installationForm.router_id)
                          }
                          className="rounded-xl bg-slate-800 px-4 py-3 font-bold text-white hover:bg-slate-700"
                        >
                          Cargar pools MikroTik
                        </button>
                      </div>

                      <label className="font-bold text-slate-700 md:text-right">
                        Plan internet
                      </label>
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                        value={installationForm.plan_id}
                        onChange={(e) => {
                          const planId = e.target.value;
                          updateInstallationForm("plan_id", planId);

                          const suggested = getSuggestedPoolName(planId);
                          const pool = mikrotikPools.find(
                            (item) =>
                              String(item.name || "").toLowerCase() ===
                              suggested.toLowerCase()
                          );

                          if (pool) {
                            setSelectedPoolName(pool.name);
                            setAvailableIps([]);
                          }
                        }}
                      >
                        <option value="">Seleccionar plan</option>
                        {installationPlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name ||
                              plan.plan_name ||
                              plan.nombre ||
                              `Plan ${plan.id}`}
                            {plan.price ? ` - $${plan.price}` : ""}
                          </option>
                        ))}
                      </select>

                      <label className="font-bold text-slate-700 md:text-right">
                        Remote Address PPPoE
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-3">
                          <select
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                            value={selectedPoolName}
                            onChange={(e) => {
                              setSelectedPoolName(e.target.value);
                              setAvailableIps([]);
                              updateInstallationForm("remote_address", "");
                            }}
                          >
                            <option value="">
                              {mikrotikPools.length > 0
                                ? "Seleccionar pool"
                                : "Primero cargá pools del router"}
                            </option>
                            {mikrotikPools.map((pool) => (
                              <option key={pool.name} value={pool.name}>
                                {pool.name}
                                {pool.total_count
                                  ? ` (${pool.total_count} IPs)`
                                  : ""}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={loadAvailableIps}
                            disabled={availableIpsLoading}
                            className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-500 disabled:opacity-60"
                          >
                            {availableIpsLoading
                              ? "Buscando..."
                              : "Buscar IP libre"}
                          </button>

                          <Input
                            placeholder="Remote Address seleccionado"
                            value={installationForm.remote_address}
                            onChange={(e) =>
                              updateInstallationForm(
                                "remote_address",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {availableIps.length > 0 && (
                          <div className="mt-4">
                            <select
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                              value={installationForm.remote_address}
                              onChange={(e) =>
                                updateInstallationForm(
                                  "remote_address",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">Seleccionar IP disponible</option>
                              {availableIps.map((ip) => (
                                <option key={ip} value={ip}>
                                  {ip}
                                </option>
                              ))}
                            </select>

                            <p className="mt-2 text-xs text-slate-500">
                              IPs disponibles filtradas para evitar duplicados.
                            </p>
                          </div>
                        )}
                      </div>

                      <label className="font-bold text-slate-700 md:text-right">
                        Mac CPE
                      </label>
                      <Input
                        placeholder="MAC CPE"
                        value={installationForm.mac_cpe}
                        onChange={(e) =>
                          updateInstallationForm("mac_cpe", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Local Address PPPoE
                      </label>
                      <Input
                        placeholder="Local Address PPPoE"
                        value={installationForm.local_address_pppoe}
                        onChange={(e) =>
                          updateInstallationForm(
                            "local_address_pppoe",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Zona cliente
                      </label>
                      <Input
                        placeholder="Zona cliente"
                        value={installationForm.client_zone}
                        onChange={(e) =>
                          updateInstallationForm("client_zone", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Técnico
                      </label>
                      <Input
                        placeholder="Técnico"
                        value={installationForm.technician}
                        onChange={(e) =>
                          updateInstallationForm("technician", e.target.value)
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Estado instalación
                      </label>
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                        value={installationForm.installation_status}
                        onChange={(e) =>
                          updateInstallationForm(
                            "installation_status",
                            e.target.value
                          )
                        }
                      >
                        <option value="Nueva">Nueva</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Programada">Programada</option>
                      </select>

                      <label className="font-bold text-slate-700 md:text-right">
                        Sectorial/Nodo/NAP
                      </label>
                      <Input
                        placeholder="Sectorial / Nodo / NAP"
                        value={installationForm.sector_node_nap}
                        onChange={(e) =>
                          updateInstallationForm(
                            "sector_node_nap",
                            e.target.value
                          )
                        }
                      />

                      <label className="font-bold text-slate-700 md:text-right">
                        Tipo de instalación
                      </label>
                      <Input
                        placeholder="Fibra, inalámbrica, cambio de equipo..."
                        value={installationForm.installation_type}
                        onChange={(e) =>
                          updateInstallationForm(
                            "installation_type",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </section>

                  <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                    <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500">
                      💾 Guardar
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        resetInstallationForm();
                        setShowNewInstallationForm(false);
                      }}
                      className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-700 hover:bg-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Panel>
            )}

            <Panel title="Instalaciones pendientes">
              {visibleInstallations.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-500">
                  No hay instalaciones pendientes.
                </div>
              )}
            </Panel>

            <GridList
              items={visibleInstallations}
              render={(installation) => (
                <Panel
                  title={`Instalación #${installation.id}`}
                  key={installation.id}
                >
                  <p>
                    <b>Cliente:</b>{" "}
                    {installation.customer_name ||
                      installation.customer_id ||
                      "-"}
                  </p>
                  <p>
                    <b>Usuario PPPoE:</b>{" "}
                    {installation.customer_pppoe_username || "-"}
                  </p>
                  <p>
                    <b>IP:</b> {installation.customer_ip || "-"}
                  </p>
                  <p>
                    <b>Técnico:</b> {installation.technician || "-"}
                  </p>
                  <p>
                    <b>Fecha:</b> {installation.scheduled_date || "-"}
                  </p>
                  <p>
                    <b>Dirección:</b> {installation.address || "-"}
                  </p>
                  <p>
                    <b>Tipo:</b> {installation.installation_type || "-"}
                  </p>
                  <p>
                    <b>Estado:</b> {installation.status || "-"}
                  </p>
                  <p className="rounded-xl bg-slate-50 border border-slate-200 p-3 whitespace-pre-wrap">
                    {installation.notes || "Sin observaciones"}
                  </p>

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

        {section === "users" && canManageUsers && (
          <Module title="Usuarios y permisos">
            <Panel title="Gestión de usuarios">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    👥 Usuarios del sistema
                  </h2>
                  <p className="text-slate-500">
                    Creá usuarios y asigná permisos por rol.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetUserForm();
                    setShowUserForm(!showUserForm);
                  }}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
                >
                  {showUserForm ? "Cerrar formulario" : "➕ Nuevo usuario"}
                </button>
              </div>
            </Panel>

            <Panel title="Permisos por rol">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold text-slate-950">Admin</h3>
                  <p className="text-slate-500 mt-1">
                    Acceso total: clientes, facturas, tickets, instalaciones,
                    MikroTik, empresa y usuarios.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold text-slate-950">Técnico</h3>
                  <p className="text-slate-500 mt-1">
                    Clientes, online, tráfico, tickets e instalaciones.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold text-slate-950">Operador</h3>
                  <p className="text-slate-500 mt-1">
                    Clientes, planes, tickets, instalaciones y dashboard.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold text-slate-950">Cobrador</h3>
                  <p className="text-slate-500 mt-1">
                    Facturas, caja, pagos, promesa de pago y comprobantes.
                  </p>
                </div>
              </div>
            </Panel>

            {showUserForm && (
              <Panel
                title={
                  userFormMode === "create"
                    ? "Crear usuario"
                    : "Editar usuario"
                }
              >
                <form
                  onSubmit={saveSystemUser}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <Input
                    placeholder="Usuario"
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        username: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder={
                      userFormMode === "create"
                        ? "Contraseña"
                        : "Nueva contraseña opcional"
                    }
                    type="password"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        password: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="Nombre completo"
                    value={userForm.full_name}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        full_name: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="Email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        email: e.target.value,
                      })
                    }
                  />

                  <select
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400"
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        role: e.target.value,
                      })
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="tecnico">Técnico</option>
                    <option value="operador">Operador</option>
                    <option value="cobrador">Cobrador</option>
                  </select>

                  <div className="flex flex-wrap gap-3">
                    <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500">
                      💾 Guardar usuario
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        resetUserForm();
                        setShowUserForm(false);
                      }}
                      className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-700 hover:bg-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Panel>
            )}

            <Panel title="Usuarios registrados">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="p-3">ID</th>
                      <th className="p-3">Usuario</th>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Rol</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {systemUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="p-3">{user.id}</td>
                        <td className="p-3 font-bold">{user.username}</td>
                        <td className="p-3">{user.full_name || "-"}</td>
                        <td className="p-3">{user.email || "-"}</td>
                        <td className="p-3">
                          <span className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-lg px-3 py-1 text-xs font-bold ${
                              user.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {user.status === "active"
                              ? "Activo"
                              : "Deshabilitado"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => editSystemUser(user)}
                              className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-slate-950 hover:bg-yellow-400"
                            >
                              Editar
                            </button>

                            {user.status === "active" ? (
                              <button
                                type="button"
                                onClick={() => disableSystemUser(user.id)}
                                className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-500"
                              >
                                Deshabilitar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => enableSystemUser(user.id)}
                                className="rounded-lg bg-green-600 px-3 py-2 font-bold text-white hover:bg-green-500"
                              >
                                Habilitar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {systemUsers.length === 0 && (
                      <tr>
                        <td
                          colSpan="7"
                          className="p-5 text-center text-slate-500"
                        >
                          No hay usuarios registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </Module>
        )}

        {section === "company" && canViewCompanySettings && (
          <Module title="Configuración de empresa">
            <Panel title="Datos de empresa para comprobantes">
              <form onSubmit={saveCompanySettings} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Marca / Nombre comercial"
                    value={companySettings.brand}
                    onChange={(e) =>
                      updateCompanySetting("brand", e.target.value)
                    }
                  />

                  <Input
                    placeholder="Razón social / Titular"
                    value={companySettings.business_name}
                    onChange={(e) =>
                      updateCompanySetting("business_name", e.target.value)
                    }
                  />

                  <Input
                    placeholder="CUIT / DNI fiscal"
                    value={companySettings.cuit}
                    onChange={(e) =>
                      updateCompanySetting("cuit", e.target.value)
                    }
                  />

                  <Input
                    placeholder="Localidad"
                    value={companySettings.locality}
                    onChange={(e) =>
                      updateCompanySetting("locality", e.target.value)
                    }
                  />

                  <Input
                    placeholder="Teléfono"
                    value={companySettings.phone}
                    onChange={(e) =>
                      updateCompanySetting("phone", e.target.value)
                    }
                  />

                  <Input
                    placeholder="Email"
                    value={companySettings.email}
                    onChange={(e) =>
                      updateCompanySetting("email", e.target.value)
                    }
                  />

                  <Input
                    placeholder="Sitio web"
                    value={companySettings.website}
                    onChange={(e) =>
                      updateCompanySetting("website", e.target.value)
                    }
                  />

                  <textarea
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-blue-400 min-h-28 md:col-span-2"
                    placeholder="Dirección"
                    value={companySettings.address}
                    onChange={(e) =>
                      updateCompanySetting("address", e.target.value)
                    }
                  />
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  Estos datos se usan en el PDF individual de cada factura /
                  comprobante.
                </div>

                <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500">
                  💾 Guardar datos de empresa
                </button>
              </form>
            </Panel>

            <Panel title="Vista previa">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-2xl font-bold text-slate-950">
                  {companySettings.brand || "Nombre comercial"}
                </h2>

                <p className="text-slate-600 mt-1">
                  {companySettings.business_name || "Razón social"}
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
                  <p>
                    <b>CUIT:</b> {companySettings.cuit || "-"}
                  </p>
                  <p>
                    <b>Localidad:</b> {companySettings.locality || "-"}
                  </p>
                  <p>
                    <b>Teléfono:</b> {companySettings.phone || "-"}
                  </p>
                  <p>
                    <b>Email:</b> {companySettings.email || "-"}
                  </p>
                  <p>
                    <b>Sitio web:</b> {companySettings.website || "-"}
                  </p>
                  <p className="md:col-span-2">
                    <b>Dirección:</b> {companySettings.address || "-"}
                  </p>
                </div>
              </div>
            </Panel>
          </Module>
        )}

        {section === "mikrotik" && canViewMikrotik && <RouterManager />}
      </main>
    </div>
  );
}

function DashboardHome({
  stats,
  tickets,
  clientStatus,
  networkData,
  invoices = [],
  customers = [],
  installations = [],
  systemUsers = [],
  installationRouters = [],
  setSection,
}) {
  const safeNumber = (value) => Number(value || 0);

  const formatMoney = (value) => {
    return `$ ${safeNumber(value).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const today = new Date();

  const activeCustomers = customers.filter(
    (customer) => String(customer.status || "").toLowerCase() === "active"
  );

  const suspendedCustomers = customers.filter(
    (customer) => String(customer.status || "").toLowerCase() === "suspended"
  );

  const pendingInstallationCustomers = customers.filter(
    (customer) =>
      String(customer.status || "").toLowerCase() === "pending_installation"
  );

  const deletedCustomers = customers.filter(
    (customer) => String(customer.status || "").toLowerCase() === "deleted"
  );

  const visibleCustomers = customers.filter((customer) => {
    const status = String(customer.status || "").toLowerCase();

    return status !== "deleted" && status !== "pending_installation";
  });

  const pendingInvoices = invoices.filter(
    (invoice) => String(invoice.status || "").toLowerCase() === "pending"
  );

  const paidInvoices = invoices.filter(
    (invoice) => String(invoice.status || "").toLowerCase() === "paid"
  );

  const overdueInvoices = pendingInvoices.filter((invoice) => {
    if (!invoice.due_date) return false;

    const dueDate = new Date(invoice.due_date);

    if (Number.isNaN(dueDate.getTime())) return false;

    return dueDate < today;
  });

  const invoicesWithPromise = invoices.filter(
    (invoice) => invoice.payment_promise_status === "active"
  );

  const openTickets = tickets.filter(
    (ticket) => String(ticket.status || "").toLowerCase() === "open"
  );

  const inProgressTickets = tickets.filter(
    (ticket) => String(ticket.status || "").toLowerCase() === "in_progress"
  );

  const activeTickets = tickets.filter(
    (ticket) => String(ticket.status || "").toLowerCase() !== "closed"
  );

  const pendingInstallations = installations.filter((installation) => {
    const status = String(installation.status || "").toLowerCase();

    return status !== "completed" && status !== "cancelled";
  });

  const totalCustomers =
    clientStatus?.total_customers || visibleCustomers.length || customers.length;

  const onlineCustomers =
    clientStatus?.online_customers || clientStatus?.active_pppoe_sessions || 0;

  const offlineCustomers =
    clientStatus?.offline_customers ||
    Math.max(safeNumber(totalCustomers) - safeNumber(onlineCustomers), 0);

  const totalPaidAmount =
    stats?.total_paid_amount ||
    paidInvoices.reduce((sum, invoice) => sum + safeNumber(invoice.amount), 0);

  const totalPendingAmount =
    stats?.total_pending_amount ||
    pendingInvoices.reduce(
      (sum, invoice) => sum + safeNumber(invoice.amount),
      0
    );

  const arpu = totalCustomers
    ? Math.round(safeNumber(totalPaidAmount) / safeNumber(totalCustomers))
    : 0;

  const recentPaidInvoices = [...paidInvoices]
    .sort((a, b) => safeNumber(b.id) - safeNumber(a.id))
    .slice(0, 5);

  const promiseRows = [...invoicesWithPromise]
    .sort((a, b) => safeNumber(b.id) - safeNumber(a.id))
    .slice(0, 5);

  const recentTickets = [...tickets]
    .sort((a, b) => safeNumber(b.id) - safeNumber(a.id))
    .slice(0, 5);

  const recentInstallations = [...pendingInstallations]
    .sort((a, b) => safeNumber(b.id) - safeNumber(a.id))
    .slice(0, 5);

  const trafficData = networkData.map((item, index) => ({
    ...item,
    subida: Math.round(safeNumber(item.sesiones) * (0.38 + index * 0.015)),
    bajada: Math.round(safeNumber(item.sesiones) * (0.62 + index * 0.02)),
  }));

  const customerStatusData = [
    {
      name: "Activo",
      value: activeCustomers.length || safeNumber(totalCustomers),
      color: "#22C55E",
    },
    {
      name: "Suspendido",
      value: suspendedCustomers.length,
      color: "#F97316",
    },
    {
      name: "En instalación",
      value: pendingInstallationCustomers.length,
      color: "#2563EB",
    },
    {
      name: "Eliminado",
      value: deletedCustomers.length,
      color: "#CBD5E1",
    },
  ];

  const totalStatusCustomers = customerStatusData.reduce(
    (sum, item) => sum + safeNumber(item.value),
    0
  );

  const routerRows =
    installationRouters.length > 0
      ? installationRouters.slice(0, 3)
      : [
          {
            id: 1,
            name: "MikroTik principal",
            host: "192.168.1.1",
          },
        ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-950">
            Dashboard principal
          </h1>
          <p className="text-slate-500 mt-2">Resumen general del sistema</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="hidden xl:flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-slate-500 min-w-96">
            🔎
            <span>Buscar clientes, facturas, tickets...</span>
            <span className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-500">
              ⌘ K
            </span>
          </div>

          <div className="relative rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            🔔
            {activeTickets.length > 0 && (
              <span className="absolute -right-2 -top-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                {activeTickets.length}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
              👤
            </div>

            <div>
              <p className="font-bold text-slate-800">Administrador</p>
              <p className="text-xs text-slate-500">admin@highspeed.com</p>
            </div>

            <span className="text-slate-400">⌄</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-6 gap-5">
        <MetricCard
          icon="👥"
          title="Clientes activos"
          value={activeCustomers.length || totalCustomers}
          subtitle="↑ 5.2% vs mes anterior"
          color="blue"
        />

        <MetricCard
          icon="🙍"
          title="Clientes suspendidos"
          value={suspendedCustomers.length}
          subtitle="↑ 2.1% vs mes anterior"
          color="orange"
        />

        <MetricCard
          icon="📶"
          title="PPPoE online"
          value={onlineCustomers}
          subtitle="↑ 3.8% vs mes anterior"
          color="green"
        />

        <MetricCard
          icon="🧾"
          title="Facturas vencidas"
          value={overdueInvoices.length}
          subtitle="↑ 12.5% vs mes anterior"
          color="red"
        />

        <MetricCard
          icon="🛠️"
          title="Instalaciones pendientes"
          value={pendingInstallations.length}
          subtitle="— 0% vs mes anterior"
          color="blue"
        />

        <MetricCard
          icon="🎧"
          title="Tickets abiertos"
          value={openTickets.length}
          subtitle="↑ 7.1% vs mes anterior"
          color="orange"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr_1.15fr] gap-5">
        <LightPanel title="Tráfico general">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-5 rounded-full bg-blue-600"></span>
                Subida (Mbps)
              </span>

              <span className="flex items-center gap-2">
                <span className="h-1.5 w-5 rounded-full bg-orange-500"></span>
                Bajada (Mbps)
              </span>
            </div>

            <span className="rounded-lg border border-slate-200 px-3 py-2 font-bold">
              Últimos 7 días ⌄
            </span>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient
                  id="trafficBlueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>

                <linearGradient
                  id="trafficOrangeGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />

              <Area
                type="monotone"
                dataKey="subida"
                stroke="#2563EB"
                fill="url(#trafficBlueGradient)"
                strokeWidth={3}
              />

              <Area
                type="monotone"
                dataKey="bajada"
                stroke="#F97316"
                fill="url(#trafficOrangeGradient)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </LightPanel>

        <LightPanel title="Estado de clientes">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_190px] gap-3 items-center">
            <div className="relative h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={customerStatusData}
                    dataKey="value"
                    innerRadius={72}
                    outerRadius={105}
                    paddingAngle={3}
                  >
                    {customerStatusData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-950">
                    {totalStatusCustomers || totalCustomers}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">Total</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {customerStatusData.map((item) => (
                <div key={item.name} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></span>

                  <div>
                    <p className="font-bold text-slate-700">{item.name}</p>
                    <p className="text-slate-500">
                      {item.value}{" "}
                      {totalStatusCustomers
                        ? `(${Math.round(
                            (safeNumber(item.value) / totalStatusCustomers) *
                              100
                          )}%)`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </LightPanel>

        <LightPanel
          title="Routers MikroTik"
          actionLabel="Ver todos"
          onAction={() => setSection("mikrotik")}
        >
          <MiniTable
            headers={["Router", "Estado", "CPU", "Memoria", "Tráfico"]}
            rows={routerRows.map((router, index) => [
              <div key={`router-${router.id || index}`}>
                <p className="font-bold text-slate-900">
                  {router.name || `Router ${router.id || index + 1}`}
                </p>
                <p className="text-xs text-slate-500">{router.host || "-"}</p>
              </div>,
              <StatusBadge
                key={`router-status-${router.id || index}`}
                status={clientStatus?.mikrotik_online ? "online" : "offline"}
              />,
              clientStatus?.mikrotik_online ? `${23 + index * 8}%` : "—",
              clientStatus?.mikrotik_online ? `${45 + index * 7}%` : "—",
              clientStatus?.mikrotik_online
                ? `↓ ${152 + index * 58} Mbps · ↑ ${188 + index * 57} Mbps`
                : "↓ 0 Mbps · ↑ 0 Mbps",
            ])}
            emptyText="No hay routers cargados."
          />
        </LightPanel>
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-4 gap-5">
        <LightPanel
          title="Últimos pagos"
          actionLabel="Ver todas"
          onAction={() => setSection("invoices")}
        >
          <MiniTable
            headers={["Cliente", "Factura", "Método", "Fecha"]}
            rows={recentPaidInvoices.map((invoice) => [
              invoice.customer_name || `Cliente ${invoice.customer_id}`,
              `F-${String(invoice.id).padStart(6, "0")}`,
              invoice.payment_method || "Efectivo",
              invoice.paid_at || invoice.payment_date || "-",
            ])}
            emptyText="No hay pagos recientes."
          />
        </LightPanel>

        <LightPanel
          title="Promesas de pago"
          actionLabel="Ver todas"
          onAction={() => setSection("invoices")}
        >
          <MiniTable
            headers={["Cliente", "Fecha prometida", "Estado"]}
            rows={promiseRows.map((invoice) => [
              invoice.customer_name || `Cliente ${invoice.customer_id}`,
              invoice.payment_promise_date || "-",
              <StatusBadge key={`promise-${invoice.id}`} status="pending" />,
            ])}
            emptyText="No hay promesas activas."
          />
        </LightPanel>

        <LightPanel
          title="Tickets recientes"
          actionLabel="Ver todos"
          onAction={() => setSection("tickets")}
        >
          <MiniTable
            headers={["Cliente", "Asunto", "Prioridad", "Estado"]}
            rows={recentTickets.map((ticket) => [
              ticket.customer_name || `#${ticket.customer_id || "-"}`,
              ticket.title || "-",
              ticket.priority || "-",
              <StatusBadge
                key={`ticket-${ticket.id}`}
                status={ticket.status || "open"}
              />,
            ])}
            emptyText="No hay tickets recientes."
          />
        </LightPanel>

        <LightPanel
          title="Instalaciones programadas"
          actionLabel="Ver todas"
          onAction={() => setSection("installations")}
        >
          <MiniTable
            headers={["Cliente", "Técnico", "Plan", "Estado"]}
            rows={recentInstallations.map((installation) => [
              installation.customer_name ||
                `Cliente ${installation.customer_id || "-"}`,
              installation.technician || "-",
              installation.installation_type || "-",
              <StatusBadge
                key={`installation-${installation.id}`}
                status={installation.status || "pending"}
              />,
            ])}
            emptyText="No hay instalaciones programadas."
          />
        </LightPanel>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-5">
        <FinanceCard
          icon="$"
          title="Ingresos del mes"
          value={formatMoney(totalPaidAmount)}
          subtitle="Total cobrado"
          color="blue"
        />

        <FinanceCard
          icon="👥"
          title="Pendiente de cobro"
          value={formatMoney(totalPendingAmount)}
          subtitle="Total pendiente"
          color="orange"
        />

        <FinanceCard
          icon="▥"
          title="Facturas del mes"
          value={stats?.invoices || invoices.length}
          subtitle="Emitidas"
          color="blue"
        />

        <FinanceCard
          icon="👥"
          title="ARPU promedio"
          value={formatMoney(arpu)}
          subtitle="Por cliente"
          color="purple"
        />

        <FinanceCard
          icon="📶"
          title="Uptime de la red"
          value={clientStatus?.mikrotik_online ? "99.72%" : "0%"}
          subtitle="Últimos 30 días"
          color="green"
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

function MiniTable({ headers, rows, emptyText = "Sin registros." }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs 2xl:text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-bold">
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-100">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={headers.length}
                className="px-3 py-5 text-center text-slate-500"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  const labels = {
    active: "Activo",
    online: "Online",
    offline: "Offline",
    paid: "Pagado",
    pending: "Pendiente",
    pending_installation: "En instalación",
    suspended: "Suspendido",
    open: "Abierto",
    in_progress: "En proceso",
    closed: "Cerrado",
    completed: "Completado",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    disabled: "Deshabilitado",
  };

  const classes = {
    active: "bg-green-100 text-green-700",
    online: "bg-green-100 text-green-700",
    paid: "bg-green-100 text-green-700",
    completed: "bg-green-100 text-green-700",
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-orange-100 text-orange-700",
    pending_installation: "bg-blue-100 text-blue-700",
    open: "bg-blue-100 text-blue-700",
    in_progress: "bg-orange-100 text-orange-700",
    suspended: "bg-red-100 text-red-700",
    offline: "bg-red-100 text-red-700",
    cancelled: "bg-red-100 text-red-700",
    disabled: "bg-red-100 text-red-700",
    closed: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`rounded-lg px-3 py-1 text-xs font-bold ${
        classes[normalized] || "bg-slate-100 text-slate-700"
      }`}
    >
      {labels[normalized] || status || "-"}
    </span>
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

function LightPanel({ title, children, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-slate-950">{title}</h3>

        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {actionLabel}
          </button>
        )}
      </div>

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
