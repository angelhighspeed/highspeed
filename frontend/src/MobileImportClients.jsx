import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API, apiGet, apiPost, getHeaders, getToken } from "./mobileApi";

function getRouterName(router) {
  const name = router?.name || router?.nombre || `Router #${router?.id}`;
  const host = router?.host || router?.ip || router?.ip_address || "";
  return host ? `${name} - ${host}` : name;
}

function getCustomerName(customer) {
  return (
    customer?.full_name ||
    customer?.name ||
    customer?.nombre ||
    customer?.customer_name ||
    "Sin nombre"
  );
}

function getCustomerIp(customer) {
  return (
    customer?.remote_address ||
    customer?.customer_ip ||
    customer?.ip ||
    customer?.ip_address ||
    customer?.pppoe_ip ||
    ""
  );
}

function getPppoeUser(customer) {
  return (
    customer?.pppoe_username ||
    customer?.pppoe_user ||
    customer?.username ||
    customer?.customer_pppoe_username ||
    ""
  );
}

export default function MobileImportClients() {
  const [routers, setRouters] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedRouter, setSelectedRouter] = useState("");
  const [excelFile, setExcelFile] = useState(null);
  const [result, setResult] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const importedPreview = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (customers || [])
      .filter((customer) => {
        if (!term) return true;

        const text = [
          getCustomerName(customer),
          getPppoeUser(customer),
          getCustomerIp(customer),
          customer.phone,
          customer.telefono,
          customer.address,
          customer.direccion,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(term);
      })
      .slice(0, 30);
  }, [customers, query]);

  const stats = useMemo(() => {
    return {
      routers: routers.length,
      customers: customers.length,
      imported:
        result?.imported ||
        result?.created ||
        result?.count ||
        result?.total_imported ||
        0,
      skipped:
        result?.skipped ||
        result?.duplicates ||
        result?.duplicados ||
        0,
    };
  }, [routers, customers, result]);

  const loadRouters = async () => {
    try {
      const data = await apiGet("/routers");
      setRouters(Array.isArray(data) ? data : data?.items || data?.routers || []);
    } catch (err) {
      console.warn("Error cargando routers:", err);
      setRouters([]);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await apiGet("/customers");
      const items = Array.isArray(data)
        ? data
        : data?.items || data?.customers || data?.data || [];

      setCustomers(
        items.filter((customer) => {
          const status = String(customer.status || customer.estado || "").toLowerCase();
          return status !== "deleted" && status !== "eliminado";
        })
      );
    } catch (err) {
      console.warn("Error cargando clientes:", err);
      setCustomers([]);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRouters(), loadCustomers()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const importFromSelectedRouter = async () => {
    if (!selectedRouter) {
      alert("Seleccioná un router.");
      return;
    }

    if (!confirm("¿Importar clientes desde este MikroTik?")) return;

    try {
      setImporting(true);

      const data = await apiPost("/customers/import-from-mikrotik", {
        router_id: Number(selectedRouter),
      });

      setResult(data);
      await loadCustomers();

      alert("Importación desde MikroTik finalizada.");
    } catch (err) {
      console.warn("Error importando desde MikroTik:", err);
      alert(
        "No se pudo importar desde MikroTik. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setImporting(false);
    }
  };

  const importAllFromMikrotik = async () => {
    if (!confirm("¿Importar clientes desde todos los MikroTik cargados?")) return;

    try {
      setImporting(true);

      const data = await apiPost("/customers/import-all-from-mikrotik", {});

      setResult(data);
      await loadCustomers();

      alert("Importación general desde MikroTik finalizada.");
    } catch (err) {
      console.warn("Error importando todos desde MikroTik:", err);
      alert(
        "No se pudo importar todos desde MikroTik. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setImporting(false);
    }
  };

  const importExcel = async () => {
    if (!excelFile) {
      alert("Seleccioná un archivo Excel.");
      return;
    }

    try {
      setImporting(true);

      const formData = new FormData();
      formData.append("file", excelFile);

      const token = getToken();

      const res = await axios.post(`${API}/customers/import-excel`, formData, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "multipart/form-data",
        },
      });

      setResult(res.data);
      await loadCustomers();

      alert("Importación desde Excel finalizada.");
    } catch (err) {
      console.warn("Error importando Excel:", err);
      alert(
        "No se pudo importar Excel. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="hsm-import-page">
      <section className="hsm-import-head">
        <div>
          <h2>Importar clientes</h2>
          <p>MikroTik / Excel sincronizado con backend</p>
        </div>

        <button onClick={loadAll}>Actualizar</button>
      </section>

      <section className="hsm-import-stats">
        <div>
          <strong>{stats.routers}</strong>
          <span>Routers</span>
        </div>

        <div>
          <strong>{stats.customers}</strong>
          <span>Clientes</span>
        </div>

        <div>
          <strong>{stats.imported}</strong>
          <span>Importados</span>
        </div>
      </section>

      <section className="hsm-import-card">
        <h3>Importar desde MikroTik</h3>

        <select
          value={selectedRouter}
          onChange={(e) => setSelectedRouter(e.target.value)}
        >
          <option value="">Seleccionar router</option>
          {routers.map((router) => (
            <option key={router.id || router.router_id} value={router.id || router.router_id}>
              {getRouterName(router)}
            </option>
          ))}
        </select>

        <div className="hsm-import-actions">
          <button disabled={importing} onClick={importFromSelectedRouter}>
            {importing ? "Importando..." : "Importar router"}
          </button>

          <button disabled={importing} onClick={importAllFromMikrotik}>
            Importar todos
          </button>
        </div>
      </section>

      <section className="hsm-import-card">
        <h3>Importar desde Excel</h3>

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
        />

        {excelFile && (
          <p className="hsm-import-file">
            Archivo: <strong>{excelFile.name}</strong>
          </p>
        )}

        <button disabled={importing} onClick={importExcel}>
          {importing ? "Importando..." : "Importar Excel"}
        </button>
      </section>

      {result && (
        <section className="hsm-import-card">
          <h3>Resultado</h3>

          <div className="hsm-import-result">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </section>
      )}

      <section className="hsm-import-card">
        <div className="hsm-import-list-head">
          <h3>Clientes cargados</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente importado..."
          />
        </div>

        {loading ? (
          <p>Cargando clientes...</p>
        ) : importedPreview.length === 0 ? (
          <p>No hay clientes para mostrar.</p>
        ) : (
          <div className="hsm-import-client-list">
            {importedPreview.map((customer) => (
              <div key={customer.id || customer.customer_id}>
                <strong>{getCustomerName(customer)}</strong>
                <span>{getPppoeUser(customer) || "Sin PPPoE"}</span>
                <small>{getCustomerIp(customer) || "Sin IP"}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
