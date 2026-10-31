# Auditoría técnica de ContadorGanadero

Fecha: 2026-10-31, Costa Rica. HEAD: `2b501d5e4d98f2aaa00a56efdf2e64152199247a` más cambios locales.

**67 hallazgos: 37 altos y 30 medios.** No se certifica haber encontrado todos los errores posibles. El artefacto HTML permite buscar, filtrar y desplegar evidencia.

Se aplicaron code-review (separando Standards y Spec), el flujo de revisión con especialistas del Vibe Coding Toolkit y la matriz obligatoria de skills por dominio de AGENTS.md. El usuario pidió el proyecto completo: se adaptó el alcance al árbol de trabajo en vez de inventar una base de PR o una issue. Los errores sin requisito documental específico se presentan en un tercer eje Funcional. Se eliminaron duplicados y candidatos contradichos por middlewares o comportamiento vigente.

## Validación

- Backend final: 193/193 pruebas; 20 suites pasan.
- Frontend: 44/44 pruebas. ESLint: 0 errores, 0 avisos. Build correcto con aviso de chunk grande.
- Probes: [seguridad](probe-security.json) y [fiscales](probe-fiscal-results.json). Scripts reproducibles en la misma carpeta.
- Bun audit: 23 avisos en 10 paquetes; incluye desarrollo/transitivas, sin prueba de explotabilidad. [Salida completa](bun-audit.json).
- Cambios concurrentes y fuentes finales: [manifiesto](snapshot-final.json), [diferencias](cambios-concurrentes.json), [ZIP](fuentes-revisadas.zip).

## Standards

15 hallazgos.

### S-01 — ALTA — Historial del chat compartido entre cuentas

- **Área y ubicación:** Frontend; `frontend/src/components/dashboard/ChatBot.jsx:16`.
- **Escenario:** A usa chat y cierra sesión; B inicia sesión en el mismo navegador. Carga los mensajes de A y los adjunta a nuevas consultas.
- **Impacto:** Exposición de datos contables entre cuentas y mezcla de contexto.
- **Evidencia:** Clave global chatbot_mensajes_v1 en líneas 16 y 43-60; historial reenviado en 101-108; AuthContext.logout 95-100 no lo limpia.
- **Corrección propuesta:** Separar almacenamiento por usuario/tenant e invalidarlo al cambiar/cerrar sesión.
- **Regla/contrato:** AGENTS.md:87-88 y skill multitenant-onvo-billing, aislamiento por finca; aplicación explícitamente interpretada al almacenamiento cliente.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### S-02 — ALTA — D-150 queda accesible a planes sin módulo

- **Área y ubicación:** Hacienda y XML; `backend/routes/haciendaRoutes.js:63`.
- **Escenario:** **Escenario:** usuario autenticado de tenant free llama directamente a `/api/hacienda/d150/conciliacion` o a sus reportes. Las rutas solo atraviesan autenticación y extraerTenant; ningún controlador verifica el permiso del módulo. La eventual restricción visual no protege la API.
- **Impacto:** **Impacto/corrección:** evasión de licencia y acceso a cálculos/exportaciones premium. Aplicar el guard del módulo a todas las rutas D-150. Evidencia estática del flujo completo; no se llamó API real.
- **Evidencia:** ### S02 — ALTA — D-150 queda accesible a planes sin módulo

**Código:** `backend/routes/haciendaRoutes.js:63-66`; `backend/controllers/d150Controller.js:31-40`, `:45-52`.

**Regla:** `.agents/skills/rea-impuestos-cr/SKILL.md`, regla 4: D-150 exclusivo de pro y `limites.moduloD150 === true`.

**Escenario:** usuario autenticado de tenant free llama directamente a `/api/hacienda/d150/conciliacion` o a sus reportes. Las rutas solo atraviesan autenticación y extraerTenant; ningún controlador verifica el permiso del módulo. La eventual restricción visual no protege la API.

**Impacto/corrección:** evasión de licencia y acceso a cálculos/exportaciones premium. Aplicar el guard del módulo a todas las rutas D-150. Evidencia estática del flujo completo; no se llamó API real.


- **Corrección propuesta:** **Impacto/corrección:** evasión de licencia y acceso a cálculos/exportaciones premium. Aplicar el guard del módulo a todas las rutas D-150. Evidencia estática del flujo completo; no se llamó API real.
- **Regla/contrato:** **Regla:** `.agents/skills/rea-impuestos-cr/SKILL.md`, regla 4: D-150 exclusivo de pro y `limites.moduloD150 === true`.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### S-03 — ALTA — Se omite la cascada NVIDIA cuando falla Gemini

- **Área y ubicación:** IA contable; `backend/services/aiProvider.js:32`.
- **Escenario:** **Escenario:** proceso nuevo con ambas API keys; construir cliente Gemini funciona, pero su primera petición falla. `inicializarProveedores` retorna antes de construir `openAIClient`; el fallback NVIDIA encuentra `null`. Categorización baja directamente a heurística; chat unario lanza y streaming termina con error. **Probe:** constructor NVIDIA=0, llamadas NVIDIA=0 tras fallo simulado Gemini.
- **Impacto:** **Impacto/corrección:** pérdida de continuidad pese a proveedor secundario configurado. Inicializar ambos clientes o crear NVIDIA en el momento del fallback, conservando heurística para categorización.
- **Evidencia:** ### S01 — ALTA — Se omite la cascada NVIDIA cuando falla Gemini

**Código:** `backend/services/aiProvider.js:32`, `:126`, `:255`, `:324`.

**Regla:** `.agents/skills/rea-impuestos-cr/SKILL.md`, regla 5: orden estricto Gemini → NVIDIA NIM → heurística local.

**Escenario:** proceso nuevo con ambas API keys; construir cliente Gemini funciona, pero su primera petición falla. `inicializarProveedores` retorna antes de construir `openAIClient`; el fallback NVIDIA encuentra `null`. Categorización baja directamente a heurística; chat unario lanza y streaming termina con error. **Probe:** constructor NVIDIA=0, llamadas NVIDIA=0 tras fallo simulado Gemini.

**Impacto/corrección:** pérdida de continuidad pese a proveedor secundario configurado. Inicializar ambos clientes o crear NVIDIA en el momento del fallback, conservando heurística para categorización.


- **Corrección propuesta:** **Impacto/corrección:** pérdida de continuidad pese a proveedor secundario configurado. Inicializar ambos clientes o crear NVIDIA en el momento del fallback, conservando heurística para categorización.
- **Regla/contrato:** **Regla:** `.agents/skills/rea-impuestos-cr/SKILL.md`, regla 5: orden estricto Gemini → NVIDIA NIM → heurística local.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### S-04 — ALTA — IMAP escribe facturas sin tenant y usa primer usuario

- **Área y ubicación:** Ingesta; `backend/services/emailService.js:608`.
- **Escenario:** Worker/cron procesa buzón global pasando Usuario.findOne()._id sin contexto tenant.
- **Impacto:** Facturas quedan invisibles para lecturas tenant-scoped o fallan en modo estricto; receptor no se resuelve.
- **Evidencia:** emailService:608-617 y :553-562 no tenantId; worker:38-44; server:195-197,263-267; plugin no añade tenant sin contexto.
- **Corrección propuesta:** Converger IMAP en ingesta unificada resolviendo destinatario/contexto por XML.
- **Regla/contrato:** AGENTS arquitectura 2; multitenant-onvo-billing regla 1.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### S-05 — ALTA — Alias aproximados asignan facturas a fincas ambiguas

- **Área y ubicación:** Ingesta; `backend/services/ingestaFacturaService.js:71`.
- **Escenario:** Sin cédula resoluble, alias la-esperanza coincide por prefijo con dos fincas, o sufijo de cuatro hex coincide con otra.
- **Impacto:** Factura/PDF se escribe en tenant arbitrario.
- **Evidencia:** findOne por regex suffix :76 y prefix :84-86; unicidad solo de alias completo.
- **Corrección propuesta:** Alias exactos y mappings legacy únicos; mantener no asignado si ambiguo.
- **Regla/contrato:** AGENTS arquitectura 2; multitenant-onvo-billing regla 1.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### S-06 — ALTA — Un fallo de procesamiento ONVO convierte el reintento en duplicado descartado

- **Área y ubicación:** Planes y ONVO; `backend/controllers/onvoController.js:217`.
- **Escenario:** Se guarda SubscriptionEvent y falla tenant.save por un error transitorio; ONVO reenvía el mismo evento.
- **Impacto:** El primer envío devuelve 500, pero el siguiente devuelve duplicate:true sin aplicar el pago ni activar el plan. El evento queda sin procesar permanentemente.
- **Evidencia:** probe-security.json: first 500, retry duplicate:true y linkedSubscription:null. registrarSiNoExiste solo comprueba existencia, no procesado.
- **Corrección propuesta:** Distinguir eventos recibidos, reclamados, procesados y fallidos; reintentar de forma segura los pendientes con reclamación atómica.
- **Regla/contrato:** backend/models/SubscriptionEvent.js:91-103; .agents/skills/multitenant-onvo-billing/SKILL.md:35-37

### S-07 — ALTA — Migración tenant no reanuda backfill tras fallo parcial

- **Área y ubicación:** Respaldos y migraciones; `backend/scripts/migrateTenant.js:87`.
- **Escenario:** Fallo después de asignar usuario.tenantId y antes de terminar propagación.
- **Impacto:** Siguiente ejecución omite usuario y documentos quedan sin tenant, invisibles.
- **Evidencia:** Usuario actualizado :87-89 antes de propagación :93; main :106-112 selecciona solo sin tenant; filtro :42 excluye null.
- **Corrección propuesta:** Backfill reanudable para todos los usuarios con tenant, incluir null y checkpoints/transacciones.
- **Regla/contrato:** multitenant-onvo-billing regla 5: migraciones idempotentes.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### S-08 — ALTA — El certificado P12 se guarda sin el cifrado adicional por tenant disponible

- **Área y ubicación:** Seguridad y permisos; `backend/controllers/haciendaConfigController.js:107`.
- **Escenario:** El dueño guarda un certificadoP12Base64 en la configuración Hacienda. El controlador asigna directamente esa cadena al subdocumento.
- **Impacto:** El blob P12 original queda en base de datos sin la capa AES-256-GCM y AAD por tenant que sí se usa para PIN y contraseña. El cifrado propio del contenedor P12 no reemplaza la capa exigida por el proyecto.
- **Evidencia:** Asignación directa hc.certificadoP12Base64; Tenant no cifra ese campo en pre-save. Existe establecerCertificadoP12 pero no se llama; select:false solo limita consultas.
- **Corrección propuesta:** Usar el setter de cifrado del subdocumento y el getter correspondiente, con una migración comprobable de registros existentes y compatibilidad explícita de lectura.
- **Regla/contrato:** AGENTS.md arquitectura 5; backend/models/Tenant.js:124-140; .agents/skills/hacienda-cr-v44/SKILL.md

### S-09 — MEDIA — Vite no carga el .env raíz documentado

- **Área y ubicación:** Frontend; `frontend/vite.config.js:9`.
- **Escenario:** VITE_API_URL u otras VITE_* solo en .env raíz; build ejecutado desde frontend las ignora salvo inyección externa.
- **Impacto:** Staging puede usar API producción por fallback; anuncios/analítica no reciben configuración.
- **Evidencia:** Configuración sin envDir/loadEnv; package.json:10-11 entra a frontend; default envDir=root según Vite.
- **Corrección propuesta:** Definir envDir raíz y loadEnv para opciones config que lo necesiten; preservar exposición VITE_.
- **Regla/contrato:** AGENTS.md:43; https://vite.dev/config/shared-options.html#envdir. No se leyó .env.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### S-10 — MEDIA — Doble clic duplica ingresos en Declaraciones

