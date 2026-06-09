/**
 * Catálogo de insumos agropecuarios con tarifa reducida de IVA (1%)
 * según la Ley del Impuesto al Valor Agregado de Costa Rica.
 *
 * Los productores inscritos ante el MAG gozan de tarifa reducida del 1%
 * en insumos para actividades agropecuarias de canasta básica.
 *
 * Referencia: Ley N° 9635, Título I, Capítulo III, Artículo 11, inciso c)
 * y su Reglamento (Decreto Ejecutivo N° 41779-H)
 */

// ============================================================
// LISTA DE PALABRAS CLAVE DE INSUMOS AGROPECUARIOS AL 1%
// Organizadas por categoría para matching semántico
// ============================================================

const INSUMOS_AGROPECUARIOS_1_PORCIENTO = {
  // === ALIMENTACIÓN ANIMAL ===
  alimentacion_animal: [
    'concentrado', 'alimento para ganado', 'alimento para bovino',
    'alimento para ternero', 'alimento para vaca', 'alimento para cerdo',
    'alimento para pollo', 'alimento para aves', 'alimento para caballo',
    'alimento para equino', 'alimento para ovino', 'alimento para caprino',
    'alimento para pez', 'alimento para tilapia', 'alimento para peces',
    'alimento balanceado', 'harina de soya', 'harina de maíz',
    'melaza', 'semolina', 'afrecho', 'salvado',
    'sal mineral', 'sales minerales', 'bloque mineral',
    'suplemento mineral', 'suplemento vitamínico', 'premezcla mineral',
    'paca de heno', 'heno', 'pacas', 'ensilaje', 'silo', 'silopaca',
    'forraje', 'pasto', 'semilla de pasto',
    'maíz', 'soya', 'sorgo', 'yuca',
    'suero', 'suero de leche',
  ],

  // === PRODUCTOS VETERINARIOS Y MEDICAMENTOS PECUARIOS ===
  veterinaria: [
    'vacuna', 'vacunas', 'desparasitante', 'antiparasitario',
    'ivermectina', 'albendazol', 'fenbendazol', 'levamisol',
    'antibiótico', 'penicilina', 'oxitetraciclina', 'enrofloxacina',
    'amoxicilina', 'gentamicina', 'sulfadiazina',
    'vitamina', 'complejo vitamínico', 'vitamina ad3e',
    'reconstituyente', 'hierro', 'calcio inyectable',
    'garrapaticida', 'insecticida veterinario', 'antiséptico',
    'cicatrizante', 'matamosca', 'repelente',
    'jeringa veterinaria', 'aguja veterinaria',
    'suero fisiológico veterinario',
    'oxitocina', 'prostaglandina',
    'anestésico veterinario', 'antiinflamatorio veterinario',
    'dexametasona', 'flunixin', 'meloxicam',
    'baño garrapaticida', 'pour on',
  ],

  // === FERTILIZANTES Y AGROQUÍMICOS ===
  fertilizantes: [
    'fertilizante', 'abono', 'urea', 'nitrato de amonio',
    'fórmula completa', 'fórmula 10-30-10', 'fórmula 12-24-12',
    'fórmula 18-5-15', 'fórmula 15-3-31', 'fórmula 20-20-20',
    'sulfato de amonio', 'cloruro de potasio', 'fosfato',
    'cal agrícola', 'cal dolomita', 'enmienda',
    'herbicida', 'glifosato', 'paraquat', '2,4-d', 'atrazina',
    'insecticida agrícola', 'fungicida', 'mancozeb',
    'nematicida', 'raticida', 'rodenticida',
    'coadyuvante', 'adherente', 'surfactante',
    'bioestimulante', 'regulador de crecimiento',
    'abono orgánico', 'compost', 'humus', 'lombricompost',
    'microorganismos eficientes',
  ],

  // === SEMILLAS Y MATERIAL REPRODUCTIVO ===
  semillas: [
    'semilla', 'semillas', 'semilla certificada',
    'semilla de pasto', 'semilla de maíz', 'semilla de frijol',
    'semilla de arroz', 'semilla de sorgo',
    'plántula', 'almácigo', 'estaca',
    'semen bovino', 'pajuela', 'nitrógeno líquido',
    'termo de nitrógeno', 'tanque de nitrógeno',
    'embrión bovino',
  ],

  // === MAQUINARIA Y EQUIPO AGROPECUARIO ===
  equipo: [
    'motoguadaña', 'motosierra', 'bomba de espalda',
    'bomba de mochila', 'fumigadora', 'aspersora',
    'picadora de pasto', 'molino de pasto',
    'ordeñadora', 'equipo de ordeño', 'tanque de enfriamiento',
    'bebedero', 'comedero', 'saladero',
    'báscula ganadera', 'manga ganadera', 'cepo',
    'carreta agrícola', 'arado', 'rastra',
    'guadaña', 'machete',
    'alambre de púas', 'alambre liso', 'alambre navaja',
    'poste', 'postes', 'grapas para cerca',
    'portillo', 'tranquera',
    'manguera agrícola', 'tubo pvc agrícola',
    'plástico para silo', 'lona para silo',
  ],

  // === PRODUCTOS LÁCTEOS (insumos de procesamiento) ===
  lacteos: [
    'cuajo', 'cultivo láctico', 'cloruro de calcio',
    'colorante para queso', 'sal para queso',
    'bolsa para queso', 'molde para queso',
    'tina de queso', 'tanque de leche',
  ],

  // === COMBUSTIBLES AGRÍCOLAS ===
  combustibles: [
    'diesel agrícola', 'gasolina agrícola',
    'gas lp agrícola',
  ],
};

