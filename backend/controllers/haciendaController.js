/**
 * Controller de Hacienda (facturacion electronica v4.4 nativa) - Multi-tenant.
 *
 * Endpoints:
 *  POST   /api/hacienda/emision            Crea factura (borrador) sin firmar
 *  POST   /api/hacienda/emision/:id/firmar Genera XML y firma
 *  POST   /api/hacienda/emision/:id/enviar Encola envio (worker toma control)
 *  GET    /api/hacienda/emision/:id/xml    Devuelve XML firmado
 *  GET    /api/hacienda/emision/:id/estado Consulta estado sincrono
 *  POST   /api/hacienda/emision/:id/cancelar Cancela (NC)
 *  GET    /api/hacienda/ambiente           Estado cfg + ambiente actual (por tenant)
 *  GET    /api/hacienda/interno/consulta/:clave  Mock endpoint para polling local
 */

const FacturaEmision = require('../models/FacturaEmision');
const Tenant = require('../models/Tenant');
const haciendaWorker = require('../services/haciendaWorker');
const hacienda = require('../services/hacienda');
const mockStore = hacienda.mockStore;

const { obtenerCuatrimestre } = require('../utils/costaRicaTax');

const SELECT_HACIENDA_CREDS = '+configuracionHacienda.certificadoP12Base64 +configuracionHacienda.pinCertificado +configuracionHacienda.usuarioHacienda +configuracionHacienda.passwordHacienda';

async function obtenerTenantHacienda(req) {
  if (!req.tenant?._id) throw new Error('La facturación requiere una finca identificada');
  const tenant = await Tenant.findById(req.tenant._id).select(SELECT_HACIENDA_CREDS);
  if (!tenant) throw new Error('Finca no encontrada');
  return tenant;
}

// ============ AMBIENTE ============
const infoAmbiente = async (req, res, next) => {
  try {
    const tenant = await obtenerTenantHacienda(req);
    const hc = tenant.configuracionHacienda || {};
    const cfg = haciendaWorker.getTenantConfig(tenant, { conSecretos: false });

    res.json({
      ambiente: cfg.ambiente,
      p12Configurado: !!hc.certificadoP12Base64,
      usuarioConfigurado: cfg.usuario?.startsWith('cpf-') || false,
      workerActivo: true,
      tenantConfigurado: hc.estaConfigurado?.() || false,
      sucursal: cfg.sucursal,
      terminal: cfg.terminal,
      codigoActividad: cfg.codigoActividad,
      proveedorSistemas: cfg.proveedorSistemas,
      motorHacienda: haciendaWorker.MOTOR_HACIENDA,
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
      condicionVenta, medioPago, plazoCredito, referencia, documentoReferencia,
      codigoActividadReceptor, moneda, tipoCambio, pagos,
    } = req.body;

    if (!emisor || !lineaDetalle || lineaDetalle.length === 0 || !tipoProducto) {
      res.status(400);
      throw new Error('Faltan campos: emisor, lineaDetalle, tipoProducto');
    }
    if (!['FE', 'TE', 'NC', 'ND'].includes(tipoDocumento)) {
      res.status(400); throw new Error('Tipo de documento no disponible para nueva emisión');
    }
    // CABYS obligatorio en v4.4
    for (const l of lineaDetalle) {
      if (!/^\d{13}$/.test(String(l.codigo || ''))) {
        res.status(400);
        throw new Error(`Linea sin CABYS de 13 digitos: ${l.descripcion || '(sin descripcion)'}`);
      }
    }

    const tenant = await obtenerTenantHacienda(req);
    const hc = tenant.configuracionHacienda || {};
    const cfg = haciendaWorker.getTenantConfig(tenant, { conSecretos: false });

    const fechaEmision = new Date();
    const cuatrimestre = obtenerCuatrimestre(fechaEmision);
    const periodoFiscal = fechaEmision.getFullYear();

    // La reserva atómica no cambia al firmar ni al consultar.
    const seqNum = await tenant.siguienteConsecutivo(tipoDocumento);
    const consecutivoTemporal = hacienda.clave50.generarConsecutivo({ ...cfg, tipoDocumento, secuencia: seqNum });

    const nueva = await FacturaEmision.create(req.aplicarTenant({
      tipoDocumento,
      ambiente: cfg.ambiente,
      consecutivo: consecutivoTemporal,
      codigoActividadEmisor: cfg.codigoActividad, proveedorSistemas: cfg.proveedorSistemas,
      codigoActividadReceptor, moneda, tipoCambio, pagos, documentoReferencia,
      emisor: { ...emisor, regimen: 'Régimen Especial Agropecuario (REA)' },
      receptor: tipoDocumento === 'TE' && !receptor?.nombre ? undefined : receptor,
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
    }));

    res.status(201).json(nueva);
  } catch (error) { next(error); }
};

// ============ FIRMAR Y ENCOLAR ============
const firmarDocumento = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (['FEC', 'REP'].includes(factura.tipoDocumento)) {
      res.status(410); throw new Error('Este tipo de comprobante histórico es de solo lectura');
    }
    if (factura.estado !== 'borrador') {
      res.status(400); throw new Error(`La factura ya esta en estado ${factura.estado}`);
    }

    try {
      await haciendaWorker.prepararYFirmar(factura._id);
    } catch (e) {
      // Guardar el error específico en la factura
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
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (['FEC', 'REP'].includes(factura.tipoDocumento)) {
      res.status(410); throw new Error('Este tipo de comprobante histórico es de solo lectura');
    }
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
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() }).select('+xmlFirmado');
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (!factura.xmlFirmado) { res.status(404); throw new Error('XML no generado aun'); }

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${factura.claveNumerica || factura.consecutivo}.xml"`);
    res.send(factura.xmlFirmado);
  } catch (error) { next(error); }
};

