const mongoose = require('mongoose');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const SubscriptionEvent = require('../models/SubscriptionEvent');
const ChatFeedback = require('../models/ChatFeedback');
const RefreshToken = require('../models/RefreshToken');
const TicketSoporte = require('../models/TicketSoporte');
const { CATALOGO_PLANES, PLANES_VALIDOS } = require('../config/planes');
const { escapeRegex } = require('../utils/escapeRegex');
const { audit } = require('../utils/audit');
const { logger } = require('../utils/logger');
const { enviarEmailCloudflare } = require('./supportController');

const ESTADOS_TENANT_VALIDOS = ['activo', 'suspendido', 'periodo_gracia', 'cancelado'];
const ESTADOS_TICKET_VALIDOS = ['abierto', 'en_progreso', 'resuelto', 'cerrado'];
const PRIORIDADES_TICKET_VALIDAS = ['baja', 'media', 'alta'];

/**
 * Helper: parseo seguro de paginación
 */
const paginacion = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * @desc    Métricas globales de la plataforma
 * @route   GET /api/admin/resumen
 * @access  Super Admin
 */
const obtenerResumen = async (req, res, next) => {
  try {
    const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hace24horas = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsuarios,
      usuariosSuspendidos,
      usuariosNuevos30d,
      totalTenants,
      tenantsPorPlan,
      tenantsPorEstado,
      tenantsActivosPro,
      totalFacturas,
      facturas30d,
      totalIngresos,
      feedbackResumen,
      eventosOnvo24h,
      eventosOnvoConError,
      registrosPorDia,
    ] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.countDocuments({ suspendido: true }),
      Usuario.countDocuments({ createdAt: { $gte: hace30dias } }),
      Tenant.countDocuments(),
      Tenant.aggregate([{ $group: { _id: '$plan', total: { $sum: 1 } } }]),
      Tenant.aggregate([{ $group: { _id: '$estado', total: { $sum: 1 } } }]),
      Tenant.countDocuments({ plan: 'pro', estado: 'activo' }),
      Factura.countDocuments({}, { skipTenant: true }),
      Factura.countDocuments({ createdAt: { $gte: hace30dias } }, { skipTenant: true }),
      Ingreso.countDocuments({}, { skipTenant: true }),
      ChatFeedback.aggregate([{ $group: { _id: '$feedback', total: { $sum: 1 } } }], { skipTenant: true }),
      SubscriptionEvent.countDocuments({ createdAt: { $gte: hace24horas } }, { skipTenant: true }),
      SubscriptionEvent.countDocuments({ error: { $exists: true, $ne: null } }, { skipTenant: true }),
      // Serie diaria de registros de usuarios (últimos 30 días)
      Usuario.aggregate([
        { $match: { createdAt: { $gte: hace30dias } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const aMapa = (arr) => arr.reduce((acc, { _id, total }) => ({ ...acc, [_id]: total }), {});
    const precioPro = CATALOGO_PLANES.find((p) => p.id === 'pro')?.precio || 0;

    res.json({
      usuarios: {
        total: totalUsuarios,
        suspendidos: usuariosSuspendidos,
        nuevos30d: usuariosNuevos30d,
        registrosPorDia: registrosPorDia.map((r) => ({ fecha: r._id, total: r.total })),
      },
      tenants: {
        total: totalTenants,
        porPlan: aMapa(tenantsPorPlan),
        porEstado: aMapa(tenantsPorEstado),
      },
      actividad: {
        facturasTotal: totalFacturas,
        facturas30d,
        ingresosRegistrados: totalIngresos,
      },
      suscripciones: {
        mrrEstimadoUSD: Math.round(tenantsActivosPro * precioPro * 100) / 100,
        proActivos: tenantsActivosPro,
        eventosOnvo24h,
        eventosOnvoConError,
      },
      chatFeedback: aMapa(feedbackResumen),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Listar usuarios (búsqueda + paginación)
 * @route   GET /api/admin/usuarios?q=&page=&limit=
 * @access  Super Admin
 */
const listarUsuarios = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginacion(req);
    const q = (req.query.q || '').trim();

    const filtro = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q, 50), 'i');
      filtro.$or = [{ nombre: rx }, { email: rx }];
    }
    if (req.query.suspendido === 'true') filtro.suspendido = true;
    if (req.query.rol && ['dueño', 'admin', 'contador', 'peon'].includes(String(req.query.rol))) {
      filtro.rol = String(req.query.rol);
    }

    const [usuarios, total] = await Promise.all([
      Usuario.find(filtro)
        .populate('tenantId', 'nombreFinca plan estado')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Usuario.countDocuments(filtro),
    ]);

    res.json({ usuarios, total, page, paginas: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Detalle de un usuario (con su tenant)
 * @route   GET /api/admin/usuarios/:id
 * @access  Super Admin
 */
const obtenerUsuario = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id)
      .populate('tenantId', 'nombreFinca plan estado limites consumoActual emailAlias createdAt');

    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    const targetTenantId = usuario.tenantId?._id || usuario.tenantId;
    const [facturas, ingresos] = await Promise.all([
      Factura.countDocuments({ tenantId: targetTenantId }, { skipTenant: true }),
      Ingreso.countDocuments({ tenantId: targetTenantId }, { skipTenant: true }),
    ]);

    res.json({ usuario, actividad: { facturas, ingresos } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Editar datos básicos de un usuario (nombre, teléfono, rol)
 * @route   PUT /api/admin/usuarios/:id
 * @access  Super Admin
 */
const actualizarUsuario = async (req, res, next) => {
  try {
    const { nombre, telefono, rol } = req.body;
    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    const rolAnterior = usuario.rol;
    if (nombre !== undefined) usuario.nombre = String(nombre).trim().slice(0, 100);
    if (telefono !== undefined) usuario.telefono = telefono ? String(telefono).trim().slice(0, 30) : undefined;
    if (rol !== undefined) {
      if (!['dueño', 'admin', 'contador', 'peon'].includes(rol)) {
        res.status(400);
        throw new Error('Rol inválido. Válidos: dueño, admin, contador, peon');
      }
      if (rol !== rolAnterior) {
        usuario.rol = rol;
        usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
      }
    }

    await usuario.save();
    await audit(req, {
      accion: 'admin.user_update',
      recurso: 'Usuario',
      recursoId: usuario._id,
      resultado: 'success',
      metadata: { rolAnterior, rolNuevo: usuario.rol },
    });

    res.json({
      mensaje: 'Usuario actualizado',
      usuario: await Usuario.findById(usuario._id).populate('tenantId', 'nombreFinca plan estado'),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Suspender o reactivar un usuario
 * @route   PUT /api/admin/usuarios/:id/suspension  { suspendido: boolean }
 * @access  Super Admin
 */
const cambiarSuspensionUsuario = async (req, res, next) => {
  try {
    const { suspendido } = req.body;
    if (typeof suspendido !== 'boolean') {
      res.status(400);
      throw new Error('El campo "suspendido" (boolean) es obligatorio');
    }

    if (req.params.id === req.usuario._id.toString()) {
      res.status(400);
      throw new Error('No puedes suspender tu propia cuenta');
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    usuario.suspendido = suspendido;
    usuario.suspendidoEn = suspendido ? new Date() : undefined;
    if (suspendido) {
      usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
    }
    await usuario.save();

    if (suspendido) {
      await RefreshToken.revocarTodosDeUsuario(usuario._id, 'user_suspended');
    }

    await audit(req, {
      accion: suspendido ? 'admin.user_suspend' : 'admin.user_reactivate',
      recurso: 'Usuario',
      recursoId: usuario._id,
      resultado: 'success',
    });

    logger.info('Cambio de estado de suspensión de usuario por Super Admin', {
      adminId: String(req.usuario._id),
      targetUserId: String(usuario._id),
      suspendido,
    });
    res.json({ mensaje: suspendido ? 'Usuario suspendido' : 'Usuario reactivado', suspendido: usuario.suspendido });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generar contraseña temporal segura (se devuelve una sola vez e invalida sesiones previas)
 * @route   PUT /api/admin/usuarios/:id/reset-password
 * @access  Super Admin
 */
const resetPasswordUsuario = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    const passwordTemporal = `${crypto.randomBytes(12).toString('base64url')}A1!`;
    usuario.password = passwordTemporal;
    usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
    await usuario.save(); // el pre-save hashea con bcrypt (12 rounds)

    await RefreshToken.revocarTodosDeUsuario(usuario._id, 'admin_password_reset');

    await audit(req, {
      accion: 'admin.user_reset_password',
      recurso: 'Usuario',
      recursoId: usuario._id,
      resultado: 'success',
    });

    res.json({
      mensaje: 'Contraseña temporal generada. Compártela con el usuario por un canal seguro.',
      passwordTemporal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Eliminar un usuario (transfiere ownership del tenant si hay más miembros)
 * @route   DELETE /api/admin/usuarios/:id
 * @access  Super Admin
 */
const eliminarUsuario = async (req, res, next) => {
  try {
    if (req.params.id === req.usuario._id.toString()) {
      res.status(400);
      throw new Error('No puedes eliminar tu propia cuenta');
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      res.status(404);
      throw new Error('Usuario no encontrado');
    }

    const tenant = await Tenant.findById(usuario.tenantId);
    if (tenant) {
      tenant.usuarios = tenant.usuarios.filter((m) => !m.usuarioId.equals(usuario._id));
      if (tenant.owner?.equals(usuario._id) && tenant.usuarios.length > 0) {
        const nuevoOwnerId = tenant.usuarios[0].usuarioId;
        tenant.owner = nuevoOwnerId;
        tenant.usuarios[0].rol = 'dueño';
        await Usuario.updateOne({ _id: nuevoOwnerId }, { rol: 'dueño' });
      }
      await tenant.save();
    }

    const emailEliminado = usuario.email;
    await RefreshToken.revocarTodosDeUsuario(usuario._id, 'user_deleted');
    await usuario.deleteOne();

    await audit(req, {
      accion: 'admin.user_delete',
      recurso: 'Usuario',
      recursoId: usuario._id,
      resultado: 'success',
    });

    res.json({ mensaje: 'Usuario eliminado', email: emailEliminado });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Listar tenants (filtros: q, plan, estado + paginación)
 * @route   GET /api/admin/tenants
 * @access  Super Admin
 */
const listarTenants = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginacion(req);
    const q = (req.query.q || '').trim();

    const filtro = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q, 50), 'i');
      filtro.$or = [{ nombreFinca: rx }, { emailAlias: rx }];
    }
    if (req.query.plan && PLANES_VALIDOS.includes(req.query.plan)) filtro.plan = req.query.plan;
    if (req.query.estado && ESTADOS_TENANT_VALIDOS.includes(req.query.estado)) filtro.estado = req.query.estado;

    const [tenants, total] = await Promise.all([
      Tenant.find(filtro)
        .populate('owner', 'nombre email suspendido')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Tenant.countDocuments(filtro),
    ]);

    res.json({ tenants, total, page, paginas: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Detalle de un tenant (owner, miembros, límites, consumo, ONVO)
 * @route   GET /api/admin/tenants/:id
 * @access  Super Admin
 */
const obtenerTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate('owner', 'nombre email suspendido createdAt')
      .populate('usuarios.usuarioId', 'nombre email rol suspendido');

    if (!tenant) {
      res.status(404);
      throw new Error('Tenant no encontrado');
    }

    const [facturas, ingresos, eventosOnvo] = await Promise.all([
      Factura.countDocuments({ tenantId: tenant._id }, { skipTenant: true }),
      Ingreso.countDocuments({ tenantId: tenant._id }, { skipTenant: true }),
      SubscriptionEvent.countDocuments({ tenantId: tenant._id }, { skipTenant: true }),
    ]);

    res.json({ tenant, actividad: { facturas, ingresos, eventosOnvo } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cambiar el plan de un tenant (recalcula límites)
 * @route   PUT /api/admin/tenants/:id/plan  { plan: 'free'|'pro' }
 * @access  Super Admin
 */
const cambiarPlanTenant = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!PLANES_VALIDOS.includes(plan)) {
      res.status(400);
      throw new Error(`Plan inválido. Válidos: ${PLANES_VALIDOS.join(', ')}`);
    }

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      res.status(404);
      throw new Error('Tenant no encontrado');
    }

    const planAnterior = tenant.plan;
    tenant.aplicarPlan(plan);
    await tenant.save();

    await audit(req, {
      accion: 'admin.tenant_change_plan',
      recurso: 'Tenant',
      recursoId: tenant._id,
      resultado: 'success',
      metadata: { planAnterior, planNuevo: plan },
    });

    res.json({ mensaje: `Plan actualizado a "${plan}"`, plan: tenant.plan, limites: tenant.limites });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cambiar el estado de un tenant (activo/suspendido/periodo_gracia/cancelado)
 * @route   PUT /api/admin/tenants/:id/estado  { estado }
 * @access  Super Admin
 */
const cambiarEstadoTenant = async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!ESTADOS_TENANT_VALIDOS.includes(estado)) {
      res.status(400);
      throw new Error(`Estado inválido. Válidos: ${ESTADOS_TENANT_VALIDOS.join(', ')}`);
    }

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      res.status(404);
      throw new Error('Tenant no encontrado');
    }

    const estadoAnterior = tenant.estado;
    tenant.estado = estado;
    if (estado === 'suspendido') tenant.suspendidoEn = new Date();
    if (estado === 'cancelado') tenant.canceladoEn = new Date();
    await tenant.save();

    await audit(req, {
      accion: 'admin.tenant_change_status',
      recurso: 'Tenant',
      recursoId: tenant._id,
      resultado: 'success',
      metadata: { estadoAnterior, estadoNuevo: estado },
    });

    res.json({ mensaje: `Estado actualizado a "${estado}"`, estado: tenant.estado });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resetear consumo mensual de un tenant
 * @route   POST /api/admin/tenants/:id/resetear-consumo
 * @access  Super Admin
 */
const resetearConsumoTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      res.status(404);
      throw new Error('Tenant no encontrado');
    }

    tenant.resetearConsumo();
    await tenant.save();

    await audit(req, {
      accion: 'admin.tenant_reset_consumption',
      recurso: 'Tenant',
      recursoId: tenant._id,
      resultado: 'success',
    });

    res.json({ mensaje: 'Consumo mensual reseteado', consumoActual: tenant.consumoActual });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Últimos eventos de webhooks ONVO
 * @route   GET /api/admin/monitoreo/eventos-onvo?limit=
 * @access  Super Admin
 */
const monitoreoEventosOnvo = async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);

    const [eventos, porTipo, conError] = await Promise.all([
      SubscriptionEvent.find({}, null, { skipTenant: true })
        .populate('tenantId', 'nombreFinca')
        .sort({ createdAt: -1 })
        .limit(limit),
      SubscriptionEvent.aggregate([{ $group: { _id: '$type', total: { $sum: 1 } } }, { $sort: { total: -1 } }], { skipTenant: true }),
      SubscriptionEvent.countDocuments({ error: { $exists: true, $ne: null } }, { skipTenant: true }),
    ]);

    res.json({
      eventos,
      totalesPorTipo: porTipo.map((t) => ({ tipo: t._id, total: t.total })),
      conError,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Feedback reciente del chat IA
 * @route   GET /api/admin/monitoreo/chat-feedback?limit=
 * @access  Super Admin
 */
const monitoreoChatFeedback = async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [feedback, resumen, negativos30d] = await Promise.all([
      ChatFeedback.find({}, null, { skipTenant: true })
        .populate('usuario', 'nombre email')
        .populate('tenantId', 'nombreFinca')
        .sort({ createdAt: -1 })
        .limit(limit),
      ChatFeedback.aggregate([{ $group: { _id: '$feedback', total: { $sum: 1 } } }], { skipTenant: true }),
      ChatFeedback.countDocuments({ feedback: 'negativo', createdAt: { $gte: hace30dias } }, { skipTenant: true }),
    ]);

    res.json({
      feedback,
      resumen: resumen.reduce((acc, { _id, total }) => ({ ...acc, [_id]: total }), {}),
      negativos30d,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Estado de la ingesta de correos (IMAP / Cloudflare Email Routing)
 * @route   GET /api/admin/monitoreo/email
 * @access  Super Admin
 */
const monitoreoEmail = async (req, res, next) => {
  try {
    const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [tenantsConAlias, usuariosConImap, facturasPorEmail7d, facturasPorEmailTotal, facturasConError] = await Promise.all([
      Tenant.countDocuments({ emailAlias: { $exists: true, $ne: null } }),
      Usuario.countDocuments({ 'configEmail.host': { $exists: true, $ne: null } }),
      Factura.countDocuments({ emailUID: { $exists: true, $ne: null }, createdAt: { $gte: hace7dias } }, { skipTenant: true }),
      Factura.countDocuments({ emailUID: { $exists: true, $ne: null } }, { skipTenant: true }),
      Factura.countDocuments({ estado: 'error' }, { skipTenant: true }),
    ]);

    const imapGlobal = !!(process.env.IMAP_USER && process.env.IMAP_PASSWORD && !process.env.IMAP_USER.includes('tu_'));

    res.json({
      canales: {
        imapGlobal: { configurado: imapGlobal, host: imapGlobal ? process.env.IMAP_HOST || 'imap.gmail.com' : null },
        cloudflareEmailRouting: { tenantsConAlias },
        imapPorUsuario: usuariosConImap,
      },
      ingesta: { facturasPorEmailTotal, facturasPorEmail7d, facturasConError },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Salud del servidor y conexiones
 * @route   GET /api/admin/monitoreo/salud
 * @access  Super Admin
 */
const monitoreoSalud = async (req, res, next) => {
  try {
    const memoria = process.memoryUsage();
    res.json({
      mongo: { conectado: mongoose.connection.readyState === 1, estado: mongoose.connection.readyState },
      servidor: {
        uptimeSegundos: Math.round(process.uptime()),
        memoriaMB: {
          rss: Math.round(memoria.rss / 1024 / 1024),
          heapUsado: Math.round(memoria.heapUsed / 1024 / 1024),
        },
        node: process.version,
        entorno: process.env.NODE_ENV || 'development',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// === Soporte: bandeja de tickets (formularios de contacto) ===
// ============================================================

/**
 * Escapa HTML para prevenir XSS en las plantillas de email
 */
function escapeHtml(text) {
  const map = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;',
  };
  return String(text ?? '').replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * @desc    Listar tickets de soporte (búsqueda + filtros + paginación + resumen)
 * @route   GET /api/admin/soporte/tickets?q=&estado=&prioridad=&page=&limit=
 * @access  Super Admin
 */
const listarTicketsSoporte = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginacion(req);
    const q = (req.query.q || '').trim();

    const filtro = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q, 50), 'i');
      filtro.$or = [{ asunto: rx }, { email: rx }, { nombre: rx }];
    }
    if (req.query.estado && ESTADOS_TICKET_VALIDOS.includes(String(req.query.estado))) {
      filtro.estado = String(req.query.estado);
    }
    if (req.query.prioridad && PRIORIDADES_TICKET_VALIDAS.includes(String(req.query.prioridad))) {
      filtro.prioridad = String(req.query.prioridad);
    }

    const [tickets, total, resumenPorEstado] = await Promise.all([
      TicketSoporte.find(filtro, null, { skipTenant: true })
        .populate('tenantId', 'nombreFinca plan estado')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TicketSoporte.countDocuments(filtro, { skipTenant: true }),
      TicketSoporte.aggregate(
        [{ $group: { _id: '$estado', total: { $sum: 1 } } }],
        { skipTenant: true }
      ),
    ]);

    res.json({
      tickets,
      total,
      page,
      paginas: Math.ceil(total / limit),
      resumen: resumenPorEstado.reduce((acc, { _id, total: n }) => ({ ...acc, [_id]: n }), {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Detalle de un ticket de soporte (hilo completo)
 * @route   GET /api/admin/soporte/tickets/:id
 * @access  Super Admin
 */
const obtenerTicketSoporte = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID_INVALIDO', mensaje: 'Identificador de ticket inválido' });
    }

    const ticket = await TicketSoporte.findById(id, null, { skipTenant: true })
      .populate('tenantId', 'nombreFinca plan estado');

    if (!ticket) {
      return res.status(404).json({ error: 'TICKET_NO_ENCONTRADO', mensaje: 'El ticket de soporte no existe' });
    }

    res.json({ ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Actualizar estado y/o prioridad de un ticket de soporte
 * @route   PUT /api/admin/soporte/tickets/:id  { estado, prioridad }
 * @access  Super Admin
 */
const actualizarTicketSoporte = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID_INVALIDO', mensaje: 'Identificador de ticket inválido' });
    }

    const { estado, prioridad } = req.body || {};
    const cambios = {};

    if (estado !== undefined && estado !== null && estado !== '') {
      if (!ESTADOS_TICKET_VALIDOS.includes(estado)) {
        return res.status(400).json({
          error: 'ESTADO_INVALIDO',
          mensaje: `Estado inválido. Válidos: ${ESTADOS_TICKET_VALIDOS.join(', ')}`,
        });
      }
      cambios.estado = estado;
    }

    if (prioridad !== undefined && prioridad !== null && prioridad !== '') {
      if (!PRIORIDADES_TICKET_VALIDAS.includes(prioridad)) {
        return res.status(400).json({
          error: 'PRIORIDAD_INVALIDA',
          mensaje: `Prioridad inválida. Válidas: ${PRIORIDADES_TICKET_VALIDAS.join(', ')}`,
        });
      }
      cambios.prioridad = prioridad;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'SIN_CAMBIOS', mensaje: 'Indica estado y/o prioridad a actualizar' });
    }

    const ticket = await TicketSoporte.findOneAndUpdate(
      { _id: id },
      { $set: cambios },
      { new: true, runValidators: true, skipTenant: true }
    ).populate('tenantId', 'nombreFinca plan estado');

    if (!ticket) {
      return res.status(404).json({ error: 'TICKET_NO_ENCONTRADO', mensaje: 'El ticket de soporte no existe' });
    }

    await audit(req, {
      accion: 'admin.soporte_actualizar_ticket',
      recurso: 'TicketSoporte',
      recursoId: ticket._id,
      resultado: 'success',
      metadata: cambios,
    });

    res.json({ ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Responder un ticket de soporte: registra la respuesta en el hilo
 *          y envía el email al remitente (mejor esfuerzo)
 * @route   POST /api/admin/soporte/tickets/:id/responder  { mensaje }
 * @access  Super Admin
 */
const responderTicketSoporte = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID_INVALIDO', mensaje: 'Identificador de ticket inválido' });
    }

    const texto = ((req.body && req.body.mensaje) || '').trim();
    if (!texto) {
      return res.status(400).json({ error: 'MENSAJE_REQUERIDO', mensaje: 'Debes escribir la respuesta a enviar' });
    }
    if (texto.length > 5000) {
      return res.status(400).json({
        error: 'DATOS_DEMASIADO_LARGOS',
        mensaje: 'La respuesta excede la longitud máxima permitida (5000 caracteres)',
      });
    }

    const ticket = await TicketSoporte.findById(id, null, { skipTenant: true });
    if (!ticket) {
      return res.status(404).json({ error: 'TICKET_NO_ENCONTRADO', mensaje: 'El ticket de soporte no existe' });
    }

    const nombreSoporte = req.usuario?.nombre || 'Equipo de Soporte';

    const textoPlano = `
Respuesta del equipo de soporte de ContadorGanadero

Ticket: ${ticket.asunto}
Respondido por: ${nombreSoporte}

--- Respuesta ---
${texto}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .message-box { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; white-space: pre-wrap; }
    .footer { background: #1e40af; color: white; padding: 16px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 20px;">💬 Respuesta de Soporte</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">ContadorGanadero</p>
  </div>
  <div class="content">
    <p>Ticket: <strong>${escapeHtml(ticket.asunto)}</strong></p>
    <div class="message-box">${escapeHtml(texto)}</div>
  </div>
  <div class="footer">
    ${escapeHtml(nombreSoporte)} — Equipo de Soporte de ContadorGanadero
  </div>
</body>
</html>
    `.trim();

    // Enviar email al remitente (mejor esfuerzo: la respuesta queda registrada igual)
    const resultado = await enviarEmailCloudflare({
      to: [ticket.email],
      subject: `[Soporte] ${ticket.asunto}`,
      text: textoPlano,
      html: html,
      replyTo: process.env.CLOUDFLARE_EMAIL_FROM || 'soporte@contadorganandero.com',
    });

    const emailEnviado = Boolean(resultado.success);
    if (!emailEnviado) {
      console.error('❌ Error enviando respuesta de soporte:', resultado.error);
    }

    ticket.mensajes.push({
      autor: 'soporte',
      autorNombre: nombreSoporte,
      texto,
      fecha: new Date(),
      emailEnviado,
      errorEnvio: emailEnviado ? null : String(resultado.error || 'Error desconocido').slice(0, 500),
    });

    // Al responder, un ticket abierto pasa a estar en progreso
    if (ticket.estado === 'abierto') {
      ticket.estado = 'en_progreso';
    }

    // Evita que el plugin de tenant sobrescriba el tenantId del ticket
    ticket.$locals.skipTenant = true;
    await ticket.save();

    res.json({
      ok: true,
      ticket,
      emailEnviado,
      ...(emailEnviado ? {} : { mensaje: 'La respuesta quedó registrada en el hilo, pero no se pudo enviar el email al remitente' }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  obtenerResumen,
  listarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  cambiarSuspensionUsuario,
  resetPasswordUsuario,
  eliminarUsuario,
  listarTenants,
  obtenerTenant,
  cambiarPlanTenant,
  cambiarEstadoTenant,
  resetearConsumoTenant,
  monitoreoEventosOnvo,
  monitoreoChatFeedback,
  monitoreoEmail,
  monitoreoSalud,
  listarTicketsSoporte,
  obtenerTicketSoporte,
  actualizarTicketSoporte,
  responderTicketSoporte,
};
