/** FEC: el comprador genera y firma; XML Emisor=proveedor, Receptor=comprador.
 * La API conserva los nombres del formulario: emisor=comprador, receptor=proveedor. */

const FacturaEmision = require('../models/FacturaEmision');
const hacienda = require('../services/hacienda');
const haciendaWorker = require('../services/haciendaWorker');
const Tenant = require('../models/Tenant');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');

const TIPO_FEC = 'FEC';

// ============ CREAR FEC ============
const crearFec = async (req, res, next) => {
  try {
    const {
      emisor,        // El comprador (quien genera la FEC para respaldar gasto)
      receptor,      // El vendedor (productor sin FE que le vendió ganado/insumos)
      lineaDetalle,  // Detalle de la compra
      condicionVenta = '01',
      medioPago = ['04'],
      plazoCredito,
      referencia, documentoReferencia, moneda, tipoCambio,
    } = req.body;

    if (!emisor || !receptor || !lineaDetalle || lineaDetalle.length === 0) {
      res.status(400);
      throw new Error('Faltan campos: emisor (comprador), receptor (vendedor), lineaDetalle');
    }
    // CABYS obligatorio
    for (const l of lineaDetalle) {
      if (!/^\d{13}$/.test(String(l.codigo || ''))) {
        res.status(400);
        throw new Error(`Linea sin CABYS de 13 digitos: ${l.descripcion || '(sin descripcion)'}`);
      }
    }

    // Receptor (vendedor) debe estar identificado
    if (!receptor.cedula?.numero) {
      res.status(400);
      throw new Error('La FEC requiere identificacion del receptor (vendedor)');
    }

    if (!documentoReferencia?.numeroReferencia) { res.status(400); throw new Error('Indique el documento de referencia de la compra'); }
    const tenant = await Tenant.findById(req.tenant._id);
    const cfg = haciendaWorker.getTenantConfig(tenant, { conSecretos: false });
    const fechaEmision = new Date();
    const cuatrimestre = obtenerCuatrimestre(fechaEmision);
    const seqNum = await tenant.siguienteConsecutivo(TIPO_FEC);
    const consecutivo = hacienda.clave50.generarConsecutivo({ ...cfg, tipoDocumento: TIPO_FEC, secuencia: seqNum });

    const nuevoFec = await FacturaEmision.create(req.aplicarTenant({
      tipoDocumento: TIPO_FEC,
      ambiente: cfg.ambiente,
      proveedorSistemas: cfg.proveedorSistemas, codigoActividadReceptor: cfg.codigoActividad,
      documentoReferencia, moneda, tipoCambio,
      consecutivo,
      emisor: receptor,
      receptor: emisor,
      lineaDetalle,
      tipoProducto: 'otros_productos_rea',
      condicionVenta,
      medioPago,
      plazoCredito,
      referencia,
      esFacturaREA: false,
      fechaEmision,
      cuatrimestre,
      periodoFiscal: fechaEmision.getFullYear(),
      estado: 'borrador',
      usuario: req.usuario._id,
    }));

    res.status(201).json(nuevoFec);
  } catch (error) { next(error); }
};

// ============ LISTAR FEC ============
const listarFec = async (req, res, next) => {
  try {
    const { periodoFiscal, estado, page = 1, limit = 20 } = req.query;
    const filtro = { ...req.filtrarPorTenant(), tipoDocumento: TIPO_FEC };
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (estado) filtro.estado = estado;
    const { skip, pageNum, limitNum } = require('../utils/paginacion').paginacion({ page, limit });
    const [docs, total] = await Promise.all([
      FacturaEmision.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(limitNum),
      FacturaEmision.countDocuments(filtro),
    ]);
    res.json({ docs, total, pagina: pageNum, totalPaginas: Math.ceil(total / limitNum) });
  } catch (error) { next(error); }
};

// ============ RESUMEN COMPRAS (para D-150: credito fiscal) ============
const resumenCompras = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre } = req.query;
    const anioNum = Number(periodoFiscal || new Date().getFullYear());
    const filtro = {
      ...req.filtrarPorTenant(),
      tipoDocumento: TIPO_FEC,
      estado: 'aceptada',
      periodoFiscal: anioNum,
    };
    if (cuatrimestre) filtro.cuatrimestre = Number(cuatrimestre);

    const docs = await FacturaEmision.find(filtro).sort({ fechaEmision: 1 });

    // Agrupar por tarifa de IVA (credito fiscal soportado)
    const porTarifa = {};
    let totalCompras = 0;
    let totalIVA = 0;
    for (const d of docs) {
      for (const l of d.lineaDetalle || []) {
        const tarifa = l.impuesto?.tarifa || 0;
        const key = String(tarifa);
        if (!porTarifa[key]) porTarifa[key] = { base: 0, iva: 0, count: 0 };
        porTarifa[key].base += l.subtotal || 0;
        porTarifa[key].iva += l.impuesto?.monto || 0;
        porTarifa[key].count += 1;
      }
      totalCompras += d.resumenFactura?.totalComprobante || 0;
      totalIVA += d.resumenFactura?.totalImpuesto || 0;
    }

    res.json({
      periodoFiscal: anioNum,
      cantidad: docs.length,
      totalCompras,
      totalIVACreditoFiscal: totalIVA,
      porTarifa,
    });
  } catch (error) { next(error); }
};

module.exports = {
  crearFec,
  listarFec,
  resumenCompras,
};
