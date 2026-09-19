const axios = require('axios');

/**
 * Servicio ONVO Pay — cliente REST mínimo para la API v1.
 *
 * Docs: https://docs.onvopay.com
 * Autenticación: header `Authorization: Bearer <ONVO_SECRET_KEY>`.
 * El modo (test|live) lo determina la llave: onvo_test_* / onvo_live_*.
 */

const ONVO_API_BASE_URL = process.env.ONVO_API_BASE_URL || 'https://api.onvopay.com/v1';

/**
 * Devuelve un cliente axios autenticado contra la API de ONVO.
 * Lanza error 503 si ONVO_SECRET_KEY no está configurada.
 */
const clienteOnvo = () => {
  const secretKey = process.env.ONVO_SECRET_KEY;
  if (!secretKey) {
    const err = new Error('ONVO Pay no configurado. Define ONVO_SECRET_KEY en .env');
    err.status = 503;
    throw err;
  }
  return axios.create({
    baseURL: ONVO_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });
};

/**
 * Normaliza errores de la API de ONVO a un Error con mensaje legible.
 */
const normalizarError = (error) => {
  const detalle = error.response?.data;
  const mensajeApi = detalle?.error?.message || detalle?.message || detalle?.error;
  const err = new Error(
    typeof mensajeApi === 'string' && mensajeApi
      ? `ONVO: ${mensajeApi}`
      : `Error ONVO (${error.response?.status || error.message})`
  );
  err.status = error.response?.status || 502;
  return err;
};

/**
 * Crea un cliente en ONVO.
 * @param {{ email: string, nombre: string }} params
 * @returns {Promise<object>} Cliente ONVO (usa .id)
 */
const crearCliente = async ({ email, nombre }) => {
  try {
    const { data } = await clienteOnvo().post('/customers', {
      email,
      name: nombre,
    });
    return data;
  } catch (error) {
    throw normalizarError(error);
  }
};

/**
 * Crea un cargo recurrente (suscripción) en estado incompleto,
 * listo para confirmarse desde el frontend con el SDK web de ONVO
 * (onvo.pay con paymentType: 'subscription').
 * @param {{ customerId: string, priceId: string, metadata?: object, descripcion?: string }} params
 * @returns {Promise<object>} Suscripción ONVO (usa .id)
 */
const crearSuscripcion = async ({ customerId, priceId, metadata = {}, descripcion }) => {
  try {
    const { data } = await clienteOnvo().post('/subscriptions', {
      customerId,
      paymentBehavior: 'allow_incomplete',
      description: descripcion,
      items: [{ priceId, quantity: 1 }],
      metadata,
    });
    return data;
  } catch (error) {
    throw normalizarError(error);
  }
};

/**
 * Obtiene un cargo recurrente por ID.
 * @param {string} subscriptionId
 * @returns {Promise<object>}
 */
const obtenerSuscripcion = async (subscriptionId) => {
  try {
    const { data } = await clienteOnvo().get(`/subscriptions/${subscriptionId}`);
    return data;
  } catch (error) {
    throw normalizarError(error);
  }
};

/**
 * Cancela un cargo recurrente inmediatamente (DELETE /v1/subscriptions/{id}).
 * @param {string} subscriptionId
 * @returns {Promise<object>}
 */
const cancelarSuscripcion = async (subscriptionId) => {
  try {
    const { data } = await clienteOnvo().delete(`/subscriptions/${subscriptionId}`);
    return data;
  } catch (error) {
    throw normalizarError(error);
  }
};

module.exports = {
  crearCliente,
  crearSuscripcion,
  obtenerSuscripcion,
  cancelarSuscripcion,
};
