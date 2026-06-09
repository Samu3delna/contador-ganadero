const mongoose = require('mongoose');

const recordatorioFiscalSchema = new mongoose.Schema({
  // Tipo de obligación fiscal
  tipo: {
    type: String,
    enum: [
      'D-135-1',           // IVA Cuatrimestral
      'D-101',             // Renta Anual
      'retencion_iva',     // Retención IVA (mensual)
      'anticipo_renta',    // Anticipos Renta (trimestral)
      'pago_parcial',      // Pagos parciales
      'otro',              // Otro recordatorio personalizado
    ],
    required: true,
  },

  // Período fiscal
  periodoFiscal: {
    type: Number,
    required: true,
  },
  cuatrimestre: {
    type: Number,
    enum: [1, 2, 3],
    // Solo para D-135-1
  },

  // Fechas clave
  fechaVencimiento: {
    type: Date,
    required: true,
    index: true,
  },
  fechaRecordatorio: {
    type: Date,
    index: true,
  },

  // Estado
  estado: {
    type: String,
    enum: ['pendiente', 'en_proceso', 'presentado', 'pagado', 'vencido'],
    default: 'pendiente',
  },

  // Montos (para referencia)
  montoEstimado: {
    type: Number,
    default: 0,
  },
  montoPagado: {
    type: Number,
    default: 0,
  },

  // Detalles
  descripcion: {
    type: String,
    trim: true,
  },
  notas: {
    type: String,
    trim: true,
  },

  // Configuración de alertas
  alertas: {
    diasAntes: {
      type: Number,
      default: 7, // Alerta 7 días antes
    },
    enviada: {
      type: Boolean,
      default: false,
    },
    fechaEnvio: Date,
  },

  // Relación con declaración guardada (opcional)
  declaracionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Declaracion',
  },

  // Usuario
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

// Índices compuestos
recordatorioFiscalSchema.index({ usuario: 1, fechaVencimiento: 1 });
recordatorioFiscalSchema.index({ usuario: 1, tipo: 1, periodoFiscal: 1, cuatrimestre: 1 });

// Virtual para saber si está vencido
recordatorioFiscalSchema.virtual('estaVencido').get(function () {
  return this.fechaVencimiento < new Date() && !['presentado', 'pagado'].includes(this.estado);
});

// Virtual para días restantes
recordatorioFiscalSchema.virtual('diasRestantes').get(function () {
  const diff = this.fechaVencimiento - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Método estático: generar recordatorios automáticos para un año
recordatorioFiscalSchema.statics.generarParaAnio = async function (usuarioId, anio) {
  const recordatorios = [];

  // D-135-1: IVA Cuatrimestral (vencimientos: 15 mayo, 15 septiembre, 15 enero año siguiente)
  const vencimientosIVA = [
    { cuatrimestre: 1, fecha: new Date(anio, 4, 15) },      // 15 mayo
    { cuatrimestre: 2, fecha: new Date(anio, 8, 15) },      // 15 septiembre
    { cuatrimestre: 3, fecha: new Date(anio + 1, 0, 15) },  // 15 enero año siguiente
  ];

  for (const v of vencimientosIVA) {
    recordatorios.push({
      usuario: usuarioId,
      tipo: 'D-135-1',
      periodoFiscal: anio,
      cuatrimestre: v.cuatrimestre,
      fechaVencimiento: v.fecha,
      fechaRecordatorio: new Date(v.fecha.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 días antes
      descripcion: `Declaración IVA Cuatrimestral ${v.cuatrimestre} (D-135-1)`,
      alertas: { diasAntes: 7 },
    });
  }

  // D-101: Renta Anual (vencimiento: 15 marzo año siguiente)
  recordatorios.push({
    usuario: usuarioId,
    tipo: 'D-101',
    periodoFiscal: anio,
    fechaVencimiento: new Date(anio + 1, 2, 15), // 15 marzo
    fechaRecordatorio: new Date(anio + 1, 1, 15), // 1 mes antes
    descripcion: `Declaración Renta Anual ${anio} (D-101)`,
    alertas: { diasAntes: 30 },
  });

  // Anticipos de Renta (trimestrales: 15 jun, 15 sep, 15 dic, 15 mar)
  const vencimientosAnticipos = [
    { mes: 5, descripcion: '1er Anticipo Renta' },   // 15 junio
    { mes: 8, descripcion: '2do Anticipo Renta' },   // 15 septiembre
    { mes: 11, descripcion: '3er Anticipo Renta' },  // 15 diciembre
    { mes: 2, anio: anio + 1, descripcion: '4to Anticipo Renta' }, // 15 marzo
  ];

  for (const v of vencimientosAnticipos) {
    const a = v.anio || anio;
    recordatorios.push({
      usuario: usuarioId,
      tipo: 'anticipo_renta',
      periodoFiscal: anio,
      fechaVencimiento: new Date(a, v.mes, 15),
      fechaRecordatorio: new Date(a, v.mes, 8), // 1 semana antes
      descripcion: v.descripcion,
      alertas: { diasAntes: 7 },
    });
  }

  // Retención IVA (mensual - solo si aplica, se puede activar después)
  // Se deja como plantilla para activar manualmente

  // Insertar solo los que no existan (evitar duplicados)
  const existentes = await this.find({
    usuario: usuarioId,
    tipo: { $in: ['D-135-1', 'D-101', 'anticipo_renta'] },
    periodoFiscal: anio,
  }).select('tipo cuatrimestre fechaVencimiento');

  const clavesExistentes = new Set(
    existentes.map(r => `${r.tipo}-${r.cuatrimestre || ''}-${r.fechaVencimiento.toISOString()}`)
  );

  const nuevos = recordatorios.filter(r => {
    const clave = `${r.tipo}-${r.cuatrimestre || ''}-${r.fechaVencimiento.toISOString()}`;
    return !clavesExistentes.has(clave);
  });

  if (nuevos.length > 0) {
    await this.insertMany(nuevos);
  }

  return nuevos;
};

module.exports = mongoose.model('RecordatorioFiscal', recordatorioFiscalSchema);