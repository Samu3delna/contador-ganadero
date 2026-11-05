# Lista de Verificación y Arquitectura SEO — ContadorGanadero

Fecha de actualización: 2026-11-04  
Rama: `feature/landing-saas-adsense-seo`  
Dominio canónico: `https://contadorganadero.com`

---

## 1. Estrategia de Prerenderizado Estático Post-Build (28 páginas HTML)

Para eliminar el problema habitual de las SPA donde los rastreadores reciben un `<div id="root"></div>` vacío, **ContadorGanadero** implementa un pipeline de prerenderizado estático sin dependencias de navegador headless externo:

- **Comando de compilación (`frontend/package.json`)**:
  ```json
  "build": "vite build && node scripts/prerender.mjs"
  ```
- **Mecanismo (`frontend/scripts/prerender.mjs` + `frontend/src/entry-public.jsx`)**:
  1. `vite build` genera los assets versionados y la plantilla `dist/index.html`.
  2. `prerender.mjs` carga `/src/entry-public.jsx` mediante `server.ssrLoadModule` de Vite y renderiza cada ruta pública con `renderToPipeableStream` (`react-dom/server`) y `StaticRouter`.
  3. Descubre automáticamente los enlaces de `/academia/*` (7 guías) y `/tutoriales/*` (6 tutoriales) directamente desde el DOM renderizado de `/academia` y `/tutoriales`, sumando las **28 rutas públicas**.
  4. Verifica de forma estricta que toda página prerenderizada tenga un `<h1>` no vacío (`if (!heading) throw new Error(...)`).
  5. Persiste los 28 archivos HTML estáticos en `dist/` (`dist/index.html`, `dist/producto.html`, `dist/producto/dashboard.html`, `dist/academia/*.html`, `dist/tutoriales/*.html`, etc.).

---

## 2. Metadatos Únicos en HTML Prerenderizado y Navegación SPA (`SEOHead.jsx`)

El sistema mantiene paridad entre el HTML estático entregado en la primera carga (`prerender.mjs`) y las transiciones posteriores del usuario en el cliente ([`frontend/src/components/public/SEOHead.jsx`](../../frontend/src/components/public/SEOHead.jsx)):

| Metadato / Etiqueta | En HTML Prerenderizado (`prerender.mjs`) | En Navegación SPA (`SEOHead.jsx`) |
|---|---|---|
| `<title>` | `${pageTitle} \| ContadorGanadero` (mapa `titles[route]` o texto del `<h1>`) | Actualizado dinámicamente al cambiar `pathname` o cuando `MutationObserver` detecta la carga de una ruta `lazy()` |
| `<meta name="description">` | Primer párrafo de `<main p>` truncado a 170 caracteres (o `<h1>` como respaldo) | Primer párrafo de `<main p>` truncado a 170 caracteres (o descripción general de respaldo) |
| `<meta name="robots">` | `index, follow` en las 28 rutas públicas | `index, follow` solo si la ruta pertenece al catálogo público y el `<h1>` no es 404; `noindex, follow` en `/login`, `/registro`, `/dashboard`, `/admin/*` y páginas 404 |
| `<link rel="canonical">` | `https://contadorganadero.com${route}` | `https://contadorganadero.com${pathname}` |
| **Open Graph** | `og:title`, `og:description`, `og:url`, `og:type` (`article` para `/academia/*`, `website` para el resto) | Actualizado en caliente con los mismos valores canónicos |
| **Twitter Cards** | `twitter:card="summary"`, `twitter:title`, `twitter:description` | Actualizado en caliente en `<head>` |
| **Datos Estructurados (JSON-LD)** | `<script type="application/ld+json">` con esquema `https://schema.org` `@type: "WebPage"` (`name`, `url`, `description`) sanitizando `<` como `\u003c` | Conservado en el documento inicial prerenderizado |

---

## 3. Configuración de `robots.txt` y `sitemap.xml`

### 3.1 `frontend/public/robots.txt`

```txt
User-agent: *
Allow: /

# Authentication and noindex govern private routes; robots is not access control.
Sitemap: https://contadorganadero.com/sitemap.xml
```

