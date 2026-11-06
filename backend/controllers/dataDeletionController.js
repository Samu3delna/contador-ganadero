const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');
const FacturaEmision = require('../models/FacturaEmision');
const Ingreso = require('../models/Ingreso');
const Inventario = require('../models/Inventario');
const CostoProduccion = require('../models/CostoProduccion');
const Declaracion = require('../models/Declaracion');
const ChatFeedback = require('../models/ChatFeedback');
const RefreshToken = require('../models/RefreshToken');
const SolicitudEliminacion = require('../models/SolicitudEliminacion');
const { escapeRegex } = require('../utils/escapeRegex');
const { audit } = require('../utils/audit');

const JUSTIFICACION_LEGAL_CR =
  'De conformidad con la Ley N° 8968 (Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales de la República de Costa Rica) y las Condiciones de la Plataforma de Meta, todos los datos personales, credenciales de acceso, vínculo con el bot de WhatsApp, historial de asistente IA, registros de inventario y configuraciones de su finca han sido eliminados de nuestros servidores activos. Justificación legal sobre registros tributarios: en caso de que el usuario haya emitido o recibido comprobantes electrónicos oficiales ante la Dirección General de Tributación (Ministerio de Hacienda de Costa Rica), el obligado tributario debe conservar sus respaldos XML por el plazo de ley (5 años según el Art. 109 del Código de Normas y Procedimientos Tributarios, Ley N° 4755), sin que ContadorGanadero mantenga copia activa ni tratamiento comercial sobre dichos documentos tras la eliminación de la cuenta.';

function base64UrlDecode(input) {
  const str = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  const padded = pad ? str + '='.repeat(4 - pad) : str;
  return Buffer.from(padded, 'base64');
}

function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string' || !signedRequest.includes('.')) {
    return null;
  }

  const parts = signedRequest.split('.', 2);
  const [encodedSig, payload] = parts;
  if (!encodedSig || !payload) {
    return null;
  }

  try {
    const sig = base64UrlDecode(encodedSig);
    const decodedPayloadStr = base64UrlDecode(payload).toString('utf8');
    const data = JSON.parse(decodedPayloadStr);

    if (!data || typeof data !== 'object') {
      return null;
    }

    if (appSecret) {
      const expectedSig = crypto.createHmac('sha256', appSecret).update(payload).digest();
      if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
        return null;
      }
    }

    return data;
  } catch {
    return null;
  }
}

function generarCodigoConfirmacion() {
  const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase().slice(-4);
  return `CG${timePart}${randomPart}`;
}

function obtenerBaseUrlPublica() {
  const url = (
    process.env.PUBLIC_SITE_URL ||
    process.env.DOMAIN_URL ||
    'https://contadorganadero.com'
  ).trim();
  return url.replace(/\/+$/, '');
}

function generarVariantesTelefono(telefono) {
  if (!telefono) return [];
  const digits = String(telefono).replace(/\D/g, '');
  if (!digits) return [];
  const variantes = new Set([digits, `+${digits}`]);
  if (digits.length === 8) {
    variantes.add(`506${digits}`);
    variantes.add(`+506${digits}`);
  } else if (digits.startsWith('506') && digits.length === 11) {
    const local = digits.slice(3);
    variantes.add(local);
    variantes.add(`+${digits}`);
  }
  return Array.from(variantes);
}

