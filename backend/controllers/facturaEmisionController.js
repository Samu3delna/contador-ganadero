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

    const skip = (Number(page) - 1) * Number(limit);
    const [facturas, total] = await Promise.all([
      FacturaEmision.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(Number(limit)),
      FacturaEmision.countDocuments(filtro),
    ]);
    res.json({ facturas, total, pagina: Number(page), totalPaginas: Math.ceil(total / Number(limit)) });
  } catch (error) { next(error); }
};

const obtenerFacturaEmision = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    res.json(factura);
  } catch (error) { next(error); }
};

const crearFacturaEmision = async (req, res, next) => {
  try {
    const {
      consecutivo, emisor, receptor, lineaDetalle, tipoProducto,
      condicionVenta, medioPago, plazoCredito, referencia, esPFyAE
    } = req.body;

    if (!consecutivo || !emisor || !receptor || !lineaDetalle || !tipoProducto) {
      res.status(400);
      throw new Error('Faltan campos requeridos: consecutivo, emisor, receptor, lineaDetalle, tipoProducto');
    }

    const fechaEmision = new Date();
    const cuatrimestre = obtenerCuatrimestre(fechaEmision);
    const periodoFiscal = fechaEmision.getFullYear();

    const nuevaFactura = await FacturaEmision.create(req.aplicarTenant({
      consecutivo,
      emisor: { ...emisor, regimen: 'Régimen Especial Agropecuario (REA)' },
      receptor,
      lineaDetalle,
      tipoProducto,
      condicionVenta: condicionVenta || '01',
      medioPago: medioPago || ['04'],
      plazoCredito,
      referencia,
      esPFyAE: esPFyAE || false,
      esFacturaREA: true,
      fechaEmision,
      cuatrimestre,
      periodoFiscal,
      estado: 'borrador',
      usuario: req.usuario._id,
    }));

    res.status(201).json(nuevaFactura);
  } catch (error) { next(error); }
};

const actualizarEstadoFactura = async (req, res, next) => {
  try {
    const { estado, respuestaHacienda } = req.body;
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }

    if (estado) factura.estado = estado;
    if (respuestaHacienda) {
      factura.respuestaHacienda = { ...factura.respuestaHacienda, ...respuestaHacienda, fecha: new Date() };
    }
    if (estado === 'enviada_hacienda') {
      factura.fechaEnvioHacienda = new Date();
    }

    await factura.save();
    res.json(factura);
  } catch (error) { next(error); }
};

const anularFactura = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (factura.estado === 'aceptada') {
      res.status(400); throw new Error('No se puede anular una factura ya aceptada por Hacienda');
    }
    factura.estado = 'anulada';
    await factura.save();
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
