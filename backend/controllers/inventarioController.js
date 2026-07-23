const Inventario = require('../models/Inventario');

// ============ INVENTARIO GENERAL ============

const obtenerInventario = async (req, res, next) => {
  try {
    let inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) {
      inventario = await Inventario.create(req.aplicarTenant({ usuario: req.usuario._id, bovinos: [], lotesAves: [], estanques: [], colmenas: [] }));
    }
    res.json(inventario);
  } catch (error) { next(error); }
};

// ============ BOVINOS ============

const agregarBovino = async (req, res, next) => {
  try {
    const { tagId, nombre, raza, tipo, sexo, fechaNacimiento, pesoActualKg, observaciones } = req.body;
    let inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) inventario = await Inventario.create(req.aplicarTenant({ usuario: req.usuario._id, bovinos: [], lotesAves: [], estanques: [], colmenas: [] }));

    const existe = inventario.bovinos.find(b => b.tagId === tagId);
    if (existe) { res.status(400); throw new Error('Ya existe un bovino con ese tagId'); }

    inventario.bovinos.push({ tagId, nombre, raza, tipo, sexo, fechaNacimiento, pesoActualKg, observaciones });
    await inventario.save();
    res.status(201).json(inventario.bovinos[inventario.bovinos.length - 1]);
  } catch (error) { next(error); }
};

const actualizarBovino = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const bovino = inventario.bovinos.id(req.params.id);
    if (!bovino) { res.status(404); throw new Error('Bovino no encontrado'); }

    const campos = ['nombre', 'raza', 'tipo', 'sexo', 'fechaNacimiento', 'pesoActualKg', 'observaciones', 'activo', 'estadoSanitario', 'estadoReproductivo'];
    campos.forEach(c => { if (req.body[c] !== undefined) bovino[c] = req.body[c]; });

    // Agregar peso al historial si se proporciona
    if (req.body.nuevoPeso) {
      bovino.historialPesos.push({ fecha: new Date(), pesoKg: req.body.nuevoPeso, notas: req.body.notaPeso });
      bovino.pesoActualKg = req.body.nuevoPeso;
    }

    await inventario.save();
    res.json(bovino);
  } catch (error) { next(error); }
};

const eliminarBovino = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const bovino = inventario.bovinos.id(req.params.id);
    if (!bovino) { res.status(404); throw new Error('Bovino no encontrado'); }
    bovino.activo = false;
    await inventario.save();
    res.json({ mensaje: 'Bovino marcado como inactivo' });
  } catch (error) { next(error); }
};

// ============ AVES ============

const agregarLoteAves = async (req, res, next) => {
  try {
    const { loteId, especie, galpon, cicloActual } = req.body;
    let inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) inventario = await Inventario.create(req.aplicarTenant({ usuario: req.usuario._id, bovinos: [], lotesAves: [], estanques: [], colmenas: [] }));

    const existe = inventario.lotesAves.find(l => l.loteId === loteId);
    if (existe) { res.status(400); throw new Error('Ya existe un lote con ese ID'); }

    inventario.lotesAves.push({ loteId, especie, galpon, cicloActual });
    await inventario.save();
    res.status(201).json(inventario.lotesAves[inventario.lotesAves.length - 1]);
  } catch (error) { next(error); }
};

const actualizarLoteAves = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const lote = inventario.lotesAves.id(req.params.id);
    if (!lote) { res.status(404); throw new Error('Lote no encontrado'); }

    const campos = ['especie', 'galpon', 'activo', 'totalHuevosProducidos', 'totalCartonesProducidos', 'costoAlimentoTotal', 'costoVacunasTotal'];
    campos.forEach(c => { if (req.body[c] !== undefined) lote[c] = req.body[c]; });

    if (req.body.cicloActual) {
      Object.assign(lote.cicloActual, req.body.cicloActual);
    }

    await inventario.save();
    res.json(lote);
  } catch (error) { next(error); }
};

// ============ PECES ============

const agregarEstanque = async (req, res, next) => {
  try {
    const { estanqueId, especie, capacidadM3, fechaSiembra, nInicial } = req.body;
    let inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) inventario = await Inventario.create(req.aplicarTenant({ usuario: req.usuario._id, bovinos: [], lotesAves: [], estanques: [], colmenas: [] }));

    const existe = inventario.estanques.find(e => e.estanqueId === estanqueId);
    if (existe) { res.status(400); throw new Error('Ya existe un estanque con ese ID'); }

    inventario.estanques.push({ estanqueId, especie, capacidadM3, fechaSiembra, nInicial, nActual: nInicial });
    await inventario.save();
    res.status(201).json(inventario.estanques[inventario.estanques.length - 1]);
  } catch (error) { next(error); }
};

