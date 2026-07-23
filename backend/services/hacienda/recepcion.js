/**
 * Servicio de recepcion de comprobantes a Hacienda CR (v4.4).
 *
 *  POST  /recepcion  -> 201 Created con cabecera Location (URL de consulta)
 *  GET   /recepcion/<clave>  -> 200 OK con estado (procesando/aceptado/rechazado)
 *
 *  En ambiente local se mockean ambas llamadas para permitir el pipeline completo.
 */

const axios = require('axios');
const { getToken, getEndpoint } = require('./auth');
const mockStore = require('./mockStore');

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_INTENTOS = 24; //2 minutos max
const MOCK_PROCESANDO_MS = 6000;

/**
 * Convierte string XML -> Base64 ASCII para el payload JSON.
 */
function xmlToBase64(xmlString) {
  return Buffer.from(xmlString, 'utf8').toString('base64');
}

/**
 * Construye payload JSON para POST /recepcion.
 */
function buildRecepcionPayload({
  clave,
  fecha,
  emisorTipoId,
  emisorNumeroId,
  receptorTipoId,
  receptorNumeroId,
  comprobanteXml,
  // tipoDocumento -> "01" FE, "02" TE, ...
  // Para REP no se envia receptor
}) {
  return {
    clave,
    fecha, //ISO 8601 con -06:00
    emisor: {
      tipoIdentificacion: emisorTipoId,
      numeroIdentificacion: emisorNumeroId,
    },
    receptor: receptorNumeroId
      ? {
          tipoIdentificacion: receptorTipoId,
          numeroIdentificacion: receptorNumeroId,
        }
      : undefined,
    comprobanteXml, //Base64 del XML firmado
  };
}

/**
 * Envia el comprobante XML firmado a Hacienda.
 * Retorna { httpStatus, location, retry }.
 *
 * En ambiente local devuelve location mock y persiste en mockStore.
 */
async function enviarComprobante({
  ambiente,
  documento,
  token,
  credenciales,
}) {
  if (ambiente === 'local') {
    const location = `http://localhost:5000/api/hacienda/interno/consulta/${documento.clave}`;
    mockStore.set(documento.clave, {
      clave: documento.clave,
      estado: 'procesando',
      fecha: new Date().toISOString(),
      xmlFirmado: documento.xmlFirmado,
      respuesta: null,
      transiciones: [{ estado: 'procesando', ts: Date.now() }],
    });
    //Simula la transicion a "aceptado" tras MOCK_PROCESANDO_MS
    setTimeout(() => {
      mockStore.update(documento.clave, {
        estado: 'aceptado',
        respuesta: {
          clave: documento.clave,
          estado: 'aceptado',
          detalle: 'Aceptado por ambiente local (MOCK)',
          fecha: new Date().toISOString(),
        },
      });
      mockStore.pushTransicion(documento.clave, { estado: 'aceptado', ts: Date.now() });
    }, MOCK_PROCESANDO_MS);

    return { httpStatus: 201, location, retry: false };
  }

  const ep = getEndpoint(ambiente);
  const accessToken = token?.access_token || (await getToken({ ambiente, ...credenciales })).access_token;

  const payload = buildRecepcionPayload({
    clave: documento.clave,
    fecha: documento.fecha,
    emisorTipoId: documento.emisorTipoId,
    emisorNumeroId: documento.emisorNumeroId,
    receptorTipoId: documento.receptorTipoId,
    receptorNumeroId: documento.receptorNumeroId,
    comprobanteXml: xmlToBase64(documento.xmlFirmado),
  });

  try {
    const resp = await axios.post(ep.recepcion, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true, //no lanzar en 4xx/5xx
      maxRedirects: 0,
    });
    //201 => OK, cabecera Location
    if (resp.status === 201) {
      const location = resp.headers?.location || `${ep.consulta}${documento.clave}`;
      return { httpStatus: 201, location, retry: false };
    }
    //400 => error definitivo
    if (resp.status >= 400 && resp.status < 500) {
      return {
        httpStatus: resp.status,
        error: resp.data,
        retry: false,
      };
    }
    //5xx => reintentar
    return {
      httpStatus: resp.status,
      error: resp.data,
      retry: true,
    };
  } catch (err) {
    return {
      httpStatus: 0,
      error: { message: err.message, code: err.code },
      retry: true,
    };
  }
}

/**
 * Consulta el estado de un comprobante previamente enviado.
 * Retorna { estado, detalle, fecha, xmlRespuesta?, indentaciones? }
 */
async function consultarEstado({ ambiente, clave, location, token, credenciales }) {
  if (ambiente === 'local') {
    const mock = mockStore.get(clave);
    return {
      estado: mock?.estado || 'procesando',
      detalle: mock?.respuesta?.detalle || null,
      fecha: mock?.respuesta?.fecha || new Date().toISOString(),
      xmlRespuesta: mock?.respuesta?.xml || null,
    };
  }
  const ep = getEndpoint(ambiente);
  const accessToken = token?.access_token || (await getToken({ ambiente, ...credenciales })).access_token;
  const url = location || `${ep.consulta}${clave}`;

  const { data, status } = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 20000,
    validateStatus: () => true,
  });

  if (status >= 200 && status < 300) {
    return {
      estado: data?.indEstado || 'procesando', //procesando | aceptado | rechazado | recibido
      detalle: data?.indEstado === 'rechazado' ? 'Comprobante rechazado por Hacienda' : null,
      fecha: data?.fecha ? new Date(data.fecha).toISOString() : new Date().toISOString(),
      raw: data,
    };
  }
  return { estado: 'procesando', httpStatus: status, raw: data };
}

/**
 * Polling controlado hasta tener estado terminal.
 */
async function pollingHastaTerminal({ ambiente, clave, location, token, credenciales, intentos = POLL_MAX_INTENTOS, intervalo = POLL_INTERVAL_MS }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    ultimo = await consultarEstado({ ambiente, clave, location, token, credenciales });
    if (ultimo.estado === 'aceptado' || ultimo.estado === 'rechazado') return ultimo;
    await sleep(intervalo);
  }
  return { ...ultimo, timeout: true };
}

module.exports = {
  enviarComprobante,
  consultarEstado,
  pollingHastaTerminal,
  xmlToBase64,
  buildRecepcionPayload,
};
