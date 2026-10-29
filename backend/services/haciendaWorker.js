/**
 * Worker asíncrono de envío de comprobantes a Hacienda (Multi-tenant).
 *
 *  Loop:
 *   1. Busca comprobantes en estado "firmada" pendientes de envío ({ skipTenant: true })
 *   2. Agrupa por tenantId y ejecuta cada lote dentro de runWithTenantContext({ tenantId })
 *   3. Para cada tenant: obtiene config, token aislado por tenant, envía comprobantes
 *   4. Loop de polling: actualiza a "aceptado" / "rechazado"
 */

const crypto = require('crypto');
const FacturaEmision = require('../models/FacturaEmision');
const Tenant = require('../models/Tenant');
const hacienda = require('./hacienda');
const { runWithTenantContext } = require('../utils/tenantContext');
const { generarClave } = hacienda.clave50;
const { buildXml } = hacienda.xmlBuilder;
const { firmarDocumento, limpiarCacheLlave } = hacienda.signer;
const { enviarComprobante, pollingHastaTerminal } = hacienda.recepcion;
const { getToken } = hacienda.auth;

const INTERVALO_TICK_MS = 15000;
const MAX_DOC_POR_TICK = 5;
const MAX_TENANTS_POR_TICK = 3;
const SELECT_HACIENDA_CREDS = '+configuracionHacienda.certificadoP12Base64 +configuracionHacienda.pinCertificado +configuracionHacienda.usuarioHacienda +configuracionHacienda.passwordHacienda';

let _running = false;
let _timer = null;

/**
 * Obtiene configuración de Hacienda para un tenant específico.
 */
function getTenantConfig(tenant) {
  const hc = tenant.configuracionHacienda || {};
  return {
    ambiente: hc.ambiente || 'local',
    p12Base64: tenant.obtenerCertificadoP12Base64 ? tenant.obtenerCertificadoP12Base64() : (hc.certificadoP12Base64 || ''),
    pin: tenant.obtenerPinCertificado ? tenant.obtenerPinCertificado() : null,
    usuario: hc.usuarioHacienda || '',
    password: tenant.obtenerPasswordHacienda ? tenant.obtenerPasswordHacienda() : null,
    sucursal: hc.sucursal || '001',
    terminal: hc.terminal || '00001',
    codigoActividad: hc.codigoActividad || '000000',
    tenantId: tenant._id.toString(),
  };
}

/**
 * Obtiene configuración global (legacy) desde variables de entorno.
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
 *  - Guarda como "firmada"
 */
