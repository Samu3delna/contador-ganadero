/**
 * Servicio de parsing de facturas electrónicas XML de Costa Rica
 * Compatible con el formato del Ministerio de Hacienda (v4.3 y v4.4)
 *
 * Mejoras v4.4:
 *  - Soporte para el namespace del esquema 4.4
 *  - Lectura explícita de <CodigoTarifa> en cada línea de detalle
 *  - Validación de tarifas contra catálogo de insumos agropecuarios al 1%
 *  - Generación de alertas cuando el CodigoTarifa no es el beneficio esperado
 */

const { XMLParser } = require('fast-xml-parser');
const { codigoTarifaAPorcentaje, obtenerCuatrimestre } = require('../utils/costaRicaTax');
const { validarTarifasFactura } = require('../utils/insumosAgropecuarios');

// Configurar parser con seguridad XXE deshabilitada y parseTagValue en false para preservar exactitud de cadenas
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // CRÍTICO: nunca convertir a números para evitar truncar claves de 50 dígitos o perder ceros a la izquierda
  trimValues: true,
  // Seguridad: no procesar entidades externas
  processEntities: false,
  // Forzar siempre arrays para nodos que pueden repetirse
  isArray: (name) => {
    const arrayTags = ['LineaDetalle', 'Impuesto', 'Descuento', 'OtrosCargos', 'OtroTexto', 'Exoneracion'];
    return arrayTags.includes(name);
  },
  // Manejar namespaces — remover prefijos para acceso uniforme
  removeNSPrefix: true,
});

/**
 * Parsear un archivo XML de factura electrónica costarricense
 * @param {string} xmlString - Contenido del archivo XML
 * @returns {object} Datos estructurados de la factura con validación de tarifas
 */
function parsearFacturaXML(xmlString) {
  try {
    const parsed = parser.parse(xmlString);

    // El nodo raíz puede ser FacturaElectronica, NotaCreditoElectronica, etc.
    // Con removeNSPrefix: true, ya no hay prefijos de namespace
    let rootTagName = 'FacturaElectronica';
    let raiz =
      parsed.FacturaElectronica ||
      parsed['FacturaElectronica'] ||
      parsed.NotaCreditoElectronica ||
      parsed.NotaDebitoElectronica ||
      parsed.TiqueteElectronico ||
      parsed.FacturaElectronicaCompra ||
      parsed.FacturaElectronicaExportacion ||
      parsed.ReciboElectronicoPago ||
      // Fallback: buscar con URLs de namespace (schema v4.3 / v4.4)
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica'] ||
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica'] ||
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaCreditoElectronica'] ||
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica'] ||
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/tiqueteElectronico'] ||
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico'] ||
      parsed['https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaCompra'] ||
      null;

    if (raiz) {
      for (const [nombre, val] of Object.entries(parsed)) {
        if (val === raiz) {
          rootTagName = nombre;
          break;
        }
      }
    }

    if (!raiz) {
      // Intentar buscar con prefijo de namespace genérico
      const keys = Object.keys(parsed);
      const facturaKey = keys.find(k =>
        k.toLowerCase().includes('factura') ||
        k.toLowerCase().includes('nota') ||
        k.toLowerCase().includes('tiquete') ||
        k.toLowerCase().includes('recibo')
      );
      if (!facturaKey) {
        throw new Error('No se encontró un nodo raíz válido de factura electrónica');
      }
      rootTagName = facturaKey;
      return procesarNodoFactura(parsed[facturaKey], rootTagName);
    }

    return procesarNodoFactura(raiz, rootTagName);
  } catch (error) {
    const err = new Error(`Error parseando XML de factura: ${error.message}`);
    err.cause = error;
    throw err;
  }
}

/**
 * Procesar el nodo principal de la factura
 */
