# AGENTS.md — Reglas Globales y Matriz Obligatoria de Skills (ContadorGanadero)

Este archivo define la arquitectura, convenciones y el **protocolo obligatorio basado en Skills** para todos los agentes de IA (Antigravity, Gemini, Claude Code, Cursor, Codex y subagentes) que trabajen en **ContadorGanadero**.

---

## 🚨 REGLA #1: Protocolo Skill-First (Obligatorio para Todos los Agentes y Subagentes)

**TODOS los agentes y subagentes DEBEN basar su análisis, diseño e implementación en las skills instaladas en este proyecto** (ubicadas en `.agents/skills/<skill>/SKILL.md` y `.claude/skills/<skill>/SKILL.md`).

Antes de planificar, escribir código, refactorizar o responder consultas técnicas sobre cualquier módulo del proyecto, **DEBES identificar el dominio de la tarea en la siguiente matriz y leer el archivo `SKILL.md` correspondiente**:

### Matriz de Activación de Skills por Dominio y Módulo

| Dominio / Módulo del Proyecto | Skill(s) Obligatoria(s) a Consultar | Cuándo Activarla |
| :--- | :--- | :--- |
| **Facturación Electrónica Hacienda CR v4.4** (`backend/services/hacienda/`, `haciendaWorker.js`, `xmlParserService.js`, `FacturaEmision.js`, `HaciendaPage.jsx`) | `hacienda-cr-v44` | Clave de 50 dígitos, XML builders (FE, TE, NC, ND, FEC, REP), firma digital XAdES-EPES (`.p12`), parseo XML (`parseTagValue: false`), OAuth2 Hacienda, cifrado AES-256 (`EMAIL_ENC_KEY`). |
| **Impuestos REA Costa Rica 2026 e IA Contable** (`costaRicaTax.js`, `impuestoService.js`, `d150Service.js`, `declaracionService.js`, `aiProvider.js`, `aiService.js`, `insumos_oficiales.json`) | `rea-impuestos-cr` | Cálculos de IVA cuatrimestral (D-135-1), Renta anual (D-101), liquidación REA (D-150), tarifas 1%/0.5%/2%/13%, exportación CSV/Excel y prompts/proveedores IA (Gemini -> NVIDIA NIM -> heurística). |
| **Multi-Tenancy, Planes (`free`/`pro`) y ONVO Pay** (`tenantGuard.js`, `quotaGuard.js`, `adminGuard.js`, `planes.js`, `onvoService.js`, `Tenant.js`, `scripts/migrate*.js`) | `multitenant-onvo-billing` | Aislamiento por `tenantId` (`req.filtrarPorTenant`, `req.aplicarTenant`), límites de planes, webhooks idempotentes de ONVO Pay (antes de `express.json()`), migraciones con `--dry-run`. |
| **Ingesta de Facturas (Email/WhatsApp), Inventario y Costos** (`ingestaFacturaService.js`, `whatsappService.js`, `emailService.js`, `Inventario.js`, `CostoProduccion.js`) | `ingesta-facturas-agro-inventario` | Recepción de comprobantes por correo/WhatsApp, cascada de resolución de tenant, inventario multiespecie (bovinos, aves, peces, abejas) y cálculo de costos/FCA. |
| **Cloudflare Email Worker** (`cloudflare-email-worker/worker.js`, `wrangler.toml`) | `cloudflare-email-service`, `workers-best-practices` | Enrutamiento catch-all `@contadorganandero.com`, parseo/reenvío MIME `message/rfc822` y configuración de Cloudflare Workers. |
| **Backend Node.js y Express** (`backend/server.js`, `routes/`, `controllers/`, `services/`, `middleware/`) | `nodejs-backend-patterns` | Creación o modificación de rutas REST, controladores, cadena de middlewares, manejo de errores, seguridad (`helmet`, CORS, rate-limiting) y JWT. |
| **Base de Datos MongoDB y Mongoose** (`backend/models/`, consultas, agregaciones, índices) | `mongodb-query-optimizer`, `mongodb-connection` | Diseño de esquemas Mongoose, optimización de índices (ej. `Tenant.js`), operaciones atómicas (`$inc` para consecutivos) y resiliencia de conexión. |
| **Testing Automatizado Backend/JS** (`backend/__tests__/`, `jest.setup.js`) | `javascript-testing-patterns` | Creación o ajuste de pruebas unitarias e integración con Jest, Supertest y `mongodb-memory-server`. |
| **Frontend React 19 y Arquitectura de Componentes** (`frontend/src/pages/`, `frontend/src/components/`, `AuthContext.jsx`, `api.js`) | `vercel-react-best-practices`, `vercel-composition-patterns` | Componentes React 19, hooks, lazy loading de rutas, optimización de renders, manejo de estado y cliente Axios con refresh token. |
| **Diseño UI/UX, Tailwind CSS y shadcn/ui** (`frontend/src/components/ui/`, `*.css`, `tailwind.config.js`) | `tailwind-design-system`, `frontend-design`, `web-design-guidelines` | Estilizado con Tailwind CSS 3 + CSS por página (convención híbrida), componentes Radix UI / shadcn, accesibilidad, responsive design y modo oscuro/claro. |
| **Build, Configuración y Despliegue Frontend (Cloudflare)** (`frontend/vite.config.js`, `frontend/wrangler.toml`, `package.json`) | `vite`, `workers-best-practices` | Configuración de Vite 8, alias `@/`, proxy `/api`, optimización de bundle y despliegue de SPA en producción sobre **Cloudflare** (`wrangler.toml`). |