async function prepararYFirmar(facturaId) {
  const factura = await FacturaEmision.findById(facturaId).populate({
    path: 'tenantId',
    select: SELECT_HACIENDA_CREDS,
  });
  if (!factura) throw new Error('Factura no encontrada');
  if (factura.estado !== 'borrador') {
    return factura;
  }

  let cfg;
  if (factura.tenantId && factura.tenantId.configuracionHacienda?.estaConfigurado?.()) {
    cfg = getTenantConfig(factura.tenantId);
  } else {
    cfg = getGlobalConfig();
  }

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
    if (!factura.consecutivo || factura.consecutivo.length !== 20) {
      factura.consecutivo = consGen;
    }
    factura.ambiente = cfg.ambiente;
  }

  const xml = buildXml(factura.toObject ? factura.toObject() : factura);

  let xmlFirmado;
  if (cfg.p12Base64 && cfg.pin) {
    xmlFirmado = firmarDocumento(xml, {
      p12Base64: cfg.p12Base64,
      pin: cfg.pin,
      cacheKey: cfg.tenantId,
      ambiente: cfg.ambiente,
    });
  } else if ((cfg.p12Path && cfg.pin) || cfg.ambiente === 'local') {
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
  factura.hashFirma = crypto.createHash('sha256').update(xmlFirmado).digest('hex').slice(0, 32);
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
    const pendientes = await FacturaEmision
      .find({ estado: 'firmada' }, null, { skipTenant: true })
      .select('+xmlFirmado')
      .populate('tenantId')
      .sort({ createdAt: 1 })
      .limit(MAX_DOC_POR_TICK * MAX_TENANTS_POR_TICK);

    if (pendientes.length === 0) return;

    const porTenant = {};
    for (const factura of pendientes) {
      const tid = factura.tenantId?._id?.toString() || 'global';
      if (!porTenant[tid]) porTenant[tid] = [];
      porTenant[tid].push(factura);
    }

    for (const [tenantId, facturas] of Object.entries(porTenant)) {
      await runWithTenantContext({ tenantId: tenantId === 'global' ? null : tenantId }, async () => {
        try {
          let cfg;
          if (tenantId === 'global') {
            cfg = getGlobalConfig();
          } else {
            const tenant = await Tenant.findById(tenantId).select(SELECT_HACIENDA_CREDS);
            if (!tenant || !tenant.configuracionHacienda?.estaConfigurado?.()) {
              cfg = getGlobalConfig();
              if (cfg.ambiente !== 'local') {
                return;
              }
            } else {
              cfg = getTenantConfig(tenant);
            }
          }

          const token = await getToken({
            ambiente: cfg.ambiente,
            usuario: cfg.usuario,
            password: cfg.password,
            tenantId: cfg.tenantId,
          }).catch(() => null);
          if (!token && cfg.ambiente !== 'local') return;

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
                credenciales: { usuario: cfg.usuario, password: cfg.password, tenantId: cfg.tenantId },
              });

              factura.$locals = factura.$locals || {};
              factura.$locals.skipTenant = true;

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
              } else if (!resp.retry) {
                factura.estado = 'rechazada';
                factura.fechaRespuestaHacienda = new Date();
                factura.respuestaHacienda = {
                  clave: factura.claveNumerica,
                  estado: 'rechazado',
                  detalle: JSON.stringify(resp.error || 'Error definitivo'),
                  fecha: new Date(),
                };
                await factura.save();
              }
            } catch {
              // Continúa con el siguiente comprobante
            }
          }
        } catch {
          // Continúa con el siguiente tenant
        }
      });
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
    .find({ estado: 'procesando' }, null, { skipTenant: true })
    .populate('tenantId')
    .sort({ fechaEnvioHacienda: 1 })
    .limit(MAX_DOC_POR_TICK * MAX_TENANTS_POR_TICK);

  const porTenant = {};
  for (const factura of enProceso) {
    const tid = factura.tenantId?._id?.toString() || 'global';
    if (!porTenant[tid]) porTenant[tid] = [];
    porTenant[tid].push(factura);
  }

  for (const [tenantId, facturas] of Object.entries(porTenant)) {
    await runWithTenantContext({ tenantId: tenantId === 'global' ? null : tenantId }, async () => {
      try {
        let cfg;
        if (tenantId === 'global') {
          cfg = getGlobalConfig();
        } else {
          const tenant = await Tenant.findById(tenantId).select(SELECT_HACIENDA_CREDS);
          if (!tenant || !tenant.configuracionHacienda?.estaConfigurado?.()) {
            cfg = getGlobalConfig();
            if (cfg.ambiente !== 'local') return;
          } else {
            cfg = getTenantConfig(tenant);
          }
        }

        for (const factura of facturas.slice(0, MAX_DOC_POR_TICK)) {
          try {
            const resultado = await pollingHastaTerminal({
              ambiente: cfg.ambiente,
              clave: factura.claveNumerica,
              location: factura.respuestaHacienda?.location,
              intentos: 1,
              intervalo: 100,
              credenciales: { usuario: cfg.usuario, password: cfg.password, tenantId: cfg.tenantId },
            });
            if (resultado.estado === 'aceptado' || resultado.estado === 'rechazado') {
              factura.$locals = factura.$locals || {};
              factura.$locals.skipTenant = true;
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
            }
          } catch {
            // Continúa con el siguiente comprobante
          }
        }
      } catch {
        // Continúa con el siguiente tenant
      }
    });
  }
}

async function tick() {
  await enviarPendientes();
  await consultarProcesando();
}

function iniciar(intervaloMs = INTERVALO_TICK_MS) {
  if (_timer) return;
  _timer = setInterval(async () => {
    try { await tick(); } catch { /* ignore */ }
  }, intervaloMs);
  tick().catch(() => {});
}

function detener() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
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