const consultarEstado = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() }).populate({
      path: 'tenantId',
      select: SELECT_HACIENDA_CREDS,
    });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }

    if (['FEC', 'REP'].includes(factura.tipoDocumento) &&
        !['enviada_hacienda', 'procesando', 'aceptada', 'rechazada'].includes(factura.estado)) {
      res.status(410); throw new Error('El comprobante histórico no tiene un envío registrado');
    }
    const consultaLegada = factura.estado === 'firmada' && factura.motorHacienda !== haciendaWorker.MOTOR_HACIENDA && factura.claveNumerica;
    if (!consultaLegada && !['enviada_hacienda', 'procesando', 'aceptada', 'rechazada'].includes(factura.estado)) {
      res.status(400); throw new Error('El comprobante aún no tiene un envío registrado');
    }
    const cfg = haciendaWorker.validarConfigDocumento(factura.tenantId, factura);

    // Forzar consulta sincrona (afuera del loop del worker)
    const haciendaRecepcion = hacienda.recepcion;
    const resultado = await haciendaRecepcion.consultarEstado({
      ambiente: cfg.ambiente,
      clave: factura.claveNumerica,
      location: factura.respuestaHacienda?.location,
      credenciales: { usuario: cfg.usuario, password: cfg.password, tenantId: cfg.tenantId },
    });

    // Actualizar si cambio
    if (resultado.estado === 'aceptado' || resultado.estado === 'rechazado') {
      factura.estado = resultado.estado === 'aceptado' ? 'aceptada' : 'rechazada';
      factura.fechaRespuestaHacienda = new Date();
      factura.xmlRespuestaHacienda = resultado.xmlRespuesta || '';
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

// ============ CANCELAR (genera NC) ============
const cancelarDocumento = async (req, res, next) => {
  try {
    const factura = await FacturaEmision.findOne({ _id: req.params.id, ...req.filtrarPorTenant() });
    if (!factura) { res.status(404); throw new Error('Factura no encontrada'); }
    if (['FEC', 'REP'].includes(factura.tipoDocumento)) {
      res.status(410); throw new Error('Comprobante histórico de solo lectura');
    }
    if (['borrador', 'generada', 'anulada'].includes(factura.estado) && !factura.envioIntentadoEn && !factura.xmlFirmado) {
      return require('./facturaEmisionController').anularFactura(req, res, next);
    }
    if (factura.estado !== 'aceptada') {
      res.status(400); throw new Error('Solo se pueden anular mediante NC las facturas aceptadas por Hacienda');
    }
    if (!['FE', 'TE'].includes(factura.tipoDocumento)) {
      res.status(400); throw new Error('Este flujo de anulación solo admite FE y TE');
    }

    const { razon = 'Anulación de factura por acuerdo mutuo' } = req.body || {};
    const tenant = await obtenerTenantHacienda(req);
    const cfg = haciendaWorker.getTenantConfig(tenant, { conSecretos: false });
    if (cfg.ambiente !== factura.ambiente) {
      res.status(400); throw new Error('Restaure el ambiente de la factura original para generar su nota de crédito');
    }

    const fechaEmision = new Date();
    const cuatrimestre = obtenerCuatrimestre(fechaEmision);
    const periodoFiscal = fechaEmision.getFullYear();
    const seqNumNC = await tenant.siguienteConsecutivo('NC');
    const consecutivoTemporal = hacienda.clave50.generarConsecutivo({ ...cfg, tipoDocumento: 'NC', secuencia: seqNumNC });

    const notaCredito = await FacturaEmision.create(req.aplicarTenant({
      tipoDocumento: 'NC',
      ambiente: cfg.ambiente,
      consecutivo: consecutivoTemporal,
      codigoActividadEmisor: factura.codigoActividadEmisor || cfg.codigoActividad,
      codigoActividadReceptor: factura.codigoActividadReceptor, proveedorSistemas: cfg.proveedorSistemas,
      moneda: factura.moneda, tipoCambio: factura.tipoCambio, plazoCredito: factura.plazoCredito,
      pagos: factura.pagos,
      emisor: factura.emisor,
      receptor: factura.receptor,
      lineaDetalle: factura.lineaDetalle,
      tipoProducto: factura.tipoProducto,
      condicionVenta: factura.condicionVenta || '01',
      medioPago: factura.medioPago || ['04'],
      referencia: `Nota de Crédito por anulación de ${factura.claveNumerica || factura.consecutivo}`,
      documentoReferencia: {
        tipoDocReferencia: hacienda.clave50.TIPO_DOC_CODIGO[factura.tipoDocumento],
        numeroReferencia: factura.claveNumerica,
        fechaEmisionReferencia: factura.fechaEmision,
        codigoReferencia: '01', // 01 = Anula documento de referencia
        razonReferencia: razon,
      },
      esFacturaREA: true,
      fechaEmision,
      cuatrimestre,
      periodoFiscal,
      estado: 'borrador',
      usuario: req.usuario._id,
    }));

    res.status(201).json({
      mensaje: 'Nota de Crédito (NC) generada en borrador',
      notaCredito,
      facturaOriginal: {
        id: factura._id,
        clave: factura.claveNumerica,
        consecutivo: factura.consecutivo,
      },
    });
  } catch (error) { next(error); }
};

// ============ CONSULTA MOCK (endpoint interno) ============
const consultaMockLocal = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Endpoint no disponible en producción' });
    }
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
