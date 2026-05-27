import { useEffect, useState } from "react";
import axios from "axios";

import { API } from "./apiBase";
function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function StatCard({ label, value }) {
  return (
    <div className="hsm-stat-card">
      <div className="hsm-stat-label">{label}</div>
      <div className="hsm-stat-value">{value}</div>
    </div>
  );
}

export default function MobileOnline() {
  const [data, setData] = useState({
    online: 0,
    crm: 0,
    linked: 0,
    unregistered: 0,
  });

  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API}/dashboard/online-summary`, getHeaders());
      const payload = res.data || {};

      setData({
        online: payload.online ?? payload.pppoe_online ?? 0,
        crm: payload.crm ?? payload.crm_clients ?? 0,
        linked: payload.linked ?? payload.vinculados ?? 0,
        unregistered: payload.unregistered ?? payload.no_registrados ?? 0,
      });
    } catch (e) {
      console.log("MobileOnline error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="hsm-page">
      <div className="hsm-mini-head">
        <h2>Clientes PPPoE Online</h2>
        <p>Resumen rápido del estado actual.</p>
      </div>

      <button className="hsm-refresh-btn" onClick={loadData}>
        {loading ? "Actualizando..." : "Actualizar"}
      </button>

      <div className="hsm-stats-grid">
        <StatCard label="Online" value={data.online} />
        <StatCard label="Clientes CRM" value={data.crm} />
        <StatCard label="Vinculados" value={data.linked} />
        <StatCard label="No registrados" value={data.unregistered} />
      </div>

      <div className="hsm-chart-card">
        <h3>Vista rápida</h3>

        <div className="hsm-fake-chart">
          <div className="bar" style={{ height: "80%" }} />
          <div className="bar" style={{ height: "25%" }} />
          <div className="bar" style={{ height: "18%" }} />
          <div className="bar" style={{ height: "65%" }} />
        </div>

        <div className="hsm-chart-labels">
          <span>Online</span>
          <span>CRM</span>
          <span>Vinc.</span>
          <span>No Reg.</span>
        </div>
      </div>
    </div>
  );
}