> **Instrucción para Subagentes (`invoke_subagent`)**: Cuando el agente principal delegue una tarea a un subagente (`self`, `research`, etc.), **DEBE** indicarle explícitamente en su prompt qué archivos `.agents/skills/<skill>/SKILL.md` debe leer antes de ejecutar su tarea.

---

## 📌 Qué es ContadorGanadero

SaaS MERN en español para pequeños productores agropecuarios en Costa Rica bajo el **Régimen Especial Agropecuario (REA - Ley 9635)**:
- Ingesta automática de facturas electrónicas (Cloudflare Email Worker + Bot de WhatsApp).
- Categorización de gastos con IA e identificación de insumos agropecuarios al 1% (`insumos_oficiales.json`).
- Cálculos tributarios de Costa Rica 2026: IVA cuatrimestral (**D-135-1**), Renta progresiva (**D-101**) y Conciliación anual (**D-150**).
- Control de inventario multiespecie (Bovinos, Aves, Peces, Abejas) y costos de producción (FCA, costo por kg/litro/cartón).
- Facturación Electrónica **Hacienda CR v4.4** (clave de 50 dígitos, firma XAdES-EPES `.p12`, worker asíncrono).
- Suscripciones freemium con **ONVO Pay** (planes `free` con anuncios y `pro` a $10/mes sin anuncios).

Workspace npm en la raíz con `backend` y `frontend`. Tanto el backend (`backend/server.js`) como Vite cargan el **único archivo `.env` de la raíz**.

---

## 🌐 Entorno de Producción Actual (Cloudflare + Render)

**El proyecto se encuentra en PRODUCCIÓN activa** bajo la siguiente infraestructura:

