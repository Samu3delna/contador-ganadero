export const SITE_ORIGIN = 'https://contadorganadero.com';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;
export const DEFAULT_KEYWORDS =
  'contadorganadero.com, contador ganadero, contador ganadera, contabilidad ganadera Costa Rica, contabilidad agropecuaria Costa Rica, Régimen Especial Agropecuario REA, facturas XML Hacienda Costa Rica, inventario ganadero, costos de producción ganadera';

export const SEO_ROUTES = Object.freeze({
  '/': {
    title: 'ContadorGanadero (contadorganadero.com) | Contador Ganadero y Contabilidad Ganadera en Costa Rica (REA)',
    description:
      'ContadorGanadero (contadorganadero.com): contador ganadero y contabilidad ganadera en Costa Rica. Gestiona ingresos, gastos, facturas XML, inventario e impuestos REA.',
  },
  '/producto': {
    title: 'Producto y Herramientas de Contabilidad Ganadera | ContadorGanadero (contadorganadero.com)',
    description:
      'Herramientas de ContadorGanadero (contadorganadero.com): dashboard financiero, facturas XML, ingresos, gastos, inventario, costos e impuestos REA en Costa Rica.',
  },
  '/producto/dashboard': {
    title: 'Dashboard Financiero para Fincas y Ganadería | ContadorGanadero',
    description:
      'Explora el dashboard financiero de ContadorGanadero: resumen de ingresos, gastos, IVA cuatrimestral, utilidad neta y tendencias mensuales para tu finca en Costa Rica.',
  },
  '/producto/facturas': {
    title: 'Gestión de Facturas Electrónicas XML en Costa Rica | ContadorGanadero',
    description:
      'Organiza y consulta tus comprobantes electrónicos XML v4.4 de Hacienda Costa Rica con tu contador ganadero digital en contadorganadero.com.',
  },
  '/producto/ingresos': {
    title: 'Registro de Ingresos y Ventas de Ganado | ContadorGanadero',
    description:
      'Registra ventas de ganado y conserva el contexto de cada operación con ContadorGanadero, la plataforma de contabilidad ganadera para Costa Rica.',
  },
  '/producto/gastos': {
    title: 'Control y Clasificación de Gastos Agropecuarios | ContadorGanadero',
    description:
      'Clasifica compras de alimentos, medicamentos e insumos agropecuarios para analizar en qué se invierten los recursos de tu finca en Costa Rica.',
  },
  '/producto/inventario': {
    title: 'Inventario de Ganado Bovino, Aves, Peces y Colmenas | ContadorGanadero',
    description:
      'Administra el inventario multiespecie de tu finca en Costa Rica: fichas de ganado bovino, lotes de aves, estanques de peces y colmenas.',
  },
  '/producto/costos': {
    title: 'Costos de Producción Ganadera y Agropecuaria | ContadorGanadero',
    description:
      'Calcula y consulta indicadores de costos de producción por kilogramo, litro o cartón para evaluar el margen operativo de tu actividad agropecuaria.',
  },
  '/producto/impuestos': {
    title: 'Impuestos del Régimen Especial Agropecuario (REA) Costa Rica | ContadorGanadero',
    description:
      'Organiza tu información financiera y consulta estimaciones de IVA cuatrimestral (D-135-1) y Renta anual (D-101) en Costa Rica.',
  },
  '/tutoriales': {
    title: 'Tutoriales Paso a Paso de Contabilidad Ganadera | ContadorGanadero',
    description:
      'Aprende a utilizar ContadorGanadero (contadorganadero.com) con guías paso a paso sobre el dashboard, facturas XML, ingresos, inventario y costos de producción.',
  },
  '/academia': {
    title: 'Academia de Administración y Contabilidad Ganadera en Costa Rica | ContadorGanadero',
    description:
      'Guías prácticas de contabilidad ganadera y agropecuaria para productores de Costa Rica: organización de ingresos, gastos, facturas XML, costos, inventario y obligaciones REA.',
  },
  '/precios': {
    title: 'Planes y Precios (Gratis y Pro) | ContadorGanadero (contadorganadero.com)',
    description:
      'Conoce los planes Gratis ($0) y Pro ($10 USD/mes) de ContadorGanadero para administrar la contabilidad ganadera y productiva de tu finca en Costa Rica.',
  },
  '/soluciones': {
    title: 'Soluciones para Productores Ganaderos y Contadores en Costa Rica | ContadorGanadero',
    description:
      'Soluciones de contabilidad ganadera, control agropecuario y organización de comprobantes para ganaderos, productores y profesionales contables en Costa Rica.',
  },
  '/preguntas-frecuentes': {
    title: 'Preguntas Frecuentes sobre Contabilidad Ganadera y REA | ContadorGanadero',
    description:
      'Resuelve tus dudas sobre cómo funciona ContadorGanadero (contadorganadero.com), planes Gratis y Pro, inventario multiespecie e impuestos REA en Costa Rica.',
  },
  '/contacto': {
    title: 'Contacto y Soporte en Costa Rica | ContadorGanadero (contadorganadero.com)',
    description:
      'Comunícate con el equipo de soporte de ContadorGanadero (soporte@contadorganadero.com) para consultas sobre el producto, planes o ayuda con tu cuenta.',
  },
  '/privacidad': {
    title: 'Política de Privacidad | ContadorGanadero Costa Rica',
    description:
      'Política de privacidad y protección de datos personales y agropecuarios conforme a la Ley 8968 de Costa Rica en ContadorGanadero (contadorganadero.com).',
  },
  '/terminos': {
    title: 'Términos y Condiciones | ContadorGanadero Costa Rica',
    description:
      'Términos y condiciones de uso de la plataforma ContadorGanadero (contadorganadero.com) para productores agropecuarios en Costa Rica.',
  },
  '/condiciones-servicio': {
    title: 'Condiciones del Servicio (SLA y Planes) | ContadorGanadero Costa Rica',
    description:
      'Condiciones operativas de servicio, planes Gratis y Pro, pagos e integraciones de ContadorGanadero (contadorganadero.com) en Costa Rica.',
  },
  '/eliminacion-datos': {
    title: 'Eliminación de Datos de Usuario | ContadorGanadero Costa Rica',
    description:
      'Centro de solicitud y seguimiento de eliminación de datos personales conforme a la Ley 8968 de Costa Rica en ContadorGanadero (contadorganadero.com).',
  },
});