function procesarNodoFactura(nodo, rootTagName = '') {
  const emisor = extraerEmisor(nodo.Emisor);
  const receptor = extraerReceptor(nodo.Receptor);
  const lineas = extraerLineasDetalle(nodo.DetalleServicio);
  const resumen = extraerResumen(nodo.ResumenFactura);
  const fechaEmision = nodo.FechaEmision ? new Date(nodo.FechaEmision) : new Date();

  // Determinar la tasa IVA predominante
  const tasaIVAPredominante = calcularTasaPredominante(lineas);

  // Detectar versión del esquema XML
  const versionEsquema = detectarVersionEsquema(nodo);

  // Tipo de documento
  const tipoDocumento = detectarTipoDocumento(nodo, rootTagName);

  // ====================================================
  // VALIDACIÓN DE TARIFAS CONTRA INSUMOS AGROPECUARIOS
  // ====================================================
  const { alertas, resumenValidacion } = validarTarifasFactura(lineas);

  return {
    claveNumerica: String(nodo.Clave || '').trim(),
    consecutivo: String(nodo.NumeroConsecutivo || '').trim(),
    fechaEmision,
    emisor,
    receptor,
    lineaDetalle: lineas,
    resumenFactura: resumen,
    moneda: nodo.ResumenFactura?.CodigoTipoMoneda?.CodigoMoneda || 'CRC',
    tipoCambio: Number(nodo.ResumenFactura?.CodigoTipoMoneda?.TipoCambio || 1),
    tasaIVA: tasaIVAPredominante,
    cuatrimestre: obtenerCuatrimestre(fechaEmision),
    periodoFiscal: fechaEmision.getFullYear(),
    // Nuevos campos v4.4
    versionEsquema,
    tipoDocumento,
    condicionVenta: nodo.CondicionVenta || '',
    medioPago: Array.isArray(nodo.MedioPago) ? nodo.MedioPago : [nodo.MedioPago].filter(Boolean),
    // Otros campos v4.4
    otrosCargos: extraerOtrosCargos(nodo.OtrosCargos),
    // Validación de tarifas agropecuarias
    alertasTarifa: alertas,
    resumenValidacionTarifa: resumenValidacion,
  };
}

/**
 * Detectar la versión del esquema XML
 */
function detectarVersionEsquema(nodo) {
  // Buscar en atributos del nodo raíz
  const xmlns = nodo['@_xmlns'] || '';
  if (xmlns.includes('4.4')) return '4.4';
  if (xmlns.includes('4.3')) return '4.3';
  if (xmlns.includes('4.2')) return '4.2';
  return 'desconocida';
}

/**
 * Detectar el tipo de documento electrónico según esquema oficial de Hacienda CR
 */
function detectarTipoDocumento(nodo, rootTagName = '') {
  // 1. Verificar por nombre de etiqueta raíz
  const tagLower = String(rootTagName).toLowerCase();
  if (tagLower.includes('notacredito')) return 'Nota de Crédito';
  if (tagLower.includes('notadebito')) return 'Nota de Débito';
  if (tagLower.includes('tiquete')) return 'Tiquete Electrónico';
  if (tagLower.includes('compra')) return 'Factura Electrónica de Compra';
  if (tagLower.includes('exportacion')) return 'Factura de Exportación';
  if (tagLower.includes('recibo') || tagLower.includes('pago')) return 'Recibo Electrónico de Pago';

  // 2. Verificar consecutivo de 20 dígitos: pos 9-10 (índices 8..10) indican el tipo
  const consecutivo = String(nodo.NumeroConsecutivo || '').trim();
  const tipos = {
    '01': 'Factura Electrónica',
    '02': 'Nota de Débito',
    '03': 'Nota de Crédito',
    '04': 'Tiquete Electrónico',
    '05': 'Factura Electrónica de Compra',
    '06': 'Factura de Exportación',
    '07': 'Recibo Electrónico de Pago',
  };

  if (consecutivo.length >= 10) {
    // Si tiene 20 dígitos o al menos 10 (sucursal 3 + terminal 5 + tipo 2)
    const tipo = consecutivo.length >= 20
      ? consecutivo.substring(8, 10)
      : consecutivo.substring(consecutivo.length - 12, consecutivo.length - 10);
    if (tipos[tipo]) return tipos[tipo];
  }

  // 3. Si se tiene clave de 50 dígitos: pos 30-31 (índices 29..31)
  const clave = String(nodo.Clave || '').trim();
  if (clave.length === 50) {
    const tipo = clave.substring(29, 31);
    if (tipos[tipo]) return tipos[tipo];
  }

  return 'Factura Electrónica';
}

