const mongoose = require('mongoose');

/**
 * Modelo de Control de Costos de Producción
 * Registra insumos consumidos y calcula KPIs de eficiencia productiva
 * por especie: bovino (carne), aves (huevos), peces (tilapia), abejas (miel)
 */

// ============ INSUMO CONSUMIDO ============
const consumoInsumoSchema = new mongoose.Schema({
  fecha: { type: Date, required: true, default: Date.now },
  tipoInsumo: {
    type: String,
    enum: [
      'alimento_concentrado', 'sal_mineral', 'vacuna', 'medicamento',
      'vitamina', 'forraje', 'semilla_pasto', 'alevin', 'pajuela',
      'combustible_maquinaria', 'agua', 'electricidad', 'mano_obra',
      'otro',
    ],
    required: true,
  },
  descripcion: { type: String, trim: true },
  cantidad: { type: Number, required: true, min: 0 },
  unidadMedida: {
    type: String,
    enum: ['kg', 'litro', 'unidad', 'dosis', 'hora', 'kwh', 'm3', 'carton', 'saco', 'bolsa'],
    default: 'kg',
  },
  costoUnitario: { type: Number, required: true, min: 0 }, // CRC
  costoTotal: { type: Number, required: true, min: 0 },    // calculado
  proveedor: { type: String, trim: true },
  facturaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Factura' },
}, { _id: true, timestamps: true });

// ============ PRODUCCIÓN REGISTRADA ============
const produccionSchema = new mongoose.Schema({
  fecha: { type: Date, required: true, default: Date.now },
  tipoProducto: {
    type: String,
    enum: ['carne_bovino', 'leche', 'huevo', 'tilapia', 'miel', 'otro'],
    required: true,
  },
  cantidad: { type: Number, required: true, min: 0 },
  unidadMedida: {
    type: String,
    enum: ['kg', 'litro', 'carton', 'docena', 'unidad'],
    default: 'kg',
  },
  // Parámetros de eficiencia calculados al vuelo
  conversionAlimenticia: { type: Number, default: 0 }, // kg insumo / kg producto
  ingresoBrutoVenta: { type: Number, default: 0, min: 0 }, // CRC vendido
  margenBruto: { type: Number, default: 0 },            // CRC
}, { _id: true, timestamps: true });

// ============ CENTRO DE COSTO (Lote/Estanque/Colmena) ============
const centroCostoSchema = new mongoose.Schema({
  referenciaId: { type: String, required: true }, // tagId, loteId, estanqueId o colmenaId
  tipoActividad: {
    type: String,
    enum: ['bovino_carne', 'bovino_leche', 'aves_postura', 'acuicultura_tilapia', 'apicultura_miel'],
    required: true,
  },
  nombreLote: { type: String, trim: true },
  fechaInicio: { type: Date, default: Date.now },
  fechaCierre: { type: Date },
  activo: { type: Boolean, default: true },
  // Insumos consumidos en este centro de costo
  consumos: [consumoInsumoSchema],
  // Producción obtenida
  producciones: [produccionSchema],
  // KPIs calculados
  indicadores: {
    costoProduccionPorKg: { type: Number, default: 0, description: 'Costo total / kg de producto' },
    costoProduccionPorCartonHuevos: { type: Number, default: 0 },
    costoProduccionPorLitroLeche: { type: Number, default: 0 },
    rendimientoMedioDiarioGramaDia: { type: Number, default: 0 }, // Ganancia media diaria (GMD)
    factorConversionAlimenticia: { type: Number, default: 0 },    // FCA
    mortalidadPorcentaje: { type: Number, default: 0 },
    mortalidadAcumulada: { type: Number, default: 0 },
    ingresoTotalVentas: { type: Number, default: 0 },
    margenRentaOperativa: { type: Number, default: 0 }, // Utilidad neta del centro
  },
}, { _id: true });

