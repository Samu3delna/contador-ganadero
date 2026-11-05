# Reporte de Aseguramiento de Calidad (QA) — Rediseño Público, SEO y Cumplimiento AdSense

**Proyecto:** ContadorGanadero (Frontend en Cloudflare + Backend en Render)  
**Rol:** AGENTE 09 — Senior QA Automation Engineer  
**Estado General:** **APROBADO (100% PASS — 0 Regresiones)**

---

## 1. Resumen Ejecutivo

Se ejecutó la batería integral de aseguramiento de calidad sobre el sitio público rediseñado, el sistema de prerenderizado estático, la arquitectura de cumplimiento de Google AdSense (fail-closed) y los módulos críticos del backend:

| Categoría de Prueba | Herramienta / Comando | Casos Evaluados | Resultado |
| :--- | :--- | :---: | :---: |
| **Análisis Estático (Lint Frontend)** | `npm run lint --workspace frontend` | Todo `frontend/` | **PASS** (0 errores, 0 warnings) |
| **Build de Producción + Prerender SEO** | `npm run build --workspace frontend` | 28 HTML + `sitemap.xml` | **PASS** (3001 módulos, 2.51 s) |
| **Pruebas Unitarias de Política AdSense** | `node --test frontend/tests/adPolicy.test.js` | 6 suites / casos | **PASS** (6/6 en 2.58 s) |
| **Rutas Públicas, SEO y Accesibilidad (E2E)** | Playwright (`Chromium / Edge Headless`) | 18 rutas (17 públicas + 404) | **PASS** (18/18) |
| **Interactividad UI (`PublicNavbar` + `ProductDemo`)** | Playwright (`Chromium / Edge Headless`) | 12 aserciones interactivas | **PASS** (12/12) |
| **Responsividad (`scrollWidth <= innerWidth`)** | Playwright (`320, 375, 768, 1024, 1440 px`) | 90 combinaciones (18 rutas × 5 anchos) | **PASS** (0 desbordamientos) |
| **Cumplimiento DOM de Google AdSense** | Playwright (`Chromium / Edge Headless`) | 8 flujos críticos + 18 rutas | **PASS** (0 scripts/slots activos) |
| **Protección de Rutas Privadas y `noindex`** | Playwright (`/dashboard`, `/admin`) | 2 flujos de redirección | **PASS** (2/2 redirigen a `/login`) |
| **Estabilidad de Consola JS (`pageerror`)** | Playwright (`page.on('pageerror')`) | Recorrido completo E2E | **PASS** (0 errores de ejecución) |
| **No-Regresión Backend (Multi-Tenant, XML, Costos)** | `npx jest ... --runInBand` | 3 suites / 25 tests | **PASS** (25/25 en 16.57 s) |

---

## 2. Lint, Build de Producción y Prerenderizado Estático (`frontend/dist`)

### 2.1. Resultado de ESLint
- **Comando:** `npm run lint --workspace frontend`
- **Código de salida:** `0` (sin errores ni advertencias).

### 2.2. Resultado de Vite Build + Prerender (`scripts/prerender.mjs`)
- **Comando:** `npm run build --workspace frontend`
- **Código de salida:** `0`
- **Tiempo de compilación:** `2.51 s` (`3001 modules transformed`)
- **Salida del script de prerender:** `Prerender: 28 public pages.`
- **Verificación de `dist/sitemap.xml`:** Presente (`True`), con las 28 URLs canónicas públicas bajo `https://contadorganadero.com/...`.

### 2.3. Inventario Verificado de los 28 Archivos HTML Prerenderizados en `frontend/dist`