function enmascararIdentificador(valor) {
  if (!valor) return null;
  const str = String(valor).trim();
  if (str.includes('@')) {
    const [user, domain] = str.split('@');
    if (user.length <= 2) return `${user[0] || '*'}***@${domain}`;
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (str.length > 4) {
    return `***${str.slice(-4)}`;
  }
  return '***';
}

/**
 * Ejecuta la eliminación verificada de los datos del usuario y su finca (si es único miembro).
 */
async function ejecutarEliminacionDatos({
  metaUserId = null,
  email = null,
  telefono = null,
  usuarioId = null,
  origen = 'meta_callback',
  ip = '',
  codigoConfirmacion: codigoPrevio = null,
}) {
  const codigoConfirmacion = codigoPrevio || generarCodigoConfirmacion();
  const baseUrl = obtenerBaseUrlPublica();
  const statusUrl = `${baseUrl}/eliminacion-datos?id=${codigoConfirmacion}`;

  let usuario = null;
  let usuarioEncontrado = false;
  let datosEliminados = [];
  let tenantIdEliminado = null;
  let solicitud = codigoPrevio ? await SolicitudEliminacion.findOne({ codigoConfirmacion }) : null;
  if (codigoPrevio && !solicitud) throw new Error('Solicitud inexistente');
  if (solicitud?.estado === 'completada') return { url: statusUrl, confirmation_code: codigoConfirmacion, solicitud };
  if (!solicitud) solicitud = await SolicitudEliminacion.create({ codigoConfirmacion, origen, metaUserId,
    usuarioId: usuarioId || undefined, email: enmascararIdentificador(email), telefono: enmascararIdentificador(telefono),
    estado: 'en_proceso', explicacionEstado: 'Solicitud registrada; eliminación pendiente de completar.', ipSolicitante: ip });

  try {
    if (usuarioId) {
      usuario = await Usuario.findById(usuarioId);
    }
    if (!usuario && metaUserId) {
      const variantesTel = generarVariantesTelefono(metaUserId);
      const orConditions = [{ facebookId: String(metaUserId) }];
      if (variantesTel.length > 0) {
        orConditions.push({ telefono: { $in: variantesTel } });
      }
      usuario = await Usuario.findOne({ $or: orConditions });
    }
    if (!usuario && email) {
      usuario = await Usuario.findOne({ email: String(email).toLowerCase().trim() });
    }
    if (!usuario && telefono) {
      const variantesTel = generarVariantesTelefono(telefono);
      if (variantesTel.length > 0) {
        usuario = await Usuario.findOne({ telefono: { $in: variantesTel } });
      }
    }

    if (usuario) {
      usuarioEncontrado = true;
      tenantIdEliminado = usuario.tenantId;
      await SolicitudEliminacion.updateOne({ _id: solicitud._id }, { $set: { estado: 'en_proceso', usuarioId: usuario._id, tenantId: usuario.tenantId } });

      datosEliminados.push(
        'Perfil de usuario y credenciales de acceso',
        'Número de teléfono vinculado al bot de WhatsApp',
        'Historial de consultas al asistente de IA'
      );

      await RefreshToken.revocarTodosDeUsuario(usuario._id, 'account_deleted');
      await Promise.all([
        require('../models/AccountNotification').deleteMany({ usuarioId: usuario._id }),
        require('../models/MfaChallenge').deleteMany({ usuarioId: usuario._id }),
      ]);
      await ChatFeedback.deleteMany({ usuario: usuario._id }, { skipTenant: true });

      if (usuario.tenantId) {
        const tenant = await Tenant.findById(usuario.tenantId);
        if (tenant) {
          const otrosMiembros = (tenant.usuarios || []).filter(
            (m) => m.usuarioId && !m.usuarioId.equals(usuario._id)
          );

          if (otrosMiembros.length === 0) {
            await require('../models/IngestionEvent').deleteMany({ $or: [{ tenantId: tenant._id },
              { usuarioId: usuario._id }, { 'payload.opciones.usuarioId': usuario._id },
              { 'resultado.usuario._id': usuario._id }, { 'resultado.factura.usuario': usuario._id },
              { 'payload.message.from': { $in: generarVariantesTelefono(usuario.telefono || '') } },
              { 'payload.emailDestino': usuario.email },
              { 'resultado.factura.tenantId': tenant._id },
              ...(tenant.emailAlias ? [{ 'payload.emailDestino': `${tenant.emailAlias}@contadorganadero.com` },
                { 'payload.opciones.emailDestino': `${tenant.emailAlias}@contadorganadero.com` }] : [])] });
            await Promise.all([
              Factura.deleteMany({ $or: [{ tenantId: tenant._id }, { usuario: usuario._id }] }, { skipTenant: true }),
              FacturaEmision.deleteMany({ $or: [{ tenantId: tenant._id }, { usuario: usuario._id }] }, { skipTenant: true }),
              Ingreso.deleteMany({ $or: [{ tenantId: tenant._id }, { usuario: usuario._id }] }, { skipTenant: true }),
              Inventario.deleteMany({ $or: [{ tenantId: tenant._id }, { usuario: usuario._id }] }, { skipTenant: true }),
              CostoProduccion.deleteMany({ $or: [{ tenantId: tenant._id }, { usuario: usuario._id }] }, { skipTenant: true }),
              Declaracion.deleteMany({ $or: [{ tenantId: tenant._id }, { usuario: usuario._id }] }, { skipTenant: true }),
              ChatFeedback.deleteMany({ tenantId: tenant._id }, { skipTenant: true }),
            ]);
            await tenant.deleteOne();

            datosEliminados.push(
              'Configuración de la finca y buzón @contadorganadero.com',
              'Certificados criptográficos (.p12) y credenciales de Hacienda cifradas',
              'Facturas recibidas, ingresos, inventario multiespecie y costos de producción',
              'Proyecciones y borradores de declaraciones tributarias (IVA / Renta / D-150)'
            );
          } else {
            tenant.usuarios = otrosMiembros;
            if (tenant.owner?.equals(usuario._id)) {
              const nuevoOwnerId = otrosMiembros[0].usuarioId;
              tenant.owner = nuevoOwnerId;
              otrosMiembros[0].rol = 'dueño';
              await Usuario.updateOne({ _id: nuevoOwnerId }, { rol: 'dueño' });
            }
            await tenant.save();
            datosEliminados.push('Membresía y permisos dentro de la finca asociada');
          }
        }
      } else {
        await Promise.all([
          Factura.deleteMany({ usuario: usuario._id }, { skipTenant: true }),
          FacturaEmision.deleteMany({ usuario: usuario._id }, { skipTenant: true }),
          Ingreso.deleteMany({ usuario: usuario._id }, { skipTenant: true }),
          Inventario.deleteMany({ usuario: usuario._id }, { skipTenant: true }),
          CostoProduccion.deleteMany({ usuario: usuario._id }, { skipTenant: true }),
          Declaracion.deleteMany({ usuario: usuario._id }, { skipTenant: true }),
        ]);
      }

      await usuario.deleteOne();
    } else {
      datosEliminados = [
        'Verificación completada: no se encontraron datos personales activos asociados al identificador suministrado o ya habían sido eliminados previamente.',
      ];
    }

    const explicacionEstado = usuarioEncontrado
      ? `Su solicitud de eliminación de datos (código ${codigoConfirmacion}) ha sido procesada y completada exitosamente. Se eliminaron de forma permanente su perfil de usuario, su vinculación con el bot de WhatsApp y los registros asociados en ContadorGanadero.`
      : `Su solicitud de eliminación de datos (código ${codigoConfirmacion}) ha sido registrada y completada. Confirmamos que no existen registros personales activos asociados a su identificador en nuestras bases de datos operativas.`;

    solicitud = await SolicitudEliminacion.findOneAndUpdate({ _id: solicitud._id }, { $set: {
      codigoConfirmacion,
      origen,
      metaUserId: metaUserId ? String(metaUserId) : undefined,
      email: enmascararIdentificador(usuario?.email || email),
      telefono: enmascararIdentificador(usuario?.telefono || telefono),
      usuarioId: usuario?._id,
      tenantId: tenantIdEliminado,
      estado: 'completada',
      usuarioEncontrado,
      datosEliminados,
      explicacionEstado,
      justificacionLegal: JUSTIFICACION_LEGAL_CR,
      ipSolicitante: ip,
      completadaEn: new Date(),
    }, $unset: { errorProcesamiento: 1 } }, { new: true, runValidators: true });

    return {
      url: statusUrl,
      confirmation_code: codigoConfirmacion,
      solicitud,
    };
  } catch (error) {
    await SolicitudEliminacion.updateOne({ _id: solicitud._id }, { $set: { estado: 'fallida',
      explicacionEstado: 'Eliminación no completada. Requiere reanudación; algunos pasos pueden haberse aplicado.',
      errorProcesamiento: 'Fallo operativo durante la eliminación' }, $unset: { completadaEn: 1 } }).catch(() => {});
    const fallo = new Error('Eliminación no completada'); fallo.status = 503; fallo.confirmation_code = codigoConfirmacion;
    throw fallo;
  }
}

async function reanudarEliminacion(codigo) {
  const solicitud = await SolicitudEliminacion.findOne({ codigoConfirmacion: codigo });
  if (!solicitud || solicitud.origen === 'web_formulario') throw new Error('Solicitud sin autorización de borrado');
  return ejecutarEliminacionDatos({ codigoConfirmacion: codigo, usuarioId: solicitud.usuarioId,
    metaUserId: solicitud.metaUserId, origen: solicitud.origen });
}

/**
 * POST /api/webhooks/whatsapp/data-deletion
 * POST /api/webhooks/meta-data-deletion
 */
const handleMetaDataDeletionCallback = async (req, res) => {
  try {
    const signedRequest = req.body?.signed_request || req.query?.signed_request;

    if (!signedRequest) {
      return res.status(400).json({
        error: 'El parámetro signed_request es requerido para procesar la devolución de llamada de Meta.',
      });
    }

    const appSecret = (
      process.env.META_APP_SECRET ||
      process.env.FACEBOOK_APP_SECRET ||
      process.env.WHATSAPP_APP_SECRET ||
      ''
    ).trim();

    const secretToVerify =
      appSecret && !appSecret.includes('tu_') && !appSecret.includes('ejemplo')
        ? appSecret
        : null;

    if (!secretToVerify && process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        error: 'Configuración de verificación de firma de Meta no disponible.',
      });
    }

    const data = parseSignedRequest(signedRequest, secretToVerify);
    if (!data || !data.user_id) {
      return res.status(400).json({
        error: 'Solicitud firmada (signed_request) inválida o firma HMAC-SHA256 no coincide.',
      });
    }

    const userId = String(data.user_id);

    const resultado = await ejecutarEliminacionDatos({
      metaUserId: userId,
      origen: 'meta_callback',
      ip: req.ip || '',
    });

    return res.status(200).json({
      url: resultado.url,
      confirmation_code: resultado.confirmation_code,
    });
  } catch {
    return res.status(500).json({
      error: 'Error interno al procesar la solicitud de eliminación de datos.',
    });
  }
};

