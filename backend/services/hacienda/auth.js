/** OAuth2 managed by the SDK, with isolated tenant/environment token caches. */
const { obtenerClienteSdk, limpiarCacheClientes, SANDBOX_API_BASE_URL } = require('./sdkAdapter');

const ENDPOINTS = Object.freeze({
  sandbox: Object.freeze({
    auth: 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token',
    recepcion: `${SANDBOX_API_BASE_URL}/recepcion`,
    consulta: `${SANDBOX_API_BASE_URL}/recepcion/`,
    clienteId: 'api-stag',
  }),
  produccion: Object.freeze({
    auth: 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token',
    recepcion: 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion',
    consulta: 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/',
    clienteId: 'api-prod',
  }),
});

function getEndpoint(ambiente) {
  if (ambiente === 'local') return null;
  if (!Object.hasOwn(ENDPOINTS, ambiente)) throw new Error('Ambiente de Hacienda inválido');
  return ENDPOINTS[ambiente];
}

async function getToken(config = {}) {
  if (config.ambiente === 'local') {
    return { access_token: 'mock_local_token_no_usar_en_produccion', token_type: 'Bearer', mock: true };
  }
  const { tokenManager } = await obtenerClienteSdk(config);
  return { access_token: await tokenManager.getAccessToken(), token_type: 'Bearer' };
}

function limpiarCacheTokens(tenantId) { limpiarCacheClientes(tenantId); }

module.exports = { getToken, limpiarCacheTokens, getEndpoint, ENDPOINTS };