- **Área y ubicación:** Frontend; `frontend/src/pages/DeclaracionesPage.jsx:608`.
- **Escenario:** Con red lenta pulsar Registrar Ingreso dos veces envía dos POST con mismo formulario.
- **Impacto:** Ingresos e importes contables duplicados.
- **Evidencia:** Handler 180-210 sin guard/envío pendiente; botón 608 sin disabled; ingresoController:31-59 crea en cada POST.
- **Corrección propuesta:** Guard y estado de operación pendiente; considerar idempotencia backend para reintentos.
- **Regla/contrato:** Pauta formularios web-design-guidelines: estado durante petición; contrato POST.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### S-11 — MEDIA — Etiquetas de inventario no nombran los controles

- **Área y ubicación:** Frontend; `frontend/src/components/inventario/BovinoForm.jsx:65`.
- **Escenario:** Lector de pantalla recorre formulario sin nombres accesibles; pulsar texto label no enfoca input.
- **Impacto:** Identificación de campos dificultada para tecnología asistiva.
- **Evidencia:** Labels hermanos sin htmlFor y controles sin id/aria-label; AvesForm:83, PecesForm:87, ColmenaForm:63 repiten patrón.
- **Corrección propuesta:** Asociar id/htmlFor o envolver controles; verificar nombre accesible.
- **Regla/contrato:** .agents/skills/web-design-guidelines/SKILL.md; https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### S-12 — MEDIA — Exportación y chat omiten datos de compañeros del tenant

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/declaracionService.js:18`.
- **Escenario:** **Escenario:** dos usuarios A/B pertenecen a la finca; A registra ingresos/facturas y B exporta o consulta chat. Aunque ambas funciones reciben tenantId, filtran por `usuario:B`. tenantPlugin agrega tenantId, pero conserva ese filtro: solo muestra los documentos creados por B, frente a impuestos/dashboard que sí usan el tenant completo.
- **Impacto:** **Impacto/corrección:** reportes fiscales parciales y respuestas distintas según miembro. Construir scope tenant cuando exista, con usuario solo como fallback legado. **No es una fuga entre tenants:** el plugin cubre el aislamiento; el error es exclusión de datos válidos.
- **Evidencia:** ### S03 — MEDIA — Exportación y chat omiten datos de compañeros del tenant

**Código:** `backend/services/declaracionService.js:18-41`; `backend/controllers/chatController.js:101-110`.

**Regla:** AGENTS.md, arquitectura crítica 2, y skill multitenant-onvo-billing, regla 1: datos por tenant y uso de alcance de tenant; `usuario` es compatibilidad heredada.

**Escenario:** dos usuarios A/B pertenecen a la finca; A registra ingresos/facturas y B exporta o consulta chat. Aunque ambas funciones reciben tenantId, filtran por `usuario:B`. tenantPlugin agrega tenantId, pero conserva ese filtro: solo muestra los documentos creados por B, frente a impuestos/dashboard que sí usan el tenant completo.

**Impacto/corrección:** reportes fiscales parciales y respuestas distintas según miembro. Construir scope tenant cuando exista, con usuario solo como fallback legado. **No es una fuga entre tenants:** el plugin cubre el aislamiento; el error es exclusión de datos válidos.

## Spec: requisitos documentados incompletos o incorrectos


- **Corrección propuesta:** **Impacto/corrección:** reportes fiscales parciales y respuestas distintas según miembro. Construir scope tenant cuando exista, con usuario solo como fallback legado. **No es una fuga entre tenants:** el plugin cubre el aislamiento; el error es exclusión de datos válidos.
- **Regla/contrato:** **Regla:** AGENTS.md, arquitectura crítica 2, y skill multitenant-onvo-billing, regla 1: datos por tenant y uso de alcance de tenant; `usuario` es compatibilidad heredada.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### S-13 — MEDIA — La exclusión de webhooks del limitador usa rutas con un prefijo ya retirado

- **Área y ubicación:** Infraestructura y entrega; `backend/middleware/rateLimiters.js:49`.
- **Escenario:** El limitador se monta en /api y recibe un webhook /api/webhooks/email después de consumir el cupo general de esa IP.
- **Impacto:** Express presenta req.path=/webhooks/email, pero skip compara /api/webhooks/. Los webhooks email/WhatsApp quedan sujetos al cupo general que la regla local exige excluir.
- **Evidencia:** backend/server.js:157 monta app.use('/api', apiLimiter); la condición skip usa el prefijo /api. ONVO se monta antes y no está afectado por este caso.
- **Corrección propuesta:** Comparar req.originalUrl de forma controlada o las rutas relativas al punto de montaje, y probar webhooks tras agotar la cuota general.
- **Regla/contrato:** AGENTS.md:117; backend/server.js:157; .agents/skills/multitenant-onvo-billing/SKILL.md

### S-14 — MEDIA — KPIs mezclan unidades admitidas por el esquema

- **Área y ubicación:** Inventario y costos; `backend/models/CostoProduccion.js:140`.
- **Escenario:** 2 sacos de 40 kg con 10 kg producción; o 30 huevos unidad con costos 10000.
- **Impacto:** FCA 0.2 en vez de 8; costo/cartón 0 en vez de 10000.
- **Evidencia:** Probes con modelo real validateSync sin error; suma cantidad sin unidad :140-142 e ignora unidad/docena :132-136.
- **Corrección propuesta:** Normalizar peso por presentación y convertir huevos/cartones, o restringir unidades.
- **Regla/contrato:** ingesta-facturas-agro-inventario: kg alimento/kg producción y costo por volumen; Inventario 30 huevos/cartón.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### S-15 — MEDIA — migrateNewCollections ignora --dry-run

- **Área y ubicación:** Respaldos y migraciones; `backend/utils/migrateNewCollections.js:30`.
- **Escenario:** Operador ejecuta script con --dry-run siguiendo regla global.
- **Impacto:** Se crean colecciones/índices y actualizan usuarios pese a simulación; primer usuario determina incorrectamente si hay backfill.
- **Evidencia:** Nunca lee argv; mutaciones :30,:41-55,:63-75; ejecución automática :87.
- **Corrección propuesta:** Separar simulación de aplicación y consultar todos los usuarios pendientes.
- **Regla/contrato:** AGENTS/skill multitenant-onvo-billing: toda migración soporta --dry-run.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

## Spec

10 hallazgos.

### P-01 — ALTA — Emisor vacío bloquea comprobantes Hacienda

- **Área y ubicación:** Frontend; `frontend/src/components/hacienda/EmitirComprobanteModal.jsx:53`.
- **Escenario:** Usuario autenticado completa FE/TE/FEC/REP; crear muestra Datos del emisor incompletos.
- **Impacto:** Emisión nativa bloqueada para sesiones normales.
- **Evidencia:** Modal lee localStorage.usuario, borrado por api.js:13 cada setAccessToken; no hay campos de emisor; validación 92-94 bloquea.
- **Corrección propuesta:** Usar sesión/configuración fiscal del tenant y mapear cédula; REP debe validar su propio contrato.
- **Regla/contrato:** AGENTS.md, capacidad Facturación Electrónica; skill hacienda-cr-v44. Incompatibilidad frontend confirmada.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### P-02 — ALTA — La firma llamada XAdES-EPES solo contiene XML-DSig

- **Área y ubicación:** Hacienda y XML; `backend/services/hacienda/signer.js:119`.
- **Escenario:** **Escenario:** pasar directamente un par PEM válido a `firmarXml`, una vez superado el fallo PKCS12 F02. Solo se añade referencia al documento y se llama `computeSignature`; no se construyen SignedProperties ni política. `DEFAULT_XADES_POLICY` se exporta pero nunca se usa. **Probe:** firma presente=true; SignedProperties=false; SignaturePolicy=false.
- **Impacto:** **Impacto/corrección:** la firma producida no satisface el perfil anunciado para emisión real. Implementar y verificar las propiedades y referencias XAdES requeridas, además de la firma matemática. No se afirma haber ejecutado validación sandbox ni que agregar solo esos nodos baste para certificar conformidad.
- **Evidencia:** ### P01 — ALTA — La firma llamada XAdES-EPES solo contiene XML-DSig

**Código:** `backend/services/hacienda/signer.js:119-146`.

**Spec:** `docs/PENDIENTES_HACIENDA.md:43-65`, bloque 2, requiere emisión real firmada y validación de aceptación; skill hacienda-cr-v44, regla 3, exige XAdES-EPES. El propio roadmap reconoce trabajo pendiente de firma.

**Escenario:** pasar directamente un par PEM válido a `firmarXml`, una vez superado el fallo PKCS12 F02. Solo se añade referencia al documento y se llama `computeSignature`; no se construyen SignedProperties ni política. `DEFAULT_XADES_POLICY` se exporta pero nunca se usa. **Probe:** firma presente=true; SignedProperties=false; SignaturePolicy=false.

**Impacto/corrección:** la firma producida no satisface el perfil anunciado para emisión real. Implementar y verificar las propiedades y referencias XAdES requeridas, además de la firma matemática. No se afirma haber ejecutado validación sandbox ni que agregar solo esos nodos baste para certificar conformidad.


- **Corrección propuesta:** **Impacto/corrección:** la firma producida no satisface el perfil anunciado para emisión real. Implementar y verificar las propiedades y referencias XAdES requeridas, además de la firma matemática. No se afirma haber ejecutado validación sandbox ni que agregar solo esos nodos baste para certificar conformidad.
- **Regla/contrato:** **Spec:** `docs/PENDIENTES_HACIENDA.md:43-65`, bloque 2, requiere emisión real firmada y validación de aceptación; skill hacienda-cr-v44, regla 3, exige XAdES-EPES. El propio roadmap reconoce trabajo pendiente de firma.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### P-03 — ALTA — No se conservan datos fiscales que el XML necesita

- **Área y ubicación:** Hacienda y XML; `backend/models/FacturaEmision.js:89`.
- **Escenario:** **Escenario:** guardar una factura con `codigoActividadEmisor` y `emisor.provincia/canton/distrito`, o configurar actividad en Tenant. El schema no declara esos campos y Mongoose los descarta; worker no aplica `cfg.codigoActividad` al documento antes del builder. El XML usa actividad `000000` y omite Ubicacion. **Probe:** actividad y provincia desaparecen tras crear instancia del modelo.
- **Impacto:** **Impacto/corrección:** incluso después de reparar tags, los documentos carecen de datos fiscales válidos. Persistir perfil/campos y obtenerlos del tenant al emitir; validar su completitud. No se está pidiendo un perfil nuevo por preferencia estética: la pérdida de datos existente es demostrable.
- **Evidencia:** ### P03 — ALTA — No se conservan datos fiscales que el XML necesita

**Código:** `backend/models/FacturaEmision.js:89-114`; `backend/services/haciendaWorker.js:107`; `backend/services/hacienda/xmlBuilder.js:196`, `:207-215`.

**Spec:** `docs/PENDIENTES_HACIENDA.md:27` y bloque 5: actividad y ubicación completas del emisor para la emisión real.

**Escenario:** guardar una factura con `codigoActividadEmisor` y `emisor.provincia/canton/distrito`, o configurar actividad en Tenant. El schema no declara esos campos y Mongoose los descarta; worker no aplica `cfg.codigoActividad` al documento antes del builder. El XML usa actividad `000000` y omite Ubicacion. **Probe:** actividad y provincia desaparecen tras crear instancia del modelo.

**Impacto/corrección:** incluso después de reparar tags, los documentos carecen de datos fiscales válidos. Persistir perfil/campos y obtenerlos del tenant al emitir; validar su completitud. No se está pidiendo un perfil nuevo por preferencia estética: la pérdida de datos existente es demostrable.

## Fallos funcionales y de contratos externos


- **Corrección propuesta:** **Impacto/corrección:** incluso después de reparar tags, los documentos carecen de datos fiscales válidos. Persistir perfil/campos y obtenerlos del tenant al emitir; validar su completitud. No se está pidiendo un perfil nuevo por preferencia estética: la pérdida de datos existente es demostrable.
- **Regla/contrato:** **Spec:** `docs/PENDIENTES_HACIENDA.md:27` y bloque 5: actividad y ubicación completas del emisor para la emisión real.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### P-04 — ALTA — WhatsApp anuncia fotos guardadas sin descargarlas

- **Área y ubicación:** Ingesta; `backend/routes/whatsappWebhookRoutes.js:185`.
- **Escenario:** Productor registrado envía foto de recibo.
- **Impacto:** El usuario cree tener un comprobante respaldado que el sistema descartó.
- **Evidencia:** Rama image :185-189 solo envía texto 'La hemos guardado'; no usa image.id ni almacenamiento.
- **Corrección propuesta:** Persistir imagen y tenant antes de confirmar, o comunicar exactamente que la función no está disponible.
- **Regla/contrato:** Mensaje de éxito del propio producto en whatsappWebhookRoutes.js:188.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### P-05 — ALTA — Cancelar Pro deja el plan Gratis bloqueado como tenant cancelado

- **Área y ubicación:** Planes y ONVO; `backend/controllers/onvoController.js:95`.
- **Escenario:** El dueño cancela una suscripción Pro activa y el controlador aplica plan free manteniendo estado cancelado.
- **Impacto:** El middleware de tenant responde 402 para perfil y operaciones, y la renovación de sesión también se deniega. La cuenta no puede usar el plan gratuito prometido.
- **Evidencia:** probe-security.json: plan free, estado cancelado y GET /api/auth/perfil HTTP 402 SUSCRIPCION_CANCELADA.
- **Corrección propuesta:** Separar el estado de la suscripción de pago de la disponibilidad de la finca gratuita y probar el acceso posterior a la cancelación.
- **Regla/contrato:** docs/SUSCRIPCIONES.md:35-37; backend/middleware/tenantGuard.js:49

### P-06 — ALTA — El CLI documentado de backup no ejecuta ninguna copia

- **Área y ubicación:** Respaldos y migraciones; `backend/scripts/backup-mongodb.js:80`.
- **Escenario:** Ejecutar node scripts/backup-mongodb.js --output-dir=./backups según RESPALDOS.md.
- **Impacto:** Termina sin respaldo y sin error que alerte a un cron.
- **Evidencia:** Solo exporta funciones, sin entrypoint, conexión, parseo argv ni consumidor de crearRespaldoCifrado. RESPALDOS.md:14-26 promete archivos.
- **Corrección propuesta:** Implementar CLI completo o wrapper documentado con códigos de salida y prueba aislada.
- **Regla/contrato:** RESPALDOS.md:14-26
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### P-07 — MEDIA — Plan global desactualizado después de pago/cancelación

- **Área y ubicación:** Frontend; `frontend/src/pages/PlanesPage.jsx:17`.
- **Escenario:** Pago confirma pro pero solo actualiza planActual; AuthContext conserva free y publicidad sigue visible. Cancelación produce inconsistencia inversa.
- **Impacto:** Plan pagado mantiene anuncios hasta recarga y contexto de cuenta obsoleto.
- **Evidencia:** PlanesPage:17-21,71-83; BillingPage:66-69; AdvertisingSlot.jsx:14-18 decide por useAuth.
- **Corrección propuesta:** Actualizar/invalidate estado único de tenant/sesión al confirmar cambio de plan.
- **Regla/contrato:** AGENTS.md descripción planes y skill multitenant-onvo-billing regla Planes Exclusivos.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### P-08 — MEDIA — El modelo impide tiquetes sin receptor

- **Área y ubicación:** Hacienda y XML; `backend/models/FacturaEmision.js:105`.
- **Escenario:** **Escenario:** `POST /api/hacienda/emision` con tipo TE y sin receptor. El controlador permite pasar esa ausencia, pero validación Mongoose exige `receptor.nombre` y `receptor.cedula.numero`. **Probe:** ambos errores requeridos. La ruta legacy también exige receptor antes del modelo.
- **Impacto:** **Impacto/corrección:** venta al consumidor no identificado no puede registrarse como tiquete. Hacer exigencia condicional por tipo y alinear ambos endpoints; conservar receptor opcional cuando sí se provea.
- **Evidencia:** ### P02 — MEDIA — El modelo impide tiquetes sin receptor

**Código:** `backend/models/FacturaEmision.js:105-114`; `backend/controllers/facturaEmisionController.js:39`.

**Spec:** skill hacienda-cr-v44, regla 2: receptor opcional para TE; roadmap `docs/PENDIENTES_HACIENDA.md:96` prevé builder TE sin receptor obligatorio.

**Escenario:** `POST /api/hacienda/emision` con tipo TE y sin receptor. El controlador permite pasar esa ausencia, pero validación Mongoose exige `receptor.nombre` y `receptor.cedula.numero`. **Probe:** ambos errores requeridos. La ruta legacy también exige receptor antes del modelo.

**Impacto/corrección:** venta al consumidor no identificado no puede registrarse como tiquete. Hacer exigencia condicional por tipo y alinear ambos endpoints; conservar receptor opcional cuando sí se provea.


- **Corrección propuesta:** **Impacto/corrección:** venta al consumidor no identificado no puede registrarse como tiquete. Hacer exigencia condicional por tipo y alinear ambos endpoints; conservar receptor opcional cuando sí se provea.
- **Regla/contrato:** **Spec:** skill hacienda-cr-v44, regla 2: receptor opcional para TE; roadmap `docs/PENDIENTES_HACIENDA.md:96` prevé builder TE sin receptor obligatorio.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### P-09 — MEDIA — Las cuotas mensuales de Gratis nunca se renuevan automáticamente

- **Área y ubicación:** Planes y ONVO; `backend/models/Tenant.js:295`.
- **Escenario:** Un tenant free agota tokens o conteos en un mes y entra al siguiente sin intervención de un administrador.
- **Impacto:** Permanece sin crédito: los guards no comparan periodoActual y solo ONVO o la acción manual del administrador llaman resetearConsumo.
- **Evidencia:** probe-security.json: tenant free activo con periodoActual 2020-01 y cuota agotada sigue sin crédito en 2026. No hay cron de cuotas en worker.js ni server.js.
- **Corrección propuesta:** Renovar el período y consumo mediante actualización atómica al inicio del mes o un trabajo programado idempotente.
- **Regla/contrato:** docs/SUSCRIPCIONES.md:15-16,91-93; backend/middleware/quotaGuard.js

### P-10 — MEDIA — Migración GCM busca campos inexistentes

- **Área y ubicación:** Respaldos y migraciones; `backend/scripts/migrateCryptoGcm.js:17`.
- **Escenario:** Tenant con secretos legacy reales configuracionHacienda.pinCertificado/passwordHacienda.
- **Impacto:** Script reporta cero cambios sin migrar secretos; no recorre configEmail.password del usuario.
- **Evidencia:** SECRET_FIELDS usa haciendaConfig.*Enc e imapConfig.passEnc; modelo real Tenant:39-59,226 y Usuario:189-195. Find omite select:false.
- **Corrección propuesta:** Rutas/modelos reales, selección explícita, AAD compatible y comprobación de lectura.
- **Regla/contrato:** Propósito declarado de migrateCryptoGcm.js:2-8.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

## Funcional

42 hallazgos.

### F-01 — ALTA — La eliminación de datos anuncia éxito incluso cuando falla o no existe la solicitud

- **Área y ubicación:** Cuenta y datos; `backend/controllers/dataDeletionController.js:256`.
- **Escenario:** La base de datos falla al borrar una cuenta o se consulta un código de eliminación inventado con formato válido.
- **Impacto:** La respuesta afirma completada aunque la cuenta sigue presente; un titular recibe información falsa sobre el borrado y no puede detectar el fallo.
- **Evidencia:** probe-security.json: deletion_failure_reported_completed mantiene userStillExists:true; nonexistent_deletion_status retorna HTTP 200, encontrada:true y completada.
- **Corrección propuesta:** Persistir el estado real pendiente/fallido/completado, propagar fallos parciales y devolver 404 para códigos inexistentes.
- **Regla/contrato:** backend/controllers/dataDeletionController.js:380-410; backend/controllers/dataDeletionController.js:536-548

### F-02 — ALTA — Login no completa MFA

- **Área y ubicación:** Frontend; `frontend/src/pages/LoginPage.jsx:112`.
- **Escenario:** Cuenta con MFA devuelve mfaRequired; la página navega al panel sin sesión y el guard la devuelve al login.
- **Impacto:** Cuenta con MFA no puede acceder desde la interfaz.
- **Evidencia:** AuthContext.jsx:53-56 devuelve desafío sin sesión; backend authController.js:334-346 lo exige; LoginPage no recoge TOTP ni maneja el resultado.
- **Corrección propuesta:** Agregar estado de desafío y formulario TOTP/recuperación; navegar solo al obtener sesión.
- **Regla/contrato:** Contrato de authController y AuthContext. Sin spec local particular de MFA.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### F-03 — ALTA — Paginación ignorada trunca resúmenes y listados

- **Área y ubicación:** Frontend; `frontend/src/pages/GastosPage.jsx:18`.
- **Escenario:** Más de 100 facturas: limit=500 es limitado a 100; Gastos suma ese lote como total y Calendario filtra meses tras truncar.
- **Impacto:** Totales financieros incompletos y documentos antiguos inaccesibles.
- **Evidencia:** facturaController.js:23-30 limita 100 y devuelve totalPaginas; GastosPage:35-46 agrega cliente; CalendarioPage:17-23. Listas Facturas/Ingresos usan 50 y Facturación/Hacienda 20 sin paginación.
- **Corrección propuesta:** Agregados completos en backend, filtro calendario antes de paginar y controles/metadatos de paginación.
- **Regla/contrato:** Contrato backend de listados. Sin spec detallada; UI afirma todas tus facturas.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### F-04 — ALTA — Credenciales Hacienda de todos los tenants se leen desde el objeto equivocado

- **Área y ubicación:** Hacienda y XML; `backend/services/haciendaWorker.js:33`.
- **Escenario:** **Escenario:** tenant tiene los cuatro campos configurados. `getTenantConfig` busca `tenant.obtenerPinCertificado` y `tenant.obtenerPasswordHacienda`, pero son métodos de `tenant.configuracionHacienda`; el método de certificado real se llama `obtenerCertificadoP12` y tampoco se invoca. **Probe:** `estaConfigurado=true`, pin=null y password=null.
- **Impacto:** **Impacto:** `prepararYFirmar` lanza “No hay certificado configurado” y OAuth no obtiene contraseña; conexión de tenants reales bloqueada independientemente de tener credenciales correctas. **Corrección:** usar getters del subdocumento y su nombre real; separar certificado cifrado de su representación decodificada.
- **Evidencia:** ### F01 — ALTA — Credenciales Hacienda de todos los tenants se leen desde el objeto equivocado

**Código:** `backend/services/haciendaWorker.js:33-44`; contrato en `backend/models/Tenant.js:94-129`.

**Escenario:** tenant tiene los cuatro campos configurados. `getTenantConfig` busca `tenant.obtenerPinCertificado` y `tenant.obtenerPasswordHacienda`, pero son métodos de `tenant.configuracionHacienda`; el método de certificado real se llama `obtenerCertificadoP12` y tampoco se invoca. **Probe:** `estaConfigurado=true`, pin=null y password=null.

**Impacto:** `prepararYFirmar` lanza “No hay certificado configurado” y OAuth no obtiene contraseña; conexión de tenants reales bloqueada independientemente de tener credenciales correctas. **Corrección:** usar getters del subdocumento y su nombre real; separar certificado cifrado de su representación decodificada.


- **Corrección propuesta:** **Impacto:** `prepararYFirmar` lanza “No hay certificado configurado” y OAuth no obtiene contraseña; conexión de tenants reales bloqueada independientemente de tener credenciales correctas. **Corrección:** usar getters del subdocumento y su nombre real; separar certificado cifrado de su representación decodificada.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-05 — ALTA — Un PKCS12 válido provoca TypeError antes de firmar

- **Área y ubicación:** Hacienda y XML; `backend/services/hacienda/signer.js:42`.
- **Escenario:** **Escenario:** `cargarLlaveDesdeBase64` con PKCS12 sintético válido y PIN correcto. El `for (const item of bag.bags)` falla y los fallbacks repiten `.bags`. **Probe:** `bag.bags is not iterable`.
- **Impacto:** **Impacto/corrección:** cualquier firma no mock que llegue al lector falla. Recorrer safeBags o API getBags y elegir certificado correspondiente a la llave. No requiere Hacienda ni certificado del usuario para reproducir.
- **Evidencia:** ### F02 — ALTA — Un PKCS12 válido provoca TypeError antes de firmar

**Código:** `backend/services/hacienda/signer.js:42-53`.

**Contrato:** node-forge instalado, `backend/node_modules/node-forge/lib/pkcs12.js:568`, expone `safeContents[].safeBags`, no `.bags`.

**Escenario:** `cargarLlaveDesdeBase64` con PKCS12 sintético válido y PIN correcto. El `for (const item of bag.bags)` falla y los fallbacks repiten `.bags`. **Probe:** `bag.bags is not iterable`.

**Impacto/corrección:** cualquier firma no mock que llegue al lector falla. Recorrer safeBags o API getBags y elegir certificado correspondiente a la llave. No requiere Hacienda ni certificado del usuario para reproducir.


- **Corrección propuesta:** **Impacto/corrección:** cualquier firma no mock que llegue al lector falla. Recorrer safeBags o API getBags y elegir certificado correspondiente a la llave. No requiere Hacienda ni certificado del usuario para reproducir.
- **Regla/contrato:** **Contrato:** node-forge instalado, `backend/node_modules/node-forge/lib/pkcs12.js:568`, expone `safeContents[].safeBags`, no `.bags`.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-06 — ALTA — El builder no genera estructura v4.4 conforme al contrato externo

- **Área y ubicación:** Hacienda y XML; `backend/services/hacienda/xmlBuilder.js:14`.
- **Escenario:** **Escenario:** crear cualquier FE normal. El XML declara `/xml/v4.4/`, usa `<CodigoActividad>`, ubica CABYS dentro de `<Codigo><Tipo>04`, y escribe `<CodigoTarifa>`; estas estructuras difieren del esquema oficial enlazado arriba. Reutiliza el cuerpo genérico para todos los tipos. **Probe:** namespace erróneo y ausencia de CodigoCABYS.
- **Impacto:** **Impacto/corrección:** incompatibilidad estructural para sandbox/producción; el mock local no valida schema y la oculta. Rehacer por XSD oficial y validar fixtures de cada tipo antes de firmar. Conflicto con documentación local, no un incumplimiento del programador al seguirla. No se ejecutó validador XSD externo; la evidencia es comparación de campos/namespace.
- **Evidencia:** ### F03 — ALTA — El builder no genera estructura v4.4 conforme al contrato externo

**Código:** `backend/services/hacienda/xmlBuilder.js:14-39`, `:86-90`, `:110`, `:196`, `:241-250`.

**Escenario:** crear cualquier FE normal. El XML declara `/xml/v4.4/`, usa `<CodigoActividad>`, ubica CABYS dentro de `<Codigo><Tipo>04`, y escribe `<CodigoTarifa>`; estas estructuras difieren del esquema oficial enlazado arriba. Reutiliza el cuerpo genérico para todos los tipos. **Probe:** namespace erróneo y ausencia de CodigoCABYS.

**Impacto/corrección:** incompatibilidad estructural para sandbox/producción; el mock local no valida schema y la oculta. Rehacer por XSD oficial y validar fixtures de cada tipo antes de firmar. Conflicto con documentación local, no un incumplimiento del programador al seguirla. No se ejecutó validador XSD externo; la evidencia es comparación de campos/namespace.


- **Corrección propuesta:** **Impacto/corrección:** incompatibilidad estructural para sandbox/producción; el mock local no valida schema y la oculta. Rehacer por XSD oficial y validar fixtures de cada tipo antes de firmar. Conflicto con documentación local, no un incumplimiento del programador al seguirla. No se ejecutó validador XSD externo; la evidencia es comparación de campos/namespace.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-07 — ALTA — Tipos y situación de la clave numérica son incorrectos

- **Área y ubicación:** Hacienda y XML; `backend/services/hacienda/clave50.js:20`.
- **Escenario:** **Escenario:** FEC genera tipo 05 y REP tipo 06; TE/ND también están intercambiados respecto al catálogo oficial. Además, los últimos nueve dígitos son todos aleatorios: la posición reservada a situación puede valer 4–9. **Probe:** FEC=05 y situación=9 usando seguridad 987654321. El parser de fallback presenta otro catálogo incompatible (FEC05/FEE06/REP07).
- **Impacto:** **Impacto/corrección:** clave de longitud válida pero semántica inválida. Centralizar catálogo oficial y generar situación explícita más ocho dígitos de seguridad. Deben corregirse también skills/docs y fixtures que repiten estos códigos; el número de dígitos por sí solo no prueba validez.
- **Evidencia:** ### F04 — ALTA — Tipos y situación de la clave numérica son incorrectos

**Código:** `backend/services/hacienda/clave50.js:20-26`, `:78-83`; detección legacy `backend/services/xmlParserService.js:285-292`.

**Escenario:** FEC genera tipo 05 y REP tipo 06; TE/ND también están intercambiados respecto al catálogo oficial. Además, los últimos nueve dígitos son todos aleatorios: la posición reservada a situación puede valer 4–9. **Probe:** FEC=05 y situación=9 usando seguridad 987654321. El parser de fallback presenta otro catálogo incompatible (FEC05/FEE06/REP07).

**Impacto/corrección:** clave de longitud válida pero semántica inválida. Centralizar catálogo oficial y generar situación explícita más ocho dígitos de seguridad. Deben corregirse también skills/docs y fixtures que repiten estos códigos; el número de dígitos por sí solo no prueba validez.


- **Corrección propuesta:** **Impacto/corrección:** clave de longitud válida pero semántica inválida. Centralizar catálogo oficial y generar situación explícita más ocho dígitos de seguridad. Deben corregirse también skills/docs y fixtures que repiten estos códigos; el número de dígitos por sí solo no prueba validez.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-08 — ALTA — Consulta de estado ignora el nombre oficial del campo y pierde el XML respuesta

- **Área y ubicación:** Hacienda y XML; `backend/services/hacienda/recepcion.js:198`.
- **Escenario:** **Escenario:** Hacienda retorna HTTP200 con `ind-estado:aceptado` o rechazado. Se lee `data.indEstado`, por lo que se devuelve procesando. Tampoco se decodifica respuesta-xml. Worker intenta guardar `respuestaHacienda.xml`, campo inexistente; el schema tiene `xmlRespuestaHacienda` en raíz. **Probe:** aceptación oficial simulada retorna procesando.
- **Impacto:** **Impacto/corrección:** facturas nunca llegan a estado terminal real y falta comprobante de aceptación/rechazo. Leer campos del contrato, decodificar XML y persistir en el campo declarado; conservar detalle del rechazo. El fallback de URL de auth también omite `/recepcion/` antes de la clave si no hay Location: revisar ese caso junto al contrato.
- **Evidencia:** ### F05 — ALTA — Consulta de estado ignora el nombre oficial del campo y pierde el XML respuesta

**Código:** `backend/services/hacienda/recepcion.js:198-204`; `backend/services/haciendaWorker.js:283-297`; schema `backend/models/FacturaEmision.js:178-190`.

**Escenario:** Hacienda retorna HTTP200 con `ind-estado:aceptado` o rechazado. Se lee `data.indEstado`, por lo que se devuelve procesando. Tampoco se decodifica respuesta-xml. Worker intenta guardar `respuestaHacienda.xml`, campo inexistente; el schema tiene `xmlRespuestaHacienda` en raíz. **Probe:** aceptación oficial simulada retorna procesando.

**Impacto/corrección:** facturas nunca llegan a estado terminal real y falta comprobante de aceptación/rechazo. Leer campos del contrato, decodificar XML y persistir en el campo declarado; conservar detalle del rechazo. El fallback de URL de auth también omite `/recepcion/` antes de la clave si no hay Location: revisar ese caso junto al contrato.


- **Corrección propuesta:** **Impacto/corrección:** facturas nunca llegan a estado terminal real y falta comprobante de aceptación/rechazo. Leer campos del contrato, decodificar XML y persistir en el campo declarado; conservar detalle del rechazo. El fallback de URL de auth también omite `/recepcion/` antes de la clave si no hay Location: revisar ese caso junto al contrato.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-09 — ALTA — Importes emitidos son incoherentes con tarifa, descuentos y etiquetas XML

- **Área y ubicación:** Hacienda y XML; `backend/models/FacturaEmision.js:235`.
- **Escenario:** **Escenarios:** (a) línea de 1000 con tarifa13 sin factorIVA: el default .01 calcula IVA10; (b) línea1000, descuento100, factor.01: grava1000, no subtotal900; (c) montoTotal del modelo incluye descuento e IVA y el builder lo usa a la vez para MontoTotal y MontoTotalLinea. **Probe combinado:** tarifa13, subtotal1000, descuento100, IVA10, total910, XML MontoTotal=910 y SubTotal=1000.
- **Impacto:** **Impacto/corrección:** importes incorrectos e identidades aritméticas rotas en XML y conciliación. Definir una única derivación de base bruta, descuento, base neta, tarifa, exoneración, impuesto neto y total; usar el campo adecuado en cada tag y rechazar inputs incompatibles. Son fallos de aritmética interna, sin depender de asesoría fiscal.
- **Evidencia:** ### F06 — ALTA — Importes emitidos son incoherentes con tarifa, descuentos y etiquetas XML

**Código:** `backend/models/FacturaEmision.js:235-243`; `backend/services/hacienda/xmlBuilder.js:81`, `:95`, `:129`.

**Escenarios:** (a) línea de 1000 con tarifa13 sin factorIVA: el default .01 calcula IVA10; (b) línea1000, descuento100, factor.01: grava1000, no subtotal900; (c) montoTotal del modelo incluye descuento e IVA y el builder lo usa a la vez para MontoTotal y MontoTotalLinea. **Probe combinado:** tarifa13, subtotal1000, descuento100, IVA10, total910, XML MontoTotal=910 y SubTotal=1000.

**Impacto/corrección:** importes incorrectos e identidades aritméticas rotas en XML y conciliación. Definir una única derivación de base bruta, descuento, base neta, tarifa, exoneración, impuesto neto y total; usar el campo adecuado en cada tag y rechazar inputs incompatibles. Son fallos de aritmética interna, sin depender de asesoría fiscal.


- **Corrección propuesta:** **Impacto/corrección:** importes incorrectos e identidades aritméticas rotas en XML y conciliación. Definir una única derivación de base bruta, descuento, base neta, tarifa, exoneración, impuesto neto y total; usar el campo adecuado en cada tag y rechazar inputs incompatibles. Son fallos de aritmética interna, sin depender de asesoría fiscal.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-10 — ALTA — Las ventas de FacturaEmision no alimentan IVA, renta ni exportación general

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/impuestoService.js:6`.
- **Escenario:** **Escenario:** única venta: FE aceptada de base100000 e IVA1000; no existe registro manual en Ingreso. Los cálculos leen exclusivamente Ingreso y arrojan ventas/IVA0. Los flujos de creación/aceptación de Hacienda no crean Ingreso; solo D150 consulta ambas fuentes y deduplica por clave.
- **Impacto:** **Impacto/corrección:** renta, IVA, dashboard y exportación omiten ventas que la propia aplicación emitió. Integrar ambas fuentes con deduplicación o materializar asiento/Ingreso idempotente al aceptar. No duplicar al usuario que ya registró manualmente la misma clave.
- **Evidencia:** ### F08 — ALTA — Las ventas de FacturaEmision no alimentan IVA, renta ni exportación general

