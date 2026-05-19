const Usuario = require('../models/Usuario');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const { generarDatosExportacion, generarCSV } = require('../services/declaracionService');
const { calcularIVACuatrimestral, calcularRentaAnual } = require('../services/impuestoService');

// === CONFIGURACIÓN FISCAL ===

const obtenerConfiguracionFiscal = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('configuracionFiscal nombre nombreFinca cedula');
    if (!usuario) { res.status(404); throw new Error('Usuario no encontrado'); }
    res.json({
      actividadEconomica: usuario.configuracionFiscal?.actividadEconomica || '',
      regimenTributario: usuario.configuracionFiscal?.regimenTributario || 'Régimen Especial Agropecuario (REA)',
      frecuenciaIVA: usuario.configuracionFiscal?.frecuenciaIVA || 'cuatrimestral',
      depreciacionActivos: usuario.configuracionFiscal?.depreciacionActivos || [],
      nombre: usuario.nombre,
      nombreFinca: usuario.nombreFinca,
      cedula: usuario.cedula,
    });
  } catch (error) { next(error); }
};

const actualizarConfiguracionFiscal = async (req, res, next) => {
  try {
    const { actividadEconomica, regimenTributario, frecuenciaIVA, depreciacionActivos } = req.body;
    const usuario = await Usuario.findById(req.usuario._id);
    if (!usuario) { res.status(404); throw new Error('Usuario no encontrado'); }

    if (!usuario.configuracionFiscal) usuario.configuracionFiscal = {};
    if (actividadEconomica !== undefined) usuario.configuracionFiscal.actividadEconomica = actividadEconomica;
    if (regimenTributario !== undefined) usuario.configuracionFiscal.regimenTributario = regimenTributario;
    if (frecuenciaIVA !== undefined) usuario.configuracionFiscal.frecuenciaIVA = frecuenciaIVA;
    if (depreciacionActivos !== undefined) usuario.configuracionFiscal.depreciacionActivos = depreciacionActivos;

    await usuario.save();
    res.json({ mensaje: 'Configuración fiscal actualizada', configuracionFiscal: usuario.configuracionFiscal });
  } catch (error) { next(error); }
};

// === RESUMEN PARA DECLARACIONES ===

const obtenerResumenDeclaracion = async (req, res, next) => {
  try {
    const { anio, cuatrimestre } = req.query;
    const anioNum = Number(anio || new Date().getFullYear());
    const cuatNum = cuatrimestre ? Number(cuatrimestre) : null;

    const usuario = await Usuario.findById(req.usuario._id).select('configuracionFiscal');

    const [iva, renta] = await Promise.all([
      cuatNum ? calcularIVACuatrimestral(req.usuario._id, cuatNum, anioNum) : null,
      calcularRentaAnual(req.usuario._id, anioNum),
    ]);

    // Calcular depreciación anual de activos
    let depreciacionTotal = 0;
    if (usuario.configuracionFiscal?.depreciacionActivos?.length > 0) {
      depreciacionTotal = usuario.configuracionFiscal.depreciacionActivos.reduce((sum, act) => {
        if (act.activo && act.valorOriginal > 0 && act.vidaUtilAnios > 0) {
          return sum + (act.valorOriginal / act.vidaUtilAnios);
        }
        return sum;
      }, 0);
    }

    res.json({
      configuracion: usuario.configuracionFiscal,
      iva,
      renta: { ...renta, depreciacionTotal: Math.round(depreciacionTotal) },
      periodo: { anio: anioNum, cuatrimestre: cuatNum },
    });
  } catch (error) { next(error); }
};

// === EXPORTACIÓN ===

const exportarDatos = async (req, res, next) => {
  try {
    const { anio, cuatrimestre, formato } = req.query;
    const anioNum = Number(anio || new Date().getFullYear());
    const cuatNum = cuatrimestre ? Number(cuatrimestre) : null;
    const formatoExp = formato || 'csv';

    const datos = await generarDatosExportacion(req.usuario._id, anioNum, cuatNum);

    if (formatoExp === 'csv') {
      const csv = generarCSV(datos);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="declaracion_${anioNum}${cuatNum ? '_Q' + cuatNum : ''}.csv"`);
      // BOM para Excel reconozca UTF-8
      res.send('\uFEFF' + csv);
    } else {
      res.json({ datos, totalRegistros: datos.length });
    }
  } catch (error) { next(error); }
};

// === LISTA DE GASTOS DEDUCIBLES ===

const obtenerGastosDeducibles = async (req, res, next) => {
  try {
    const { anio, cuatrimestre, deducible, page = 1, limit = 50 } = req.query;
    const filtro = { usuario: req.usuario._id };
    
    if (anio) {
      filtro.periodoFiscal = Number(anio);
    }
    if (cuatrimestre) {
      filtro.cuatrimestre = Number(cuatrimestre);
    }
    if (deducible !== undefined) {
      filtro.esDeducible = deducible === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [facturas, total] = await Promise.all([
      Factura.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(Number(limit)).lean(),
      Factura.countDocuments(filtro),
    ]);

    const gastos = facturas.map(f => ({
      _id: f._id,
      fecha: f.fechaEmision,
      emisor: f.emisor,
      subtotal: f.resumenFactura?.totalVenta || 0,
      iva: f.resumenFactura?.totalImpuesto || 0,
      total: f.resumenFactura?.totalComprobante || 0,
      categoria: f.categoriaManual || f.categoriaIA,
      esDeducible: f.esDeducible,
      motivoNoDeducible: f.motivoNoDeducible,
      numComprobante: f.consecutivo || f.claveNumerica,
      descripcion: (f.lineaDetalle || []).map(l => l.descripcion).join('; '),
    }));

    const totalDeducible = gastos.filter(g => g.esDeducible).reduce((s, g) => s + g.total, 0);
    const totalNoDeducible = gastos.filter(g => !g.esDeducible).reduce((s, g) => s + g.total, 0);

    res.json({
      gastos,
      total,
      pagina: Number(page),
      totalPaginas: Math.ceil(total / Number(limit)),
      resumen: { totalDeducible, totalNoDeducible },
    });
  } catch (error) { next(error); }
};

// === LISTA DE INGRESOS ===

const obtenerIngresosDeclaracion = async (req, res, next) => {
  try {
    const { anio, cuatrimestre, categoria, page = 1, limit = 50 } = req.query;
    const filtro = { usuario: req.usuario._id };
    
    if (anio) filtro.periodoFiscal = Number(anio);
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);
    if (categoria) filtro.categoriaIngreso = categoria;

    const skip = (Number(page) - 1) * Number(limit);
    const [ingresos, total] = await Promise.all([
      Ingreso.find(filtro).sort({ fecha: -1 }).skip(skip).limit(Number(limit)).lean(),
      Ingreso.countDocuments(filtro),
    ]);

    const totalIVACobrado = ingresos.reduce((s, i) => s + (i.ivaVenta || 0), 0);
    const totalIngresos = ingresos.reduce((s, i) => s + (i.montoSubtotal || 0), 0);

    res.json({
      ingresos,
      total,
      pagina: Number(page),
      totalPaginas: Math.ceil(total / Number(limit)),
      resumen: { totalIngresos, totalIVACobrado },
    });
  } catch (error) { next(error); }
};

module.exports = {
  obtenerConfiguracionFiscal,
  actualizarConfiguracionFiscal,
  obtenerResumenDeclaracion,
  exportarDatos,
  obtenerGastosDeducibles,
  obtenerIngresosDeclaracion,
};
