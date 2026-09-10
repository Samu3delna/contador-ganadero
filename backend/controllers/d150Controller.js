/**
 * Controller D-150: Conciliacion Tributaria IVA mensual.
 *
 * Endpoints:
 *   GET  /api/hacienda/d150/conciliacion?mes=7&anio=2026&retencionesTarjeta=...
 *        Devuelve el JSON completo calculado
 *   POST /api/hacienda/d150/conciliacion     Body { mes, anio, retencionesTarjeta[], ivaRetenidoPorTerceros }
 *   GET  /api/hacienda/d150/reporte/pdf?mes=7&anio=2026     Genera PDF (blob)
 *   GET  /api/hacienda/d150/reporte/excel?mes=7&anio=2026    Genera XLSX (blob)
 *   POST /api/hacienda/d150/reporte/pdf Vaughn alternative
 */

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const d150Service = require('../services/d150Service');

function parseParametros(req) {
  const body = req.body || {};
  const query = req.query || {};
  const mes = Number(body.mes ?? query.mes ?? new Date().getMonth() + 1);
  const anio = Number(body.anio ?? query.anio ?? new Date().getFullYear());
  const retencionesTarjetaRaw = body.retencionesTarjeta ?? query.retencionesTarjeta ?? [];
  const retencionesTarjeta = Array.isArray(retencionesTarjetaRaw)
    ? retencionesTarjetaRaw.map((r) => Number(r))
    : String(retencionesTarjetaRaw).split(',').map((r) => Number(r)).filter((n) => !isNaN(n));
  const ivaRetenidoPorTerceros = Number(body.ivaRetenidoPorTerceros ?? query.ivaRetenidoPorTerceros ?? 0);
  return { mes, anio, retencionesTarjeta, ivaRetenidoPorTerceros };
}

// ============ JSON ============
const conciliacion = async (req, res, next) => {
  try {
    const p = parseParametros(req);
    if (p.mes < 1 || p.mes > 12) { res.status(400); throw new Error('mes invalido (1-12)'); }
    const resultado = await d150Service.generarConciliacion({
      usuarioId: req.usuario._id,
      ...p,
    });
    res.json(resultado);
  } catch (error) { next(error); }
};

