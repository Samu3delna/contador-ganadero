# Suscripciones — modelo de 3 planes (freemium con anuncios)

> Fecha: 2026-09-18
> Estado: implementado en backend + frontend con **ONVO Pay** (migrado desde Stripe).
> Pendiente: configurar productos/precios en ONVO y activar el proveedor de anuncios.

## Idea de negocio

La web tendrá anuncios para financiar la cuenta gratuita. Los planes de pago eliminan
los anuncios y aumentan límites/features:

| Plan | Precio | Anuncios | Conteos IA/mes | Usuarios | Almacenamiento | VLM | D-150 | Soporte |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Gratis** (`free`) | $0 | Sí | 10 | 1 | 2 GB | No | No | Comunidad |
| **Pro** (`pro`) | $19/mes | No | 300 | 3 | 25 GB | Sí | Sí | Email |
| **Agro** (`agro`) | $49/mes | No | 3.000 | 10 | 200 GB | Sí | Sí | Prioritario |

## Dónde está definido

- **Fuente de verdad backend:** `backend/config/planes.js`
  - `LIMITES_POR_PLAN` → límites aplicados por el servidor (Tenant).
  - `CATALOGO_PLANES` → precios/features que sirve `GET /api/onvo/planes`.
- **Modelo Tenant:** `backend/models/Tenant.js` (enum `free|pro|agro` + método `aplicarPlan`).
- **ONVO Pay:** `backend/controllers/onvoController.js`, `backend/services/onvoService.js`
  y `backend/routes/onvoRoutes.js` / `onvoWebhookRoutes.js`
  (checkout con SDK web, cancelación, estado, catálogo público y webhook idempotente).
- **Frontend:** `frontend/src/data/planes.js` (fallback) + `PlanesPage`, `BillingPage`,
  `Sidebar`, `PlanCard`, `OnvoCheckoutModal`, `AdvertisingSlot`.
- **Migración:** `backend/scripts/migratePlanes.js`.

## Lo que ya está implementado

1. Catálogo único de 3 planes (back y front) con flag `anunciosHabilitados`.
2. Suscripción ONVO para `pro` y `agro`: el backend crea el cargo recurrente
   (`paymentBehavior: allow_incomplete`) y el frontend lo confirma con el SDK web
   (`onvo.pay` con `paymentType: 'subscription'`). El `free` se gestiona al cancelar
   desde "Mi Suscripción" (`POST /api/onvo/cancelar`).
3. Webhooks ONVO que aplican plan, estado (`activo`, `periodo_gracia`, `cancelado`)
   y resetean consumo.
4. `GET /api/onvo/planes` público para que la landing/web de precios no duplique datos.
5. UI: tarjetas de 3 planes, badge *Con anuncios / Sin anuncios*, página de suscripción
   y sidebar con el nombre del plan.
6. Ranura de anuncios `frontend/src/components/ads/AdvertisingSlot.jsx` que solo se
   muestra en el plan Gratis (placeholder listo para AdSense).
7. Script de migración para tenants que aún tengan `bronce|oro|corporativo`.

## Pendiente para dejarlo 100% operativo

### 1. ONVO Pay
- Crear los *Products* y *Prices* recurrentes (mensuales) en el Dashboard de ONVO.
- Configurar en `.env`:
  ```env
  ONVO_SECRET_KEY=onvo_live_secret_key_...
  ONVO_PUBLISHABLE_KEY=onvo_live_publishable_key_...
  ONVO_WEBHOOK_SECRET=webhook_secret_...
  ONVO_PRICE_FREE=                  # normalmente no se necesita para suscripción free
  ONVO_PRICE_PRO=cl...
  ONVO_PRICE_AGRO=cl...
  ```
- Registrar el webhook en el Dashboard de ONVO (sección Desarrolladores) hacia
  `POST /api/onvo/webhook` y copiar el `X-Webhook-Secret` generado a `ONVO_WEBHOOK_SECRET`.
  Eventos relevantes:
  - `subscription.renewal.succeeded` (alta y renovación: activa plan y resetea consumo)
  - `subscription.renewal.failed` (pago fallido: pasa a `periodo_gracia`)
- Nota: ONVO no tiene portal de clientes ni webhook de cancelación; la cancelación
  se hace desde la app (`DELETE /v1/subscriptions/{id}` vía `POST /api/onvo/cancelar`).
- Limpieza de la base de datos (campos e índices legados de Stripe):
  ```bash
  cd backend
  npm run migrate:onvo -- --dry-run   # simulación
  npm run migrate:onvo                # aplica (ya ejecutada 2026-09-18)
  ```

### 2. Migración de tenants existentes
```bash
cd backend
npm run migrate:planes   # o: node scripts/migratePlanes.js
node scripts/migratePlanes.js --dry-run   # revisar antes de aplicar
```
Mapeo: `bronce -> pro`, `oro -> agro`, `corporativo -> agro`.

### 3. Publicidad real
- Conseguir cuenta Google AdSense y aprobar el sitio.
- Configurar `VITE_ADSENSE_CLIENT` y `VITE_ADSENSE_SLOT`.
- En `AdvertisingSlot.jsx`, reemplazar el placeholder por el `<ins class="adsbygoogle">`
  y disparar `(adsbygoogle = window.adsbygoogle || []).push({})`.

### 4. Endurecimiento (recomendado, no bloqueante)
- **Cron mensual** que resetee `consumoActual` (ya está planificado, falta conectar).
- **Registro de facturas/invoices** (guardar `id`, monto, status) para contabilidad interna.
- **Enforcement `anuncios`**: el componente ya oculta los anuncios cuando el plan no es `free`;
  conviene además bloquear el módulo D-150 en `free` (existe `moduloD150` en límites).
- **Overrides por entorno**: poner precio/periodicidad en variables, no hardcodeados,
  si se desea facturar en colonas o con impuestos locales.
- **Pruebas de regresión** de `onvoController`, `tenantGuard` y `quotaGuard`
  (requieren `mongodb-memory-server` con cache de Mongod disponible).
