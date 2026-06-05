const mongoose = require('mongoose');

/**
 * Modelo de Inventario Agropecuario Integral
 * Control de: Bovinos, Aves (postura), Peces (acuicultura), Abejas (apicultura)
 */

// ============ BOVINO ============
const historialPesoSchema = new mongoose.Schema({
  fecha: { type: Date, required: true },
  pesoKg: { type: Number, required: true, min: 0 },
  notas: { type: String, trim: true },
  ubicacion: { type: String, trim: true },
}, { _id: true });

const bovinoSchema = new mongoose.Schema({
  tagId: {
    type: String,
    required: [true, 'El tag o número de ficha es obligatorio'],
    trim: true,
  },
  nombre: { type: String, trim: true, default: '' },
  especie: {
    type: String,
    enum: ['bovino'],
    default: 'bovino',
  },
  raza: { type: String, trim: true },
  tipo: {
    type: String,
    enum: ['novillo', 'vaca_lechera', 'vaca_carne', 'ternero', 'ternera', 'toro', 'vaquilla', 'buey', 'otro'],
    default: 'novillo',
  },
  sexo: { type: String, enum: ['macho', 'hembra'], required: true },
  fechaNacimiento: { type: Date },
  fechaIngreso: { type: Date, default: Date.now },
  // Último peso conocido
  pesoActualKg: { type: Number, default: 0, min: 0 },
  historialPesos: [historialPesoSchema],
  // Producción lechera (solo si aplica)
  produccionLeche: {
    activa: { type: Boolean, default: false },
    litrosDiariosPromedio: { type: Number, default: 0, min: 0 },
    etapaLactancia: {
      type: String,
      enum: ['temprana', 'media', 'tardia', 'seca', 'no_aplica'],
      default: 'no_aplica',
    },
  },
  // Estado reproductivo
  estadoReproductivo: {
    type: String,
    enum: ['vacia', 'gestante', 'lactancia', 'servida', 'no_aplica'],
    default: 'no_aplica',
  },
  // Sanidad
  estadoSanitario: {
    type: String,
    enum: ['sano', 'en_tratamiento', 'cuarentena', 'baja'],
    default: 'sano',
  },
  observaciones: { type: String, trim: true },
  activo: { type: Boolean, default: true },
}, { _id: true });

// ============ AVES (POSTURA) ============
const cicloPosturaSchema = new mongoose.Schema({
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date },
  nInicialAves: { type: Number, required: true, min: 0 },
  nActualAves: { type: Number, default: 0, min: 0 },
  mortalidadAcumulada: { type: Number, default: 0, min: 0 },
  razaLinea: { type: String, trim: true },
  semanaVidaInicio: { type: Number, default: 0 },
  // Proyección del ciclo
  semanasProduccionEsperadas: { type: Number, default: 60 },
  huevosSemanalesEsperados: { type: Number, default: 0 },
  // Datos reales
  huevosSemanalesRealesPromedio: { type: Number, default: 0 },
  // Alimentación
  consumoAlimentoKgSemana: { type: Number, default: 0 },
  conversionAlimenticia: { type: Number, default: 0 }, // kg alimento / huevo (o docena)
  estado: {
    type: String,
    enum: ['pre_puesta', 'pico_postura', 'produccion_estable', 'declive', 'fin_ciclo'],
    default: 'pre_puesta',
  },
}, { _id: true });

