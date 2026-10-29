const Inventario = require('../models/Inventario');
const { sanitizarObjetoUsuario } = require('../middleware/validateMiddleware');

const CAMPOS_CICLO_AVES = [
  'fechaInicio', 'fechaFin', 'nInicialAves', 'nActualAves', 'mortalidadAcumulada',
  'razaLinea', 'semanaVidaInicio', 'semanasProduccionEsperadas', 'huevosSemanalesEsperados',
  'huevosSemanalesRealesPromedio', 'consumoAlimentoKgSemana', 'conversionAlimenticia', 'estado',
];

const CAMPOS_MUESTREO_PECES = [
  'fecha', 'pesoPromedioMuestraKg', 'nMuestreados', 'pesoEstimadoTotalKg', 'biomasaEstimadaKg', 'notas',
];

const CAMPOS_PARAMETROS_AGUA = [
  'temperaturaC', 'oxigenoDisueltoMgL', 'ph', 'amonioMgL', 'nitritosMgL',
];

const CAMPOS_EXTRACCION_MIEL = [
  'fecha', 'volumenLitros', 'pesoKg', 'tipoMiel', 'calidad',
];

const CAMPOS_TRATAMIENTO_COLMENA = [
  'fecha', 'producto', 'motivo',
];

// ============ INVENTARIO GENERAL ============

const obtenerInventario = async (req, res, next) => {
  try {
    let inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) {
      inventario = await Inventario.create(req.aplicarTenant({
        usuario: req.usuario._id,
        bovinos: [],
        lotesAves: [],
        estanques: [],
        colmenas: [],
      }));
    }
    res.json(inventario);
  } catch (error) { next(error); }
};

// ============ BOVINOS ============

const agregarBovino = async (req, res, next) => {
  try {
    const { tagId, nombre, raza, tipo, sexo, fechaNacimiento, pesoActualKg, observaciones } = req.body;
    let inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) {
      inventario = await Inventario.create(req.aplicarTenant({
        usuario: req.usuario._id,
        bovinos: [],
        lotesAves: [],
        estanques: [],
        colmenas: [],
      }));
    }

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
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
    const bovino = inventario.bovinos.id(req.params.id);
    if (!bovino) { res.status(404); throw new Error('Bovino no encontrado'); }

    const campos = ['nombre', 'raza', 'tipo', 'sexo', 'fechaNacimiento', 'pesoActualKg', 'observaciones', 'activo', 'estadoSanitario', 'estadoReproductivo'];
    campos.forEach(c => { if (req.body[c] !== undefined) bovino[c] = req.body[c]; });

    if (req.body.nuevoPeso) {
      bovino.historialPesos.push({ fecha: new Date(), pesoKg: Number(req.body.nuevoPeso), notas: req.body.notaPeso });
      bovino.pesoActualKg = Number(req.body.nuevoPeso);
    }

    await inventario.save();
    res.json(bovino);
  } catch (error) { next(error); }
};

const eliminarBovino = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
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
    if (!inventario) {
      inventario = await Inventario.create(req.aplicarTenant({
        usuario: req.usuario._id,
        bovinos: [],
        lotesAves: [],
        estanques: [],
        colmenas: [],
      }));
    }

    const existe = inventario.lotesAves.find(l => l.loteId === loteId);
    if (existe) { res.status(400); throw new Error('Ya existe un lote con ese ID'); }

    const cicloLimpio = cicloActual && typeof cicloActual === 'object'
      ? sanitizarObjetoUsuario(cicloActual, CAMPOS_CICLO_AVES)
      : undefined;

    inventario.lotesAves.push({ loteId, especie, galpon, cicloActual: cicloLimpio });
    await inventario.save();
    res.status(201).json(inventario.lotesAves[inventario.lotesAves.length - 1]);
  } catch (error) { next(error); }
};

