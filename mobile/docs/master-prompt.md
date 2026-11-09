# Prompt maestro original

El siguiente bloque conserva el prompt maestro solicitado. Las decisiones posteriores están registradas al final y prevalecen cuando amplían el original.

```text
Actúa como arquitecto senior full-stack, desarrollador React Native/Expo y especialista UX móvil.

Debes crear una app móvil de producción para ContadorGanadero, conectada al backend existente. Trabaja en español y respeta completamente AGENTS.md.

IMPORTANTE:
- Primero realiza únicamente análisis y exploración.
- Después presenta un plan técnico completo.
- No escribas ni modifiques archivos hasta que el plan haya sido aprobado.
- Antes de construir la interfaz, usa Product Design para generar exactamente tres direcciones visuales móviles de 390 x 844 px.
- Espera a que el usuario seleccione una dirección visual.
- Solo después implementa.
- Al final ejecuta todas las validaciones y crea el artifact final solicitado.

CONTEXTO DEL PROYECTO

El proyecto actual es un monorepo npm/bun:

- backend/: Node.js, Express, Mongoose y JWT.
- frontend/: React 19 + Vite.
- package.json raíz con workspaces backend y frontend.
- Node requerido: >=22.12.0.
- El frontend está desplegado en Cloudflare.
- La API y el worker están desplegados en Render.
- La API productiva es https://contador-ganadero.onrender.com.
- El backend usa MongoDB.
- Toda la información pertenece a un tenant.
- Los planes válidos son únicamente free y pro.
- Los textos visibles deben estar en español de Costa Rica.

ANTES DE EMPEZAR

Lee completamente:

1. AGENTS.md.
2. .agents/skills/nodejs-backend-patterns/SKILL.md.
3. .agents/skills/javascript-testing-patterns/SKILL.md.
4. .agents/skills/vercel-react-best-practices/SKILL.md.
5. .agents/skills/vercel-composition-patterns/SKILL.md.

Lee además, solo si la implementación toca esos dominios:

- .agents/skills/mongodb-connection/SKILL.md
- .agents/skills/mongodb-query-optimizer/SKILL.md
- .agents/skills/hacienda-cr-v44/SKILL.md
- .agents/skills/rea-impuestos-cr/SKILL.md
- .agents/skills/multitenant-onvo-billing/SKILL.md
- .agents/skills/ingesta-facturas-agro-inventario/SKILL.md

Para diseño utiliza:

- Product Design index.
- Product Design get-context.
- Product Design ideate.
- Product Design image-to-code, cuando se haya elegido una dirección visual.

Usa Memorix como primer paso de trabajo con memorix_project_context. Al terminar, utiliza memorix_session_end si existe una sesión activa.

ESTRUCTURA DEL PROYECTO

Agrega una carpeta:

mobile/

No crees un repositorio nuevo salvo que exista una limitación técnica demostrable.

Actualiza el workspace raíz para incluir mobile como workspace, siempre que no rompa la instalación existente.

La app debe ser privada y autocontenida:

mobile/
  app/
    (auth)/
    (tabs)/
    facturas/
    inventario/
    perfil/
  src/
    api/
    auth/
    components/
    config/
    features/
    hooks/
    lib/
    queries/
    theme/
    types/
    utils/
  assets/
  tests/
  app.config.ts
  package.json
  tsconfig.json

Usa Expo managed workflow, Expo Router y TypeScript. No conviertas la app móvil en una SPA web responsiva.

DEPENDENCIAS RECOMENDADAS

Usa versiones compatibles entre sí verificadas mediante la documentación oficial de Expo:

- expo.
- expo-router.
- expo-secure-store.
- expo-document-picker.
- expo-file-system.
- axios.
- @tanstack/react-query.
- @tanstack/query-async-storage-persister.
- @react-native-async-storage/async-storage.
- @testing-library/react-native.
- jest-expo.
- una biblioteca de iconos compatible con React Native.

Usa StyleSheet y tokens de diseño propios para el MVP. No portes automáticamente Tailwind, shadcn/ui ni componentes web al entorno nativo.

ARQUITECTURA DE AUTENTICACIÓN

El frontend web actual conserva su comportamiento sin cambios:

- Access token en memoria.
- Refresh token en cookie httpOnly.
- Rutas web actuales sin regresiones.

Agrega un adaptador móvil compatible:

POST /api/mobile/auth/login
POST /api/mobile/auth/mfa/verify
POST /api/mobile/auth/refresh
POST /api/mobile/auth/logout

El adaptador móvil debe reutilizar la lógica existente de autenticación, rotación y revocación. No dupliques validaciones de contraseña, MFA, bloqueo, suspensión, tokenVersion ni detección de reúso.

Contrato móvil esperado:

- Login exitoso: accessToken, refreshToken, expiresIn y user.
- Login con MFA pendiente: mfaRequired, mfaToken y mensaje.
- Refresh exitoso: nuevo accessToken, nuevo refreshToken y expiresIn.
- Logout: revoca el refresh token enviado.
- El refresh token nunca se registra en logs.
- El refresh token nunca se guarda en AsyncStorage, localStorage ni variables globales.
- El access token permanece únicamente en memoria.
- El refresh token se guarda exclusivamente con expo-secure-store.
- La rotación debe invalidar el token anterior.
- La reutilización de un token rotado debe revocar la familia completa.

Los tokens deben conservar tenantId, rol, tokenVersion, issuer y audience compatibles con protegerRuta.

La app nunca debe enviar tenantId arbitrario. El tenant siempre debe derivarse del token y de la base de datos.

CLIENTE API MÓVIL

Implementa un cliente Axios con:

- Base URL configurable.
- Header Authorization Bearer.
- Timeout razonable.
- Interceptor de respuesta 401.
- Una sola promesa de refresh simultánea.
- Reintento máximo de una solicitud.
- Logout local si falla el refresh.
- Mensajes de error en español.
- No exposición de secretos en `EXPO_PUBLIC_*`.

El endpoint de producción debe ser configurable sin crear un segundo archivo `.env` con secretos. Respeta la regla del proyecto de utilizar el `.env` raíz. Actualiza únicamente `.env.example` si se necesita documentar una variable pública.

ESTADO Y CACHÉ

Usa:

- AuthContext únicamente para sesión e identidad.
- TanStack Query para estado remoto.
- AsyncStorage solo para caché no sensible.
- SecureStore únicamente para refresh token y datos estrictamente sensibles.

La caché debe:

- Separarse por usuario y tenant.
- Invalidarse al cerrar sesión.
- Nunca mezclar datos de dos tenants.
- Mostrar fecha de última sincronización.
- Permitir consultar el último dashboard y listado descargado.
- Exigir conexión para escrituras en el MVP.
- Mostrar claramente “Sin conexión” y “Datos almacenados localmente”.

PANTALLAS DEL MVP

Autenticación:

- Splash/loading.
- Login.
- Registro.
- Verificación MFA.
- Recuperación de contraseña.
- Estado de sesión expirada.

Navegación principal:

- Inicio.
- Facturas.
- Inventario.
- Más.

Inicio:

- Balance de ingresos y gastos.
- Total de facturas recientes.
- Resumen de inventario.
- Proyección o resumen tributario disponible.
- Estado del plan free/pro.
- Estado de sincronización.

Facturas:

- Lista paginada.
- Filtros básicos.
- Detalle de factura.
- Categoría IA.
- Deducibilidad.
- Tarifa agropecuaria.
- Descarga o apertura de XML/PDF cuando la API lo permita.
- Carga de XML mediante DocumentPicker.
- Estados: cargando, procesada, duplicada, revisión, error y sin conexión.

RESTRICCIÓN IMPORTANTE:
El backend actual acepta XML en `/api/facturas/upload`. Las fotografías no se almacenan ni se procesan actualmente. No agregues una interfaz que afirme que una foto fue registrada como gasto. La cámara/OCR debe quedar documentada como fase futura, salvo que se diseñe y pruebe un servicio backend independiente.

Gastos e ingresos:

- Crear gasto manual.
- Crear ingreso manual.
- Validación de montos, fechas y campos obligatorios.
- Confirmación antes de eliminar.
- Manejo de cuotas del plan.

Inventario:

- Resumen multiespecie.
- Acceso a bovinos, aves, peces y abejas.
- Formularios simples para operaciones permitidas por la API.
- No inventar campos que no existan en los modelos actuales.
- Mostrar restricciones de plan cuando corresponda.

Impuestos:

- Resumen IVA.
- Resumen renta.
- Acceso a declaraciones disponibles.
- Los cálculos permanecen exclusivamente en el backend.
- La app nunca debe replicar reglas fiscales de forma independiente.

Perfil:

- Datos del usuario.
- Datos de la finca.
- Plan actual.
- Cerrar sesión.
- Cerrar todas las sesiones.
- Preferencias básicas.
- Enlaces legales.

DISEÑO Y UX

Antes de implementar:

1. Lee los estilos y pantallas existentes del frontend.
2. Identifica colores, tipografías, terminología, iconografía y patrones de interacción.
3. Usa Product Design get-context.
4. Usa Product Design ideate.
5. Genera exactamente tres opciones visuales independientes en 390 x 844 px.
6. No generes un inventario de funcionalidades en una sola pantalla.
7. Cada opción debe mostrar una pantalla principal enfocada.
8. Detén la implementación hasta que el usuario seleccione una opción.

La UI elegida debe:

- Estar completamente en español.
- Usar lenguaje claro para productores agropecuarios.
- Tener botones táctiles de al menos 44 px.
- Ser accesible con lector de pantalla.
- Tener contraste suficiente.
- Soportar modo claro y oscuro.
- Evitar exceso de tarjetas.
- Usar jerarquía visual fuerte.
- Mostrar estados de carga, vacío, error, conexión y permisos.
- No usar emojis como iconos principales.
- No copiar literalmente componentes web no compatibles con React Native.

BACKEND

Si hacen falta cambios backend:

- Mantén compatibilidad con el frontend web.
- No modifiques webhooks productivos.
- No cambies el orden crítico de middlewares.
- No rompas CORS, cookies ni refresh web.
- Conserva `tenantId`.
- Usa `req.filtrarPorTenant()` y `req.aplicarTenant()` cuando corresponda.
- Reutiliza los guards existentes de autenticación, RBAC y cuotas.
- Valida cuerpos y archivos.
- Mantén límites de tamaño.
- Devuelve errores consistentes.
- Agrega pruebas de integración con Jest y Supertest.
- No agregues índices ni cambios de conexión MongoDB sin justificarlo con la skill correspondiente.
- Nunca expongas claves Hacienda, ONVO, IA, JWT ni certificados.

API EXISTENTE A REUTILIZAR

Inspecciona antes de implementar:

- /api/auth
- /api/dashboard
- /api/facturas
- /api/ingresos
- /api/impuestos
- /api/declaraciones
- /api/inventario
- /api/costos
- /api/hacienda
- /api/onvo

Usa `frontend/src/services/api.js` como referencia del contrato actual, pero verifica cada endpoint contra sus rutas y controladores reales.

PRUEBAS

Backend:

- Login móvil correcto.
- Login con MFA.
- Contraseña incorrecta.
- Cuenta suspendida.
- Usuario bloqueado.
- Refresh válido.
- Refresh expirado.
- Refresh reutilizado.
- Logout.
- Logout global.
- TokenVersion revocado.
- Aislamiento entre tenants.
- RBAC.
- Cuotas free/pro.
- Carga válida de XML.
- Rechazo de imagen y archivo no XML.
- Respuestas de error consistentes.
- No regresión del login web.

Mobile:

- Renderizado de login.
- Registro.
- MFA.
- Restauración de sesión.
- Interceptor 401.
- Refresh único ante solicitudes simultáneas.
- Logout y limpieza de SecureStore.
- Caché separada por tenant.
- Estado offline.
- Lista vacía.
- Error de red.
- Error de permisos.
- Carga XML.
- Formulario de gasto.
- Accesibilidad básica.

Ejecuta:

- npm test.
- npm run build.
- npm run lint.
- Pruebas específicas backend.
- Tests móviles con jest-expo.
- Expo export o equivalente.
- Smoke test en Android.
- Smoke test en iOS si el entorno está disponible.

No despliegues producción automáticamente.

ENTREGABLES

Entrega:

1. Código de `mobile/`.
2. Cambios backend mínimos y compatibles.
3. Tests.
4. Documentación de arquitectura.
5. Contrato de autenticación móvil.
6. Variables de entorno documentadas.
7. Instrucciones locales para Android/iOS.
8. Checklist de publicación con EAS.
9. Informe de pruebas.
10. Artifact visual editable final.

El artifact final debe incluir:

- Resumen del producto.
- Decisiones tomadas.
- Arquitectura móvil/API.
- Flujo de autenticación.
- Mapa de pantallas.
- Matriz de skills utilizadas.
- Matriz de herramientas utilizadas.
- Fases implementadas.
- Pruebas ejecutadas.
- Riesgos y pendientes.
- Próximos pasos.
- Enlace o referencia al código creado.

No declares la tarea completa si la app solo tiene pantallas visuales sin conexión real a la API.
```

