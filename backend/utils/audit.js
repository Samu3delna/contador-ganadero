/**
 * Servicio de registro de auditoría y detección de anomalías en tiempo real.
 */

const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { logger, redactarValor } = require('./logger');

// Contadores en ventana deslizante para detección de anomalías (5 minutos)
const VENTANA_MS = 5 * 60 * 1000;
const UMBRAL_ERRORES_AUTH_IP = 15;
const UMBRAL_DESCARGAS_USUARIO = 30;

const _contadoresAnomalias = new Map();

function registrarContador(clave, umbral) {
  const ahora = Date.now();
  const actual = _contadoresAnomalias.get(clave);
  if (!actual || ahora > actual.expiraEn) {
    _contadoresAnomalias.set(clave, { count: 1, expiraEn: ahora + VENTANA_MS });
    return false;
  }
  actual.count += 1;
  return actual.count === umbral;
}

/**
 * Registra un evento en la colección inmutable AuditLog y evalúa reglas de alerta.
 * No interrumpe el flujo principal si la base de datos no está conectada en un test unitario.
 *
 * @param {import('express').Request | null} req
 * @param {{
 *   accion: string,
 *   recurso?: string,
 *   recursoId?: string,
 *   resultado?: 'exito' | 'fallo' | 'bloqueado' | 'alerta',
 *   motivo?: string,
 *   actorId?: any,
 *   tenantId?: any,
 *   rol?: string,
 *   metadatos?: object
 * }} evento
 */
async function audit(req, evento) {
  try {
    const actorId = evento.actorId || req?.usuario?._id || null;
    const tenantId =
      evento.tenantId ||
      req?.tenant?._id ||
      req?.usuario?.tenantId ||
      null;
    const rol = evento.rol || req?.usuario?.rol || (req?.usuario?.isSuperAdmin ? 'superadmin' : 'anonimo');
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const userAgent = req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 300) : null;
    const requestId = req?.id || null;

    const payload = {
      fecha: new Date(),
      actorId: mongoose.Types.ObjectId.isValid(actorId) ? actorId : null,
      tenantId: mongoose.Types.ObjectId.isValid(tenantId) ? tenantId : null,
      rol,
      accion: evento.accion,
      recurso: evento.recurso || 'sistema',
      recursoId: evento.recursoId ? String(evento.recursoId) : null,
      ip: ip ? String(ip).slice(0, 64) : null,
      userAgent,
      resultado: evento.resultado || 'exito',
      motivo: evento.motivo ? String(evento.motivo).slice(0, 500) : null,
      requestId,
      metadatos: redactarValor(evento.metadatos || {}),
    };

    logger.security(`audit:${payload.accion}`, {
      actorId: payload.actorId ? String(payload.actorId) : null,
      tenantId: payload.tenantId ? String(payload.tenantId) : null,
      resultado: payload.resultado,
      recurso: payload.recurso,
      ip: payload.ip,
      requestId,
    });

    // Reglas de detección de anomalías
    if (ip && (evento.accion === 'auth.login_fallido' || evento.accion === 'auth.acceso_denegado')) {
      if (registrarContador(`auth_fail:${ip}`, UMBRAL_ERRORES_AUTH_IP)) {
        logger.security('ALERTA_SEGURIDAD: Pico de fallos 401/403 desde una misma IP', { ip, accion: evento.accion });
      }
    }

    if (actorId && evento.accion.startsWith('archivo.descarga')) {
      if (registrarContador(`download:${actorId}`, UMBRAL_DESCARGAS_USUARIO)) {
        logger.security('ALERTA_SEGURIDAD: Descarga masiva de comprobantes detectada', {
          actorId: String(actorId),
          tenantId: tenantId ? String(tenantId) : null,
        });
      }
    }

    if (mongoose.connection.readyState === 1) {
      await AuditLog.create(payload);
    }
  } catch (err) {
    logger.warn('No se pudo persistir evento en AuditLog', { error: err.message });
  }
}

module.exports = {
  audit,
};
