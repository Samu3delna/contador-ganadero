const Factura = require('../models/FacturaEmision');
async function inicializar(original) {
  if (original.reservaRepInicializada) return;
  const previos = await Factura.find({ tenantId: original.tenantId, tipoDocumento: 'REP',
    'documentoReferencia.numeroReferencia': original.claveNumerica,
    estado: { $in: ['borrador','generada','firmada','enviada_hacienda','procesando','aceptada'] } }).lean();
  const reservas = previos.map(p => ({ facturaId: p._id, monto: p.resumenFactura?.totalComprobante || 0 }));
  const total = reservas.reduce((s,r)=>s+r.monto,0);
  if (total > original.resumenFactura.totalComprobante) throw new Error('Abonos históricos exceden saldo; requiere conciliación');
  await Factura.updateOne({ _id: original._id, tenantId: original.tenantId, reservaRepInicializada: { $ne: true } },
    { $set: { reservasRep: reservas, saldoRepReservado: total, reservaRepInicializada: true } });
}
async function reservar(original, repId, monto) {
  await inicializar(original);
  const updated = await Factura.findOneAndUpdate({ _id: original._id, tenantId: original.tenantId, estado: 'aceptada',
    'reservasRep.facturaId': { $ne: repId },
    $expr: { $lte: [{ $add: ['$saldoRepReservado', monto] }, '$resumenFactura.totalComprobante'] } },
  { $inc: { saldoRepReservado: monto }, $push: { reservasRep: { facturaId: repId, monto } } }, { new: true });
  if (!updated) {
    const existente = await Factura.findOne({ _id: original._id, tenantId: original.tenantId, reservasRep: { $elemMatch: { facturaId: repId, monto } } });
    if (existente) return;
    const error = new Error('Abono excede el saldo disponible'); error.status = 400; throw error;
  }
}
async function verificar(rep) {
  if (!rep.repOriginalId) throw new Error('REP anterior sin reserva: concilie el saldo antes de firmar');
  const original = await Factura.findOne({ _id: rep.repOriginalId, tenantId: rep.tenantId, 'reservasRep.facturaId': rep._id });
  const reserva = original?.reservasRep.find(r => String(r.facturaId) === String(rep._id));
  if (!reserva || Math.abs(reserva.monto - rep.resumenFactura.totalComprobante) > 0.000001) throw new Error('Reserva REP ausente o incompatible');
}
async function liberar(rep) {
  if (!rep.repOriginalId || rep.envioIntentadoEn || rep.xmlFirmado) return;
  const original = await Factura.findOne({ _id: rep.repOriginalId, tenantId: rep.tenantId });
  const reserva = original?.reservasRep.find(r => String(r.facturaId) === String(rep._id));
  if (!reserva) return;
  await Factura.updateOne({ _id: original._id, tenantId: rep.tenantId, 'reservasRep.facturaId': rep._id },
    { $inc: { saldoRepReservado: -reserva.monto }, $pull: { reservasRep: { facturaId: rep._id } } });
}
module.exports = { reservar, verificar, liberar };
