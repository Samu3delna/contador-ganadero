import React from "react";
import { Text, Button } from "react-native";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import * as vault from "../src/lib/vault";
import * as client from "../src/api/client";
import NetInfo from "@react-native-community/netinfo";
import { queryClient } from "../src/queries/client";
const user = {
  _id: "a".repeat(24),
  tenantId: "b".repeat(24),
  nombre: "Finca de prueba",
  email: "finca@example.test",
  rol: "dueño",
  plan: "free" as const,
};
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => "stored-refresh"),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(), addEventListener: jest.fn(() => () => {}) },
}));
jest.mock("../src/lib/vault", () => ({
  secureDevice: jest.fn(async () => true),
  unlock: jest.fn(),
  enableVault: jest.fn(async () => true),
  restoreIdentity: jest.fn(),
  eraseVault: jest.fn(),
  closeVault: jest.fn(),
}));
jest.mock("../src/api/client", () => ({
  REFRESH_KEY: "cg.refresh",
  clearCredentials: jest.fn(),
  invalidateRequests: jest.fn(),
  refreshSession: jest.fn(),
  saveSession: jest.fn(),
  setInvalidHandler: jest.fn(),
  message: (e: Error) => e.message,
  api: { get: jest.fn(), post: jest.fn() },
  authRequest: { post: jest.fn() },
}));
function Probe() {
  const auth = useAuth();
  return (
    <>
      <Text>
        {auth.loading ? "loading" : auth.user?.nombre || "no session"}
      </Text>
      <Text>{auth.offline ? "offline" : "online"}</Text>
      <Button title="Logout" onPress={() => void auth.logout()} />
    </>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
  (client.api.get as jest.Mock).mockResolvedValue({ data: user });
});
test("reinicio restaura sesión con desbloqueo, refresh y perfil", async () => {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText(user.nombre)).toBeTruthy());
  expect(vault.unlock).toHaveBeenCalled();
  expect(client.refreshSession).toHaveBeenCalledTimes(1);
  expect(client.api.get).toHaveBeenCalledWith("/auth/perfil");
});
test("reinicio offline restaura solo la identidad protegida", async () => {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
  (vault.restoreIdentity as jest.Mock).mockResolvedValue({
    user,
    validatedAt: Date.now(),
  });
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText(user.nombre)).toBeTruthy());
  expect(screen.getByText("offline")).toBeTruthy();
  expect(client.refreshSession).not.toHaveBeenCalled();
});
test("logout limpia credenciales, identidad, Query y base cifrada", async () => {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByText(user.nombre)).toBeTruthy());
  queryClient.setQueryData(["private"], { secret: 1 });
  await fireEvent.press(screen.getByText("Logout"));
  await waitFor(() => expect(screen.getByText("no session")).toBeTruthy());
  expect(client.clearCredentials).toHaveBeenCalled();
  expect(vault.eraseVault).toHaveBeenCalled();
  expect(queryClient.getQueryData(["private"])).toBeUndefined();
});
