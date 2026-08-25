/**
 * Worker asincrono de envio de comprobantes a Hacienda (Multi-tenant).
 *
 *  Loop:
 *   1. Busca comprobantes en estado "firmada" pendientes de envio
 *   2. Agrupa por tenantId
 *   3. Para cada tenant: obtiene config, token, envia comprobantes
 *   4. Loop de polling: actualiza a "aceptado" / "rechazado"
 *
 *  Pensado para un proceso separado (worker.js) o ser llamado por cron.
 *  No bloquea el request HTTP de creacion de factura.
 */

const FacturaEmision = require('../models/FacturaEmision');
const Tenant = require('../models/Tenant');
const hacienda = require('./hacienda');
const { generarClave } = hacienda.clave50;
const { buildXml } = hacienda.xmlBuilder;
const { firmarDocumento, cargarLlaveDesdeBase64, limpiarCacheLlave } = hacienda.signer;
const { enviarComprobante, pollingHastaTerminal } = hacienda.recepcion;
const { getToken } = hacienda.auth;

const INTERVALO_TICK_MS = 15000;
const MAX_DOC_POR_TICK = 5;
const MAX_TENANTS_POR_TICK = 3;

let _running = false;
let _timer = null;

/**
 * Obtiene configuración de Hacienda para un tenant específico.
 * @param {Object} tenant - Documento Tenant con configuracionHacienda
 * @returns {Object} config con credenciales desencriptadas
 */
function getTenantConfig(tenant) {
  const hc = tenant.configuracionHacienda || {};
  return {
    ambiente: hc.ambiente || 'local',
    p12Base64: hc.certificadoP12Base64 || '',
    pin: hc.obtenerPinCertificado ? hc.obtenerPinCertificado() : null,
    usuario: hc.usuarioHacienda || '',
    password: hc.obtenerPasswordHacienda ? hc.obtenerPasswordHacienda() : null,
    sucursal: hc.sucursal || '001',
    terminal: hc.terminal || '00001',
    codigoActividad: hc.codigoActividad || '000000',
    tenantId: tenant._id.toString(),
  };
}

/**
 * Obtiene configuración global (legacy) desde variables de entorno.
 * @returns {Object} config global
 */
function getGlobalConfig() {
  return {
    ambiente: process.env.HACIENDA_AMBIENTE || 'local',
    p12Path: process.env.HACIENDA_P12_PATH || '',
    pin: process.env.HACIENDA_PIN || '',
    usuario: process.env.HACIENDA_USUARIO || '',
    password: process.env.HACIENDA_PASSWORD || '',
    sucursal: '001',
    terminal: '00001',
    codigoActividad: '000000',
    tenantId: 'global',
  };
}

/**
 * "Prepara" un comprobante en estado "borrador":
 *  - Asigna claveNumerica + consecutivo si faltan
 *  - Genera XML v4.4
 *  - Firma (mock o XAdES-EPES real)
 *  - guarda como "firmada"
 *
 *  Lanzado por el controller POST /emision.
 */
async function prepararYFirmar(facturaId) {
  const factura = await FacturaEmision.findById(facturaId).populate('tenantId');
  if (!factura) throw new Error('Factura no encontrada');
  if (factura.estado !== 'borrador') {
    return factura; // ya firmada o en proceso
  }

  // Obtener config del tenant o global (legacy)
  let cfg;
  if (factura.tenantId && factura.tenantId.configuracionHacienda) {
    cfg = getTenantConfig(factura.tenantId);
  } else {
    cfg = getGlobalConfig();
  }

  // Generar clave si no existe
  if (!factura.claveNumerica) {
    const secuencialNum = parseInt(factura.consecutivo.slice(-10) || '0000000001', 10);
    const { clave, consecutivo: consGen } = generarClave({
      fecha: factura.fechaEmision || new Date(),
      tipoDocumento: factura.tipoDocumento || 'FE',
      cedulaEmisor: factura.emisor?.cedula?.numero,
      tipoCedula: factura.emisor?.cedula?.tipo || '01',
      sucursal: cfg.sucursal,
      terminal: cfg.terminal,
      secuencia: secuencialNum,
    });
    factura.claveNumerica = clave;
    // Mantener consecutivo del modelo (20 digitos); clave se usa solo en XML
    if (!factura.consecutivo || factura.consecutivo.length !== 20) {
      factura.consecutivo = consGen;
    }
    factura.ambiente = cfg.ambiente;
  }

  // Construir XML
  const xml = buildXml(factura.toObject ? factura.toObject() : factura);

  // Firmar
  let xmlFirmado;
  if (cfg.p12Base64 && cfg.pin) {
    xmlFirmado = firmarDocumento(xml, {
      p12Base64: cfg.p12Base64,
      pin: cfg.pin,
      cacheKey: cfg.tenantId,
      ambiente: cfg.ambiente,
    });
  } else if (cfg.p12Path && cfg.pin) {
    // Legacy: archivo en filesystem
    xmlFirmado = firmarDocumento(xml, {
      p12Path: cfg.p12Path,
      pin: cfg.pin,
      ambiente: cfg.ambiente,
    });
  } else {
    throw new Error('No hay certificado configurado para este tenant');
  }

  factura.xmlFirmado = xmlFirmado;
  factura.estado = 'firmada';
  factura.hashFirma = require('crypto').createHash('sha256').update(xmlFirmado).digest('hex').slice(0, 32);
  await factura.save();
  return factura;
}