**Código:** `backend/services/impuestoService.js:6-8`, `:35-38`, `:113-120`; `backend/services/declaracionService.js:30-41`.

**Escenario:** única venta: FE aceptada de base100000 e IVA1000; no existe registro manual en Ingreso. Los cálculos leen exclusivamente Ingreso y arrojan ventas/IVA0. Los flujos de creación/aceptación de Hacienda no crean Ingreso; solo D150 consulta ambas fuentes y deduplica por clave.

**Impacto/corrección:** renta, IVA, dashboard y exportación omiten ventas que la propia aplicación emitió. Integrar ambas fuentes con deduplicación o materializar asiento/Ingreso idempotente al aceptar. No duplicar al usuario que ya registró manualmente la misma clave.


- **Corrección propuesta:** **Impacto/corrección:** renta, IVA, dashboard y exportación omiten ventas que la propia aplicación emitió. Integrar ambas fuentes con deduplicación o materializar asiento/Ingreso idempotente al aceptar. No duplicar al usuario que ya registró manualmente la misma clave.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-11 — ALTA — Montos de facturas USD se suman como CRC

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/impuestoService.js:47`.
- **Escenario:** **Escenario:** factura USD100 + IVA13, tipoCambio500. Reportes suman 100/13/113 y los presentan en colones en vez de 50000/6500/56500. **Probe:** resultado IVA pagado13 y gastos113, a pesar de monedaUSD y tipoCambio500.
- **Impacto:** **Impacto/corrección:** subvaloración por factor de cambio de gastos/crédito y mezcla de unidades. Normalizar montos CRC una sola vez con trazabilidad al tipo de cambio del comprobante; conservar moneda original para mostrarla.
- **Evidencia:** ### F09 — ALTA — Montos de facturas USD se suman como CRC

**Código:** `backend/services/impuestoService.js:47-56`, `:128-134`; `backend/services/d150Service.js:174-177`; `backend/services/declaracionService.js:44-47`; `backend/controllers/dashboardController.js:29-31`.

**Contrato interno:** parser `xmlParserService.js:146-147` y Factura guardan moneda/tipoCambio, sin conversión previa de los importes.

**Escenario:** factura USD100 + IVA13, tipoCambio500. Reportes suman 100/13/113 y los presentan en colones en vez de 50000/6500/56500. **Probe:** resultado IVA pagado13 y gastos113, a pesar de monedaUSD y tipoCambio500.

**Impacto/corrección:** subvaloración por factor de cambio de gastos/crédito y mezcla de unidades. Normalizar montos CRC una sola vez con trazabilidad al tipo de cambio del comprobante; conservar moneda original para mostrarla.


- **Corrección propuesta:** **Impacto/corrección:** subvaloración por factor de cambio de gastos/crédito y mezcla de unidades. Normalizar montos CRC una sola vez con trazabilidad al tipo de cambio del comprobante; conservar moneda original para mostrarla.
- **Regla/contrato:** **Contrato interno:** parser `xmlParserService.js:146-147` y Factura guardan moneda/tipoCambio, sin conversión previa de los importes.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-12 — ALTA — Notas de crédito recibidas aumentan compras e IVA en lugar de reducirlos

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/impuestoService.js:45`.
- **Escenario:** **Escenario:** compra de100 + IVA13 totalmente anulada por NC recibida con los mismos importes. Ambas se suman, dejando base200/IVA26 en vez de0. **Probe:** NC aislada produce crédito positivo13 en IVA y D150.
- **Impacto:** **Impacto/corrección:** gastos y crédito inflados, renta/IVA subestimados. Normalizar signo por tipo de documento en todas las fuentes y reflejarlo también en exportaciones y dashboard.
- **Evidencia:** ### F10 — ALTA — Notas de crédito recibidas aumentan compras e IVA en lugar de reducirlos

