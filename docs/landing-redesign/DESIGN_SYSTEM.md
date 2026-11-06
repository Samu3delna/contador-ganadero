# Sistema visual público e identidad de marca

Actualizado: 2026-11-05.

Dirección: una mesa de trabajo financiera para el campo costarricense. El dashboard es la pieza central; la tipografía amplia y las secciones con espacio permiten entender el producto antes de registrarse. La referencia https://deska.dev/es se consultó por sus principios de navegación y demostración, sin copiar código, marcas o imágenes.

## Identidad oficial (Logo de ContadorGanadero)
- **Isotipo oficial (`/logo.svg`, `/favicon.svg`, `/logo.png`)**: Escudo conformado por la silueta de un toro en azul marino profundo (`#0b2a55`) y un gráfico de barras ascendente con flecha diagonal en verde esmeralda (`#159f63`).
- **Componente `<BrandLogo />` (`frontend/src/components/public/BrandLogo.jsx`)**: Presenta el isotipo vectorial oficial dentro de una insignia luminosa (`#f5f8f5` con borde `#a7edc066` y sombra suave) para preservar el contraste original del toro `#0b2a55` y las barras `#159f63` sobre el fondo oscuro `#101C1B`.
- **Presencia de marca**:
  - `PublicNavbar`: `<BrandLogo size={36} />` junto a `ContadorGanadero CR`.
  - `LandingPage` (Hero): Insignia destacada `.cg-hero-brand` con `<BrandLogo size={58} />`, `ContadorGanadero · contadorganadero.com` y descriptor de *Contador ganadero y contabilidad ganadera en Costa Rica (REA)*.
  - `PublicFooter`: `<BrandLogo size={34} />` junto a `ContadorGanadero`.
  - `LoginHeader` y `LegalLayout`: Integración del isotipo `/logo.svg` en sustitución de iconos genéricos.
  - `og-image.png` (1200×630): Tarjeta Open Graph y Twitter Card generada con el isotipo oficial y la identidad `contadorganadero.com`.

## Tokens
- Fondo carbón vegetal: `#101C1B`.
- Superficie: `#162824`.
- Borde: `#30443E`.
- Texto: `#F5F8F5`.
- Texto secundario: `#B0C1B9`.
- Acento accesible sobre oscuro: `#A7EDC0`.
- Tipografía: Inter si ya está disponible, `system-ui` como respaldo. Sin nuevas descargas de fuentes bloqueantes.
- Contenedor: `1200 px`; márgenes `32 px` escritorio / `16 px` móvil.
- Radios: controles `8 px`, insignias de logo `10 px`, tarjetas `14 px`, demostración y CTA `16 px`.

## Arquitectura
`PublicLayout` contiene navegación, `Outlet` y footer. El CSS usa `cg-*` bajo `.cg-public` y no altera el dashboard privado. `CTASection`, `PricingCards` y `FAQSection` componen contenido compartido. `ProductDemo` reutiliza `ResumenCards` real con datos sintéticos; el gráfico público incluye tabla accesible y selección de período sin consultar APIs ni cuentas privadas.

## Accesibilidad y rendimiento
Navegación por teclado, botón móvil con `aria-expanded`, menú Producto nativo `<details>`, cierre `Escape`, enlace de salto `.cg-skip`, foco visible, tabla alternativa al gráfico, reducciones de movimiento, estructura semántica y layouts fluidos desde `320 px` hasta `1440 px`.
