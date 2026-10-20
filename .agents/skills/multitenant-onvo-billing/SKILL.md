---
name: multitenant-onvo-billing
description: >-
  Arquitectura multi-inquilino (multi-tenant), control de cuotas por plan (free y pro), pasarela de pagos ONVO Pay y migraciones de base de datos en ContadorGanadero. Úsese siempre que se creen o modifiquen endpoints, controladores, modelos Mongoose, middlewares de autenticación/tenant/cuotas, flujos de suscripción ONVO Pay o scripts de migración.
---

# Arquitectura Multi-Tenant, Planes y ONVO Pay (`multitenant-onvo-billing`)

Esta skill establece las reglas obligatorias de aislamiento de datos por finca (`tenantId`), control de planes (`free` vs `pro`) e integración con **ONVO Pay** en **ContadorGanadero**.

## Archivos Clave del Módulo

- `backend/middleware/authMiddleware.js`: Autenticación JWT Bearer (`protegerRuta`) con payload `{ id, tenantId, rol }` y refresh token en cookie `httpOnly`.
- `backend/middleware/tenantGuard.js`: Middleware `extraerTenant` que inyecta `req.tenant`, `req.filtrarPorTenant()` y `req.aplicarTenant()`.
- `backend/middleware/quotaGuard.js`: Verificación de límites mensuales (`conteosMes`, `tokensChatMes`, `moduloContable`, `moduloD150`, `vlmHabilitado`).
- `backend/middleware/adminGuard.js`: Verificación de super-administrador (`esSuperAdmin` vía `SUPER_ADMIN_EMAILS`).
- `backend/config/planes.js`: **Única fuente de verdad en backend** para `PLANES_VALIDOS` (`['free', 'pro']`), `LIMITES_POR_PLAN` y `CATALOGO_PLANES`.
- `frontend/src/data/planes.js`: Espejo en frontend del catálogo de planes.
- `backend/services/onvoService.js` & `backend/controllers/onvoController.js`: Integración con ONVO Pay REST y webhooks idempotentes.
- `backend/models/Tenant.js` & `backend/models/SubscriptionEvent.js`: Modelos de finca y eventos de suscripción.

## Reglas Inquebrantables

1. **Aislamiento Multi-Tenant en Consultas y Escrituras**:
   - Todo documento de negocio (`Factura`, `FacturaEmision`, `Ingreso`, `Inventario`, `CostoProduccion`, `Declaracion`) pertenece a un `tenantId`.
   - En los controladores, usar siempre `req.filtrarPorTenant({ ... })` para lecturas y `req.aplicarTenant(doc)` para creaciones.
   - Mantener compatibilidad con rutas heredadas que también guardan `usuario: req.usuario.id` junto con `tenantId`.
   - **Excepción única**: El modelo `Categoria` es un catálogo global y nunca lleva `tenantId`.
2. **Planes Exclusivos (`free` y `pro`)**:
   - Solo existen dos planes válidos: `free` (Gratis, con anuncios, 10 conteos IA/mes, 1 usuario, sin D-150 ni VLM) y `pro` ($10/mes, sin anuncios, 300 conteos IA/mes, 3 usuarios, con D-150 y VLM).
   - Cualquier referencia a planes antiguos (`bronce`, `oro`, `corporativo`, `agro`) es legada y se migra a `pro`.
   - Si se modifica un límite en `backend/config/planes.js`, sincronizar inmediatamente `frontend/src/data/planes.js`.
3. **Orden de Middlewares en `backend/server.js` y Webhooks de ONVO Pay**:
   - La ruta del webhook de ONVO (`/api/onvo/webhook`) **DEBE montarse ANTES de `express.json()`** en `server.js` y está excluida del rate limiter general. Se autentica mediante el header `X-Webhook-Secret` (`ONVO_WEBHOOK_SECRET`).
   - Los webhooks de ONVO deben ser **idempotentes** registrando el evento en `SubscriptionEvent`.
   - ONVO no envía webhook de cancelación: la cancelación ocurre en la app vía `POST /api/onvo/cancelar`.
4. **Tolerancia Offline / Modo Demo**:
   - `authMiddleware.js`, `tenantGuard.js` y el middleware global de errores en `server.js` devuelven datos demo cuando MongoDB no está disponible. No eliminar este fallback.
5. **Scripts de Migración (`backend/scripts/`)**:
   - Toda migración de datos debe soportar el flag `--dry-run` y ser idempotente.

## Verificación

Ejecutar la suite de pruebas de guards y migraciones:
```bash
cd backend && npx jest __tests__/quotaGuard.test.js __tests__/tenantGuard.test.js --runInBand
```
