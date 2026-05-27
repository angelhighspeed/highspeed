import { useEffect, useState } from "react";
import { clearLocalSyncData, isOnlineSyncMode } from "./syncMode";

import MobileHome from "./MobileHome";
import MobileClients from "./MobileClients";
import MobileImportClients from "./MobileImportClients";
import MobilePlans from "./MobilePlans";
import MobileRouters from "./MobileRouters";
import MobileInstallations from "./MobileInstallations";
import MobileTickets from "./MobileTickets";
import MobileInvoices from "./MobileInvoices";
import MobilePromises from "./MobilePromises";
import MobilePayments from "./MobilePayments";
import MobileTraffic from "./MobileTraffic";
import MobileAutoCut from "./MobileAutoCut";
import MobileBackup from "./MobileBackup";
import MobileCompany from "./MobileCompany";
import MobileUsers from "./MobileUsers";
import MobileNotifications from "./MobileNotifications";
import MobileClientStatus from "./MobileClientStatus";

const modules = [
  { key: "home", label: "Inicio", icon: "🏠" },
  { key: "clients", label: "Clientes", icon: "👥" },
  { key: "importClients", label: "Importar", icon: "⬆️" },
  { key: "plans", label: "Planes", icon: "📶" },
  { key: "routers", label: "Routers", icon: "📡" },
  { key: "installations", label: "Instalaciones", icon: "🛠️" },
  { key: "tickets", label: "Tickets", icon: "🎫" },
  { key: "invoices", label: "Facturas", icon: "🧾" },
  { key: "promises", label: "Promesas", icon: "🤝" },
  { key: "payments", label: "Pagos / Caja", icon: "💵" },
  { key: "traffic", label: "Tráfico", icon: "📊" },
  { key: "autocut", label: "Corte", icon: "⚡" },
  { key: "backup", label: "Respaldo", icon: "💾" },
  { key: "company", label: "Empresa", icon: "🏢" },
  { key: "users", label: "Usuarios", icon: "👤" },
  { key: "notifications", label: "Notificaciones", icon: "🔔" },
  { key: "clientStatus", label: "Estado clientes", icon: "📋" },
];

function MobileDashboard({ onLogout }) {
  const [section, setSection] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isOnlineSyncMode()) {
      clearLocalSyncData();
    }
  }, []);

  const currentModule =
    modules.find((item) => item.key === section) || modules[0];

  const openSection = (key) => {
    setSection(key);
    setMenuOpen(false);
  };

  const renderContent = () => {
    if (section === "home") return <MobileHome />;
    if (section === "clients") return <MobileClients />;
    if (section === "importClients") return <MobileImportClients />;
    if (section === "plans") return <MobilePlans />;
    if (section === "routers") return <MobileRouters />;
    if (section === "installations") return <MobileInstallations />;
    if (section === "tickets") return <MobileTickets />;
    if (section === "invoices") return <MobileInvoices />;
    if (section === "promises") return <MobilePromises />;
    if (section === "payments") return <MobilePayments />;
    if (section === "traffic") return <MobileTraffic />;
    if (section === "autocut") return <MobileAutoCut />;
    if (section === "backup") return <MobileBackup />;
    if (section === "company") return <MobileCompany />;
    if (section === "users") return <MobileUsers />;
    if (section === "notifications") return <MobileNotifications />;
    if (section === "clientStatus") return <MobileClientStatus />;

    return <MobileHome />;
  };

  return (
    <div className="hsm-app">
      <header className="hsm-topbar">
        <button className="hsm-menu-btn" onClick={() => setMenuOpen(true)}>
          ☰
        </button>

        <div className="hsm-topbar-title">
          <strong>{currentModule.icon} {currentModule.label}</strong>
          <span>HighSpeed Mobile</span>
        </div>

        <button
          className="hsm-logout-btn"
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("access_token");
            if (onLogout) onLogout();
          }}
        >
          Salir
        </button>
      </header>

      {menuOpen && (
        <div className="hsm-menu-overlay" onClick={() => setMenuOpen(false)}>
          <aside className="hsm-menu" onClick={(e) => e.stopPropagation()}>
            <div className="hsm-menu-head">
              <div>
                <h2>HighSpeed</h2>
                <p>Menú móvil</p>
              </div>

              <button onClick={() => setMenuOpen(false)}>×</button>
            </div>

            <nav className="hsm-menu-list">
              {modules.map((item) => (
                <button
                  key={item.key}
                  className={section === item.key ? "active" : ""}
                  onClick={() => openSection(item.key)}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <main className="hsm-content">
        {renderContent()}
      </main>

      <nav className="hsm-bottom-nav">
        <button
          className={section === "home" ? "active" : ""}
          onClick={() => openSection("home")}
        >
          <span>🏠</span>
          Inicio
        </button>

        <button
          className={section === "clients" ? "active" : ""}
          onClick={() => openSection("clients")}
        >
          <span>👥</span>
          Clientes
        </button>

        <button
          className={section === "invoices" ? "active" : ""}
          onClick={() => openSection("invoices")}
        >
          <span>🧾</span>
          Facturas
        </button>

        <button
          className={section === "payments" ? "active" : ""}
          onClick={() => openSection("payments")}
        >
          <span>💵</span>
          Caja
        </button>

        <button onClick={() => setMenuOpen(true)}>
          <span>☰</span>
          Menú
        </button>
      </nav>
    </div>
  );
}

export default MobileDashboard;
