const crypto = require('crypto');
const Event = require('../models/IngestionEvent');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function recibir({ eventKey, canal, payload, estado = 'pendiente' }) {
  try {
    return await Event.findOneAndUpdate({ eventKey }, { $setOnInsert: { eventKey, canal, payload, estado } },
      { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Event.findOne({ eventKey });
  }
}
async function procesar(id) {
  const token = crypto.randomUUID(); const ahora = new Date();
  const event = await Event.findOneAndUpdate({ _id: id, estado: { $in: ['pendiente', 'procesando'] },
    $or: [{ claimHasta: null }, { claimHasta: { $lte: ahora } }] },
  { $set: { estado: 'procesando', claimToken: token, claimHasta: new Date(ahora.getTime() + 120000) }, $inc: { intentos: 1 } }, { new: true });
  if (!event) return Event.findById(id);
  try {
    let resultado;
    if (event.canal === 'email') {
      const payload = event.payload;
      const pdfBuffer = !payload.pdfBuffer ? null : Buffer.isBuffer(payload.pdfBuffer) ? payload.pdfBuffer
        : payload.pdfBuffer._bsontype === 'Binary' ? Buffer.from(payload.pdfBuffer.value(true)) : Buffer.from(payload.pdfBuffer.data || payload.pdfBuffer);
      resultado = await require('./ingestaFacturaService').procesarFacturaXMLString(payload.xml, { ...payload.opciones, pdfBuffer });
    } else if (event.canal === 'whatsapp') {
      // Los eventos históricos del canal retirado no deben quedar en reintento infinito.
      resultado = { exito: false, mensaje: 'Canal de recepción retirado' };
    } else return event;
    const estado = resultado?.noAsignada ? 'sin_asignar' : resultado?.exito === false ? 'rechazado' : 'completado';
    const resumido = resultado ? { exito: resultado.exito, duplicada: resultado.duplicada, actualizada: resultado.actualizada,
      noAsignada: resultado.noAsignada, claveNumerica: resultado.claveNumerica || resultado.factura?.claveNumerica,
      emisor: resultado.emisor, total: resultado.total, alertas: resultado.alertas, mensaje: resultado.mensaje,
      ...(resultado.factura ? { factura: { _id: resultado.factura._id, claveNumerica: resultado.factura.claveNumerica, categoriaIA: resultado.factura.categoriaIA } } : {}) } : { exito: true };
    const tenantId = resultado?.factura?.tenantId || resultado?.tenantId;
    const usuarioId = resultado?.usuario?._id || resultado?.factura?.usuario || resultado?.usuarioId;
    return Event.findOneAndUpdate({ _id: id, claimToken: token }, { $set: { estado, resultado: resumido,
      ...(tenantId ? { tenantId } : {}), ...(usuarioId ? { usuarioId } : {}) },
      $unset: { claimToken: 1, claimHasta: 1, ultimoError: 1 } }, { new: true });
  } catch (error) {
    if (error.code === 'XML_INVALIDO') return Event.findOneAndUpdate({ _id: id, claimToken: token },
      { $set: { estado: 'rechazado', resultado: { exito: false, error: 'XML inválido' } }, $unset: { claimToken: 1, claimHasta: 1 } }, { new: true });
    return Event.findOneAndUpdate({ _id: id, claimToken: token }, { $set: { estado: 'pendiente', ultimoError: 'Fallo transitorio de procesamiento',
      claimHasta: new Date(Date.now() + 30000) }, $unset: { claimToken: 1 } }, { new: true });
  }
}
async function tick() {
  const events = await Event.find({ estado: { $in: ['pendiente', 'procesando'] },
    $or: [{ claimHasta: null }, { claimHasta: { $lte: new Date() } }] }).sort({ createdAt: 1 }).limit(20);
  for (const event of events) await procesar(event._id);
}
module.exports = { recibir, procesar, tick, hash };
