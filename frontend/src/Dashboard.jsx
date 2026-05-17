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
