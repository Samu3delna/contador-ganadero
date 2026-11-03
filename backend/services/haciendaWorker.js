/** MongoDB owns the outbox. Uncertain submissions are reconciled by GET, never replayed. */
const crypto = require('crypto');
const FacturaEmision = require('../models/FacturaEmision');
const Tenant = require('../models/Tenant');
const hacienda = require('./hacienda');
const { runWithTenantContext } = require('../utils/tenantContext');

const MOTOR_HACIENDA = 'sdk-0.12.1';
const SELECT_HACIENDA_CREDS = '+configuracionHacienda.certificadoP12Base64 +configuracionHacienda.pinCertificado +configuracionHacienda.usuarioHacienda +configuracionHacienda.passwordHacienda';
const LIMITE = 15;
let _running = false;
let _polling = false;
let _timer = null;

function getTenantConfig(tenant, { conSecretos = true } = {}) {
  if (!tenant?._id) throw new Error('La facturación requiere una finca identificada');
  const hc = tenant.configuracionHacienda || {};
  const ambiente = hc.ambiente || 'local';
  if (!['local', 'sandbox', 'produccion'].includes(ambiente)) throw new Error('Ambiente Hacienda inválido');
  return {
    ambiente,
    p12Base64: conSecretos && ambiente !== 'local' ? hc.obtenerCertificadoP12?.() || '' : '',
    pin: conSecretos && ambiente !== 'local' ? hc.obtenerPinCertificado?.() || '' : '',
    usuario: hc.usuarioHacienda || '',
    password: conSecretos && ambiente !== 'local' ? hc.obtenerPasswordHacienda?.() || '' : '',
    sucursal: hc.sucursal || '001', terminal: hc.terminal || '00001',
    codigoActividad: hc.codigoActividad || '', proveedorSistemas: hc.proveedorSistemas || '',
    tenantId: String(tenant._id),
  };
}

// Display-only compatibility. No global identity may be used to sign for a tenant.
function getGlobalConfig() {
  return { ambiente: 'local', sucursal: '001', terminal: '00001', codigoActividad: '', tenantId: null };
}

function validarConfigDocumento(tenant, factura) {
  const cfg = getTenantConfig(tenant);
  if (cfg.ambiente !== factura.ambiente) {
    throw new Error('Restaure el ambiente original del comprobante para continuar');
  }
  if (cfg.ambiente !== 'local' && (!cfg.p12Base64 || !cfg.pin || !cfg.usuario || !cfg.password)) {
    throw new Error('Configure el certificado, PIN y credenciales Hacienda de esta finca');
  }
  return cfg;
}

async function prepararYFirmar(facturaId) {
  const factura = await FacturaEmision.findById(facturaId).populate({ path: 'tenantId', select: SELECT_HACIENDA_CREDS });
  if (!factura) throw new Error('Factura no encontrada');
  if (factura.estado !== 'borrador') return factura;
  const cfg = validarConfigDocumento(factura.tenantId, factura);
  if (factura.tipoDocumento === 'REP' && cfg.ambiente !== 'local') throw new Error('REP pendiente de validaci?n fiscal de pagos; solo simulaci?n disponible');
  if (factura.tipoDocumento === 'REP') await require('./repReservations').verificar(factura);
  factura.codigoActividadEmisor ||= cfg.codigoActividad;
  factura.proveedorSistemas ||= cfg.proveedorSistemas;
  if (!/^\d{20}$/.test(factura.consecutivo || '')) throw new Error('Consecutivo inválido: cree un nuevo borrador');
  if (factura.consecutivo.slice(8, 10) !== hacienda.clave50.TIPO_DOC_CODIGO[factura.tipoDocumento]) {
    throw new Error('Consecutivo anterior incompatible con v4.4: cree un nuevo borrador');
  }
  if (!factura.claveNumerica) {
    const titular = factura.tipoDocumento === 'FEC' ? factura.receptor : factura.emisor;
    const { clave } = await hacienda.clave50.generarClave({
      fecha: factura.fechaEmision, tipoDocumento: factura.tipoDocumento,
      cedulaEmisor: titular?.cedula?.numero, tipoCedula: titular?.cedula?.tipo,
      sucursal: factura.consecutivo.slice(0, 3), terminal: factura.consecutivo.slice(3, 8),
      secuencia: Number(factura.consecutivo.slice(-10)),
    });
    factura.claveNumerica = clave;
  }
  const xml = await hacienda.xmlBuilder.buildXml(factura.toObject());
  const xmlFirmado = await hacienda.signer.firmarDocumento(xml, {
    p12Base64: cfg.p12Base64, pin: cfg.pin, cacheKey: cfg.tenantId, ambiente: cfg.ambiente,
  });
  const firmada = await FacturaEmision.findOneAndUpdate(
    { _id: factura._id, tenantId: factura.tenantId._id, estado: 'borrador' },
    { $set: {
      claveNumerica: factura.claveNumerica, codigoActividadEmisor: factura.codigoActividadEmisor,
      proveedorSistemas: factura.proveedorSistemas, xmlFirmado, estado: 'firmada', motorHacienda: MOTOR_HACIENDA,
      hashFirma: crypto.createHash('sha256').update(xmlFirmado).digest('hex'), erroresValidacion: [],
    } }, { new: true, runValidators: true },
  );
  return firmada || FacturaEmision.findById(factura._id);
}

function credenciales(cfg) {
  return { usuario: cfg.usuario, password: cfg.password, tenantId: cfg.tenantId };
}

async function registrarError(factura, detalle) {
  await FacturaEmision.updateOne(
    { _id: factura._id, tenantId: factura.tenantId, estado: { $nin: ['aceptada', 'rechazada'] } },
    { $set: { erroresValidacion: [detalle] } },
  );
}