/**
 * Verificar si un producto es un insumo agropecuario que debería tener tarifa reducida (1%)
 * @param {string} descripcionProducto - Descripción del producto de la línea de detalle
 * @returns {{ esInsumoAgropecuario: boolean, coincidencias: string[], categoriaInsumo: string }}
 */
function verificarInsumoAgropecuario(descripcionProducto) {
  if (!descripcionProducto) {
    return { esInsumoAgropecuario: false, coincidencias: [], categoriaInsumo: '' };
  }

  const descripcionNorm = descripcionProducto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const coincidencias = [];
  let categoriaInsumo = '';

  for (const [categoria, keywords] of Object.entries(INSUMOS_AGROPECUARIOS_1_PORCIENTO)) {
    for (const keyword of keywords) {
      const keywordNorm = keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (descripcionNorm.includes(keywordNorm)) {
        coincidencias.push(keyword);
        if (!categoriaInsumo) categoriaInsumo = categoria;
      }
    }
  }

  return {
    esInsumoAgropecuario: coincidencias.length > 0,
    coincidencias,
    categoriaInsumo,
  };
}

/**
 * Validar la tarifa de una línea de detalle contra la lista de insumos
 * @param {object} linea - Línea de detalle parseada
 * @returns {object} Resultado de la validación con alerta si aplica
 */
function validarTarifaLinea(linea) {
  const { esInsumoAgropecuario, coincidencias, categoriaInsumo } =
    verificarInsumoAgropecuario(linea.descripcion);

  const codigoTarifa = linea.impuesto?.codigoTarifa || '08';
  const tarifaPorcentaje = linea.impuesto?.tarifa ?? 13;

  // Si es insumo agropecuario pero tiene tarifa general (08 = 13%)
  if (esInsumoAgropecuario && codigoTarifa === '08') {
    return {
      tieneAlerta: true,
      tipoAlerta: 'tarifa_incorrecta',
      severidad: 'error',
      mensaje: `⚠️ ALERTA TARIFA: "${linea.descripcion}" es un insumo agropecuario que debería pagar 1% (código 02), pero la factura cobra 13% (código 08). Estás pagando de más.`,
      descripcion: linea.descripcion,
      codigoTarifaActual: codigoTarifa,
      codigoTarifaEsperado: '02',
      tarifaActual: tarifaPorcentaje,
      tarifaEsperada: 1,
      diferenciaIVA: linea.subtotal ? Math.round(linea.subtotal * 0.12) : 0,
      categoriaInsumo,
      coincidencias,
    };
  }

  // Si es insumo agropecuario y tiene tarifa correcta (01=exento o 02=1%)
  if (esInsumoAgropecuario && (codigoTarifa === '01' || codigoTarifa === '02')) {
    return {
      tieneAlerta: false,
      tipoAlerta: 'tarifa_correcta',
      severidad: 'ok',
      mensaje: `✅ "${linea.descripcion}" está con tarifa correcta (${tarifaPorcentaje}%).`,
      descripcion: linea.descripcion,
      codigoTarifaActual: codigoTarifa,
      tarifaActual: tarifaPorcentaje,
      categoriaInsumo,
      coincidencias,
    };
  }

  // Si NO es insumo agropecuario conocido pero tiene tarifa reducida
  if (!esInsumoAgropecuario && (codigoTarifa === '01' || codigoTarifa === '02')) {
    return {
      tieneAlerta: true,
      tipoAlerta: 'tarifa_sospechosa',
      severidad: 'advertencia',
      mensaje: `🔍 "${linea.descripcion}" tiene tarifa reducida (${tarifaPorcentaje}%) pero no se reconoce como insumo agropecuario. Verifique manualmente.`,
      descripcion: linea.descripcion,
      codigoTarifaActual: codigoTarifa,
      tarifaActual: tarifaPorcentaje,
    };
  }

  // Sin alerta relevante
  return {
    tieneAlerta: false,
    tipoAlerta: 'normal',
    severidad: 'ok',
    descripcion: linea.descripcion,
    codigoTarifaActual: codigoTarifa,
    tarifaActual: tarifaPorcentaje,
  };
}

/**
 * Validar todas las líneas de una factura
 * @param {Array} lineas - Líneas de detalle de la factura
 * @returns {{ alertas: Array, resumenValidacion: object }}
 */
function validarTarifasFactura(lineas) {
  if (!lineas || lineas.length === 0) {
    return { alertas: [], resumenValidacion: { totalLineas: 0, alertasError: 0, alertasAdvertencia: 0, lineasOk: 0, ahorrosPerdidos: 0 } };
  }

  const resultados = lineas.map(validarTarifaLinea);
  const alertas = resultados.filter(r => r.tieneAlerta);
  const alertasError = alertas.filter(a => a.severidad === 'error');
  const alertasAdvertencia = alertas.filter(a => a.severidad === 'advertencia');
  const ahorrosPerdidos = alertasError.reduce((sum, a) => sum + (a.diferenciaIVA || 0), 0);

  return {
    alertas,
    resumenValidacion: {
      totalLineas: lineas.length,
      alertasError: alertasError.length,
      alertasAdvertencia: alertasAdvertencia.length,
      lineasOk: resultados.filter(r => !r.tieneAlerta).length,
      ahorrosPerdidos,
    },
  };
}

module.exports = {
  INSUMOS_AGROPECUARIOS_1_PORCIENTO,
  verificarInsumoAgropecuario,
  validarTarifaLinea,
  validarTarifasFactura,
};
