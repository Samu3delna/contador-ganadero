/**
 * Controller dedicado para Recibo Electronico de Pago (REP).
 *
 * El REP se emite cuando se ABONA/PAGA una factura previamente emitida
 * a credito (condicionVenta=02). Avisa a Hacienda que el IVA diferido
 * ya es exigible. Se liga a la FE original mediante documentoReferencia.
 *
 * Flujo:
 *   1. POST /api/hacienda/rep            Crea un REP ligado a una FE aceptada
 *   2. (firmar/enviar automatico igual que FE, desfase por tipoDocumento=REP)
 */

const FacturaEmision = require('../models/FacturaEmision');
const hacienda = require('../services/hacienda');
const haciendaWorker = require('../services/haciendaWorker');
const Tenant = require('../models/Tenant');
const { obtenerCuatrimestre } = require('../utils/costaRicaTax');

const TIPO_REP = 'REP';
const CODIGO_REFERENCIA_PAGO = '17'; //04 = Pago parcial / abono (tabla Hacienda)
//Otros: 01=Anulacion, 02=Devolucion, 05=NotaDebito, 99=Otros

// ============ CREAR REP ============
const crearRep = async (req, res, next) => {
  try {
    const {
      facturaIdOriginal, //ID de la FE a la que se aplica el abono
      montoAbono,
      fechaPago = new Date(),
      medioPago = '01',
      referenciaPago = '',
      descripcion = 'Abono a factura electrónica',
    } = req.body;

    if (!facturaIdOriginal) { res.status(400); throw new Error('facturaIdOriginal es obligatorio'); }
    if (typeof montoAbono !== 'number' || !Number.isFinite(montoAbono) || montoAbono <= 0) { res.status(400); throw new Error('montoAbono inválido'); }
    const idempotenciaRep = req.headers['idempotency-key'];
    if (idempotenciaRep && !/^[a-zA-Z0-9_-]{1,128}$/.test(idempotenciaRep)) return res.status(400).json({ error: 'Idempotency-Key inválida' });
    const repSolicitudHash = require('crypto').createHash('sha256').update(JSON.stringify({ facturaIdOriginal, montoAbono,
      fechaPago: req.body.fechaPago || null, medioPago, referenciaPago, descripcion })).digest('hex');
    if (idempotenciaRep) {
      const previo = await FacturaEmision.findOne({ ...req.filtrarPorTenant(), idempotenciaRep });
      if (previo) return previo.repSolicitudHash === repSolicitudHash ? res.json(previo) : res.status(409).json({ error: 'Idempotency-Key usada con otro pago' });
    }

    const tenant = await Tenant.findById(req.tenant._id);
    const cfg = haciendaWorker.getTenantConfig(tenant);
    if (cfg.ambiente !== 'local') {
      res.status(422); throw new Error('REP disponible solo en simulación en esta etapa: falta validar la distribución de IVA de los pagos con Hacienda');
    }
    const facturaOriginal = await FacturaEmision.findOne({
      _id: facturaIdOriginal,
      ...req.filtrarPorTenant(),
    });
    if (!facturaOriginal) { res.status(404); throw new Error('Factura original no encontrada'); }

    if (facturaOriginal.tipoDocumento !== 'FE' && facturaOriginal.tipoDocumento !== 'TE') {
      res.status(400); throw new Error(`Solo se puede aplicar REP a FE/TE, no a ${facturaOriginal.tipoDocumento}`);
    }
    if (!['08', '10'].includes(facturaOriginal.condicionVenta)) {
      res.status(400); throw new Error('El REP requiere una factura original con condición 08 o 10');
    }
    if (facturaOriginal.estado !== 'aceptada') {
      res.status(400); throw new Error(`La factura original debe estar aceptada. Estado actual: ${facturaOriginal.estado}`);
    }

    // Validar: los abonos no deben superar el total del comprobante
    const abonosPrevios = await FacturaEmision.aggregate([
      {
        $match: {
          ...req.filtrarPorTenant(),
          tipoDocumento: TIPO_REP,
          'documentoReferencia.numeroReferencia': facturaOriginal.claveNumerica,
          estado: { $in: ['borrador', 'firmada', 'enviada_hacienda', 'procesando', 'aceptada'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$resumenFactura.totalComprobante' } } },
    ]);
    const totalAbonadoAntes = abonosPrevios[0]?.total || 0;
    const totalFactura = facturaOriginal.resumenFactura.totalComprobante || 0;
    if (totalAbonadoAntes + montoAbono > totalFactura) {
      res.status(400);
      throw new Error(`Abono excede saldo. Factura: ${totalFactura}, ya abonado: ${totalAbonadoAntes}, intenta abonar: ${montoAbono}`);
    }

    //Construir una factura tipo REP con una sola línea "Abono a factura X"
    const fechaEmision = new Date(fechaPago);
    const cuatrimestre = obtenerCuatrimestre(fechaEmision);
    const seqNum = await tenant.siguienteConsecutivo(TIPO_REP);
    const consecutivo = hacienda.clave50.generarConsecutivo({ ...cfg, tipoDocumento: TIPO_REP, secuencia: seqNum });

    const nuevoRep = new FacturaEmision(req.aplicarTenant({
      repOriginalId: facturaOriginal._id,
      ...(idempotenciaRep ? { idempotenciaRep, repSolicitudHash } : {}),
      tipoDocumento: TIPO_REP,
      ambiente: cfg.ambiente, proveedorSistemas: cfg.proveedorSistemas,
      moneda: facturaOriginal.moneda, tipoCambio: facturaOriginal.tipoCambio,
      consecutivo,
      emisor: facturaOriginal.emisor,
      receptor: facturaOriginal.receptor,
      //El REP lleva una sola línea: el abono, sin impuesto (el IVA ya está en la FE original)
      lineaDetalle: [{
        numeroLinea: 1,
        codigo: '0000000000000', //REP no requiere CABYS específico
        descripcion: `${descripcion}: ${facturaOriginal.claveNumerica} - ${referenciaPago}`,
        cantidad: 1,
        unidadMedida: 'Sp',
        precioUnitario: montoAbono,
        subtotal: montoAbono,
        impuesto: { codigo: '01', codigoTarifa: '01', tarifa: 0, monto: 0, factorIVA: 0 },
        impuestoNeto: 0,
        montoTotal: montoAbono,
      }],
      tipoProducto: 'otros_productos_rea',
      condicionVenta: facturaOriginal.condicionVenta === '08' ? '09' : '11',
      medioPago: [medioPago],
      documentoReferencia: {
        tipoDocReferencia: hacienda.clave50.TIPO_DOC_CODIGO[facturaOriginal.tipoDocumento], //01 = Factura electrónica
        numeroReferencia: facturaOriginal.claveNumerica,
        fechaEmisionReferencia: facturaOriginal.fechaEmision,
        codigoReferencia: CODIGO_REFERENCIA_PAGO,
        razonReferencia: `Abono a factura ${facturaOriginal.consecutivo}`,
      },
      esFacturaREA: true,
      fechaEmision,
      cuatrimestre,
      periodoFiscal: fechaEmision.getFullYear(),
      estado: 'borrador',
      usuario: req.usuario._id,
    }));

    await nuevoRep.validate();
    const reservations = require('../services/repReservations');
    await reservations.reservar(facturaOriginal, nuevoRep._id, nuevoRep.resumenFactura.totalComprobante);
    try { await nuevoRep.save(); }
    catch (error) {
      // Release only when absence is proved; an uncertain write keeps the reservation.
      const existe = await FacturaEmision.exists({ _id: nuevoRep._id, tenantId: req.tenant._id }).catch(() => true);
      if (!existe) await reservations.liberar(nuevoRep);
      if (error.code === 11000 && idempotenciaRep) {
        const previo = await FacturaEmision.findOne({ ...req.filtrarPorTenant(), idempotenciaRep });
        if (previo?.repSolicitudHash === repSolicitudHash) return res.json(previo);
      }
      throw error;
    }
    res.status(201).json(nuevoRep);
  } catch (error) { next(error); }
};

// ============ LISTAR REP ============
const listarRep = async (req, res, next) => {
  try {
    const { periodoFiscal, estado, page = 1, limit = 20 } = req.query;
    const filtro = { ...req.filtrarPorTenant(), tipoDocumento: TIPO_REP };
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

// ============ RESUMEN DE ABONOS POR FACTURA ============
const resumenAbonosPorFactura = async (req, res, next) => {
  try {
    const { facturaIdOriginal } = req.params;
    const facturaOriginal = await FacturaEmision.findOne({
      _id: facturaIdOriginal,
      ...req.filtrarPorTenant(),
    });
    if (!facturaOriginal) { res.status(404); throw new Error('Factura original no encontrada'); }

    const abonos = await FacturaEmision.find({
      ...req.filtrarPorTenant(),
      tipoDocumento: TIPO_REP,
      'documentoReferencia.numeroReferencia': facturaOriginal.claveNumerica,
      estado: { $in: ['borrador', 'firmada', 'enviada_hacienda', 'procesando', 'aceptada'] },
    }).sort({ fechaEmision: 1 });

    const totalAbonado = abonos.reduce((s, a) => s + (a.resumenFactura?.totalComprobante || 0), 0);
    const totalFactura = facturaOriginal.resumenFactura?.totalComprobante || 0;

    res.json({
      facturaOriginal: {
        _id: facturaOriginal._id,
        clave: facturaOriginal.claveNumerica,
        consecutivo: facturaOriginal.consecutivo,
        total: totalFactura,
        condicionVenta: facturaOriginal.condicionVenta,
        estado: facturaOriginal.estado,
        fechaEmision: facturaOriginal.fechaEmision,
      },
      abonos: abonos.map((a) => ({
        _id: a._id,
        clave: a.claveNumerica,
        montoAbono: a.resumenFactura?.totalComprobante || 0,
        fechaAbono: a.fechaEmision,
        estado: a.estado,
      })),
      totalAbonado,
      saldoPendiente: Math.max(totalFactura - totalAbonado, 0),
      totalmentePagado: totalAbonado >= totalFactura,
    });
  } catch (error) { next(error); }
};

module.exports = {
  crearRep,
  listarRep,
  resumenAbonosPorFactura,
};
