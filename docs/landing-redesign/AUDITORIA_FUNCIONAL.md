# Auditoría Funcional y Matriz de Veracidad — ContadorGanadero

Fecha de auditoría: 2026-11-04
Rama: `feature/landing-saas-adsense-seo`

## 1. Propósito de la auditoría

Este documento registra el estado técnico real de cada módulo de **ContadorGanadero** contrastado directamente contra el código fuente (`frontend/src/`, `backend/controllers/`, `backend/services/`, `backend/models/`, `backend/config/planes.js`) y las pruebas automatizadas del repositorio. Sirve como fuente de verdad para todo el contenido público, comercial, educativo y de demostración.

---

## 2. Matriz obligatoria de funciones promocionadas y módulos

| Función | Implementación | Estado | Evidencia | Marketing |
|---|---|---|---|---|
| **Dashboard financiero (4 KPIs: Ingresos, Gastos, IVA cuatrimestral, Utilidad neta)** | `frontend/src/pages/DashboardPage.jsx`, `frontend/src/components/dashboard/ResumenCards.jsx`, `backend/controllers/dashboardController.js` | IMPLEMENTADA Y VERIFICADA | Tarjetas `ResumenCards.jsx` con formato CRC y consumo de `/api/dashboard` | **Publicar** (y reutilizar componente real con datos sintéticos etiquetados en la demo pública) |
| **Gráficos del dashboard (Ingresos vs. gastos mensuales, Gastos por categoría, Proyección fiscal)** | `frontend/src/components/dashboard/TendenciaChart.jsx`, `GastosCategoriaList.jsx`, `ProyeccionFiscal.jsx` | IMPLEMENTADA Y VERIFICADA | Componentes activos en `DashboardPage.jsx` | **Publicar** (aclarar que la proyección fiscal es una estimación basada en registros) |
| **Lectura y consulta de Facturas XML Hacienda v4.4** | `frontend/src/pages/FacturasPage.jsx`, `backend/services/xmlParserService.js`, `backend/controllers/facturaController.js` | IMPLEMENTADA Y VERIFICADA | Pruebas en `backend/__tests__/excelAndXmlParser.test.js` (`parseTagValue: false` para clave de 50 dígitos) | **Publicar** |
| **Ingesta de comprobantes por correo (`@contadorganadero.com`) y WhatsApp** | `cloudflare-email-worker/worker.js`, `backend/services/ingestaFacturaService.js`, `backend/routes/whatsappWebhookRoutes.js` | IMPLEMENTADA PARCIALMENTE (sujeta a configuración por entorno/tenant) | `backend/__tests__/ingestaFacturaService.test.js`, `emailWorker.test.js`, `webhooks.test.js` | **Aclarar** que los canales de recepción dependen de la configuración de la cuenta y del entorno |
| **Clasificación de gastos e identificación de insumos agropecuarios (1%)** | `frontend/src/pages/GastosPage.jsx`, `backend/services/aiService.js`, `backend/data/insumos_oficiales.json` | IMPLEMENTADA Y VERIFICADA | Cascada IA + heurística probada en `backend/__tests__/contabilidadRemediacion.test.js` | **Aclarar** que la sugerencia automática requiere revisión del usuario o contador |
| **Registro de ingresos por venta de ganado** | `frontend/src/pages/IngresosPage.jsx`, `frontend/src/components/ingresos/FormularioIngreso.jsx`, `backend/controllers/ingresoController.js` | IMPLEMENTADA Y VERIFICADA | Formulario con tipo de ganado, cantidad de cabezas, precio unitario, comprador y tarifa IVA | **Publicar** (aclarar que el formulario actual está estructurado por cabezas/tipo de ganado) |
| **Inventario multiespecie (Bovinos, Aves, Peces, Colmenas)** | `frontend/src/pages/InventarioPage.jsx`, `backend/models/Inventario.js`, `backend/controllers/inventarioController.js` | IMPLEMENTADA Y VERIFICADA | Pruebas en `backend/__tests__/inventoryCostsRemediacion.test.js` y CRUD completo por especie | **Publicar** |
| **Seguimiento de animales, pesajes y registros sanitarios/vacunación en ficha** | `backend/models/Inventario.js`, `frontend/src/pages/InventarioPage.jsx` | IMPLEMENTADA PARCIALMENTE | Esquema `Inventario.js` almacena peso, estado sanitario y notas; UI focalizada en ficha del animal/lote | **Aclarar** alcance real de ficha de inventario sin prometer automatización veterinaria |
| **Costos de producción e indicadores por unidad (kg, litro, cartón, FCA)** | `frontend/src/pages/CostosPage.jsx`, `backend/models/CostoProduccion.js`, `backend/controllers/costoController.js` | IMPLEMENTADA Y VERIFICADA | Pruebas en `backend/__tests__/inventoryCostsRemediacion.test.js` | **Publicar** (aclarar que el indicador depende de que costos y producción correspondan al mismo período) |
| **Estimaciones tributarias REA (IVA D-135-1, Renta D-101, Conciliación D-150, Calendario fiscal)** | `frontend/src/pages/ImpuestosPage.jsx`, `DeclaracionesPage.jsx`, `D150Page.jsx`, `CalendarioPage.jsx`, `backend/services/impuestoService.js`, `d150Service.js` | IMPLEMENTADA Y VERIFICADA | Pruebas unitarias de cálculo fiscal en `backend/__tests__/` | **Aclarar** que son herramientas de organización y estimación; no sustituyen la presentación oficial ni al contador |
| **Emisión de Facturación Electrónica Hacienda CR v4.4 (FE, TE, NC, ND, FEC, REP)** | `frontend/src/pages/FacturacionPage.jsx`, `HaciendaPage.jsx`, `backend/services/hacienda/` | IMPLEMENTADA PARCIALMENTE / PENDIENTE DE VALIDACIÓN EXTERNA | Builders XML, clave 50 dígitos y firma XAdES-EPES implementados; `docs/PENDIENTES_HACIENDA.md` documenta pruebas pendientes con credenciales/sandbox oficial | **Aclarar / No publicar como emisión oficial lista en producción** hasta completar validación externa |
| **Planes de suscripción (`free` y `pro` a USD 10/mes) con ONVO Pay** | `backend/config/planes.js`, `frontend/src/data/planes.js`, `backend/services/onvoService.js` | IMPLEMENTADA Y VERIFICADA | Solo existen 2 planes (`free` a $0 y `pro` a $10 USD/mes); `quotaGuard.test.js` verifica límites | **Publicar únicamente Gratis y Pro** (eliminado el plan ficticio "Agroempresa") |
| **Pastoreo rotacional y mapa/gestión de potreros** | No existe modelo, ruta ni componente en `backend/` ni `frontend/` | PENDIENTE / INEXISTENTE | Búsqueda exhaustiva (`rg potrero\|pastoreo`) solo halló menciones en la antigua landing | **No publicar** (eliminado de landing y navegación; antiguos enlaces `#pastoreo` retirados) |
| **Identificación mediante imágenes y conteo de ganado con IA** | No existe flujo de conteo visual de animales; `vlm` solo se refiere a lectura de imágenes de recibos/facturas | PENDIENTE / INEXISTENTE | Sin endpoints ni componentes de conteo de animales por visión artificial | **No publicar** (eliminada toda promesa de conteo de animales con IA) |
| **Registros sin conexión (modo offline / Service Worker) y sincronización** | No existe Service Worker, IndexedDB ni cola de sincronización offline en `frontend/` | PENDIENTE / INEXISTENTE | `rg serviceWorker\|offline` confirma ausencia de soporte offline | **No publicar** (eliminada toda afirmación de funcionamiento sin conexión) |
| **Estadísticas comerciales de ahorro o métricas de clientes** | Sin telemetría pública verificada ni estudios auditados | SIMULADA / MOCK (en landing previa) | Textos estáticos en la versión anterior de `LandingPage.jsx` | **No publicar** (solo usar ejemplos didácticos etiquetados explícitamente como datos sintéticos) |

