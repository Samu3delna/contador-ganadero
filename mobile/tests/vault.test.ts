import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Local from "expo-local-authentication";
import {
  enableVault,
  closeVault,
  eraseVault,
  restoreIdentity,
  writeCache,
  readCache,
} from "../src/lib/vault";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(32)),
}));
jest.mock("expo-local-authentication", () => ({
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  SecurityLevel: { NONE: 0 },
}));
const user = {
  _id: "a".repeat(24),
  tenantId: "b".repeat(24),
  nombre: "Ana",
  email: "a@example.test",
  rol: "dueño",
  plan: "free" as const,
};
const conn = {
  getFirstAsync: jest.fn(),
  execAsync: jest.fn(),
  closeAsync: jest.fn(),
  runAsync: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  (Local.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(1);
  (Local.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(conn);
  conn.getFirstAsync.mockResolvedValue({ cipher_version: "4" });
});
afterEach(async () => {
  await closeVault();
});
test("sin bloqueo seguro no persiste datos", async () => {
  (Local.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(0);
  expect(await enableVault(user)).toBe(false);
  expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
});
test("sin SQLCipher falla cerrado antes de escribir datos", async () => {
  conn.getFirstAsync.mockResolvedValue(null);
  await expect(enableVault(user)).rejects.toThrow("cifrada");
  expect(conn.execAsync).not.toHaveBeenCalled();
});
test("cache de otro tenant nunca se lee ni escribe", async () => {
  await enableVault(user);
  const other = { ...user, tenantId: "c".repeat(24) };
  expect(await readCache(other, "/dashboard")).toBeNull();
  await writeCache(other, "/dashboard", { secret: 1 });
  expect(conn.runAsync).not.toHaveBeenCalled();
});
test("caducidad offline exige conexión y desbloqueo", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
    JSON.stringify({ user, validatedAt: Date.now() - 8 * 86400000 }),
  );
  await expect(restoreIdentity()).rejects.toThrow("siete días");
  expect(Local.authenticateAsync).toHaveBeenCalled();
  expect(SQLite.openDatabaseAsync).not.toHaveBeenCalled();
});
test("logout destruye clave y base cifrada", async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
    JSON.stringify({ user, validatedAt: Date.now() }),
  );
  await eraseVault();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
    "cg.key." + user.tenantId + "." + user._id,
  );
  expect(SQLite.deleteDatabaseAsync).toHaveBeenCalled();
});
