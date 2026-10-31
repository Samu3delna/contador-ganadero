# Auditoría frontend — 2026-10-31

Revisor: frontend_review. Alcance: árbol de trabajo, no solamente diff. Base comunicada por coordinación: `2b501d5e4d98f2aaa00a56efdf2e64152199247a`, más los cambios locales registrados en `snapshot-inicial.json`. Revisión estática en modo solo lectura; este informe es la única escritura realizada por este revisor.

Se identifican 13 hallazgos: 4 de severidad alta y 9 media. No se confirma un hallazgo crítico en este alcance. Las severidades reflejan el escenario descrito, no una vulnerabilidad explotada en producción. Los escenarios se deducen de contratos y rutas del código; no se presentan como pruebas de navegador ejecutadas.

## Hallazgos

### FE-01 — Alta — El historial del chat se expone entre cuentas del mismo navegador

- **Ubicación:** `frontend/src/components/dashboard/ChatBot.jsx:16`, `:43-60`, `:101-108`; `frontend/src/context/AuthContext.jsx:95-100`.
- **Escenario:** A inicia sesión, pregunta por ingresos o proveedores y cierra sesión. B inicia sesión en otra cuenta/finca usando el mismo navegador y abre el chat. El componente recupera los mensajes de A desde la misma clave global `chatbot_mensajes_v1`. Una nueva pregunta de B también adjunta hasta diez mensajes anteriores de A al historial enviado a la API.
- **Evidencia:** ni la clave de almacenamiento ni la carga/guardado incluyen identificador de usuario o tenant. `logout` limpia el access token y el estado React, pero no ese historial. El chat reconstruye el historial directamente desde lo recuperado.
- **Impacto:** divulgación de información contable entre cuentas y contaminación del contexto del asistente. Requiere compartir el perfil de navegador; no implica acceso remoto universal.
- **Corrección propuesta:** vincular el historial a la identidad autenticada y tenant, impedir su carga antes de resolver la sesión y limpiar o separar explícitamente los datos al cambiar/cerrar sesión. Considerar almacenamiento de sesión según la retención deseada.
- **Ejes:** **Standards:** contradice el propósito del aislamiento por finca documentado en `AGENTS.md:87-88` y `.agents/skills/multitenant-onvo-billing/SKILL.md`, sección Aislamiento Multi-Tenant; la regla no menciona literalmente `localStorage`, por lo que esta aplicación al caché del navegador es interpretación explícita. **Spec:** sin especificación específica de persistencia del chat. **Funcional/seguridad:** confirmado por trazado del flujo.

### FE-02 — Alta — Los formularios de Hacienda no pueden obtener los datos del emisor

- **Ubicación:** `frontend/src/components/hacienda/EmitirComprobanteModal.jsx:50-61`, `:92-94`; `frontend/src/services/api.js:9-14`. También existe la fuente obsoleta en `frontend/src/components/facturacion/EmitirFacturaModal.jsx:57-77`.
- **Escenario:** un usuario autenticado con nombre y cédula correctos abre Hacienda, completa FE/TE/FEC o REP y pulsa crear. Aparece siempre “Datos del emisor incompletos”.
- **Evidencia:** `setAccessToken`, utilizado al iniciar/restaurar sesión, borra `localStorage.usuario`. El modal lee exclusivamente esa clave para llenar `emisor`; no consulta `useAuth` ni presenta campos para corregir al emisor. La comprobación del emisor se ejecuta incluso antes de la rama REP. El formulario legacy también conserva la misma dependencia y envía datos vacíos, aunque este informe no afirma un resultado concreto de validación Mongoose para esa ruta.
- **Impacto:** bloqueo de la emisión desde la interfaz nativa para las sesiones normales, sin relación con la disponibilidad de Hacienda o el certificado.
- **Corrección propuesta:** tomar la identidad fiscal de la sesión/configuración del tenant y mapear los tipos de cédula al contrato fiscal. Para REP, validar solo los datos que requiere ese flujo. Unificar la fuente del emisor en ambos formularios.
- **Ejes:** **Standards:** sin infracción adicional atribuida a una regla exacta. **Spec:** incumple la capacidad de facturación electrónica descrita en `AGENTS.md`, sección Qué es ContadorGanadero, y el flujo de comprobantes de `.agents/skills/hacienda-cr-v44/SKILL.md`. **Funcional:** confirmado enteramente en el frontend.

