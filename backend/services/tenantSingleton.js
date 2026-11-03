async function obtenerOCrear(Modelo, req, extra = {}) {
  const filtro = req.filtrarPorTenant(extra);
  const existentes = await Modelo.find(filtro).limit(2);
  if (existentes.length > 1) { const error = new Error('Identidad duplicada: concilie datos antes de continuar'); error.status = 409; throw error; }
  if (existentes.length) return existentes[0];
  try {
    return await Modelo.findOneAndUpdate(filtro, { $setOnInsert: { ...filtro, usuario: req.usuario._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Modelo.findOne(filtro);
  }
}
module.exports = { obtenerOCrear };
