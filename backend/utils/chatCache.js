/**
 * Cache in-memory con TTL para contexto de usuario del chat.
 * Evita consultas repetidas a la base de datos en ráfagas de mensajes.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ENTRIES = 500; // Límite para evitar memory leaks

class ChatCache {
  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.cache = new Map();
    // Limpieza periódica cada 2 minutos
    this._cleanupInterval = setInterval(() => this._cleanup(), 2 * 60 * 1000);
    // No bloquear el event loop al salir
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  /**
   * Obtener valor del cache si existe y no ha expirado.
   * @param {string} userId
   * @returns {object|null}
   */
  get(userId) {
    const key = String(userId);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Guardar valor en el cache con TTL.
   * @param {string} userId
   * @param {object} data
   * @param {number} [ttlMs] - TTL personalizado (opcional)
   */
  set(userId, data, ttlMs) {
    const key = String(userId);

    // Evitar crecimiento descontrolado
    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(key)) {
      this._evictOldest();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.ttlMs),
      createdAt: Date.now(),
    });
  }

  /**
   * Invalidar cache de un usuario específico.
   * Llamar cuando el usuario crea/modifica facturas, ingresos, etc.
   * @param {string} userId
   */
  invalidate(userId) {
    this.cache.delete(String(userId));
  }

  /**
   * Limpiar todo el cache.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Obtener estadísticas del cache.
   */
  stats() {
    let expired = 0;
    const now = Date.now();
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) expired++;
    }
    return {
      size: this.cache.size,
      expired,
      active: this.cache.size - expired,
    };
  }

  /** @private Limpiar entries expirados */
  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /** @private Evictar el entry más viejo */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }

  /** Destruir el cache y limpiar intervalo */
  destroy() {
    clearInterval(this._cleanupInterval);
    this.cache.clear();
  }
}

// Singleton
const contextCache = new ChatCache();

module.exports = { ChatCache, contextCache };
