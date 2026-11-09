import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as SecureStore from "expo-secure-store";
import {
  api,
  clearCredentials,
  authRequest,
  invalidateRequests,
  REFRESH_KEY,
  refreshSession,
  saveSession,
  setInvalidHandler,
  message,
} from "../api/client";
import * as vault from "../lib/vault";
import { queryClient } from "../queries/client";
import type { User, Session, Challenge } from "../types/api";
import { offlineValid } from "../lib/offlinePolicy";
type State = {
  user: User | null;
  loading: boolean;
  offline: boolean;
  locked: boolean;
  notice: string;
  validatedAt: number;
  login: (path: string, body: object) => Promise<Challenge | null>;
  logout: (all?: boolean) => Promise<void>;
  restore: () => Promise<void>;
};
const Context = createContext<State | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState("");
  const [validatedAt, setValidatedAt] = useState(0);
  const epoch = useRef(0);
  const localLogout = useCallback(async () => {
    epoch.current++;
    invalidateRequests();
    await queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
    setLocked(false);
    setValidatedAt(0);
    await clearCredentials();
    await vault.eraseVault();
  }, []);
  const activate = useCallback(async (next: User) => {
    next = {
      _id: next._id,
      nombre: next.nombre,
      email: next.email,
      tenantId: next.tenantId,
      rol: next.rol,
      plan: (next.tenant?.plan || next.plan || "free") as "free" | "pro",
      nombreFinca: next.nombreFinca,
      tenant: next.tenant
        ? {
            nombreFinca: next.tenant.nombreFinca,
            plan: next.tenant.plan,
            emailAlias: next.tenant.emailAlias,
          }
        : undefined,
    };
    const ownEpoch = epoch.current;
    try {
      if (!(await vault.enableVault(next)))
        setNotice(
          "Activa el bloqueo seguro del teléfono para habilitar lectura offline.",
        );
    } catch (error) {
      setNotice(message(error));
    }
    if (ownEpoch !== epoch.current) return;
    setUser(next);
    setLocked(false);
    setValidatedAt(Date.now());
  }, []);
  const restore = useCallback(async () => {
    setLoading(true);
    setNotice("");
    const ownEpoch = epoch.current;
    try {
      const network = await NetInfo.fetch();
      const connected =
        network.isConnected !== false && network.isInternetReachable !== false;
      setOffline(!connected);
      if (!connected) {
        const local = await vault.restoreIdentity();
        if (ownEpoch !== epoch.current) return;
        if (local) {
          setUser(local.user);
          setValidatedAt(local.validatedAt);
          setLocked(false);
        } else
          setNotice("Inicia sesión con conexión para descargar tus datos.");
      } else {
        if (await SecureStore.getItemAsync(REFRESH_KEY)) {
          if (await vault.secureDevice()) await vault.unlock();
          await refreshSession();
          const { data } = await api.get<User>("/auth/perfil");
          if (ownEpoch === epoch.current) await activate(data);
        }
      }
    } catch (error) {
      const status = (error as { response?: { status: number } }).response
        ?.status;
      if (status && [400, 401, 402, 403].includes(status)) await localLogout();
      else if (!status && (error as { isAxiosError?: boolean }).isAxiosError) {
        try {
          const local = await vault.restoreIdentity();
          if (local && ownEpoch === epoch.current) {
            setUser(local.user);
            setValidatedAt(local.validatedAt);
            setOffline(true);
            setLocked(false);
          }
        } catch {
          /* Preserve the original connection error; do not erase valid encrypted data. */
        }
      }
      setNotice(message(error));
    } finally {
      setLoading(false);
    }
  }, [activate, localLogout]);
  useEffect(() => {
    setInvalidHandler(async () => {
      await localLogout();
      setNotice("Tu sesión expiró. Inicia sesión nuevamente.");
    });
    const initial = setTimeout(() => void restore(), 0);
    const network = NetInfo.addEventListener((s) =>
      setOffline(s.isConnected === false || s.isInternetReachable === false),
    );
    const app = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        setLocked(true);
        void queryClient.cancelQueries();
        queryClient.clear();
        void vault.closeVault();
      }
    });
    return () => {
      clearTimeout(initial);
      network();
      app.remove();
    };
  }, [localLogout, restore]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (offline && !offlineValid(validatedAt)) {
        setLocked(true);
        void vault.closeVault();
        queryClient.clear();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [user, offline, validatedAt]);
  async function login(path: string, body: object) {
    const { data } = await authRequest.post<Session | Challenge>(
      "/mobile/auth/" + path,
      body,
    );
    if ("mfaRequired" in data) return data;
    await localLogout();
    await saveSession(data);
    await activate(data.user);
    return null;
  }
  async function logout(all = false) {
    try {
      if (all) await api.post("/auth/logout-all");
      else {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
        if (refreshToken && !offline)
          await authRequest.post("/mobile/auth/logout", { refreshToken });
      }
    } finally {
      await localLogout();
    }
  }
  return (
    <Context.Provider
      value={{
        user,
        loading,
        offline,
        locked,
        notice,
        validatedAt,
        login,
        logout,
        restore,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider requerido");
  return value;
}
