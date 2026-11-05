# Arquitectura de la Aplicación Pública — ContadorGanadero

Fecha de actualización: 2026-11-04  
Rama: `feature/landing-saas-adsense-seo`

---

## 1. Visión general y separación entre aplicación pública y aplicación privada

El frontend de **ContadorGanadero** (`frontend/`, React 19 + Vite 8 + React Router 7) está estructurado en dos fronteras de ejecución claramente aisladas dentro del mismo árbol de rutas de [`frontend/src/App.jsx`](../../frontend/src/App.jsx):

```
App.jsx (BrowserRouter + AuthProvider + SEOHead)
├── 1. Dominio Público Editorial y Comercial (publicRoutes.jsx -> PublicLayout)
│   ├── Renderizable tanto en servidor/build (entry-public.jsx + prerender.mjs) como en SPA
│   ├── Sin llamadas obligatorias a endpoints autenticados (/api/*)
│   └── Aislamiento visual completo bajo el contenedor .cg-public (LandingPage.css)
│
├── 2. Rutas Públicas de Autenticación y Legales
│   ├── /login, /registro, /recuperar-password, /restablecer-password, /verificar-email
│   └── /terminos, /condiciones-servicio, /privacidad, /eliminacion-datos (y sus alias)
│
└── 3. Dominio Privado Autenticado (RutaProtegida -> AppLayout)
    ├── Requiere sesión activa en AuthContext (redirige a /login si usuario === null)
    ├── Layout de aplicación (Sidebar + main-content + ChatBot)
    └── Subdominio Super Admin protegido por RutaAdmin (/admin/*)
```

### Tabla comparativa de dominios

| Dimensión | Aplicación Pública (`publicRoutes.jsx`) | Aplicación Privada (`AppLayout` en `App.jsx`) |
|---|---|---|
| **Layout contenedor** | `PublicLayout.jsx` (`<div className="cg-public">`) | `AppLayout` (`<div className="app-container">` con `Sidebar` y `ChatBot`) |
| **Guardia de acceso** | Libre (acceso anónimo e indexable) | `RutaProtegida` (verifica `useAuth()`) y `RutaAdmin` para `/admin/*` |
| **Punto de entrada SSR/Prerender** | `frontend/src/entry-public.jsx` (`StaticRouter` + `renderToPipeableStream`) | No se prerenderiza; requiere sesión JWT + cookie `httpOnly` en tiempo de ejecución |
| **Origen de datos** | Datos estáticos auditados (`learningContent.js`, `planes.js`) y datos sintéticos (`ProductDemo.jsx`) | API REST en Render (`VITE_API_URL` / `/api/*`) aislada por `tenantId` |
| **Directiva `meta[name="robots"]`** | `index, follow` (o `noindex, follow` si es ruta 404) | `noindex, follow` gestionado dinámicamente por `SEOHead.jsx` |

---

## 2. Flujo de prerenderizado estático (`entry-public.jsx` y `prerender.mjs`)

Para garantizar que motores de búsqueda, bots de validación publicitaria y redes sociales reciban HTML semántico completo sin depender de la ejecución de JavaScript en el cliente, el build de producción ejecuta dos etapas encadenadas definidas en [`frontend/package.json`](../../frontend/package.json):

```bash
npm run build   # Ejecuta: vite build && node scripts/prerender.mjs
```

1. **Compilación de bundles (`vite build`)**: Vite 8 genera el bundle de cliente y el `dist/index.html` base.
2. **Renderizado estático post-build (`frontend/scripts/prerender.mjs`)**:
   - Inicia un servidor Vite en `middlewareMode: true` (`appType: 'custom'`) y carga [`/src/entry-public.jsx`](../../frontend/src/entry-public.jsx) mediante `server.ssrLoadModule`.
   - `entry-public.jsx` utiliza `renderToPipeableStream` de `react-dom/server` junto con `StaticRouter` y `publicRoutes()` para resolver todos los componentes `lazy()` dentro de `<Suspense>`.
   - **Descubrimiento automático desde una única fuente de verdad**: además de las 15 rutas estáticas base, `prerender.mjs` renderiza `/academia` y `/tutoriales`, inspecciona con `JSDOM` los enlaces `<a href="...">` hacia `/academia/:slug` (7 artículos) y `/tutoriales/:slug` (6 tutoriales) y completa las **28 rutas públicas**.
   - Por cada ruta, inyecta el HTML dentro de `#root`, valida que exista un `<h1>` único, escribe `<title>`, `<meta name="description">`, `<meta name="robots" content="index, follow">`, etiquetas Open Graph, Twitter Cards, `<link rel="canonical">` y el bloque JSON-LD `WebPage`.
   - Escribe cada archivo en `dist/<ruta>.html` (por ejemplo, `dist/producto/dashboard.html`, `dist/academia/organizar-ingresos-gastos.html`) y sincroniza tanto `public/sitemap.xml` como `dist/sitemap.xml`.

