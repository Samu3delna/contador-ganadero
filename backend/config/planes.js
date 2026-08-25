/**
 * Catálogo central de planes de ContadorGanadero.
 *
 * Tres planes (freemium con anuncios):
 *  - free  : Gratis, con anuncios web (limita conteos IA / almacenamiento / VLM).
 *  - pro   : Pago, sin anuncios, para fincas en crecimiento.
 *  - agro  : Pago, sin anuncios, para operaciones grandes / cooperativas.
 *
 * `LIMITES_POR_PLAN` es la fuente de verdad para el backend (Tenant)
 * y `CATALOGO_PLANES` es la vista pública (precio, features, anuncios).
 */

const PLANES_VALIDOS = ['free', 'pro', 'agro'];

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
  agro: {
    conteosMes: 3000,
    usuariosTenant: 10,
    almacenamientoMB: 204800, // 200 GB
    vlmHabilitado: true,
    tokensChatMes: 5000000,
    moduloContable: true,
    moduloD150: true,
    anunciosHabilitados: false,
    soporte: 'Prioritario',
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

function construirFeatures(id) {
  const l = LIMITES_POR_PLAN[id] || LIMITES_POR_PLAN.free;
  const base = [
    { texto: `${formatearNumero(l.conteosMes)} conteos visuales IA al mes`, incluido: true },
    { texto: `${l.usuariosTenant} ${l.usuariosTenant === 1 ? 'usuario' : 'usuarios'}`, incluido: true },
    { texto: `${formatearAlmacenamiento(l.almacenamientoMB)} de almacenamiento`, incluido: true },
    { texto: `${formatearNumero(l.tokensChatMes)} tokens del chat IA al mes`, incluido: true },
    { texto: 'Módulo contable y fiscal (IVA, Renta)', incluido: l.moduloContable },
    { texto: 'Módulo D-150 / conciliación REA', incluido: l.moduloD150 },
    { texto: 'Conteos por visión (VLM)', incluido: l.vlmHabilitado },
  ];

  const soporte = [
    { texto: 'Soporte por comunidad', incluido: true },
    { texto: 'Soporte por email', incluido: l.soporte === 'Email' || l.soporte === 'Prioritario' },
    { texto: 'Soporte prioritario', incluido: l.soporte === 'Prioritario' },
  ];

  return [...base, ...soporte];
}

// Catálogo público que también sirve la API /api/stripe/planes
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
    precio: 19,
    moneda: 'USD',
    periodicidad: 'mes',
    descripcion: 'Fincas en crecimiento: más conteos, VLM y sin anuncios.',
    destacado: true,
    anuncios: false,
    limiteConteos: LIMITES_POR_PLAN.pro.conteosMes,
    limiteUsuarios: LIMITES_POR_PLAN.pro.usuariosTenant,
    almacenamiento: formatearAlmacenamiento(LIMITES_POR_PLAN.pro.almacenamientoMB),
    vlm: LIMITES_POR_PLAN.pro.vlmHabilitado,
    limites: LIMITES_POR_PLAN.pro,
    caracteristicas: construirFeatures('pro'),
  },
  {
    id: 'agro',
    nombre: 'Agro',
    precio: 49,
    moneda: 'USD',
    periodicidad: 'mes',
    descripcion: 'Grandes operaciones y cooperativas con soporte prioritario.',
    destacado: false,
    anuncios: false,
    limiteConteos: LIMITES_POR_PLAN.agro.conteosMes,
    limiteUsuarios: LIMITES_POR_PLAN.agro.usuariosTenant,
    almacenamiento: formatearAlmacenamiento(LIMITES_POR_PLAN.agro.almacenamientoMB),
    vlm: LIMITES_POR_PLAN.agro.vlmHabilitado,
    limites: LIMITES_POR_PLAN.agro,
    caracteristicas: construirFeatures('agro'),
  },
];

module.exports = {
  PLANES_VALIDOS,
  LIMITES_POR_PLAN,
  CATALOGO_PLANES,
  formatearAlmacenamiento,
  formatearNumero,
};
