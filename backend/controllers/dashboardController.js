const { obtenerFuentes } = require('../services/contabilidadService');
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
    const proyeccion = await calcularProyeccion(req.usuario._id, anio, req.tenant?._id);
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
    const { facturas } = await obtenerFuentes({ usuarioId: req.usuario._id, tenantId: req.tenant._id,
      inicio: new Date(`${anio}-01-01T06:00:00Z`), fin: new Date(`${anio+1}-01-01T05:59:59.999Z`) });
    const categorias = new Map();
    for (const f of facturas) {
      const categoria = f.categoriaManual || f.categoriaIA || 'sin_clasificar';
      const r = categorias.get(categoria) || { _id: categoria, totalGasto: 0, totalIVA: 0, cantidad: 0 };
      r.totalGasto += f.resumenFactura.totalComprobante; r.totalIVA += f.resumenFactura.totalImpuesto; r.cantidad++;
      categorias.set(categoria, r);
    }
    const resultado = [...categorias.values()].sort((a,b) => b.totalGasto-a.totalGasto);

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
    const { facturas, ingresos } = await obtenerFuentes({ usuarioId: req.usuario._id, tenantId: req.tenant._id,
      inicio: new Date(`${anio}-01-01T06:00:00Z`), fin: new Date(`${anio+1}-01-01T05:59:59.999Z`) });
    const porMes = (docs, fecha, monto) => {
      const resultado = new Map();
      for (const doc of docs) {
        const mes = Number(new Intl.DateTimeFormat('en',{timeZone:'America/Costa_Rica',month:'numeric'}).format(new Date(doc[fecha])));
        resultado.set(mes,(resultado.get(mes)||0)+monto(doc));
      }
      return [...resultado].map(([_id,total])=>({_id,total}));
    };
    const gastosMensuales = porMes(facturas,'fechaEmision',f=>f.resumenFactura.totalComprobante);
    const ingresosMensuales = porMes(ingresos,'fecha',i=>i.montoTotal);

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