### FE-03 — Alta — El login no completa el desafío MFA

- **Ubicación:** `frontend/src/pages/LoginPage.jsx:110-123`; contrato en `frontend/src/context/AuthContext.jsx:53-56` y `backend/controllers/authController.js:334-346`.
- **Escenario:** una cuenta tiene `mfa.enabled=true` e ingresa email y contraseña válidos. El backend retorna `mfaRequired`; `AuthContext.login` lo devuelve sin crear sesión. La página lo trata como login exitoso y navega al panel, cuyo guard devuelve al login.
- **Evidencia:** `LoginPage` no comprueba `mfaRequired`, no conserva el desafío ni permite introducir TOTP o código de recuperación. Siempre llama a `login` con solo email y contraseña, aunque el contexto admite un tercer argumento.
- **Impacto:** las cuentas con MFA no pueden acceder mediante la interfaz. No es un bypass del segundo factor.
- **Corrección propuesta:** implementar el estado de desafío y su formulario, conservar los datos necesarios con alcance limitado y navegar solo cuando se obtiene una sesión real. Soportar el mecanismo de recuperación que permite el backend.
- **Ejes:** **Standards:** sin regla específica citada. **Spec:** no se encontró especificación local de UX MFA; no se convierte la mera existencia del endpoint en una promesa documental. **Funcional:** incompatibilidad demostrable entre un estado válido del backend y el cliente.

### FE-04 — Alta — Resúmenes y listados ignoran la paginación del backend

- **Ubicación principal:** `frontend/src/pages/GastosPage.jsx:18-19`, `:35-46`, `:59`; contrato `backend/controllers/facturaController.js:23-30`.
- **Otros afectados comprobados:** `frontend/src/pages/CalendarioPage.jsx:17-23`; `frontend/src/pages/FacturasPage.jsx:29-36`; `frontend/src/pages/IngresosPage.jsx:28-29`; `frontend/src/pages/FacturacionPage.jsx:21-25`; `frontend/src/pages/HaciendaPage.jsx:50-57`.
- **Escenario:** la finca tiene más de 100 facturas. Gastos pide `limit=500`, pero la API impone máximo 100; la página suma únicamente esas 100 y presenta el resultado como análisis de todas las facturas. En calendario se filtra el mes después de truncar, por lo que meses antiguos aparecen vacíos aunque tengan gastos.
- **Evidencia:** la API devuelve `total`, `pagina` y `totalPaginas`, pero estas vistas descartan esos campos y no ofrecen navegación. Facturas e Ingresos cargan 50; Facturación y la lista de emisión de Hacienda usan el valor por defecto de 20 (`backend/controllers/facturaEmisionController.js:8-19`).
- **Impacto:** totales por categoría incompletos, gastos ausentes del calendario y documentos antiguos inaccesibles para consultar/operar desde las listas. La severidad alta se asigna a la incorrección del resumen financiero, no a la mera ausencia de un control visual.
- **Corrección propuesta:** calcular agregados completos en backend; filtrar el calendario por rango antes de paginar; incorporar paginación real y sus metadatos en los listados. No corregir elevando un límite arbitrario.
- **Ejes:** **Standards:** sin regla exacta de paginación en los documentos consultados. **Spec:** no hay especificación detallada identificada; la frase “todas tus facturas” es evidencia del comportamiento presentado por la UI, no una spec externa. **Funcional:** contrato paginado consumido como conjunto completo.

### FE-05 — Media — Vite omite el archivo `.env` de la raíz documentado por el proyecto