**Código:** `backend/services/impuestoService.js:45-57`, `:128-134`; `backend/services/d150Service.js:161-190`; `backend/services/declaracionService.js:44-80`.

**Contrato:** parser reconoce Nota de Crédito (`xmlParserService.js:276`) y mantiene sus importes positivos; D150 aplica signo negativo solo a NC emitidas (`:130-136`).

**Escenario:** compra de100 + IVA13 totalmente anulada por NC recibida con los mismos importes. Ambas se suman, dejando base200/IVA26 en vez de0. **Probe:** NC aislada produce crédito positivo13 en IVA y D150.

**Impacto/corrección:** gastos y crédito inflados, renta/IVA subestimados. Normalizar signo por tipo de documento en todas las fuentes y reflejarlo también en exportaciones y dashboard.


- **Corrección propuesta:** **Impacto/corrección:** gastos y crédito inflados, renta/IVA subestimados. Normalizar signo por tipo de documento en todas las fuentes y reflejarlo también en exportaciones y dashboard.
- **Regla/contrato:** **Contrato:** parser reconoce Nota de Crédito (`xmlParserService.js:276`) y mantiene sus importes positivos; D150 aplica signo negativo solo a NC emitidas (`:130-136`).
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-13 — ALTA — La renta y exportación deducen precio bruto anterior al descuento

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/impuestoService.js:132`.
- **Escenario:** **Escenario:** factura con TotalVenta1000, TotalDescuentos200, TotalVentaNeta800. `gastosDeducibles` y subtotal exportado toman1000. El parser mantiene por separado ambos totales (`xmlParserService.js:488-490`), por lo que no hay compensación previa.
- **Impacto:** **Impacto/corrección:** deducción superior al gasto neto y discrepancias con D150, cuyo fallback sí prefiere TotalVentaNeta. Usar base neta correcta, respetando cero válido con `??` en vez de `||`; decidir tratamiento de impuestos/cargos fuera de la base con requisito fiscal explícito.
- **Evidencia:** ### F11 — ALTA — La renta y exportación deducen precio bruto anterior al descuento

**Código:** `backend/services/impuestoService.js:132-134`; `backend/services/declaracionService.js:45`.

**Escenario:** factura con TotalVenta1000, TotalDescuentos200, TotalVentaNeta800. `gastosDeducibles` y subtotal exportado toman1000. El parser mantiene por separado ambos totales (`xmlParserService.js:488-490`), por lo que no hay compensación previa.

**Impacto/corrección:** deducción superior al gasto neto y discrepancias con D150, cuyo fallback sí prefiere TotalVentaNeta. Usar base neta correcta, respetando cero válido con `??` en vez de `||`; decidir tratamiento de impuestos/cargos fuera de la base con requisito fiscal explícito.


- **Corrección propuesta:** **Impacto/corrección:** deducción superior al gasto neto y discrepancias con D150, cuyo fallback sí prefiere TotalVentaNeta. Usar base neta correcta, respetando cero válido con `??` en vez de `||`; decidir tratamiento de impuestos/cargos fuera de la base con requisito fiscal explícito.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-14 — ALTA — Conciliación acredita impuesto bruto aunque exista exoneración

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/d150Service.js:174`.
- **Escenario:** **Escenario:** factura recibida deducible tiene impuesto.monto130, exoneracion.montoExoneracion130 e impuestoNeto0, totalImpuesto0. D150 suma130 como impuesto soportado porque ignora impuestoNeto y exoneración. El parser sí preserva impuestoNeto y exoneración por línea.
- **Impacto:** **Impacto/corrección:** crédito que no se pagó e inconsistencia con resumen del comprobante. Usar impuesto neto acreditable y respetar explícitamente el cero. La prueba combinada incluye una línea con impuestoNeto0 y confirma que la suma actual usa monto13; validar además fixtures de exoneración real al corregir.
- **Evidencia:** ### F12 — ALTA — Conciliación acredita impuesto bruto aunque exista exoneración

