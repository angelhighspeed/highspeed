import { useState } from "react";
import axios from "axios";

const API =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

function BackupImportManager() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const exportBackup = async () => {
    try {
      setLoading(true);
      setError("");
      setResult("");

      const res = await axios.get(`${API}/backup/export`, {
        ...getAuthHeaders(),
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/json",
      });

      const url = window.URL.createObjectURL(blob);

      const timestamp = new Date()
        .toISOString()
        .replaceAll(":", "-")
        .replaceAll(".", "-");

      const link = document.createElement("a");
      link.href = url;
      link.download = `highspeed_backup_${timestamp}.json`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setResult("Respaldo descargado correctamente.");
    } catch (err) {
      console.error("Error exportando respaldo:", err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "No se pudo descargar el respaldo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-4xl font-bold text-slate-950">
          <span>💾</span>
          Respaldo del CRM
        </h1>

        <p className="mt-2 text-slate-500">
          Descarga clientes, facturas, tickets, instalaciones, planes y routers guardados en el CRM.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-xl font-bold text-slate-950">
          Exportar respaldo JSON
        </h3>

        <p className="text-slate-600">
          Este respaldo es solo de la base de datos del CRM. No modifica MikroTik y no elimina PPPoE Secrets.
        </p>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Recomendado antes de importar clientes reales, hacer limpieza o cambiar módulos importantes.
        </div>

        <button
          type="button"
          onClick={exportBackup}
          disabled={loading}
          className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {loading ? "Descargando..." : "Descargar respaldo JSON"}
        </button>

        {result && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
            {result}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <b>Error:</b> {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default BackupImportManager;