export function resolvePageSeo(pathname, doc) {
  const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const entry = SEO_ROUTES[cleanPath];
  const heading = doc?.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
  const missing = /no encontrad|no existe|404/i.test(heading || '');
  const isDynamicArticle = /^\/(academia|tutoriales)\/[^/]+$/.test(cleanPath);
  const isPublic = (Boolean(entry) || isDynamicArticle) && !missing;

  const fallbackLead =
    doc
      ?.querySelector('main p.cg-lead, main .cg-prose p, main header p:not(.cg-kicker):not(.cg-note)')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ||
    'ContadorGanadero (contadorganadero.com): contador ganadero y plataforma de contabilidad ganadera y agropecuaria para productores de Costa Rica.';

  const title = entry?.title || (heading ? `${heading} | ContadorGanadero (contadorganadero.com)` : 'ContadorGanadero | Contador Ganadero en Costa Rica');
  const description = (entry?.description || fallbackLead).slice(0, 170);

  return {
    cleanPath,
    title,
    description,
    isPublic,
    canonical: `${SITE_ORIGIN}${cleanPath}`,
    ogType: cleanPath.startsWith('/academia/') ? 'article' : 'website',
    image: DEFAULT_OG_IMAGE,
    keywords: DEFAULT_KEYWORDS,
  };
}