---

## 3. Mapa completo de las 28 rutas públicas prerenderizadas y página 404

Todas las rutas listadas a continuación están definidas en [`frontend/src/publicRoutes.jsx`](../../frontend/src/publicRoutes.jsx), generan su respectivo archivo HTML estático en `dist/` y están incluidas en [`frontend/public/sitemap.xml`](../../frontend/public/sitemap.xml):

### 3.1 Portada y páginas comerciales (6 rutas)

| # | Ruta URL | Archivo HTML en `dist/` | Componente | Propósito principal |
|---|---|---|---|---|
| 1 | `/` | `dist/index.html` | `LandingPage.jsx` | Propuesta de valor, `ProductDemo` interactivo, módulos clave, flujo en 3 pasos, casos de uso, enlaces a Academia/Tutoriales, precios y FAQ |
| 2 | `/producto` | `dist/producto.html` | `ProductPages.jsx` | Vista general del producto y catálogo de los 7 módulos verificados |
| 3 | `/soluciones` | `dist/soluciones.html` | `CommercialPages.jsx` | Casos de uso por perfil: Ganadería, Aves/peces/abejas y Revisión contable |
| 4 | `/precios` | `dist/precios.html` | `CommercialPages.jsx` | Comparativa transparente de los únicos 2 planes reales (`Gratis` USD $0 y `Pro` USD $10/mes) y aclaraciones de alcance |
| 5 | `/preguntas-frecuentes` | `dist/preguntas-frecuentes.html` | `CommercialPages.jsx` | Preguntas frecuentes sobre experiencia contable, demo sintética, especies, alcance fiscal, planes y videos |
| 6 | `/contacto` | `dist/contacto.html` | `CommercialPages.jsx` | Canal de soporte (`soporte@contadorganadero.com`), advertencia de seguridad y enlaces a privacidad y eliminación de datos |

### 3.2 Páginas de detalle de producto (`/producto/:feature` — 7 rutas)

| # | Ruta URL | Archivo HTML en `dist/` | Componente | Módulo real representado |
|---|---|---|---|---|
| 7 | `/producto/dashboard` | `dist/producto/dashboard.html` | `ProductPages.jsx` | Dashboard financiero (incluye `ProductDemo` interactivo con `ResumenCards.jsx`) |
| 8 | `/producto/facturas` | `dist/producto/facturas.html` | `ProductPages.jsx` | Lectura y organización de Facturas XML Hacienda v4.4 |
| 9 | `/producto/ingresos` | `dist/producto/ingresos.html` | `ProductPages.jsx` | Registro de ingresos orientado a ventas de ganado |
| 10 | `/producto/gastos` | `dist/producto/gastos.html` | `ProductPages.jsx` | Clasificación y análisis de gastos de la finca |
| 11 | `/producto/inventario` | `dist/producto/inventario.html` | `ProductPages.jsx` | Inventario multiespecie (Bovinos, Aves, Peces y Colmenas) |
| 12 | `/producto/costos` | `dist/producto/costos.html` | `ProductPages.jsx` | Costos de producción e indicadores por centro de costo |
| 13 | `/producto/impuestos` | `dist/producto/impuestos.html` | `ProductPages.jsx` | Organización e información para estimaciones tributarias REA |

### 3.3 Centro de Tutoriales (`/tutoriales` y `/tutoriales/:slug` — 7 rutas)

