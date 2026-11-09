import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { readCache, writeCache } from "../lib/vault";
import { offlineValid } from "../lib/offlinePolicy";
export function useRemote<T>(path: string, cache = false) {
  const { user, offline, locked, validatedAt } = useAuth();
  return useQuery<{ data: T; updated: number }>({
    queryKey: [user?.tenantId, user?._id, path, offline],
    enabled: !!user && !locked,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      if (offline) {
        if (!offlineValid(validatedAt))
          throw new Error("Conéctate para renovar el acceso offline.");
        const saved = cache && user ? await readCache(user, path) : null;
        if (!saved)
          throw new Error(
            "Estos datos aún no se han descargado. Conéctate para consultarlos.",
          );
        return saved;
      }
      const { data } = await api.get<T>(path, { signal });
      if (!signal.aborted && cache && user)
        await writeCache(user, path, data).catch(() => {});
      return { data, updated: Date.now() };
    },
  });
}