**Código:** `backend/services/d150Service.js:174-177` y `:155-156`.

**Escenario:** factura recibida deducible tiene impuesto.monto130, exoneracion.montoExoneracion130 e impuestoNeto0, totalImpuesto0. D150 suma130 como impuesto soportado porque ignora impuestoNeto y exoneración. El parser sí preserva impuestoNeto y exoneración por línea.

**Impacto/corrección:** crédito que no se pagó e inconsistencia con resumen del comprobante. Usar impuesto neto acreditable y respetar explícitamente el cero. La prueba combinada incluye una línea con impuestoNeto0 y confirma que la suma actual usa monto13; validar además fixtures de exoneración real al corregir.


- **Corrección propuesta:** **Impacto/corrección:** crédito que no se pagó e inconsistencia con resumen del comprobante. Usar impuesto neto acreditable y respetar explícitamente el cero. La prueba combinada incluye una línea con impuestoNeto0 y confirma que la suma actual usa monto13; validar además fixtures de exoneración real al corregir.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-15 — ALTA — Sanitización CSV se salta cuando la celda contiene separadores

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/declaracionService.js:862`.
- **Escenario:** **Escenario:** nombre del proveedor o descripción comienza con `=SUM(1,2)` (o fórmula equivalente con comillas). escapeCsv detecta coma y retorna la cadena entrecomillada antes de sanitizarFormulaExcel. **Probe:** exporta celda `"=SUM(1,2)"`, sin apóstrofo protector; comillas CSV no neutralizan evaluación en la hoja de cálculo.
- **Impacto:** **Impacto/corrección:** contenido de factura importada puede convertirse en fórmula al abrir exportación. Sanitizar contenido antes de escapar comillas/separadores, manteniendo protección especial de identificadores. No se ejecutó ninguna fórmula ni Excel; no se afirma que toda instalación ejecute enlaces externos automáticamente.
- **Evidencia:** ### F17 — ALTA — Sanitización CSV se salta cuando la celda contiene separadores

**Código:** `backend/services/declaracionService.js:862-865`.

**Escenario:** nombre del proveedor o descripción comienza con `=SUM(1,2)` (o fórmula equivalente con comillas). escapeCsv detecta coma y retorna la cadena entrecomillada antes de sanitizarFormulaExcel. **Probe:** exporta celda `"=SUM(1,2)"`, sin apóstrofo protector; comillas CSV no neutralizan evaluación en la hoja de cálculo.

**Impacto/corrección:** contenido de factura importada puede convertirse en fórmula al abrir exportación. Sanitizar contenido antes de escapar comillas/separadores, manteniendo protección especial de identificadores. No se ejecutó ninguna fórmula ni Excel; no se afirma que toda instalación ejecute enlaces externos automáticamente.


- **Corrección propuesta:** **Impacto/corrección:** contenido de factura importada puede convertirse en fórmula al abrir exportación. Sanitizar contenido antes de escapar comillas/separadores, manteniendo protección especial de identificadores. No se ejecutó ninguna fórmula ni Excel; no se afirma que toda instalación ejecute enlaces externos automáticamente.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-16 — ALTA — Email confirma resultados parciales y pierde reintentos

- **Área y ubicación:** Ingesta; `backend/routes/emailWebhookRoutes.js:219`.
- **Escenario:** Correo con dos XML: primero guardado y segundo falla transitoriamente.
- **Impacto:** 207 aceptado por Worker cierra entrega sin cola ni recuperación del XML fallido; si todos fallan devuelve 422 no reintentable.
- **Evidencia:** Catch por XML :196-198; clasificación :219; Worker:44-65 acepta todo response.ok y :69 solo reintenta 429/5xx.
- **Corrección propuesta:** Persistir pendientes y clasificar fallos transitorios; reintentos idempotentes antes de completar entrega.
- **Regla/contrato:** Funcional sin spec adicional; contrato cruzado ruta/Worker.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-17 — ALTA — WhatsApp responde éxito antes de persistir el evento

- **Área y ubicación:** Ingesta; `backend/routes/whatsappWebhookRoutes.js:85`.
- **Escenario:** Reinicio o fallo de descarga/DB después del 200 antes de guardar factura.
- **Impacto:** Comprobante no guardado y sin evento durable para recuperación.
- **Evidencia:** 200 en :85; resolución/descarga/ingesta posteriores :109-136; catches solo log/respuesta al usuario.
- **Corrección propuesta:** Guardar evento idempotente message.id en cola durable antes del 200 y procesar con reintentos.
- **Regla/contrato:** Funcional sin spec adicional; no se afirma plazo de retry Meta.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-18 — ALTA — ZIP descomprime por completo antes de aplicar tamaño máximo

- **Área y ubicación:** Ingesta; `backend/routes/emailWebhookRoutes.js:91`.
- **Escenario:** Email bajo 10 MiB contiene ZIP altamente compresible con XML/PDF de cientos de MiB.
- **Impacto:** Asignaciones de memoria no acotadas pueden agotar API al recibir adjuntos externos.
- **Evidencia:** zipEntry.async materializa texto/buffer en :91/:96 antes del control :92/:97.
- **Corrección propuesta:** Descompresión streaming con límites por entrada y total durante lectura.
- **Regla/contrato:** Funcional/seguridad sin spec adicional; límites declarados en ruta y Worker.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-19 — ALTA — La restauración convierte ObjectId y Date a strings

- **Área y ubicación:** Respaldos y migraciones; `backend/scripts/restore-mongodb.js:25`.
- **Escenario:** Restaurar un dump creado por backup-mongodb con referencias ObjectId y fechas Date.
- **Impacto:** Se borran las colecciones y se reinsertan strings; búsquedas Mongoose por identidad, tenant y fechas dejan de coincidir.
- **Evidencia:** backup-mongodb.js:60 JSON.stringify; restore:25 JSON.parse y :38-40 driver nativo. Probe puro confirmó ObjectId/ObjectId/Date -> string/string/string.
- **Corrección propuesta:** Formato BSON o EJSON canónico versionado, roundtrip de tipos y validación antes del reemplazo.
- **Regla/contrato:** Funcional sin spec adicional; contrato de respaldo. https://www.mongodb.com/docs/drivers/node/current/data-formats/extended-json/
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-20 — ALTA — Los permisos por rol están definidos pero no se aplican a las rutas de negocio

- **Área y ubicación:** Seguridad y permisos; `backend/routes/facturaRoutes.js:47`.
- **Escenario:** Un miembro peon del mismo tenant invoca DELETE /api/facturas/:id sobre una factura creada por el dueño.
- **Impacto:** Borrado y acceso contable fuera de los permisos documentados; las rutas de configuración Hacienda tampoco aplican el permiso exclusivo del dueño.
- **Evidencia:** probe-security.json: peon_delete_owner_factura devuelve HTTP 200 y deleted:true. rbacMiddleware define facturas:eliminar para dueño/admin, pero permitir no se importa en las rutas de negocio.
- **Corrección propuesta:** Montar permitir(accion) en cada operación protegida y comprobar lectura, escritura, exportación y configuración de certificados con todos los roles.
- **Regla/contrato:** backend/middleware/rbacMiddleware.js:16-40; backend/routes/haciendaConfigRoutes.js

### F-21 — ALTA — Reiniciar la configuración MFA desactiva el segundo factor sin reautenticar

- **Área y ubicación:** Seguridad y permisos; `backend/controllers/authController.js:918`.
- **Escenario:** Una sesión válida, incluso un access token robado, llama POST /api/auth/mfa/setup sobre una cuenta con MFA activo, sin contraseña ni TOTP.
- **Impacto:** MFA queda desactivado y el secreto se sustituye; se elude la confirmación exigida por /mfa/disable.
- **Evidencia:** probe-security.json: HTTP 200, enabled:false y devuelve un secreto nuevo.
- **Corrección propuesta:** Separar el secreto pendiente del activo y exigir reautenticación para sustituir o desactivar MFA ya configurado.
- **Regla/contrato:** backend/controllers/authController.js:988-1008

### F-22 — ALTA — El acceso con Google omite el MFA habilitado en la cuenta

- **Área y ubicación:** Seguridad y permisos; `backend/controllers/googleAuthController.js:173`.
- **Escenario:** Una cuenta asociada a Google activa MFA de la aplicación y vuelve a entrar mediante OAuth; el callback emite refresh cookie sin TOTP.
- **Impacto:** La protección MFA de la aplicación se puede evitar por una vía de autenticación alternativa; REQUIRE_ADMIN_MFA comprueba enabled, no que se haya completado el factor en la sesión.
- **Evidencia:** probe-security.json: con proveedor OAuth simulado y mfa.enabled=true, issuedRefreshCookie:true y redirección al dashboard.
- **Corrección propuesta:** Aplicar un desafío común de MFA a todas las vías de login y registrar en la sesión cuándo se completó.
- **Regla/contrato:** backend/controllers/authController.js:334-371; backend/middleware/adminGuard.js

### F-23 — ALTA — La bitácora descarta eventos de autenticación por valores incompatibles

- **Área y ubicación:** Seguridad y permisos; `backend/utils/audit.js:67`.
- **Escenario:** Login, registro, cambio de contraseña y otras operaciones llaman audit con resultado success/failure/denied y metadata.
- **Impacto:** AuditLog solo admite exito/fallo/bloqueado/alerta: el guardado falla y el catch lo absorbe. Además se pierden metadata y los contadores no coinciden con auth.login_failed.
- **Evidencia:** probe-security.json: login HTTP 200 y cero eventos auth.login_success persistidos. AuditLog.js:68 impone enum español; audit lee metadatos y vigila auth.login_fallido.
- **Corrección propuesta:** Normalizar resultado, nombre de eventos y metadatos en un contrato compartido; verificar la persistencia y las alertas con eventos reales.
- **Regla/contrato:** backend/models/AuditLog.js:66-70; backend/controllers/authController.js:303-307; backend/utils/audit.js:85

### F-24 — MEDIA — La recuperación de contraseña crea un token que nunca se entrega al titular

- **Área y ubicación:** Cuenta y datos; `backend/controllers/authController.js:795`.
- **Escenario:** Un usuario que olvidó su contraseña envía /auth/forgot-password con un correo registrado.
- **Impacto:** La respuesta promete instrucciones por correo, pero solo guarda el hash y una auditoría; el token raw es local y se pierde, por lo que la recuperación no puede completarse con ese flujo.
- **Evidencia:** El cuerpo completo de forgotPassword (782-815) no llama proveedor de correo, cola ni genera enlace accesible. Lo mismo ocurre con el token de verificación creado en registro.
- **Corrección propuesta:** Encolar una notificación con enlace de un solo uso y conservar la respuesta uniforme frente a correos inexistentes; habilitar la vista que consume ese enlace.
- **Regla/contrato:** backend/controllers/authController.js:181-205,782-815; backend/routes/authRoutes.js

### F-25 — MEDIA — Resultado fiscal puede quedar bajo período incorrecto

- **Área y ubicación:** Frontend; `frontend/src/pages/ImpuestosPage.jsx:27`.
- **Escenario:** Carga 2026, cambia 2025 y petición falla: se conserva objeto 2026 pero panel rotula 2025. En D150 cambiar filtros conserva resultado y exporta parámetros nuevos.
- **Impacto:** Cifras atribuidas a otra consulta; descarga distinta de lo revisado.
- **Evidencia:** ImpuestosPage:17-29 y 75-89; PanelIVA/PanelRenta:8; D150Page:60-99,124-142.
- **Corrección propuesta:** Vincular resultado a parámetros, invalidar cambios, descartar respuestas obsoletas, mostrar error y exportar consulta mostrada.
- **Regla/contrato:** Trazado de estado React. Sin spec específica; sin conclusión jurídica.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### F-26 — MEDIA — Perfil excluido del refresh de access token

- **Área y ubicación:** Frontend; `frontend/src/services/api.js:44`.
- **Escenario:** Access token vencido y cookie válida; guardar perfil devuelve 401 sin intentar renovación.
- **Impacto:** Operaciones de cuenta fallan hasta refrescar por otra ruta o recargar.
- **Evidencia:** Exclusión startsWith('/auth/') en 44-51 incluye endpoints protegidos; authController.js:37 expira por defecto a 15m.
- **Corrección propuesta:** Excluir solo endpoints de autenticación que no deben reintentar; renovar para rutas protegidas.
- **Regla/contrato:** Contrato interceptor y endpoints perfil. Sin spec específica.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### F-27 — MEDIA — Fechas civiles cambian de día por UTC

- **Área y ubicación:** Frontend; `frontend/src/pages/IngresosPage.jsx:19`.
- **Escenario:** 31 octubre 19:00 CR: toISOString fecha default es 1 noviembre. Fecha elegida 2026-10-31 se guarda 00:00Z y se presenta 30 octubre en CR.
- **Impacto:** Día erróneo de entrada/presentación y posibles cruces de período.
- **Evidencia:** IngresosPage:19,40; DeclaracionesPage:87,105,626; HistorialVentas:58; ingresoController:38-41.
- **Corrección propuesta:** Contrato de fecha civil consistente; generar fecha local y presentar sin conversión UTC accidental.
- **Regla/contrato:** Semántica Date y flujo de fecha. Sin spec particular; no se afirma error en todo cálculo backend.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### F-28 — MEDIA — Refrescar facturas anuncia éxito tras error

- **Área y ubicación:** Frontend; `frontend/src/pages/FacturasPage.jsx:38`.
- **Escenario:** API falla y se pulsa Refrescar; cargar captura error y resuelve, llamador anuncia Facturas actualizadas.
- **Impacto:** Usuario confía en datos antiguos o una falsa lista vacía.
- **Evidencia:** cargar 27-42 no propaga; handleSincronizar 54-61 muestra éxito tras await resuelto.
- **Corrección propuesta:** Propagar/retornar fallo explícito y dar estado de error; éxito solo con respuesta válida.
- **Regla/contrato:** Flujo de promesas. Sin spec específica.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### F-29 — MEDIA — SDK pagos no reintenta tras fallo temporal

- **Área y ubicación:** Frontend; `frontend/src/components/billing/OnvoCheckoutModal.jsx:14`.
- **Escenario:** Falla primera carga sdk.js; recuperar conexión y reabrir modal reutiliza promesa rechazada y error permanente.
- **Impacto:** Checkout inutilizable hasta recarga completa.
- **Evidencia:** sdkPromise 14-24 nunca se limpia al rechazar; errorSdk 67-75 persiste y rama 84-91 quita contenedor.
- **Corrección propuesta:** Limpiar promesa tras fallo y estado al nuevo intento; restituir contenedor y ofrecer reintento.
- **Regla/contrato:** Ciclo de estado local; no depende de semántica externa no verificada de ONVO.
- **Detalle del área:** [review-frontend.md](review-frontend.md).

### F-30 — MEDIA — XML v4.4 de tarifa correcta produce falsas alertas por 13%

- **Área y ubicación:** Hacienda y XML; `backend/services/xmlParserService.js:378`.
- **Escenario:** **Escenario:** XMLv4.4 usa CodigoTarifaIVA02, Tarifa1, Monto10 sobre1000 en concentrado. Parser solo lee CodigoTarifa y cae a08; conserva tarifa1 pero auditoría decide por código08. **Probe:** alerta “factura cobra13%” y ahorro perdido120, aunque tarifa real1% y diferencia fiscal0.
- **Impacto:** **Impacto/corrección:** avisos y cuantías de sobrepago falsos. Leer tag según versión con compatibilidad explícita; garantizar coherencia código/tarifa y no inventar un código08 cuando falta un campo.
- **Evidencia:** ### F18 — MEDIA — XML v4.4 de tarifa correcta produce falsas alertas por 13%

**Código:** `backend/services/xmlParserService.js:378-386`; consumidor `backend/utils/insumosAgropecuarios.js:160-175`.

**Escenario:** XMLv4.4 usa CodigoTarifaIVA02, Tarifa1, Monto10 sobre1000 en concentrado. Parser solo lee CodigoTarifa y cae a08; conserva tarifa1 pero auditoría decide por código08. **Probe:** alerta “factura cobra13%” y ahorro perdido120, aunque tarifa real1% y diferencia fiscal0.

**Impacto/corrección:** avisos y cuantías de sobrepago falsos. Leer tag según versión con compatibilidad explícita; garantizar coherencia código/tarifa y no inventar un código08 cuando falta un campo.


- **Corrección propuesta:** **Impacto/corrección:** avisos y cuantías de sobrepago falsos. Leer tag según versión con compatibilidad explícita; garantizar coherencia código/tarifa y no inventar un código08 cuando falta un campo.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-31 — MEDIA — El borrador genérico descarta la referencia de NC/ND

- **Área y ubicación:** Hacienda y XML; `backend/controllers/haciendaController.js:65`.
- **Escenario:** **Escenario:** POST `/api/hacienda/emision` con tipo NC/ND y documentoReferencia válido. La desestructuración y create no incluyen documentoReferencia. Builder retorna vacío cuando falta número, sin rechazar la ausencia. La ruta de cancelar sí lo incluye, por lo que no subsana la creación manual.
- **Impacto:** **Impacto/corrección:** comprobante de ajuste manual pierde enlace al original y se firma sin referencia. Incluir y validar referencia por tipo en el endpoint común y en el modelo/servicio, evitando confiar solo en UI.
- **Evidencia:** ### F19 — MEDIA — El borrador genérico descarta la referencia de NC/ND

**Código:** `backend/controllers/haciendaController.js:65-68`, `:91-109`; builder `backend/services/hacienda/xmlBuilder.js:155-163`.

**Escenario:** POST `/api/hacienda/emision` con tipo NC/ND y documentoReferencia válido. La desestructuración y create no incluyen documentoReferencia. Builder retorna vacío cuando falta número, sin rechazar la ausencia. La ruta de cancelar sí lo incluye, por lo que no subsana la creación manual.

**Impacto/corrección:** comprobante de ajuste manual pierde enlace al original y se firma sin referencia. Incluir y validar referencia por tipo en el endpoint común y en el modelo/servicio, evitando confiar solo en UI.


- **Corrección propuesta:** **Impacto/corrección:** comprobante de ajuste manual pierde enlace al original y se firma sin referencia. Incluir y validar referencia por tipo en el endpoint común y en el modelo/servicio, evitando confiar solo en UI.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-32 — MEDIA — Dos REP en borrador pueden exceder el saldo al firmarse

- **Área y ubicación:** Hacienda y XML; `backend/controllers/repController.js:52`.
- **Escenario:** **Escenario secuencial, sin carrera:** factura crédito aceptada total100; crear REP100 en borrador, luego otro REP100. El cálculo previo solo cuenta firmada/procesando/aceptada, así que ambos pasan. Firmar ambos no revalida saldo. Se registra total abonado200 contra factura100.
- **Impacto:** **Impacto/corrección:** sobreaplicación de cobros. Reservar saldo al crear o validar/consumir saldo atómicamente al firmar; manejar cancelación de reservas y reintentos idempotentes.
- **Evidencia:** ### F20 — MEDIA — Dos REP en borrador pueden exceder el saldo al firmarse

**Código:** `backend/controllers/repController.js:52-67`, `:111`; `backend/services/haciendaWorker.js:72-130`.

**Escenario secuencial, sin carrera:** factura crédito aceptada total100; crear REP100 en borrador, luego otro REP100. El cálculo previo solo cuenta firmada/procesando/aceptada, así que ambos pasan. Firmar ambos no revalida saldo. Se registra total abonado200 contra factura100.

**Impacto/corrección:** sobreaplicación de cobros. Reservar saldo al crear o validar/consumir saldo atómicamente al firmar; manejar cancelación de reservas y reintentos idempotentes.


- **Corrección propuesta:** **Impacto/corrección:** sobreaplicación de cobros. Reservar saldo al crear o validar/consumir saldo atómicamente al firmar; manejar cancelación de reservas y reintentos idempotentes.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-33 — MEDIA — Chat informa ingresos cero y campos undefined

- **Área y ubicación:** IA contable; `backend/controllers/chatController.js:114`.
- **Escenario:** **Escenario:** una venta guardada de1010 y descripción milk. El chat suma `i.monto||0` y construye últimos ingresos con i.concepto/i.monto. **Probe:** totalIncome0, lastIncome sin valores. El prompt generado usa esos campos y balance queda negativo con gastos aun habiendo ventas.
- **Impacto:** **Impacto/corrección:** IA y resumen offline reciben contexto financiero falso. Mapear campos reales y precisar si total financiero usa base o monto con impuesto. Los límites20 facturas/10 ingresos también se presentan como totales sin avisar del recorte: agregar agregados globales o etiquetas de muestra.
- **Evidencia:** ### F15 — MEDIA — Chat informa ingresos cero y campos undefined

**Código:** `backend/controllers/chatController.js:114`, `:168-172`.

**Contrato:** modelo Ingreso define montoTotal/montoSubtotal y descripcion; no define monto ni concepto.

**Escenario:** una venta guardada de1010 y descripción milk. El chat suma `i.monto||0` y construye últimos ingresos con i.concepto/i.monto. **Probe:** totalIncome0, lastIncome sin valores. El prompt generado usa esos campos y balance queda negativo con gastos aun habiendo ventas.

**Impacto/corrección:** IA y resumen offline reciben contexto financiero falso. Mapear campos reales y precisar si total financiero usa base o monto con impuesto. Los límites20 facturas/10 ingresos también se presentan como totales sin avisar del recorte: agregar agregados globales o etiquetas de muestra.


- **Corrección propuesta:** **Impacto/corrección:** IA y resumen offline reciben contexto financiero falso. Mapear campos reales y precisar si total financiero usa base o monto con impuesto. Los límites20 facturas/10 ingresos también se presentan como totales sin avisar del recorte: agregar agregados globales o etiquetas de muestra.
- **Regla/contrato:** **Contrato:** modelo Ingreso define montoTotal/montoSubtotal y descripcion; no define monto ni concepto.
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-34 — MEDIA — Chat offline no se activa cuando no hay API keys

- **Área y ubicación:** IA contable; `backend/services/aiProvider.js:54`.
- **Escenario:** **Escenario:** cero keys. Proveedor activo=heuristic y disponible=true; estaIADisponible retorna true, así que omite resumen offline. generarChatDual no tiene respuesta heurística y lanza Error genérico; chat devuelve500. Streaming emite servicio no configurado en vez del resumen disponible.
- **Impacto:** **Impacto/corrección:** fallback documentado está inalcanzable justo en su escenario principal. Separar capacidad de clasificar por heurística de capacidad de chat remoto y usar resumen local si la segunda no existe.
- **Evidencia:** ### F16 — MEDIA — Chat offline no se activa cuando no hay API keys

**Código:** `backend/services/aiProvider.js:54-67`; `backend/controllers/chatController.js:37-40`, `:293-307`, `:416-425`.

**Escenario:** cero keys. Proveedor activo=heuristic y disponible=true; estaIADisponible retorna true, así que omite resumen offline. generarChatDual no tiene respuesta heurística y lanza Error genérico; chat devuelve500. Streaming emite servicio no configurado en vez del resumen disponible.

**Impacto/corrección:** fallback documentado está inalcanzable justo en su escenario principal. Separar capacidad de clasificar por heurística de capacidad de chat remoto y usar resumen local si la segunda no existe.


- **Corrección propuesta:** **Impacto/corrección:** fallback documentado está inalcanzable justo en su escenario principal. Separar capacidad de clasificar por heurística de capacidad de chat remoto y usar resumen local si la segunda no existe.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-35 — MEDIA — IVA cuatrimestral acredita gastos marcados no deducibles

- **Área y ubicación:** Impuestos y declaraciones; `backend/services/impuestoService.js:29`.
- **Escenario:** **Escenario:** usuario marca una factura como `esDeducible:false`. Renta y exportación la excluyen de deducciones; D150 la pone sin IVA acreditable; IVA cuatrimestral continúa acreditando su impuesto completo.
- **Impacto:** **Impacto/corrección:** distintas pantallas calculan saldos incompatibles para el mismo dato y decisión de usuario. Unificar contrato de deducibilidad o separar explícitamente deducibilidad de renta y acreditabilidad IVA. Este hallazgo es inconsistencia interna, no afirmación de que ambos conceptos tributarios sean siempre equivalentes.
- **Evidencia:** ### F13 — MEDIA — IVA cuatrimestral acredita gastos marcados no deducibles

**Código:** `backend/services/impuestoService.js:29-33`, `:45-55`; contraste `backend/services/d150Service.js:162-168`, `backend/services/declaracionService.js:198-203`.

**Escenario:** usuario marca una factura como `esDeducible:false`. Renta y exportación la excluyen de deducciones; D150 la pone sin IVA acreditable; IVA cuatrimestral continúa acreditando su impuesto completo.

**Impacto/corrección:** distintas pantallas calculan saldos incompatibles para el mismo dato y decisión de usuario. Unificar contrato de deducibilidad o separar explícitamente deducibilidad de renta y acreditabilidad IVA. Este hallazgo es inconsistencia interna, no afirmación de que ambos conceptos tributarios sean siempre equivalentes.


- **Corrección propuesta:** **Impacto/corrección:** distintas pantallas calculan saldos incompatibles para el mismo dato y decisión de usuario. Unificar contrato de deducibilidad o separar explícitamente deducibilidad de renta y acreditabilidad IVA. Este hallazgo es inconsistencia interna, no afirmación de que ambos conceptos tributarios sean siempre equivalentes.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-36 — MEDIA — Editar litros de una venta de leche deja importes anteriores

- **Área y ubicación:** Impuestos y declaraciones; `backend/models/Ingreso.js:114`.
- **Escenario:** **Escenario:** venta de leche10 litros ×100 =1000; PATCH/PUT cambia solo litrosVendidos a20. El hook decide recalcular según varias propiedades, pero omite litrosVendidos y categoriaIngreso. **Probe:** 20litros, subtotal1000 en vez de2000.
- **Impacto:** **Impacto/corrección:** ingresos e IVA quedan obsoletos después de edición válida. Incluir todas las dependencias en el disparador o derivar siempre esos montos al validar.
- **Evidencia:** ### F14 — MEDIA — Editar litros de una venta de leche deja importes anteriores

**Código:** `backend/models/Ingreso.js:114`, `:126-132`; actualización permitida en `backend/controllers/ingresoController.js:70-80`.

**Escenario:** venta de leche10 litros ×100 =1000; PATCH/PUT cambia solo litrosVendidos a20. El hook decide recalcular según varias propiedades, pero omite litrosVendidos y categoriaIngreso. **Probe:** 20litros, subtotal1000 en vez de2000.

**Impacto/corrección:** ingresos e IVA quedan obsoletos después de edición válida. Incluir todas las dependencias en el disparador o derivar siempre esos montos al validar.


- **Corrección propuesta:** **Impacto/corrección:** ingresos e IVA quedan obsoletos después de edición válida. Incluir todas las dependencias en el disparador o derivar siempre esos montos al validar.
- **Regla/contrato:** Contrato interno; ver detalle y fuentes oficiales en review-fiscal.md
- **Detalle del área:** [review-fiscal.md](review-fiscal.md).

### F-37 — MEDIA — Todos los XML de un correo reciben el primer PDF

- **Área y ubicación:** Ingesta; `backend/routes/emailWebhookRoutes.js:192`.
- **Escenario:** Correo con A.xml/A.pdf y B.xml/B.pdf.
- **Impacto:** Factura B descarga PDF A; posible exposición entre tenants si distintos receptores.
- **Evidencia:** Un solo pdfBuffer :49,:64-65; mismo valor en todas las llamadas :187-193.
- **Corrección propuesta:** Conservar adjuntos y vincular por clave comprobada; no asignar ambiguos.
- **Regla/contrato:** Funcional sin spec adicional; correspondencia comprobante/adjunto.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-38 — MEDIA — IMAP ignora UPLOAD_ROOT configurado

- **Área y ubicación:** Ingesta; `backend/services/emailService.js:78`.
- **Escenario:** UPLOAD_ROOT apunta a volumen persistente distinto de backend/uploads.
- **Impacto:** Adjuntos IMAP no aparecen al descargar y quedan fuera del volumen.
- **Evidencia:** IMAP path fijo :78; descarga facturaController:9,73-82 y ingesta unificada:12 usan UPLOAD_ROOT.
- **Corrección propuesta:** Centralizar almacenamiento y respetar variable en todos los canales.
- **Regla/contrato:** Funcional/configuración sin spec adicional; contrato cruzado productor/consumidor de rutas.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-39 — MEDIA — Movimientos de costos no identifican periodo fiscal

- **Área y ubicación:** Inventario y costos; `backend/controllers/costoController.js:38`.
- **Escenario:** Mismo tenant con EST-1 en 2025 y 2026; crear centro por año permite ambos.
- **Impacto:** Consumo/producción/cierre puede modificar el año equivocado.
- **Evidencia:** Creación :20-28 filtra año; mutaciones :38,:57,:73 solo referenciaId.
- **Corrección propuesta:** Identidad estable de centro y periodo validado en todas las mutaciones.
- **Regla/contrato:** Funcional sin spec adicional; contrato creación/lectura/mutación.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-40 — MEDIA — Inicialización concurrente crea varios inventarios o costos

- **Área y ubicación:** Inventario y costos; `backend/controllers/inventarioController.js:30`.
- **Escenario:** Dos peticiones iniciales leen vacío y ambas crean inventario; equivalente por tenant/año en costos.
- **Impacto:** Documentos duplicados se consultan con findOne y datos pueden quedar ocultos en el otro.
- **Evidencia:** findOne/create :30-38; sin unique en Inventario:252-258 y CostoProduccion:113-116.
- **Corrección propuesta:** Resolver duplicados e índice único identidad tenant/año más upsert atómico.
- **Regla/contrato:** Funcional/concurrencia sin spec adicional; semántica singleton de controladores.
- **Detalle del área:** [review-ingesta-infra.md](review-ingesta-infra.md).

### F-41 — MEDIA — El período de gracia de pago no vence al alcanzar su fecha límite

- **Área y ubicación:** Planes y ONVO; `backend/models/Tenant.js:307`.
- **Escenario:** Una renovación fallida fija periodoGraciaFin a siete días, pero esa fecha ya pasó y el tenant sigue en periodo_gracia.
- **Impacto:** Conserva acceso al estado de pago indefinidamente en las rutas que aceptan período de gracia; no hay reconciliador que lo suspenda.
- **Evidencia:** probe-security.json: expiredGraceActive:true con periodoGraciaFin en 1970. estaActivo solo comprueba el nombre del estado.
- **Corrección propuesta:** Evaluar el vencimiento en un punto central y reconciliar el estado de la suscripción con operaciones idempotentes.
- **Regla/contrato:** backend/controllers/onvoController.js:285-287; backend/middleware/tenantGuard.js

### F-42 — MEDIA — Dos renovaciones simultáneas aceptan el mismo refresh token

- **Área y ubicación:** Seguridad y permisos; `backend/controllers/authController.js:501`.
- **Escenario:** Dos pestañas envían a la vez /auth/refresh con la misma cookie antes de que se marque revokedAt.
- **Impacto:** Ambas emiten tokens válidos y rompen la rotación de un solo uso; un reintento posterior puede revocar todas las sesiones como falso robo.
- **Evidencia:** probe-security.json: parallel_refresh_same_cookie produjo statuses [200,200]. La comprobación y el guardado son operaciones separadas.
- **Corrección propuesta:** Reclamar el refresh anterior mediante una operación condicional atómica y definir el tratamiento de concurrencia legítima antes de emitir el reemplazo.
- **Regla/contrato:** backend/models/RefreshToken.js; backend/__tests__/security/authJwtAndCrypto.test.js

## Orden sugerido de corrección

1. Cerrar los permisos y la continuidad de datos: RBAC, MFA, bitácora, borrado veraz, restauración BSON y backup ejecutable.
2. Resolver en cadena los bloqueos independientes de Hacienda: identidad del emisor, getters de credenciales, PKCS12, campos/modelo, clave/XML, perfil XAdES y consulta de estado. Validar XSD y sandbox antes de usar emisión real.
3. Unificar las fuentes de ventas y los importes: moneda, signo de notas de crédito, descuentos, exoneraciones, períodos, paginación y unidades productivas.
4. Asegurar entrega durable y asignación exacta en email/WhatsApp/IMAP; después completar reanudación de migraciones, estados ONVO y renovación de cuotas.

## Límites

- El artefacto pasó comprobaciones de estructura HTML, sintaxis JavaScript, 70 enlaces locales, JSON y hashes de 277 archivos del ZIP. La inspección visual no se completó: Computer Use no pudo determinar la URL del navegador Windows con suficiente confianza y detuvo el control. No se afirma una comprobación visual ni interacción real de sus filtros.
- La revisión busca todos los errores identificables dentro del alcance inspeccionado; no demuestra que se hayan encontrado todos los errores posibles. Se leyeron flujos y contratos principales; la cobertura detallada y parcial figura en los informes de cada área.
- No se accedió a la base ni a las APIs de producción, no se envió correo/WhatsApp, no se ejecutaron migraciones o restauraciones reales, y no se inspeccionaron valores de secretos, configuración activa de Render/Cloudflare ni índices desplegados.
- Las pruebas generales pasan, pero no cubren todos los escenarios de esta auditoría. Los probes usan datos sintéticos, PKCS12 en memoria, mocks de proveedores o MongoDB temporal; no prueban aceptación real por Hacienda.
- Hacienda: se compararon contratos oficiales concretos. No se certificó conformidad fiscal integral ni se resolvió la ambigüedad documental D-150/D-135-1 y su periodicidad. Se contrastaron los tramos 2026 sin detectar discrepancia en esas constantes.
- Hubo cambios concurrentes en la aplicación: la ejecución inicial tenía tres fallos de soporte, la ejecución final pasa 193/193. El import de logger y sanitizeFilter también cambiaron y no se reportan como defectos vigentes. El manifiesto final y el ZIP de fuentes permiten reproducir el corte entregado.
- La revisión de UI se realizó sobre código y contratos; no hubo pruebas completas de navegación autenticada, accesibilidad con lector de pantalla, Core Web Vitals ni inspección exhaustiva de cada CSS, página legal o componente shadcn.
- La auditoría de Bun cubre todo el lockfile, con desarrollo y transitivas. Detectar una versión afectada no demuestra que todas sus vulnerabilidades sean alcanzables en esta aplicación; no se ejecutaron exploits.

## Descartes de síntesis

- Se permite inventar aceptación de Hacienda desde un endpoint público autenticado: El middleware global elimina estado antes del controlador. El escenario PUT aceptada descrito por el revisor no alcanza esa asignación. Se descarta la afirmación de aceptación ficticia por esta vía.

El logger, sanitizeFilter y tres fallos iniciales de soporte cambiaron durante la auditoría y no se cuentan como defectos actuales. Los informes de revisores son evidencia previa: cuando difieran, este consolidado y sus descartes prevalecen.

## Skills y documentación

Se utilizaron code-review, vibe-coding-toolkit y las skills de la matriz de AGENTS.md. Find-skills se aplicó consultando [el catálogo](https://www.skills.sh/); las necesarias ya estaban instaladas. Agents SDK no está instalado ni se importa en la app: no es un fallo de la arquitectura Express/Email Worker actual. Se consultó [Cloudflare Agents](https://developers.cloudflare.com/agents/).

El proyecto tiene documentos/skills con códigos Hacienda incorrectos, referencias antiguas a wrangler.toml y render.yaml inexistente en este corte. Deben actualizarse contra la arquitectura y [anexos oficiales v4.4](https://pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/S/2020-2029/2020-2024/2024/1936C/1701B7.HTML). No se deduce de ello una caída de producción.

Standards: 15; Spec: 10; Funcional: 42. Máxima severidad en cada eje: alta. No se aplicaron correcciones de la aplicación.
