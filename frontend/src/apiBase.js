export const getApiBase = () => {
  const host = window.location.hostname;

  if (host === "190.3.29.20") {
    return "http://190.3.29.20:8000";
  }

  if (host === "192.168.0.113") {
    return "http://192.168.0.113:8000";
  }

  if (host === "localhost" || host === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }

  return `http://${host}:8000`;
};

export const API = getApiBase();
