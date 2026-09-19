/**
 * Catálogo central de planes de ContadorGanadero.
 *
 * Dos planes (freemium con anuncios):
 *  - free  : Gratis, con anuncios web y límites básicos.
 *  - pro   : $10/mes, sin anuncios, más conteos, VLM y soporte por email.
 *
 * `LIMITES_POR_PLAN` es la fuente de verdad para el backend (Tenant)
 * y `CATALOGO_PLANES` es la vista pública (precio, features, anuncios).
 */

const PLANES_VALIDOS = ['free', 'pro'];

// Límites aplicados realmente por el backend
const LIMITES_POR_PLAN = {
  free: {
    conteosMes: 10,
    usuariosTenant: 1,
    almacenamientoMB: 2048, // 2 GB
    vlmHabilitado: false,
    tokensChatMes: 100000,
    moduloContable: true,
    moduloD150: false,
    anunciosHabilitados: true,
    soporte: 'Comunidad',
  },
  pro: {
    conteosMes: 300,
    usuariosTenant: 3,
    almacenamientoMB: 25600, // 25 GB
    vlmHabilitado: true,
    tokensChatMes: 1000000,
    moduloContable: true,
    moduloD150: true,
    anunciosHabilitados: false,
    soporte: 'Email',
  },
};

function formatearAlmacenamiento(mb) {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function formatearNumero(n) {
  return n.toLocaleString('es-CR');
}

// Lista simple de beneficios por plan (se construye desde los límites
// para que la web nunca diverja de lo que el backend realmente aplica).
function construirFeatures(id) {
  const l = LIMITES_POR_PLAN[id] || LIMITES_POR_PLAN.free;
  return [
    { texto: `${formatearNumero(l.conteosMes)} conteos visuales IA al mes`, incluido: true },
    { texto: `${l.usuariosTenant} ${l.usuariosTenant === 1 ? 'usuario' : 'usuarios'}`, incluido: true },
    { texto: `${formatearAlmacenamiento(l.almacenamientoMB)} de almacenamiento`, incluido: true },
    { texto: 'Conteos por visión (VLM)', incluido: l.vlmHabilitado },
    { texto: 'Módulo contable y fiscal (IVA, Renta)', incluido: l.moduloContable },
    { texto: 'Módulo D-150 / conciliación REA', incluido: l.moduloD150 },
    { texto: l.anunciosHabilitados ? 'Con anuncios' : 'Sin anuncios', incluido: !l.anunciosHabilitados },
    { texto: 'Soporte por email', incluido: l.soporte === 'Email' },
  ];
}

// Catálogo público que también sirve la API /api/onvo/planes
const CATALOGO_PLANES = [
  {
    id: 'free',
    nombre: 'Gratis',
    precio: 0,
    moneda: 'USD',
    periodicidad: 'mes',
    descripcion: 'Para probar la plataforma con anuncios y límites básicos.',
    destacado: false,
    anuncios: true,
    limiteConteos: LIMITES_POR_PLAN.free.conteosMes,
    limiteUsuarios: LIMITES_POR_PLAN.free.usuariosTenant,
    almacenamiento: formatearAlmacenamiento(LIMITES_POR_PLAN.free.almacenamientoMB),
    vlm: LIMITES_POR_PLAN.free.vlmHabilitado,
    limites: LIMITES_POR_PLAN.free,
    caracteristicas: construirFeatures('free'),
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precio: 10,
    moneda: 'USD',
    periodicidad: 'mes',
    descripcion: 'Sin anuncios y con todo desbloqueado: más conteos, VLM y soporte por email.',
    destacado: true,
    anuncios: false,
    limiteConteos: LIMITES_POR_PLAN.pro.conteosMes,
    limiteUsuarios: LIMITES_POR_PLAN.pro.usuariosTenant,
    almacenamiento: formatearAlmacenamiento(LIMITES_POR_PLAN.pro.almacenamientoMB),
    vlm: LIMITES_POR_PLAN.pro.vlmHabilitado,
    limites: LIMITES_POR_PLAN.pro,
    caracteristicas: construirFeatures('pro'),
  },
];

module.exports = {
  PLANES_VALIDOS,
  LIMITES_POR_PLAN,
  CATALOGO_PLANES,
  formatearAlmacenamiento,
  formatearNumero,
};