/**
 * Extraer datos del emisor
 */
function extraerEmisor(nodoEmisor) {
  if (!nodoEmisor) return { nombre: 'Desconocido', cedula: {} };

  return {
    nombre: nodoEmisor.Nombre || 'Sin nombre',
    nombreComercial: nodoEmisor.NombreComercial || '',
    cedula: {
      tipo: String(nodoEmisor.Identificacion?.Tipo || ''),
      numero: String(nodoEmisor.Identificacion?.Numero || ''),
    },
    telefono: nodoEmisor.Telefono?.NumTelefono
      ? String(nodoEmisor.Telefono.NumTelefono)
      : '',
    fax: nodoEmisor.Fax?.NumTelefono
      ? String(nodoEmisor.Fax.NumTelefono)
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
    correo: nodoReceptor.CorreoElectronico || '',
  };
}

/**
 * Extraer líneas de detalle con lectura explícita de CodigoTarifa
 */
function extraerLineasDetalle(nodoDetalle) {
  if (!nodoDetalle) return [];

  // Puede ser un array o un objeto único
  let lineas = nodoDetalle.LineaDetalle;
  if (!lineas) return [];
  if (!Array.isArray(lineas)) lineas = [lineas];

  return lineas.map((linea) => {
    // =====================================================
    // LECTURA EXPLÍCITA DE <CodigoTarifa> EN IMPUESTO
    // =====================================================
    let impuestoData = { codigo: '', codigoTarifa: '', tarifa: 0, monto: 0 };
    let exoneracionData = null;

    if (linea.Impuesto) {
      // Impuesto puede ser array (isArray configurado en parser)
      const impuestos = Array.isArray(linea.Impuesto) ? linea.Impuesto : [linea.Impuesto];
      const imp = impuestos[0]; // Tomar el primer impuesto (generalmente IVA)

      // LECTURA EXPLÍCITA del CodigoTarifa
      const codigoTarifa = String(imp.CodigoTarifa || '08');
      const tarifaPorcentaje = imp.Tarifa != null
        ? Number(imp.Tarifa)
        : codigoTarifaAPorcentaje(codigoTarifa);

      impuestoData = {
        codigo: String(imp.Codigo || '01'),       // 01 = IVA
        codigoTarifa,                              // 01=Exento, 02=1%, 08=13%, etc.
        tarifa: tarifaPorcentaje,                  // Porcentaje numérico
        monto: Number(imp.Monto || 0),             // Monto del impuesto
        factorIVA: Number(imp.FactorIVA || 0),     // Campo v4.4
        montoExportacion: Number(imp.MontoExportacion || 0),
      };

      // Extraer exoneración si existe (campo v4.4)
      if (imp.Exoneracion) {
        const exon = Array.isArray(imp.Exoneracion) ? imp.Exoneracion[0] : imp.Exoneracion;
        exoneracionData = {
          tipoDocumento: String(exon.TipoDocumento || ''),
          numeroDocumento: String(exon.NumeroDocumento || ''),
          nombreInstitucion: exon.NombreInstitucion || '',
          fechaEmision: exon.FechaEmision || '',
          porcentajeExoneracion: Number(exon.PorcentajeExoneracion || 0),
          montoExoneracion: Number(exon.MontoExoneracion || 0),
        };
      }

      // Si hay múltiples impuestos, agregar el monto total
      if (impuestos.length > 1) {
        let montoTotal = 0;
        for (const i of impuestos) {
          montoTotal += Number(i.Monto || 0);
        }
        impuestoData.monto = montoTotal;
        impuestoData.impuestosAdicionales = impuestos.slice(1).map(i => ({
          codigo: String(i.Codigo || ''),
          codigoTarifa: String(i.CodigoTarifa || ''),
          tarifa: Number(i.Tarifa || codigoTarifaAPorcentaje(String(i.CodigoTarifa || '08'))),
          monto: Number(i.Monto || 0),
        }));
      }
    }

    // Código comercial del producto (v4.4)
    let codigoComercial = null;
    if (linea.CodigoComercial) {
      const cc = Array.isArray(linea.CodigoComercial) ? linea.CodigoComercial[0] : linea.CodigoComercial;
      codigoComercial = {
        tipo: String(cc.Tipo || ''),
        codigo: String(cc.Codigo || ''),
      };
    }

    // Descuentos (puede ser array en v4.4)
    let descuentoTotal = 0;
    let descripcionDescuento = '';
    if (linea.Descuento) {
      const descuentos = Array.isArray(linea.Descuento) ? linea.Descuento : [linea.Descuento];
      for (const desc of descuentos) {
        descuentoTotal += Number(desc.MontoDescuento || desc || 0);
        if (desc.NaturalezaDescuento) {
          descripcionDescuento += (descripcionDescuento ? '; ' : '') + desc.NaturalezaDescuento;
        }
      }
    }
    // Fallback para formato simple
    if (descuentoTotal === 0) {
      descuentoTotal = Number(linea.MontoDescuento || 0);
    }

    return {
      numeroLinea: Number(linea.NumeroLinea || 0),
      descripcion: linea.Detalle || linea.Descripcion || 'Sin descripción',
      cantidad: Number(linea.Cantidad || 1),
      unidadMedida: linea.UnidadMedida || 'Unid',
      unidadMedidaComercial: linea.UnidadMedidaComercial || '',
      precioUnitario: Number(linea.PrecioUnitario || 0),
      subtotal: Number(linea.SubTotal || 0),
      descuento: descuentoTotal,
      descripcionDescuento,
      baseImponible: Number(linea.BaseImponible || linea.SubTotal || 0),
      impuesto: impuestoData,
      exoneracion: exoneracionData,
      impuestoNeto: Number(linea.ImpuestoNeto || impuestoData.monto),
      montoTotal: Number(linea.MontoTotalLinea || 0),
      codigoComercial,
      partidaArancelaria: linea.PartidaArancelaria || '',
    };
  });
}

