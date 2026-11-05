# Plan de Producción Audiovisual y Especificación de Video — ContadorGanadero

Fecha de actualización: 2026-11-04  
Rama: `feature/landing-saas-adsense-seo`

---

## 1. Estado Real de los Tutoriales y Política de Veracidad

En cumplimiento estricto con la matriz de veracidad ([`docs/landing-redesign/AUDITORIA_FUNCIONAL.md`](./AUDITORIA_FUNCIONAL.md)):

- **Estado actual en producción**: Las **6 guías escritas paso a paso están completas, verificadas y publicadas** en `/tutoriales` y `/tutoriales/:slug` (alimentadas desde [`frontend/src/data/learningContent.js`](../../frontend/src/data/learningContent.js)).
- **Estado de los archivos multimedia**: Los archivos de video (`.mp4`), imágenes de portada (`.webp` / `.jpg`) y subtítulos (`.vtt`) se encuentran **pendientes de grabación con una cuenta de demostración autorizada y datos 100% sintéticos**.
- **Comportamiento honesto en la interfaz**:
  - En `learningContent.js`, cada tutorial exporta `video: null` y `status: 'Guía escrita disponible · video pendiente de grabación'`.
  - La página `/tutoriales` y cada detalle `/tutoriales/:slug` informan explícitamente: *"El video está pendiente de grabación. Podés seguir estas instrucciones por escrito. Los ejemplos son sintéticos."*
  - El componente `VideoPlayer` permanece oculto automáticamente mientras `video === null`, evitando mostrar reproductores vacíos, miniaturas falsas o enlaces rotos.

---

## 2. Catálogo y Metadatos de los 6 Tutoriales Iniciales

| # | Slug (`/tutoriales/:slug`) | Título | Categoría | Duración objetivo | Módulo vinculado (`/producto/:product`) | Guía de Academia relacionada (`/academia/:slug`) | Estado actual |
|---|---|---|---|---|---|---|---|
| 1 | `conoce-contadorganadero` | Conoce ContadorGanadero | Primeros pasos | 60–90 segundos | `/producto/dashboard` | — (Recorrido general) | Guía escrita publicada · Video pendiente |
| 2 | `dashboard` | Cómo utilizar el dashboard | Dashboard | 2–4 minutos | `/producto/dashboard` | `rentabilidad-agropecuaria` | Guía escrita publicada · Video pendiente |
| 3 | `registrar-ingresos` | Cómo registrar ingresos por venta de ganado | Ingresos | 2–4 minutos | `/producto/ingresos` | `organizar-ingresos-gastos`, `registrar-ventas-agropecuarias` | Guía escrita publicada · Video pendiente |
| 4 | `facturas-xml` | Cómo gestionar facturas XML | Facturas XML | 3–5 minutos | `/producto/facturas` | `interpretar-facturas-xml`, `preparar-informacion-rea` | Guía escrita publicada · Video pendiente |
| 5 | `inventario` | Cómo utilizar el inventario | Inventario | 3–5 minutos | `/producto/inventario` | `inventario-ganado` | Guía escrita publicada · Video pendiente |
| 6 | `costos-produccion` | Cómo interpretar los costos de producción | Costos | 2–4 minutos | `/producto/costos` | `costos-produccion-ganadera` | Guía escrita publicada · Video pendiente |

---

## 3. Especificación Técnica del Componente `VideoPlayer` (`LearningPages.jsx`)

El componente `VideoPlayer` está implementado en [`frontend/src/pages/public/LearningPages.jsx`](../../frontend/src/pages/public/LearningPages.jsx):

```jsx
export function VideoPlayer({ video, title }) {
  if (!video?.src || !video?.captions) return null;
  return <video controls preload="none" poster={video.poster} aria-label={title} style={{ width: '100%', borderRadius: 16 }}>
    <source src={video.src} type="video/mp4" />
    <track kind="captions" src={video.captions} srcLang="es" label="Español" default />
    Tu navegador no reproduce este video. <a href={video.src}>Descargar video</a>
  </video>;
}
```

### Requisitos técnicos y de accesibilidad que cumple `VideoPlayer`:

