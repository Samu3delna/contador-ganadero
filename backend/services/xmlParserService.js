/**
 * Servicio de parsing de facturas electrónicas XML de Costa Rica
 * Compatible con el formato del Ministerio de Hacienda (v4.3 y v4.4)
 */

const { XMLParser } = require('fast-xml-parser');
const { codigoTarifaAPorcentaje, obtenerCuatrimestre } = require('../utils/costaRicaTax');

// Configurar parser con seguridad XXE deshabilitada
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
  // Seguridad: no procesar entidades externas
  processEntities: false,
});

/**
 * Parsear un archivo XML de factura electrónica costarricense
 * @param {string} xmlString - Contenido del archivo XML
 * @returns {object} Datos estructurados de la factura
 */
function parsearFacturaXML(xmlString) {
  try {
    const parsed = parser.parse(xmlString);

    // El nodo raíz puede ser FacturaElectronica, NotaCreditoElectronica, etc.
    const raiz =
      parsed.FacturaElectronica ||
      parsed['FacturaElectronica'] ||
      parsed.NotaCreditoElectronica ||
      parsed.NotaDebitoElectronica ||
      parsed.TiqueteElectronico ||
      // Namespace handling
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica'] ||
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica'] ||
      null;

    if (!raiz) {
      // Intentar buscar con prefijo de namespace
      const keys = Object.keys(parsed);
      const facturaKey = keys.find(k =>
        k.toLowerCase().includes('factura') ||
        k.toLowerCase().includes('nota') ||
        k.toLowerCase().includes('tiquete')
      );
      if (!facturaKey) {
        throw new Error('No se encontró un nodo raíz válido de factura electrónica');
      }
      return procesarNodoFactura(parsed[facturaKey]);
    }

    return procesarNodoFactura(raiz);
  } catch (error) {
    throw new Error(`Error parseando XML de factura: ${error.message}`);
  }
}

/**
 * Procesar el nodo principal de la factura
 */
function procesarNodoFactura(nodo) {
  const emisor = extraerEmisor(nodo.Emisor);
  const receptor = extraerReceptor(nodo.Receptor);
  const lineas = extraerLineasDetalle(nodo.DetalleServicio);
  const resumen = extraerResumen(nodo.ResumenFactura);
  const fechaEmision = nodo.FechaEmision ? new Date(nodo.FechaEmision) : new Date();

  // Determinar la tasa IVA predominante
  const tasaIVAPredominante = calcularTasaPredominante(lineas);

  return {
    claveNumerica: String(nodo.Clave || ''),
    consecutivo: String(nodo.NumeroConsecutivo || ''),
    fechaEmision,
    emisor,
    receptor,
    lineaDetalle: lineas,
    resumenFactura: resumen,
    moneda: nodo.ResumenFactura?.CodigoTipoMoneda?.CodigoMoneda || 'CRC',
    tasaIVA: tasaIVAPredominante,
    cuatrimestre: obtenerCuatrimestre(fechaEmision),
    periodoFiscal: fechaEmision.getFullYear(),
  };
}

/**
 * Extraer datos del emisor
 */
function extraerEmisor(nodoEmisor) {
  if (!nodoEmisor) return { nombre: 'Desconocido', cedula: {} };

  return {
    nombre: nodoEmisor.Nombre || 'Sin nombre',
    cedula: {
      tipo: String(nodoEmisor.Identificacion?.Tipo || ''),
      numero: String(nodoEmisor.Identificacion?.Numero || ''),
    },
    telefono: nodoEmisor.Telefono?.NumTelefono
      ? String(nodoEmisor.Telefono.NumTelefono)
      : '',
    correo: nodoEmisor.CorreoElectronico || '',
    ubicacion: [
      nodoEmisor.Ubicacion?.OtrasSenas,
    ].filter(Boolean).join(', '),
  };
}

/**
 * Extraer datos del receptor
 */
function extraerReceptor(nodoReceptor) {
  if (!nodoReceptor) return { nombre: '', cedula: {} };

  return {
    nombre: nodoReceptor.Nombre || '',
    cedula: {
      tipo: String(nodoReceptor.Identificacion?.Tipo || ''),
      numero: String(nodoReceptor.Identificacion?.Numero || ''),
    },
  };
}

/**
 * Extraer líneas de detalle
 */
function extraerLineasDetalle(nodoDetalle) {
  if (!nodoDetalle) return [];

  // Puede ser un array o un objeto único
  let lineas = nodoDetalle.LineaDetalle;
  if (!lineas) return [];
  if (!Array.isArray(lineas)) lineas = [lineas];

  return lineas.map((linea) => {
    // Extraer impuesto (puede ser array o objeto)
    let impuestoData = { codigo: '', codigoTarifa: '', tarifa: 0, monto: 0 };
    if (linea.Impuesto) {
      const imp = Array.isArray(linea.Impuesto) ? linea.Impuesto[0] : linea.Impuesto;
      const codigoTarifa = String(imp.CodigoTarifa || '08');
      impuestoData = {
        codigo: String(imp.Codigo || '01'),
        codigoTarifa,
        tarifa: codigoTarifaAPorcentaje(codigoTarifa),
        monto: Number(imp.Monto || 0),
      };
    }

    return {
      descripcion: linea.Detalle || linea.Descripcion || 'Sin descripción',
      cantidad: Number(linea.Cantidad || 1),
      unidadMedida: linea.UnidadMedida || 'Unid',
      precioUnitario: Number(linea.PrecioUnitario || 0),
      subtotal: Number(linea.SubTotal || 0),
      descuento: Number(linea.MontoDescuento || 0),
      impuesto: impuestoData,
      montoTotal: Number(linea.MontoTotalLinea || 0),
    };
  });
}

/**
 * Extraer resumen de la factura
 */
function extraerResumen(nodoResumen) {
  if (!nodoResumen) {
    return { totalVenta: 0, totalDescuentos: 0, totalImpuesto: 0, totalComprobante: 0 };
  }

  return {
    totalVenta: Number(nodoResumen.TotalVenta || 0),
    totalDescuentos: Number(nodoResumen.TotalDescuentos || 0),
    totalImpuesto: Number(nodoResumen.TotalImpuesto || 0),
    totalComprobante: Number(nodoResumen.TotalComprobante || 0),
  };
}

/**
 * Calcular la tasa de IVA predominante en la factura
 * (la tasa que representa el mayor monto de compra)
 */
function calcularTasaPredominante(lineas) {
  if (!lineas || lineas.length === 0) return 13;

  const montoPorTasa = {};
  lineas.forEach((linea) => {
    const tasa = linea.impuesto?.tarifa ?? 13;
    montoPorTasa[tasa] = (montoPorTasa[tasa] || 0) + (linea.subtotal || 0);
  });

  // Retornar la tasa con mayor monto acumulado
  let tasaPredominante = 13;
  let maxMonto = 0;
  for (const [tasa, monto] of Object.entries(montoPorTasa)) {
    if (monto > maxMonto) {
      maxMonto = monto;
      tasaPredominante = Number(tasa);
    }
  }

  return tasaPredominante;
}

module.exports = { parsearFacturaXML };
