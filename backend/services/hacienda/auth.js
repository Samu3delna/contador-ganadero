/**
 * Autenticacion con Hacienda CR (OAuth2/OpenID Connect).
 *
 * Flujo:
 *  1. POST a /token?grant_type=password con credenciales de usuario (cpf-...)
 *  2. Captura access_token (JWT) y refresh_token
 *  3. Usa access_token en Authorization: Bearer <token>
 *
 * En ambiente local no llama a Hacienda y devuelve un token mock.
 */

const axios = require('axios');

const ENDPOINTS = {
  sandbox: {
    auth: 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token',
    recepcion: 'https://api.sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion',
    consulta: 'https://api.sandbox.comprobanteselectronicos.go.cr/recepcion/v1/',
    clienteId: 'api-stag',
  },
  produccion: {
    auth: 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token',
    recepcion: 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion',
    consulta: 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/',
    clienteId: 'api-prod',
  },
};

const TOKEN_CACHE = new Map();

function getEndpoint(ambiente) {
  if (ambiente === 'produccion') return ENDPOINTS.produccion;
  if (ambiente === 'sandbox') return ENDPOINTS.sandbox;
  return null; //local
}

async function getToken({ ambiente, usuario, password } = {}) {
  if (ambiente === 'local') {
    return {
      access_token: 'mock_local_token_no_usar_en_produccion',
      expires_in: 300,
      token_type: 'Bearer',
      mock: true,
    };
  }
  const ep = getEndpoint(ambiente);
  if (!ep) throw new Error('Ambiente invalido para auth');
  if (!usuario || !password) throw new Error('usuario y password requeridos');

  const cacheKey = `${ambiente}:${usuario}`;
  const cached = TOKEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 5000) return cached.payload;

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', ep.clienteId);
  params.append('username', usuario);
  params.append('password', password);

  const { data } = await axios.post(ep.auth, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });

  const payload = {
    access_token: data.access_token,
    expires_in: data.expires_in || 300,
    token_type: data.token_type || 'Bearer',
    refresh_token: data.refresh_token,
  };
  TOKEN_CACHE.set(cacheKey, { payload, expiresAt: Date.now() + (data.expires_in - 30) * 1000 });
  return payload;
}

function limpiarCacheTokens() {
  TOKEN_CACHE.clear();
}

module.exports = {
  getToken,
  limpiarCacheTokens,
  getEndpoint,
  ENDPOINTS,
};