// ============ MODELO PADRE ============
const costoProduccionSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
  periodoFiscal: { type: Number, required: true }, // Ej: 2026
  centrosCosto: [centroCostoSchema],
  // Resumen global
  resumenGlobal: {
    costoTotalInsumos: { type: Number, default: 0 },
    ingresoTotalVentas: { type: Number, default: 0 },
    margenOperativoGlobal: { type: Number, default: 0 },
    produccionTotalKg: { type: Number, default: 0 },
    costoPromedioPorKg: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

// ============ ÍNDICES ============
costoProduccionSchema.index({ usuario: 1, periodoFiscal: 1 });
costoProduccionSchema.index({ 'centrosCosto.referenciaId': 1 });

// ============ MÉTODO: RECALCULAR INDICADORES ============
costoProduccionSchema.methods.recalcularIndicadoresCentro = function (referenciaId) {
  const centro = this.centrosCosto.find(c => c.referenciaId === referenciaId);
  if (!centro) return null;

  // 1. Suma de costos
  const costoTotal = centro.consumos.reduce((sum, i) => sum + (i.costoTotal || 0), 0);

  // 2. Suma de producción
  let produccionTotalKg = 0;
  let produccionTotalCartones = 0;
  let produccionTotalLitros = 0;
  let ingresoTotal = 0;

  for (const p of centro.producciones) {
    ingresoTotal += p.ingresoBrutoVenta || 0;
    if (p.unidadMedida === 'kg') produccionTotalKg += p.cantidad;
    if (p.unidadMedida === 'carton') produccionTotalCartones += p.cantidad;
    if (p.unidadMedida === 'litro') produccionTotalLitros += p.cantidad;
  }

  // 3. Calcular FCA (solo si hay alimento)
  const alimentoKg = centro.consumos
    .filter(c => c.tipoInsumo === 'alimento_concentrado' || c.tipoInsumo === 'forraje')
    .reduce((sum, c) => sum + c.cantidad, 0);

  const fca = produccionTotalKg > 0 ? (alimentoKg / produccionTotalKg) : 0;

  // 4. Asignar indicadores
  centro.indicadores.costoProduccionPorKg = produccionTotalKg > 0 ? Math.round((costoTotal / produccionTotalKg) * 100) / 100 : 0;
  centro.indicadores.costoProduccionPorCartonHuevos = produccionTotalCartones > 0 ? Math.round((costoTotal / produccionTotalCartones) * 100) / 100 : 0;
  centro.indicadores.costoProduccionPorLitroLeche = produccionTotalLitros > 0 ? Math.round((costoTotal / produccionTotalLitros) * 100) / 100 : 0;
  centro.indicadores.factorConversionAlimenticia = Math.round(fca * 100) / 100;
  centro.indicadores.ingresoTotalVentas = Math.round(ingresoTotal);
  centro.indicadores.margenRentaOperativa = Math.round(ingresoTotal - costoTotal);

  // Recalcular resumen global
  this.resumenGlobal.costoTotalInsumos = this.centrosCosto.reduce((sum, c) =>
    sum + c.consumos.reduce((s2, i) => s2 + (i.costoTotal || 0), 0), 0);
  this.resumenGlobal.ingresoTotalVentas = this.centrosCosto.reduce((sum, c) => sum + (c.indicadores.ingresoTotalVentas || 0), 0);
  this.resumenGlobal.produccionTotalKg = this.centrosCosto.reduce((sum, c) => {
    return sum + c.producciones.reduce((s2, p) => s2 + (p.unidadMedida === 'kg' ? p.cantidad : 0), 0);
  }, 0);
  this.resumenGlobal.margenOperativoGlobal = this.resumenGlobal.ingresoTotalVentas - this.resumenGlobal.costoTotalInsumos;
  this.resumenGlobal.costoPromedioPorKg = this.resumenGlobal.produccionTotalKg > 0
    ? Math.round((this.resumenGlobal.costoTotalInsumos / this.resumenGlobal.produccionTotalKg) * 100) / 100
    : 0;

  return centro.indicadores;
};

module.exports = mongoose.model('CostoProduccion', costoProduccionSchema);
