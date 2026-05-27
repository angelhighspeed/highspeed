import axios from "axios";

export const API =
  import.meta.env.VITE_API_URL ||
  localStorage.getItem("hsm_api_url") ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

export function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("hsm_token") ||
    localStorage.getItem("auth_token") ||
    ""
  );
}

export function getHeaders() {
  const token = getToken();

  return {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

export async function apiGet(path) {
  const res = await axios.get(`${API}${path}`, getHeaders());
  return res.data;
}

export async function apiPost(path, data = {}) {
  const res = await axios.post(`${API}${path}`, data, getHeaders());
  return res.data;
}

export async function apiPut(path, data = {}) {
  const res = await axios.put(`${API}${path}`, data, getHeaders());
  return res.data;
}

export async function apiDelete(path) {
  const res = await axios.delete(`${API}${path}`, getHeaders());
  return res.data;
}

export function normalizeStatus(value) {
  const raw = String(value || "").toLowerCase().trim();

  if (["active", "activo", "online", "ok"].includes(raw)) return "active";
  if (["suspended", "suspendido", "cut", "cortado"].includes(raw)) return "suspended";
  if (["pending", "pendiente", "pending_installation", "installation_pending"].includes(raw)) return "pending";
  if (["completed", "completado", "completada", "done"].includes(raw)) return "completed";
  if (["deleted", "eliminado"].includes(raw)) return "deleted";

  return raw || "";
}

export function isDeleted(item) {
  return normalizeStatus(item?.status || item?.estado || item?.customer_status) === "deleted";
}
