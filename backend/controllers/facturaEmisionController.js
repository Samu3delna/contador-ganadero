const FacturaEmision = require('../models/FacturaEmision');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');

// ============ CRUD FACTURAS EMITIDAS ============

const obtenerFacturasEmision = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre, estado, page = 1, limit = 20 } = req.query;
    const filtro = req.filtrarPorTenant();
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);
    if (estado) filtro.estado = estado;

    const { skip, pageNum, limitNum } = require('../utils/paginacion').paginacion({ page, limit });
    const [facturas, total] = await Promise.all([
      FacturaEmision.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(limitNum),
      FacturaEmision.countDocuments(filtro),
    ]);
    res.json({ facturas, total, pagina: pageNum, totalPaginas: Math.ceil(total / limitNum) });
  } catch (error) { next(error); }
};

const obtenerFacturaEmision = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    res.json(factura);
  } catch (error) { next(error); }
};

// Ambas pantallas usan la misma reserva de consecutivos y contrato fiscal.
const crearFacturaEmision = (req, res, next) => require('./haciendaController').crearBorrador(req, res, next);

const actualizarEstadoFactura = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    return res.status(422).json({ error: 'El estado fiscal solo cambia mediante firma, envio y consulta de Hacienda. Use el flujo de emision.' });
  } catch (error) { next(error); }
};

const anularFactura = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (factura.tipoDocumento === 'REP' && factura.estado === 'anulada' && !factura.envioIntentadoEn && !factura.xmlFirmado) {
      await require('../services/repReservations').liberar(factura);
      return res.json({ mensaje: 'Borrador REP anulado', factura });
    }
    if (!['borrador', 'generada'].includes(factura.estado) || factura.envioIntentadoEn || factura.xmlFirmado) {
      res.status(400); throw new Error('Solo se puede descartar un borrador sin firma ni intento de envío; para facturas aceptadas genere una nota de crédito');
    }
    factura.estado = 'anulada';
    await factura.save();
    if (factura.tipoDocumento === 'REP') await require('../services/repReservations').liberar(factura);
    res.json({ mensaje: 'Factura anulada', factura });
  } catch (error) { next(error); }
};

// ============ RESUMEN ============

const obtenerResumenEmision = async (req, res, next) => {
  try {
    const { anio } = req.query;
    const anioNum = Number(anio || new Date().getFullYear());

    const facturas = await FacturaEmision.find({ ...req.filtrarPorTenant(), periodoFiscal: anioNum });
    const totalEmitido = facturas.reduce((sum, f) => sum + (f.resumenFactura?.totalComprobante || 0), 0);
    const totalIVA = facturas.reduce((sum, f) => sum + (f.resumenFactura?.totalImpuesto || 0), 0);

    res.json({
      periodoFiscal: anioNum,
      totalFacturas: facturas.length,
      totalEmitido: Math.round(totalEmitido),
      totalIVARecaudado: Math.round(totalIVA),
      porEstado: facturas.reduce((acc, f) => {
        acc[f.estado] = (acc[f.estado] || 0) + 1;
        return acc;
      }, {}),
      porProducto: facturas.reduce((acc, f) => {
        acc[f.tipoProducto] = (acc[f.tipoProducto] || 0) + (f.resumenFactura?.totalComprobante || 0);
        return acc;
      }, {}),
    });
  } catch (error) { next(error); }
};

module.exports = {
  obtenerFacturasEmision,
  obtenerFacturaEmision,
  crearFacturaEmision,
  actualizarEstadoFactura,
  anularFactura,
  obtenerResumenEmision,
};
