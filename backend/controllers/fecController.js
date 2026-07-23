/**
 * Controller dedicado para Factura Electronica de Compra (FEC).
 *
 * La FEC procede cuando el emisor en su contabilidad tiene que respaldar
 * un gasto (ej. compra de ganado a un productor del régimen simplificado
 * que no emite FE). En la FEC el ROL se invierte: el emisor es quien
 * genera la FEC pero como "comprador"; el "receptor" (campo receptor de
 * la FEC) es el vendedor original.  En la práctica el nodo <Receptor>
 * lleva al vendedor y <Emisor> a quien emite la FEC (comprador).
 *
 * Complejidad: Hacienda pide que la FEC siempre lleve tanto emisor como
 * receptor; ademas, si desconoce al receptor (no está inscrito), hay
 * que usar Identificacion Extranjera. Para tipica ganadera CR se asume
 * receptor conocido.
 *
 * Flujo:
 *   1. POST /api/hacienda/fec              Crea FEC
 *   2. Firmar/enviar: mismo que FE (worker utiliza tipoDocumento=FEC)
 */

const FacturaEmision = require('../models/FacturaEmision');
const hacienda = require('../services/hacienda');
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
      referencia,
    } = req.body;

    if (!emisor || !receptor || !lineaDetalle || lineaDetalle.length === 0) {
      res.status(400);
      throw new Error('Faltan campos: emisor (comprador), receptor (vendedor), lineaDetalle');
    }
    // CABYS obligatorio
    for (const l of lineaDetalle) {
      if (!l.codigo || String(l.codigo).length !== 13) {
        res.status(400);
        throw new Error(`Linea sin CABYS de 13 digitos: ${l.descripcion || '(sin descripcion)'}`);
      }
    }

    // Receptor (vendedor) debe estar identificado
    if (!receptor.cedula?.numero) {
      res.status(400);
      throw new Error('La FEC requiere identificacion del receptor (vendedor)');
    }

    const fechaEmision = new Date();
    const cuatrimestre = obtenerCuatrimestre(fechaEmision);
    const consecutivo = `00100001${hacienda.clave50.TIPO_DOC_CODIGO[TIPO_FEC]}${String(Date.now()).slice(-10)}`;

    const nuevoFec = await FacturaEmision.create({
      tipoDocumento: TIPO_FEC,
      ambiente: process.env.HACIENDA_AMBIENTE || 'local',
      consecutivo,
      emisor,
      receptor,
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
    });

    res.status(201).json(nuevoFec);
  } catch (error) { next(error); }
};

// ============ LISTAR FEC ============
const listarFec = async (req, res, next) => {
  try {
    const { periodoFiscal, estado, page = 1, limit = 20 } = req.query;
    const filtro = { usuario: req.usuario._id, tipoDocumento: TIPO_FEC };
    if (periodoFiscal) filtro.periodoFiscal = Number(periodoFiscal);
    if (estado) filtro.estado = estado;
    const skip = (Number(page) - 1) * Number(limit);
    const [docs, total] = await Promise.all([
      FacturaEmision.find(filtro).sort({ fechaEmision: -1 }).skip(skip).limit(Number(limit)),
      FacturaEmision.countDocuments(filtro),
    ]);
    res.json({ docs, total, pagina: Number(page), totalPaginas: Math.ceil(total / Number(limit)) });
  } catch (error) { next(error); }
};

// ============ RESUMEN COMPRAS (para D-150: credito fiscal) ============
const resumenCompras = async (req, res, next) => {
  try {
    const { periodoFiscal, cuatrimestre } = req.query;
    const anioNum = Number(periodoFiscal || new Date().getFullYear());
    const filtro = {
      usuario: req.usuario._id,
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