/**
 * Extraer resumen de la factura (campos v4.3 + v4.4)
 */
function extraerResumen(nodoResumen) {
  if (!nodoResumen) {
    return { totalVenta: 0, totalDescuentos: 0, totalImpuesto: 0, totalComprobante: 0 };
  }

  return {
    totalServGravados: Number(nodoResumen.TotalServGravados || 0),
    totalServExentos: Number(nodoResumen.TotalServExentos || 0),
    totalServExonerado: Number(nodoResumen.TotalServExonerado || 0),
    totalMercanciasGravadas: Number(nodoResumen.TotalMercanciasGravadas || 0),
    totalMercanciasExentas: Number(nodoResumen.TotalMercanciasExentas || 0),
    totalMercExonerada: Number(nodoResumen.TotalMercExonerada || 0),
    totalGravado: Number(nodoResumen.TotalGravado || 0),
    totalExento: Number(nodoResumen.TotalExento || 0),
    totalExonerado: Number(nodoResumen.TotalExonerado || 0),
    totalVenta: Number(nodoResumen.TotalVenta || 0),
    totalDescuentos: Number(nodoResumen.TotalDescuentos || 0),
    totalVentaNeta: Number(nodoResumen.TotalVentaNeta || 0),
    totalImpuesto: Number(nodoResumen.TotalImpuesto || 0),
    totalIVADevuelto: Number(nodoResumen.TotalIVADevuelto || 0),
    totalOtrosCargos: Number(nodoResumen.TotalOtrosCargos || 0),
    totalComprobante: Number(nodoResumen.TotalComprobante || 0),
  };
}

/**
 * Extraer otros cargos (campo v4.4)
 */
function extraerOtrosCargos(nodoOtrosCargos) {
  if (!nodoOtrosCargos) return [];
  const cargos = Array.isArray(nodoOtrosCargos) ? nodoOtrosCargos : [nodoOtrosCargos];
  return cargos.map(c => ({
    tipoDocumento: String(c.TipoDocumento || ''),
    numeroIdentificacion: String(c.NumeroIdentidadTercero || ''),
    nombreTercero: c.NombreTercero || '',
    detalle: c.Detalle || '',
    porcentaje: Number(c.Porcentaje || 0),
    monto: Number(c.MontoCargo || 0),
  }));
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
