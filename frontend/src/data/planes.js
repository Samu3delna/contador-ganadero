// Definición de respaldo (fallback) de los planes SaaS.
// La fuente de verdad está en backend/config/planes.js y se sirve por
// GET /api/onvo/planes. Si la API responde, el frontend usa ese catálogo;
// acá se mantiene copia para no romper la Landing si falla la petición.
export const PLANES = [
  {
    id: 'free',
    nombre: 'Gratis',
    precio: 0,
    moneda: 'USD',
    periodicidad: 'mes',
    descripcion: 'Para probar la plataforma con anuncios y límites básicos.',
    destacado: false,
    anuncios: true,
    limiteConteos: 10,
    limiteUsuarios: 1,
    almacenamiento: '2 GB',
    vlm: false,
    caracteristicas: [
      { texto: '10 conteos visuales IA al mes', incluido: true },
      { texto: '1 usuario', incluido: true },
      { texto: '2 GB de almacenamiento', incluido: true },
      { texto: 'Conteos por visión (VLM)', incluido: false },
      { texto: 'Módulo contable y fiscal (IVA, Renta)', incluido: true },
      { texto: 'Módulo D-150 / conciliación REA', incluido: false },
      { texto: 'Con anuncios', incluido: false },
      { texto: 'Soporte por email', incluido: false },
    ],
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
    limiteConteos: 300,
    limiteUsuarios: 3,
    almacenamiento: '25 GB',
    vlm: true,
    caracteristicas: [
      { texto: '300 conteos visuales IA al mes', incluido: true },
      { texto: '3 usuarios', incluido: true },
      { texto: '25 GB de almacenamiento', incluido: true },
      { texto: 'Conteos por visión (VLM)', incluido: true },
      { texto: 'Módulo contable y fiscal (IVA, Renta)', incluido: true },
      { texto: 'Módulo D-150 / conciliación REA', incluido: true },
      { texto: 'Sin anuncios', incluido: true },
      { texto: 'Soporte por email', incluido: true },
    ],
  },
];
