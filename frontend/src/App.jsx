import { useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import MobileDashboard from "./MobileDashboard";

function App() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem("token"));

  const logout = () => {
    localStorage.removeItem("token");
    setIsLogged(false);
  };

  if (!isLogged) {
    return <Login onLogin={() => setIsLogged(true)} />;
  }

  return isMobile ? (
    <MobileDashboard onLogout={logout} />
  ) : (
    <Dashboard onLogout={logout} />
  );
}

export default App;