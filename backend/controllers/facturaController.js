const Factura = require('../models/Factura');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');
const { sincronizarManual, obtenerEstado } = require('../services/emailService');

const obtenerFacturas = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre, categoriaIA, estado, page = 1, limit = 20 } = req.query;
    const filtro = { usuario: req.usuario._id };
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);
    if (categoriaIA) filtro.categoriaIA = categoriaIA;
    if (estado) filtro.estado = estado;
    const skip = (Number(page) - 1) * Number(limit);
    const [facturas, total] = await Promise.all([
      Factura.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(Number(limit)),
      Factura.countDocuments(filtro),
    ]);
    res.json({ facturas, total, pagina: Number(page), totalPaginas: Math.ceil(total / Number(limit)) });
  } catch (error) { next(error); }
};

const obtenerFacturaPorId = async (req, res, next) => {
  try {
    const factura = await Factura.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    res.json(factura);
  } catch (error) { next(error); }
};

const actualizarCategoriaFactura = async (req, res, next) => {
  try {
    const { categoriaManual, esDeducible } = req.body;
    const factura = await Factura.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (categoriaManual) factura.categoriaManual = categoriaManual;
    if (esDeducible !== undefined) factura.esDeducible = esDeducible;
    const actualizada = await factura.save();
    res.json(actualizada);
  } catch (error) { next(error); }
};

const eliminarFactura = async (req, res, next) => {
  try {
    const factura = await Factura.findOneAndDelete({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    res.json({ mensaje: 'Factura eliminada correctamente' });
  } catch (error) { next(error); }
};

// --- Endpoints de Email ---

const estadoEmail = async (req, res, next) => {
  try {
    const estado = obtenerEstado();
    res.json(estado);
  } catch (error) { next(error); }
};

const forzarSincronizacion = async (req, res, next) => {
  try {
    const resultado = await sincronizarManual(req.usuario._id);
    res.json(resultado);
  } catch (error) { next(error); }
};

const crearGastoManual = async (req, res, next) => {
  try {
    const { fechaEmision, emisorNombre, categoriaManual, totalVenta, totalImpuesto, descripcion } = req.body;
    
    if (!fechaEmision || !emisorNombre || !totalVenta) {
      res.status(400);
      throw new Error('Faltan campos requeridos');
    }

    const fecha = new Date(fechaEmision);
    
    const nuevaFactura = await Factura.create({
      fechaEmision: fecha,
      emisor: { nombre: emisorNombre },
      resumenFactura: {
        totalVenta: Number(totalVenta),
        totalImpuesto: Number(totalImpuesto || 0),
        totalComprobante: Number(totalVenta) + Number(totalImpuesto || 0),
      },
      lineaDetalle: [{ descripcion, precioUnitario: Number(totalVenta), cantidad: 1, subtotal: Number(totalVenta), montoTotal: Number(totalVenta) + Number(totalImpuesto || 0) }],
      categoriaIA: categoriaManual || 'otros',
      categoriaManual: categoriaManual || 'otros',
      confianzaIA: 1,
      estado: 'procesada',
      cuatrimestre: obtenerCuatrimestre(fecha.getMonth() + 1),
      periodoFiscal: fecha.getFullYear(),
      usuario: req.usuario._id,
      esDeducible: true
    });

    res.status(201).json(nuevaFactura);
  } catch (error) { next(error); }
};

module.exports = {
  obtenerFacturas,
  obtenerFacturaPorId,
  actualizarCategoriaFactura,
  eliminarFactura,
  crearGastoManual,
  estadoEmail,
  forzarSincronizacion,
};
