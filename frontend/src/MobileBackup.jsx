import React, { useState } from "react";
import { API, apiPost, getToken } from "./mobileApi";

export default function MobileBackup() {
  const [file, setFile] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [working, setWorking] = useState(false);

  const exportBackup = async () => {
    try {
      const token = getToken();
      const url = `${API}/backup/export${token ? `?token=${encodeURIComponent(token)}` : ""}`;

      window.open(url, "_blank");

      setLastResult({
        status: "ok",
        message: "Backup exportado. Si no descargó automáticamente, revisá la ventana nueva.",
        endpoint: "/backup/export",
      });
    } catch (err) {
      console.warn("Error exportando backup:", err);
      alert("No se pudo exportar backup.");
    }
  };

  const importJsonBackup = async () => {
    if (!file) {
      alert("Seleccioná un archivo JSON.");
      return;
    }

    if (!confirm("¿Importar este backup JSON? Esta acción puede modificar datos actuales.")) {
      return;
    }

    try {
      setWorking(true);

      const text = await file.text();
      const json = JSON.parse(text);

      const data = await apiPost("/backup/import-json", json);

      setLastResult(data || { status: "ok" });
      alert("Backup importado correctamente.");
    } catch (err) {
      console.warn("Error importando backup:", err);
      alert(
        "No se pudo importar backup. Error: " +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="hsm-backup-page">
      <section className="hsm-backup-head">
        <div>
          <h2>Backup</h2>
          <p>Exportar / importar JSON del sistema</p>
        </div>

        <button onClick={exportBackup}>Exportar</button>
      </section>

      <section className="hsm-backup-total">
        <div>
          <strong>JSON</strong>
          <span>Formato de respaldo</span>
        </div>

        <div>
          <strong>Backend</strong>
          <span>Fuente única</span>
        </div>
      </section>

      <section className="hsm-backup-import-card">
        <h3>Importar backup JSON</h3>

        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {file && (
          <p className="hsm-backup-file">
            Archivo: <strong>{file.name}</strong>
          </p>
        )}

        <button disabled={working} onClick={importJsonBackup}>
          {working ? "Importando..." : "Importar JSON"}
        </button>
      </section>

      {lastResult && (
        <section className="hsm-backup-import-card">
          <h3>Resultado</h3>

          <div className="hsm-backup-result">
            <pre>{JSON.stringify(lastResult, null, 2)}</pre>
          </div>
        </section>
      )}

      <section className="hsm-backup-import-card">
        <h3>Endpoints activos</h3>

        <div className="hsm-backup-endpoints">
          <span>GET /backup/export</span>
          <span>POST /backup/import-json</span>
        </div>
      </section>
    </div>
  );
}
