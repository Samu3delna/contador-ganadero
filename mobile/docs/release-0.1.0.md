# ContadorGanadero para Android 0.1.0

Primera distribución del MVP nativo para Android, conectado a la API de ContadorGanadero.

## Descargar e instalar

- Archivo: `contador-ganadero-0.1.0-android-arm64.apk` (39.040.525 bytes, aproximadamente 39 MB).
- Requiere Android 7.0 o posterior y procesador ARM de 64 bits (arm64-v8a).
- Abrí el APK descargado y, si Android lo solicita, autorizá la instalación desde tu navegador.
- Si instalaste antes el APK de desarrollo, desinstalalo primero: utiliza otra firma. La desinstalación borra su caché local.
- iPhone no puede instalar este archivo. La distribución iOS sigue pendiente.

Incluye inicio de sesión y MFA, dashboard, facturas y carga XML, gastos e ingresos, inventario, resúmenes tributarios y perfil. La lectura offline cifrada exige bloqueo seguro del dispositivo y haber descargado previamente los datos. Las escrituras requieren conexión. No incluye OCR de fotos.

## Integridad

SHA-256 del APK:

`fa7394e807e545d86cd074d2fee2369c1cc40786a3b1eab7fe85819aa2c4c114`

SHA-256 del certificado de firma:

`2ee0eea4b062e9c458e87908749512c35625d27453509a94d50af4ef33bfd04f`

El APK es una compilación release con bundle Hermes incluido, sin flag debuggable, firmado con RSA de 4096 bits y esquemas APK v2/v3. No necesita Expo Go ni Metro.

## Validación y límites

Firma y alineación verificadas con Android Build Tools; JavaScript y SQLCipher incluidos en el paquete. Las pruebas automatizadas y las verificaciones de despliegue se documentan en `validation.md`.

Esta es una distribución inicial: no se ha realizado todavía un smoke test en un teléfono físico ni en iOS. Quedan pendientes las comprobaciones nativas de biometría/PIN, proveedores de archivos, accesibilidad y restauración de sesión en dispositivos reales.

## Reproducir la firma local

En Windows, configurar `JAVA_HOME` (JDK 21) y `ANDROID_HOME` (SDK con Build Tools 37.0.0 y CMake 3.31.6). Desde la raíz:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File mobile/scripts/release-android.ps1
```

La primera clave se generó con autorización del propietario. Se conserva fuera del repositorio en `%LOCALAPPDATA%/ContadorGanadero/signing/`, con ACL restringida al usuario de Windows. Su contraseña se almacena mediante DPAPI; no aparece en argumentos, logs ni archivos del repositorio.

La contraseña DPAPI depende del usuario y del equipo. Antes de migrar o reinstalar Windows, el propietario debe crear una copia de recuperación segura de la clave y su contraseña usando un gestor de secretos. No regenerar la clave para actualizar esta app: conservar firma y aumentar `android.versionCode`.

El plugin de Expo evita firmar una release local con la clave debug. Para EAS debe configurarse explícitamente la misma identidad de firma; este script no carga credenciales en EAS ni publica en tiendas.
