# ContadorGanadero Android 0.1.1 — Terreno

Nueva versión del MVP móvil con el diseño Terreno: Bricolage Grotesque y Source Sans 3, paleta marfil/oliva, modo oscuro, Inicio con balance y actividad reales, inventario adaptable y logo vectorial.

## Descargar

[Descargar APK 0.1.1](https://github.com/Samu3delna/contador-ganadero/releases/download/mobile-v0.1.1/contador-ganadero-0.1.1-android-arm64.apk)

[Checksum SHA-256](https://github.com/Samu3delna/contador-ganadero/releases/download/mobile-v0.1.1/contador-ganadero-0.1.1-android-arm64.apk.sha256)

- Requiere Android 7 o posterior y procesador ARM de 64 bits.
- APK release autónomo: no requiere Expo Go ni Metro.
- Identificador `com.contadorganadero.mobile`; versión `0.1.1`, versionCode `2`.
- Usa la misma identidad de firma de la distribución 0.1.0. Conserva esta identidad para futuras actualizaciones.
- Android puede solicitar permiso para instalar desde el navegador al abrir el APK.
- El APK de desarrollo usa otra firma; si tienes esa instalación, debes desinstalarla antes. La desinstalación borra los datos locales de esa app.

## Cambios visibles

- Nuevo Inicio, acceso al perfil, balance con opción para ocultar importes y accesos a movimientos y facturas XML.
- Inventario en superficies adaptables, pestañas y controles con la identidad Terreno.
- Pulsaciones y mensajes de resultado animados; respeto por la preferencia de movimiento reducido.
- Fuentes locales y soporte de caracteres de Costa Rica.
- Conexión con la API existente, login/MFA y lectura offline cifrada conservados. Las escrituras requieren conexión.

## Validación y límites

APK verificado: SHA-256 `b0d120c6161e18835ced058e290dc0eb77cecf320755d9432406d7158416fab6`. Firma APK v2/v3 y alineación de 16 KB correctas. Certificado SHA-256 `2ee0eea4b062e9c458e87908749512c35625d27453509a94d50af4ef33bfd04f`, igual al de la versión 0.1.0. El manifiesto confirma versionCode 2, Android API 24+ y arm64-v8a, sin modo debuggable. El paquete incluye el bundle y las tres fuentes Terreno.

La implementación pasó TypeScript, ESLint, 29 pruebas móviles y exportación Android/iOS. La landing pasó ESLint, pruebas y build de producción. El paquete se verifica con `apksigner`, `zipalign` y comprobación del manifiesto antes de publicarse.

La release continúa marcada como distribución inicial: la revisión visual, los gestos, accesibilidad y seguridad nativa en teléfonos físicos siguen pendientes. El entorno de construcción no tiene dispositivo Android ni emulador configurado. No es una publicación en Google Play o App Store.

La app usa la API HTTPS productiva. No se incluyen secretos, claves de firma ni contraseñas dentro del repositorio o la release.
