import { Fragment, useEffect, useMemo, useState } from "react";
import axios from "axios";

import { API } from "./apiBase";
const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

const emptyCustomer = {
  pppoe_username: "",
  pppoe_password: "",
  remote_address: "",
  local_address: "",
  mac_cpe: "",
  coordinates: "",
  router_id: "",
  zone: "",
  plan_id: "",

  name: "",
  last_name: "",
  dni: "",
  email: "",
  external_id: "",
  address: "",
  locality: "",
  city: "",
  postal_code: "",
  phone: "",
  contract_type: "internet",

  status: "active",
  notes: "",

  billing_type: "prepaid",
  invoice_day: "",
  payment_day: "",
  cut_day: "",
};

function CustomerManager() {
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [routers, setRouters] = useState([]);
  const [availableIps, setAvailableIps] = useState([]);

  const [mode, setMode] = useState("list");
  const [tab, setTab] = useState("connection");
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [customerActionLoadingId, setCustomerActionLoadingId] = useState(null);

  const [excelFile, setExcelFile] = useState(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState(null);

  const [form, setForm] = useState(emptyCustomer);
  const [editingId, setEditingId] = useState(null);

  const perPage = 10;

  const loadData = async () => {
    const headers = getAuthHeaders();

    const [customersRes, plansRes, routersRes] = await Promise.all([
      axios.get(`${API}/customers/list-all`, headers),
      axios.get(`${API}/plans`, headers),
      axios.get(`${API}/routers`, headers),
    ]);

    setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
    setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
    setRouters(Array.isArray(routersRes.data) ? routersRes.data : []);
  };

  const importExcelCustomers = async () => {
    if (!excelFile) {
      alert("Seleccioná un archivo Excel primero.");
      return;
    }

    const ok = window.confirm(
      "¿Importar clientes desde Excel al CRM? Esto NO toca MikroTik."
    );

    if (!ok) return;

    try {
      setImportingExcel(true);
      setExcelImportResult(null);

      const formData = new FormData();
      formData.append("file", excelFile);

      const res = await axios.post(`${API}/customers/import-excel`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setExcelImportResult(res.data);

      alert(
        `Importación finalizada.\nImportados: ${
          res.data.imported || 0
        }\nYa existentes: ${res.data.skipped_existing || 0}\nFilas vacías: ${
          res.data.skipped_empty || 0
        }`
      );

      setExcelFile(null);

      await loadData();
    } catch (error) {
      console.error("Error importando Excel:", error);

      alert(
        error.response?.data?.detail || "No se pudo importar el archivo Excel."
      );
    } finally {
      setImportingExcel(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const zones = useMemo(() => {
    return [...new Set(customers.map((c) => c.zone).filter(Boolean))];
  }, [customers]);

  const filteredCustomers = customers.filter((c) => {
    const status = String(c.status || "").toLowerCase();

    // Los clientes creados desde Instalaciones quedan como preclientes.
    // No deben aparecer en el módulo Clientes hasta completar la instalación.
    if (status === "pending_installation" || status === "deleted") {
      return false;
    }

    const text = `
      ${c.id || ""}
      ${c.name || ""}
      ${c.last_name || ""}
      ${c.pppoe_username || ""}
      ${c.pppoe_password || ""}
      ${c.remote_address || ""}
      ${c.phone || ""}
      ${c.dni || ""}
      ${c.address || ""}
      ${c.locality || ""}
      ${c.city || ""}
      ${c.zone || ""}
      ${c.status || ""}
      ${c.plan_id || ""}
    `.toLowerCase();

    return (
      text.includes(search.toLowerCase()) &&
      (zoneFilter ? c.zone === zoneFilter : true)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / perPage));
  const start = (page - 1) * perPage;
  const paginatedCustomers = filteredCustomers.slice(start, start + perPage);

  const getPlanName = (planId) => {
    const plan = plans.find((p) => p.id === planId);

    if (!plan) return "-";

    return `${plan.name || "Plan"}${
      plan.download_speed || plan.upload_speed
        ? ` - ${plan.download_speed || ""}/${plan.upload_speed || ""}`
        : plan.speed
        ? ` - ${plan.speed}`
        : ""
    }`;
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const loadAvailableIps = async (routerId, keepIp = "") => {
    if (!routerId) {
      setAvailableIps([]);

      setForm((prev) => ({
        ...prev,
        router_id: "",
        remote_address: keepIp || "",
      }));

      return;
    }

    try {
      const res = await axios.get(
        `${API}/routers/${routerId}/available-ips`,
        getAuthHeaders()
      );

      const ips = res.data.ips || [];
      const finalIps = keepIp
        ? [keepIp, ...ips.filter((ip) => ip !== keepIp)]
        : ips;

      setAvailableIps(finalIps);

      setForm((prev) => ({
        ...prev,
        router_id: routerId,
        remote_address: keepIp || "",
      }));
    } catch (error) {
      console.error("Error cargando IPs disponibles:", error);
      setAvailableIps(keepIp ? [keepIp] : []);
    }
  };

  const newCustomer = () => {
    setForm(emptyCustomer);
    setAvailableIps([]);
    setEditingId(null);
    setExpandedId(null);
    setTab("connection");
    setMode("create");
  };

  const editCustomer = async (customer) => {
    setForm({
      ...emptyCustomer,
      ...customer,
      router_id: customer.router_id || "",
      plan_id: customer.plan_id || "",
    });

    setEditingId(customer.id);
    setExpandedId(null);
    setTab("connection");
    setMode("edit");

    if (customer.router_id) {
      await loadAvailableIps(
        String(customer.router_id),
        customer.remote_address || ""
      );
    } else {
      setAvailableIps(customer.remote_address ? [customer.remote_address] : []);
    }
  };

  const saveCustomer = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      router_id: form.router_id ? Number(form.router_id) : null,
      plan_id: form.plan_id ? Number(form.plan_id) : null,
    };

    if (editingId) {
      await axios.put(`${API}/customers/${editingId}`, payload, getAuthHeaders());
    } else {
      await axios.post(`${API}/customers`, payload, getAuthHeaders());
    }

    setForm(emptyCustomer);
    setAvailableIps([]);
    setEditingId(null);
    setMode("list");
    setTab("connection");
    setPage(1);

    await loadData();
  };

  const showCustomerActionResult = (res) => {
    const message = res.data?.message || "Acción realizada correctamente.";
    const mikrotikStatus = res.data?.mikrotik?.status || "-";
    const mikrotikMessage = res.data?.mikrotik?.message || "-";

    alert(`${message}\n\nMikroTik: ${mikrotikStatus}\n${mikrotikMessage}`);
  };

  const showCustomerActionError = (error) => {
    console.error("Error ejecutando acción de cliente:", error);

    const detail =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "Error desconocido";

    alert(`No se pudo ejecutar la acción.\n\n${detail}`);
  };

  const deleteCustomer = async (customerId) => {
    const ok = window.confirm(
      "¿Seguro que querés eliminar este cliente del listado principal?\n\nNo se borra su historial; queda marcado como eliminado y se intenta deshabilitar en MikroTik."
    );

    if (!ok) return;

    try {
      setCustomerActionLoadingId(customerId);

      const res = await axios.delete(
        `${API}/customers/${customerId}`,
        getAuthHeaders()
      );

      setSelected((prev) => prev.filter((id) => id !== customerId));

      await loadData();

      showCustomerActionResult(res);
    } catch (error) {
      showCustomerActionError(error);
    } finally {
      setCustomerActionLoadingId(null);
    }
  };

  const suspendCustomer = async (customerId) => {
    const ok = window.confirm(
      "¿Suspender este cliente?\n\nSe marcará como suspendido y se intentará deshabilitar el PPPoE en MikroTik."
    );

    if (!ok) return;

    try {
      setCustomerActionLoadingId(customerId);

      const res = await axios.put(
        `${API}/customers/${customerId}/suspend`,
        {},
        getAuthHeaders()
      );

      await loadData();

      showCustomerActionResult(res);
    } catch (error) {
      showCustomerActionError(error);
    } finally {
      setCustomerActionLoadingId(null);
    }
  };

  const activateCustomer = async (customerId) => {
    const ok = window.confirm(
      "¿Activar este cliente?\n\nSe marcará como activo y se intentará habilitar el PPPoE en MikroTik."
    );

    if (!ok) return;

    try {
      setCustomerActionLoadingId(customerId);

      const res = await axios.put(
        `${API}/customers/${customerId}/activate`,
        {},
        getAuthHeaders()
      );

      await loadData();

      showCustomerActionResult(res);
    } catch (error) {
      showCustomerActionError(error);
    } finally {
      setCustomerActionLoadingId(null);
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const pageIds = paginatedCustomers.map((c) => c.id);
    const allSelected = pageIds.every((id) => selected.includes(id));

    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const executeBulkAction = async () => {
    if (!bulkAction) {
      alert("Seleccioná una acción.");
      return;
    }

    if (selected.length === 0) {
      alert("Seleccioná al menos un cliente.");
      return;
    }

    const ok = window.confirm(
      `¿Ejecutar "${bulkAction}" sobre ${selected.length} clientes?`
    );

    if (!ok) return;

    const errors = [];

    for (const id of selected) {
      try {
        if (bulkAction === "activate") {
          await axios.put(`${API}/customers/${id}/activate`, {}, getAuthHeaders());
        }

        if (bulkAction === "suspend") {
          await axios.put(`${API}/customers/${id}/suspend`, {}, getAuthHeaders());
        }

        if (bulkAction === "delete") {
          await axios.delete(`${API}/customers/${id}`, getAuthHeaders());
        }
      } catch (error) {
        errors.push({
          id,
          error:
            error.response?.data?.detail ||
            error.response?.data?.message ||
            error.message ||
            "Error desconocido",
        });
      }
    }

    setSelected([]);
    setBulkAction("");

    await loadData();

    if (errors.length > 0) {
      alert(
        `Acción terminada con errores en ${errors.length} cliente(s):\n\n` +
          errors.map((item) => `ID ${item.id}: ${item.error}`).join("\n")
      );
    } else {
      alert("Acción masiva realizada correctamente.");
    }
  };

  return (
    <div>
      {mode === "list" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <span className="text-green-400">👥</span>
                Lista de Clientes
              </h1>

              <p className="text-slate-500 mt-2">
                Gestión completa de clientes PPPoE
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".xlsx,.xlsm"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                className="input-dark max-w-xs"
              />

              <button
                type="button"
                onClick={importExcelCustomers}
                disabled={importingExcel}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {importingExcel ? "Importando..." : "Importar Excel"}
              </button>

              <button
                onClick={newCustomer}
                className="rounded-xl bg-green-500 px-5 py-3 font-bold text-white hover:bg-green-400"
              >
                + Agregar Cliente
              </button>
            </div>
          </div>

          <Panel>
            <select
              className="input-dark max-w-md"
              value={zoneFilter}
              onChange={(e) => {
                setZoneFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Seleccione una Zona</option>

              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Panel>

          {excelImportResult && (
            <Panel title="Resultado importación Excel">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-slate-500 text-sm">Importados</p>

                  <h3 className="text-2xl font-bold text-green-600">
                    {excelImportResult.imported || 0}
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-slate-500 text-sm">Ya existentes</p>

                  <h3 className="text-2xl font-bold text-blue-600">
                    {excelImportResult.skipped_existing || 0}
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-slate-500 text-sm">Filas vacías</p>

                  <h3 className="text-2xl font-bold text-orange-500">
                    {excelImportResult.skipped_empty || 0}
                  </h3>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-slate-500 text-sm">Errores</p>

                  <h3 className="text-2xl font-bold text-red-600">
                    {excelImportResult.errors?.length || 0}
                  </h3>
                </div>
              </div>

              <pre className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs overflow-auto">
                {JSON.stringify(excelImportResult, null, 2)}
              </pre>
            </Panel>
          )}

          <Panel>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold">Acción:</span>

              <select
                className="input-dark max-w-xs"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="">----------</option>
                <option value="activate">Activar clientes</option>
                <option value="suspend">Suspender clientes</option>
                <option value="delete">Eliminar clientes</option>
              </select>

              <button
                type="button"
                onClick={executeBulkAction}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
              >
                ▶ Ejecutar
              </button>

              <span className="text-slate-500">
                {selected.length} seleccionados/as
              </span>
            </div>
          </Panel>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <ButtonGreen>Mostrar 10 registros</ButtonGreen>
              <IconButton>📋</IconButton>
              <IconButton>📄</IconButton>
              <IconButton>📊</IconButton>
              <ButtonGreen>▦ Tabla</ButtonGreen>

              <span className="ml-2 text-slate-500">Botones de Acción:</span>

              <SmallAction color="green">?</SmallAction>
              <SmallAction color="blue">↔</SmallAction>
              <SmallAction color="green">⏻</SmallAction>
              <SmallAction color="orange">⏻</SmallAction>
              <SmallAction color="green">👤</SmallAction>
              <SmallAction color="green">🌐</SmallAction>
              <SmallAction color="blue">📊</SmallAction>
              <SmallAction color="blue">⇄</SmallAction>
              <SmallAction color="purple">☊</SmallAction>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500">
                🔧 Herramientas
              </button>

              <button className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500">
                ✨ IA
              </button>
            </div>
          </div>

          <Panel>
            <div className="flex justify-end mb-4">
              <label className="flex items-center gap-2 font-bold text-slate-700">
                Buscar:
                <input
                  className="input-dark w-64"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="p-3 w-10"></th>

                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          paginatedCustomers.length > 0 &&
                          paginatedCustomers.every((c) =>
                            selected.includes(c.id)
                          )
                        }
                        onChange={toggleAll}
                      />
                    </th>

                    <th className="p-3">ID</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3">IP</th>
                    <th className="p-3">Password PPPoE</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Plan Internet</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedCustomers.map((c) => (
                    <Fragment key={c.id}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3">
                          <button
                            onClick={() =>
                              setExpandedId(expandedId === c.id ? null : c.id)
                            }
                            className="h-7 w-7 rounded-full bg-blue-600 font-bold text-white hover:bg-blue-500"
                          >
                            {expandedId === c.id ? "-" : "+"}
                          </button>
                        </td>

                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={() => toggleSelected(c.id)}
                          />
                        </td>

                        <td className="p-3">{c.id}</td>

                        <td className="p-3 font-medium text-blue-600">
                          {c.pppoe_username || c.email || "-"}
                        </td>

                        <td className="p-3">{c.remote_address || "-"}</td>

                        <td className="p-3">{c.pppoe_password || "-"}</td>

                        <td className="p-3">
                          {c.name} {c.last_name || ""}
                        </td>

                        <td className="p-3">
                          <span
                            className={`rounded-md px-3 py-1 text-xs font-bold ${
                              c.status === "active"
                                ? "bg-green-500 text-white"
                                : c.status === "suspended"
                                ? "bg-orange-500 text-white"
                                : "bg-red-600 text-white"
                            }`}
                          >
                            {c.status === "active"
                              ? "Activo"
                              : c.status === "suspended"
                              ? "Suspendido"
                              : c.status || "Sin estado"}
                          </span>
                        </td>

                        <td className="p-3">{getPlanName(c.plan_id)}</td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={customerActionLoadingId === c.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                editCustomer(c);
                              }}
                              className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-slate-950 hover:bg-yellow-400 disabled:opacity-60"
                            >
                              Editar
                            </button>

                            {c.status === "active" ? (
                              <button
                                type="button"
                                disabled={customerActionLoadingId === c.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  suspendCustomer(c.id);
                                }}
                                className="rounded-lg bg-orange-500 px-3 py-2 font-bold text-white hover:bg-orange-400 disabled:opacity-60"
                              >
                                {customerActionLoadingId === c.id
                                  ? "Procesando..."
                                  : "Suspender"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={customerActionLoadingId === c.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  activateCustomer(c.id);
                                }}
                                className="rounded-lg bg-green-600 px-3 py-2 font-bold text-white hover:bg-green-500 disabled:opacity-60"
                              >
                                {customerActionLoadingId === c.id
                                  ? "Procesando..."
                                  : "Activar"}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={customerActionLoadingId === c.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteCustomer(c.id);
                              }}
                              className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-500 disabled:opacity-60"
                            >
                              {customerActionLoadingId === c.id
                                ? "Procesando..."
                                : "Eliminar"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedId === c.id && (
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td colSpan="10" className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              <DetailBox
                                title="Datos del Cliente"
                                color="text-blue-600"
                              >
                                <p>
                                  <b>Nombre:</b> {c.name} {c.last_name || ""}
                                </p>
                                <p>
                                  <b>DNI/CUIT:</b> {c.dni || "-"}
                                </p>
                                <p>
                                  <b>Email:</b> {c.email || "-"}
                                </p>
                                <p>
                                  <b>Teléfono:</b> {c.phone || "-"}
                                </p>
                                <p>
                                  <b>Dirección:</b> {c.address || "-"}
                                </p>
                                <p>
                                  <b>Localidad:</b> {c.locality || "-"}
                                </p>
                              </DetailBox>

                              <DetailBox
                                title="Conexión PPPoE"
                                color="text-green-600"
                              >
                                <p>
                                  <b>Usuario:</b> {c.pppoe_username || "-"}
                                </p>
                                <p>
                                  <b>Password:</b> {c.pppoe_password || "-"}
                                </p>
                                <p>
                                  <b>Remote IP:</b> {c.remote_address || "-"}
                                </p>
                                <p>
                                  <b>Local IP:</b> {c.local_address || "-"}
                                </p>
                                <p>
                                  <b>MAC CPE:</b> {c.mac_cpe || "-"}
                                </p>
                                <p>
                                  <b>Zona:</b> {c.zone || "-"}
                                </p>
                              </DetailBox>

                              <DetailBox
                                title="Servicio / Facturación"
                                color="text-orange-500"
                              >
                                <p>
                                  <b>Plan:</b> {getPlanName(c.plan_id)}
                                </p>
                                <p>
                                  <b>Estado:</b> {c.status || "-"}
                                </p>
                                <p>
                                  <b>Tipo factura:</b> {c.billing_type || "-"}
                                </p>
                                <p>
                                  <b>Día factura:</b> {c.invoice_day || "-"}
                                </p>
                                <p>
                                  <b>Día pago:</b> {c.payment_day || "-"}
                                </p>
                                <p>
                                  <b>Día corte:</b> {c.cut_day || "-"}
                                </p>
                              </DetailBox>

                              <div className="md:col-span-3 rounded-xl bg-white border border-slate-200 p-4">
                                <h4 className="font-bold text-purple-600 mb-3">
                                  Notas
                                </h4>

                                <p>{c.notes || "Sin notas"}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}

                  {paginatedCustomers.length === 0 && (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-400">
                        No hay clientes para mostrar
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-5">
              <p className="text-slate-500">
                Mostrando registros del{" "}
                {filteredCustomers.length === 0 ? 0 : start + 1} al{" "}
                {Math.min(start + perPage, filteredCustomers.length)} de un total
                de {filteredCustomers.length} registros
              </p>

              <div className="flex items-center gap-1">
                <PageButton
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </PageButton>

                {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                  <PageButton
                    key={i + 1}
                    active={page === i + 1}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </PageButton>
                ))}

                {totalPages > 5 && (
                  <>
                    <span className="px-3 text-slate-400">...</span>

                    <PageButton
                      active={page === totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      {totalPages}
                    </PageButton>
                  </>
                )}

                <PageButton
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                </PageButton>
              </div>
            </div>
          </Panel>
        </>
      )}

      {(mode === "create" || mode === "edit") && (
        <>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold">
                {mode === "edit" ? "Editar Cliente" : "Agregar Cliente"}
              </h1>

              <p className="text-slate-500 mt-2">
                Alta completa del cliente y conexión PPPoE
              </p>
            </div>

            <button
              onClick={() => setMode("list")}
              className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-900 hover:bg-slate-300"
            >
              Volver
            </button>
          </div>

          <form onSubmit={saveCustomer}>
            <div className="flex flex-wrap gap-2 mb-6">
              <TabButton
                label="Datos de Conexión"
                active={tab === "connection"}
                onClick={() => setTab("connection")}
              />

              <TabButton
                label="Datos del Cliente"
                active={tab === "client"}
                onClick={() => setTab("client")}
              />

              <TabButton
                label="Configuración Avanzada"
                active={tab === "advanced"}
                onClick={() => setTab("advanced")}
              />

              <TabButton
                label="Facturación"
                active={tab === "billing"}
                onClick={() => setTab("billing")}
              />
            </div>

            {tab === "connection" && (
              <Panel title="Datos de Conexión">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nombre Secret PPPoE"
                    value={form.pppoe_username}
                    onChange={(e) =>
                      handleChange("pppoe_username", e.target.value)
                    }
                  />

                  <Input
                    label="Contraseña PPPoE"
                    value={form.pppoe_password}
                    onChange={(e) =>
                      handleChange("pppoe_password", e.target.value)
                    }
                  />

                  <Select
                    label={`Remote Address PPPoE (${availableIps.length} IPs libres)`}
                    value={form.remote_address}
                    onChange={(e) =>
                      handleChange("remote_address", e.target.value)
                    }
                  >
                    <option value="">
                      {form.router_id
                        ? "Seleccionar IP disponible"
                        : "Primero seleccioná un router"}
                    </option>

                    {availableIps.map((ip) => (
                      <option key={ip} value={ip}>
                        {ip}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Local Address PPPoE"
                    value={form.local_address}
                    onChange={(e) =>
                      handleChange("local_address", e.target.value)
                    }
                  />

                  <Input
                    label="MAC CPE"
                    value={form.mac_cpe}
                    onChange={(e) => handleChange("mac_cpe", e.target.value)}
                  />

                  <Input
                    label="Coordenadas"
                    placeholder="-34.60,-58.38"
                    value={form.coordinates}
                    onChange={(e) =>
                      handleChange("coordinates", e.target.value)
                    }
                  />

                  <Select
                    label="Router"
                    value={form.router_id}
                    onChange={(e) => loadAvailableIps(e.target.value)}
                  >
                    <option value="">Seleccionar router</option>

                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} - {r.host}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Zona"
                    value={form.zone}
                    onChange={(e) => handleChange("zone", e.target.value)}
                  />

                  <Select
                    label="Plan Internet"
                    value={form.plan_id}
                    onChange={(e) => handleChange("plan_id", e.target.value)}
                  >
                    <option value="">Seleccionar plan</option>

                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getPlanName(p.id)} - ${p.price}
                      </option>
                    ))}
                  </Select>
                </div>
              </Panel>
            )}

            {tab === "client" && (
              <Panel title="Datos del Cliente">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nombre"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />

                  <Input
                    label="Apellido"
                    value={form.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                  />

                  <Input
                    label="DNI / CUIT"
                    value={form.dni}
                    onChange={(e) => handleChange("dni", e.target.value)}
                  />

                  <Input
                    label="Email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />

                  <Input
                    label="ID Externo"
                    value={form.external_id}
                    onChange={(e) =>
                      handleChange("external_id", e.target.value)
                    }
                  />

                  <Input
                    label="Dirección"
                    value={form.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />

                  <Input
                    label="Localidad"
                    value={form.locality}
                    onChange={(e) => handleChange("locality", e.target.value)}
                  />

                  <Input
                    label="Ciudad"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                  />

                  <Input
                    label="Código Postal"
                    value={form.postal_code}
                    onChange={(e) =>
                      handleChange("postal_code", e.target.value)
                    }
                  />

                  <Input
                    label="Teléfono"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />

                  <Select
                    label="Forma de contratación"
                    value={form.contract_type}
                    onChange={(e) =>
                      handleChange("contract_type", e.target.value)
                    }
                  >
                    <option value="internet">Internet</option>
                    <option value="internet_tv">Internet + TV</option>
                    <option value="empresa">Empresa</option>
                    <option value="prepago">Prepago</option>
                  </Select>
                </div>
              </Panel>
            )}

            {tab === "advanced" && (
              <Panel title="Configuración Avanzada">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Estado"
                    value={form.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                  >
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                    <option value="inactive">Inactivo</option>
                  </Select>

                  <textarea
                    className="input-dark min-h-32 md:col-span-2"
                    placeholder="Notas técnicas / comerciales"
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                  />
                </div>
              </Panel>
            )}

            {tab === "billing" && (
              <Panel title="Facturación">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Tipo de facturación"
                    value={form.billing_type}
                    onChange={(e) =>
                      handleChange("billing_type", e.target.value)
                    }
                  >
                    <option value="prepaid">Prepago</option>
                    <option value="postpaid">Postpago</option>
                  </Select>

                  <Input
                    label="Día de factura"
                    value={form.invoice_day}
                    onChange={(e) =>
                      handleChange("invoice_day", e.target.value)
                    }
                  />

                  <Input
                    label="Día de pago"
                    value={form.payment_day}
                    onChange={(e) =>
                      handleChange("payment_day", e.target.value)
                    }
                  />

                  <Input
                    label="Día de corte"
                    value={form.cut_day}
                    onChange={(e) => handleChange("cut_day", e.target.value)}
                  />
                </div>
              </Panel>
            )}

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setMode("list")}
                className="rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-900 hover:bg-slate-300"
              >
                Cancelar
              </button>

              <button className="rounded-xl bg-green-500 px-5 py-3 font-bold text-white hover:bg-green-400">
                {mode === "edit" ? "Guardar cambios" : "Guardar cliente"}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5 shadow-sm">
      {title && <h3 className="mb-4 text-xl font-bold text-slate-950">{title}</h3>}
      {children}
    </div>
  );
}

function DetailBox({ title, color, children }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4">
      <h4 className={`font-bold ${color} mb-3`}>{title}</h4>
      <div className="space-y-1 text-slate-700">{children}</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="text-sm text-slate-500">{label}</label>}
      <input {...props} className="input-dark mt-2" />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="text-sm text-slate-500">{label}</label>}
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
          ? "bg-blue-600 text-white"
          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function ButtonGreen({ children }) {
  return (
    <button className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500">
      {children}
    </button>
  );
}

function IconButton({ children }) {
  return (
    <button className="rounded-lg bg-green-600 px-3 py-2 font-bold text-white hover:bg-green-500">
      {children}
    </button>
  );
}

function SmallAction({ children, color }) {
  const styles = {
    green: "bg-green-600 hover:bg-green-500",
    blue: "bg-blue-600 hover:bg-blue-500",
    orange: "bg-orange-500 hover:bg-orange-400",
    purple: "bg-purple-600 hover:bg-purple-500",
  };

  return (
    <button className={`rounded-lg px-3 py-2 font-bold text-white ${styles[color]}`}>
      {children}
    </button>
  );
}

function PageButton({ children, active, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border border-slate-200 px-4 py-2 ${
        active
          ? "bg-blue-600 text-white"
          : disabled
          ? "bg-slate-100 text-slate-400"
          : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export default CustomerManager;