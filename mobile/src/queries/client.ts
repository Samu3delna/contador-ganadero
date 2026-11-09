import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 60000 },
    mutations: { retry: false, networkMode: "always" },
  },
});
