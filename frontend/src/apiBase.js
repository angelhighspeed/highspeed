export const getApiBase = () => {
  const host = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;

  // Permite forzar API manual desde consola/localStorage si algún día hace falta
  const savedApi = localStorage.getItem("hsm_api_url");
  if (savedApi) return savedApi;

  // Acceso desde navegador por IP pública
  if (host === "190.3.29.20") {
    return "http://190.3.29.20:8000";
  }

  // Acceso desde navegador dentro de la red local
  if (host === "192.168.0.113") {
    return "http://192.168.0.113:8000";
  }

  // Desarrollo local web: npm/vite en la PC
  if ((host === "localhost" || host === "127.0.0.1") && port === "5173") {
    return "http://127.0.0.1:8000";
  }

  // APK Capacitor suele correr como localhost/capacitor.
  // Para que funcione fuera de la red, usamos IP pública.
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    protocol === "capacitor:"
  ) {
    return "http://190.3.29.20:8000";
  }

  // Dominio futuro
  return `http://${host}:8000`;
};

export const API = getApiBase();
