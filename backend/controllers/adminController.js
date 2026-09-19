const mongoose = require('mongoose');
const crypto = require('crypto');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const SubscriptionEvent = require('../models/SubscriptionEvent');
const ChatFeedback = require('../models/ChatFeedback');
const { CATALOGO_PLANES, PLANES_VALIDOS } = require('../config/planes');

const ESTADOS_TENANT_VALIDOS = ['activo', 'suspendido', 'periodo_gracia', 'cancelado'];

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
      Factura.countDocuments(),
      Factura.countDocuments({ createdAt: { $gte: hace30dias } }),
      Ingreso.countDocuments(),
      ChatFeedback.aggregate([{ $group: { _id: '$feedback', total: { $sum: 1 } } }]),
      SubscriptionEvent.countDocuments({ createdAt: { $gte: hace24horas } }),
      SubscriptionEvent.countDocuments({ error: { $exists: true, $ne: null } }),
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
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ nombre: rx }, { email: rx }];
    }
    if (req.query.suspendido === 'true') filtro.suspendido = true;
    if (req.query.rol) filtro.rol = req.query.rol;

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

    const [facturas, ingresos] = await Promise.all([
      Factura.countDocuments({ tenantId: usuario.tenantId?._id || usuario.tenantId }),
      Ingreso.countDocuments({ tenantId: usuario.tenantId?._id || usuario.tenantId }),
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

    if (nombre !== undefined) usuario.nombre = String(nombre).trim();
    if (telefono !== undefined) usuario.telefono = telefono ? String(telefono).trim() : undefined;
    if (rol !== undefined) {
      if (!['dueño', 'contador', 'peon'].includes(rol)) {
        res.status(400);
        throw new Error("Rol inválido. Válidos: dueño, contador, peon");
      }
      usuario.rol = rol;
    }

    await usuario.save();
    res.json({ mensaje: 'Usuario actualizado', usuario: await Usuario.findById(usuario._id).populate('tenantId', 'nombreFinca plan estado') });
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
    await usuario.save();

    console.log(`🛡️ [ADMIN] ${req.usuario.email} ${suspendido ? 'suspendió' : 'reactivó'} al usuario ${usuario.email}`);
    res.json({ mensaje: suspendido ? 'Usuario suspendido' : 'Usuario reactivado', suspendido: usuario.suspendido });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generar contraseña temporal (se devuelve una sola vez)
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

    const passwordTemporal = crypto.randomBytes(6).toString('base64url'); // ~8 chars legibles
    usuario.password = passwordTemporal;
    await usuario.save(); // el pre-save hashea con bcrypt

    console.log(`🛡️ [ADMIN] ${req.usuario.email} reseteó la contraseña de ${usuario.email}`);
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
    await usuario.deleteOne();

    console.log(`🛡️ [ADMIN] ${req.usuario.email} eliminó al usuario ${emailEliminado}`);
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
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ nombreFinca: rx }, { emailAlias: rx }];
    }
    if (req.query.plan && PLANES_VALIDOS.includes(req.query.plan)) filtro.plan = req.query.plan;
    if (req.query.estado && ESTADOS_TENANT_VALIDOS.includes(req.query.estado)) filtro.estado = req.query.estado;

    const [tenants, total] = await Promise.all([
      // Nota: certificadoP12Base64/pinCertificado/passwordHacienda ya tienen
      // select:false a nivel de schema — excluirlos aquí choca con esa proyección.
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
      // Los secretos de Hacienda (certificado, PIN, contraseña) tienen select:false
      // en el schema, así que nunca viajan en esta respuesta.
      .populate('owner', 'nombre email suspendido createdAt')
      .populate('usuarios.usuarioId', 'nombre email rol suspendido');

    if (!tenant) {
      res.status(404);
      throw new Error('Tenant no encontrado');
    }

    const [facturas, ingresos, eventosOnvo] = await Promise.all([
      Factura.countDocuments({ tenantId: tenant._id }),
      Ingreso.countDocuments({ tenantId: tenant._id }),
      SubscriptionEvent.countDocuments({ tenantId: tenant._id }),
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

    console.log(`🛡️ [ADMIN] ${req.usuario.email} cambió el plan del tenant ${tenant._id}: ${planAnterior} → ${plan}`);
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

    console.log(`🛡️ [ADMIN] ${req.usuario.email} cambió el estado del tenant ${tenant._id}: ${estadoAnterior} → ${estado}`);
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

    console.log(`🛡️ [ADMIN] ${req.usuario.email} reseteó el consumo del tenant ${tenant._id}`);
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
      SubscriptionEvent.find()
        .populate('tenantId', 'nombreFinca')
        .sort({ createdAt: -1 })
        .limit(limit),
      SubscriptionEvent.aggregate([{ $group: { _id: '$type', total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      SubscriptionEvent.countDocuments({ error: { $exists: true, $ne: null } }),
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
      ChatFeedback.find()
        .populate('usuario', 'nombre email')
        .populate('tenantId', 'nombreFinca')
        .sort({ createdAt: -1 })
        .limit(limit),
      ChatFeedback.aggregate([{ $group: { _id: '$feedback', total: { $sum: 1 } } }]),
      ChatFeedback.countDocuments({ feedback: 'negativo', createdAt: { $gte: hace30dias } }),
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
      Factura.countDocuments({ emailUID: { $exists: true, $ne: null }, createdAt: { $gte: hace7dias } }),
      Factura.countDocuments({ emailUID: { $exists: true, $ne: null } }),
      Factura.countDocuments({ estadoProcesamiento: 'error' }),
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
};
