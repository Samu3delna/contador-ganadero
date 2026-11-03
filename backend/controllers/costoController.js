const { obtenerOCrear } = require('../services/tenantSingleton');
const CostoProduccion = require('../models/CostoProduccion');

// ============ CENTROS DE COSTO ============

const obtenerCostos = async (req, res, next) => {
  try {
    const { periodoFiscal } = req.query;
    const anio = Number(periodoFiscal || new Date().getFullYear());
    const costos = await obtenerOCrear(CostoProduccion, req, { periodoFiscal: anio });
    res.json(costos);
  } catch (error) { next(error); }
};

const crearCentroCosto = async (req, res, next) => {
  try {
    const { referenciaId, tipoActividad, nombreLote, fechaInicio } = req.body;
    const anio = new Date(fechaInicio || Date.now()).getFullYear();

    const costos = await obtenerOCrear(CostoProduccion, req, { periodoFiscal: anio });

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
    const { tipoInsumo, descripcion, cantidad, unidadMedida, pesoUnidadKg, costoUnitario, proveedor, facturaRef } = req.body;
    const periodoFiscal = Number(req.body.periodoFiscal ?? req.query.periodoFiscal);
    if (!Number.isInteger(periodoFiscal) || periodoFiscal < 2000 || periodoFiscal > 2100) return res.status(400).json({ error: 'periodoFiscal es obligatorio (2000..2100)' });
    const costos = await CostoProduccion.findOne(req.filtrarPorTenant({ periodoFiscal, 'centrosCosto.referenciaId': referenciaId }));
    if (!costos) { res.status(404); throw new Error('No existe registro de costos para este año'); }

    const centro = costos.centrosCosto.find(c => c.referenciaId === referenciaId);
    if (!centro) { res.status(404); throw new Error('Centro de costo no encontrado'); }

    const costoTotal = Math.round((cantidad * costoUnitario) * 100) / 100;
    centro.consumos.push({ tipoInsumo, descripcion, cantidad, unidadMedida, pesoUnidadKg, costoUnitario, costoTotal, proveedor, facturaRef });

    costos.recalcularIndicadoresCentro(referenciaId);
    await costos.save();
    res.status(201).json(centro);
  } catch (error) { next(error); }
};

const agregarProduccion = async (req, res, next) => {
  try {
    const { referenciaId } = req.params;
    const { tipoProducto, cantidad, unidadMedida, ingresoBrutoVenta } = req.body;
    const periodoFiscal = Number(req.body.periodoFiscal ?? req.query.periodoFiscal);
    if (!Number.isInteger(periodoFiscal) || periodoFiscal < 2000 || periodoFiscal > 2100) return res.status(400).json({ error: 'periodoFiscal es obligatorio (2000..2100)' });
    const costos = await CostoProduccion.findOne(req.filtrarPorTenant({ periodoFiscal, 'centrosCosto.referenciaId': referenciaId }));
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
    const periodoFiscal = Number(req.body.periodoFiscal ?? req.query.periodoFiscal);
    if (!Number.isInteger(periodoFiscal) || periodoFiscal < 2000 || periodoFiscal > 2100) return res.status(400).json({ error: 'periodoFiscal es obligatorio (2000..2100)' });
    const costos = await CostoProduccion.findOne(req.filtrarPorTenant({ periodoFiscal, 'centrosCosto.referenciaId': referenciaId }));
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
