const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'veterinaria', 'alimentacion_animal', 'maquinaria_equipo',
      'transporte', 'servicios_profesionales', 'combustible',
      'mantenimiento', 'seguros', 'insumos_agropecuarios',
      'salarios', 'servicios_publicos', 'otros',
    ],
  },
  etiqueta: {
    type: String,
    required: true,
  },
  descripcion: String,
  tasaIVAComun: {
    type: Number,
    default: 13,
  },
  esDeducible: {
    type: Boolean,
    default: true,
  },
  icono: String, // Nombre del ícono de Lucide React
  color: String, // Color hex para la UI
}, {
  timestamps: true,
});

module.exports = mongoose.model('Categoria', categoriaSchema);
