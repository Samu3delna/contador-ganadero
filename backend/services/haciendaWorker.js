/**
 * Worker asincrono de envio de comprobantes a Hacienda.
 *
 *  Loop:
 *   1. Busca comprobantes en estado " firmada " pendientes de envio
 *   2. Para cada uno: envia a Hacienda, captura Location, pone en "procesando"
 *   3. Loop de polling: actualiza a "aceptado" / "rechazado"
 *
 *  Pensado para un proceso separado (worker.js) o ser llamado por cron.
 *  No bloquea el request HTTP de creacion de factura.
 */

const FacturaEmision = require('../models/FacturaEmision');
const hacienda = require('./hacienda');
const { generarClave } = hacienda.clave50;
const { buildXml } = hacienda.xmlBuilder;
const { firmarDocumento } = hacienda.signer;
const { enviarComprobante, pollingHastaTerminal } = hacienda.recepcion;
const { getToken } = hacienda.auth;

const INTERVALO_TICK_MS = 15000;
const MAX_DOC_POR_TICK = 5;

let _running = false;
let _timer = null;

/**
 * Lee variables de entorno una sola vez.
 */
function getConfig() {
  return {
    ambiente: process.env.HACIENDA_AMBIENTE || 'local',
    p12Path: process.env.HACIENDA_P12_PATH || '',
    pin: process.env.HACIENDA_PIN || '',
    usuario: process.env.HACIENDA_USUARIO || '',
    password: process.env.HACIENDA_PASSWORD || '',
  };
}

/**
 * "Prepara" un comprobante en estado "borrador":
 *  - Asigna claveNumerica + consecutivo si faltan
 *  - Genera XML v4.4
 *  - Firma (mock o XAdES-EPES real)
 *  - guard as "firmada"
 *
 *  Lanzado por el controller POST /emision.
 */
async function prepararYFirmar(facturaId) {
  const factura = await FacturaEmision.findById(facturaId);
  if (!factura) throw new Error('Factura no encontrada');
  if (factura.estado !== 'borrador') {
    return factura; //ya firmada o en proceso
  }

  const cfg = getConfig();

  //Generar clave si no existe
  if (!factura.claveNumerica) {
    const secuencialNum = parseInt(factura.consecutivo.slice(-10) || '0000000001', 10);
    const { clave, consecutivo: consGen } = generarClave({
      fecha: factura.fechaEmision || new Date(),
      tipoDocumento: factura.tipoDocumento || 'FE',
      cedulaEmisor: factura.emisor?.cedula?.numero,
      tipoCedula: factura.emisor?.cedula?.tipo || '01',
      sucursal: '001',
      terminal: '00001',
      secuencia: secuencialNum,
    });
    factura.claveNumerica = clave;
    //Mantener consecutivo del modelo (20 digitos); clave se usa solo en XML
    if (!factura.consecutivo || factura.consecutivo.length !== 20) {
      factura.consecutivo = consGen;
    }
    factura.ambiente = cfg.ambiente;
  }

  //Construir XML
  const xml = buildXml(factura.toObject ? factura.toObject() : factura);

  //Firmar
  const xmlFirmado = firmarDocumento(xml, {
    p12Path: cfg.p12Path,
    pin: cfg.pin,
    ambiente: cfg.ambiente,
  });

  factura.xmlFirmado = xmlFirmado;
  factura.estado = 'firmada';
  factura.hashFirma = require('crypto').createHash('sha256').update(xmlFirmado).digest('hex').slice(0, 32);
  await factura.save();
  return factura;
}

/**
 * Envia un comprobante firmado a Hacienda y registra respuesta inicial.
 */