---

## 3. Verificación del Dashboard como Fuente de Verdad

Se inspeccionaron los componentes reales del panel autenticado:
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/components/dashboard/ResumenCards.jsx`
- `frontend/src/components/dashboard/TendenciaChart.jsx`
- `frontend/src/components/dashboard/GastosCategoriaList.jsx`
- `frontend/src/components/dashboard/ProyeccionFiscal.jsx`

El componente público `frontend/src/components/public/ProductDemo.jsx` importa y renderiza directamente `ResumenCards.jsx` con datos sintéticos en colones costarricenses (`CRC`), acompañado de una comparación mensual interactiva con tabla de datos accesible y explicaciones de cada indicador, sin realizar peticiones a endpoints privados ni exponer datos de tenants.

---

## 4. Estado de Planes y Cuotas (`backend/config/planes.js` vs `frontend/src/data/planes.js`)

- **Planes vigentes:** únicamente `free` (Gratis, USD $0/mes) y `pro` (Pro, USD $10/mes).
- **Límites verificados en `backend/config/planes.js`:**
  - `free`: 30 facturas/mes, 50 animales en inventario, 1 usuario, 2 GB almacenamiento, con publicidad cuando esté aprobada (`conAnuncios: true`).
  - `pro`: facturas ilimitadas, animales ilimitados, hasta 3 usuarios, 25 GB almacenamiento, sin publicidad (`conAnuncios: false`).
- **Corrección comercial:** Se eliminó cualquier referencia a un tercer plan ("Agroempresa") que no existe en el backend.