## Decisiones confirmadas después del prompt

- Implementar en el monorepo, Android e iOS, Expo + React Native + TypeScript.
- Lectura offline **cifrada y con desbloqueo del dispositivo**; sin bloqueo seguro no hay persistencia offline.
- Caducidad máxima de siete días desde la última validación online; escrituras siempre online.
- Dirección visual **1**, seleccionada por el usuario entre las tres propuestas.
- Implementación autorizada con «hazlo», «1» y «continua y termina».
- El artifact persistente es un Deska artifact, guardado con deska_artifact_save al final.

## Adaptaciones de implementación

- SQLCipher almacena snapshots seleccionados; no se usa el persister AsyncStorage recomendado porque los datos financieros son sensibles. AsyncStorage conserva únicamente la preferencia de tema.
- Se agregó registro en /api/mobile/auth/registro; recuperación y logout global reutilizan sus rutas existentes.
- Expo SDK 58 requiere Node >=22.13 para mobile; se recomienda Node 24.13+ sin cambiar el mínimo histórico del frontend.
- Carpetas vacías src/config y src/features no se añaden: configuración en app.config.ts y funciones agrupadas en src/api y app.
- Fallos de refresh por credencial revocada cierran sesión; un fallo de conectividad puede conservar el vault vigente para lectura offline desbloqueada.
- Las pruebas de dispositivo y revisión visual nativa se declaran pendientes si el entorno no permite ejecutarlas. El artifact documenta evidencia real, no una certificación de producción.
