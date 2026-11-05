# Sistema visual público

Actualizado: 2026-11-03.

Dirección: una mesa de trabajo financiera para el campo costarricense. El dashboard es la pieza central; la tipografía amplia y las secciones con espacio permiten entender el producto antes de registrarse. La referencia https://deska.dev/es se consultó por sus principios de navegación y demostración, sin copiar código, marcas o imágenes.

## Tokens
- Fondo carbón vegetal: #101C1B.
- Superficie: #162824.
- Borde: #30443E.
- Texto: #F5F8F5.
- Texto secundario: #B0C1B9.
- Acento accesible sobre oscuro: #A7EDC0.
- Tipografía: Inter si ya está disponible, system-ui como respaldo. Sin nuevas descargas de fuentes.
- Contenedor: 1200 px; márgenes 32 px escritorio / 16 px móvil.
- Radios: controles 8 px, tarjetas 14 px, demostración y CTA 16 px.

## Arquitectura
PublicLayout contiene navegación, Outlet y footer. El CSS usa cg-* bajo cg-public y no cambia el dashboard privado. CTASection, PricingCards y FAQSection componen contenido repetido. ProductDemo reutiliza ResumenCards real con datos sintéticos; el gráfico público tiene tabla accesible y selección de período. No consulta APIs ni cuentas privadas.

## Decisiones
El hero conserva el vocabulario del productor. Se eliminan promesas no verificadas de pastoreo, offline, conteos IA y emisión oficial lista. Dos planes leídos del catálogo frontend, con precio verificado frente al backend; se evitan sus antiguas descripciones no demostradas. Sin estadísticas comerciales, testimonios ni imágenes ficticias.

## Accesibilidad y rendimiento
Navegación por teclado, botón móvil con aria-expanded, menú Producto nativo details, cierre Escape, enlace de salto, foco visible, tabla alternativa al gráfico, reducciones de movimiento, estructura semántica y layouts fluidos. No video automático, tracking ni dependencias nuevas. Las tarjetas de resumen provienen del código real; el gráfico es una representación explícita con datos de ejemplo, no una captura de una cuenta.

## Límites
No se grabaron videos ni se publicaron capturas autenticadas. Los tutoriales escritos son la alternativa honesta hasta disponer de cuenta demo y material revisado. QA visual y validación final se consolidan en QA_REPORT.md.