/**
 * Envía comprobantes firmados a Hacienda agrupados por tenant.
 */
async function enviarPendientes() {
  if (_running) return;
  _running = true;
  try {
    // Buscar facturas pendientes y poblar tenantId
    const pendientes = await FacturaEmision
      .find({ estado: 'firmada' })
      .populate('tenantId')
      .sort({ createdAt: 1 })
      .limit(MAX_DOC_POR_TICK * MAX_TENANTS_POR_TICK);

    if (pendientes.length === 0) return;

    // Agrupar por tenantId
    const porTenant = {};
    for (const factura of pendientes) {
      const tid = factura.tenantId?._id?.toString() || 'global';
      if (!porTenant[tid]) porTenant[tid] = [];
      porTenant[tid].push(factura);
    }

    // Procesar cada tenant
    for (const [tenantId, facturas] of Object.entries(porTenant)) {
      try {
        // Obtener config del tenant
        let cfg;
        if (tenantId === 'global') {
          cfg = getGlobalConfig();
        } else {
          const tenant = await Tenant.findById(tenantId);
          if (!tenant || !tenant.configuracionHacienda?.estaConfigurado?.()) {
            console.warn(`[hacienda worker] Tenant ${tenantId} sin config Hacienda, saltando`);
            continue;
          }
          cfg = getTenantConfig(tenant);
        }

        // Obtener token para este tenant
        const token = await getToken({
          ambiente: cfg.ambiente,
          usuario: cfg.usuario,
          password: cfg.password,
        }).catch((e) => {
          console.error(`[hacienda worker] error obtencion token tenant ${tenantId}:`, e.message);
          return null;
        });
        if (!token && cfg.ambiente !== 'local') continue;

        // Enviar facturas de este tenant
        for (const factura of facturas.slice(0, MAX_DOC_POR_TICK)) {
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
              console.log(`[hacienda worker] enviado ${factura.claveNumerica} (tenant: ${tenantId}) -> Location: ${resp.location}`);
            } else if (resp.retry) {
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
      } catch (err) {
        console.error(`[hacienda worker] error procesando tenant ${tenantId}:`, err.message);
      }
    }
  } finally {
    _running = false;
  }
}

/**
 * Hace polling para los comprobantes en estado "procesando" agrupados por tenant.
 */
async function consultarProcesando() {
  const enProceso = await FacturaEmision
    .find({ estado: 'procesando' })
    .populate('tenantId')
    .sort({ fechaEnvioHacienda: 1 })
    .limit(MAX_DOC_POR_TICK * MAX_TENANTS_POR_TICK);

  // Agrupar por tenantId
  const porTenant = {};
  for (const factura of enProceso) {
    const tid = factura.tenantId?._id?.toString() || 'global';
    if (!porTenant[tid]) porTenant[tid] = [];
    porTenant[tid].push(factura);
  }

  // Procesar cada tenant
  for (const [tenantId, facturas] of Object.entries(porTenant)) {
    try {
      let cfg;
      if (tenantId === 'global') {
        cfg = getGlobalConfig();
      } else {
        const tenant = await Tenant.findById(tenantId);
        if (!tenant || !tenant.configuracionHacienda?.estaConfigurado?.()) continue;
        cfg = getTenantConfig(tenant);
      }

      for (const factura of facturas.slice(0, MAX_DOC_POR_TICK)) {
        try {
          const resultado = await pollingHastaTerminal({
            ambiente: cfg.ambiente,
            clave: factura.claveNumerica,
            location: factura.respuestaHacienda?.location,
            intentos: 1, // un solo intento por tick
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
            console.log(`[hacienda worker] ${factura.claveNumerica} (tenant: ${tenantId}) -> ${factura.estado}`);
          }
        } catch (err) {
          console.error(`[hacienda worker] error consulta ${factura.claveNumerica}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[hacienda worker] error polling tenant ${tenantId}:`, err.message);
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
  console.log(`[hacienda worker] iniciado (intervalo ${intervaloMs}ms, modo multi-tenant)`);
  _timer = setInterval(async () => {
    try { await tick(); } catch (e) { console.error('[hacienda worker] tick error:', e.message); }
  }, intervaloMs);
  // tick inicial
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
  getTenantConfig,
  getGlobalConfig,
  limpiarCacheLlave,
};