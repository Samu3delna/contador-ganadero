# Suscripciones — modelo de 3 planes (freemium con anuncios)

> Fecha: 2026-08-24
> Estado: implementado en backend + frontend. Pendiente: configurar productos en Stripe y activar el proveedor de anuncios.

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
  - `CATALOGO_PLANES` → precios/features que sirve `GET /api/stripe/planes`.
- **Modelo Tenant:** `backend/models/Tenant.js` (enum `free|pro|agro` + método `aplicarPlan`).
- **Stripe:** `backend/controllers/stripeController.js` y `backend/routes/stripeRoutes.js`
  (checkout, portal, estado, catálogo público y webhook idempotente).
- **Frontend:** `frontend/src/data/planes.js` (fallback) + `PlanesPage`, `BillingPage`,
  `Sidebar`, `PlanCard`, `AdvertisingSlot`.
- **Migración:** `backend/scripts/migratePlanes.js`.

## Lo que ya está implementado

1. Catálogo único de 3 planes (back y front) con flag `anunciosHabilitados`.
2. Checkout Stripe para `pro` y `agro`; el `free` se gestiona al cancelar (Stripe Portal).
3. Webhooks Stripe que aplican plan, estado (`activo`, `periodo_gracia`, `cancelado`)
   y resetean consumo.
4. `GET /api/stripe/planes` público para que la landing/web de precios no duplique datos.
5. UI: tarjetas de 3 planes, badge *Con anuncios / Sin anuncios*, página de suscripción
   y sidebar con el nombre del plan.
6. Ranura de anuncios `frontend/src/components/ads/AdvertisingSlot.jsx` que solo se
   muestra en el plan Gratis (placeholder listo para AdSense).
7. Script de migración para tenants que aún tengan `bronce|oro|corporativo`.

## Pendiente para dejarlo 100% operativo

### 1. Stripe
- Crear tres *Products* y *Prices* en Stripe (o usar el catálogo).
- Configurar en `.env`:
  ```env
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PRICE_FREE=price_...      # normalmente no se necesita para suscripción free
  STRIPE_PRICE_PRO=price_...
  STRIPE_PRICE_AGRO=price_...
  STRIPE_SUCCESS_URL=https://tu-dominio/planes?status=success
  STRIPE_CANCEL_URL=https://tu-dominio/planes?status=cancel
  ```
- Crear el webhook en Stripe hacia `POST /api/stripe/webhook` con los eventos:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

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
- **Pruebas de regresión** de `stripeController`, `tenantGuard` y `quotaGuard`
  (requieren `mongodb-memory-server` con cache de Mongod disponible).
