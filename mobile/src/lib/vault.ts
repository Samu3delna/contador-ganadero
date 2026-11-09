import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import { scopeId, offlineValid } from "./offlinePolicy";
import type { User } from "../types/api";
const META = "cg.offline.identity";
let db: SQLite.SQLiteDatabase | null = null;
let scope: string | null = null;
let serial: Promise<unknown> = Promise.resolve();
function queue<T>(fn: () => Promise<T>): Promise<T> {
  const work = serial.then(fn, fn);
  serial = work.catch(() => {});
  return work;
}
export async function secureDevice() {
  return (
    (await LocalAuthentication.getEnrolledLevelAsync()) !==
    LocalAuthentication.SecurityLevel.NONE
  );
}
export async function unlock() {
  if (!(await secureDevice()))
    throw new Error(
      "Configura un bloqueo seguro para consultar datos sin conexión.",
    );
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Desbloquear tu finca",
    cancelLabel: "Cancelar",
    fallbackLabel: "Usar código",
    disableDeviceFallback: false,
  });
  if (!result.success) throw new Error("No se desbloquearon los datos.");
}
async function open(user: User) {
  const next = scopeId(user);
  if (db && scope === next) return db;
  if (db) await db.closeAsync();
  db = null;
  scope = null;
  const keyName = "cg.key." + next;
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync(keyName, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Clave local inválida.");
  const connection = await SQLite.openDatabaseAsync("cg." + next + ".db");
  const cipher = await connection.getFirstAsync("PRAGMA cipher_version");
  if (!cipher) {
    await connection.closeAsync();
    throw new Error(
      "Esta compilación no admite caché cifrada. Usa la compilación de desarrollo.",
    );
  }
  await connection.execAsync(
    "PRAGMA key = '" +
      key +
      "'; CREATE TABLE IF NOT EXISTS cache (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL);",
  );
  db = connection;
  scope = next;
  return connection;
}
export async function enableVault(user: User) {
  return queue(async () => {
    if (!(await secureDevice())) return false;
    await open(user);
    await SecureStore.setItemAsync(META, JSON.stringify({ user, validatedAt: Date.now() }));
    return true;
  });
}
export async function restoreIdentity(): Promise<{
  user: User;
  validatedAt: number;
} | null> {
  await unlock();
  return queue(async () => {
    const raw = await SecureStore.getItemAsync(META);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!offlineValid(value.validatedAt)) throw new Error("Conéctate para renovar el acceso offline de siete días.");
    await open(value.user);
    return value;
  });
}
export function writeCache(user: User, id: string, value: unknown) {
  return queue(async () => {
    if (!db || scope !== scopeId(user)) return;
    await db.runAsync(
      "INSERT OR REPLACE INTO cache (id,value,updated) VALUES (?,?,?)",
      id,
      JSON.stringify(value),
      Date.now(),
    );
  });
}
export function readCache(user: User, id: string) {
  return queue(async () => {
    if (!db || scope !== scopeId(user)) return null;
    const row = await db.getFirstAsync<{ value: string; updated: number }>(
      "SELECT value,updated FROM cache WHERE id=?",
      id,
    );
    return row ? { data: JSON.parse(row.value), updated: row.updated } : null;
  });
}
export function closeVault() {
  return queue(async () => {
    if (db) await db.closeAsync();
    db = null;
    scope = null;
  });
}
export async function eraseVault() {
  return queue(async () => {
    const raw = await SecureStore.getItemAsync(META);
    if (db) await db.closeAsync();
    db = null;
    scope = null;
    try {
      if (raw) {
        const id = scopeId(JSON.parse(raw).user);
        await SecureStore.deleteItemAsync("cg.key." + id);
        await SQLite.deleteDatabaseAsync("cg." + id + ".db");
      }
    } finally {
      await SecureStore.deleteItemAsync(META);
    }
  });
}