const actualizarEstanque = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const estanque = inventario.estanques.id(req.params.id);
    if (!estanque) { res.status(404); throw new Error('Estanque no encontrado'); }

    const campos = ['especie', 'capacidadM3', 'nActual', 'pesoPromedioActualKg', 'biomasaTotalKg', 'tipoAlimento', 'consumoAlimentoKgAcumulado', 'tasaConversionAlimenticia', 'estado', 'activo', 'costoAlevines', 'costoAlimento', 'costoMedicamentos'];
    campos.forEach(c => { if (req.body[c] !== undefined) estanque[c] = req.body[c]; });

    if (req.body.muestreo) {
      estanque.historialMuestreos.push(req.body.muestreo);
    }
    if (req.body.parametrosAgua) {
      estanque.parametrosAgua = { ...estanque.parametrosAgua, ...req.body.parametrosAgua, ultimaActualizacion: new Date() };
    }

    await inventario.save();
    res.json(estanque);
  } catch (error) { next(error); }
};

// ============ COLMENAS ============

const agregarColmena = async (req, res, next) => {
  try {
    const { colmenaId, especie, ubicacion, tipoColmena } = req.body;
    let inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) inventario = await Inventario.create(req.aplicarTenant({ usuario: req.usuario._id, bovinos: [], lotesAves: [], estanques: [], colmenas: [] }));

    const existe = inventario.colmenas.find(c => c.colmenaId === colmenaId);
    if (existe) { res.status(400); throw new Error('Ya existe una colmena con ese ID'); }

    inventario.colmenas.push({ colmenaId, especie, ubicacion, tipoColmena });
    await inventario.save();
    res.status(201).json(inventario.colmenas[inventario.colmenas.length - 1]);
  } catch (error) { next(error); }
};

const actualizarColmena = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const colmena = inventario.colmenas.id(req.params.id);
    if (!colmena) { res.status(404); throw new Error('Colmena no encontrada'); }

    const campos = ['especie', 'ubicacion', 'tipoColmena', 'estadoColonia', 'nCuerposAlza', 'nCuadrosCera', 'nCuadrosMiel', 'nCuadrosCria', 'nCuadrosAlimento', 'observaciones', 'activo'];
    campos.forEach(c => { if (req.body[c] !== undefined) colmena[c] = req.body[c]; });

    if (req.body.extraccion) {
      colmena.extracciones.push(req.body.extraccion);
      colmena.mielProducidaTotalKg += req.body.extraccion.pesoKg || 0;
      colmena.volumenMielTotalLitros += req.body.extraccion.volumenLitros || 0;
    }
    if (req.body.tratamiento) {
      colmena.tratamientosSanitarios.push(req.body.tratamiento);
    }

    await inventario.save();
    res.json(colmena);
  } catch (error) { next(error); }
};

// ============ RESUMEN ============

const obtenerResumenInventario = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) return res.json({ totalBovinos: 0, totalAves: 0, totalPeces: 0, totalBiomasa: 0, totalMiel: 0 });

    res.json({
      totalBovinos: inventario.totalBovinosActivos,
      totalAves: inventario.totalAvesActivas,
      totalPeces: inventario.totalPecesEstimados,
      totalBiomasa: inventario.totalBiomasaPecesKg,
      totalMiel: inventario.totalMielProducidaKg,
      bovinosPorTipo: inventario.bovinos?.filter(b => b.activo).reduce((acc, b) => {
        acc[b.tipo] = (acc[b.tipo] || 0) + 1;
        return acc;
      }, {}),
      estanquesPorEstado: inventario.estanques?.filter(e => e.activo).reduce((acc, e) => {
        acc[e.estado] = (acc[e.estado] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) { next(error); }
};

const eliminarLoteAves = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const lote = inventario.lotesAves.id(req.params.id);
    if (!lote) { res.status(404); throw new Error('Lote no encontrado'); }
    lote.activo = false;
    await inventario.save();
    res.json({ mensaje: 'Lote marcado como inactivo' });
  } catch (error) { next(error); }
};

const eliminarEstanque = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const estanque = inventario.estanques.id(req.params.id);
    if (!estanque) { res.status(404); throw new Error('Estanque no encontrado'); }
    estanque.activo = false;
    await inventario.save();
    res.json({ mensaje: 'Estanque marcado como inactivo' });
  } catch (error) { next(error); }
};

const eliminarColmena = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    const colmena = inventario.colmenas.id(req.params.id);
    if (!colmena) { res.status(404); throw new Error('Colmena no encontrada'); }
    colmena.activo = false;
    await inventario.save();
    res.json({ mensaje: 'Colmena marcada como inactiva' });
  } catch (error) { next(error); }
};

module.exports = {
  obtenerInventario,
  agregarBovino,
  actualizarBovino,
  eliminarBovino,
  agregarLoteAves,
  actualizarLoteAves,
  eliminarLoteAves,
  agregarEstanque,
  actualizarEstanque,
  eliminarEstanque,
  agregarColmena,
  actualizarColmena,
  eliminarColmena,
  obtenerResumenInventario,
};
