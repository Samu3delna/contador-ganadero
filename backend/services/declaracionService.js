const ExcelJS = require('exceljs');
const { obtenerRangoFechasCuatrimestre } = require('../utils/costaRicaTax');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');

/**
 * Genera datos exportables para contador en formato CSV y Excel
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
    const consecutivo = String(f.consecutivo || '').trim();
    const claveNumerica = String(f.claveNumerica || '').trim();

    return {
      tipo: 'GASTO',
      fecha: f.fechaEmision ? new Date(f.fechaEmision).toISOString().split('T')[0] : '',
      proveedor: f.emisor?.nombre || '',
      cedulaProveedor: f.emisor?.cedula?.numero ? String(f.emisor.cedula.numero).trim() : '',
      descripcion: (f.lineaDetalle || []).map(l => l.descripcion).join('; '),
      categoria,
      subtotal,
      iva,
      total,
      consecutivo,
      claveNumerica,
      numComprobante: consecutivo || claveNumerica || '',
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

    const consecutivo = String(i.facturaElectronica?.numero || '').trim();
    const claveNumerica = String(i.facturaElectronica?.claveNumerica || '').trim();

    return {
      tipo: 'INGRESO',
      fecha: i.fecha ? new Date(i.fecha).toISOString().split('T')[0] : '',
      proveedor: i.comprador?.nombre || '',
      cedulaProveedor: i.comprador?.cedula ? String(i.comprador.cedula).trim() : '',
      descripcion: i.descripcion || '',
      categoria: categoriaNombre,
      subtotal: i.montoSubtotal || 0,
      iva: i.ivaVenta || 0,
      total: i.montoTotal || 0,
      consecutivo,
      claveNumerica,
      numComprobante: consecutivo || claveNumerica || '',
      esDeducible: 'N/A',
      motivoNoDeducible: '',
      tasaIVA: i.tasaIVA || 0,
    };
  });

  return [...gastosExportables, ...ingresosExportables];
}

/**
 * Genera un libro de Excel (.xlsx) profesional, multihuela y con formato contable de primer nivel
 */
