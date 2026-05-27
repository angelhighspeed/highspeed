export const SYNC_MODE = import.meta.env.VITE_SYNC_MODE || "online";

export function isOnlineSyncMode() {
  return SYNC_MODE === "online";
}

export function offlineNotAllowedMessage(moduleName) {
  return `No se pudo guardar en el servidor. ${moduleName} está en modo sincronizado, por eso no se guardará localmente. Revisá el backend/API.`;
}

export function clearLocalSyncData() {
  localStorage.removeItem("hsm_local_installations");
  localStorage.removeItem("hsm_local_invoices");
  localStorage.removeItem("hsm_local_payments");
  localStorage.removeItem("hsm_local_promises");
}
