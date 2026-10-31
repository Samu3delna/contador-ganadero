# Auditoría de ingesta, inventario, costos e infraestructura

Fecha: 2026-10-31. Revisor: `ingesta_infra_review`. Solo lectura de la aplicación; únicamente se genera este informe.

Objetivo revisado: árbol completo de trabajo sobre HEAD `2b501d5e4d98f2aaa00a56efdf2e64152199247a`, incluidos cambios preexistentes del snapshot `artifacts/auditoria-2026-10-31/snapshot-inicial.json`. El coordinador informó cambios concurrentes en `backend/config/db.js` y `errorMiddleware`; se volvió a leer `db.js` y no se incluye ningún hallazgo basado en `sanitizeFilter:true`.

Skills consultadas: ingesta-facturas-agro-inventario, cloudflare-email-service y su referencia routing, workers-best-practices y runtime-patterns, agents-sdk, nodejs-backend-patterns, multitenant-onvo-billing, mongodb-query-optimizer, mongodb-connection, y Vibe Coding Toolkit con el procedimiento 03-multi-agent-code-review. Memorix ya había sido consultado por el coordinador y no aportó hechos adicionales.

Clasificación: **Standards** identifica una regla explícita de AGENTS/skills; **Spec** identifica un contrato documentado; **Funcional** identifica una falla demostrable sin especificación adicional. Las propuestas son orientativas: no se aplicaron correcciones.

## Hallazgos

### INF-01 — ALTA — La restauración destruye los tipos BSON

