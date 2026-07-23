const CostoProduccion = require('../models/CostoProduccion');

// ============ CENTROS DE COSTO ============

const obtenerCostos = async (req, res, next) => {
  try {
    const { periodoFiscal } = req.query;
    const anio = Number(periodoFiscal || new Date().getFullYear());
    let costos = await CostoProduccion.findOne(req.filtrarPorTenant({ periodoFiscal: anio }));
    if (!costos) {
      costos = await CostoProduccion.create(req.aplicarTenant({ usuario: req.usuario._id, periodoFiscal: anio, centrosCosto: [] }));
    }
    res.json(costos);
  } catch (error) { next(error); }
};

const crearCentroCosto = async (req, res, next) => {
  try {
    const { referenciaId, tipoActividad, nombreLote, fechaInicio } = req.body;
    const anio = new Date(fechaInicio || Date.now()).getFullYear();

    let costos = await CostoProduccion.findOne(req.filtrarPorTenant({ periodoFiscal: anio }));
    if (!costos) costos = await CostoProduccion.create(req.aplicarTenant({ usuario: req.usuario._id, periodoFiscal: anio, centrosCosto: [] }));

    const existe = costos.centrosCosto.find(c => c.referenciaId === referenciaId);
    if (existe) { res.status(400); throw new Error('Ya existe un centro de costo con esa referencia'); }

    costos.centrosCosto.push({ referenciaId, tipoActividad, nombreLote, fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date() });
    await costos.save();
    res.status(201).json(costos.centrosCosto[costos.centrosCosto.length - 1]);
  } catch (error) { next(error); }
};

const agregarConsumo = async (req, res, next) => {
  try {
    const { referenciaId } = req.params;
    const { tipoInsumo, descripcion, cantidad, unidadMedida, costoUnitario, proveedor, facturaRef } = req.body;
    const costos = await CostoProduccion.findOne(req.filtrarPorTenant({ 'centrosCosto.referenciaId': referenciaId }));
    if (!costos) { res.status(404); throw new Error('No existe registro de costos para este año'); }

    const centro = costos.centrosCosto.find(c => c.referenciaId === referenciaId);
    if (!centro) { res.status(404); throw new Error('Centro de costo no encontrado'); }

    const costoTotal = Math.round((cantidad * costoUnitario) * 100) / 100;
    centro.consumos.push({ tipoInsumo, descripcion, cantidad, unidadMedida, costoUnitario, costoTotal, proveedor, facturaRef });

    costos.recalcularIndicadoresCentro(referenciaId);
    await costos.save();
    res.status(201).json(centro);
  } catch (error) { next(error); }
};

const agregarProduccion = async (req, res, next) => {
  try {
    const { referenciaId } = req.params;
    const { tipoProducto, cantidad, unidadMedida, ingresoBrutoVenta } = req.body;
    const costos = await CostoProduccion.findOne(req.filtrarPorTenant({ 'centrosCosto.referenciaId': referenciaId }));
    if (!costos) { res.status(404); throw new Error('No existe registro de costos para este año'); }

    const centro = costos.centrosCosto.find(c => c.referenciaId === referenciaId);
    if (!centro) { res.status(404); throw new Error('Centro de costo no encontrado'); }

    centro.producciones.push({ tipoProducto, cantidad, unidadMedida, ingresoBrutoVenta });
    costos.recalcularIndicadoresCentro(referenciaId);
    await costos.save();
    res.status(201).json(centro);
  } catch (error) { next(error); }
};

const cerrarCentroCosto = async (req, res, next) => {
  try {
    const { referenciaId } = req.params;
    const costos = await CostoProduccion.findOne(req.filtrarPorTenant({ 'centrosCosto.referenciaId': referenciaId }));
    if (!costos) { res.status(404); throw new Error('No existe registro de costos'); }

    const centro = costos.centrosCosto.find(c => c.referenciaId === referenciaId);
    if (!centro) { res.status(404); throw new Error('Centro de costo no encontrado'); }

    centro.activo = false;
    centro.fechaCierre = new Date();
    costos.recalcularIndicadoresCentro(referenciaId);
    await costos.save();
    res.json(centro);
  } catch (error) { next(error); }
};

// ============ RESUMEN GLOBAL ============

const obtenerResumenCostos = async (req, res, next) => {
  try {
    const { periodoFiscal } = req.query;
    const anio = Number(periodoFiscal || new Date().getFullYear());
    const costos = await CostoProduccion.findOne(req.filtrarPorTenant({ periodoFiscal: anio }));
    if (!costos) return res.json({ periodoFiscal: anio, resumenGlobal: {}, centrosCosto: [] });

    res.json({
      periodoFiscal: anio,
      resumenGlobal: costos.resumenGlobal,
      centrosCosto: costos.centrosCosto.map(c => ({
        referenciaId: c.referenciaId,
        tipoActividad: c.tipoActividad,
        nombreLote: c.nombreLote,
        activo: c.activo,
        indicadores: c.indicadores,
      })),
    });
  } catch (error) { next(error); }
};

module.exports = {
  obtenerCostos,
  crearCentroCosto,
  agregarConsumo,
  agregarProduccion,
  cerrarCentroCosto,
  obtenerResumenCostos,
};
