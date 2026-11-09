# ContadorGanadero Mobile

Aplicación nativa Expo + React Native + TypeScript en el monorepo. Dirección visual seleccionada: **opción 1**, referencia en docs/design-reference.png. No es una SPA.

## Requisitos y ejecución

- Node 24.13+ recomendado (SDK 58 requiere al menos 22.13; la web conserva su mínimo previo).
- Bun 1.4.3, Android Studio con SDK y JDK 21, o macOS con Xcode para iOS.
- Compilación de desarrollo: SQLCipher no funciona en Expo Go.
- Backend de desarrollo/staging con los cambios de esta rama. La URL pública predeterminada NO implica que el adaptador ya esté desplegado.

Desde la raíz: `bun install --frozen-lockfile`. Se usa instalación hoisted en bunfig.toml para evitar copias de módulos nativos.
En el único `.env` raíz, configura `EXPO_PUBLIC_API_URL=http://IP_LAN:5000/api` para desarrollo, o HTTPS para staging.
No copies secretos a mobile/.env. app.config.ts expone únicamente apiUrl.

Desde mobile/:

```sh
npm run android
# En macOS:
npm run ios
# Después de instalar una compilación de desarrollo:
npm start
npm run typecheck
npm run lint
npm test
npm run export
npx expo-doctor
```

Conecta un dispositivo por USB o configura un AVD. En Android, localhost del teléfono no es el equipo anfitrión. Para iOS usa un Mac o una compilación EAS interna con registro del dispositivo.

En Windows, los worktrees profundos pueden superar el límite de Ninja 1.10 incluido en CMake 3.22.1. Usa CMake 3.31.6 del Android SDK y long paths habilitado, según https://docs.expo.dev/troubleshooting/windows-long-paths/ . Tras prebuild, puedes seleccionar la herramienta solo para el build local desde mobile/android/ con `./gradlew.bat :app:assembleDebug '-Pandroid.cmakeVersion=3.31.6'`. En PowerShell, conserva las comillas del argumento. No se fija esta versión de CMake para EAS/Linux.

## Alcance

Login, registro, MFA TOTP/código de recuperación, recuperación por correo, dashboard, lista paginada y detalle de facturas, XML, ingresos y gastos manuales, inventario multiespecie con altas simples, resumen fiscal/declaraciones, perfil, plan, preferencias y cierre de sesiones.
La API conserva las autorizaciones por rol y plan. Un 403/402 se muestra al usuario; ocultar un botón no sustituye un guard.

Los formularios de inventario son altas mínimas de los modelos reales: identificación, nombre/sexo para bovinos; identificación de lote, estanque o colmena para las otras especies. Operaciones avanzadas permanecen en la web.

Sin OCR, emisión Hacienda, D-150 móvil, Checkout ONVO, chat IA ni cola offline de escrituras.
Las descargas usan bearer, archivos temporales privados y el diálogo nativo para abrir/compartir. Compartir crea una copia fuera del control de la app.

## Arquitectura

- app/: Expo Router, cuatro pestañas y rutas autenticadas.
- src/auth/: identidad y estados de sesión. El access token solo vive en memoria.
- src/api/: Axios y un único refresh simultáneo; refresh token solo en SecureStore, nunca en Query/AsyncStorage/logs.
- src/queries/: TanStack Query, sin reintentos de mutaciones.
- src/lib/vault.ts: SQLCipher por usuario/finca; clave aleatoria en SecureStore; comprueba cipher_version y falla cerrado.
- src/hooks/useRemote.ts: lectura de API o snapshots seleccionados (dashboard y páginas de facturas).
- src/theme/: tokens claro/oscuro y preferencia no sensible en AsyncStorage.
- Backend: authTransport selecciona el transporte según res.locals fijado por el router del servidor. Reutiliza authRoutes, authController y mfaService sin duplicar política de contraseña/MFA/rotación.

No se introduce un segundo algoritmo fiscal. El dashboard muestra el período fiscal que entrega la API, no etiqueta los acumulados anuales como montos del mes del boceto.

## Sesión y lectura offline

1. Login → desafío MFA si aplica → guardar refresh en SecureStore → access en memoria.
2. Reinicio online → desbloqueo si hay protección local → refresh rotatorio → perfil validado por API.
3. 401 → una promesa de refresh → persistir refresh nuevo → reintentar cada solicitud una vez.
4. Reúso → backend conserva revocación de familia y política existente de cierre global.
5. Logout → revocar si hay conexión → invalidar solicitudes, borrar Query, refresh, clave y base.
6. Reinicio offline → desbloqueo del dispositivo → identidad local protegida → comprobar máximo siete días → abrir SQLCipher.
7. Al pasar a segundo plano se ocultan los datos, se limpia Query y se cierra la base. Volver exige desbloqueo.
8. Sin bloqueo seguro no se habilita persistencia. Sin SQLCipher nunca se guarda una copia en texto plano.

El límite de siete días usa el reloj local y rechaza tiempos anteriores a la última validación. No permite conocer revocaciones remotas sin red. Una manipulación deliberada del reloj requiere un arrendamiento firmado/tiempo confiable como endurecimiento futuro.
Un logout offline elimina la copia local, pero no puede revocar el refresh en el servidor sin conexión. No hay cola de escrituras para enviarlo después.

## EAS: checklist previo a publicar

- Confirmar propiedad de los identificadores com.contadorganadero.mobile y cuenta Expo.
- Vincular proyecto EAS; no hay projectId ni credenciales inventados.
- Configurar URL HTTPS pública de staging/producción mediante entorno EAS; nunca subir .env raíz.
- Generar development builds Android/iOS y probar SQLCipher real (cipher_version).
- Probar bloqueo con PIN/biometría, cancelación, cambio de biometría, reinicio, pérdida de conexión y caducidad.
- Verificar TalkBack/VoiceOver, escalado de texto, contraste y permisos.
- Verificar carga desde proveedores de documentos Android/iOS y apertura/compartición.
- Completar privacidad, tratamiento de datos, eliminación de cuenta y requisitos vigentes de las tiendas.
- Validar firma, certificados, dispositivos internos y políticas de respaldo.
- Revisar informes de pruebas, código y seguridad; después producir builds firmados.
- No se ejecuta deploy ni submit automáticamente.

## APK de distribución directa

La versión inicial Android 0.1.0 se prepara con `scripts/release-android.ps1`: genera un APK release autónomo y lo firma usando la identidad protegida fuera del repositorio. El script exige JDK 21, Android SDK 37 y CMake 3.31.6. Los pasos, requisitos, checksum y recuperación de firma están en [release-0.1.0.md](docs/release-0.1.0.md).

La descarga se publica en GitHub Releases y se enlaza desde la landing. Este despliegue fue solicitado explícitamente por el propietario; no implica publicación en Google Play ni App Store.

Ver docs/auth-contract.md y docs/validation.md.

## Diseño Terreno

La app usa la dirección Terreno seleccionada: Bricolage Grotesque / Source Sans 3 locales, paleta marfil y oliva, variantes clara/oscura y animaciones nativas con movimiento reducido. Ver [implementación y validación](docs/terreno-implementation.md). La [versión Android 0.1.1](https://github.com/Samu3delna/contador-ganadero/releases/tag/mobile-v0.1.1) incluye este rediseño y está enlazada desde la landing productiva.
