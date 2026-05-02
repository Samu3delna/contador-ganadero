const { calcularIVACuatrimestral, calcularRentaAnual, calcularProyeccion } = require('../services/impuestoService');

const calcularIVA = async (req, res, next) => {
  try {
    const { cuatrimestre, anio } = req.params;
    const resultado = await calcularIVACuatrimestral(req.usuario._id, Number(cuatrimestre), Number(anio));
    res.json(resultado);
  } catch (error) { next(error); }
};

const calcularRenta = async (req, res, next) => {
  try {
    const resultado = await calcularRentaAnual(req.usuario._id, Number(req.params.anio));
    res.json(resultado);
  } catch (error) { next(error); }
};

const proyeccion = async (req, res, next) => {
  try {
    const resultado = await calcularProyeccion(req.usuario._id);
    res.json(resultado);
  } catch (error) { next(error); }
};

module.exports = { calcularIVA, calcularRenta, proyeccion };
