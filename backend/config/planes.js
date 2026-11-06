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

// Lista detallada y fidedigna de beneficios por plan según las capacidades reales del proyecto.
function construirFeatures(id) {
  const l = LIMITES_POR_PLAN[id] || LIMITES_POR_PLAN.free;
  const esPro = id === 'pro';

  return [
    { texto: 'Buzón Cloudflare Email exclusivo (@contadorganadero.com)', incluido: true },
    { texto: 'Recepción y reenvío de facturas por Bot de WhatsApp', incluido: true },
    { texto: 'Lectura oficial Hacienda v4.4 y auditoría de IVA al 1%', incluido: true },
    { texto: 'Módulo contable: IVA Cuatrimestral y Renta Anual (D-101)', incluido: l.moduloContable },
    { texto: 'Control de inventario multiespecie (bovinos, aves, peces, abejas)', incluido: true },
    { texto: 'Costos de producción por kilo y facturación electrónica REA', incluido: true },
    { texto: 'Calendario fiscal con alertas de vencimientos de Hacienda', incluido: true },
    { texto: `${formatearNumero(l.conteosMes)} conteos de ganado con IA al mes`, incluido: true },
    { texto: `Chatbot Asistente Ganadero (${formatearNumero(l.tokensChatMes)} tokens/mes)`, incluido: true },
    { texto: `${l.usuariosTenant} ${l.usuariosTenant === 1 ? 'usuario (productor)' : 'usuarios con roles (dueño, contador, peón)'}`, incluido: true },
    { texto: `${formatearAlmacenamiento(l.almacenamientoMB)} de almacenamiento para XMLs y documentos`, incluido: true },
    { texto: 'Visión artificial avanzada VLM (NVIDIA NIM)', incluido: l.vlmHabilitado },
    { texto: 'Módulo D-150 / Conciliación anual TRIBU-CR', incluido: l.moduloD150 },
    { texto: '100% libre de anuncios y publicidad', incluido: esPro },
    { texto: 'Soporte prioritario por email', incluido: esPro },
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
    descripcion: 'Gestión contable y agropecuaria completa para pequeños productores, financiada con anuncios.',
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
    descripcion: 'Sin anuncios, con módulo D-150, visión VLM, 300 conteos IA, 25 GB y acceso para tu contador.',
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
