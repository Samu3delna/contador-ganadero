const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const { conectarDB } = require('../config/db');

/**
 * Migración de limpieza tras el cambio Stripe -> ONVO Pay.
 *
 * Qué hace:
 * 1. En `tenants`: elimina los campos legados stripeCustomerId,
 *    stripeSubscriptionId y stripePriceId de todos los documentos.
 * 2. En `tenants`: borra los índices legados stripeCustomerId_1 y
 *    stripeSubscriptionId_1 (si existen) y sincroniza los índices ONVO nuevos.
 * 3. En `subscriptionevents`: elimina los eventos viejos de Stripe (los que no
 *    tienen `eventoId`) — son un log de idempotencia de un proveedor que ya no
 *    se usa — y borra el índice legado stripeEventId_1.
 *
 * NO toca `plan` ni `estado` de los tenants: solo lista los que tenían una
 * suscripción de Stripe activa para que se les pida re-suscribirse por ONVO.
 *
 * Uso:
 *   node scripts/migrateOnvo.js --dry-run   # simula, no escribe
 *   node scripts/migrateOnvo.js             # aplica
 */

const CAMPOS_STRIPE_TENANT = ['stripeCustomerId', 'stripeSubscriptionId', 'stripePriceId'];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await conectarDB();

  const db = mongoose.connection.db;
  const tenants = db.collection('tenants');
  const eventos = db.collection('subscriptionevents');

  console.log('=== Migración de limpieza Stripe -> ONVO Pay ===');
  console.log(`Modo: ${dryRun ? 'DRY-RUN (no escribe)' : 'APLICANDO CAMBIOS'}\n`);

  // --- 1. Tenants: limpiar campos Stripe ---
  const filtroStripe = {
    $or: CAMPOS_STRIPE_TENANT.map((campo) => ({ [campo]: { $exists: true } })),
  };

  const tenantsConStripe = await tenants.find(filtroStripe).toArray();
  console.log(`Tenants con campos Stripe: ${tenantsConStripe.length}`);

  // Advertir sobre tenants con plan de pago ligado a Stripe (requieren seguimiento)
  const conPlanPago = tenantsConStripe.filter(
    (t) => t.stripeSubscriptionId && t.plan && t.plan !== 'free'
  );
  for (const t of conPlanPago) {
    console.warn(
      `  ⚠️  Tenant ${t._id} (${t.nombreFinca || 'sin nombre'}) tenía suscripción Stripe activa ` +
      `(plan ${t.plan}). Su plan se conserva; pedile re-suscribirse por ONVO si aplica.`
    );
  }

  if (!dryRun && tenantsConStripe.length > 0) {
    const resultado = await tenants.updateMany(filtroStripe, {
      $unset: { stripeCustomerId: '', stripeSubscriptionId: '', stripePriceId: '' },
    });
    console.log(`  Campos Stripe eliminados en ${resultado.modifiedCount} tenants.`);
  }

  // --- 2. Índices legados en tenants ---
  const indicesTenants = await tenants.indexes();
  const indicesLegadosTenants = ['stripeCustomerId_1', 'stripeSubscriptionId_1']
    .filter((nombre) => indicesTenants.some((ix) => ix.name === nombre));

  for (const nombre of indicesLegadosTenants) {
    console.log(`  Índice legado en tenants: ${nombre}`);
    if (!dryRun) {
      await tenants.dropIndex(nombre);
      console.log(`    -> eliminado`);
    }
  }

  // --- 3. SubscriptionEvents: borrar log viejo de Stripe ---
  const eventosViejos = await eventos.countDocuments({ eventoId: { $exists: false } });
  console.log(`\nEventos Stripe legados en subscriptionevents: ${eventosViejos}`);
  if (!dryRun && eventosViejos > 0) {
    const resultado = await eventos.deleteMany({ eventoId: { $exists: false } });
    console.log(`  Eliminados ${resultado.deletedCount} eventos legados.`);
  }

  const indicesEventos = await eventos.indexes();
  if (indicesEventos.some((ix) => ix.name === 'stripeEventId_1')) {
    console.log('  Índice legado en subscriptionevents: stripeEventId_1');
    if (!dryRun) {
      await eventos.dropIndex('stripeEventId_1');
      console.log('    -> eliminado');
    }
  }

  // --- 4. Sincronizar índices nuevos (ONVO) ---
  if (!dryRun) {
    const Tenant = require('../models/Tenant');
    const SubscriptionEvent = require('../models/SubscriptionEvent');
    await Tenant.syncIndexes();
    await SubscriptionEvent.syncIndexes();
    console.log('\nÍndices ONVO sincronizados (onvoCustomerId, onvoSubscriptionId, eventoId).');
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Tenants con campos Stripe limpiados: ${dryRun ? `${tenantsConStripe.length} (pendiente)` : tenantsConStripe.length}`);
  console.log(`Eventos Stripe legados eliminados:   ${dryRun ? `${eventosViejos} (pendiente)` : eventosViejos}`);
  console.log(dryRun ? '(DRY-RUN: no se aplicaron cambios)' : 'Migración completada.');
}

main()
  .then(() => mongoose.connection.close())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migración Stripe -> ONVO fallida:', err);
    try {
      mongoose.connection.close();
    } catch (closeErr) {
      console.error('Error cerrando conexión:', closeErr.message);
    }
    process.exit(1);
  });