const infoMetaDataDeletionWebhook = (req, res) => {
  const baseUrl = obtenerBaseUrlPublica();
  res.status(200).json({
    servicio: 'ContadorGanadero - Meta Data Deletion Callback Endpoint',
    estado: 'activo',
    metodoEsperado: 'POST (application/x-www-form-urlencoded o application/json con signed_request)',
    instruccionesUrl: `${baseUrl}/eliminacion-datos`,
    formatoRespuesta: {
      url: `${baseUrl}/eliminacion-datos?id=<confirmation_code>`,
      confirmation_code: '<confirmation_code>',
    },
  });
};

const obtenerEstadoEliminacion = async (req, res) => {
  const rawCode = String(req.params.code || '').trim();
  if (!rawCode) {
    return res.status(400).json({ error: 'Código de confirmación requerido.' });
  }

  try {
    const solicitud = await SolicitudEliminacion.findOne({
      codigoConfirmacion: new RegExp(`^${escapeRegex(rawCode, 40)}$`, 'i'),
    }).lean();

    if (solicitud) {
      return res.status(200).json({
        encontrada: true,
        confirmation_code: solicitud.codigoConfirmacion,
        estado: solicitud.estado,
        origen: solicitud.origen,
        fechaSolicitud: solicitud.createdAt,
        completadaEn: solicitud.completadaEn,
        identificadorEnmascarado: solicitud.email || solicitud.telefono || (solicitud.metaUserId ? `Meta ID ***${String(solicitud.metaUserId).slice(-4)}` : null),
        datosEliminados: solicitud.datosEliminados,
        explicacion: solicitud.explicacionEstado,
        justificacionLegal: solicitud.justificacionLegal || JUSTIFICACION_LEGAL_CR,
      });
    }
  } catch {
    return res.status(503).json({ error: 'No se pudo consultar el estado de la solicitud' });
  }

  return res.status(404).json({
    encontrada: false,
    error: 'No se encontró ninguna solicitud de eliminación con ese código de confirmación.',
  });
};

