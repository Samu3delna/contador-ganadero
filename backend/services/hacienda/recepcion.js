/** SDK transport; only a Hacienda status response establishes fiscal rejection. */
const { obtenerClienteSdk, limpiarCacheClientes } = require('./sdkAdapter');
const { getEndpoint } = require('./auth');
const mockStore = require('./mockStore');
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_INTENTOS = 24;
const MOCK_PROCESANDO_MS = 6000;
const ALLOWED_HOSTS = new Set(['api.comprobanteselectronicos.go.cr', 'api-sandbox.comprobanteselectronicos.go.cr']);

function validarUrlConsultaHacienda(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('URL de consulta de Hacienda inválida'); }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password ||
      (url.port && url.port !== '443') || url.search || url.hash) {
    throw new Error('URL de consulta de Hacienda no permitida');
  }
  return url.toString();
}

function validarClave(clave) {
  if (typeof clave !== 'string' || !/^\d{50}$/.test(clave)) throw new Error('La clave de Hacienda debe tener 50 dígitos');
}

function xmlToBase64(xmlString) { return Buffer.from(xmlString, 'utf8').toString('base64'); }

function buildRecepcionPayload({ clave, fecha, emisorTipoId, emisorNumeroId, receptorTipoId, receptorNumeroId, comprobanteXml }) {
  return { clave, fecha, emisor: { tipoIdentificacion: emisorTipoId, numeroIdentificacion: emisorNumeroId },
    ...(receptorNumeroId ? { receptor: { tipoIdentificacion: receptorTipoId, numeroIdentificacion: receptorNumeroId } } : {}),
    comprobanteXml };
}

function falloTransporte(error, credenciales) {
  const httpStatus = Number.isInteger(error.statusCode) ? error.statusCode : 0;
  if (httpStatus === 401) limpiarCacheClientes(credenciales?.tenantId);
  const consultaRequerida = !httpStatus || httpStatus === 409 || httpStatus >= 500 || httpStatus < 400;
  return { httpStatus, retry: false, consultaRequerida, errorSinRechazo: true,
    // Never persist raw upstream bodies/errors: they can contain XML or credentials.
    error: { code: httpStatus ? `HACIENDA_HTTP_${httpStatus}` : 'HACIENDA_TRANSPORTE_INCIERTO',
      message: consultaRequerida
        ? 'La recepción no está confirmada. Consultar la misma clave antes de cualquier reenvío.'
        : `Hacienda respondió HTTP ${httpStatus}. Revisar la configuración o el envío; no es un rechazo fiscal.` } };
}

async function enviarComprobante({ ambiente, documento, credenciales }) {
  validarClave(documento?.clave);
  if (ambiente === 'local') {
    const location = `http://localhost:5000/api/hacienda/interno/consulta/${documento.clave}`;
    // Timestamps avoid live timers and preserve idempotence in the local simulation.
    if (!mockStore.get(documento.clave)) {
      mockStore.set(documento.clave, { clave: documento.clave, estado: 'procesando', fecha: new Date().toISOString(),
        xmlFirmado: documento.xmlFirmado, aceptadoDesde: Date.now() + MOCK_PROCESANDO_MS,
        transiciones: [{ estado: 'procesando', ts: Date.now() }] });
    }
    return { httpStatus: 201, location, retry: false };
  }
  if (typeof documento.xmlFirmado !== 'string' || !documento.xmlFirmado || /MockSig|MOCK_LOCAL|>MOCK</.test(documento.xmlFirmado)) {
    throw new Error('No se puede enviar un XML vacío o una firma simulada a Hacienda');
  }
  const ep = getEndpoint(ambiente);
  // Never trust caller-supplied tokens or Locations: resolve both by tenant/environment.
  const { sdk, httpClient } = await obtenerClienteSdk({ ...credenciales, ambiente });
  const payload = buildRecepcionPayload({ ...documento, comprobanteXml: xmlToBase64(documento.xmlFirmado) });
  try {
    const result = await sdk.submitDocument(httpClient, payload);
    if (result.status === 201) return { httpStatus: 201, location: `${ep.consulta}${documento.clave}`, retry: false };
    return falloTransporte({ statusCode: result.status }, credenciales);
  } catch (error) { return falloTransporte(error, credenciales); }
}

async function consultarEstado({ ambiente, clave, credenciales }) {
  validarClave(clave);
  if (ambiente === 'local') {
    const mock = mockStore.get(clave);
    if (mock?.estado === 'procesando' && Date.now() >= mock.aceptadoDesde) {
      mockStore.update(clave, { estado: 'aceptado', respuesta: {
        detalle: 'Aceptado por ambiente local (MOCK)', fecha: new Date().toISOString() } });
      mockStore.pushTransicion(clave, { estado: 'aceptado', ts: Date.now() });
    }
    const result = mockStore.get(clave);
    return { estado: result?.estado || 'procesando', detalle: result?.respuesta?.detalle || null,
      fecha: result?.respuesta?.fecha || new Date().toISOString(), xmlRespuesta: result?.respuesta?.xml || null,
      ...(!result ? { noEncontrado: true, httpStatus: 404 } : {}) };
  }
  const { sdk, httpClient } = await obtenerClienteSdk({ ...credenciales, ambiente });
  try {
    const result = await sdk.getStatus(httpClient, clave);
    if (result.clave !== clave || !['recibido', 'procesando', 'aceptado', 'rechazado', 'error'].includes(result.status)) {
      return { estado: 'procesando', httpStatus: 200, errorSinRechazo: true,
        detalle: 'Respuesta de Hacienda inválida o correspondiente a otra clave.' };
    }
    return { estado: result.status === 'error' ? 'procesando' : result.status,
      detalle: result.status === 'rechazado'
        ? (result.responseXml && sdk.extractRejectionReason(result.responseXml)) || 'Comprobante rechazado por Hacienda'
        : result.status === 'error' ? 'Hacienda informa un error de procesamiento; requiere revisión.' : null,
      fecha: result.date || new Date().toISOString(), xmlRespuesta: result.responseXml || null, raw: result.raw,
      ...(result.status === 'error' ? { errorSinRechazo: true } : {}) };
  } catch (error) {
    const failure = falloTransporte(error, credenciales);
    return { estado: 'procesando', ...failure, ...(failure.httpStatus === 404 ? { noEncontrado: true } : {}) };
  }
}

async function pollingHastaTerminal({ intentos = POLL_MAX_INTENTOS, intervalo = POLL_INTERVAL_MS, ...config }) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    ultimo = await consultarEstado(config);
    if (ultimo.estado === 'aceptado' || ultimo.estado === 'rechazado') return ultimo;
    if (i + 1 < intentos) await new Promise((resolve) => setTimeout(resolve, intervalo));
  }
  return { ...ultimo, timeout: true };
}

module.exports = { enviarComprobante, consultarEstado, pollingHastaTerminal, xmlToBase64, buildRecepcionPayload, validarUrlConsultaHacienda };
