/**
 * Plugin global de aislamiento Multi-Tenant para Mongoose.
 *
 * Reglas:
 * 1. Asegura que el esquema tenga el campo `tenantId` indexado.
 * 2. En find, findOne, findOneAndUpdate, findOneAndDelete, updateOne, updateMany,
 *    deleteOne, deleteMany y countDocuments:
 *    - Si existe un `tenantId` en el contexto de AsyncLocalStorage, inyecta y fuerza
 *      el filtro `{ tenantId }` automáticamente.
 *    - Si no hay `tenantId` en el contexto ni `{ skipTenant: true }` y la consulta no
 *      está acotada explícitamente, lanza un error `TENANT_CONTEXT_MISSING`.
 * 3. En `aggregate`: inserta `{ $match: { tenantId } }` como primera etapa del pipeline.
 * 4. En `save` e `insertMany`: asigna el `tenantId` del contexto y rechaza si el documento
 *    intentaba escribir un `tenantId` de otra organización.
 */

const mongoose = require('mongoose');
const { getTenantStore } = require('../../utils/tenantContext');

const QUERY_HOOKS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'countDocuments',
];

function toObjectIdIfPossible(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

function hasExplicitScope(filter) {
  if (!filter || typeof filter !== 'object') return false;
  if (filter.tenantId || filter.usuario || filter._id) return true;
  if (Array.isArray(filter.$or) && filter.$or.some((c) => c && (c.tenantId || c.usuario || c._id))) {
    return true;
  }
  if (Array.isArray(filter.$and) && filter.$and.some((c) => c && (c.tenantId || c.usuario || c._id))) {
    return true;
  }
  return false;
}

function tenantPlugin(schema, pluginOptions = {}) {
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        index: true,
        required: false,
      },
    });
  }

  for (const hookName of QUERY_HOOKS) {
    schema.pre(hookName, function (next) {
      const opts = typeof this.getOptions === 'function' ? this.getOptions() : {};
      if (opts.skipTenant === true) {
        return next();
      }

      const store = getTenantStore();
      if (store?.skipTenant === true) {
        return next();
      }

      const contextTenantId = store?.tenantId;
      const currentFilter = typeof this.getFilter === 'function' ? this.getFilter() : {};

      if (contextTenantId) {
        const normalizedContextTenant = toObjectIdIfPossible(contextTenantId);
        this.setQuery({
          ...currentFilter,
          tenantId: normalizedContextTenant,
        });
        return next();
      }

      const mustRejectUnscoped =
        opts.requireTenantContext === true ||
        pluginOptions.requireTenantContext === true ||
        process.env.STRICT_TENANT_CONTEXT === 'true' ||
        (pluginOptions.strict !== false && !hasExplicitScope(currentFilter));

      if (mustRejectUnscoped) {
        const err = new Error(
          'TENANT_CONTEXT_MISSING: Consulta bloqueada por falta de contexto de organización (tenantId).'
        );
        err.code = 'TENANT_CONTEXT_MISSING';
        err.status = 403;
        return next(err);
      }

      return next();
    });
  }

  schema.pre('aggregate', function (next) {
    const opts = this.options || {};
    if (opts.skipTenant === true) {
      return next();
    }

    const store = getTenantStore();
    if (store?.skipTenant === true) {
      return next();
    }

    const pipeline = this.pipeline();
    const firstStage = pipeline[0] || {};
    const contextTenantId = store?.tenantId;

    if (contextTenantId) {
      const normalizedContextTenant = toObjectIdIfPossible(contextTenantId);
      if (firstStage.$geoNear || firstStage.$search) {
        const err = new Error(
          'AGGREGATE_SPECIAL_STAGE: El pipeline comienza con $geoNear o $search y requiere filtro de tenant interno.'
        );
        err.code = 'AGGREGATE_SPECIAL_STAGE';
        return next(err);
      }
      if (!firstStage.$match || String(firstStage.$match.tenantId) !== String(normalizedContextTenant)) {
        pipeline.unshift({ $match: { tenantId: normalizedContextTenant } });
      }
      return next();
    }

    const hasScopedMatch = Boolean(firstStage.$match && hasExplicitScope(firstStage.$match));
    if (!hasScopedMatch || opts.requireTenantContext === true || process.env.STRICT_TENANT_CONTEXT === 'true') {
      const err = new Error(
        'TENANT_CONTEXT_MISSING: Aggregate bloqueado por falta de contexto de organización (tenantId).'
      );
      err.code = 'TENANT_CONTEXT_MISSING';
      err.status = 403;
      return next(err);
    }

    return next();
  });

  schema.pre('save', function (next) {
    if (this.$locals?.skipTenant === true) {
      return next();
    }

    const store = getTenantStore();
    if (store?.skipTenant === true) {
      return next();
    }

    const contextTenantId = store?.tenantId;
    if (contextTenantId) {
      const normalizedContextTenant = toObjectIdIfPossible(contextTenantId);
      if (this.tenantId && String(this.tenantId) !== String(normalizedContextTenant)) {
        if (store.rejectCrossTenantSave === true) {
          const err = new Error('TENANT_MISMATCH: El documento pertenece a otra organización.');
          err.code = 'TENANT_MISMATCH';
          err.status = 403;
          return next(err);
        }
      }
      this.tenantId = normalizedContextTenant;
      return next();
    }

    if (process.env.STRICT_TENANT_CONTEXT === 'true' && !this.tenantId) {
      const err = new Error(
        'TENANT_CONTEXT_MISSING: No se puede guardar un documento sin contexto de organización.'
      );
      err.code = 'TENANT_CONTEXT_MISSING';
      err.status = 403;
      return next(err);
    }

    return next();
  });

  schema.pre('insertMany', function (next, docs) {
    const store = getTenantStore();
    if (store?.skipTenant === true) {
      return next();
    }

    const contextTenantId = store?.tenantId;
    if (contextTenantId && Array.isArray(docs)) {
      const normalizedContextTenant = toObjectIdIfPossible(contextTenantId);
      for (const doc of docs) {
        if (doc && typeof doc === 'object') {
          if (
            doc.tenantId &&
            String(doc.tenantId) !== String(normalizedContextTenant) &&
            store.rejectCrossTenantSave === true
          ) {
            const err = new Error('TENANT_MISMATCH: Intento de insertMany con tenantId distinto al contexto.');
            err.code = 'TENANT_MISMATCH';
            err.status = 403;
            return next(err);
          }
          doc.tenantId = normalizedContextTenant;
        }
      }
      return next();
    }

    if (process.env.STRICT_TENANT_CONTEXT === 'true') {
      const err = new Error(
        'TENANT_CONTEXT_MISSING: No se puede ejecutar insertMany sin contexto de organización.'
      );
      err.code = 'TENANT_CONTEXT_MISSING';
      err.status = 403;
      return next(err);
    }

    return next();
  });
}

tenantPlugin.tenantPlugin = tenantPlugin;
module.exports = tenantPlugin;