- **Ubicación:** `backend/scripts/backup-mongodb.js:60`; `backend/scripts/restore-mongodb.js:25`, `:36-40`.
- **Categoría:** Funcional; contrato de respaldo/restauración. Confianza alta.
- **Escenario:** un respaldo contiene `_id`, `tenantId` y referencias `ObjectId`, además de fechas `Date`. `JSON.stringify` convierte esos valores a strings; `JSON.parse` no los reconstruye. La restauración borra la colección y llama al driver nativo `insertMany`, que no aplica el casting de un modelo Mongoose.
- **Impacto:** después de restaurar, búsquedas de Mongoose por `_id` o `tenantId` ObjectId dejan de encontrar los registros y las consultas por rangos de fecha dejan de coincidir. El archivo pasa la verificación criptográfica aunque su contenido ya no restaure una base funcional.
- **Evidencia:** probe local sin DB: tipos originales `[ObjectId,ObjectId,Date]`; tipos tras el roundtrip exacto usado por los scripts `[string,string,string]`. La [documentación de Extended JSON de MongoDB](https://www.mongodb.com/docs/drivers/node/current/data-formats/extended-json/) distingue JSON de BSON y documenta `EJSON.stringify`/`EJSON.parse` para preservar tipos.
- **Corrección propuesta:** usar BSON o Extended JSON canónico en ambas direcciones, versionar el formato y verificar un roundtrip de documentos con referencias, fechas y binarios antes de reemplazar colecciones. La prueba existente de backups solo verifica cifrado/descifrado de bytes, no restauración de documentos.

### INF-02 — ALTA — El comando documentado de backup no genera ningún respaldo

- **Ubicación:** `backend/scripts/backup-mongodb.js:80-84`; contrato en `RESPALDOS.md:14-26`.
- **Categoría:** Spec. Confianza alta.
- **Escenario:** el operador o un cron ejecuta `node scripts/backup-mongodb.js --output-dir=./backups`, como indica el procedimiento. El archivo únicamente define funciones y las exporta: no tiene entrypoint, conexión a MongoDB, interpretación de argumentos ni llamada a `crearRespaldoCifrado`.
- **Impacto:** el proceso termina sin crear `.cgbk` ni `.sha256`, sin cumplir el respaldo diario anunciado. El código de salida exitoso puede hacer que un cron lo considere correcto.
- **Evidencia:** búsqueda de todos los consumidores de `crearRespaldoCifrado` no encontró invocaciones; el propio script no tiene `require.main` ni equivalente. `restore-mongodb.js` tampoco tiene CLI, pese a mencionar `--confirm-restore` en su encabezado.
- **Corrección propuesta:** implementar un entrypoint explícito con conexión, argumentos, ejecución, cierre y fallo con exit code no cero; o documentar y proporcionar el wrapper que realmente ejecuta las funciones. Probar el comando documentado en una base aislada.

### ING-01 — ALTA — Los fallos parciales del email se confirman como éxito y no se reintentan

- **Ubicación:** `backend/routes/emailWebhookRoutes.js:187-219`; `cloudflare-email-worker/worker.js:44-65`, `:69-74`.
- **Categoría:** Funcional. Confianza alta.
- **Escenario:** un correo trae dos XML válidos. Se guarda el primero y el segundo falla por un problema transitorio de MongoDB o de escritura de archivos. El backend captura cualquier error de cada XML y responde `207` con una factura procesada. `response.ok` en el Worker es verdadero; solo registra `email_partially_processed` y retorna sin persistir ni reintentar el XML fallido. Si fallan todos, se responde `422` incluso cuando la causa es transitoria; el Worker lo clasifica como no reintentable.
- **Impacto:** una entrega parcial queda concluida sin que exista cola, copia durable o mecanismo de recuperación en este flujo. Se pierde la ingesta de parte del correo hasta un reenvío manual. No se afirma una política de reintentos SMTP externa: el caso `207` termina normalmente en el propio código.
- **Evidencia:** el Worker diferencia solo `429/5xx` de errores permanentes; la ruta colapsa fallos de validación y de infraestructura al mismo estado. Las pruebas cubren `503`, `422` inválido y `200`, pero no éxito parcial con error transitorio.
- **Corrección propuesta:** persistir los adjuntos y su estado antes de confirmar recepción; clasificar fallos transitorios separadamente y reintentar solo los pendientes. Mientras no haya cola, un error transitorio parcial debe mantener la entrega pendiente y conservar la idempotencia por clave.

### ING-02 — ALTA — WhatsApp confirma la recepción antes de persistir el trabajo

- **Ubicación:** `backend/routes/whatsappWebhookRoutes.js:83-85`, `:109-136`, `:168-174`, `:218-220`.
- **Categoría:** Funcional. Confianza alta.
- **Escenario:** llega un XML válido y el handler envía `200 EVENT_RECEIVED`; inmediatamente después el proceso reinicia, la descarga falla o MongoDB rechaza la escritura. No se había creado ningún evento durable. El catch solo registra error o intenta enviar un mensaje al usuario.
- **Impacto:** el proveedor recibió éxito pero el comprobante no está guardado ni programado para recuperarse. No hay registro por `message.id` con estado/reintentos; el usuario debe detectar el fallo y reenviar. La deduplicación de Factura protege escrituras repetidas exitosas, no recupera trabajos perdidos antes de persistir.
- **Corrección propuesta:** validar y guardar un evento/cola idempotente por `message.id` antes de responder 200; procesar el archivo en un worker con estados y reintentos. Alternativamente, completar la persistencia antes del 200 dentro del tiempo de respuesta admitido por el proveedor.
- **Límite externo:** la documentación actual de Meta devolvió 429/no accesible en esta sesión; no se presupone un plazo específico de retry ni timeout. La pérdida tras ack sin almacenamiento se deduce del flujo local.

### ING-03 — ALTA — Las fotos de WhatsApp se anuncian como guardadas, pero se descartan

- **Ubicación:** `backend/routes/whatsappWebhookRoutes.js:185-189`.
- **Categoría:** Spec: el propio mensaje al usuario afirma “La hemos guardado en tu cuenta”. Confianza alta.
- **Escenario:** un productor registrado envía una foto de un recibo. La rama `image` solo llama a `enviarMensajeWhatsApp`; nunca usa `message.image.id`, `descargarMediaMeta`, un modelo ni almacenamiento.
- **Impacto:** se asegura al productor que existe un respaldo y que IA analizará el gasto, pero no queda ni la imagen ni un trabajo pendiente. El productor puede confiar en el acuse y perder su comprobante.
- **Corrección propuesta:** persistir imagen y metadatos con tenant antes de confirmarlo y encolar análisis; si la función no está disponible, comunicarlo con exactitud y conservar un camino explícito para carga manual.

### ING-04 — ALTA — El IMAP heredado escribe facturas sin tenant y omite la resolución del destinatario

- **Ubicación:** `backend/services/emailService.js:608-617`, también `:553-562`; llamadores `backend/worker.js:38-44`, `backend/server.js:195-197`, `:263-267`.
- **Categoría:** Standards: AGENTS, arquitectura 2, “Todo documento de datos pertenece a un tenantId”; skill multitenant-onvo-billing, regla 1. Confianza alta.
- **Escenario:** IMAP está configurado y el background worker o cron ingiere una factura. Ambos eligen `Usuario.findOne()` y pasan solo su id. El servicio IMAP no obtiene el tenant, no abre `runWithTenantContext` y no llama al pipeline `procesarFacturaXMLString`; crea documentos con `usuario` sin `tenantId`.
- **Impacto:** con configuración habitual no estricta, se crean facturas que las rutas actuales, filtradas exclusivamente por `tenantId`, no muestran. Con `STRICT_TENANT_CONTEXT=true`, el flujo falla. Además, facturas de diferentes receptores del buzón compartido se atribuyen al primer usuario, en vez de aplicar la resolución por cédula/alias.
- **Evidencia:** `tenantPlugin.js:151-185` solo incorpora tenant si existe contexto y tolera documento sin tenant por defecto; `tenantGuard.js:75-78` consulta por tenant. `config/email.js:5-20` utiliza credenciales globales. La sincronización manual autenticada puede heredar el contexto del solicitante, pero no resuelve el destinatario real del XML.
- **Corrección propuesta:** hacer converger IMAP en el servicio unificado y resolver cada factura antes de guardarla; tratar explícitamente el propietario/configuración del buzón y el tenant de cada mensaje. No asignar toda la casilla al primer usuario.

### ING-05 — ALTA — Los alias aproximados pueden enviar una factura a otra finca

- **Ubicación:** `backend/services/ingestaFacturaService.js:71-87`.
- **Categoría:** Standards: aislamiento multi-tenant de AGENTS/skill. Confianza alta sobre el algoritmo; escenario condicionado a XML sin receptor resoluble.
- **Escenario:** existen alias `la-esperanza-ab12` y `la-esperanza-cd34`; se recibe un comprobante sin cédula receptora resoluble dirigido a `la-esperanza@...`. No hay alias exacto y `findOne({ emailAlias: /^la-esperanza/i })` elige arbitrariamente una finca. Otra variante: un alias erróneo termina en los mismos cuatro hexadecimales de otra finca y gana el fallback por sufijo.
- **Impacto:** escritura de un comprobante y su PDF en una finca distinta a la destinataria; corrupción contable y posible exposición de datos. Que `emailAlias` completo sea único no hace únicos sus prefijos o sus cuatro últimos caracteres.
- **Corrección propuesta:** resolver solo identificadores exactos, registrados y únicos; los alias legacy deben tener correspondencia explícita. Si hay ambigüedad o el destinatario no existe, mantener la factura pendiente sin asignarla a un resultado arbitrario.
- **Descartado:** no se reporta como bug la prioridad de cédula sobre alias, porque está explícitamente documentada y probada en `ingestaFacturaService.test.js:19-40`. El hallazgo se limita a la adivinación de alias sin una identidad de receptor válida.

### ING-06 — ALTA — Los límites de ZIP se verifican después de descomprimir todo el archivo

- **Ubicación:** `backend/routes/emailWebhookRoutes.js:85-98`.
- **Categoría:** Funcional/seguridad de disponibilidad. Confianza alta en que el límite no acota la asignación de memoria.
- **Escenario:** se envía al catch-all un ZIP pequeño que contiene un XML o PDF altamente comprimible de cientos de megabytes. El correo completo pasa el límite de 10 MiB del Worker. `zipEntry.async('text'/'nodebuffer')` materializa toda la entrada antes de comparar con los límites de 2/10 MiB.
- **Impacto:** el límite aparente de adjuntos no evita grandes asignaciones de memoria en la API; archivos comprimidos o entregas concurrentes pueden agotar los recursos del servicio. El secreto del webhook no impide este vector porque el Worker autorizado transmite el correo recibido de terceros.
- **Corrección propuesta:** limitar tamaño descomprimido total y por entrada durante streaming, abortar antes de acumularlo completo, y limitar relación de compresión/número de entradas. No confiar únicamente en tamaños declarados por el ZIP. Confirmar la mitigación con un archivo compresible de prueba en entorno aislado.
- **Verificación:** análisis estático; no se ejecutó una bomba ZIP ni prueba de presión de memoria.

### COS-01 — MEDIA — Los movimientos no identifican el año del centro de costo

- **Ubicación:** `backend/controllers/costoController.js:38`, `:57`, `:73`; creación `:20-28`.
- **Categoría:** Funcional. Confianza alta.
- **Escenario:** el mismo tenant tiene `EST-1` en 2025 y vuelve a crearlo en 2026, operación permitida porque creación verifica duplicado únicamente dentro del documento de ese año. Agregar consumo, producción o cerrar consulta solo `centrosCosto.referenciaId`, sin `periodoFiscal`, y obtiene uno de los documentos.
- **Impacto:** un movimiento de 2026 puede cambiar costos/producción de 2025, o cerrarse el centro equivocado. La selección del año al leer no protege las escrituras.
- **Corrección propuesta:** identificar centro por id estable más periodo, o incluir `periodoFiscal` validado en todas las rutas de mutación. Asegurar unicidad de la identidad que use la API.

### COS-02 — MEDIA — Los KPIs suman unidades incompatibles o ignoran producción válida

- **Ubicación:** `backend/models/CostoProduccion.js:132-148`; enums de unidades `:24-27`, `:44-47`.
- **Categoría:** Standards/funcional: skill ingesta-facturas-agro-inventario exige FCA = kg de alimento / kg de ganancia o producción, y costo por volumen producido. Confianza alta, reproducido sin DB.
- **Escenario A:** registrar 2 sacos de alimento de 40 kg y 10 kg de tilapia. El modelo acepta `unidadMedida:'saco'` y suma `cantidad=2` como si fueran kg; FCA guardado = 0.2 en vez de 8.
- **Escenario B:** registrar 30 huevos con `unidadMedida:'unidad'` y costos totales de ₡10 000. El modelo acepta la producción, pero solo suma cartones explícitos y devuelve costo por cartón = 0 en vez de ₡10 000.
- **Impacto:** indicadores productivos y de rentabilidad engañosos para entradas aceptadas por la API/modelo. Las divisiones por cero están protegidas, pero se pierde la dimensión de las cantidades.
- **Evidencia:** ambos documentos pasaron `validateSync()` sin errores; el método real devolvió 0.2 y 0 respectivamente.
- **Corrección propuesta:** almacenar cantidades normalizadas y factor/peso por presentación, o restringir unidades hasta soportar conversión. Convertir huevos unidad/docena a cartones según la convención del proyecto (30 huevos/cartón).

### MIG-01 — ALTA — Una migración de tenant interrumpida no completa los documentos al reejecutarse

- **Ubicación:** `backend/scripts/migrateTenant.js:87-94`, `:106-112`, `:123-126`.
- **Categoría:** Standards: skill multitenant-onvo-billing, regla 5, migraciones idempotentes. Confianza alta.
- **Escenario:** la migración crea el tenant, escribe `usuario.tenantId`, y falla durante `propagarTenantADocumentos` por desconexión, conflicto o interrupción. Al reejecutar, `main` solo selecciona usuarios sin tenant y nunca vuelve a propagar documentos del usuario parcialmente migrado.
- **Impacto:** documentos quedan sin tenant de forma permanente para este procedimiento; las rutas tenant-scoped los dejan invisibles aunque la segunda ejecución anuncie que no hay pendientes. El filtro de propagación tampoco incluye `tenantId:null`.
- **Corrección propuesta:** separar creación/asignación de tenant del backfill reanudable; revisar documentos pendientes de todos los usuarios con tenant, incluir null según política de migración y usar transacción/checkpoints donde corresponda. Probar recuperación después de fallar entre la actualización de usuario y la última colección.
- **Cobertura actual:** `migrateTenant.test.js` prueba repetición tras éxito completo, no reanudación tras fallo parcial.

### MIG-02 — MEDIA — La migración GCM busca campos que no existen en el esquema actual

- **Ubicación:** `backend/scripts/migrateCryptoGcm.js:17-23`, `:40-49`; esquema real `backend/models/Tenant.js:39-59`, `:226-227`; usuario `backend/models/Usuario.js:189-195`.
- **Categoría:** Spec: propósito declarado de migrar secretos legacy. Confianza alta.
- **Escenario:** un tenant tiene un `configuracionHacienda.pinCertificado` o `.passwordHacienda` legacy que requiere reencriptación. El script busca `haciendaConfig.pinP12Enc`, `haciendaConfig.haciendaPassEnc`, etc. y `imapConfig.passEnc`, ninguno utilizado por los modelos actuales. Además, hace `Tenant.find({})` sin seleccionar campos `select:false`.
- **Impacto:** informa cero migraciones aunque existan secretos legacy; IMAP del usuario está en `Usuario.configEmail.password` y tampoco se recorre.
- **Corrección propuesta:** enumerar rutas reales y modelos correctos, seleccionar explícitamente los secretos, usar la misma asociación de tenant/campo del cifrado y verificar lectura posterior. No basta con cambiar los nombres sin verificar selección y compatibilidad de AAD.
- **Coordinación:** comunicado al revisor principal para deduplicar con su revisión de seguridad/Hacienda.

### INV-01 — MEDIA — Dos inicializaciones concurrentes pueden crear inventarios/costos duplicados

- **Ubicación:** `backend/controllers/inventarioController.js:30-38`, repetido en las altas; `backend/models/Inventario.js:252-258`; `backend/controllers/costoController.js:9-11`, `:22-23`; `backend/models/CostoProduccion.js:113-116`.
- **Categoría:** Funcional/concurrencia. Confianza alta para el interleaving descrito; sin prueba contra DB.
- **Escenario:** dos dispositivos de una finca nueva solicitan o escriben inventario a la vez. Ambos `findOne` retornan vacío y ambos `create` tienen éxito porque no existe índice único por tenant. El equivalente ocurre en costos por tenant/año.
- **Impacto:** quedan varios documentos para una identidad que la aplicación trata como singleton. Las escrituras pueden repartirse entre ellos y las siguientes lecturas `findOne` mostrar solo uno, ocultando datos.
- **Corrección propuesta:** índice único por tenant (y por tenant/año en costos), después de resolver posibles duplicados existentes, junto con inicialización atómica mediante upsert. No se propone un índice único multikey para resolver los ids internos del array.

### ING-07 — MEDIA — Todos los XML de un correo reciben el primer PDF, aunque pertenezca a otra factura

- **Ubicación:** `backend/routes/emailWebhookRoutes.js:49`, `:64-65`, `:95-98`, `:187-193`.
- **Categoría:** Funcional. Confianza alta.
- **Escenario:** un proveedor adjunta factura A.xml/A.pdf y B.xml/B.pdf al mismo correo. `extraerContenidoFactura` conserva un solo PDF y se pasa el mismo buffer a ambas llamadas de ingesta.
- **Impacto:** al descargar el PDF de B, se entrega el comprobante A. Si los XML se resuelven a tenants diferentes por cédula, la asociación equivocada también expone un PDF a otra finca.
- **Corrección propuesta:** conservar todos los adjuntos y asociar XML/PDF por clave o un identificador comprobado; si no se puede determinar la correspondencia, no vincular automáticamente un único PDF a todas las facturas.

### ING-08 — MEDIA — El IMAP ignora UPLOAD_ROOT y guarda adjuntos fuera de la ubicación de descarga

- **Ubicación:** `backend/services/emailService.js:77-80`; contraste `backend/controllers/facturaController.js:9`, `:73-82` y `backend/services/ingestaFacturaService.js:12-14`.
- **Categoría:** Funcional/configuración. Confianza alta; solo afecta despliegues que establecen `UPLOAD_ROOT` distinto al default.
- **Escenario:** producción usa `UPLOAD_ROOT=/var/data/uploads` para almacenamiento persistente. La ingesta unificada y la descarga apuntan allí, pero IMAP escribe en `backend/uploads` y guarda la ruta relativa `uploads/xml/...`.
- **Impacto:** los archivos que ingiere IMAP no se encuentran al descargar; además quedan en la ruta local en vez del volumen configurado.
- **Corrección propuesta:** centralizar resolución de almacenamiento para todos los canales y respetar `UPLOAD_ROOT`. El hallazgo no presupone que producción tenga efectivamente esa variable: la configuración desplegada no se inspeccionó.

### MIG-03 — MEDIA — migrateNewCollections aplica cambios aunque se invoque con --dry-run

- **Ubicación:** `backend/utils/migrateNewCollections.js:14-16`, `:28-30`, `:41-55`, `:63-75`, `:87`.
- **Categoría:** Standards: AGENTS/skill multitenant-onvo-billing, “Toda migración de datos debe soportar el flag --dry-run”. Confianza alta.
- **Escenario:** un operador sigue la regla del proyecto y ejecuta `node utils/migrateNewCollections.js --dry-run`. El archivo no lee el argumento y crea colecciones/índices y actualiza usuarios de inmediato.
- **Impacto:** una comprobación supuestamente de solo lectura cambia la base. Además, el backfill de configuración fiscal solo se ejecuta si el primer usuario devuelto carece de configuración; si este ya la tiene, otros usuarios pendientes se omiten.
- **Corrección propuesta:** separar detección de pendientes y aplicación, respetar dry-run en cada mutación y consultar directamente los usuarios que necesitan backfill, sin usar un documento arbitrario como indicador global.

## Cobertura, verificaciones y límites

Se leyeron los servicios/rutas de email y WhatsApp, el Worker de Cloudflare y su configuración, el arranque del worker y los puntos de cron/arranque en server, controladores/modelos/rutas de inventario y costos, scripts de backup/restore/migraciones, tenantPlugin/contexto/guard y contratos relacionados de Factura/Tenant/Usuario. Se consultaron pruebas de emailWorker, ingesta, webhooks, migración tenant, aislamiento y cifrado de backups para comprobar qué escenarios cubren.

Probes ejecutados en Node desde `backend/`, sin conexión DB, red, dotenv ni lectura de secretos:

```text
BSON_JSON_roundtrip: [ObjectId,ObjectId,Date] -> [string,string,string]
FCA_sacos: validateSync=null; factor=0.2; esperado con 2x40 kg/10 kg=8
costo_huevos_unidades: validateSync=null; costoPorCarton=0; esperado=10000
```

El primer intento del probe desde la raíz falló porque `mongoose` no se resuelve desde ese directorio; se ejecutó luego desde `backend/` con las dependencias ya instaladas. No se instalaron paquetes. No se corrieron suites, migraciones, servicios, respaldo/restauración real ni carga contra producción. El coordinador conserva la responsabilidad de checks integrados.

Fuentes externas primarias consultadas: [MongoDB Extended JSON](https://www.mongodb.com/docs/drivers/node/current/data-formats/extended-json/) para preservación BSON; [Cloudflare Email Workers API](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/) para `email`, `raw`, `rawSize` y rechazo. El Worker limita el tamaño antes de consumir `raw`, consume ese stream una vez y espera la llamada al backend; estas partes respetan el contrato consultado.

No se verificaron configuración activa de Render/Cloudflare, secretos, reglas DNS/routing, discos persistentes, índices desplegados, tamaño real de datasets, memoria del proceso ni política operacional de backups. `render.yaml` no existe en el árbol revisado, aunque lo referencia AGENTS. Las configuraciones actuales de frontend son `wrangler.jsonc` raíz y `frontend/wrangler.jsonc`, ambas con static assets, fallback SPA y observabilidad; las referencias `wrangler.toml` de README/AGENTS están desactualizadas. Ausencia de `render.yaml` no demuestra por sí misma un fallo del servicio configurado en el dashboard.

Cloudflare Agents SDK: el código revisado es un Worker `email()` convencional que envía MIME a Express y servicios Node en Render. No se observaron clases Agent, Durable Objects ni imports del SDK que requieran sus bindings. La ausencia del paquete `agents` no es por sí misma un defecto ni justifica instalarlo; el coordinador ejecuta el inventario npm. Las mejoras de cola/persistencia de este informe pueden implementarse con la arquitectura existente; migrar a Agents es una decisión arquitectónica distinta.

## Candidatos descartados o pendientes de evidencia

- **Duplicados simultáneos email/WhatsApp:** la ingesta actual tiene índice único `{claveNumerica, tenantId}`, captura `11000` y limpia archivos duplicados; existe prueba de concurrencia entre canales. No se reporta una carrera simple de `findOne`/insert como si faltase esa defensa. Queda fuera de alcance comprobar que el índice esté creado realmente en producción (`autoIndex` está apagado allí).
- **Prioridad de cédula sobre alias:** intencional según skill y test, descartada como defecto por sí sola. Requerir firmas/autorizar receptores es una política más amplia que necesita definición del producto y revisión de seguridad.
- **WhatsApp múltiples entry/changes/messages:** solo se usa `[0]` en cada nivel (`whatsappWebhookRoutes.js:93-102`). Un payload con dos mensajes ignoraría el segundo, pero no se pudo validar con documentación primaria actual que Meta agrupe actualmente ese caso; se deja como candidato, no como fallo productivo confirmado.
- **Pérdida de sumatorios por escrituras concurrentes de arrays:** requiere reproducir los deltas/versioning reales de Mongoose en DB; no se convierte en hallazgo solo por ver read-modify-save.
- **Falta de logs/traces en Workers:** descartado; las tres configuraciones JSONC tienen observabilidad, logs y traces habilitados.
- **Necesidad de postal-mime en el Worker:** no aplica; se reenvía MIME crudo y se parsea con mailparser en backend.
- **CORS/cookies y orden ONVO:** revisados por otra área; no se modificaron ni se incluyen conclusiones redundantes aquí.
- **Mensajes Hacienda que llegan antes de la factura completa:** el servicio de ingesta tiene enriquecimiento parcial de líneas/resumen; su corrección fiscal completa se dejó al revisor Hacienda para verificar parser y modelo.
