const Tenant = require('../models/Tenant');
const FacturaEmision = require('../models/FacturaEmision');
const haciendaWorker = require('../services/haciendaWorker');
const { validarCertificado } = require('../services/hacienda').signer;
const { getToken, limpiarCacheTokens } = require('../services/hacienda').auth;
const { isConfigured } = require('../utils/crypto');
const SELECT_CREDS = '+configuracionHacienda.certificadoP12Base64 +configuracionHacienda.pinCertificado +configuracionHacienda.usuarioHacienda +configuracionHacienda.passwordHacienda';

async function cargarTenant(req) {
  if (!req.tenant?._id) throw new Error('Se requiere una finca identificada');
  const tenant = await Tenant.findById(req.tenant._id).select(SELECT_CREDS);
  if (!tenant) throw new Error('Finca no encontrada');
  return tenant;
}
function errorValidacion(mensaje) { const e = new Error(mensaje); e.status = 400; return e; }
async function validarCambioAmbiente(tenant, ambiente) {
  if ((tenant.configuracionHacienda?.ambiente || 'local') === ambiente) return;
  const pendientes = await FacturaEmision.exists({ tenantId: tenant._id, estado: { $in: ['firmada', 'enviada_hacienda', 'procesando'] } });
  if (pendientes) throw errorValidacion('Hay comprobantes pendientes en el ambiente actual; resuélvalos antes de cambiarlo');
}
const obtenerConfig = async (req, res, next) => {
  try {
    const tenant = await cargarTenant(req);
    const hc = tenant.configuracionHacienda || {};
    res.json({ configurado: hc.estaConfigurado?.() || hc.ambiente === 'local', ambiente: hc.ambiente || 'local',
      sucursal: hc.sucursal, terminal: hc.terminal, codigoActividad: hc.codigoActividad,
      proveedorSistemas: hc.proveedorSistemas || '', configuradoEn: hc.configuradoEn || null, ultimoError: hc.ultimoError || null });
  } catch (e) { next(e); }
};
const guardarConfig = async (req, res, next) => {
  try {
    const tenant = await cargarTenant(req);
    const { ambiente, certificadoP12Base64, pinCertificado, usuarioHacienda, passwordHacienda,
      sucursal = '001', terminal = '00001', codigoActividad, proveedorSistemas } = req.body;
    if (!['local', 'sandbox', 'produccion'].includes(ambiente)) throw errorValidacion('Ambiente inválido');
    if (!/^\d{3}$/.test(sucursal) || Number(sucursal) < 1 || !/^\d{5}$/.test(terminal) || Number(terminal) < 1) throw errorValidacion('Sucursal y terminal requieren 3 y 5 dígitos positivos');
    if (!/^\d{6}$/.test(codigoActividad || '') || codigoActividad === '000000') throw errorValidacion('Indique el código de actividad económica de seis dígitos');
    if (!/^[A-Za-z0-9]{9,20}$/.test(proveedorSistemas || '')) throw errorValidacion('Indique la identificación del proveedor del sistema');
    await validarCambioAmbiente(tenant, ambiente);
    // Never allow the development plaintext fallback when storing fiscal secrets.
    if ((certificadoP12Base64 || pinCertificado || passwordHacienda || ambiente !== 'local') && !isConfigured()) {
      throw errorValidacion('Configure EMAIL_ENC_KEY o MASTER_KEK_CURRENT de 64 caracteres hexadecimales para cifrar las credenciales');
    }
    tenant.configuracionHacienda ||= {};
    const hc = tenant.configuracionHacienda;
    // Read old credentials only when necessary. A complete replacement also repairs old AAD records.
    const p12 = certificadoP12Base64 || (ambiente !== 'local' ? hc.obtenerCertificadoP12?.() : '');
    const pin = pinCertificado || (ambiente !== 'local' ? hc.obtenerPinCertificado?.() : '');
    const usuario = usuarioHacienda || hc.usuarioHacienda;
    const password = passwordHacienda || (ambiente !== 'local' ? hc.obtenerPasswordHacienda?.() : '');
    if (ambiente !== 'local') {
      if (!p12 || !pin || !password || typeof usuario !== 'string' || !usuario.startsWith('cpf-')) throw errorValidacion('Complete certificado, PIN, usuario cpf- y contraseña propios de esta finca');
      try { await validarCertificado({ p12Base64: p12, pin, cacheKey: String(tenant._id) }); }
      catch { throw errorValidacion('No se pudo abrir un certificado vigente con ese PIN'); }
    } else if (certificadoP12Base64 || pinCertificado) {
      if (!p12 || !pin) throw errorValidacion('Indique certificado y PIN juntos');
      await validarCertificado({ p12Base64: p12, pin, cacheKey: String(tenant._id) });
    }
    Object.assign(hc, { ambiente, sucursal, terminal, codigoActividad, proveedorSistemas, configuradoEn: new Date(), ultimoError: null });
    if (certificadoP12Base64) hc.establecerCertificadoP12(certificadoP12Base64.replace(/^data:[^,]*;base64,/i, '').replace(/\s/g, ''));
    if (pinCertificado) hc.establecerPinCertificado(pinCertificado);
    if (usuarioHacienda) hc.usuarioHacienda = usuarioHacienda;
    if (passwordHacienda) hc.establecerPasswordHacienda(passwordHacienda);
    await tenant.save();
    limpiarCacheTokens(String(tenant._id));
    haciendaWorker.limpiarCacheLlave(String(tenant._id));
    res.json({ mensaje: 'Configuración Hacienda guardada', configurado: ambiente === 'local' || hc.estaConfigurado() });
  } catch (e) { next(e); }
};
const probarConexion = async (req, res, next) => {
  try {
    const tenant = await cargarTenant(req);
    const cfg = haciendaWorker.getTenantConfig(tenant);
    if (cfg.ambiente === 'local') return res.json({ success: true, mensaje: 'Modo local de simulación; no verifica acceso a Hacienda', simulacion: true, enviado: false });
    let certificado;
    try {
      certificado = await validarCertificado({ p12Base64: cfg.p12Base64, pin: cfg.pin, cacheKey: cfg.tenantId });
      await getToken({ ambiente: cfg.ambiente, usuario: cfg.usuario, password: cfg.password, tenantId: cfg.tenantId });
    } catch {
      tenant.configuracionHacienda.ultimoError = 'No se pudo validar certificado o autenticación. Revise PIN y credenciales del ambiente seleccionado.';
      await tenant.save();
      const error = new Error(tenant.configuracionHacienda.ultimoError); error.status = 422; throw error;
    }
    tenant.configuracionHacienda.ultimoError = null;
    await tenant.save();
    res.json({ success: true, mensaje: 'Certificado y autenticación válidos. La aceptación de comprobantes requiere una prueba separada.', certificado, enviado: false });
  } catch (e) { next(e); }
};
const eliminarConfig = async (req, res, next) => {
  try {
    const tenant = await cargarTenant(req);
    // Keep counters: deleting credentials must never reset the fiscal sequence.
    const pendientes = await FacturaEmision.exists({ tenantId: tenant._id, estado: { $in: ['firmada', 'enviada_hacienda', 'procesando'] } });
    if (pendientes) throw errorValidacion('Resuelva los comprobantes pendientes antes de eliminar la configuración');
    const hc = tenant.configuracionHacienda;
    if (hc) {
      for (const field of ['certificadoP12Base64', 'pinCertificado', 'usuarioHacienda', 'passwordHacienda', 'configuradoEn', 'ultimoError']) hc[field] = undefined;
      hc.ambiente = 'local';
    }
    await tenant.save();
    limpiarCacheTokens(String(tenant._id));
    haciendaWorker.limpiarCacheLlave(String(tenant._id));
    res.json({ mensaje: 'Credenciales Hacienda eliminadas; consecutivos conservados' });
  } catch (e) { next(e); }
};
module.exports = { obtenerConfig, guardarConfig, probarConexion, eliminarConfig };