| # | Archivo Generado en `frontend/dist/` | Ruta Pública Asociada |
| :-: | :--- | :--- |
| 1 | `dist/index.html` | `/` |
| 2 | `dist/producto.html` | `/producto` |
| 3 | `dist/producto/dashboard.html` | `/producto/dashboard` |
| 4 | `dist/producto/facturas.html` | `/producto/facturas` |
| 5 | `dist/producto/ingresos.html` | `/producto/ingresos` |
| 6 | `dist/producto/gastos.html` | `/producto/gastos` |
| 7 | `dist/producto/inventario.html` | `/producto/inventario` |
| 8 | `dist/producto/costos.html` | `/producto/costos` |
| 9 | `dist/producto/impuestos.html` | `/producto/impuestos` |
| 10 | `dist/tutoriales.html` | `/tutoriales` |
| 11 | `dist/tutoriales/conoce-contadorganadero.html` | `/tutoriales/conoce-contadorganadero` |
| 12 | `dist/tutoriales/dashboard.html` | `/tutoriales/dashboard` |
| 13 | `dist/tutoriales/registrar-ingresos.html` | `/tutoriales/registrar-ingresos` |
| 14 | `dist/tutoriales/facturas-xml.html` | `/tutoriales/facturas-xml` |
| 15 | `dist/tutoriales/inventario.html` | `/tutoriales/inventario` |
| 16 | `dist/tutoriales/costos-produccion.html` | `/tutoriales/costos-produccion` |
| 17 | `dist/academia.html` | `/academia` |
| 18 | `dist/academia/organizar-ingresos-gastos.html` | `/academia/organizar-ingresos-gastos` |
| 19 | `dist/academia/interpretar-facturas-xml.html` | `/academia/interpretar-facturas-xml` |
| 20 | `dist/academia/costos-produccion-ganadera.html` | `/academia/costos-produccion-ganadera` |
| 21 | `dist/academia/rentabilidad-agropecuaria.html` | `/academia/rentabilidad-agropecuaria` |
| 22 | `dist/academia/inventario-ganado.html` | `/academia/inventario-ganado` |
| 23 | `dist/academia/preparar-informacion-rea.html` | `/academia/preparar-informacion-rea` |
| 24 | `dist/academia/registrar-ventas-agropecuarias.html` | `/academia/registrar-ventas-agropecuarias` |
| 25 | `dist/precios.html` | `/precios` |
| 26 | `dist/preguntas-frecuentes.html` | `/preguntas-frecuentes` |
| 27 | `dist/contacto.html` | `/contacto` |
| 28 | `dist/soluciones.html` | `/soluciones` |

> [!NOTE]
> **Observación de Bundle Performance (`web-perf` / `vercel-react-best-practices`):**  
> Las páginas públicas están separadas mediante code-splitting en chunks ligeros (`PublicLayout` 1.90 kB gzip, `LandingPage` 3.16 kB gzip, `ProductDemo` 1.75 kB gzip, `ProductPages` 3.61 kB gzip, `CommercialPages` 2.11 kB gzip, `LearningPages` 10.84 kB gzip, `LandingPage.css` 3.30 kB gzip).

---

## 3. Pruebas Unitarias de Política AdSense (`frontend/tests/adPolicy.test.js`)

- **Comando:** `node --test frontend/tests/adPolicy.test.js`
- **Resultado:** `6 pass, 0 fail` (`duration_ms: 2586.62`)

| # | Caso de Prueba Verificado | Duración | Estado |
| :-: | :--- | :---: | :---: |
| 1 | `production policy is disabled even with complete context` | `1.43 ms` | **PASS** |
| 2 | `release, consent, loading and content gates fail closed` | `0.29 ms` | **PASS** |
| 3 | `Pro, conflicting plans, unknown plans and administrators never qualify` | `0.26 ms` | **PASS** |
| 4 | `blocked screens stay blocked even if mistakenly allowlisted` | `0.17 ms` | **PASS** |
| 5 | `static publisher verification matches ads.txt with no global ad script` | `1.11 ms` | **PASS** |
| 6 | `loader handles failure, retries once and shares concurrent initialization` | `107.83 ms` | **PASS** |

---

## 4. Pruebas E2E, Visuales, Accesibilidad y Responsividad (Playwright)

Se ejecutó el script automatizado `$env:TEMP/cg-public-qa/run-qa.mjs` con servidor estático sobre `frontend/dist` (puerto `4173`, emulando la resolución de HTML prerenderizado + SPA fallback de Cloudflare Workers) usando Chromium headless.

### 4.1. Verificación de Rutas Públicas, Estructura Semántica y SEO

En las 18 rutas evaluadas se comprobó la existencia de `<main id="contenido-publico">`, el enlace de salto accesible `<a class="cg-skip" href="#contenido-publico">Saltar al contenido</a>`, exactamente **1** elemento `<h1>` por vista, `<link rel="canonical">` y directiva `meta[name="robots"]`:

| Ruta | `<title>` | `<h1>` Único (`h1Count = 1`) | `<main>` y `.cg-skip` | `meta[name="robots"]` | Canonical URL |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `/` | Administración agropecuaria para Costa Rica \| ContadorGanadero | Tu finca, tus números y tus decisiones. Todo bajo control. | Sí / Sí | `index, follow` | `https://contadorganadero.com/` |
| `/producto` | Conoce el producto \| ContadorGanadero | De tus registros a una visión más clara. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto` |
| `/producto/dashboard` | Dashboard financiero \| ContadorGanadero | Una mirada completa a los números de tu finca. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto/dashboard` |
| `/producto/facturas` | Organiza tus facturas XML \| ContadorGanadero | Tus facturas tienen información útil. Encuéntrala. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto/facturas` |
| `/producto/ingresos` | Registro de ingresos \| ContadorGanadero | Registra una venta. Conserva su contexto. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto/ingresos` |
| `/producto/gastos` | Organiza los gastos de tu finca \| ContadorGanadero | Entiende en qué se van los recursos. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto/gastos` |
| `/producto/inventario` | Inventario agropecuario \| ContadorGanadero | Conoce qué tienes. Organiza cómo lo registras. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto/inventario` |
| `/producto/costos` | Costos de producción \| ContadorGanadero | Ponle números a lo que cuesta producir. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto/costos` |
| `/producto/impuestos` | Información para tus impuestos \| ContadorGanadero | Prepara tu información. Revisa tus estimaciones. | Sí / Sí | `index, follow` | `https://contadorganadero.com/producto/impuestos` |
| `/tutoriales` | Tutoriales paso a paso \| ContadorGanadero | Tutoriales | Sí / Sí | `index, follow` | `https://contadorganadero.com/tutoriales` |
| `/tutoriales/conoce-contadorganadero` | Conoce ContadorGanadero \| ContadorGanadero | Conoce ContadorGanadero | Sí / Sí | `index, follow` | `https://contadorganadero.com/tutoriales/conoce-contadorganadero` |
| `/academia` | Academia agropecuaria \| ContadorGanadero | Academia ContadorGanadero | Sí / Sí | `index, follow` | `https://contadorganadero.com/academia` |
| `/academia/organizar-ingresos-gastos` | Cómo organizar los ingresos y gastos de una finca \| ContadorGanadero | Cómo organizar los ingresos y gastos de una finca | Sí / Sí | `index, follow` | `https://contadorganadero.com/academia/organizar-ingresos-gastos` |
| `/precios` | Planes Gratis y Pro \| ContadorGanadero | Empieza con lo esencial. Avanza a tu ritmo. | Sí / Sí | `index, follow` | `https://contadorganadero.com/precios` |
| `/preguntas-frecuentes` | Preguntas frecuentes \| ContadorGanadero | Respuestas claras para decidir con calma. | Sí / Sí | `index, follow` | `https://contadorganadero.com/preguntas-frecuentes` |
| `/contacto` | Contacto \| ContadorGanadero | Conversemos sobre lo que necesitas. | Sí / Sí | `index, follow` | `https://contadorganadero.com/contacto` |
| `/soluciones` | Soluciones para productores y contadores \| ContadorGanadero | Distintas actividades. Una forma más clara de llevar tus registros. | Sí / Sí | `index, follow` | `https://contadorganadero.com/soluciones` |
| `/ruta-no-existe` (404) | No encontramos esta página. \| ContadorGanadero | No encontramos esta página. | Sí / Sí | `noindex, follow` | `https://contadorganadero.com/ruta-no-existe` |

### 4.2. Navegación e Interactividad Accesible (`PublicNavbar` y `ProductDemo`)

| Componente / Interacción | Estado Inicial | Acción Ejecutada | Estado Final Verificado | Resultado |
| :--- | :--- | :--- | :--- | :---: |
| **Megamenú Producto** (`details.cg-product-menu`) | `open = false` | Clic en `<summary>Producto</summary>` | `open = true` (submenú desplegado) | **PASS** |
| **Cierre Megamenú con Teclado** | `open = true` | Pulsación de tecla `Escape` | `open = false` | **PASS** |
| **Botón Menú Móvil (`375px`)** (`button.cg-menu-button`) | `aria-expanded="false"` | Clic en `.cg-menu-button` | `aria-expanded="true"` (`#public-nav.cg-open`) | **PASS** |
| **Cierre Menú Móvil con `Escape`** | `aria-expanded="true"` | Pulsación de tecla `Escape` | `aria-expanded="false"` | **PASS** |
| **Indicadores `ProductDemo`** (`.cg-metric-buttons`) | `Ingresos` con `aria-pressed="true"` | Clic en botón `Gastos` | `Gastos` con `aria-pressed="true"`, `Ingresos` con `aria-pressed="false"` y actualización de `<p aria-live="polite">` | **PASS** |
| **Selector de Período `ProductDemo`** (`.cg-demo-top select`) | Valor `"3"` (Enero – Abril, 4 barras) | Selección de valor `"1"` (Enero – Febrero) | Gráfico actualiza a `2` `.cg-bar-group` y tabla actualiza a `2` filas `tbody tr` | **PASS** |
| **Tabla Accesible del Gráfico** (`details.cg-chart-table`) | `open = false` | Clic en `<summary>Consultar valores del gráfico</summary>` | `open = true` (tabla con `<caption>Datos sintéticos en colones</caption>` visible) | **PASS** |

### 4.3. Responsividad sin Desbordamiento Horizontal (`scrollWidth <= innerWidth`)

Se evaluaron las **18 rutas** en los **5 anchos de viewport obligatorios** (90 pruebas de layout en total):

