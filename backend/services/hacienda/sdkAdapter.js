/** Bridge between the tenant-scoped CommonJS app and the ESM Hacienda SDK. */
const { createHash } = require('node:crypto');
const { cargarSdk } = require('./sdkLoader');

// v0.12.1 ships the old sandbox URL. Upstream documents this public override:
// https://github.com/DojoCodingLabs/hacienda-cr/blob/main/docs/testing/sandbox-403-debug.md
const SANDBOX_API_BASE_URL = 'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1';
const CLIENT_IDLE_MS = 15 * 60 * 1000;
const MAX_CLIENTS = 200;
const clients = new Map();

async function obtenerConfiguracionSdk(ambiente) {
  const sdk = await cargarSdk();
  if (!['sandbox', 'produccion'].includes(ambiente)) throw new Error('Ambiente de Hacienda inválido');
  const environment = ambiente === 'sandbox' ? sdk.Environment.Sandbox : sdk.Environment.Production;
  const config = sdk.getEnvironmentConfig(environment);
  return ambiente === 'sandbox' ? { ...config, apiBaseUrl: SANDBOX_API_BASE_URL } : config;
}

function retirarCliente(key, entry) {
  clients.delete(key);
  entry.ready.then(({ tokenManager }) => tokenManager.invalidate()).catch(() => {});
}

function limpiarCacheClientes(tenantId) {
  for (const [key, entry] of clients) {
    if (!tenantId || entry.tenantId === String(tenantId)) retirarCliente(key, entry);
  }
}

async function obtenerClienteSdk({ ambiente, usuario, password, tenantId } = {}) {
  if (!tenantId || !usuario || !password) {
    throw new Error('Hacienda requiere tenantId, usuario y contraseña propios de la finca');
  }
  if (!['sandbox', 'produccion'].includes(ambiente)) throw new Error('Ambiente de Hacienda inválido');
  const now = Date.now();
  for (const [key, entry] of clients) {
    if (now - entry.lastUsed >= CLIENT_IDLE_MS) retirarCliente(key, entry);
  }
  const key = JSON.stringify([String(tenantId), ambiente]);
  const version = createHash('sha256').update(JSON.stringify([usuario, password])).digest('hex');
  let entry = clients.get(key);
  if (entry && entry.version !== version) {
    retirarCliente(key, entry);
    entry = undefined;
  }
  if (!entry) {
    while (clients.size >= MAX_CLIENTS) {
      const [oldKey, oldEntry] = clients.entries().next().value;
      retirarCliente(oldKey, oldEntry);
    }
    entry = { tenantId: String(tenantId), version, lastUsed: now };
    entry.ready = (async () => {
      const sdk = await cargarSdk();
      const envConfig = await obtenerConfiguracionSdk(ambiente);
      const tokenManager = new sdk.TokenManager({ envConfig, requestTimeoutMs: 15000 });
      await tokenManager.authenticate({ username: usuario, password });
      const httpClient = new sdk.HttpClient({
        envConfig, tokenManager, retryUnsafeRequests: false,
        retryOptions: { maxRetries: 0 }, requestTimeoutMs: 30000,
      });
      return { sdk, tokenManager, httpClient, envConfig };
    })();
    clients.set(key, entry);
    entry.ready.catch(() => {
      if (clients.get(key) === entry) clients.delete(key);
    });
  }
  entry.lastUsed = now;
  return entry.ready;
}

module.exports = { obtenerClienteSdk, obtenerConfiguracionSdk, limpiarCacheClientes, SANDBOX_API_BASE_URL };