const actualizarLoteAves = async (req, res, next) => {
  try {
    const inventario = await Inventario.findOne(req.filtrarPorTenant());
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
    const lote = inventario.lotesAves.id(req.params.id);
    if (!lote) { res.status(404); throw new Error('Lote no encontrado'); }

    const campos = ['especie', 'galpon', 'activo', 'totalHuevosProducidos', 'totalCartonesProducidos', 'costoAlimentoTotal', 'costoVacunasTotal'];
    campos.forEach(c => { if (req.body[c] !== undefined) lote[c] = req.body[c]; });

    // Reemplazo seguro de Object.assign(lote.cicloActual, req.body.cicloActual) para impedir Prototype Pollution
    if (req.body.cicloActual && typeof req.body.cicloActual === 'object') {
      const cicloSeguro = sanitizarObjetoUsuario(req.body.cicloActual, CAMPOS_CICLO_AVES);
      if (!lote.cicloActual) lote.cicloActual = {};
      for (const k of CAMPOS_CICLO_AVES) {
        if (cicloSeguro[k] !== undefined) {
          lote.cicloActual[k] = cicloSeguro[k];
        }
      }
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
    if (!inventario) {
      inventario = await Inventario.create(req.aplicarTenant({
        usuario: req.usuario._id,
        bovinos: [],
        lotesAves: [],
        estanques: [],
        colmenas: [],
      }));
    }

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
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
    const estanque = inventario.estanques.id(req.params.id);
    if (!estanque) { res.status(404); throw new Error('Estanque no encontrado'); }

    const campos = ['especie', 'capacidadM3', 'nActual', 'pesoPromedioActualKg', 'biomasaTotalKg', 'tipoAlimento', 'consumoAlimentoKgAcumulado', 'tasaConversionAlimenticia', 'estado', 'activo', 'costoAlevines', 'costoAlimento', 'costoMedicamentos'];
    campos.forEach(c => { if (req.body[c] !== undefined) estanque[c] = req.body[c]; });

    if (req.body.muestreo && typeof req.body.muestreo === 'object') {
      const muestreoSeguro = sanitizarObjetoUsuario(req.body.muestreo, CAMPOS_MUESTREO_PECES);
      estanque.historialMuestreos.push(muestreoSeguro);
    }
    if (req.body.parametrosAgua && typeof req.body.parametrosAgua === 'object') {
      const aguaSegura = sanitizarObjetoUsuario(req.body.parametrosAgua, CAMPOS_PARAMETROS_AGUA);
      const base = estanque.parametrosAgua?.toObject ? estanque.parametrosAgua.toObject() : (estanque.parametrosAgua || {});
      estanque.parametrosAgua = { ...base, ...aguaSegura, ultimaActualizacion: new Date() };
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
    if (!inventario) {
      inventario = await Inventario.create(req.aplicarTenant({
        usuario: req.usuario._id,
        bovinos: [],
        lotesAves: [],
        estanques: [],
        colmenas: [],
      }));
    }

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
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
    const colmena = inventario.colmenas.id(req.params.id);
    if (!colmena) { res.status(404); throw new Error('Colmena no encontrada'); }

    const campos = ['especie', 'ubicacion', 'tipoColmena', 'estadoColonia', 'nCuerposAlza', 'nCuadrosCera', 'nCuadrosMiel', 'nCuadrosCria', 'nCuadrosAlimento', 'observaciones', 'activo'];
    campos.forEach(c => { if (req.body[c] !== undefined) colmena[c] = req.body[c]; });

    if (req.body.extraccion && typeof req.body.extraccion === 'object') {
      const extraccionSegura = sanitizarObjetoUsuario(req.body.extraccion, CAMPOS_EXTRACCION_MIEL);
      colmena.extracciones.push(extraccionSegura);
      colmena.mielProducidaTotalKg += Number(extraccionSegura.pesoKg) || 0;
      colmena.volumenMielTotalLitros += Number(extraccionSegura.volumenLitros) || 0;
    }
    if (req.body.tratamiento && typeof req.body.tratamiento === 'object') {
      const tratamientoSeguro = sanitizarObjetoUsuario(req.body.tratamiento, CAMPOS_TRATAMIENTO_COLMENA);
      colmena.tratamientosSanitarios.push(tratamientoSeguro);
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
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
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
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
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
    if (!inventario) { res.status(404); throw new Error('Inventario no encontrado'); }
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