1. **Frontend en Producción → Cloudflare** ([`frontend/wrangler.toml`](file:///C:/Users/samu3/Desktop/Contador%20IA/frontend/wrangler.toml)):
   - Desplegado en **Cloudflare** (Workers Static Assets / Pages, `name = "contador-ganadero"`, sirviendo `./dist` con `not_found_handling = "single-page-application"`).
   - El enrutamiento de correos entrantes (`*@contadorganandero.com`) también corre en producción sobre **Cloudflare Email Routing + Email Worker** ([`cloudflare-email-worker/worker.js`](file:///C:/Users/samu3/Desktop/Contador%20IA/cloudflare-email-worker/worker.js)).
2. **Backend en Producción → Render** ([`render.yaml`](file:///C:/Users/samu3/Desktop/Contador%20IA/render.yaml)):
   - **API Web Service (`contador-ganadero-api`)**: Node.js/Express en Render (`https://contador-ganadero.onrender.com`, healthcheck en `/api/health`).
   - **Background Worker (`contador-ganadero-imap-worker`)**: Proceso `node worker.js` en Render para tareas asíncronas y escucha IMAP/Hacienda.
3. **Reglas de Producción para Todos los Agentes**:
   - **CORS, Cookies y Auth Cross-Origin**: Como el frontend vive en **Cloudflare** y la API en **Render**, nunca romper la configuración de CORS dinámico en `backend/server.js`, el envío de credenciales (`withCredentials: true` en `frontend/src/services/api.js`) ni los atributos de cookies de refresh token en producción.
   - **Variables de Entorno y Webhooks**: Respetar `VITE_API_URL` en el build de Cloudflare y mantener intactas las rutas de webhooks productivos en Render (`/api/webhooks/email`, `/api/webhooks/whatsapp`, `/api/onvo/webhook`) y el cron `/api/cron/sync-emails` que mantiene activo el servicio.
   - **Cero Regresiones en Build**: Todo cambio en `frontend/` debe compilar limpiamente en `./dist` (`npm run build`) para su despliegue en Cloudflare.

---

## 🛠️ Comandos Esenciales

```bash
# Backend (ejecutar desde backend/)
npm run dev                             # nodemon server.js
npm test                                # jest --runInBand
npx jest __tests__/quotaGuard.test.js   # archivo de test individual
npx jest -t "nombre"                    # caso de test individual
npm run test:coverage                   # cobertura de tests
npm run migrate:tenant                  # migraciones (soportan --dry-run): migrate:planes, migrate:onvo

# Frontend (ejecutar desde frontend/)
npm run dev                             # vite (proxy /api -> http://localhost:5000)
npm run build                           # limpia dist/ y ejecuta vite build
npm run lint                            # eslint
```

---

## 🏗️ Reglas Críticas de Arquitectura (Resumen Ejecutivo)

1. **Orden de Middlewares en `backend/server.js`**:
   `helmet` → `morgan` → CORS dinámico → **Webhook de ONVO (`/api/onvo/webhook`) montado ANTES de `express.json()`** → `express.json()` / `urlencoded` → `cookieParser` → rutas auth → rate limiters (excluyendo webhooks) → rutas `/api/*` → SPA estática (`../frontend/dist`) → middleware global de errores (devuelve mocks demo cuando MongoDB no responde; es intencional).
2. **Multi-Tenancy (`tenantId`)**:
   Todo documento de datos pertenece a un `tenantId`. Usar siempre `req.filtrarPorTenant()` y `req.aplicarTenant()` de `middleware/tenantGuard.js` (manteniendo compatibilidad con `usuario` donde aún exista). `Categoria` es el único catálogo global sin `tenantId`.
3. **Planes (`free` y `pro`)**:
   Definidos en `backend/config/planes.js` (`LIMITES_POR_PLAN`) y reflejados en `frontend/src/data/planes.js`. Nunca agregar planes fuera de `free` y `pro`.
4. **Parseo XML (`xmlParserService.js`)**:
   Mantener siempre `parseTagValue: false` en `fast-xml-parser` para no corromper claves numéricas de 50 dígitos ni ceros iniciales.
5. **Cifrado (`utils/crypto.js`)**:
   `EMAIL_ENC_KEY` debe tener exactamente 64 caracteres hexadecimales para cifrar certificados `.p12` y credenciales por tenant. Jamás commitear `.env` ni `*.p12`.
6. **Convención Híbrida de Estilos en Frontend**:
   Coexisten Tailwind CSS 3 + componentes shadcn/ui (`src/components/ui/`) con hojas CSS por página (`DashboardPage.css`, etc.). Respetar el patrón de la página que se edite y mantener todos los textos de interfaz en español (terminología agropecuaria y fiscal de Costa Rica).
