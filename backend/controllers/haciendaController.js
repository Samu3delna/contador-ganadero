/**
 * Controller de Hacienda (facturacion electronica v4.4 nativa).
 *
 * Endpoints:
 *  POST   /api/hacienda/emision            Crea factura (borrador) sin firmar
 *  POST   /api/hacienda/emision/:id/firmar Genera XML y firma
 *  POST   /api/hacienda/emision/:id/enviar Encola envio (worker toma control)
 *  GET    /api/hacienda/emision/:id/xml    Devuelve XML firmado
 *  GET    /api/hacienda/emision/:id/estado Consulta estado sincrono
 *  POST   /api/hacienda/emision/:id/cancelar Cancela (NC)
 *  GET    /api/hacienda/ambiente           Estado cfg + ambiente actual
 *  GET    /api/hacienda/interno/consulta/:clave  Mock endpoint para polling local
 */

const FacturaEmision = require('../models/FacturaEmision');
const haciendaWorker = require('../services/haciendaWorker');
const hacienda = require('../services/hacienda');
const mockStore = hacienda.mockStore;

const { obtenerCuatrimestre } = require('../utils/costaRicaTax');

// ============ AMBIENTE ============
const infoAmbiente = async (req, res, next) => {
  try {
    res.json({
      ambiente: process.env.HACIENDA_AMBIENTE || 'local',
      p12Configurado: Boolean(process.env.HACIENDA_P12_PATH),
      usuarioConfigurado: (process.env.HACIENDA_USUARIO || '').startsWith('cpf-'),
      workerActivo: true, //el worker se inicia desde worker.js
      endpoints: {
        sandbox: hacienda.auth.ENDPOINTS.sandbox,
        produccion: hacienda.auth.ENDPOINTS.produccion,
      },
    });
  } catch (error) { next(error); }
};

// ============ CREAR BORRADOR ============
const crearBorrador = async (req, res, next) => {
  try {
    const {
      emisor, receptor, lineaDetalle, tipoProducto, tipoDocumento = 'FE',
      condicionVenta, medioPago, plazoCredito, referencia,
    } = req.body;

    if (!emisor || !lineaDetalle || lineaDetalle.length === 0 || !tipoProducto) {
      res.status(400);
      throw new Error('Faltan campos: emisor, lineaDetalle, tipoProducto');
    }
    // CABYS obligatorio en v4.4
    for (const l of lineaDetalle) {
      if (!l.codigo || String(l.codigo).length !== 13) {
        res.status(400);
        throw new Error(`Linea sin CABYS de 13 digitos: ${l.descripcion || '(sin descripcion)'}`);
      }
    }

    const fechaEmision = new Date();
    const cuatrimestre = obtenerCuatrimestre(fechaEmision);
    const periodoFiscal = fechaEmision.getFullYear();

    // consecutivo temporal sin firma - se regenera al firmar
    const consecutivoTemporal = `${'001'}${'00001'}${hacienda.clave50.TIPO_DOC_CODIGO[tipoDocumento] || '01'}${String(Date.now()).slice(-10)}`;

    const nueva = await FacturaEmision.create({
      tipoDocumento,
      ambiente: process.env.HACIENDA_AMBIENTE || 'local',
      consecutivo: consecutivoTemporal,
      emisor: { ...emisor, regimen: 'Régimen Especial Agropecuario (REA)' },
      receptor,
      lineaDetalle,
      tipoProducto,
      condicionVenta: condicionVenta || '01',
      medioPago: medioPago || ['04'],
      plazoCredito,
      referencia,
      esFacturaREA: true,
      fechaEmision,
      cuatrimestre,
      periodoFiscal,
      estado: 'borrador',
      usuario: req.usuario._id,
    });

    res.status(201).json(nueva);
  } catch (error) { next(error); }
};