| # | Ruta URL | Archivo HTML en `dist/` | Componente | Contenido |
|---|---|---|---|---|
| 14 | `/tutoriales` | `dist/tutoriales.html` | `LearningPages.jsx` | Índice de tutoriales paso a paso sobre las pantallas reales |
| 15 | `/tutoriales/conoce-contadorganadero` | `dist/tutoriales/conoce-contadorganadero.html` | `LearningPages.jsx` | Recorrido general de primeros pasos (60–90 s) |
| 16 | `/tutoriales/dashboard` | `dist/tutoriales/dashboard.html` | `LearningPages.jsx` | Cómo utilizar y leer el dashboard financiero |
| 17 | `/tutoriales/registrar-ingresos` | `dist/tutoriales/registrar-ingresos.html` | `LearningPages.jsx` | Cómo registrar ingresos por venta de ganado |
| 18 | `/tutoriales/facturas-xml` | `dist/tutoriales/facturas-xml.html` | `LearningPages.jsx` | Cómo gestionar y revisar facturas XML |
| 19 | `/tutoriales/inventario` | `dist/tutoriales/inventario.html` | `LearningPages.jsx` | Cómo utilizar el inventario multiespecie |
| 20 | `/tutoriales/costos-produccion` | `dist/tutoriales/costos-produccion.html` | `LearningPages.jsx` | Cómo interpretar los costos de producción |

### 3.4 Academia Agropecuaria (`/academia` y `/academia/:slug` — 8 rutas)

| # | Ruta URL | Archivo HTML en `dist/` | Componente | Categoría y lectura |
|---|---|---|---|---|
| 21 | `/academia` | `dist/academia.html` | `LearningPages.jsx` | Biblioteca editorial de guías prácticas agropecuarias |
| 22 | `/academia/organizar-ingresos-gastos` | `dist/academia/organizar-ingresos-gastos.html` | `LearningPages.jsx` | Administración (6 min) |
| 23 | `/academia/interpretar-facturas-xml` | `dist/academia/interpretar-facturas-xml.html` | `LearningPages.jsx` | Comprobantes (5 min) |
| 24 | `/academia/costos-produccion-ganadera` | `dist/academia/costos-produccion-ganadera.html` | `LearningPages.jsx` | Costos (6 min) |
| 25 | `/academia/rentabilidad-agropecuaria` | `dist/academia/rentabilidad-agropecuaria.html` | `LearningPages.jsx` | Administración (5 min) |
| 26 | `/academia/inventario-ganado` | `dist/academia/inventario-ganado.html` | `LearningPages.jsx` | Inventario (5 min) |
| 27 | `/academia/preparar-informacion-rea` | `dist/academia/preparar-informacion-rea.html` | `LearningPages.jsx` | Organización fiscal (6 min, con fuentes oficiales de Hacienda CR) |
| 28 | `/academia/registrar-ventas-agropecuarias` | `dist/academia/registrar-ventas-agropecuarias.html` | `LearningPages.jsx` | Ingresos (5 min) |

### 3.5 Manejo de rutas inexistentes (Página 404)

- **Catch-all general (`*` en `publicRoutes.jsx`)**: renderiza el estado 404 de [`CommercialPages.jsx`](../../frontend/src/pages/public/CommercialPages.jsx) con `<h1>No encontramos esta página.</h1>` y enlaces de retorno a `/` y `/producto`.
- **Subrutas inválidas en catálogos**:
  - `/producto/:feature` inexistente muestra `<h1>Esta herramienta no existe.</h1>` con retorno a `/producto`.
  - `/tutoriales/:slug` o `/academia/:slug` inexistente muestra `<h1>Esta guía no existe</h1>` con retorno a la biblioteca correspondiente.
- En todos los casos de 404 o recurso inexistente, `SEOHead.jsx` detecta el encabezado (`/no encontrad|no existe|404/i`) y fija `meta[name="robots"]` en `noindex, follow`.

---

## 4. Componentes públicos reutilizables y aislamiento de estilos (`.cg-public`)

