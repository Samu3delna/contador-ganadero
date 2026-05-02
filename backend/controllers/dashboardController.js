const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const { calcularProyeccion } = require('../services/impuestoService');

const resumen = async (req, res, next) => {
  try {
    const proyeccion = await calcularProyeccion(req.usuario._id);
    res.json(proyeccion);
  } catch (error) { next(error); }
};

const gastosPorCategoria = async (req, res, next) => {
  try {
    const { anio } = req.query;
    const filtro = { usuario: req.usuario._id, estado: { $ne: 'error' } };
    if (anio) {
      filtro.periodoFiscal = Number(anio);
    }
    const resultado = await Factura.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: '$categoriaIA',
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
    const anio = Number(req.query.anio) || new Date().getFullYear();
    const [gastosMensuales, ingresosMensuales] = await Promise.all([
      Factura.aggregate([
        { $match: { usuario: req.usuario._id, periodoFiscal: anio, estado: { $ne: 'error' } } },
        { $group: { _id: { $month: '$fechaEmision' }, total: { $sum: '$resumenFactura.totalComprobante' } } },
        { $sort: { '_id': 1 } },
      ]),
      Ingreso.aggregate([
        { $match: { usuario: req.usuario._id, periodoFiscal: anio } },
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
