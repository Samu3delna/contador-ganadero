# Terreno — implementación nativa

Dirección seleccionada por el propietario: `artifacts/mobile-redesign/terreno.html`.
Implementada en las pantallas reales de `mobile/`, con Expo Router, React Native y los contratos existentes de la API.

## Cambios

- Paleta marfil, oliva y arcilla; variante oscura y preferencia del sistema conservadas.
- Bricolage Grotesque semibold para títulos; Source Sans 3 regular/semibold para lectura y cifras. Archivos estáticos incluidos en `assets/fonts/`, con licencias OFL. Se comprobaron `₡`, acentos y eñes. No se necesita una descarga de fuentes al iniciar.
- Inicio: logo y perfil, nombre real de la finca, plan free/pro, saludo, balance sobre superficie oliva, ingresos/gastos, accesos a movimientos y facturas XML, facturas recientes, inventario, impuestos y última actualización.
- Ocultar balance también oculta sus ingresos y gastos. El estado de ocultación solo vive en memoria.
- Inventario en superficies de dos columnas, o una con texto ampliado. Los valores conservan el significado real de la API: Abejas muestra kg de miel, no un número inventado de colmenas.
- Login, MFA, formularios, listados, detalles y perfil heredan los componentes y tokens de Terreno. Se conserva el logo original y se usan los iconos Feather existentes.
- Las acciones de escritura de Inicio siguen deshabilitadas sin conexión. SecureStore, SQLCipher, aislamiento por tenant y lógica de autenticación no se modificaron.

## Movimiento

Se usa `Animated` de React Native con driver nativo para pulsación (escala 0.97, 160 ms) y confirmación de formulario (opacidad, 200 ms). Las animaciones se pueden interrumpir y no mueven las cifras mientras se leen.

El formulario de movimiento entra desde abajo mediante la navegación nativa; iOS permite fijar 250 ms y Android usa el comportamiento de su transición nativa. El movimiento reducido del sistema se consulta y se escucha durante la sesión: elimina la escala y cambia la transición del formulario a un fundido. Las animaciones permanecen desactivadas hasta resolver la preferencia inicial.

No se añadieron bibliotecas de animación ni se trasladó CSS al entorno nativo.

## Validación

- TypeScript y ESLint móviles: correctos.
- Jest Expo: **29 pruebas / 7 suites**, incluidas las 25 anteriores y cuatro nuevas para datos/navegación de Inicio, ocultación de importes, restricciones offline y preferencia de tema/movimiento reducido.
- Exportación Android/iOS: correcta, bundles Hermes y tres fuentes nuevas incluidas.
- Fuentes estáticas: generación y comprobación de glifos correctas.
- Contraste de texto: diez combinaciones de ambos temas superan 4.5:1; mínimo observado 5.52:1. Incluye texto principal/secundario, botón primario, verde sobre superficie suave y mensajes de error.
- Compilación nativa Android release arm64: **BUILD SUCCESSFUL en 2 min 58 s**, 899 tareas (39 ejecutadas, 860 actualizadas). El registro local ignorado está en `mobile/.expo/terreno-gradle.log`. Se generó el paquete local sin firma para validación, no una nueva descarga pública.

Una primera ejecución de las pruebas nuevas coincidió con la exportación y agotó el tiempo del primer caso. La repetición aislada y la suite completa posterior pasaron sin cambiar timeouts.

## Comprobaciones pendientes en dispositivo

Este entorno no tiene un teléfono Android conectado, AVD configurado ni Xcode. La exportación y compilación no prueban fidelidad visual en un teléfono. Revisar 390 × 844, texto al 200 %, teclado, TalkBack/VoiceOver, carga de fuentes, pulsaciones y transiciones antes de distribuir una nueva versión.

Los cambios están en el proyecto. La descarga pública anterior no se actualiza automáticamente con esta implementación; se requiere generar y publicar una nueva versión para distribuir Terreno.

## Archivos de entrada

- `src/theme/index.tsx`: colores, familias y preferencia de movimiento.
- `src/components/ui.tsx`: controles, campos, filas y feedback.
- `app/(tabs)/index.tsx`: Inicio conectado a la API.
- `app/(tabs)/inventario.tsx`: resumen por especie.
- `app/_layout.tsx`: fuentes, barra de estado y transición de formulario.
- `scripts/prepare-terreno-fonts.py`: regeneración de fuentes desde los archivos fuente de Google Fonts; requiere `fonttools`.

Deska no está disponible en esta tarea. La referencia visual y esta documentación permanecen como archivos locales versionables. No se creó un archivo de Figma: la solicitud posterior eligió aplicar Terreno directamente a la app y la conexión de Figma continúa pendiente.
