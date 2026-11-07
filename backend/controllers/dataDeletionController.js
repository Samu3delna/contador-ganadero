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
  'De conformidad con la Ley N° 8968 de Costa Rica, los datos personales y credenciales de acceso de la cuenta han sido eliminados de nuestros servidores activos. Los comprobantes electrónicos transmitidos a Hacienda quedan sujetos al deber legal de conservación del contribuyente.';

function generarCodigoConfirmacion() {
  const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase().slice(-4);
  return `CG${timePart}${randomPart}`;
}

function obtenerBaseUrlPublica() {
  const url = (
    process.env.PUBLIC_SITE_URL ||
    process.env.DOMAIN_URL ||
    'https://contadorganandero.com'
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
        'Datos de contacto asociados al perfil',
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
              ...(tenant.emailAlias ? [{ 'payload.emailDestino': `${tenant.emailAlias}@contadorganandero.com` },
                { 'payload.opciones.emailDestino': `${tenant.emailAlias}@contadorganandero.com` }] : [])] });
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
              'Configuración de la finca y buzón @contadorganandero.com',
              'Certificados criptográficos (.p12) y credenciales de Hacienda cifradas',
              'Facturas recibidas, ingresos, inventario multiespecie y costos de producción',
              'Proyecciones y borradores de declaraciones tributarias'
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
      ? `Su solicitud de eliminación de datos (código ${codigoConfirmacion}) ha sido procesada y completada exitosamente. Se eliminaron de forma permanente su perfil de usuario y los registros asociados en ContadorGanadero.`
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
  generarCodigoConfirmacion,
  ejecutarEliminacionDatos,
  reanudarEliminacion,
  eliminarMiCuentaAutenticada,
};