| Viewport Evaluado | Rutas Probadas | `innerWidth` | `maxScrollWidth` Medido | Rutas con Desbordamiento (`scrollWidth > innerWidth`) | Resultado |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **320 × 800 px** (Mobile S) | 18 | `320 px` | `320 px` | `0` | **PASS** |
| **375 × 812 px** (Mobile M) | 18 | `375 px` | `375 px` | `0` | **PASS** |
| **768 × 1024 px** (Tablet) | 18 | `768 px` | `768 px` | `0` | **PASS** |
| **1024 × 768 px** (Laptop) | 18 | `1024 px` | `1024 px` | `0` | **PASS** |
| **1440 × 900 px** (Desktop) | 18 | `1440 px` | `1440 px` | `0` | **PASS** |

### 4.4. Cumplimiento de Google AdSense en el DOM Renderizado

Se auditó el DOM en tiempo de ejecución para confirmar la presencia de la metaetiqueta de verificación de propiedad del editor y la **ausencia total** de scripts o contenedores publicitarios en pantallas públicas, de autenticación, comerciales y editoriales mientras la política productiva permanece en modo `fail-closed` (`AD_POLICY.enabled === false`):

| Ruta Auditada | `<meta name="google-adsense-account">` | `script[src*="adsbygoogle"]` | `.adsbygoogle` | `.advertising-slot` | Resultado |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `/` (Landing) | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |
| `/login` | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |
| `/registro` | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |
| `/precios` | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |
| `/tutoriales` | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |
| `/tutoriales/conoce-contadorganadero` | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |
| `/academia` | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |
| `/academia/organizar-ingresos-gastos` | `ca-pub-1077407420035302` | `0` | `0` | `0` | **PASS** |

### 4.5. Protección de Rutas Privadas y Directiva `noindex`

| Ruta Privada Solicitada (Sin Sesión) | Ruta Final tras Guard de Autenticación | `meta[name="robots"]` en Destino | Scripts / Slots AdSense | Resultado |
| :--- | :--- | :---: | :---: | :---: |
| `/dashboard` | `/login` | `noindex, follow` | `0` / `0` | **PASS** |
| `/admin` | `/login` | `noindex, follow` | `0` / `0` | **PASS** |

### 4.6. Limpieza de Consola JavaScript
- **Errores críticos (`pageerror`):** `0` errores registrados durante la carga, hidratación, interacción y navegación de todas las rutas evaluadas.

---

## 5. Pruebas de No-Regresión Backend (Jest)

- **Comando ejecutado (desde `backend/`):**
  ```bash
  npx jest __tests__/quotaGuard.test.js __tests__/excelAndXmlParser.test.js __tests__/inventoryCostsRemediacion.test.js --runInBand
  ```
- **Resultado Global:** `Test Suites: 3 passed, 3 total` | `Tests: 25 passed, 25 total` | `Time: 16.571 s`

| Suite de Pruebas | Casos Verificados | Estado |
| :--- | :--- | :---: |
| `__tests__/quotaGuard.test.js` (14 tests) | `requiereTenantActivo` (activo, suspendido -> 402, periodo_gracia), `requiereCreditoConteo` (bajo límite, en límite -> 429, sobre límite -> 429), `requiereCreditoChat` (bajo límite, agotado -> 429), `requiereFeatureVLM` (true, false -> 403), `requiereFeatureModuloContable` (true, false -> 403), manejo sin tenant (`undefined` -> 402/429). | **PASS (14/14)** |
| `__tests__/excelAndXmlParser.test.js` (7 tests) | Preservación exacta de Clave de 50 dígitos sin notación científica (`parseTagValue: false`), Consecutivo de 20 dígitos, ceros iniciales de cédulas, detección de tipo de documento Hacienda v4.4, exportación Excel multihuela con celdas texto y CSV con formato `="VALOR"`, reporte Excel D-150 con dos hojas oficiales. | **PASS (7/7)** |
| `__tests__/inventoryCostsRemediacion.test.js` (4 tests) | `S-14`: conversión de alimento por presentación y huevos por unidad/docena a kg/cartones; `F-40`: inicialización concurrente atómica de inventario y costo por período; `F-39`: aislamiento de referencias repetidas entre períodos; `F-40`: migración con detección de duplicados y `--dry-run`. | **PASS (4/4)** |

---

## 6. Conclusión de QA

El rediseño del sitio público, el prerenderizado estático de las 28 rutas con `sitemap.xml`, los controles de accesibilidad y responsividad (`320px` a `1440px`), el bloqueo `fail-closed` de Google AdSense y la protección de rutas privadas cumplen al **100%** con los criterios de aceptación sin introducir regresiones en el frontend ni en el backend.
