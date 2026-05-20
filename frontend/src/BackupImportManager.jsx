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
  const [importFile, setImportFile] = useState(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const exportBackup = async () => {
    try {
      setLoading(true);
      setError("");
      setResult(null);

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

      setResult({
        status: "ok",
        message: "Respaldo descargado correctamente.",
      });
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

  const readImportFile = () => {
    return new Promise((resolve, reject) => {
      if (!importFile) {
        reject(new Error("Seleccioná un archivo JSON de respaldo."));
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          resolve(parsed);
        } catch (parseError) {
          reject(new Error("El archivo seleccionado no es un JSON válido."));
        }
      };

      reader.onerror = () => {
        reject(new Error("No se pudo leer el archivo seleccionado."));
      };

      reader.readAsText(importFile);
    });
  };

  const importBackup = async ({ dryRun = true } = {}) => {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const payload = await readImportFile();

      if (!dryRun && clearExisting) {
        const ok = window.confirm(
          "Vas a borrar clientes, facturas, tickets e instalaciones actuales del CRM y restaurar el respaldo. MikroTik NO se toca. ¿Confirmás?"
        );

        if (!ok) {
          setLoading(false);
          return;
        }
      }

      if (!dryRun && !clearExisting) {
        const ok = window.confirm(
          "Vas a restaurar el respaldo sobre los datos actuales del CRM. MikroTik NO se toca. ¿Confirmás?"
        );

        if (!ok) {
          setLoading(false);
          return;
        }
      }

      const res = await axios.post(
        `${API}/backup/import-json?dry_run=${dryRun}&clear_existing=${clearExisting}`,
        payload,
        getAuthHeaders()
      );

      setResult(res.data);
    } catch (err) {
      console.error("Error importando respaldo:", err);

      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err.message ||
          "No se pudo importar el respaldo."
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
          Respaldo e importación
        </h1>

        <p className="mt-2 text-slate-500">
          Exportá e importá datos del CRM sin tocar MikroTik. Esta pantalla no elimina ni modifica PPPoE Secrets del router.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Exportar respaldo JSON">
          <p className="text-slate-600">
            Descarga un archivo JSON con routers, planes, clientes, facturas, tickets e instalaciones guardadas en el CRM.
          </p>

          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Recomendado antes de importar clientes reales, limpiar datos o cambiar módulos importantes.
          </div>

          <button
            type="button"
            onClick={exportBackup}
            disabled={loading}
            className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "Procesando..." : "Descargar respaldo JSON"}
          </button>
        </Panel>

        <Panel title="Importar respaldo JSON">
          <p className="text-slate-600">
            Primero usá <b>Simular importación</b>. Después, si el resultado es correcto, ejecutá la restauración.
          </p>

          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800"
          />

          {importFile && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <b>Archivo seleccionado:</b> {importFile.name}
              <br />
              <b>Tamaño:</b> {(importFile.size / 1024).toFixed(2)} KB
            </div>
          )}

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="mt-1 h-5 w-5"
            />

            <span>
              <b>Borrar datos actuales antes de importar</b>
              <br />
              Borra clientes, facturas, tickets e instalaciones actuales del CRM antes de restaurar el respaldo.
              MikroTik no se toca.
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => importBackup({ dryRun: true })}
              disabled={loading || !importFile}
              className="rounded-xl bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {loading ? "Procesando..." : "Simular importación"}
            </button>

            <button
              type="button"
              onClick={() => importBackup({ dryRun: false })}
              disabled={loading || !importFile}
              className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500 disabled:opacity-60"
            >
              Restaurar respaldo
            </button>
          </div>
        </Panel>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <b>Error:</b> {error}
        </div>
      )}

      {result && (
        <Panel title="Resultado">
          <div
            className={`mb-4 rounded-xl border p-4 text-sm ${
              result.status === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <b>{result.status === "ok" ? "Correcto" : "Atención"}</b>
            <br />
            {result.message || "Operación finalizada."}
          </div>

          {result.restore_plan && (
            <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="p-3">Tabla</th>
                    <th className="p-3">Existe</th>
                    <th className="p-3">Registros archivo</th>
                    <th className="p-3">Importará</th>
                  </tr>
                </thead>

                <tbody>
                  {Object.entries(result.restore_plan).map(([table, item]) => (
                    <tr key={table} className="border-t border-slate-100">
                      <td className="p-3 font-bold">{table}</td>
                      <td className="p-3">{item.exists ? "Sí" : "No"}</td>
                      <td className="p-3">{item.rows_in_file ?? item.rows ?? 0}</td>
                      <td className="p-3">{item.will_import ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.imported_counts && (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              {Object.entries(result.imported_counts).map(([table, count]) => (
                <div
                  key={table}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-sm text-slate-500">{table}</p>
                  <h3 className="text-2xl font-bold text-slate-950">{count}</h3>
                  <p className="text-xs text-slate-400">importados/actualizados</p>
                </div>
              ))}
            </div>
          )}

          {Array.isArray(result.warnings) && result.warnings.length > 0 && (
            <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
              <b>Advertencias:</b>
              <ul className="mt-2 list-disc pl-5">
                {result.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <pre className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xl font-bold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

export default BackupImportManager;
