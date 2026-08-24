const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const { conectarDB } = require('../config/db');
const Tenant = require('../models/Tenant');
const { LIMITES_POR_PLAN } = require('../config/planes');

/**
 * Migración de planes viejos (free|bronce|oro|corporativo) al nuevo modelo
 * de 3 planes (free|pro|agro), pensado para el freemium con anuncios:
 *
 *   bronce      -> pro   (mismo punto de precio $19)
 *   oro         -> agro  (mantiene rango alto; $49)
 *   corporativo -> agro  (el tier superior ahora es agro)
 *
 * Los planes free se dejan igual (se actualizan sus límites al catálogo nuevo).
 */

const MAPEO_LEGADO = {
  bronce: 'pro',
  oro: 'agro',
  corporativo: 'agro',
};

const NUEVOS_PLANES = Object.keys(LIMITES_POR_PLAN);

async function main(options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : process.argv.includes('--dry-run');
  await conectarDB();

  console.log('=== Migración de planes a 3 tiers (free | pro | agro) ===');
  console.log(`Modo: ${dryRun ? 'DRY-RUN (no escribe)' : 'APLICANDO CAMBIOS'}`);

  const tenants = await Tenant.find();

  if (tenants.length === 0) {
    console.log('No hay tenants para migrar.');
    return;
  }

  let actualizados = 0;
  let sinCambios = 0;

  for (const tenant of tenants) {
    const planViejo = tenant.plan;

    // Planes ya válidos: solo actualizamos límites para que reflejen el catálogo nuevo
    if (NUEVOS_PLANES.includes(planViejo)) {
      const limitesNuevos = LIMITES_POR_PLAN[planViejo];
      if (dryRun) {
        continue;
      }
      tenant.limites = limitesNuevos;
      await tenant.save();
      sinCambios += 1;
      continue;
    }

    const planNuevo = MAPEO_LEGADO[planViejo] || 'free';
    console.log(`  ${planViejo.padEnd(14)} -> ${planNuevo.padEnd(8)}  (tenant ${tenant._id})`);

    if (dryRun) {
      actualizados += 1;
      continue;
    }

    tenant.aplicarPlan(planNuevo);
    await tenant.save();
    actualizados += 1;
  }

  console.log('\n=== RESUMEN ===');
  if (dryRun) {
    console.log(`Se migrarían ${actualizados} tenants con plan legado.`);
  } else {
    console.log(`${actualizados} tenants migrados a plan nuevo.`);
    console.log(`${sinCambios} tenants ya estaban en el catálogo (límites actualizados).`);
  }
  console.log(dryRun ? '(DRY-RUN: no se aplicaron cambios)' : 'Migración completada.');
}

module.exports = { main, MAPEO_LEGADO, NUEVOS_PLANES };

if (require.main === module) {
  main()
    .then(() => mongoose.connection.close())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migración de planes fallida:', err);
      try {
        mongoose.connection.close();
      } catch (closeErr) {
        console.error('Error cerrando conexión:', closeErr.message);
      }
      process.exit(1);
    });
}
