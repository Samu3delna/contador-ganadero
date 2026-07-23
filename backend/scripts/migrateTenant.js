const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const { conectarDB } = require('../config/db');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Factura = require('../models/Factura');
const FacturaEmision = require('../models/FacturaEmision');
const Ingreso = require('../models/Ingreso');
const Inventario = require('../models/Inventario');
const Declaracion = require('../models/Declaracion');
const CostoProduccion = require('../models/CostoProduccion');
const RecordatorioFiscal = require('../models/RecordatorioFiscal');
const ChatFeedback = require('../models/ChatFeedback');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Modelos cuyos documentos se asocian a un usuario (campo `usuario`)
 * y tienen `tenantId`. Categoria NO se incluye (catalogo global).
 */
const MODELOS_USUARIO = [
  Factura,
  FacturaEmision,
  Ingreso,
  Inventario,
  Declaracion,
  CostoProduccion,
  RecordatorioFiscal,
  ChatFeedback,
];

/**
 * Propaga tenantId a todos los documentos del usuario en cada modelo.
 * Solo actualiza documentos sin tenantId ($exists: false).
 * @param {mongoose.Types.ObjectId} usuarioId
 * @param {mongoose.Types.ObjectId} tenantId
 * @returns {Promise<number>} total de documentos actualizados
 */
async function propagarTenantADocumentos(usuarioId, tenantId) {
  let totalActualizados = 0;
  for (const Modelo of MODELOS_USUARIO) {
    const filtro = { usuario: usuarioId, tenantId: { $exists: false } };
    if (DRY_RUN) {
      const conteo = await Modelo.countDocuments(filtro);
      if (conteo > 0) {
        console.log(`  [DRY-RUN] ${Modelo.modelName}: ${conteo} documentos pendientes`);
        totalActualizados += conteo;
      }
      continue;
    }
    const res = await Modelo.updateMany(filtro, { $set: { tenantId } });
    if (res.modifiedCount > 0) {
      console.log(`  ${Modelo.modelName}: ${res.modifiedCount} documentos actualizados`);
      totalActualizados += res.modifiedCount;
    }
  }
  return totalActualizados;
}

/**
 * Migra un usuario: crea Tenant, asigna tenantId/rol y propaga a documentos.
 * @param {object} usuario
 * @returns {Promise<{tenantCreado: boolean, docsActualizados: number}>}
 */
async function migrarUsuario(usuario) {
  const nombreFinca = usuario.nombreFinca || 'Mi Finca';

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Usuario ${usuario.email} (${usuario._id})`);
    console.log(`  Crearia Tenant: nombreFinca="${nombreFinca}", owner=${usuario._id}, plan=free`);
    console.log(`  Asignaria usuario.tenantId y usuario.rol="dueño"`);
    const docs = await propagarTenantADocumentos(usuario._id, null);
    return { tenantCreado: true, docsActualizados: docs };
  }

  console.log(`\nMigrando usuario ${usuario.email} (${usuario._id})`);

  const tenant = await Tenant.crearParaUsuario({
    nombreFinca,
    owner: usuario._id,
    plan: 'free',
  });
  console.log(`  Tenant creado: ${tenant._id} ("${nombreFinca}")`);

  usuario.tenantId = tenant._id;
  usuario.rol = 'dueño';
  await usuario.save();
  console.log(`  Usuario actualizado: tenantId=${tenant._id}, rol=dueño`);

  const docsActualizados = await propagarTenantADocumentos(usuario._id, tenant._id);
  return { tenantCreado: true, docsActualizados };
}

/**
 * Entry point del script de migracion backfill a multi-tenant.
 */
async function main() {
  await conectarDB();
  console.log('Iniciando migracion tenant...');
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no escribe)' : 'APLICANDO CAMBIOS'}`);

  const usuariosSinTenant = await Usuario.find({
    $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
  });

  if (usuariosSinTenant.length === 0) {
    console.log('\nNo hay usuarios pendientes de migrar. Todo en orden.');
    return;
  }

  console.log(`\nUsuarios pendientes: ${usuariosSinTenant.length}`);

  let tenantsCreados = 0;
  let docsActualizados = 0;

  for (const usuario of usuariosSinTenant) {
    try {
      // Idempotencia: si el usuario ya tendra tenantId al recargar, omitir
      const fresh = await Usuario.findById(usuario._id);
      if (fresh.tenantId) {
        console.log(`Usuario ${fresh.email} ya tiene tenantId, se omite.`);
        continue;
      }
      const res = await migrarUsuario(fresh);
      tenantsCreados += res.tenantCreado ? 1 : 0;
      docsActualizados += res.docsActualizados;
    } catch (err) {
      console.error(`Error migrando usuario ${usuario.email} (${usuario._id}):`, err.message);
      throw err;
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log(`${usuariosSinTenant.length} usuarios procesados`);
  console.log(`${tenantsCreados} tenants creados`);
  console.log(`${docsActualizados} documentos actualizados`);
  console.log(DRY_RUN ? '(DRY-RUN: no se aplicaron cambios)' : 'Migracion completada.');
}

module.exports = { main, propagarTenantADocumentos, migrarUsuario };

// Auto-ejecutar solo si el modulo se invoca directamente (no cuando se
// requiere como dependencia, ej. en tests Jest).
if (require.main === module) {
  main()
    .then(() => mongoose.connection.close())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migracion fallida:', err);
      try {
        mongoose.connection.close();
      } catch (_) {}
      process.exit(1);
    });
}
