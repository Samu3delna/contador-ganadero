import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import * as SecureStore from "expo-secure-store";
import {
  api,
  authRequest,
  saveSession,
  refreshSession,
  invalidateRequests,
  setInvalidHandler,
  message,
} from "../src/api/client";
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: "https://example.test/api" } } },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
  },
}));
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config,
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
});
beforeEach(() => {
  jest.clearAllMocks();
  invalidateRequests();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("refresh-old");
});
test("varios 401 comparten refresh y reintentan una vez con token nuevo", async () => {
  let refreshCount = 0;
  authRequest.defaults.adapter = async (config) => {
    refreshCount++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return response(config, {
      accessToken: "access-new",
      refreshToken: "refresh-new",
    });
  };
  api.defaults.adapter = async (config) => {
    if (config.headers.Authorization !== "Bearer access-new")
      throw new AxiosError("expired", "401", config, undefined, {
        ...response(config, {}),
        status: 401,
      });
    return response(config, { ok: true });
  };
  await saveSession({ accessToken: "access-old", refreshToken: "refresh-old" });
  const results = await Promise.all([
    api.get("/a"),
    api.get("/b"),
    api.get("/c"),
  ]);
  expect(results.every((r) => r.data.ok)).toBe(true);
  expect(refreshCount).toBe(1);
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
    "cg.refresh",
    "refresh-new",
  );
});
test("respuesta de refresh tras logout no restaura credenciales", async () => {
  let release: (value: unknown) => void = () => {};
  authRequest.defaults.adapter = (config) =>
    new Promise((resolve) => {
      release = () =>
        resolve(
          response(config, { accessToken: "late", refreshToken: "late" }),
        );
    });
  const work = refreshSession();
  await Promise.resolve();
  await Promise.resolve();
  invalidateRequests();
  release(null);
  await expect(work).rejects.toThrow("Sesión cerrada");
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
test("refresh rechazado invalida sesión local", async () => {
  const invalid = jest.fn(async () => {});
  setInvalidHandler(invalid);
  api.defaults.adapter = async (config) => {
    throw new AxiosError("expired", "401", config, undefined, {
      ...response(config, {}),
      status: 401,
    });
  };
  authRequest.defaults.adapter = async (config) => {
    throw new AxiosError("revoked", "401", config, undefined, {
      ...response(config, {}),
      status: 401,
    });
  };
  await expect(api.get("/a")).rejects.toThrow();
  expect(invalid).toHaveBeenCalledTimes(1);
});
test("mensajes de red y permisos son comprensibles", () => {
  expect(message(new AxiosError("network"))).toMatch(/conexión/);
  expect(
    message(
      new AxiosError("denied", "403", undefined, undefined, {
        status: 403,
        data: {},
        statusText: "",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    ),
  ).toMatch(/permiso/);
});