// ============ PDF ============
const reportePDF = async (req, res, next) => {
  try {
    const p = parseParametros(req);
    const resultado = await d150Service.generarConciliacion({
      usuarioId: req.usuario._id,
      ...p,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="D-150_${p.anio}-${String(p.mes).padStart(2, '0')}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 } });
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('Conciliación Tributaria D-150', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(`Período: ${String(p.mes).padStart(2, '0')}/${p.anio}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(8).fillColor('gray').text(`Generado: ${new Date(resultado.meta.generadoEn).toLocaleString('es-CR')}`);
    doc.moveDown(1);
    doc.fillColor('black');

    // Cuadros VENTAS
    doc.fontSize(13).font('Helvetica-Bold').text('1. Débito Fiscal — Ventas / Servicios');
    doc.moveDown(0.3);
    dibujarTablaPDF(doc, resultado.detalleVentas, ['Tarifa', 'Documentos', 'Base', 'IVA Débito', 'NC aplicadas']);
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold').text(`Total ventas gravadas (base): ₡${resultado.totales.ventasGravadasBase.toLocaleString('es-CR')}`);
    doc.text(`Total IVA débito fiscal: ₡${resultado.totales.ventasIVADebito.toLocaleString('es-CR')}`);
    doc.text(`Total ventas exentas: ₡${resultado.totales.ventasExentas.toLocaleString('es-CR')}`);
    doc.moveDown(1);

    // Cuadros COMPRAS
    doc.fontSize(13).font('Helvetica-Bold').text('2. Crédito Fiscal — Compras / Gastos');
    doc.moveDown(0.3);
    dibujarTablaPDF(doc, resultado.detalleCompras, ['Tarifa', 'Documentos', 'Base', 'IVA Crédito']);
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold').text(`Total compras gravadas (base): ₡${resultado.totales.comprasGravadasBase.toLocaleString('es-CR')}`);
    doc.text(`Total IVA crédito fiscal: ₡${resultado.totales.comprasIVACredito.toLocaleString('es-CR')}`);
    doc.text(`Total compras exentas: ₡${resultado.totales.comprasExentas.toLocaleString('es-CR')}`);
    doc.moveDown(1);

    // Prorrata
    doc.fontSize(13).font('Helvetica-Bold').text('3. Prorrata de Crédito Fiscal');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Porcentaje deducible: ${resultado.prorrata.porcentajeDeducible}%`);
    doc.text(`Crédito deducible: ₡${resultado.prorrata.creditoDeducible.toLocaleString('es-CR')}`);
    doc.text(`Crédito NO deducible: ₡${resultado.prorrata.creditoNoDeducible.toLocaleString('es-CR')}`);
    doc.moveDown(1);

    // Resultado final
    doc.fontSize(13).font('Helvetica-Bold').text('4. Resultado del Período');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Débito fiscal: ₡${resultado.resultadoFinal.debitoFiscal.toLocaleString('es-CR')}`);
    doc.text(`Crédito deducible: -₡${resultado.resultadoFinal.creditoDeducible.toLocaleString('es-CR')}`);
    doc.text(`Retenciones tarjeta: -₡${resultado.resultadoFinal.totalRetencionesTarjeta.toLocaleString('es-CR')}`);
    doc.text(`IVA retenido por terceros: -₡${resultado.resultadoFinal.ivaRetenidoPorTerceros.toLocaleString('es-CR')}`);
    doc.moveDown(0.5);
    if (resultado.resultadoFinal.ivaAPagar > 0) {
      doc.fontSize(12).fillColor('#c0392b').font('Helvetica-Bold').text(`IVA A PAGAR: ₡${resultado.resultadoFinal.ivaAPagar.toLocaleString('es-CR')}`);
    } else {
      doc.fontSize(12).fillColor('#27ae60').font('Helvetica-Bold').text(`SALDO A FAVOR: ₡${resultado.resultadoFinal.saldoAFavor.toLocaleString('es-CR')}`);
    }
    doc.moveDown(1);
    doc.fontSize(8).fillColor('gray').font('Helvetica').text(
      'Este reporte es de auditoría interna. Debe presentarse la declaración en la OVI de TRIBU-CR (ovitribucr.hacienda.go.cr).',
      { align: 'center' }
    );

    doc.end();
  } catch (error) { next(error); }
};

function dibujarTablaPDF(doc, filas, headers) {
  const x = doc.page.margins.left;
  let y = doc.y;
  const colW = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / headers.length;

  doc.fontSize(9).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, x + i * colW, y, { width: colW, align: 'left' });
  });
  y += 15;
  doc.font('Helvetica');
  filas.forEach((f) => {
    const valores = [
      `Tarifa ${f.tarifa}%`,
      String(f.cantidadDocumentos || 0),
      formatCol(f.baseImponible),
      formatCol(f.ivaDebitoFiscal ?? f.ivaCreditoFiscal ?? 0),
      formatCol(f.notasCreditoAplicadas || 0),
    ];
    valores.forEach((v, i) => {
      doc.text(v, x + i * colW, y, { width: colW, align: 'left' });
    });
    y += 13;
  });
  doc.y = y;
}

function formatCol(n) {
  if (n == null || n === 0) return '—';
  return `₡${Number(n).toLocaleString('es-CR')}`;
}

// ============ EXCEL ============
// ============ EXCEL ============
const reporteExcel = async (req, res, next) => {
  try {
    const p = parseParametros(req);
    const resultado = await d150Service.generarConciliacion({
      usuarioId: req.usuario._id,
      ...p,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="D-150_${p.anio}-${String(p.mes).padStart(2, '0')}.xlsx"`);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Contador IA Ganadero';
    wb.lastModifiedBy = 'Contador IA Ganadero';
    wb.created = new Date();
    wb.modified = new Date();

    const nombreUsuario = req.usuario.nombreFinca || req.usuario.nombre || 'Contribuyente Ganadero';
    const cedulaUsuario = req.usuario.cedula?.numero ? String(req.usuario.cedula.numero).trim() : 'No especificada';
    const mesNombre = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'][p.mes - 1] || `Mes ${p.mes}`;

    const COLOR_PRIMARIO = '1B4332'; // Verde Hacienda
    const COLOR_SECUNDARIO = '2D6A4F';
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

    // =========================================================================
    // HOJA 1: CONCILIACIÓN OFICIAL D-150
    // =========================================================================
    const ws1 = wb.addWorksheet(`Conciliación D-150`, {
      views: [{ showGridLines: true }],
    });

    ws1.columns = [
      { width: 4 },  // A margen
      { width: 34 }, // B Concepto / Tarifa
      { width: 14 }, // C Docs
      { width: 22 }, // D Base Imponible
      { width: 20 }, // E IVA
      { width: 20 }, // F NC Aplicadas
    ];

    // Banner título
    ws1.mergeCells('B2:F2');
    const celdaTit = ws1.getCell('B2');
    celdaTit.value = 'CONCILIACIÓN TRIBUTARIA D-150 - IMPUESTO AL VALOR AGREGADO (IVA)';
    celdaTit.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    celdaTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_PRIMARIO } };
    celdaTit.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(2).height = 30;

    // Metadatos
    ws1.getCell('B4').value = 'Contribuyente / Finca:';
    ws1.getCell('B4').font = { bold: true, color: { argb: 'FF475569' } };
    ws1.getCell('C4').value = nombreUsuario;
    ws1.getCell('C4').font = { bold: true };

    ws1.getCell('E4').value = 'Cédula:';
    ws1.getCell('E4').font = { bold: true, color: { argb: 'FF475569' } };
    ws1.getCell('F4').value = cedulaUsuario;
    ws1.getCell('F4').numFmt = '@';
    ws1.getCell('F4').font = { bold: true };

    ws1.getCell('B5').value = 'Período a Declarar:';
    ws1.getCell('B5').font = { bold: true, color: { argb: 'FF475569' } };
    ws1.getCell('C5').value = `${mesNombre} ${p.anio}`;
    ws1.getCell('C5').font = { bold: true, color: { argb: 'FF166534' } };

    ws1.getCell('E5').value = 'Plataforma Oficial:';
    ws1.getCell('E5').font = { bold: true, color: { argb: 'FF475569' } };
    ws1.getCell('F5').value = 'TRIBU-CR (ovitribucr.hacienda.go.cr)';

    let rIdx = 7;

    // --- PASO 1: VENTAS GENERALES ---
    ws1.getCell(`B${rIdx}`).value = 'PASO 1: VENTAS GENERALES (DÉBITO FISCAL)';
    ws1.getCell(`B${rIdx}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
    rIdx++;

    const cabVentas = ['Tarifa de IVA / Casilla TRIBU-CR', 'Documentos', 'Total importe ventas (₡)', 'Impuesto devengado (₡)', 'NC Aplicadas (₡)'];
    const rowCabV = ws1.getRow(rIdx);
    cabVentas.forEach((h, i) => {
      const col = ['B', 'C', 'D', 'E', 'F'][i];
      const cell = ws1.getCell(`${col}${rIdx}`);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_SECUNDARIO } };
      cell.alignment = { vertical: 'middle', horizontal: i <= 1 ? 'left' : 'center' };
    });
    rowCabV.height = 24;
    rIdx++;

    const inicioVentas = rIdx;
    resultado.detalleVentas.forEach((d, idx) => {
      const row = ws1.getRow(rIdx);
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      row.getCell(2).value = d.label;
      row.getCell(2).border = bordeFino;
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(3).value = d.cantidadDocumentos;
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(3).border = bordeFino;
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(4).value = Number(d.totalImporte ?? d.baseImponible);
      row.getCell(4).numFmt = '₡#,##0.00';
      row.getCell(4).border = bordeFino;
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(5).value = Number(d.impuestoDevengado ?? d.ivaDebitoFiscal);
      row.getCell(5).numFmt = '₡#,##0.00';
      row.getCell(5).border = bordeFino;
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(6).value = Number(d.notasCreditoAplicadas || 0);
      row.getCell(6).numFmt = '₡#,##0.00';
      row.getCell(6).border = bordeFino;
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.height = 20;
      rIdx++;
    });

    // Fila total ventas
    const rowTotV = ws1.getRow(rIdx);
    rowTotV.getCell(2).value = 'SUBTOTAL VENTAS GRAVADAS';
    rowTotV.getCell(2).font = { bold: true };
    rowTotV.getCell(2).border = bordeDobleInferior;

    rowTotV.getCell(3).value = '';
    rowTotV.getCell(3).border = bordeDobleInferior;

    rowTotV.getCell(4).value = Number(resultado.totales.ventasGravadasBase);
    rowTotV.getCell(4).numFmt = '₡#,##0.00';
    rowTotV.getCell(4).font = { bold: true };
    rowTotV.getCell(4).border = bordeDobleInferior;

    rowTotV.getCell(5).value = Number(resultado.totales.ventasIVADebito);
    rowTotV.getCell(5).numFmt = '₡#,##0.00';
    rowTotV.getCell(5).font = { bold: true, color: { argb: 'FF166534' } };
    rowTotV.getCell(5).border = bordeDobleInferior;

    rowTotV.getCell(6).value = '';
    rowTotV.getCell(6).border = bordeDobleInferior;
    rowTotV.height = 22;
    rIdx += 2;

    // --- PASO 2: COMPRAS TOTALES ---
    ws1.getCell(`B${rIdx}`).value = 'PASO 2: COMPRAS TOTALES (CRÉDITO FISCAL)';
    ws1.getCell(`B${rIdx}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
    rIdx++;

    ws1.getCell(`B${rIdx}`).value = 'En esta sección debe introducir las compras realizadas en este periodo a cada tarifa. El formulario calcula de forma automática el impuesto soportado para cada una de ellas.';
    ws1.getCell(`B${rIdx}`).font = { italic: true, size: 8.5, color: { argb: 'FF64748B' } };
    rIdx++;

    const cabCompras = ['Sección TRIBU-CR / Tarifa', 'Documentos', 'Total importe compras (₡)', 'Impuesto soportado (₡)', ''];
    const rowCabC = ws1.getRow(rIdx);
    cabCompras.forEach((h, i) => {
      const col = ['B', 'C', 'D', 'E', 'F'][i];
      const cell = ws1.getCell(`${col}${rIdx}`);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_SECUNDARIO } };
      cell.alignment = { vertical: 'middle', horizontal: i <= 1 ? 'left' : 'center' };
    });
    rowCabC.height = 24;
    rIdx++;

    resultado.detalleCompras.forEach((d, idx) => {
      const row = ws1.getRow(rIdx);
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      row.getCell(2).value = d.label;
      row.getCell(2).border = bordeFino;
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(3).value = d.cantidadDocumentos;
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(3).border = bordeFino;
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(4).value = Number(d.totalImporte ?? d.baseImponible);
      row.getCell(4).numFmt = '₡#,##0.00';
      row.getCell(4).border = bordeFino;
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(5).value = Number(d.impuestoSoportado ?? d.ivaCreditoFiscal);
      row.getCell(5).numFmt = '₡#,##0.00';
      row.getCell(5).border = bordeFino;
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.getCell(6).border = bordeFino;
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      row.height = 20;
      rIdx++;
    });

    // Fila total compras
    const rowTotC = ws1.getRow(rIdx);
    rowTotC.getCell(2).value = 'SUBTOTAL COMPRAS GRAVADAS';
    rowTotC.getCell(2).font = { bold: true };
    rowTotC.getCell(2).border = bordeDobleInferior;

    rowTotC.getCell(3).value = '';
    rowTotC.getCell(3).border = bordeDobleInferior;

    rowTotC.getCell(4).value = Number(resultado.totales.comprasGravadasBase);
    rowTotC.getCell(4).numFmt = '₡#,##0.00';
    rowTotC.getCell(4).font = { bold: true };
    rowTotC.getCell(4).border = bordeDobleInferior;

    rowTotC.getCell(5).value = Number(resultado.totales.comprasIVACredito);
    rowTotC.getCell(5).numFmt = '₡#,##0.00';
    rowTotC.getCell(5).font = { bold: true, color: { argb: 'FF1E40AF' } };
    rowTotC.getCell(5).border = bordeDobleInferior;

    rowTotC.getCell(6).border = bordeDobleInferior;
    rowTotC.height = 22;
    rIdx += 2;

    // --- PASO 3: CRÉDITO FISCAL (PROPORCIONALIDAD / PRORRATA) ---
    ws1.getCell(`B${rIdx}`).value = 'PASO 3: CRÉDITO FISCAL (PROPORCIONALIDAD / PRORRATA)';
    ws1.getCell(`B${rIdx}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
    rIdx++;

    const filasProrrata = [
      ['Ventas con derecho a crédito (Gravadas)', resultado.prorrata.ventasGravadas, 'MONEDA'],
      ['Ventas sin derecho a crédito (Exentas)', resultado.prorrata.ventasExentas, 'MONEDA'],
      ['Porcentaje de Prorrata Aplicable (% Deducible)', `${resultado.prorrata.porcentajeDeducible}%`, ''],
      ['Crédito Fiscal Total Soportado (Compras)', resultado.prorrata.creditoTotal, 'MONEDA'],
      ['Crédito Fiscal DEDUCIBLE (aplicable en D-150)', resultado.prorrata.creditoDeducible, 'MONEDA_VERDE'],
      ['Crédito Fiscal NO Deducible', resultado.prorrata.creditoNoDeducible, 'MONEDA_ROJO'],
    ];

    filasProrrata.forEach(([concepto, valor, fmt]) => {
      const row = ws1.getRow(rIdx);
      row.getCell(2).value = concepto;
      row.getCell(2).border = bordeFino;

      ws1.mergeCells(`D${rIdx}:E${rIdx}`);
      const celdaVal = ws1.getCell(`D${rIdx}`);
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
      rIdx++;
    });

    rIdx++;

    // --- PASO 4: CÁLCULO DEL IMPUESTO (LIQUIDACIÓN FINAL) ---
    ws1.getCell(`B${rIdx}`).value = 'PASO 4: CÁLCULO DEL IMPUESTO (LIQUIDACIÓN FINAL)';
    ws1.getCell(`B${rIdx}`).font = { bold: true, size: 11, color: { argb: 'FF' + COLOR_PRIMARIO } };
    rIdx++;

    const liquidacion = [
      ['Débito Fiscal (IVA Facturado en Paso 1)', resultado.resultadoFinal.debitoFiscal, false],
      ['(-) Crédito Fiscal Deducible (Paso 3)', -resultado.resultadoFinal.creditoDeducible, false],
      ['(-) Retenciones de Tarjeta (Datáfonos Bancarios)', -resultado.resultadoFinal.totalRetencionesTarjeta, false],
      ['(-) IVA Retenido por Terceros o Entidades Públicas', -resultado.resultadoFinal.ivaRetenidoPorTerceros, false],
    ];

    liquidacion.forEach(([concepto, valor, esResultado]) => {
      const row = ws1.getRow(rIdx);
      row.getCell(2).value = concepto;
      row.getCell(2).border = bordeFino;

      ws1.mergeCells(`D${rIdx}:E${rIdx}`);
      const celdaVal = ws1.getCell(`D${rIdx}`);
      celdaVal.value = Number(valor);
      celdaVal.numFmt = '₡#,##0.00';
      celdaVal.border = bordeFino;
      celdaVal.alignment = { horizontal: 'right' };

      row.height = 20;
      rIdx++;
    });

    // Tarjeta Resultado Final Destacada
    const rowRes = ws1.getRow(rIdx);
    const esPagar = resultado.resultadoFinal.ivaAPagar > 0;
    const textoRes = esPagar ? 'IVA A PAGAR EN TRIBU-CR' : 'SALDO A FAVOR DEL CONTRIBUYENTE';
    const montoRes = esPagar ? resultado.resultadoFinal.ivaAPagar : resultado.resultadoFinal.saldoAFavor;
    const colorTexto = esPagar ? 'FFB91C1C' : 'FF15803D';
    const colorBg = esPagar ? 'FFFEE2E2' : 'FFD1FAE5';

    rowRes.getCell(2).value = textoRes;
    rowRes.getCell(2).font = { bold: true, size: 12, color: { argb: colorTexto } };
    rowRes.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBg } };
    rowRes.getCell(2).border = bordeDobleInferior;

    ws1.mergeCells(`D${rIdx}:E${rIdx}`);
    const celdaMontoRes = ws1.getCell(`D${rIdx}`);
    celdaMontoRes.value = Number(montoRes);
    celdaMontoRes.numFmt = '₡#,##0.00';
    celdaMontoRes.font = { bold: true, size: 13, color: { argb: colorTexto } };
    celdaMontoRes.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBg } };
    celdaMontoRes.border = bordeDobleInferior;
    celdaMontoRes.alignment = { horizontal: 'right', vertical: 'middle' };
    rowRes.height = 30;

    rIdx += 2;
    ws1.getCell(`B${rIdx}`).value = 'ⓘ Nota: Este documento constituye una conciliación y auditoría previa. El contribuyente debe ingresar a ovitribucr.hacienda.go.cr para verificar el prellenado oficial y presionar "Presentar".';
    ws1.getCell(`B${rIdx}`).font = { italic: true, size: 8, color: { argb: 'FF64748B' } };

    // =========================================================================
    // HOJA 2: DETALLE DE DOCUMENTOS QUE RESPALDAN LA DECLARACIÓN
    // =========================================================================
    const docs = resultado.documentos || [];
    const ws2 = wb.addWorksheet('Comprobantes del Período', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    ws2.columns = [
      { header: 'Operación', key: 'tipo', width: 14 },
      { header: 'Tipo Doc', key: 'tipoDoc', width: 12 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Proveedor / Cliente', key: 'tercero', width: 34 },
      { header: 'Cédula', key: 'cedula', width: 18 },
      { header: 'N° Factura / Consecutivo', key: 'consecutivo', width: 28 },
      { header: 'Clave Hacienda (50 dígitos)', key: 'claveNumerica', width: 56 },
      { header: 'Subtotal (₡)', key: 'subtotal', width: 18 },
      { header: 'IVA (₡)', key: 'iva', width: 16 },
      { header: 'Total (₡)', key: 'total', width: 18 },
      { header: 'Tasa IVA (%)', key: 'tasaIVA', width: 14 },
      { header: 'Deducible', key: 'esDeducible', width: 12 },
    ];

    const hRow2 = ws2.getRow(1);
    hRow2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    hRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLOR_PRIMARIO } };
    hRow2.alignment = { vertical: 'middle', horizontal: 'center' };
    hRow2.height = 28;
    ws2.autoFilter = { from: 'A1', to: 'L1' };

    let fNum = 2;
    docs.forEach((d, idx) => {
      const row = ws2.addRow({
        tipo: d.tipo,
        tipoDoc: d.tipoDoc,
        fecha: d.fecha,
        tercero: d.tercero,
        cedula: d.cedula ? String(d.cedula).trim() : '',
        consecutivo: d.consecutivo ? String(d.consecutivo).trim() : '',
        claveNumerica: d.claveNumerica ? String(d.claveNumerica).trim() : '',
        subtotal: Number(d.subtotal || 0),
        iva: Number(d.iva || 0),
        total: Number(d.total || 0),
        tasaIVA: Number(d.tasaIVA || 0) / 100,
        esDeducible: d.esDeducible || 'Sí',
      });

      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      // Estricto formato texto '@' para Cédula, Consecutivo y Clave
      const cCed = row.getCell('cedula');
      cCed.value = String(d.cedula || '').trim();
      cCed.numFmt = '@';
      cCed.alignment = { horizontal: 'left' };

      const cCons = row.getCell('consecutivo');
      cCons.value = String(d.consecutivo || '').trim();
      cCons.numFmt = '@';
      cCons.alignment = { horizontal: 'left' };

      const cClave = row.getCell('claveNumerica');
      cClave.value = String(d.claveNumerica || '').trim();
      cClave.numFmt = '@';
      cClave.alignment = { horizontal: 'left' };

      // Moneda
      row.getCell('subtotal').numFmt = '₡#,##0.00';
      row.getCell('iva').numFmt = '₡#,##0.00';
      row.getCell('total').numFmt = '₡#,##0.00';
      row.getCell('tasaIVA').numFmt = '0.0%';

      row.getCell('tipo').alignment = { horizontal: 'center' };
      row.getCell('tipoDoc').alignment = { horizontal: 'center' };
      row.getCell('fecha').alignment = { horizontal: 'center' };
      row.getCell('tasaIVA').alignment = { horizontal: 'center' };
      row.getCell('esDeducible').alignment = { horizontal: 'center' };

      if (d.tipo === 'VENTA') {
        row.getCell('tipo').font = { bold: true, color: { argb: 'FF15803D' } };
      } else {
        row.getCell('tipo').font = { color: { argb: 'FF1E3A8A' } };
      }

      for (let c = 1; c <= 12; c++) {
        row.getCell(c).border = bordeFino;
        if (!row.getCell(c).fill) {
          row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        }
      }
      row.height = 20;
      fNum++;
    });

    // Fila total en Hoja 2
    if (docs.length > 0) {
      const totRow2 = ws2.addRow({
        tipo: 'TOTALES',
        tipoDoc: '',
        fecha: '',
        tercero: '',
        cedula: '',
        consecutivo: '',
        claveNumerica: '',
        subtotal: { formula: `SUM(H2:H${fNum - 1})`, result: docs.reduce((s, d) => s + Number(d.subtotal || 0), 0) },
        iva: { formula: `SUM(I2:I${fNum - 1})`, result: docs.reduce((s, d) => s + Number(d.iva || 0), 0) },
        total: { formula: `SUM(J2:J${fNum - 1})`, result: docs.reduce((s, d) => s + Number(d.total || 0), 0) },
        tasaIVA: null,
        esDeducible: '',
      });

      totRow2.font = { bold: true, size: 10 };
      totRow2.getCell('subtotal').numFmt = '₡#,##0.00';
      totRow2.getCell('iva').numFmt = '₡#,##0.00';
      totRow2.getCell('total').numFmt = '₡#,##0.00';
      totRow2.getCell('tipo').alignment = { horizontal: 'center' };

      for (let c = 1; c <= 12; c++) {
        totRow2.getCell(c).border = bordeDobleInferior;
      }
      totRow2.height = 24;
    }

    await wb.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

module.exports = {
  conciliacion,
  reportePDF,
  reporteExcel,
};