**Principios de seguridad y rastreo aplicados:**
- **No se utiliza `Disallow` como falso control de acceso**: bloquear rutas en `robots.txt` no protege datos y, además, impide que los motores de búsqueda lean la directiva `meta[name="robots" content="noindex, follow"]` cuando una URL privada es descubierta.
- **Protección real por capas**:
  1. Todas las rutas privadas (`/dashboard`, `/facturas`, `/gastos`, `/ingresos`, `/impuestos`, `/declaraciones`, `/inventario`, `/costos`, `/facturacion`, `/hacienda`, `/d150`, `/calendario`, `/planes`, `/billing`, `/perfil`, `/admin/*`) están envueltas en `RutaProtegida` / `RutaAdmin` y los endpoints del backend exigen JWT válido + `tenantGuard.js`.
  2. `SEOHead.jsx` aplica `meta[name="robots" content="noindex, follow"]` en toda ruta fuera de las 28 páginas públicas editoriales/comerciales.

### 3.2 `frontend/public/sitemap.xml`

Generado automáticamente por `frontend/scripts/prerender.mjs` tanto en `frontend/public/sitemap.xml` como en `frontend/dist/sitemap.xml`:
- Contiene exactamente las **28 URLs públicas sustanciales** con protocolo `https://contadorganadero.com`.
- **Excluye explícitamente**:
  - Rutas sin valor editorial propio o de acceso (`/login`, `/registro`, `/recuperar-password`, `/restablecer-password`, `/verificar-email`).
  - Rutas privadas del panel autenticado (`/dashboard`, `/admin/*`, etc.).

---

## 4. Optimización de Rendimiento y Core Web Vitals

| Métrica / Área | Medida técnica implementada en el repositorio | Impacto |
|---|---|---|
| **LCP (Largest Contentful Paint)** | HTML prerenderizado en `dist/*.html` con el texto hero (`<h1>` y `.cg-lead`) y `ProductDemo` ya presentes desde el primer byte, sin esperar hidratación ni peticiones a la API de Render. | Renderizado inmediato del contenido principal en el edge de Cloudflare. |
| **Cero fuentes externas bloqueantes** | Tipografía basada en pila del sistema (`font-family: Inter, system-ui, sans-serif` en `LandingPage.css`), eliminando cadenas de bloqueo a Google Fonts. | 0 ms de bloqueo por descarga de fuentes externas y 0 FOIT/FOUT. |
| **CLS (Cumulative Layout Shift)** | Dimensiones fijas en navegación (`.cg-nav { min-height: 84px }`), contenedores de barras (`.cg-bars { height: 170px }`), tarjetas `.cg-feature { min-height: 300px }` y uso de `font-variant-numeric: tabular-nums` en tablas de datos. | Estabilidad visual durante la carga y al cambiar el filtro de meses en `ProductDemo`. |
| **INP (Interaction to Next Paint)** | Componentes públicos ligeros sin librerías pesadas de gráficos en la portada (el gráfico de barras de `ProductDemo.jsx` es CSS puro + tabla HTML nativa `<details>`), `touch-action: manipulation` en botones y menús desplegables nativos `<details>`. | Respuesta instantánea en dispositivos móviles y conexiones rurales. |
| **Multimedia sin sobrecarga (`VideoPlayer`)** | El componente `VideoPlayer` en `LearningPages.jsx` define `preload="none"` y retorna `null` mientras `video === null`, evitando descargas innecesarias de bytes de video. | 0 KB de transferencia multimedia hasta que un video real exista y el usuario pulse reproducir. |
| **Code-Splitting (`React.lazy`)** | Separación de bundles entre rutas públicas (`PublicLayout`, `LandingPage`, `ProductPages`, `CommercialPages`, `LearningPages`) y módulos privados (`DashboardPage`, `FacturasPage`, `Admin*`, etc.). | El visitante público no descarga el código de los módulos privados ni de administración. |

---

## 5. Checklist de Verificación Automatizada y Manual

- [x] `npm run build` en `frontend/` compila con Vite 8 y ejecuta `scripts/prerender.mjs` generando las **28 páginas públicas**.
- [x] Cada uno de los 28 archivos HTML en `dist/` contiene contenido real dentro de `<div id="root">`, un único `<h1>`, `<title>` específico, `<meta name="description">`, `<meta name="robots" content="index, follow">`, `<link rel="canonical">` y `<script type="application/ld+json">`.
- [x] `SEOHead.jsx` marca `noindex, follow` en `/login`, `/registro`, rutas privadas y vistas 404.
- [x] `frontend/public/robots.txt` permite el rastreo y enlaza a `https://contadorganadero.com/sitemap.xml`.
- [x] `frontend/public/sitemap.xml` lista únicamente las 28 URLs públicas canónicas.
- [x] Ninguna página pública promete funciones inexistentes (sin pastoreo rotacional, sin conteo visual de animales con IA, sin modo offline y sin planes fuera de `Gratis` y `Pro`).
