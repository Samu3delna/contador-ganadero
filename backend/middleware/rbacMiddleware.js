/**
 * Control de Acceso Basado en Roles (RBAC) centralizado para ContadorGanadero.
 *
 * Roles de organización (Tenant):
 *   - 'dueño': Propietario de la finca; control total incluyendo .p12, suscripción ONVO y borrado.
 *   - 'admin': Administrador operativo de la finca; gestiona facturas, declaraciones, inventario y miembros (excepto dueño).
 *   - 'contador': Acceso contable y fiscal (facturas, ingresos, declaraciones, emisión Hacienda, lectura de costos/inventario).
 *   - 'peon': Acceso operativo de campo (registro de eventos de inventario y carga de comprobantes/gastos, sin borrar ni ver impuestos).
 *
 * Rol de plataforma:
 *   - usuario.isSuperAdmin === true: Acceso a /api/admin/* y soporte global.
 */

const { audit } = require('../utils/audit');

const ROLES_VALIDOS = ['dueño', 'admin', 'contador', 'peon'];

const MATRIZ_PERMISOS = {
  'facturas:leer': ['dueño', 'admin', 'contador'],
  'facturas:crear_manual': ['dueño', 'admin', 'contador', 'peon'],
  'facturas:subir_xml': ['dueño', 'admin', 'contador', 'peon'],
  'facturas:editar_deducibilidad': ['dueño', 'admin', 'contador'],
  'facturas:eliminar': ['dueño', 'admin'],
  'ingresos:leer': ['dueño', 'admin', 'contador'],
  'ingresos:crear': ['dueño', 'admin', 'contador'],
  'ingresos:eliminar': ['dueño', 'admin'],
  'costos:leer': ['dueño', 'admin', 'contador'],
  'costos:crear': ['dueño', 'admin', 'contador'],
  'costos:eliminar': ['dueño', 'admin'],
  'hacienda:emitir': ['dueño', 'admin', 'contador'],
  'hacienda:anular': ['dueño', 'admin', 'contador'],
  'hacienda:configurar_p12': ['dueño'],
  'declaraciones:generar_y_exportar': ['dueño', 'admin', 'contador'],
  'inventario:leer': ['dueño', 'admin', 'contador', 'peon'],
  'inventario:registrar_eventos': ['dueño', 'admin', 'peon'],
  'inventario:eliminar': ['dueño', 'admin'],
  'tenant:invitar_miembros': ['dueño', 'admin'],
  'tenant:cambiar_roles': ['dueño', 'admin'],
  'billing:gestionar_suscripcion': ['dueño'],
  'cuenta:eliminar_organizacion': ['dueño'],
};

function normalizarRol(rol) {
  if (!rol || typeof rol !== 'string') return 'peon';
  const limpio = rol.trim().toLowerCase();
  if (limpio === 'administrador') return 'admin';
  return ROLES_VALIDOS.includes(limpio) ? limpio : 'peon';
}

function tienePermiso(usuario, accion) {
  if (!usuario) return false;
  if (usuario.isSuperAdmin === true || usuario.esSuperAdmin === true) return true;
  const rol = normalizarRol(usuario.rol);
  const rolesPermitidos = MATRIZ_PERMISOS[accion];
  if (!rolesPermitidos) return false;
  return rolesPermitidos.includes(rol);
}

/**
 * Middleware `permitir(accion)` que verifica que el rol del usuario autenticado
 * tenga permiso en la matriz central. Si no lo tiene, registra en AuditLog y responde 403.
 */
function permitir(accion) {
  return async (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado.' });
    }

    if (tienePermiso(req.usuario, accion)) {
      return next();
    }

    await audit(req, {
      accion: 'rbac.acceso_denegado',
      recurso: accion,
      resultado: 'bloqueado',
      motivo: `El rol "${req.usuario.rol}" no tiene permiso para "${accion}"`,
    });

    return res.status(403).json({
      error: 'No tienes permisos suficientes para realizar esta acción.',
      codigo: 'FORBIDDEN_ACTION',
      accionRequerida: accion,
    });
  };
}

module.exports = {
  ROLES_VALIDOS,
  MATRIZ_PERMISOS,
  normalizarRol,
  tienePermiso,
  permitir,
};