/**
 * POST /api/webhooks/whatsapp/data-deletion/solicitud
 * SEGURIDAD CRÍTICA: Una solicitud pública sin autenticar NUNCA debe ejecutar el borrado inmediato
 * de otra cuenta por solo conocer su email o teléfono (vulnerabilidad crítica de DoS).
 * En su lugar, registra la solicitud para verificación de identidad o indica al titular autenticado
 * que ejecute el borrado directo desde Mi Perfil -> Eliminar Cuenta.
 */
const crearSolicitudEliminacionPublica = async (req, res) => {
  try {
    const { email, telefono, confirmacion } = req.body || {};

    if (!email && !telefono) {
      return res.status(400).json({
        error: 'Debes proporcionar el correo electrónico o el número de WhatsApp asociado a tus datos.',
      });
    }

    if (confirmacion !== true) {
      return res.status(400).json({
        error: 'Debes confirmar que deseas eliminar permanentemente tus datos.',
      });
    }

    const codigoConfirmacion = generarCodigoConfirmacion();
    const baseUrl = obtenerBaseUrlPublica();
    const statusUrl = `${baseUrl}/eliminacion-datos?id=${codigoConfirmacion}`;

    const explicacionEstado =
      `Su solicitud pública de eliminación de datos (código ${codigoConfirmacion}) ha sido registrada. ` +
      'Por seguridad y para proteger a los productores contra borrados no autorizados por terceros, ' +
      'la eliminación inmediata requiere iniciar sesión en su cuenta (Mi Perfil -> Eliminar Cuenta) o verificar la titularidad del correo/WhatsApp.';

    const solicitud = await SolicitudEliminacion.create({
      codigoConfirmacion,
      origen: 'web_formulario',
      email: enmascararIdentificador(email),
      telefono: enmascararIdentificador(telefono),
      estado: 'en_proceso',
      usuarioEncontrado: false,
      datosEliminados: [
        'Solicitud registrada pendiente de verificación de titularidad para proteger la integridad de la cuenta.',
      ],
      explicacionEstado,
      justificacionLegal: JUSTIFICACION_LEGAL_CR,
      ipSolicitante: req.ip || '',
    });

    return res.status(200).json({
      mensaje: 'Solicitud de eliminación registrada correctamente.',
      url: statusUrl,
      confirmation_code: codigoConfirmacion,
      estado: solicitud.estado,
      explicacion: solicitud.explicacionEstado,
      datosEliminados: solicitud.datosEliminados,
      justificacionLegal: solicitud.justificacionLegal,
    });
  } catch {
    return res.status(500).json({
      error: 'No se pudo procesar la solicitud de eliminación en este momento.',
    });
  }
};