// ============ FIRMAR Y ENCOLAR ============
const firmarDocumento = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (factura.estado !== 'borrador') {
      res.status(400); throw new Error(`La factura ya esta en estado ${factura.estado}`);
    }

    try {
      await haciendaWorker.prepararYFirmar(factura._id);
    } catch (e) {
      // Guardar el error具体 en la factura
      factura.erroresValidacion = [e.message];
      await factura.save();
      res.status(422);
      throw e;
    }

    const actualizada = await FacturaEmision.findById(factura._id);
    res.json({
      mensaje: 'Documento firmado y listo para envio',
      estado: actualizada.estado,
      clave: actualizada.claveNumerica,
      consecutivo: actualizada.consecutivo,
    });
  } catch (error) { next(error); }
};

const enviarAHacienda = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (factura.estado !== 'firmada') {
      res.status(400); throw new Error(`La factura debe estar firmada, estado actual: ${factura.estado}`);
    }

    // Forzar tick del worker para envío inmediato (response NO queda bloqueado)
    haciendaWorker.enviarPendientes().catch((e) => console.error('enviarPendientes:', e.message));

    res.json({
      mensaje: 'Documento encolado para envio',
      clave: factura.claveNumerica,
      estado: factura.estado,
    });
  } catch (error) { next(error); }
};

// ============ CONSULTAS ============
const obtenerXml = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (!factura.xmlFirmado) { res.status(404); throw new Error('XML no generado aun'); }

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${factura.claveNumerica || factura.consecutivo}.xml"`);
    res.send(factura.xmlFirmado);
  } catch (error) { next(error); }
};

const consultarEstado = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }

    // Forzar consulta sincrona (afuera del loop del worker)
    const cfg = haciendaWorker.getConfig();
    const haciendaRecepcion = hacienda.recepcion;
    const resultado = await haciendaRecepcion.consultarEstado({
      ambiente: cfg.ambiente,
      clave: factura.claveNumerica,
      location: factura.respuestaHacienda?.location,
      credenciales: { usuario: cfg.usuario, password: cfg.password },
    });

    // Actualizar si cambio
    if (resultado.estado === 'aceptado' || resultado.estado === 'rechazado') {
      factura.estado = resultado.estado === 'aceptado' ? 'aceptada' : 'rechazada';
      factura.fechaRespuestaHacienda = new Date();
      factura.respuestaHacienda = {
        ...factura.respuestaHacienda?.toObject?.() || factura.respuestaHacienda,
        clave: factura.claveNumerica,
        estado: resultado.estado,
        detalle: resultado.detalle,
        fecha: new Date(),
      };
      await factura.save();
    }

    res.json({
      clave: factura.claveNumerica,
      consecutivo: factura.consecutivo,
      estado: factura.estado,
      respuestaHacienda: factura.respuestaHacienda,
      resultadoConsulta: resultado,
    });
  } catch (error) { next(error); }
};

// ============ CANCELAR (genera NC) — placeholder ============
const cancelarDocumento = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, usuario: req.usuario._id });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (factura.estado !== 'aceptada') {
      res.status(400); throw new Error('Solo se pueden cancelar facturas aceptadas; debe emitir NC');
    }
    res.status(202).json({
      mensaje: 'Para anular una factura aceptada debe emitir una Nota de Credito (NC) ligada. Use /api/hacienda/emision con tipoDocumento=NC y documentoReferencia.',
      referencia: {
        tipoDocReferencia: '01',
        numeroReferencia: factura.claveNumerica,
        fechaEmisionReferencia: factura.fechaEmision,
        codigoReferencia: '01',
      },
    });
  } catch (error) { next(error); }
};

// ============ CONSULTA MOCK (endpoint interno) ============
const consultaMockLocal = async (req, res, next) => {
  try {
    const clave = req.params.clave;
    const mock = mockStore.get(clave);
    if (!mock) { res.status(404); return res.json({ indEstado: 'procesando' }); }
    res.json({
      clave: mock.clave,
      indEstado: mock.estado === 'aceptado' ? 'aceptado' : 'procesando',
      fecha: mock.respuesta?.fecha || new Date().toISOString(),
    });
  } catch (error) { next(error); }
};

module.exports = {
  infoAmbiente,
  crearBorrador,
  firmarDocumento,
  enviarAHacienda,
  obtenerXml,
  consultarEstado,
  cancelarDocumento,
  consultaMockLocal,
};
