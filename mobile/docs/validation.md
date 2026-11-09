# Evidencia de validación — 8 de noviembre de 2026

## Estado de entrega

APK Android release publicado y landing desplegada en Cloudflare. El adaptador móvil está activo en Render. No se publicó en las tiendas. La aceptación completa de Android/iOS sigue pendiente de pruebas de dispositivo.

## Publicación verificada — 8 de noviembre, 23:42 Costa Rica

- Código: `c51159964020814a0135eb90ae3ae9107d0ceefc`, publicado en `main`.
- Render: deploy `dep-dbolplm8bjmc73bc4ae0`, estado `live` a las 05:42:24 UTC del 9 de noviembre.
- Cloudflare: versión `ed7a1664-19a3-4522-8a7d-12886d845055`, https://contadorganadero.com .
- Release inicial: https://github.com/Samu3delna/contador-ganadero/releases/tag/mobile-v0.1.0 .
- APK release firmado: 39.040.525 bytes; Android 7+, arm64-v8a; firma v2/v3 y alineación 16 KB verificadas; sin flag debuggable; bundle Hermes y SQLCipher incluidos; URL productiva comprobada dentro del paquete.
- Descarga pública verificada por HTTP y haciendo clic en la landing con Playwright. Ambos archivos coinciden con SHA-256 `fa7394e807e545d86cd074d2fee2369c1cc40786a3b1eab7fe85819aa2c4c114`.
- API en vivo: health 200; login móvil sin datos 400 `INVALID_INPUT`; refresh móvil sin token 400 y `Cache-Control: no-store`; refresh web sin cookie 401. CORS conserva `https://contadorganadero.com`. No se crearon cuentas ni datos de prueba en producción.
- Landing revisada a 390 × 844 y 1440 × 1000; botón de al menos 49 px y descarga desde la primera sección. El 401 de restauración web sin sesión es esperado.
- Repetición final: backend 33 suites/256 pruebas; SDK 26; web 68; móvil 25. Lint web/móvil y TypeScript correctos; build web 2998 módulos y 13 páginas prerenderizadas.
- Instalación npm simulada en directorio limpio: exit 0, sin `legacy-peer-deps`. La resolución sobre los enlaces existentes de Bun se interrumpió por lentitud; no se cambió la política de peers. Se observaron advertencias de engines de dependencias de pruebas con Node 24.13.
- Una ejecución de tests concurrente con Gradle agotó el arranque de MongoMemoryServer y fue interrumpida. La ejecución completa posterior, sin Gradle concurrente, pasó; no se relajaron pruebas ni timeouts.

La descarga está marcada como prerelease por tratarse de la primera distribución con aceptación en dispositivos aún pendiente. Ver `release-0.1.0.md` para requisitos y conservación de la firma.

| Comando / comprobación | Resultado observado |
| --- | --- |
| bun install --frozen-lockfile | Correcto; instalación hoisted. Se apartaron enlaces antiguos de mobile/node_modules a node_modules/.mobile-before-hoist, carpeta local ignorada. |
| npm test | Correcto: 33 suites Jest backend, 256 pruebas; SDK fiscal 26; frontend 68. |
| Jest mobileAuth + mobileUpload + ingestaFacturaService | Correcto: 3 suites, 20 pruebas, repetidas después de endurecer validación XML y tenant. |
| npm run build | Correcto: Vite 2997 módulos, 13 páginas prerenderizadas y 17 URLs del sitemap. |
| npm run lint | Correcto, frontend sin errores. |
| npm run typecheck --workspace mobile | Correcto, TypeScript sin errores. |
| npm run lint --workspace mobile | Correcto, sin errores ni advertencias. |
| npm run test --workspace mobile | Correcto: 6 suites, 25 pruebas. |
| npx expo-doctor | Correcto: 20/20 comprobaciones. |
| npx expo prebuild --platform android --no-install | Correcto; SQLCipher habilitado mediante plugin. android/ generado e ignorado. |
| npm run export --workspace mobile | Correcto: bundles Hermes Android/iOS; salida ignorada mobile/dist/. |
| Gradle :app:assembleDebug | Correcto: BUILD SUCCESSFUL en 6m 13s; 526 tareas. APK debug arm64-v8a, 96 875 517 bytes; CMake 3.31.6 / Ninja 1.12.1, SQLCipher habilitado. |
| adb devices | Sin dispositivos conectados. |
| emulator -list-avds | Sin AVD configurado. |
| Smoke Android | No ejecutado: falta dispositivo o emulador. |
| Smoke iOS | No ejecutado: Windows sin macOS/Xcode ni dispositivo conectado. |
| Revisión visual nativa | Pendiente; la imagen de diseño no es una captura de la implementación. |
| Documento editable | Estructura de 10 secciones, enlaces internos, prompt completo y activación/desactivación de edición comprobados con JSDOM. Vista de navegador no disponible: el host CUA devolvió unavailable. |

