const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const { calcularProyeccion } = require('../services/impuestoService');

const resumen = async (req, res, next) => {
  try {
    let anio = Number(req.query.anio);
    if (!anio) {
      const ultima = await Factura.findOne(req.filtrarPorTenant()).sort({ fechaEmision: -1 });
      anio = ultima ? ultima.periodoFiscal : new Date().getFullYear();
    }
    const proyeccion = await calcularProyeccion(req.usuario._id, anio);
    res.json(proyeccion);
  } catch (error) { next(error); }
};

const gastosPorCategoria = async (req, res, next) => {
  try {
    let anio = Number(req.query.anio);
    if (!anio) {
      const ultima = await Factura.findOne(req.filtrarPorTenant()).sort({ fechaEmision: -1 });
      anio = ultima ? ultima.periodoFiscal : new Date().getFullYear();
    }
    const filtro = { ...req.filtrarPorTenant(), estado: { $ne: 'error' }, periodoFiscal: anio };
    const resultado = await Factura.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: { $ifNull: ['$categoriaManual', '$categoriaIA'] },
          totalGasto: { $sum: '$resumenFactura.totalComprobante' },
          totalIVA: { $sum: '$resumenFactura.totalImpuesto' },
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { totalGasto: -1 } },
    ]);

    res.json(resultado.map(r => ({
      categoria: r._id || 'sin_clasificar',
      totalGasto: Math.round(r.totalGasto),
      totalIVA: Math.round(r.totalIVA),
      cantidad: r.cantidad,
    })));
  } catch (error) { next(error); }
};

const tendenciaMensual = async (req, res, next) => {
  try {
    let anio = Number(req.query.anio);
    if (!anio) {
      const ultima = await Factura.findOne(req.filtrarPorTenant()).sort({ fechaEmision: -1 });
      anio = ultima ? ultima.periodoFiscal : new Date().getFullYear();
    }
    const [gastosMensuales, ingresosMensuales] = await Promise.all([
      Factura.aggregate([
        { $match: { ...req.filtrarPorTenant(), periodoFiscal: anio, estado: { $ne: 'error' } } },
        { $group: { _id: { $month: '$fechaEmision' }, total: { $sum: '$resumenFactura.totalComprobante' } } },
        { $sort: { '_id': 1 } },
      ]),
      Ingreso.aggregate([
        { $match: { ...req.filtrarPorTenant(), periodoFiscal: anio } },
        { $group: { _id: { $month: '$fecha' }, total: { $sum: '$montoTotal' } } },
        { $sort: { '_id': 1 } },
      ]),
    ]);

    // Construir array de 12 meses
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const tendencia = meses.map((nombre, i) => {
      const mesNum = i + 1;
      const gasto = gastosMensuales.find(g => g._id === mesNum);
      const ingreso = ingresosMensuales.find(g => g._id === mesNum);
      return {
        mes: nombre,
        gastos: Math.round(gasto?.total || 0),
        ingresos: Math.round(ingreso?.total || 0),
      };
    });

    res.json(tendencia);
  } catch (error) { next(error); }
};

module.exports = { resumen, gastosPorCategoria, tendenciaMensual };
