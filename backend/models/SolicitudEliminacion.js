const mongoose = require('mongoose');

const solicitudEliminacionSchema = new mongoose.Schema(
  {
    codigoConfirmacion: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    origen: {
      type: String,
      enum: ['meta_callback', 'web_formulario', 'app_perfil', 'whatsapp_bot'],
      default: 'meta_callback',
    },
    metaUserId: {
      type: String,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    telefono: {
      type: String,
      trim: true,
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },
    estado: {
      type: String,
      enum: ['completada', 'en_proceso', 'rechazada'],
      default: 'completada',
    },
    usuarioEncontrado: {
      type: Boolean,
      default: false,
    },
    datosEliminados: {
      type: [String],
      default: [],
    },
    explicacionEstado: {
      type: String,
      required: true,
    },
    justificacionLegal: {
      type: String,
      default:
        'De conformidad con la Ley N° 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales de Costa Rica y las Condiciones de la Plataforma de Meta, todos los datos personales, credenciales, número de WhatsApp e historial operativo han sido eliminados de nuestros servidores activos. Nota fiscal: los comprobantes electrónicos previamente transmitidos a la Dirección General de Tributación (Ministerio de Hacienda) quedan sujetos al deber legal de conservación del contribuyente según el Art. 109 del Código de Normas y Procedimientos Tributarios (Ley N° 4755), sin que ContadorGanadero conserve copia activa vinculada a su identidad.',
    },
    ipSolicitante: {
      type: String,
      trim: true,
    },
    completadaEn: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SolicitudEliminacion', solicitudEliminacionSchema);