async function enviarPendientes() {
  if (_running) return;
  _running = true;
  try {
    const cfg = getConfig();
    const pendientes = await FacturaEmision
      .find({ estado: 'firmada' })
      .sort({ createdAt: 1 })
      .limit(MAX_DOC_POR_TICK);

    if (pendientes.length === 0) return;

    const token = await getToken({
      ambiente: cfg.ambiente,
      usuario: cfg.usuario,
      password: cfg.password,
    }).catch((e) => {
      console.error('[hacienda worker] error obtencion token:', e.message);
      return null;
    });
    if (!token && cfg.ambiente !== 'local') return;

    for (const factura of pendientes) {
      try {
        const documento = {
          clave: factura.claveNumerica,
          fecha: (factura.fechaEmision || new Date()).toISOString(),
          emisorTipoId: factura.emisor?.cedula?.tipo || '01',
          emisorNumeroId: factura.emisor?.cedula?.numero,
          receptorTipoId: factura.receptor?.cedula?.tipo || '02',
          receptorNumeroId: factura.receptor?.cedula?.numero,
          xmlFirmado: factura.xmlFirmado,
        };
        const resp = await enviarComprobante({
          ambiente: cfg.ambiente,
          documento,
          token,
          credenciales: { usuario: cfg.usuario, password: cfg.password },
        });

        if (resp.httpStatus === 201) {
          factura.estado = 'procesando';
          factura.fechaEnvioHacienda = new Date();
          factura.respuestaHacienda = {
            clave: factura.claveNumerica,
            estado: 'procesando',
            detalle: 'Enviado a Hacienda',
            fecha: new Date(),
            location: resp.location,
          };
          await factura.save();
          console.log(`[hacienda worker] enviado ${factura.claveNumerica} -> Location: ${resp.location}`);
        } else if (resp.retry) {
          //Reintentar en siguiente tick
          console.warn(`[hacienda worker] retry para ${factura.claveNumerica}: http=${resp.httpStatus}`);
        } else {
          factura.estado = 'rechazada';
          factura.fechaRespuestaHacienda = new Date();
          factura.respuestaHacienda = {
            clave: factura.claveNumerica,
            estado: 'rechazado',
            detalle: JSON.stringify(resp.error || 'Error definitivo'),
            fecha: new Date(),
          };
          await factura.save();
          console.warn(`[hacienda worker] rechazado ${factura.claveNumerica}:`, resp.error);
        }
      } catch (err) {
        console.error(`[hacienda worker] error envio ${factura.claveNumerica}:`, err.message);
      }
    }
  } finally {
    _running = false;
  }
}

/**
 * Hace polling para los comprobantes en estado "procesando".
 */
async function consultarProcesando() {
  const cfg = getConfig();
  const enProceso = await FacturaEmision
    .find({ estado: 'procesando' })
    .sort({ fechaEnvioHacienda: 1 })
    .limit(MAX_DOC_POR_TICK);

  for (const factura of enProceso) {
    try {
      const resultado = await pollingHastaTerminal({
        ambiente: cfg.ambiente,
        clave: factura.claveNumerica,
        location: factura.respuestaHacienda?.location,
        intentos: 1, //un solo intento por tick
        intervalo: 100,
      });
      if (resultado.estado === 'aceptado' || resultado.estado === 'rechazado') {
        factura.estado = resultado.estado === 'aceptado' ? 'aceptada' : 'rechazada';
        factura.fechaRespuestaHacienda = new Date();
        factura.respuestaHacienda = {
          clave: factura.claveNumerica,
          estado: resultado.estado,
          detalle: resultado.detalle,
          fecha: new Date(),
          location: factura.respuestaHacienda?.location,
          xml: resultado.xmlRespuesta,
          indicaciones: resultado.raw?.indEstado || '',
        };
        await factura.save();
        console.log(`[hacienda worker] ${factura.claveNumerica} -> ${factura.estado}`);
      }
    } catch (err) {
      console.error(`[hacienda worker] error consulta ${factura.claveNumerica}:`, err.message);
    }
  }
}

/**
 * Un tick completo del worker.
 */
async function tick() {
  await enviarPendientes();
  await consultarProcesando();
}

function iniciar(intervaloMs = INTERVALO_TICK_MS) {
  if (_timer) return;
  console.log(`[hacienda worker] iniciado (intervalo ${intervaloMs}ms, ambiente ${process.env.HACIENDA_AMBIENTE || 'local'})`);
  _timer = setInterval(async () => {
    try { await tick(); } catch (e) { console.error('[hacienda worker] tick error:', e.message); }
  }, intervaloMs);
  //tick inicial
  tick().catch((e) => console.error('[hacienda worker] tick inicial error:', e.message));
}

function detener() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[hacienda worker] detenido');
  }
}

module.exports = {
  prepararYFirmar,
  enviarPendientes,
  consultarProcesando,
  tick,
  iniciar,
  detener,
  getConfig,
};
