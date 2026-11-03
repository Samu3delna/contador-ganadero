/** Fiscal mutations must use the current database role and authenticated finca. */
function puedeFacturar(req, res, next) {
  const usuario = req.usuario;
  const esOwner = req.tenant?.owner?.equals?.(usuario?._id);
  if (esOwner || ['owner', 'dueño', 'admin', 'contador'].includes(usuario?.rol)) return next();
  return res.status(403).json({ error: 'Se requiere un rol de facturación para emitir comprobantes' });
}

module.exports = { puedeFacturar };