async function enviarPendientes() {
  if (_running) return;
  _running = true;
  try {
    const pendientes = await FacturaEmision.find({ estado: 'firmada' }, null, { skipTenant: true })
      .select('+xmlFirmado').sort({ updatedAt: 1 }).limit(LIMITE);
    for (const factura of pendientes) {
      if (!factura.tenantId) continue;
      await runWithTenantContext({ tenantId: String(factura.tenantId) }, async () => {
        try {
          const tenant = await Tenant.findById(factura.tenantId).select(SELECT_HACIENDA_CREDS);
          const cfg = validarConfigDocumento(tenant, factura);
          if (factura.motorHacienda !== MOTOR_HACIENDA) {
            await registrarError(factura, 'Firma del motor anterior: consulte esta clave en Hacienda y revise el documento antes de decidir su sustitución; envío automático bloqueado');
            return;
          }
          if (!factura.xmlFirmado) throw new Error('XML faltante');
          const token = await hacienda.auth.getToken({ ambiente: cfg.ambiente, ...credenciales(cfg) });
          // Durable compare-and-set covers both the API process and the background worker.
          const claim = await FacturaEmision.findOneAndUpdate(
            { _id: factura._id, tenantId: factura.tenantId, estado: 'firmada', motorHacienda: MOTOR_HACIENDA },
            { $set: { estado: 'enviada_hacienda', envioIntentadoEn: new Date(), erroresValidacion: [] } },
            { new: true },
          );
          if (!claim) return;
          const resp = await hacienda.recepcion.enviarComprobante({
            ambiente: cfg.ambiente, token, credenciales: credenciales(cfg),
            documento: {
              clave: factura.claveNumerica, fecha: factura.fechaEmision.toISOString(),
              emisorTipoId: (factura.tipoDocumento === 'FEC' ? factura.receptor : factura.emisor).cedula.tipo,
              emisorNumeroId: (factura.tipoDocumento === 'FEC' ? factura.receptor : factura.emisor).cedula.numero,
              receptorTipoId: factura.receptor?.cedula?.tipo, receptorNumeroId: factura.receptor?.cedula?.numero,
              xmlFirmado: factura.xmlFirmado,
            },
          });
          if (resp.httpStatus === 201) {
            await FacturaEmision.updateOne(
              { _id: factura._id, tenantId: factura.tenantId, estado: 'enviada_hacienda' },
              { $set: { estado: 'procesando', fechaEnvioHacienda: new Date(), erroresValidacion: [],
                respuestaHacienda: { clave: factura.claveNumerica, estado: 'procesando', detalle: 'Recibido por Hacienda; pendiente de validación', fecha: new Date(), location: resp.location } } },
            );
          } else {
            await registrarError(factura, `Envío sin confirmación (HTTP ${resp.httpStatus || 'sin respuesta'}). Se consultará la misma clave; no se reenviará automáticamente.`);
          }
        } catch {
          await registrarError(factura, 'No se pudo completar el envío. Revise la configuración de la finca y consulte el estado antes de reintentar.').catch(() => {});
        }
      });
    }
  } finally { _running = false; }
}

async function consultarProcesando() {
  if (_polling) return;
  _polling = true;
  try {
    const pendientes = await FacturaEmision.find({ estado: { $in: ['procesando', 'enviada_hacienda'] } }, null, { skipTenant: true })
      .sort({ updatedAt: 1 }).limit(LIMITE);
    for (const factura of pendientes) {
      if (!factura.tenantId) continue;
      await runWithTenantContext({ tenantId: String(factura.tenantId) }, async () => {
        try {
          const tenant = await Tenant.findById(factura.tenantId).select(SELECT_HACIENDA_CREDS);
          const cfg = validarConfigDocumento(tenant, factura);
          const resultado = await hacienda.recepcion.consultarEstado({
            ambiente: cfg.ambiente, clave: factura.claveNumerica, credenciales: credenciales(cfg),
          });
          if (['aceptado', 'rechazado'].includes(resultado.estado)) {
            await FacturaEmision.updateOne(
              { _id: factura._id, tenantId: factura.tenantId, estado: { $in: ['procesando', 'enviada_hacienda'] } },
              { $set: {
                estado: resultado.estado === 'aceptado' ? 'aceptada' : 'rechazada',
                fechaRespuestaHacienda: new Date(), xmlRespuestaHacienda: resultado.xmlRespuesta || '', erroresValidacion: [],
                respuestaHacienda: { clave: factura.claveNumerica, estado: resultado.estado, detalle: resultado.detalle || '', fecha: new Date(), location: factura.respuestaHacienda?.location },
              } },
            );
          } else {
            await registrarError(factura, resultado.noEncontrado
              ? 'Hacienda aún no reconoce la clave. Revise el envío; no se reenviará automáticamente.'
              : 'Hacienda aún no ha confirmado un estado terminal; se volverá a consultar.');
          }
        } catch {
          await registrarError(factura, 'Consulta pendiente: revise las credenciales y el ambiente original del comprobante.').catch(() => {});
        }
      });
    }
  } finally { _polling = false; }
}

async function tick() { await enviarPendientes(); await consultarProcesando(); }
function iniciar(intervaloMs = 15000) {
  if (_timer) return;
  _timer = setInterval(() => { tick().catch(() => {}); }, intervaloMs);
  tick().catch(() => {});
}
function detener() { clearInterval(_timer); _timer = null; }
module.exports = {
  prepararYFirmar, enviarPendientes, consultarProcesando, tick, iniciar, detener,
  getTenantConfig, getGlobalConfig, validarConfigDocumento, MOTOR_HACIENDA,
  limpiarCacheLlave: hacienda.signer.limpiarCacheLlave,
};