async function generarExcel(datos, periodoInfo = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Contador IA Ganadero';
  wb.lastModifiedBy = 'Contador IA Ganadero';
  wb.created = new Date();
  wb.modified = new Date();

  const usuario = periodoInfo.usuario || {};
  const nombreContribuyente = usuario.nombreFinca || usuario.nombre || 'Productor Ganadero';
  const cedulaContribuyente = usuario.cedula?.numero ? String(usuario.cedula.numero).trim() : 'No especificada';
  const periodoTexto = periodoInfo.cuatrimestre 
    ? `Cuatrimestre ${periodoInfo.cuatrimestre} - Año ${periodoInfo.anio}`
    : `Año Fiscal ${periodoInfo.anio || new Date().getFullYear()}`;

  // =========================================================================
  // HOJA 1: RESUMEN CONTABLE Y TRIBUTARIO
  // =========================================================================
  const wsResumen = wb.addWorksheet('Resumen Contable', {
    views: [{ showGridLines: true }],
  });

  // Estilos y paleta de colores
  const COLOR_PRIMARIO = '1B4332'; // Verde bosque oscuro
  const COLOR_SECUNDARIO = '2D6A4F';
  const COLOR_GRIS_FONDO = 'F8FAFC';
  const COLOR_BORDE = 'E2E8F0';

  const bordeFino = {
    top: { style: 'thin', color: { argb: 'FF' + COLOR_BORDE } },
    left: { style: 'thin', color: { argb: 'FF' + COLOR_BORDE } },
    bottom: { style: 'thin', color: { argb: 'FF' + COLOR_BORDE } },
    right: { style: 'thin', color: { argb: 'FF' + COLOR_BORDE } },
  };

  const bordeDobleInferior = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } },
  };

  // Anchos de columnas en Hoja Resumen
  wsResumen.columns = [
    { width: 4 },  // A (margen)
    { width: 32 }, // B (Categoría / Concepto)
    { width: 18 }, // C (Comprobantes)
    { width: 22 }, // D (Subtotal)
    { width: 20 }, // E (IVA)
    { width: 22 }, // F (Total)
    { width: 16 }, // G (% del Gasto)
  ];

  // Banner superior
  wsResumen.mergeCells('B2:G2');
  const celdaTitulo = wsResumen.getCell('B2');
  celdaTitulo.value = 'SISTEMA CONTABLE GANADERO - REPORTE FISCAL Y TRIBUTARIO';
  celdaTitulo.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
  celdaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_PRIMARIO } };
  celdaTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(2).height = 32;

  // Datos del contribuyente y período
  wsResumen.getCell('B4').value = 'Contribuyente / Finca:';
  wsResumen.getCell('B4').font = { bold: true, color: { argb: 'FF475569' } };
  wsResumen.getCell('C4').value = nombreContribuyente;
  wsResumen.getCell('C4').font = { bold: true, color: { argb: 'FF0F172A' } };

  wsResumen.getCell('E4').value = 'Cédula / Identificación:';
  wsResumen.getCell('E4').font = { bold: true, color: { argb: 'FF475569' } };
  wsResumen.getCell('F4').value = cedulaContribuyente;
  wsResumen.getCell('F4').numFmt = '@';
  wsResumen.getCell('F4').font = { bold: true, color: { argb: 'FF0F172A' } };

  wsResumen.getCell('B5').value = 'Período Liquidado:';
  wsResumen.getCell('B5').font = { bold: true, color: { argb: 'FF475569' } };
  wsResumen.getCell('C5').value = periodoTexto;

  wsResumen.getCell('E5').value = 'Fecha de Emisión:';
  wsResumen.getCell('E5').font = { bold: true, color: { argb: 'FF475569' } };
  wsResumen.getCell('F5').value = new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });

  // Cálculos de totales generales
  const ingresos = datos.filter(d => d.tipo === 'INGRESO');
  const gastos = datos.filter(d => d.tipo === 'GASTO');
  const gastosDeducibles = gastos.filter(g => g.esDeducible === 'Sí');

  const totalVentas = ingresos.reduce((s, d) => s + Number(d.subtotal || 0), 0);
  const totalIvaDebito = ingresos.reduce((s, d) => s + Number(d.iva || 0), 0);
  const totalGastosDed = gastosDeducibles.reduce((s, d) => s + Number(d.subtotal || 0), 0);
  const totalIvaCredito = gastosDeducibles.reduce((s, d) => s + Number(d.iva || 0), 0);
  const balanceIva = totalIvaDebito - totalIvaCredito;
  const utilidadOperativa = totalVentas - totalGastosDed;

  // Tarjetas KPI en fila 7 y 8
  const kpis = [
    { col: 'B', titulo: 'Ingresos / Ventas Brutas', valor: totalVentas, color: '166534', bg: 'DCFCE7' },
    { col: 'C', titulo: 'Gastos Deducibles', valor: totalGastosDed, color: '1E40AF', bg: 'DBEAFE' },
    { col: 'D', titulo: 'IVA Crédito (Soportado)', valor: totalIvaCredito, color: '0369A1', bg: 'E0F2FE' },
    { col: 'E', titulo: 'IVA Débito (Cobrado)', valor: totalIvaDebito, color: 'B45309', bg: 'FEF3C7' },
    { col: 'F', titulo: balanceIva >= 0 ? 'IVA Estimado a Pagar' : 'Saldo IVA a Favor', valor: Math.abs(balanceIva), color: balanceIva >= 0 ? '991B1B' : '15803D', bg: balanceIva >= 0 ? 'FEE2E2' : 'D1FAE5' },
    { col: 'G', titulo: 'Utilidad Operativa', valor: utilidadOperativa, color: utilidadOperativa >= 0 ? '166534' : '991B1B', bg: 'F1F5F9' },
  ];

  kpis.forEach(k => {
    const celdaHeader = wsResumen.getCell(`${k.col}7`);
    celdaHeader.value = k.titulo;
    celdaHeader.font = { bold: true, size: 9, color: { argb: 'FF' + k.color } };
    celdaHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + k.bg } };
    celdaHeader.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celdaHeader.border = bordeFino;

    const celdaValor = wsResumen.getCell(`${k.col}8`);
    celdaValor.value = Number(k.valor);
    celdaValor.numFmt = '₡#,##0.00';
    celdaValor.font = { bold: true, size: 11, color: { argb: 'FF' + k.color } };
    celdaValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + k.bg } };
    celdaValor.alignment = { horizontal: 'center', vertical: 'middle' };
    celdaValor.border = bordeFino;
  });
  wsResumen.getRow(7).height = 24;
  wsResumen.getRow(8).height = 28;

  // Tabla Resumen de Gastos por Categoría
  wsResumen.getCell('B10').value = 'DESGLOSE DE GASTOS Y COMPRAS POR CATEGORÍA';
  wsResumen.getCell('B10').font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };

  const cabecerasCat = ['Categoría', 'Comprobantes', 'Subtotal (₡)', 'IVA (₡)', 'Total (₡)', '% del Gasto'];
  const filaCabCat = wsResumen.getRow(11);
  cabecerasCat.forEach((c, i) => {
    const colLetra = ['B', 'C', 'D', 'E', 'F', 'G'][i];
    const celda = wsResumen.getCell(`${colLetra}11`);
    celda.value = c;
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_SECUNDARIO } };
    celda.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
  });
  filaCabCat.height = 24;

  // Agrupar gastos por categoría
  const categoriasMap = {};
  gastos.forEach(g => {
    const cat = g.categoria || 'sin_clasificar';
    if (!categoriasMap[cat]) {
      categoriasMap[cat] = { count: 0, subtotal: 0, iva: 0, total: 0 };
    }
    categoriasMap[cat].count += 1;
    categoriasMap[cat].subtotal += Number(g.subtotal || 0);
    categoriasMap[cat].iva += Number(g.iva || 0);
    categoriasMap[cat].total += Number(g.total || 0);
  });

  const totalGastosTodos = gastos.reduce((s, g) => s + Number(g.total || 0), 0);
  let filaActualCat = 12;

  Object.entries(categoriasMap).sort((a, b) => b[1].total - a[1].total).forEach(([catNombre, val], idx) => {
    const row = wsResumen.getRow(filaActualCat);
    const bgRow = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    const celdaB = row.getCell(2);
    celdaB.value = catNombre.replace(/_/g, ' ').toUpperCase();
    celdaB.border = bordeFino;
    celdaB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };

    const celdaC = row.getCell(3);
    celdaC.value = val.count;
    celdaC.alignment = { horizontal: 'center' };
    celdaC.border = bordeFino;
    celdaC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };

    const celdaD = row.getCell(4);
    celdaD.value = val.subtotal;
    celdaD.numFmt = '₡#,##0.00';
    celdaD.border = bordeFino;
    celdaD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };

    const celdaE = row.getCell(5);
    celdaE.value = val.iva;
    celdaE.numFmt = '₡#,##0.00';
    celdaE.border = bordeFino;
    celdaE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };

    const celdaF = row.getCell(6);
    celdaF.value = val.total;
    celdaF.numFmt = '₡#,##0.00';
    celdaF.border = bordeFino;
    celdaF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };

    const celdaG = row.getCell(7);
    celdaG.value = totalGastosTodos > 0 ? val.total / totalGastosTodos : 0;
    celdaG.numFmt = '0.0%';
    celdaG.alignment = { horizontal: 'center' };
    celdaG.border = bordeFino;
    celdaG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };

    row.height = 20;
    filaActualCat++;
  });

  // Fila de Total Categorías
  const filaTotalCat = wsResumen.getRow(filaActualCat);
  filaTotalCat.getCell(2).value = 'TOTAL GASTOS Y COMPRAS';
  filaTotalCat.getCell(2).font = { bold: true };
  filaTotalCat.getCell(2).border = bordeDobleInferior;

  filaTotalCat.getCell(3).value = { formula: `SUM(C12:C${filaActualCat - 1})`, result: gastos.length };
  filaTotalCat.getCell(3).font = { bold: true };
  filaTotalCat.getCell(3).alignment = { horizontal: 'center' };
  filaTotalCat.getCell(3).border = bordeDobleInferior;

  filaTotalCat.getCell(4).value = { formula: `SUM(D12:D${filaActualCat - 1})`, result: gastos.reduce((s, g) => s + g.subtotal, 0) };
  filaTotalCat.getCell(4).font = { bold: true };
  filaTotalCat.getCell(4).numFmt = '₡#,##0.00';
  filaTotalCat.getCell(4).border = bordeDobleInferior;

  filaTotalCat.getCell(5).value = { formula: `SUM(E12:E${filaActualCat - 1})`, result: gastos.reduce((s, g) => s + g.iva, 0) };
  filaTotalCat.getCell(5).font = { bold: true };
  filaTotalCat.getCell(5).numFmt = '₡#,##0.00';
  filaTotalCat.getCell(5).border = bordeDobleInferior;

  filaTotalCat.getCell(6).value = { formula: `SUM(F12:F${filaActualCat - 1})`, result: totalGastosTodos };
  filaTotalCat.getCell(6).font = { bold: true };
  filaTotalCat.getCell(6).numFmt = '₡#,##0.00';
  filaTotalCat.getCell(6).border = bordeDobleInferior;

  filaTotalCat.getCell(7).value = 1.0;
  filaTotalCat.getCell(7).font = { bold: true };
  filaTotalCat.getCell(7).numFmt = '0.0%';
  filaTotalCat.getCell(7).alignment = { horizontal: 'center' };
  filaTotalCat.getCell(7).border = bordeDobleInferior;
  filaTotalCat.height = 24;

  // =========================================================================
  // HOJA 2: GUÍA OFICIAL TRIBU-CR - FORMULARIO 150 (PASO A PASO)
  // =========================================================================
  const wsTribu = wb.addWorksheet('Guía TRIBU-CR Formulario 150', {
    views: [{ showGridLines: true }],
  });

  wsTribu.columns = [
    { width: 4 },  // A margen
    { width: 38 }, // B Sección / Casilla TRIBU-CR
    { width: 14 }, // C Docs
    { width: 24 }, // D Total Importe (Base)
    { width: 22 }, // E Impuesto
    { width: 18 }, // F Extra
  ];

  // Banner
  wsTribu.mergeCells('B2:E2');
  const celdaTitTr = wsTribu.getCell('B2');
  celdaTitTr.value = 'GUÍA OFICIAL PARA DECLARAR EN TRIBU-CR - FORMULARIO 150 (IVA)';
  celdaTitTr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  celdaTitTr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_PRIMARIO } };
  celdaTitTr.alignment = { vertical: 'middle', horizontal: 'center' };
  wsTribu.getRow(2).height = 28;

  wsTribu.getCell('B4').value = 'Contribuyente:';
  wsTribu.getCell('B4').font = { bold: true, color: { argb: 'FF475569' } };
  wsTribu.getCell('C4').value = nombreContribuyente;
  wsTribu.getCell('C4').font = { bold: true };

  wsTribu.getCell('D4').value = 'Cédula:';
  wsTribu.getCell('D4').font = { bold: true, color: { argb: 'FF475569' } };
  wsTribu.getCell('E4').value = cedulaContribuyente;
  wsTribu.getCell('E4').numFmt = '@';
  wsTribu.getCell('E4').font = { bold: true };

  wsTribu.getCell('B5').value = 'Período:';
  wsTribu.getCell('B5').font = { bold: true, color: { argb: 'FF475569' } };
  wsTribu.getCell('C5').value = periodoTexto;

  wsTribu.getCell('D5').value = 'Portal Oficial:';
  wsTribu.getCell('D5').font = { bold: true, color: { argb: 'FF475569' } };
  wsTribu.getCell('E5').value = 'ovitribucr.hacienda.go.cr';

  // Agrupación para TRIBU-CR
  const TARIFAS_TRIBU = [0.5, 1, 2, 4, 13];

  const ventasTribu = {};
  TARIFAS_TRIBU.forEach(t => ventasTribu[t] = { base: 0, iva: 0, count: 0 });
  ventasTribu[0] = { base: 0, iva: 0, count: 0 };

  ingresos.forEach(ing => {
    let t = Number(ing.tasaIVA || 0);
    if (ventasTribu[t] === undefined) {
      const match = TARIFAS_TRIBU.find(tar => Math.abs(tar - t) <= 0.25);
      t = match !== undefined ? match : (t > 0 ? 13 : 0);
    }
    ventasTribu[t].base += Number(ing.subtotal || 0);
    ventasTribu[t].iva += Number(ing.iva || 0);
    ventasTribu[t].count += 1;
  });

  const comprasTribu = {};
  TARIFAS_TRIBU.forEach(t => comprasTribu[t] = { base: 0, iva: 0, count: 0 });
  comprasTribu[0] = { base: 0, iva: 0, count: 0 };

  gastos.forEach(g => {
    const esDeducible = g.esDeducible === 'Sí';
    if (!esDeducible) {
      comprasTribu[0].base += Number(g.subtotal || 0);
      comprasTribu[0].count += 1;
      return;
    }
    let t = Number(g.tasaIVA != null ? g.tasaIVA : 13);
    if (comprasTribu[t] === undefined) {
      const match = TARIFAS_TRIBU.find(tar => Math.abs(tar - t) <= 0.25);
      t = match !== undefined ? match : (t > 0 ? 13 : 0);
    }
    comprasTribu[t].base += Number(g.subtotal || 0);
    comprasTribu[t].iva += Number(g.iva || 0);
    comprasTribu[t].count += 1;
  });

  let tRow = 7;

  // --- PASO 1: VENTAS GENERALES ---
  wsTribu.getCell(`B${tRow}`).value = 'PASO 1: VENTAS GENERALES';
  wsTribu.getCell(`B${tRow}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
  tRow++;

  const cabVentasTr = ['Tarifa de IVA / Casilla TRIBU-CR', 'Documentos', 'Total importe ventas (₡)', 'Impuesto devengado (₡)'];
  const rowCabVTr = wsTribu.getRow(tRow);
  cabVentasTr.forEach((h, i) => {
    const col = ['B', 'C', 'D', 'E'][i];
    const cell = wsTribu.getCell(`${col}${tRow}`);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_SECUNDARIO } };
    cell.alignment = { vertical: 'middle', horizontal: i <= 1 ? 'left' : 'center' };
  });
  rowCabVTr.height = 24;
  tRow++;

  const filasVentasDef = [
    { label: 'Ventas a 13%', t: 13 },
    { label: 'Ventas a 4%', t: 4 },
    { label: 'Ventas a 2%', t: 2 },
    { label: 'Ventas a 1% (agropecuario/canasta básica)', t: 1 },
    { label: 'Ventas a 0.5%', t: 0.5 },
    { label: 'Ventas exentas / no sujetas', t: 0 },
  ];

  filasVentasDef.forEach((f, idx) => {
    const row = wsTribu.getRow(tRow);
    const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const val = ventasTribu[f.t] || { base: 0, iva: 0, count: 0 };

    row.getCell(2).value = f.label;
    row.getCell(2).border = bordeFino;
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.getCell(3).value = val.count;
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(3).border = bordeFino;
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.getCell(4).value = Number(val.base);
    row.getCell(4).numFmt = '₡#,##0.00';
    row.getCell(4).border = bordeFino;
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.getCell(5).value = Number(val.iva);
    row.getCell(5).numFmt = '₡#,##0.00';
    row.getCell(5).border = bordeFino;
    row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.height = 20;
    tRow++;
  });

  const rowTotVTr = wsTribu.getRow(tRow);
  rowTotVTr.getCell(2).value = 'SUBTOTAL VENTAS GRAVADAS';
  rowTotVTr.getCell(2).font = { bold: true };
  rowTotVTr.getCell(2).border = bordeDobleInferior;

  rowTotVTr.getCell(3).value = '';
  rowTotVTr.getCell(3).border = bordeDobleInferior;

  rowTotVTr.getCell(4).value = totalVentas;
  rowTotVTr.getCell(4).numFmt = '₡#,##0.00';
  rowTotVTr.getCell(4).font = { bold: true };
  rowTotVTr.getCell(4).border = bordeDobleInferior;

  rowTotVTr.getCell(5).value = totalIvaDebito;
  rowTotVTr.getCell(5).numFmt = '₡#,##0.00';
  rowTotVTr.getCell(5).font = { bold: true, color: { argb: 'FF166534' } };
  rowTotVTr.getCell(5).border = bordeDobleInferior;
  rowTotVTr.height = 22;
  tRow += 2;

  // --- PASO 2: COMPRAS TOTALES ---
  wsTribu.getCell(`B${tRow}`).value = 'PASO 2: COMPRAS TOTALES';
  wsTribu.getCell(`B${tRow}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
  tRow++;

  wsTribu.getCell(`B${tRow}`).value = 'En esta sección debe introducir las compras realizadas en este periodo a cada tarifa. El formulario calcula de forma automática el impuesto soportado para cada una de ellas.';
  wsTribu.getCell(`B${tRow}`).font = { italic: true, size: 8.5, color: { argb: 'FF64748B' } };
  tRow++;

  const cabComprasTr = ['Sección TRIBU-CR / Tarifa', 'Documentos', 'Total importe compras (₡)', 'Impuesto soportado (₡)'];
  const rowCabCTr = wsTribu.getRow(tRow);
  cabComprasTr.forEach((h, i) => {
    const col = ['B', 'C', 'D', 'E'][i];
    const cell = wsTribu.getCell(`${col}${tRow}`);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_SECUNDARIO } };
    cell.alignment = { vertical: 'middle', horizontal: i <= 1 ? 'left' : 'center' };
  });
  rowCabCTr.height = 24;
  tRow++;

  const filasComprasDef = [
    { label: 'Compras a 0.5%', t: 0.5 },
    { label: 'Compras a 1%', t: 1 },
    { label: 'Compras a 2%', t: 2 },
    { label: 'Compras a 4%', t: 4 },
    { label: 'Compras a 13%', t: 13 },
    { label: 'Compras sin IVA soportado o no acreditable', t: 0 },
  ];

  filasComprasDef.forEach((f, idx) => {
    const row = wsTribu.getRow(tRow);
    const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    const val = comprasTribu[f.t] || { base: 0, iva: 0, count: 0 };

    row.getCell(2).value = f.label;
    row.getCell(2).border = bordeFino;
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.getCell(3).value = val.count;
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(3).border = bordeFino;
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.getCell(4).value = Number(val.base);
    row.getCell(4).numFmt = '₡#,##0.00';
    row.getCell(4).border = bordeFino;
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.getCell(5).value = Number(val.iva);
    row.getCell(5).numFmt = '₡#,##0.00';
    row.getCell(5).border = bordeFino;
    row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

    row.height = 20;
    tRow++;
  });

  const rowTotCTr = wsTribu.getRow(tRow);
  rowTotCTr.getCell(2).value = 'SUBTOTAL COMPRAS GRAVADAS';
  rowTotCTr.getCell(2).font = { bold: true };
  rowTotCTr.getCell(2).border = bordeDobleInferior;

  rowTotCTr.getCell(3).value = '';
  rowTotCTr.getCell(3).border = bordeDobleInferior;

  rowTotCTr.getCell(4).value = totalGastosDed;
  rowTotCTr.getCell(4).numFmt = '₡#,##0.00';
  rowTotCTr.getCell(4).font = { bold: true };
  rowTotCTr.getCell(4).border = bordeDobleInferior;

  rowTotCTr.getCell(5).value = totalIvaCredito;
  rowTotCTr.getCell(5).numFmt = '₡#,##0.00';
  rowTotCTr.getCell(5).font = { bold: true, color: { argb: 'FF1E40AF' } };
  rowTotCTr.getCell(5).border = bordeDobleInferior;
  rowTotCTr.height = 22;
  tRow += 2;

  // --- PASO 3: CRÉDITO FISCAL (PRORRATA) ---
  wsTribu.getCell(`B${tRow}`).value = 'PASO 3: CRÉDITO FISCAL (PROPORCIONALIDAD / PRORRATA)';
  wsTribu.getCell(`B${tRow}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
  tRow++;

  const totalVentasBrutas = Math.abs(totalVentas) + Math.abs(ventasTribu[0].base);
  const prorrataPct = totalVentasBrutas > 0 ? (Math.abs(totalVentas) / totalVentasBrutas) : 1;
  const creditoDed = Math.round(totalIvaCredito * prorrataPct);
  const creditoNoDed = Math.round(totalIvaCredito - creditoDed);

  const filasProrrataTr = [
    ['Ventas con derecho a crédito (Gravadas)', totalVentas, 'MONEDA'],
    ['Ventas sin derecho a crédito (Exentas)', ventasTribu[0].base, 'MONEDA'],
    ['Porcentaje de Prorrata Aplicable (% Deducible)', `${(Math.round(prorrataPct * 10000) / 100)}%`, ''],
    ['Crédito Fiscal Total Soportado (Compras)', totalIvaCredito, 'MONEDA'],
    ['Crédito Fiscal DEDUCIBLE (aplicable en D-150)', creditoDed, 'MONEDA_VERDE'],
    ['Crédito Fiscal NO Deducible', creditoNoDed, 'MONEDA_ROJO'],
  ];

  filasProrrataTr.forEach(([concepto, valor, fmt]) => {
    const row = wsTribu.getRow(tRow);
    row.getCell(2).value = concepto;
    row.getCell(2).border = bordeFino;

    wsTribu.mergeCells(`D${tRow}:E${tRow}`);
    const celdaVal = wsTribu.getCell(`D${tRow}`);
    celdaVal.value = fmt.startsWith('MONEDA') ? Number(valor) : valor;
    if (fmt.startsWith('MONEDA')) {
      celdaVal.numFmt = '₡#,##0.00';
    }
    celdaVal.border = bordeFino;
    celdaVal.alignment = { horizontal: 'right' };

    if (fmt === 'MONEDA_VERDE') {
      celdaVal.font = { bold: true, color: { argb: 'FF15803D' } };
    } else if (fmt === 'MONEDA_ROJO') {
      celdaVal.font = { color: { argb: 'FFB91C1C' } };
    }

    row.height = 20;
    tRow++;
  });
  tRow++;

  // --- PASO 4: CÁLCULO DEL IMPUESTO ---
  wsTribu.getCell(`B${tRow}`).value = 'PASO 4: CÁLCULO DEL IMPUESTO (LIQUIDACIÓN FINAL)';
  wsTribu.getCell(`B${tRow}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
  tRow++;

  const finalIvaPagar = totalIvaDebito - creditoDed;
  const liquidacionTr = [
    ['Débito Fiscal (IVA Facturado en Paso 1)', totalIvaDebito],
    ['(-) Crédito Fiscal Deducible (Paso 3)', -creditoDed],
  ];

  liquidacionTr.forEach(([concepto, valor]) => {
    const row = wsTribu.getRow(tRow);
    row.getCell(2).value = concepto;
    row.getCell(2).border = bordeFino;

    wsTribu.mergeCells(`D${tRow}:E${tRow}`);
    const celdaVal = wsTribu.getCell(`D${tRow}`);
    celdaVal.value = Number(valor);
    celdaVal.numFmt = '₡#,##0.00';
    celdaVal.border = bordeFino;
    celdaVal.alignment = { horizontal: 'right' };

    row.height = 20;
    tRow++;
  });

  const rowResTr = wsTribu.getRow(tRow);
  const esPagarTr = finalIvaPagar > 0;
  const textoResTr = esPagarTr ? 'IVA A PAGAR EN TRIBU-CR' : 'SALDO A FAVOR DEL CONTRIBUYENTE';
  const montoResTr = Math.abs(finalIvaPagar);
  const colorTextoTr = esPagarTr ? 'FFB91C1C' : 'FF15803D';
  const colorBgTr = esPagarTr ? 'FFFEE2E2' : 'FFD1FAE5';

  rowResTr.getCell(2).value = textoResTr;
  rowResTr.getCell(2).font = { bold: true, size: 12, color: { argb: colorTextoTr } };
  rowResTr.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBgTr } };
  rowResTr.getCell(2).border = bordeDobleInferior;

  wsTribu.mergeCells(`D${tRow}:E${tRow}`);
  const celdaMontoResTr = wsTribu.getCell(`D${tRow}`);
  celdaMontoResTr.value = Number(montoResTr);
  celdaMontoResTr.numFmt = '₡#,##0.00';
  celdaMontoResTr.font = { bold: true, size: 13, color: { argb: colorTextoTr } };
  celdaMontoResTr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBgTr } };
  celdaMontoResTr.border = bordeDobleInferior;
  celdaMontoResTr.alignment = { horizontal: 'right', vertical: 'middle' };
  rowResTr.height = 30;

  // =========================================================================
  // HOJA 3: DETALLE COMPLETO DE COMPROBANTES Y FACTURAS
  // =========================================================================
  const wsDetalle = wb.addWorksheet('Detalle de Comprobantes', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  wsDetalle.columns = [
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Proveedor / Comprador', key: 'proveedor', width: 34 },
    { header: 'Cédula', key: 'cedulaProveedor', width: 18 },
    { header: 'Descripción', key: 'descripcion', width: 38 },
    { header: 'Categoría', key: 'categoria', width: 24 },
    { header: 'Subtotal (₡)', key: 'subtotal', width: 18 },
    { header: 'IVA (₡)', key: 'iva', width: 16 },
    { header: 'Total (₡)', key: 'total', width: 18 },
    { header: 'N° Factura / Consecutivo', key: 'consecutivo', width: 28 },
    { header: 'Clave Hacienda (50 dígitos)', key: 'claveNumerica', width: 56 },
    { header: 'Es Deducible', key: 'esDeducible', width: 14 },
    { header: 'Motivo No Deducible', key: 'motivoNoDeducible', width: 28 },
    { header: 'Tasa IVA (%)', key: 'tasaIVA', width: 14 },
  ];

  // Estilo de la cabecera
  const headerRow = wsDetalle.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_PRIMARIO } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Auto-filtro activo en toda la tabla
  wsDetalle.autoFilter = { from: 'A1', to: 'N1' };

  let numFila = 2;
  datos.forEach((d, idx) => {
    const row = wsDetalle.addRow({
      tipo: d.tipo,
      fecha: d.fecha,
      proveedor: d.proveedor,
      cedulaProveedor: d.cedulaProveedor ? String(d.cedulaProveedor).trim() : '',
      descripcion: d.descripcion,
      categoria: d.categoria,
      subtotal: Number(d.subtotal || 0),
      iva: Number(d.iva || 0),
      total: Number(d.total || 0),
      consecutivo: d.consecutivo || d.numComprobante || '',
      claveNumerica: d.claveNumerica || '',
      esDeducible: d.esDeducible,
      motivoNoDeducible: d.motivoNoDeducible,
      tasaIVA: Number(d.tasaIVA || 0) / 100, // formato %
    });

    const bgRow = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    // Formato estricto '@' (Texto Puro) para Cédula, Consecutivo y Clave
    const cCedula = row.getCell('cedulaProveedor');
    cCedula.value = String(d.cedulaProveedor || '').trim();
    cCedula.numFmt = '@';
    cCedula.alignment = { horizontal: 'left' };

    const cConsecutivo = row.getCell('consecutivo');
    cConsecutivo.value = String(d.consecutivo || d.numComprobante || '').trim();
    cConsecutivo.numFmt = '@';
    cConsecutivo.alignment = { horizontal: 'left' };

    const cClave = row.getCell('claveNumerica');
    cClave.value = String(d.claveNumerica || '').trim();
    cClave.numFmt = '@';
    cClave.alignment = { horizontal: 'left' };

    // Moneda
    row.getCell('subtotal').numFmt = '₡#,##0.00';
    row.getCell('iva').numFmt = '₡#,##0.00';
    row.getCell('total').numFmt = '₡#,##0.00';
    row.getCell('tasaIVA').numFmt = '0.0%';

    // Alineaciones
    row.getCell('tipo').alignment = { horizontal: 'center' };
    row.getCell('fecha').alignment = { horizontal: 'center' };
    row.getCell('esDeducible').alignment = { horizontal: 'center' };
    row.getCell('tasaIVA').alignment = { horizontal: 'center' };

    // Coloreado sutil del Tipo
    if (d.tipo === 'INGRESO') {
      row.getCell('tipo').font = { bold: true, color: { argb: 'FF15803D' } };
    } else {
      row.getCell('tipo').font = { color: { argb: 'FF1E3A8A' } };
    }

    // Bordes y fondo
    for (let c = 1; c <= 14; c++) {
      const cell = row.getCell(c);
      cell.border = bordeFino;
      if (!cell.fill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
      }
    }

    row.height = 20;
    numFila++;
  });

  // Fila de Totales con fórmulas Excel nativas
  const totalRow = wsDetalle.addRow({
    tipo: 'TOTALES',
    fecha: '',
    proveedor: '',
    cedulaProveedor: '',
    descripcion: '',
    categoria: '',
    subtotal: { formula: `SUM(G2:G${numFila - 1})`, result: datos.reduce((s, d) => s + Number(d.subtotal || 0), 0) },
    iva: { formula: `SUM(H2:H${numFila - 1})`, result: datos.reduce((s, d) => s + Number(d.iva || 0), 0) },
    total: { formula: `SUM(I2:I${numFila - 1})`, result: datos.reduce((s, d) => s + Number(d.total || 0), 0) },
    consecutivo: '',
    claveNumerica: '',
    esDeducible: '',
    motivoNoDeducible: '',
    tasaIVA: null,
  });

  totalRow.font = { bold: true, size: 10 };
  totalRow.getCell('subtotal').numFmt = '₡#,##0.00';
  totalRow.getCell('iva').numFmt = '₡#,##0.00';
  totalRow.getCell('total').numFmt = '₡#,##0.00';
  totalRow.getCell('tipo').alignment = { horizontal: 'center' };

  for (let c = 1; c <= 14; c++) {
    totalRow.getCell(c).border = bordeDobleInferior;
  }
  totalRow.height = 24;

  return wb;
}

/**
 * Genera un archivo CSV compatible con Excel protegiendo identificadores largos
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
    { header: 'NumFactura_Consecutivo', key: 'consecutivo' },
    { header: 'Clave_Hacienda', key: 'claveNumerica' },
    { header: 'NumComprobante', key: 'numComprobante' },
    { header: 'EsDeducible', key: 'esDeducible' },
    { header: 'MotivoNoDeducible', key: 'motivoNoDeducible' },
    { header: 'TasaIVA', key: 'tasaIVA' },
  ];

  const encabezados = COLUMNAS.map(c => c.header);

  const escapeCsv = (val, key) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    // Proteger campos numéricos largos y cédulas para que Excel los abra como texto sin truncar dígitos
    if (['consecutivo', 'claveNumerica', 'numComprobante', 'cedulaProveedor'].includes(key) && str.length > 0) {
      return `="${str.replace(/"/g, '""')}"`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const filas = datos.map(d => COLUMNAS.map(c => escapeCsv(d[c.key], c.key)).join(','));

  return [encabezados.join(','), ...filas].join('\n');
}

module.exports = {
  generarDatosExportacion,
  generarExcel,
  generarCSV,
};
