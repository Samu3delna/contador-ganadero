import { create, isAxiosError, AxiosError, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
export const REFRESH_KEY = "cg.refresh";
export const baseURL: string = Constants.expoConfig?.extra?.apiUrl;
const transport = create({
  baseURL,
  timeout: 20000,
  withCredentials: false,
});
export const api = create({
  baseURL,
  timeout: 20000,
  withCredentials: false,
});
let access: string | null = null;
let generation = 0;
let refreshPromise: Promise<string> | null = null;
let onInvalid: () => Promise<void> = async () => {};
let credentialQueue: Promise<unknown> = Promise.resolve();
function credentials<T>(fn: () => Promise<T>): Promise<T> {
  const pending = credentialQueue.then(fn, fn);
  credentialQueue = pending.catch(() => {});
  return pending;
}
export function clearCredentials() {
  return credentials(() => SecureStore.deleteItemAsync(REFRESH_KEY));
}
export function setInvalidHandler(fn: () => Promise<void>) {
  onInvalid = fn;
}
export function setAccess(token: string | null) {
  access = token;
}
export function invalidateRequests() {
  generation++;
  access = null;
  refreshPromise = null;
}
export const authRequest = transport;
export async function saveSession(data: {
  accessToken: string;
  refreshToken: string;
}) {
  const epoch = generation;
  await credentials(async () => {
    if (epoch !== generation) throw new Error("Sesión cerrada.");
    await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
    if (epoch !== generation) {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      throw new Error("Sesión cerrada.");
    }
    access = data.accessToken;
  });
}
export function refreshSession() {
  if (!refreshPromise) {
    const epoch = generation;
    const current = (async () => {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!refreshToken) throw new Error("Inicia sesión para continuar.");
      const { data } = await transport.post("/mobile/auth/refresh", {
        refreshToken,
      });
      if (epoch !== generation) throw new Error("Sesión cerrada.");
      await saveSession(data);
      return data.accessToken as string;
    })();
    refreshPromise = current;
    void current
      .finally(() => {
        if (refreshPromise === current) refreshPromise = null;
      })
      .catch(() => {});
  }
  return refreshPromise;
}
type Request = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _generation?: number;
};
api.interceptors.request.use(async (config: Request) => {
  config._generation ??= generation;
  if (!["get", "head", "options"].includes(config.method || "get")) {
    const state = await NetInfo.fetch();
    if (state.isConnected === false || state.isInternetReachable === false)
      throw new Error("Conéctate para registrar cambios.");
  }
  if (config._generation !== generation) throw new Error("Sesión cerrada.");
  if (access) config.headers.Authorization = "Bearer " + access;
  return config;
});
api.interceptors.response.use(
  (response) => {
    if ((response.config as Request)._generation !== generation)
      throw new Error("Sesión cerrada.");
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as Request | undefined;
    if (
      !original ||
      original._generation !== generation ||
      original._retry ||
      error.response?.status !== 401
    )
      throw error;
    original._retry = true;
    try {
      const token = await refreshSession();
      original.headers.Authorization = "Bearer " + token;
      return api(original);
    } catch (failure) {
      if (
        original._generation === generation &&
        isAxiosError(failure) &&
        [400, 401, 403].includes(failure.response?.status || 0)
      )
        await onInvalid();
      throw failure;
    }
  },
);
export function message(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response)
      return "No hay conexión con el servidor. Intenta nuevamente.";
    const planMessages: Record<string, string> = {
      PLAN_SIN_ACCESO_MODULO: "Tu plan no incluye acceso a este módulo.",
      TENANT_INACTIVO: "Tu finca está suspendida. Revisa el estado de tu plan.",
      CUOTA_CONTEOS_AGOTADA: "Alcanzaste el límite de conteos de tu plan.",
      CUOTA_CHAT_AGOTADA: "Alcanzaste el límite de consultas de tu plan.",
      PLAN_SIN_VLM: "Esta función requiere un plan que incluya visión avanzada.",
    };
    const planMessage = planMessages[error.response.data?.error];
    if (planMessage) return planMessage;
    if (error.response.status === 403)
      return (
        error.response.data?.mensaje ||
        error.response.data?.error ||
        "No tienes permiso para esta operación."
      );
    if (error.response.status === 429)
      return "Alcanzaste el límite de solicitudes. Espera un momento.";
    return (
      error.response.data?.mensaje ||
      error.response.data?.error ||
      "No se pudo completar la operación."
    );
  }
  return error instanceof Error
    ? error.message
    : "Ocurrió un error. Intenta nuevamente.";
}
