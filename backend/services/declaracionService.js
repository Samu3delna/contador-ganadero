const { obtenerRangoFechasCuatrimestre } = require('../utils/costaRicaTax');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');

/**
 * Genera datos exportables para contador en formato CSV-friendly
 */
async function generarDatosExportacion(usuarioId, anio, cuatrimestre = null) {
  let fechaInicio, fechaFin;

  if (cuatrimestre) {
    const rango = obtenerRangoFechasCuatrimestre(cuatrimestre, anio);
    fechaInicio = rango.inicio;
    fechaFin = rango.fin;
  } else {
    fechaInicio = new Date(anio, 0, 1);
    fechaFin = new Date(anio, 11, 31, 23, 59, 59, 999);
  }

  // Obtener facturas (gastos)
  const facturas = await Factura.find({
    usuario: usuarioId,
    fechaEmision: { $gte: fechaInicio, $lte: fechaFin },
    estado: { $ne: 'error' },
  }).sort({ fechaEmision: 1 }).lean();

  // Obtener ingresos (ventas)
  const ingresos = await Ingreso.find({
    usuario: usuarioId,
    fecha: { $gte: fechaInicio, $lte: fechaFin },
  }).sort({ fecha: 1 }).lean();

  // Normalizar datos de facturas para exportar
  const gastosExportables = facturas.map(f => {
    const subtotal = f.resumenFactura?.totalVenta || 0;
    const iva = f.resumenFactura?.totalImpuesto || 0;
    const total = f.resumenFactura?.totalComprobante || 0;
    const categoria = f.categoriaManual || f.categoriaIA || 'sin_clasificar';
    return {
      tipo: 'GASTO',
      fecha: f.fechaEmision ? new Date(f.fechaEmision).toISOString().split('T')[0] : '',
      proveedor: f.emisor?.nombre || '',
      cedulaProveedor: f.emisor?.cedula?.numero || '',
      descripcion: (f.lineaDetalle || []).map(l => l.descripcion).join('; '),
      categoria,
      subtotal,
      iva,
      total,
      numComprobante: f.consecutivo || f.claveNumerica || '',
      esDeducible: f.esDeducible ? 'Sí' : 'No',
      motivoNoDeducible: f.motivoNoDeducible || '',
      tasaIVA: f.tasaIVA || 13,
    };
  });

  // Normalizar datos de ingresos para exportar
  const ingresosExportables = ingresos.map(i => {
    let categoriaNombre = 'Venta de Ganado en Pie';
    if (i.categoriaIngreso === 'venta_leche') categoriaNombre = 'Venta de Leche';
    if (i.categoriaIngreso === 'otros_ingresos') categoriaNombre = 'Otros Ingresos';

    return {
      tipo: 'INGRESO',
      fecha: i.fecha ? new Date(i.fecha).toISOString().split('T')[0] : '',
      proveedor: i.comprador?.nombre || '',
      cedulaProveedor: i.comprador?.cedula || '',
      descripcion: i.descripcion || '',
      categoria: categoriaNombre,
      subtotal: i.montoSubtotal || 0,
      iva: i.ivaVenta || 0,
      total: i.montoTotal || 0,
      numComprobante: i.facturaElectronica?.numero || i.facturaElectronica?.claveNumerica || '',
      esDeducible: 'N/A',
      motivoNoDeducible: '',
      tasaIVA: i.tasaIVA || 0,
    };
  });

  return [...gastosExportables, ...ingresosExportables];
}

/**
 * Genera un archivo CSV como string
 */
function generarCSV(datos) {
  if (datos.length === 0) return '';

  const COLUMNAS = [
    { header: 'Tipo', key: 'tipo' },
    { header: 'Fecha', key: 'fecha' },
    { header: 'Proveedor/Comprador', key: 'proveedor' },
    { header: 'Cedula', key: 'cedulaProveedor' },
    { header: 'Descripcion', key: 'descripcion' },
    { header: 'Categoria', key: 'categoria' },
    { header: 'Subtotal', key: 'subtotal' },
    { header: 'IVA', key: 'iva' },
    { header: 'Total', key: 'total' },
    { header: 'NumComprobante', key: 'numComprobante' },
    { header: 'EsDeducible', key: 'esDeducible' },
    { header: 'MotivoNoDeducible', key: 'motivoNoDeducible' },
    { header: 'TasaIVA', key: 'tasaIVA' },
  ];

  const encabezados = COLUMNAS.map(c => c.header);

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const filas = datos.map(d => COLUMNAS.map(c => escapeCsv(d[c.key])).join(','));

  return [encabezados.join(','), ...filas].join('\n');
}

module.exports = {
  generarDatosExportacion,
  generarCSV,
};