Las 20 pruebas específicas backend son un subconjunto de las 256, no pruebas adicionales. Total de pruebas automatizadas distintas: **375**. No se cuentan las comprobaciones de Expo como pruebas de comportamiento.

## Cobertura añadida

Backend: login, registro, MFA mediante desafío y código de respaldo, contraseña incorrecta, bloqueo y suspensión, rotación/reúso de refresh, caducidad, tokenVersion, logout individual/global, cambio de tenant, rechazo de tenant arbitrario, continuidad de cookies web, XML válido/duplicado, imagen/no-XML y receptor perteneciente a otra finca.

Mobile: login accesible, consentimiento de registro, MFA, restauración online/offline, cierre y limpieza de sesión, 401 simultáneos, refresh tardío después de logout, caducidad de siete días, aislamiento de caché, ausencia de bloqueo seguro/SQLCipher, destrucción del vault, errores de conexión/permisos, selector XML/cancelación/rechazo de fotos/entidades y formulario de gasto.

RBAC, tenant guards y cuotas free/pro conservan sus suites existentes en la ejecución completa. No se inventaron nuevas cuotas para facturas o inventario: el catálogo vigente tiene límites para otras capacidades y el servidor conserva la autoridad.

## Incidencias resueltas durante validación

- Una primera ejecución completa agotó el timeout de un caso ONVO. La ejecución completa posterior pasó 256/256; no se aumentaron timeouts ni se modificó ONVO.
- El cambio de Bun isolated a hoisted dejó enlaces nativos duplicados. Se apartaron los enlaces antiguos de mobile y se fijó react-dom a la misma versión de React requerida por Expo. Expo Doctor pasó 20/20.
- El receptor del XML podía preceder al tenant autenticado en la resolución de una carga manual. Ahora la identidad autenticada determina el tenant; los canales de correo/WhatsApp mantienen su resolución.
- Se serializaron escrituras/borrado de credenciales y operaciones de vault para evitar restauración tardía tras logout.
- La primera compilación Gradle falló al crear rutas CMake de expo-sqlite bajo el worktree largo de Windows. La ruta abreviada con subst no resolvió las rutas absolutas; se retiró el mapeo temporal. CMake 3.31.6 / Ninja 1.12.1 resolvió el problema, usando la descarga oficial de Google y verificando su checksum contra el índice oficial. LongPathsEnabled ya estaba activo; no se modificó el registro de Windows. Diagnóstico y solución: https://docs.expo.dev/troubleshooting/windows-long-paths/ .

APK local: mobile/android/app/build/outputs/apk/debug/app-debug.apk. Es una compilación de desarrollo arm64, requiere Metro (`npm start`) y un backend de desarrollo/staging con estas rutas. No es un APK de distribución ni demuestra un smoke test. android/ y el APK permanecen ignorados por Git.

SHA-256 del APK: `15f33f065b5e6558267b69c6d51825ad0d1c10a9e18d23d1e076f2891450c221`.

## Límites y tareas de aceptación pendientes

1. Mantener un entorno de staging para probar flujos con datos de prueba. El adaptador productivo ya está desplegado y sus rutas fueron verificadas.
2. Instalar development builds en Android e iOS. Expo Go no incluye SQLCipher.
3. Verificar login/MFA, reinicio, rotación, suspensión, tenant, logout global y carga de XML desde proveedores nativos contra staging.
4. Verificar cifrado real, desbloqueo PIN/biometría, cancelación, segundo plano, reinicio, pérdida de red, siete días y borrado local.
5. Revisar referencia visual 1, 390 × 844, modos claro/oscuro, fuentes ampliadas, teclado, TalkBack y VoiceOver. Las pruebas de labels no sustituyen esa revisión.
6. Configurar cuenta/proyecto EAS y ficha de privacidad antes de publicar en tiendas. Ya existe firma propia para la distribución directa Android; reutilizarla en futuras actualizaciones. No se ejecutó submit.

## Seguridad offline

La clave aleatoria de SQLCipher y la identidad mínima residen en SecureStore. No se guarda información financiera en AsyncStorage. El access token solo permanece en memoria. El reloj local limita la lectura a siete días, pero no proporciona un tiempo confiable ante manipulación deliberada. Una revocación remota no puede conocerse sin conexión. Un logout offline borra el acceso local; la revocación remota necesita red.

Los archivos XML/PDF se copian temporalmente en el directorio privado de caché para selector/compartición y se eliminan en finally. Una interrupción abrupta del proceso puede dejar temporales del sistema; esto se debe revisar en el hardening nativo antes de publicar. Los archivos compartidos deliberadamente quedan fuera del control de la app.

## Referencias oficiales consultadas

- Expo: https://docs.expo.dev/versions/latest/ ; https://docs.expo.dev/guides/monorepos/
- SQLCipher: https://docs.expo.dev/versions/latest/sdk/sqlite/#sqlcipher
- SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Autenticación local: https://docs.expo.dev/versions/latest/sdk/local-authentication/
- Expo Router: https://docs.expo.dev/router/introduction/
- Pruebas: https://docs.expo.dev/develop/unit-testing/
