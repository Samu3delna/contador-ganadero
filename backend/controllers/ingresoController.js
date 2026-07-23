const Ingreso = require('../models/Ingreso');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');

const obtenerIngresos = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre, tipoGanado, categoriaIngreso, page = 1, limit = 20 } = req.query;
    const filtro = req.filtrarPorTenant();
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);
    if (tipoGanado) filtro.tipoGanado = tipoGanado;
    if (categoriaIngreso) filtro.categoriaIngreso = categoriaIngreso;
    const skip = (Number(page) - 1) * Number(limit);
    const [ingresos, total] = await Promise.all([
      Ingreso.find(filtro).sort({ fecha: -1 }).skip(skip).limit(Number(limit)),
      Ingreso.countDocuments(filtro),
    ]);
    res.json({ ingresos, total, pagina: Number(page), totalPaginas: Math.ceil(total / Number(limit)) });
  } catch (error) { next(error); }
};

const obtenerIngresoPorId = async (req, res, next) => {
  try {
    const ingreso = await Ingreso.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!ingreso) { res.status(404); throw new Error('Ingreso no encontrado'); }
    res.json(ingreso);
  } catch (error) { next(error); }
};

const crearIngreso = async (req, res, next) => {
  try {
    const {
      fecha, descripcion, categoriaIngreso, tipoGanado, cantidadCabezas,
      pesoTotal, precioPorKilo, precioUnitario, litrosVendidos,
      industriaCompradora, detalleOtros, montoSubtotal, tasaIVA,
      comprador, facturaElectronica
    } = req.body;

    const fechaObj = new Date(fecha);

    const ingreso = await Ingreso.create(req.aplicarTenant({
      fecha: fechaObj,
      descripcion,
      categoriaIngreso: categoriaIngreso || 'venta_ganado_pie',
      tipoGanado,
      cantidadCabezas: cantidadCabezas || 0,
      pesoTotal: pesoTotal || 0,
      precioPorKilo: precioPorKilo || 0,
      precioUnitario: precioUnitario || 0,
      litrosVendidos: litrosVendidos || 0,
      industriaCompradora,
      detalleOtros,
      montoSubtotal: montoSubtotal || 0,
      tasaIVA: tasaIVA || 0,
      comprador,
      facturaElectronica,
      cuatrimestre: obtenerCuatrimestre(fechaObj),
      periodoFiscal: fechaObj.getFullYear(),
      usuario: req.usuario._id,
    }));

    res.status(201).json(ingreso);
  } catch (error) { next(error); }
};

const actualizarIngreso = async (req, res, next) => {
  try {
    const ingreso = await Ingreso.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!ingreso) { res.status(404); throw new Error('Ingreso no encontrado'); }

    const campos = [
      'fecha', 'descripcion', 'categoriaIngreso', 'tipoGanado', 'cantidadCabezas',
      'pesoTotal', 'precioPorKilo', 'precioUnitario', 'litrosVendidos',
      'industriaCompradora', 'detalleOtros', 'montoSubtotal', 'tasaIVA',
      'comprador', 'facturaElectronica'
    ];
    campos.forEach(c => { if (req.body[c] !== undefined) ingreso[c] = req.body[c]; });

    if (req.body.fecha) {
      const f = new Date(req.body.fecha);
      ingreso.fecha = f;
      ingreso.cuatrimestre = obtenerCuatrimestre(f);
      ingreso.periodoFiscal = f.getFullYear();
    }

    const actualizado = await ingreso.save();
    res.json(actualizado);
  } catch (error) { next(error); }
};

const eliminarIngreso = async (req, res, next) => {
  try {
    const ingreso = await Ingreso.findOneAndDelete({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!ingreso) { res.status(404); throw new Error('Ingreso no encontrado'); }
    res.json({ mensaje: 'Ingreso eliminado correctamente' });
  } catch (error) { next(error); }
};

module.exports = { obtenerIngresos, obtenerIngresoPorId, crearIngreso, actualizarIngreso, eliminarIngreso };