### 4.1 Catálogo de componentes públicos

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| `PublicLayout` | `frontend/src/components/public/PublicLayout.jsx` | Estructura semántica común (`<div className="cg-public">`, `<PublicNavbar />`, `<main id="contenido-publico"><Outlet /></main>`, `<PublicFooter />`). Reinicia el estado del menú al cambiar `pathname`. |
| `PublicNavbar` | `frontend/src/components/public/PublicLayout.jsx` | Barra de navegación accesible con enlace `Saltar al contenido` (`.cg-skip`), megamenú nativo `<details className="cg-product-menu">` para los 7 módulos de producto, cierre con tecla `Escape`, menú móvil con `aria-expanded` y `aria-controls="public-nav"`, y CTAs hacia `/login` y `/registro`. |
| `PublicFooter` | `frontend/src/components/public/PublicLayout.jsx` | Pie de página con navegación secundaria estructurada en 4 columnas (`ContadorGanadero`, `Explorar`, `Hablemos`, `Información legal`). |
| `ProductDemo` | `frontend/src/components/public/ProductDemo.jsx` | Demostración interactiva del dashboard que reutiliza el componente real [`ResumenCards.jsx`](../../frontend/src/components/dashboard/ResumenCards.jsx) alimentado exclusivamente con datos sintéticos en colones (`CRC`) para Enero–Abril, selector de período, gráfico de barras accesible con tabla desplegable `<details className="cg-chart-table">` y panel explicativo con `aria-live="polite"`. |
| `PublicBlocks` (`CTASection`, `FAQSection`, `PricingCards`) | `frontend/src/components/public/PublicBlocks.jsx` | Bloques comerciales compartidos. `PricingCards` consume directamente `PLANES` desde [`frontend/src/data/planes.js`](../../frontend/src/data/planes.js) para garantizar paridad exacta con `backend/config/planes.js` (`free` y `pro`). |
| `SEOHead` | `frontend/src/components/public/SEOHead.jsx` | Gestor reactivo de metadatos en cliente (`document.title`, `description`, `robots`, `canonical`, Open Graph y Twitter Cards) sincronizado con `MutationObserver` sobre `#root` para soportar rutas `lazy()`. |
| `VideoPlayer` | `frontend/src/pages/public/LearningPages.jsx` | Reproductor HTML5 accesible (`controls`, `preload="none"`, `poster`, `<track kind="captions" srcLang="es">`). Si `video` es `null` o carece de `src` y `captions`, retorna `null` para no renderizar contenedores rotos ni prometer videos inexistentes. |

### 4.2 Aislamiento de estilos bajo `.cg-public`

En el proyecto coexisten Tailwind CSS 3, componentes de la aplicación privada (`App.css`, `DashboardPage.css`, etc.) y la hoja de estilos pública [`frontend/src/pages/LandingPage.css`](../../frontend/src/pages/LandingPage.css). Para evitar colisiones de especificidad:

- **Namespacing estricto**: Todas las reglas visuales y variables CSS del sitio público (`--cg-bg`, `--cg-panel`, `--cg-line`, `--cg-muted`, `--cg-green`, `--cg-text`) están encapsuladas bajo `.cg-public` y prefijos `.cg-*`.
- **Integración limpia con `ResumenCards.jsx`**: Dentro de `.cg-demo`, las tarjetas reales del dashboard que utilizan clases utilitarias (`.grid`, `.text-2xl`) se adaptan mediante reglas contextuales (`.cg-demo .grid`) sin alterar el dashboard autenticado.
- **Accesibilidad y movimiento reducido**: Incluye `:focus-visible` de alto contraste (`outline: 3px solid #a7edc0`) y soporte completo para `@media (prefers-reduced-motion: reduce)`.

---

## 5. Compatibilidad con Cloudflare (Frontend) y Render (Backend API)

1. **Cloudflare Workers Static Assets / Pages (`frontend/dist`)**:
   - El directorio `dist/` contiene tanto los 28 archivos HTML prerenderizados para entrega estática inmediata en el edge de Cloudflare como el fallback SPA (`not_found_handling = "single-page-application"`) para rutas dinámicas de cliente (`/login`, `/dashboard`, etc.).
   - Las páginas públicas no bloquean su renderizado esperando respuestas de Render (`https://contador-ganadero.onrender.com`), garantizando un TTFB y LCP óptimos incluso cuando el backend esté en arranque en frío.
2. **Preservación de CORS, Cookies y Variables de Entorno**:
   - La arquitectura pública no modifica [`frontend/src/services/api.js`](../../frontend/src/services/api.js) (`withCredentials: true`, `VITE_API_URL`) ni el flujo de `AuthContext.jsx`.
   - Cuando el visitante pasa de una página pública (`/`, `/precios`, `/producto`) a `/login` o `/registro`, la SPA mantiene intacta la comunicación cross-origin con la API en Render.