- **Ubicación:** `frontend/vite.config.js:9-34`; `package.json:10-11`.
- **Escenario:** se define únicamente en el `.env` raíz un `VITE_API_URL` de staging, o las variables de anuncios/analítica, y se ejecuta el build documentado. Los scripts cambian a `frontend`; la configuración no define `envDir` ni carga el entorno raíz.
- **Evidencia:** Vite usa por defecto la raíz del proyecto para cargar `.env`. Con estos scripts la raíz es `frontend`. `apiUrl.js` acaba usando el Render de producción como fallback, y las otras variables quedan ausentes, salvo que el proceso/CI las haya inyectado externamente. Este revisor no abrió `.env` ni afirma cuáles son sus valores reales. Comportamiento contrastado con [la documentación oficial de envDir](https://vite.dev/config/shared-options.html#envdir).
- **Impacto:** configuraciones locales ignoradas; un build de staging puede apuntar a producción. La inyección de variables en CI puede ocultar el problema en algunos despliegues.
- **Corrección propuesta:** configurar el directorio de entorno raíz; utilizar `loadEnv` cuando las opciones del propio archivo de configuración deban consumirlo, manteniendo el prefijo de exposición `VITE_`.
- **Ejes:** **Standards:** infracción directa de `AGENTS.md:43`: ambos workspaces cargan el único `.env` de la raíz; también afecta la regla de respetar `VITE_API_URL` en producción. **Spec:** no se aporta una spec distinta.

### FE-06 — Media — La UI puede presentar impuestos de un período con la etiqueta de otro

- **Ubicación:** `frontend/src/pages/ImpuestosPage.jsx:17-29`, `:75-89`; `frontend/src/components/impuestos/PanelIVA.jsx:8` y `PanelRenta.jsx:8`. Variante en `frontend/src/pages/D150Page.jsx:60-81`, `:84-99`, `:124-142`.
- **Escenario:** se carga IVA de 2026, se cambia a 2025 y la nueva petición falla. El catch solo escribe en consola; el objeto de 2026 sigue guardado y vuelve a mostrarse con el encabezado 2025. También dos respuestas en orden inverso pueden dejar el resultado del filtro anterior. En D150, cambiar mes/retenciones conserva el resultado anterior mientras exportar usa los valores nuevos.
- **Impacto:** cifras correctas para una consulta se atribuyen visualmente a otra, y una descarga puede no coincidir con lo revisado en pantalla.
- **Corrección propuesta:** asociar cada resultado a sus parámetros, invalidarlo al cambiar filtros, indicar fallo/pendiente y descartar respuestas obsoletas mediante cancelación o identificador de petición. Exportar el cálculo mostrado o exigir recálculo explícito.
- **Ejes:** **Standards/Spec:** sin regla específica citada. **Funcional:** identidad de consulta y resultado no se conservan. No se emite una conclusión jurídica sobre los impuestos.

### FE-07 — Media — Las rutas autenticadas `/auth/*` no pueden renovar un access token vencido

- **Ubicación:** `frontend/src/services/api.js:44-51`; consumidores `actualizarPerfilAPI`/`obtenerPerfilAPI` y `frontend/src/context/AuthContext.jsx:80-91`.
- **Escenario:** una sesión conserva su cookie refresh válida pero el access token vence durante inactividad. La siguiente acción es guardar el perfil o refrescar la sesión con `/auth/perfil`: recibe 401 y el interceptor lo devuelve sin intentar refresh.
- **Evidencia:** la exclusión usa `startsWith('/auth/')` para todas las rutas, no solamente login, registro, refresh y logout. El access token tiene por defecto 15 minutos (`backend/controllers/authController.js:37`). Las rutas de perfil sí requieren ese token.
- **Impacto:** operaciones de cuenta fallan pese a que la sesión puede renovarse; solo otra ruta no excluida o una recarga recupera la experiencia.
- **Corrección propuesta:** excluir una lista explícita de endpoints que no deben renovar; permitir la renovación única para endpoints protegidos de cuenta.
- **Ejes:** **Standards:** relacionado con la conservación de auth cross-origin de `AGENTS.md:58`, pero esa regla no prescribe esta lista de exclusión, por lo que no se etiqueta como infracción literal. **Spec:** sin spec específica. **Funcional:** excepción del interceptor demasiado amplia.

### FE-08 — Media — El estado global del plan no se actualiza después de pagar o cancelar

- **Ubicación:** `frontend/src/pages/PlanesPage.jsx:17-21`, `:71-83`; `frontend/src/pages/BillingPage.jsx:66-69`; consumidor `frontend/src/components/ads/AdvertisingSlot.jsx:14-18`.
- **Escenario:** una cuenta free paga y el polling ya confirma pro. La página de planes actualiza solo `planActual`; `AuthContext.usuario` continúa en free. El banner de anuncios sigue visible durante esa sesión. A la inversa, cancelar pro no actualiza el contexto y los anuncios continúan ocultos.
- **Evidencia:** ninguno de los flujos invoca `refrescarSesion`/`actualizarUsuario`. El componente publicitario decide usando exclusivamente `useAuth` y no el estado local obtenido por la página de billing.
- **Impacto:** el usuario que acaba de pagar sigue viendo publicidad hasta recargar/reautenticar; el resto de indicadores que consuman la sesión también pueden quedar atrasados.
- **Corrección propuesta:** invalidar/refrescar la sesión o un estado único de tenant al confirmar un cambio de plan y hacer que todas las vistas lo consuman.
- **Ejes:** **Standards/Spec:** contradice el comportamiento free con anuncios/pro sin anuncios descrito en `.agents/skills/multitenant-onvo-billing/SKILL.md`, regla Planes Exclusivos, y `AGENTS.md`, sección Qué es ContadorGanadero. **Funcional:** estados locales desconectados.

### FE-09 — Media — Mezclar fechas civiles con UTC cambia el día de ventas y gastos

- **Ubicación:** `frontend/src/pages/IngresosPage.jsx:19`, `:40`; `frontend/src/pages/DeclaracionesPage.jsx:87`, `:105`, `:626`; `frontend/src/components/ingresos/HistorialVentas.jsx:58`; contrato `backend/controllers/ingresoController.js:38-41`.
- **Escenario 1:** a las 19:00 del 31 de octubre en Costa Rica, `toISOString().split('T')[0]` entrega 1 de noviembre como fecha por defecto. Guardar sin modificarla registra la operación en el día siguiente.
- **Escenario 2:** una fecha escogida `2026-10-31` se convierte en backend a medianoche UTC. `new Date(ing.fecha).toLocaleDateString('es-CR')`, en un navegador de Costa Rica, muestra 30 de octubre. El locale español no fija la zona horaria ni convierte la fecha en una fecha civil.
- **Impacto:** fechas incorrectas en entrada/presentación, especialmente grave al cruzar fin de mes/período. No se afirma aquí que todos los cálculos fiscales del backend sufran ese mismo desplazamiento.
- **Corrección propuesta:** definir un contrato único para fechas sin hora, generar el valor del date picker en calendario local y mostrar fechas civiles sin conversión accidental de zona. Tratar los timestamps reales de XML por separado.
- **Ejes:** **Standards/Spec:** sin regla específica de serialización identificada. **Funcional:** conversión de zona reproducible con las entradas indicadas.

### FE-10 — Media — Doble clic en registrar ingreso genera operaciones duplicadas

- **Ubicación:** `frontend/src/pages/DeclaracionesPage.jsx:180-210`, `:608`; contrato `backend/controllers/ingresoController.js:31-59`.
- **Escenario:** con una conexión lenta, el usuario pulsa dos veces “Registrar Ingreso” antes de que regrese la primera petición. Ambas invocaciones toman el mismo formulario y envían POST. El controlador crea un documento para cada llamada.
- **Evidencia:** el handler no tiene bandera/guard de envío, y el botón no tiene `disabled`. `cargando` solo se activa después, al recargar los datos; no cubre el POST. La otra página `IngresosPage` sí tiene un estado `guardando`, por lo que este hallazgo se limita al formulario de Declaraciones.
- **Impacto:** duplicación de ingresos y de importes que alimentan reportes contables.
- **Corrección propuesta:** bloquear nuevas invocaciones durante la operación y deshabilitar el botón con indicación de progreso; reforzar con idempotencia si la API debe soportar reintentos de red.
- **Ejes:** **Standards:** las pautas de formularios consultadas mediante `.agents/skills/web-design-guidelines/SKILL.md` requieren estado de envío durante la petición. **Spec:** no hay spec específica. **Funcional:** creación duplicada demostrable por ausencia de guard y contrato POST.

### FE-11 — Media — Refrescar facturas anuncia éxito aunque la consulta haya fallado

- **Ubicación:** `frontend/src/pages/FacturasPage.jsx:27-42`, `:54-61`.
- **Escenario:** después de ver la lista, la API falla con error de red/500 y el usuario pulsa Refrescar. `cargar` captura el error y termina resuelta. `handleSincronizar` siempre muestra “Facturas actualizadas”, aunque siguen los registros anteriores.
- **Impacto:** el usuario confía en una actualización inexistente y puede interpretar que una factura nueva no llegó. En carga inicial el mismo patrón puede aparentar ausencia de registros.
- **Corrección propuesta:** propagar el fallo o retornar un resultado explícito y mantener un estado de error visible; anunciar éxito solo tras una respuesta válida.
- **Ejes:** **Standards/Spec:** sin regla exacta adicional. **Funcional:** error absorbido y éxito incondicional en el llamador.

### FE-12 — Media — Un fallo temporal del SDK de pagos bloquea todos los reintentos de la sesión

- **Ubicación:** `frontend/src/components/billing/OnvoCheckoutModal.jsx:14-24`, `:37-38`, `:67-75`, `:84-91`.
- **Escenario:** la primera carga de `sdk.js` falla por un corte de red. El usuario recupera conexión, cierra el modal y vuelve a elegir el plan. `sdkPromise` sigue siendo la promesa rechazada, por lo que no se realiza otra carga. Además `errorSdk` nunca se limpia y la rama de error retira el contenedor del formulario.
- **Impacto:** no puede continuar el pago sin recargar completamente la aplicación, aun después de solucionar la conexión.
- **Corrección propuesta:** reiniciar el caché de promesa al fallar, limpiar estado del modal al iniciar un checkout y ofrecer reintento que recree el contenedor antes del render del SDK.
- **Ejes:** **Standards/Spec:** sin regla exacta citada. **Funcional:** estado de fallo permanente tras un error recuperable; no depende de un detalle no verificado de la API de ONVO.

### FE-13 — Media — Formularios de inventario carecen de asociación accesible entre etiquetas y controles

- **Ubicación representativa:** `frontend/src/components/inventario/BovinoForm.jsx:65-72`, `:77-82`; `AvesForm.jsx:83-90`; `PecesForm.jsx:87-94`; `ColmenaForm.jsx:63-70`. El patrón se repite en estos cuatro formularios.
- **Escenario:** un usuario con lector de pantalla recorre campos del formulario. Los textos `<label>` son hermanos de los inputs, pero no tienen `htmlFor`, y los controles no tienen `id` ni `aria-label`. No poseen nombre accesible derivado de la etiqueta; pulsar la etiqueta tampoco enfoca el campo.
- **Impacto:** identificación y cumplimentación de controles dificultada para usuarios de tecnología asistiva. No se basa en una preferencia de estilo visual.
- **Corrección propuesta:** asignar pares `id`/`htmlFor` estables o envolver cada control con su etiqueta; comprobar el nombre accesible del control.
- **Ejes:** **Standards:** pauta de accesibilidad delegada por `.agents/skills/web-design-guidelines/SKILL.md`, “Form controls need `<label>` or `aria-label`”, y asociación clicable de labels, consultadas en [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). **Spec:** sin spec particular del formulario. **Funcional/accesibilidad:** asociación semántica ausente en el DOM generado.

## Cobertura y límites

Se consultaron antes del análisis: `AGENTS.md`; skills de React best practices, composición, Tailwind, frontend design, web design guidelines, Vite, Workers, Node/Express, multi-tenant/ONVO, impuestos REA, ingesta/inventario y Hacienda; además las skills externas `vibe-coding-toolkit` con su flujo de revisión multia-gente y `code-review`. La memoria Autopilot ya había sido consultada por coordinación; no se solicitó memoria adicional ni se almacenaron hallazgos.

Archivos examinados con detalle de flujo: `services/api.js`, `services/apiUrl.js`, `context/AuthContext.jsx`, `App.jsx`, `main.jsx`, `vite.config.js`, `wrangler.jsonc`, `package.json` de raíz/frontend; páginas Login, Perfil, Facturas, Ingresos, Gastos, Inventario, Costos, Facturación, Hacienda, Declaraciones, D150, Impuestos, Calendario, Dashboard, Billing y Planes; componentes LoginForm, EmailStatus, FormularioIngreso, HistorialVentas, los cuatro formularios de inventario, EmitirFacturaModal, EmitirComprobanteModal, ChatBot, OnvoCheckoutModal, AdvertisingSlot, Modal, DetalleFacturaModal, ResumenCards, ProyeccionFiscal, PanelIVA y PanelRenta; `data/planes.js`; lógica inicial y contratos de `admin/AdminUsuariosPage.jsx`, `admin/AdminTenantsPage.jsx` y `services/adminApi.js`.

Contratos backend consultados de forma dirigida: `authController.js` y `authRoutes.js` (MFA, vencimiento, rutas); `facturaController.js` (límites); `ingresoController.js` (fechas, creación, paginación); `facturaEmisionController.js` y `haciendaController.js` (emisión/listas); `chatController.js` y `chatRoutes.js` (feedback/stream). No se auditó el backend completo desde esta lente.

Cobertura parcial: archivos largos de Declaraciones, Hacienda y formularios se revisaron por bloques de lógica relevantes, no cada rama de presentación. AdminUsuarios/AdminTenants se revisaron principalmente en carga y acciones. No hubo auditoría visual renderizada, lectura completa de CSS, revisión exhaustiva de Landing/legal, todos los componentes shadcn, hooks SEO/reveal ni pruebas de lector de pantalla. No se ejecutaron build/tests para evitar colisiones con las comprobaciones centralizadas. No se abrió `.env`, certificados ni secretos.

Coordinación notificó cambios concurrentes en `App.jsx`, `Sidebar.jsx`, `adminApi.js`, `admin.css` y un nuevo `AdminSoportePage.jsx`. Ningún hallazgo depende de la nueva ruta administrativa. No se atribuye cobertura al nuevo módulo de soporte; su estado final debe quedar cubierto por la síntesis del coordinador. Las líneas de hallazgos corresponden a los archivos inspeccionados; los componentes con evidencia principal no forman parte de esa lista de cambios concurrentes.

## Candidatos descartados o no promovidos

- No se marca como error la ausencia de Cloudflare Agents SDK: no es requisito de este frontend.
- No se recomienda migrar Tailwind 3 a 4 por la versión de la skill; la convención híbrida de `AGENTS.md` prevalece.
- El fetch de streaming no usa el interceptor Axios, pero el ChatBot tiene fallback por Axios; no se declara una pérdida permanente de renovación por ese solo detalle.
- El feedback de chat no requiere `requestId` en el controlador actual; no se reporta que ignorarlo rompa feedback.
- El cliente sí conserva `withCredentials: true`, token en memoria y una promesa compartida de refresh. No se reporta ausencia general de esos mecanismos.
- La configuración observada es `wrangler.jsonc`, con SPA fallback y observabilidad. La referencia desactualizada a `wrangler.toml` en AGENTS no basta para afirmar que el despliegue falle.
- Se observaron posibles mejoras de microinteracción, copia, reducción de movimiento y manejo de cierres de modal; no se convierten en hallazgos sin completar evidencia del escenario.
- No se declara una falla jurídica por la etiqueta D-150 ni por tarifas fiscales a partir de memoria del modelo; la revisión de dominio/legal corresponde a la lente especializada.
- Se evita reportar una ausencia general de recuperación de contraseña como fallo independiente sin una spec/flujo de envío verificado en esta lente.

## Lectura por ejes

**Standards con soporte literal más claro:** FE-05 (entorno raíz), FE-13 (etiquetado accesible), FE-08 (comportamiento de planes) y FE-10 (estado durante envío, pauta web delegada). FE-01 aplica el principio local de aislamiento al almacenamiento cliente, interpretación señalada. **Spec:** FE-02 y FE-08 se contrastan con capacidades documentadas de producto, no con una issue específica. El resto se presenta como errores funcionales con escenario concreto, sin inventar una especificación.