1. **Guardia de integridad (`if (!video?.src || !video?.captions) return null`)**:
   - No se puede activar ningún video en producción si no cuenta **simultáneamente** con el archivo de video (`video.src`) y su archivo de subtítulos en español (`video.captions`).
2. **Sin reproducción automática (`controls`, sin `autoplay`)**:
   - El usuario tiene control total de la reproducción, respetando pautas de accesibilidad WCAG y políticas de experiencia de usuario.
3. **Ahorro de ancho de banda (`preload="none"`)**:
   - No descarga metadatos ni segmentos de video durante la carga de `/tutoriales/:slug`, protegiendo el LCP y el consumo de datos móviles en zonas rurales.
4. **Subtítulos obligatorios (`<track kind="captions" srcLang="es" label="Español" default />`)**:
   - Garantiza accesibilidad auditiva y permite seguir el tutorial sin sonido.
5. **Fallback de descarga directa**:
   - Incluye enlace `<a href={video.src}>Descargar video</a>` para navegadores sin soporte embebido.

---

## 4. Estructura de Archivos y Contrato de Activación Futura

Cuando se complete la grabación de cada video siguiendo los guiones de [`docs/landing-redesign/GUIA_TUTORIALES.md`](./GUIA_TUTORIALES.md), los recursos deberán ubicarse en `frontend/public/videos/` (o en un bucket CDN del dominio propio) con la siguiente convención de nombres:

| Slug | Archivo de video (`src`) | Subtítulos WebVTT (`captions`) | Imagen de portada (`poster`) |
|---|---|---|---|
| `conoce-contadorganadero` | `/videos/conoce-contadorganadero.mp4` | `/videos/conoce-contadorganadero.es.vtt` | `/videos/posters/conoce-contadorganadero.webp` |
| `dashboard` | `/videos/dashboard.mp4` | `/videos/dashboard.es.vtt` | `/videos/posters/dashboard.webp` |
| `registrar-ingresos` | `/videos/registrar-ingresos.mp4` | `/videos/registrar-ingresos.es.vtt` | `/videos/posters/registrar-ingresos.webp` |
| `facturas-xml` | `/videos/facturas-xml.mp4` | `/videos/facturas-xml.es.vtt` | `/videos/posters/facturas-xml.webp` |
| `inventario` | `/videos/inventario.mp4` | `/videos/inventario.es.vtt` | `/videos/posters/inventario.webp` |
| `costos-produccion` | `/videos/costos-produccion.mp4` | `/videos/costos-produccion.es.vtt` | `/videos/posters/costos-produccion.webp` |

### Parámetros de codificación recomendados

- **Contenedor y códec de video**: MP4 (`H.264 / AVC1`, perfil `High@L4.1`, `yuv420p`, `movflags +faststart`).
- **Resolución y framerate**: `1920x1080` (16:9) a `30 fps`, interfaz con zoom al 110%–125% para legibilidad en pantallas móviles.
- **Audio**: AAC-LC, `48 kHz`, estéreo o mono normalizado a `-16 LUFS` (voz clara, sin música de fondo que compita con la locución).
- **Subtítulos**: Formato `WebVTT` (`.vtt`) codificado en UTF-8, máximo 2 líneas por bloque y 42 caracteres por línea.

### Procedimiento para habilitar un video grabado

1. Verificar que el video grabado cumple la lista de control de privacidad y veracidad de `GUIA_TUTORIALES.md` (cero datos reales de clientes, cero cédulas reales, cero promesas fuera de `AUDITORIA_FUNCIONAL.md`).
2. Colocar los archivos `.mp4`, `.es.vtt` y `.webp` en `frontend/public/videos/`.
3. Actualizar en `frontend/src/data/learningContent.js` únicamente el objeto del tutorial correspondiente:
   ```js
   video: {
     src: '/videos/dashboard.mp4',
     captions: '/videos/dashboard.es.vtt',
     poster: '/videos/posters/dashboard.webp',
   }
   ```
4. Ejecutar `npm test` y `npm run build` en `frontend/` para regenerar las páginas prerenderizadas.
