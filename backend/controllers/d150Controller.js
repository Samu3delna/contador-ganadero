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
    wb.creator = 'ContadorGanadero';
    wb.created = new Date();

    const ws = wb.addWorksheet(`D-150 ${p.anio}-${p.mes}`);

    ws.columns = [
      { header: 'Tarifa', key: 'tarifa', width: 22 },
      { header: 'Documentos', key: 'docs', width: 14 },
      { header: 'Base imponible', key: 'base', width: 18 },
      { header: 'IVA', key: 'iva', width: 16 },
      { header: 'NC aplicadas', key: 'nc', width: 16 },
    ];

    ws.addRow(['Conciliación D-150', '', '', '', '']).font = { bold: true, size: 14 };
    ws.addRow([`Período ${p.mes}/${p.anio}`, '', '', '', '']);
    ws.addRow([]);

    ws.addRow(['1. Débito Fiscal — Ventas / Servicios']).font = { bold: true };
    ws.addRow(['Tarifa', 'Doc', 'Base', 'IVA Débito', 'NC']).font = { bold: true };
    resultado.detalleVentas.forEach((d) => ws.addRow([
      d.label,
      d.cantidadDocumentos,
      d.baseImponible,
      d.ivaDebitoFiscal,
      d.notasCreditoAplicadas,
    ]));
    ws.addRow([]);
    ws.addRow(['Subtotal ventas', '', resultado.totales.ventasGravadasBase, resultado.totales.ventasIVADebito, '']).font = { bold: true };
    ws.addRow(['Ventas exentas', '', resultado.totales.ventasExentas, '', '']).font = { italic: true };
    ws.addRow([]);

    ws.addRow(['2. Crédito Fiscal — Compras / Gastos']).font = { bold: true };
    ws.addRow(['Tarifa', 'Doc', 'Base', 'IVA Crédito', '']).font = { bold: true };
    resultado.detalleCompras.forEach((d) => ws.addRow([
      d.label,
      d.cantidadDocumentos,
      d.baseImponible,
      d.ivaCreditoFiscal,
      '',
    ]));
    ws.addRow([]);
    ws.addRow(['Subtotal compras', '', resultado.totales.comprasGravadasBase, resultado.totales.comprasIVACredito, '']).font = { bold: true };
    ws.addRow(['Compras exentas', '', resultado.totales.comprasExentas, '', '']).font = { italic: true };
    ws.addRow([]);

    ws.addRow(['3. Prorrata de Crédito Fiscal']).font = { bold: true };
    ws.addRow(['Porcentaje deducible', resultado.prorrata.porcentajeDeducible + ' %']);
    ws.addRow(['Crédito deducible', resultado.prorrata.creditoDeducible]);
    ws.addRow(['Crédito no deducible', resultado.prorrata.creditoNoDeducible]);
    ws.addRow([]);

    ws.addRow(['4. Retenciones']).font = { bold: true };
    ws.addRow(['Retenciones tarjeta (total)', resultado.retencionesTarjeta.total]);
    ws.addRow(['IVA retenido por terceros', resultado.ivaRetenidoPorTerceros]);
    ws.addRow([]);

    ws.addRow(['5. Resultado final']).font = { bold: true, size: 12 };
    ws.addRow(['Débito fiscal', resultado.resultadoFinal.debitoFiscal]);
    ws.addRow(['Crédito deducible', -resultado.resultadoFinal.creditoDeducible]);
    ws.addRow(['Retenciones tarjeta', -resultado.resultadoFinal.totalRetencionesTarjeta]);
    ws.addRow(['IVA retenido por terceros', -resultado.resultadoFinal.ivaRetenidoPorTerceros]);
    if (resultado.resultadoFinal.ivaAPagar > 0) {
      const row = ws.addRow(['IVA A PAGAR', resultado.resultadoFinal.ivaAPagar]);
      row.font = { bold: true, color: { argb: 'FF0000' } };
    } else {
      const row = ws.addRow(['SALDO A FAVOR', resultado.resultadoFinal.saldoAFavor]);
      row.font = { bold: true, color: { argb: '27AE60' } };
    }

    ws.addRow([]);
    ws.addRow(['Nota: Este reporte es de auditoría interna. Debe presentarse la declaración en la OVI de TRIBU-CR.']).font = { italic: true, color: { argb: '888888' } };

    await wb.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};

module.exports = {
  conciliacion,
  reportePDF,
  reporteExcel,
};
