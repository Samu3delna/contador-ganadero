const Usuario = require('../models/Usuario');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const Declaracion = require('../models/Declaracion');
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

// === GENERAR Y GUARDAR DECLARACIÓN ===

const generarDeclaracion = async (req, res, next) => {
  try {
    const { tipo, periodoFiscal, cuatrimestre } = req.body;
    if (!tipo || !periodoFiscal) {
      res.status(400);
      throw new Error('tipo y periodoFiscal son requeridos');
    }

    const anioNum = Number(periodoFiscal);

    if (tipo === 'D-135-1') {
      if (!cuatrimestre) { res.status(400); throw new Error('cuatrimestre es requerido para IVA'); }
      const cuatNum = Number(cuatrimestre);
      const iva = await calcularIVACuatrimestral(req.usuario._id, cuatNum, anioNum);

      // Upsert: si ya existe una borrador/calculada para este periodo, actualizarla
      const existente = await Declaracion.findOneAndUpdate(
        { ...req.filtrarPorTenant({ tipo: 'D-135-1', periodoFiscal: anioNum, cuatrimestre: cuatNum, estado: { $in: ['borrador', 'calculada'] } }) },
        {
          ivaCobrado: iva.ivaCobrado,
          ivaPagado: iva.ivaPagado,
          ivaResultante: iva.ivaResultante,
          detalleIVAPorTasa: iva.detalleIVAPorTasa,
          estado: 'calculada',
        },
        { new: true }
      );

      if (existente) {
        return res.json({ mensaje: 'Declaración IVA actualizada', declaracion: existente });
      }

      const nueva = await Declaracion.create(req.aplicarTenant({
        tipo: 'D-135-1',
        periodoFiscal: anioNum,
        cuatrimestre: cuatNum,
        ivaCobrado: iva.ivaCobrado,
        ivaPagado: iva.ivaPagado,
        ivaResultante: iva.ivaResultante,
        detalleIVAPorTasa: iva.detalleIVAPorTasa,
        estado: 'calculada',
        usuario: req.usuario._id,
      }));

      return res.status(201).json({ mensaje: 'Declaración IVA creada', declaracion: nueva });
    }

    if (tipo === 'D-101') {
      const renta = await calcularRentaAnual(req.usuario._id, anioNum);

      // Calcular depreciación de activos
      const usuario = await Usuario.findById(req.usuario._id).select('configuracionFiscal');
      let depreciacionTotal = 0;
      if (usuario.configuracionFiscal?.depreciacionActivos?.length > 0) {
        depreciacionTotal = usuario.configuracionFiscal.depreciacionActivos.reduce((sum, act) => {
          if (act.activo && act.valorOriginal > 0 && act.vidaUtilAnios > 0) {
            return sum + (act.valorOriginal / act.vidaUtilAnios);
          }
          return sum;
        }, 0);
      }

      const existente = await Declaracion.findOneAndUpdate(
        { ...req.filtrarPorTenant({ tipo: 'D-101', periodoFiscal: anioNum, estado: { $in: ['borrador', 'calculada'] } }) },
        {
          ingresosBrutos: renta.ingresosBrutos,
          gastosDeducibles: renta.gastosDeducibles,
          utilidadNeta: renta.utilidadNeta,
          montoExento: renta.montoExento,
          rentaImponible: renta.rentaImponible,
          impuestoCalculado: renta.impuestoCalculado,
          creditosFiscales: renta.creditosFiscales,
          detalleTramos: renta.detalleTramos,
          impuestoFinal: renta.impuestoFinal,
          estado: 'calculada',
        },
        { new: true }
      );

      if (existente) {
        return res.json({ mensaje: 'Declaración Renta actualizada', declaracion: { ...existente.toObject(), depreciacionTotal: Math.round(depreciacionTotal) } });
      }

      const nueva = await Declaracion.create(req.aplicarTenant({
        tipo: 'D-101',
        periodoFiscal: anioNum,
        ingresosBrutos: renta.ingresosBrutos,
        gastosDeducibles: renta.gastosDeducibles,
        utilidadNeta: renta.utilidadNeta,
        montoExento: renta.montoExento,
        rentaImponible: renta.rentaImponible,
        impuestoCalculado: renta.impuestoCalculado,
        creditosFiscales: renta.creditosFiscales,
        detalleTramos: renta.detalleTramos,
        impuestoFinal: renta.impuestoFinal,
        estado: 'calculada',
        usuario: req.usuario._id,
      }));

      return res.status(201).json({ mensaje: 'Declaración Renta creada', declaracion: { ...nueva.toObject(), depreciacionTotal: Math.round(depreciacionTotal) } });
    }

    res.status(400);
    throw new Error('Tipo de declaración no válido');
  } catch (error) { next(error); }
};

// === LISTAR DECLARACIONES ===

const listarDeclaraciones = async (req, res, next) => {
  try {
    const { tipo, anio, page = 1, limit = 20 } = req.query;
    const filtro = req.filtrarPorTenant();
    if (tipo) filtro.tipo = tipo;
    if (anio) filtro.periodoFiscal = Number(anio);

    const skip = (Number(page) - 1) * Number(limit);
    const [declaraciones, total] = await Promise.all([
      Declaracion.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Declaracion.countDocuments(filtro),
    ]);

    res.json({ declaraciones, total, pagina: Number(page), totalPaginas: Math.ceil(total / Number(limit)) });
  } catch (error) { next(error); }
};

// === OBTENER DECLARACIÓN POR ID ===

const obtenerDeclaracion = async (req, res, next) => {
  try {
    const declaracion = await Declaracion.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!declaracion) { res.status(404); throw new Error('Declaración no encontrada'); }

    // Si es Renta, calcular depreciación al vuelo para mostrarla
    let depreciacionTotal = 0;
    if (declaracion.tipo === 'D-101') {
      const usuario = await Usuario.findById(req.usuario._id).select('configuracionFiscal');
      if (usuario.configuracionFiscal?.depreciacionActivos?.length > 0) {
        depreciacionTotal = usuario.configuracionFiscal.depreciacionActivos.reduce((sum, act) => {
          if (act.activo && act.valorOriginal > 0 && act.vidaUtilAnios > 0) {
            return sum + (act.valorOriginal / act.vidaUtilAnios);
          }
          return sum;
        }, 0);
      }
    }

    res.json({ ...declaracion.toObject(), depreciacionTotal: Math.round(depreciacionTotal) });
  } catch (error) { next(error); }
};

// === ACTUALIZAR ESTADO ===

const actualizarEstadoDeclaracion = async (req, res, next) => {
  try {
    const { estado } = req.body;
    const declaracion = await Declaracion.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!declaracion) { res.status(404); throw new Error('Declaración no encontrada'); }
    declaracion.estado = estado;
    await declaracion.save();
    res.json({ mensaje: `Estado actualizado a ${estado}`, declaracion });
  } catch (error) { next(error); }
};

// === ELIMINAR DECLARACIÓN ===

const eliminarDeclaracion = async (req, res, next) => {
  try {
    const declaracion = await Declaracion.findOneAndDelete({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!declaracion) { res.status(404); throw new Error('Declaración no encontrada'); }
    res.json({ mensaje: 'Declaración eliminada' });
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
  generarDeclaracion,
  listarDeclaraciones,
  obtenerDeclaracion,
  actualizarEstadoDeclaracion,
  eliminarDeclaracion,
  exportarDatos,
  obtenerGastosDeducibles,
  obtenerIngresosDeclaracion,
};
