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
      default: 'app_perfil',
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
      enum: ['completada', 'en_proceso', 'rechazada', 'fallida'],
      default: 'en_proceso',
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
        'De conformidad con la Ley N° 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales de Costa Rica, los datos personales y credenciales han sido eliminados de nuestros servidores activos. Los comprobantes electrónicos transmitidos a Hacienda quedan sujetos al deber legal de conservación del contribuyente.',
    },
    ipSolicitante: {
      type: String,
      trim: true,
    },
    completadaEn: {
      type: Date,
    },
    errorProcesamiento: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SolicitudEliminacion', solicitudEliminacionSchema);