const loteAvesSchema = new mongoose.Schema({
  loteId: {
    type: String,
    required: [true, 'El ID del lote es obligatorio'],
    trim: true,
  },
  especie: {
    type: String,
    enum: ['gallina_ponedora', 'pollo_engorde'],
    default: 'gallina_ponedora',
  },
  galpon: { type: String, trim: true },
  // Ciclo actual
  cicloActual: cicloPosturaSchema,
  historialCiclos: [cicloPosturaSchema],
  // Producción acumulada del lote
  totalHuevosProducidos: { type: Number, default: 0, min: 0 },
  totalCartonesProducidos: { type: Number, default: 0, min: 0 }, // 30 huevos = 1 cartón
  // Costos asociados al ciclo
  costoAlimentoTotal: { type: Number, default: 0 },
  costoVacunasTotal: { type: Number, default: 0 },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

// ============ PECES (ACUICULTURA) ============
const muestreoPesosSchema = new mongoose.Schema({
  fecha: { type: Date, required: true },
  pesoPromedioMuestraKg: { type: Number, required: true, min: 0 },
  nMuestreados: { type: Number, required: true, min: 1 },
  pesoEstimadoTotalKg: { type: Number, required: true, min: 0 },
  biomasaEstimadaKg: { type: Number, required: true, min: 0 },
  notas: { type: String, trim: true },
}, { _id: true });

const estanqueSchema = new mongoose.Schema({
  estanqueId: {
    type: String,
    required: [true, 'El ID del estanque es obligatorio'],
    trim: true,
  },
  especie: {
    type: String,
    enum: ['tilapia', 'trucha', 'carpa', 'camaron', 'bagre', 'otro'],
    default: 'tilapia',
  },
  capacidadM3: { type: Number, default: 0, min: 0 },
  fechaSiembra: { type: Date },
  // Inventario
  nInicial: { type: Number, default: 0, min: 0 },
  nActual: { type: Number, default: 0, min: 0 },
  mortalidadAcumulada: { type: Number, default: 0, min: 0 },
  // Pesos y biomasa
  pesoPromedioActualKg: { type: Number, default: 0, min: 0 },
  biomasaTotalKg: { type: Number, default: 0, min: 0 },
  historialMuestreos: [muestreoPesosSchema],
  // Alimentación
  tipoAlimento: { type: String, trim: true },
  consumoAlimentoKgAcumulado: { type: Number, default: 0, min: 0 },
  tasaConversionAlimenticia: { type: Number, default: 0 }, // Factor de Conversión Alimenticia (FCA)
  // Parámetros calidad de agua
  parametrosAgua: {
    temperaturaC: { type: Number },
    oxigenoDisueltoMgL: { type: Number },
    ph: { type: Number },
    amonioMgL: { type: Number },
    nitritosMgL: { type: Number },
    ultimaActualizacion: { type: Date },
  },
  // Proyección
  fechaCosechaEstimada: { type: Date },
  pesoCosechaEstimadoKg: { type: Number, default: 0, min: 0 },
  // Costos
  costoAlevines: { type: Number, default: 0 },
  costoAlimento: { type: Number, default: 0 },
  costoMedicamentos: { type: Number, default: 0 },
  estado: {
    type: String,
    enum: ['siembra', 'crecimiento', 'engorde', 'cosecha', 'vacio'],
    default: 'siembra',
  },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

// ============ ABEJAS (APICULTURA) ============
const registroMielSchema = new mongoose.Schema({
  fecha: { type: Date, required: true },
  volumenLitros: { type: Number, required: true, min: 0 },
  pesoKg: { type: Number, required: true, min: 0 },
  tipoMiel: { type: String, trim: true }, // milflores, café, etc.
  calidad: { type: String, enum: ['premium', 'estandar', 'baja'], default: 'estandar' },
}, { _id: true });

const colmenaSchema = new mongoose.Schema({
  colmenaId: {
    type: String,
    required: [true, 'El ID de la colmena es obligatorio'],
    trim: true,
  },
  especie: {
    type: String,
    enum: ['apis_mellifera', 'africanizada', 'otra'],
    default: 'africanizada',
  },
  ubicacion: { type: String, trim: true },
  tipoColmena: {
    type: String,
    enum: ['langstroth', 'top_bar', 'kenya', 'warre', 'tradicional'],
    default: 'langstroth',
  },
  // Estado
  estadoColonia: {
    type: String,
    enum: ['fuerte', 'media', 'debil', 'sin_reina', 'absconding', 'muerta'],
    default: 'media',
  },
  // Registro de producción
  mielProducidaTotalKg: { type: Number, default: 0, min: 0 },
  volumenMielTotalLitros: { type: Number, default: 0, min: 0 },
  extracciones: [registroMielSchema],
  // Estado de cuadros
  nCuerposAlza: { type: Number, default: 0, min: 0 },
  nCuadrosCera: { type: Number, default: 0, min: 0 },
  nCuadrosMiel: { type: Number, default: 0, min: 0 },
  nCuadrosCria: { type: Number, default: 0, min: 0 },
  nCuadrosAlimento: { type: Number, default: 0, min: 0 },
  // Sanidad
  ultimaRevision: { type: Date },
  tratamientosSanitarios: [{
    fecha: Date,
    producto: String,
    motivo: String,
  }],
  observaciones: { type: String, trim: true },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

// ============ MODELO PADRE DE INVENTARIO ============
const inventarioSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
  // Inventarios por especie
  bovinos: [bovinoSchema],
  lotesAves: [loteAvesSchema],
  estanques: [estanqueSchema],
  colmenas: [colmenaSchema],
  // Campos de auditoría
  ultimaActualizacion: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// ============ ÍNDICES ============
inventarioSchema.index({ usuario: 1 });
inventarioSchema.index({ 'bovinos.tagId': 1 });
inventarioSchema.index({ 'lotesAves.loteId': 1 });
inventarioSchema.index({ 'estanques.estanqueId': 1 });
inventarioSchema.index({ 'colmenas.colmenaId': 1 });

// ============ MÉTODOS VIRTUALES ============
inventarioSchema.virtual('totalBovinosActivos').get(function () {
  return this.bovinos?.filter(b => b.activo).length || 0;
});
inventarioSchema.virtual('totalAvesActivas').get(function () {
  return this.lotesAves?.reduce((sum, l) => sum + (l.activo ? (l.cicloActual?.nActualAves || 0) : 0), 0) || 0;
});
inventarioSchema.virtual('totalPecesEstimados').get(function () {
  return this.estanques?.reduce((sum, e) => sum + (e.activo ? (e.nActual || 0) : 0), 0) || 0;
});
inventarioSchema.virtual('totalBiomasaPecesKg').get(function () {
  return this.estanques?.reduce((sum, e) => sum + (e.activo ? (e.biomasaTotalKg || 0) : 0), 0) || 0;
});
inventarioSchema.virtual('totalMielProducidaKg').get(function () {
  return this.colmenas?.reduce((sum, c) => sum + (c.activo ? (c.mielProducidaTotalKg || 0) : 0), 0) || 0;
});

module.exports = mongoose.model('Inventario', inventarioSchema);