/**
 * DELETE /api/auth/eliminar-cuenta
 * Permite al usuario autenticado eliminar su propia cuenta y todos sus datos desde "Mi Perfil".
 */
const eliminarMiCuentaAutenticada = async (req, res, next) => {
  try {
    const usuarioId = req.usuario?._id;
    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (req.body?.password) {
      const uConPass = await Usuario.findById(usuarioId).select('+password');
      if (!uConPass || !(await uConPass.compararPassword(String(req.body.password)))) {
        return res.status(401).json({ error: 'La contraseña de confirmación es incorrecta' });
      }
    }

    await audit(req, {
      accion: 'user.account_delete',
      usuarioId,
      tenantId: req.usuario.tenantId,
      recurso: 'Usuario',
      recursoId: usuarioId,
      resultado: 'success',
    });

    const resultado = await ejecutarEliminacionDatos({
      usuarioId,
      email: req.usuario.email,
      telefono: req.usuario.telefono,
      origen: 'app_perfil',
      ip: req.ip || '',
    });

    res.clearCookie('refreshToken', { path: '/api/auth', maxAge: 0 });

    return res.status(200).json({
      mensaje: 'Tu cuenta y todos tus datos han sido eliminados permanentemente.',
      url: resultado.url,
      confirmation_code: resultado.confirmation_code,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  base64UrlDecode,
  parseSignedRequest,
  generarCodigoConfirmacion,
  ejecutarEliminacionDatos,
  reanudarEliminacion,
  handleMetaDataDeletionCallback,
  infoMetaDataDeletionWebhook,
  obtenerEstadoEliminacion,
  crearSolicitudEliminacionPublica,
  eliminarMiCuentaAutenticada,
};
