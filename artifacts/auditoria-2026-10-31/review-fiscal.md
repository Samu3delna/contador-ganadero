# Auditoría fiscal, Hacienda e IA contable

Fecha: 2026-10-31. Revisor: fiscal_review. Objetivo: árbol actual, HEAD `2b501d5e4d98f2aaa00a56efdf2e64152199247a` más cambios preexistentes; referencia del coordinador: `snapshot-inicial.json`. No se modificó código de aplicación, configuración, credenciales o base de datos. No se invocó ninguna API productiva ni se leyó `.env`.

## Evidencia y alcance

Se leyeron AGENTS.md, skills locales hacienda-cr-v44, rea-impuestos-cr, nodejs-backend-patterns, mongodb-query-optimizer, mongodb-connection, multitenant-onvo-billing y javascript-testing-patterns, además de vibe-coding-toolkit, su procedimiento multi-agent-code-review y code-review. No se propusieron ajustes de pools/índices sin métricas. Autopilot de memoria fue coordinado por el agente principal.

Cobertura: builders XML, clave/consecutivo, firma, OAuth, recepción y worker; FacturaEmision, Tenant, Factura e Ingreso; controladores y rutas de Hacienda, configuración, FE, FEC, REP, declaraciones, conciliación, dashboard y chat; servicios de impuestos, exportación e IA; parser XML y contratos relacionados. Lectura puntual de tenantPlugin, quotaGuard e ingesta para evitar falsos positivos. No se hizo revisión visual del frontend ni pruebas con Hacienda real. La suite de pruebas general corresponde al coordinador.

Reproducción autónoma, sin red ni DB: `node artifacts/auditoria-2026-10-31/probe-fiscal.cjs`. El script utiliza PKCS12 sintético en memoria, mocks para Axios/modelos/proveedores, y constructores/hooks Mongoose sin guardado. Resultados completos: `probe-fiscal-results.json`. No imprime ni conserva claves privadas sintéticas. Se ejecutó correctamente; reproduce los hallazgos identificados abajo como **probe**. Los hooks de cálculo se llaman directamente: esta evidencia demuestra la aritmética, no sustituye integración con MongoDB.

### Fuentes oficiales consultadas

- [Anexos y estructuras v4.4, Dirección General de Tributación, reproducidos por PGR](https://pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/S/2020-2029/2020-2024/2024/1936C/1701B7.HTML): especificación de namespaces, campos, códigos de comprobantes, clave y firma. La nota 3 asigna ND=02, TE=04, FEC=08, REP=10, y separa situación y seguridad en la clave. El esquema usa `xml-schemas/v4.4`, `CodigoActividadEmisor`, `CodigoCABYS` y `CodigoTarifaIVA`. La firma requerida es XAdES-EPES.
- [Contrato oficial del API de comprobantes](https://www.hacienda.go.cr/docs/ComprobantesElectronicosAPI.html): respuesta de consulta con `ind-estado` y `respuesta-xml`.
- [Tramos de renta 2026, Hacienda](https://www.hacienda.go.cr/docs/TramosRenta2026.pdf): las constantes para persona física y créditos de `costaRicaTax.js` coinciden con esta publicación. No se reporta error en esos valores.

La documentación local contiene errores normativos: la skill Hacienda y `docs/PENDIENTES_HACIENDA.md` asignan códigos incorrectos y confunden REP con MensajeReceptor. No se recomienda implementar literalmente esas instrucciones. Se debe corregir la documentación contra el contrato oficial antes de modificar los builders. El roadmap reconoce falta de validación sandbox: estos hallazgos son deuda actual, no una afirmación de regresión reciente.

## Standards: incumplimientos de reglas locales

### S01 — ALTA — Se omite la cascada NVIDIA cuando falla Gemini

**Código:** `backend/services/aiProvider.js:32`, `:126`, `:255`, `:324`.

**Regla:** `.agents/skills/rea-impuestos-cr/SKILL.md`, regla 5: orden estricto Gemini → NVIDIA NIM → heurística local.

**Escenario:** proceso nuevo con ambas API keys; construir cliente Gemini funciona, pero su primera petición falla. `inicializarProveedores` retorna antes de construir `openAIClient`; el fallback NVIDIA encuentra `null`. Categorización baja directamente a heurística; chat unario lanza y streaming termina con error. **Probe:** constructor NVIDIA=0, llamadas NVIDIA=0 tras fallo simulado Gemini.

**Impacto/corrección:** pérdida de continuidad pese a proveedor secundario configurado. Inicializar ambos clientes o crear NVIDIA en el momento del fallback, conservando heurística para categorización.

### S02 — ALTA — D-150 queda accesible a planes sin módulo

**Código:** `backend/routes/haciendaRoutes.js:63-66`; `backend/controllers/d150Controller.js:31-40`, `:45-52`.

**Regla:** `.agents/skills/rea-impuestos-cr/SKILL.md`, regla 4: D-150 exclusivo de pro y `limites.moduloD150 === true`.

**Escenario:** usuario autenticado de tenant free llama directamente a `/api/hacienda/d150/conciliacion` o a sus reportes. Las rutas solo atraviesan autenticación y extraerTenant; ningún controlador verifica el permiso del módulo. La eventual restricción visual no protege la API.

**Impacto/corrección:** evasión de licencia y acceso a cálculos/exportaciones premium. Aplicar el guard del módulo a todas las rutas D-150. Evidencia estática del flujo completo; no se llamó API real.

### S03 — MEDIA — Exportación y chat omiten datos de compañeros del tenant

**Código:** `backend/services/declaracionService.js:18-41`; `backend/controllers/chatController.js:101-110`.

**Regla:** AGENTS.md, arquitectura crítica 2, y skill multitenant-onvo-billing, regla 1: datos por tenant y uso de alcance de tenant; `usuario` es compatibilidad heredada.

**Escenario:** dos usuarios A/B pertenecen a la finca; A registra ingresos/facturas y B exporta o consulta chat. Aunque ambas funciones reciben tenantId, filtran por `usuario:B`. tenantPlugin agrega tenantId, pero conserva ese filtro: solo muestra los documentos creados por B, frente a impuestos/dashboard que sí usan el tenant completo.

**Impacto/corrección:** reportes fiscales parciales y respuestas distintas según miembro. Construir scope tenant cuando exista, con usuario solo como fallback legado. **No es una fuga entre tenants:** el plugin cubre el aislamiento; el error es exclusión de datos válidos.

## Spec: requisitos documentados incompletos o incorrectos

### P01 — ALTA — La firma llamada XAdES-EPES solo contiene XML-DSig

**Código:** `backend/services/hacienda/signer.js:119-146`.

**Spec:** `docs/PENDIENTES_HACIENDA.md:43-65`, bloque 2, requiere emisión real firmada y validación de aceptación; skill hacienda-cr-v44, regla 3, exige XAdES-EPES. El propio roadmap reconoce trabajo pendiente de firma.

**Escenario:** pasar directamente un par PEM válido a `firmarXml`, una vez superado el fallo PKCS12 F02. Solo se añade referencia al documento y se llama `computeSignature`; no se construyen SignedProperties ni política. `DEFAULT_XADES_POLICY` se exporta pero nunca se usa. **Probe:** firma presente=true; SignedProperties=false; SignaturePolicy=false.

**Impacto/corrección:** la firma producida no satisface el perfil anunciado para emisión real. Implementar y verificar las propiedades y referencias XAdES requeridas, además de la firma matemática. No se afirma haber ejecutado validación sandbox ni que agregar solo esos nodos baste para certificar conformidad.

### P02 — MEDIA — El modelo impide tiquetes sin receptor

**Código:** `backend/models/FacturaEmision.js:105-114`; `backend/controllers/facturaEmisionController.js:39`.

**Spec:** skill hacienda-cr-v44, regla 2: receptor opcional para TE; roadmap `docs/PENDIENTES_HACIENDA.md:96` prevé builder TE sin receptor obligatorio.

**Escenario:** `POST /api/hacienda/emision` con tipo TE y sin receptor. El controlador permite pasar esa ausencia, pero validación Mongoose exige `receptor.nombre` y `receptor.cedula.numero`. **Probe:** ambos errores requeridos. La ruta legacy también exige receptor antes del modelo.

**Impacto/corrección:** venta al consumidor no identificado no puede registrarse como tiquete. Hacer exigencia condicional por tipo y alinear ambos endpoints; conservar receptor opcional cuando sí se provea.

### P03 — ALTA — No se conservan datos fiscales que el XML necesita

**Código:** `backend/models/FacturaEmision.js:89-114`; `backend/services/haciendaWorker.js:107`; `backend/services/hacienda/xmlBuilder.js:196`, `:207-215`.

**Spec:** `docs/PENDIENTES_HACIENDA.md:27` y bloque 5: actividad y ubicación completas del emisor para la emisión real.

**Escenario:** guardar una factura con `codigoActividadEmisor` y `emisor.provincia/canton/distrito`, o configurar actividad en Tenant. El schema no declara esos campos y Mongoose los descarta; worker no aplica `cfg.codigoActividad` al documento antes del builder. El XML usa actividad `000000` y omite Ubicacion. **Probe:** actividad y provincia desaparecen tras crear instancia del modelo.

**Impacto/corrección:** incluso después de reparar tags, los documentos carecen de datos fiscales válidos. Persistir perfil/campos y obtenerlos del tenant al emitir; validar su completitud. No se está pidiendo un perfil nuevo por preferencia estética: la pérdida de datos existente es demostrable.

## Fallos funcionales y de contratos externos

### F01 — ALTA — Credenciales Hacienda de todos los tenants se leen desde el objeto equivocado

**Código:** `backend/services/haciendaWorker.js:33-44`; contrato en `backend/models/Tenant.js:94-129`.

**Escenario:** tenant tiene los cuatro campos configurados. `getTenantConfig` busca `tenant.obtenerPinCertificado` y `tenant.obtenerPasswordHacienda`, pero son métodos de `tenant.configuracionHacienda`; el método de certificado real se llama `obtenerCertificadoP12` y tampoco se invoca. **Probe:** `estaConfigurado=true`, pin=null y password=null.

**Impacto:** `prepararYFirmar` lanza “No hay certificado configurado” y OAuth no obtiene contraseña; conexión de tenants reales bloqueada independientemente de tener credenciales correctas. **Corrección:** usar getters del subdocumento y su nombre real; separar certificado cifrado de su representación decodificada.

### F02 — ALTA — Un PKCS12 válido provoca TypeError antes de firmar

**Código:** `backend/services/hacienda/signer.js:42-53`.

**Contrato:** node-forge instalado, `backend/node_modules/node-forge/lib/pkcs12.js:568`, expone `safeContents[].safeBags`, no `.bags`.

**Escenario:** `cargarLlaveDesdeBase64` con PKCS12 sintético válido y PIN correcto. El `for (const item of bag.bags)` falla y los fallbacks repiten `.bags`. **Probe:** `bag.bags is not iterable`.

**Impacto/corrección:** cualquier firma no mock que llegue al lector falla. Recorrer safeBags o API getBags y elegir certificado correspondiente a la llave. No requiere Hacienda ni certificado del usuario para reproducir.

### F03 — ALTA — El builder no genera estructura v4.4 conforme al contrato externo

**Código:** `backend/services/hacienda/xmlBuilder.js:14-39`, `:86-90`, `:110`, `:196`, `:241-250`.

**Escenario:** crear cualquier FE normal. El XML declara `/xml/v4.4/`, usa `<CodigoActividad>`, ubica CABYS dentro de `<Codigo><Tipo>04`, y escribe `<CodigoTarifa>`; estas estructuras difieren del esquema oficial enlazado arriba. Reutiliza el cuerpo genérico para todos los tipos. **Probe:** namespace erróneo y ausencia de CodigoCABYS.

**Impacto/corrección:** incompatibilidad estructural para sandbox/producción; el mock local no valida schema y la oculta. Rehacer por XSD oficial y validar fixtures de cada tipo antes de firmar. Conflicto con documentación local, no un incumplimiento del programador al seguirla. No se ejecutó validador XSD externo; la evidencia es comparación de campos/namespace.

### F04 — ALTA — Tipos y situación de la clave numérica son incorrectos

**Código:** `backend/services/hacienda/clave50.js:20-26`, `:78-83`; detección legacy `backend/services/xmlParserService.js:285-292`.

**Escenario:** FEC genera tipo 05 y REP tipo 06; TE/ND también están intercambiados respecto al catálogo oficial. Además, los últimos nueve dígitos son todos aleatorios: la posición reservada a situación puede valer 4–9. **Probe:** FEC=05 y situación=9 usando seguridad 987654321. El parser de fallback presenta otro catálogo incompatible (FEC05/FEE06/REP07).

**Impacto/corrección:** clave de longitud válida pero semántica inválida. Centralizar catálogo oficial y generar situación explícita más ocho dígitos de seguridad. Deben corregirse también skills/docs y fixtures que repiten estos códigos; el número de dígitos por sí solo no prueba validez.

### F05 — ALTA — Consulta de estado ignora el nombre oficial del campo y pierde el XML respuesta

**Código:** `backend/services/hacienda/recepcion.js:198-204`; `backend/services/haciendaWorker.js:283-297`; schema `backend/models/FacturaEmision.js:178-190`.

**Escenario:** Hacienda retorna HTTP200 con `ind-estado:aceptado` o rechazado. Se lee `data.indEstado`, por lo que se devuelve procesando. Tampoco se decodifica respuesta-xml. Worker intenta guardar `respuestaHacienda.xml`, campo inexistente; el schema tiene `xmlRespuestaHacienda` en raíz. **Probe:** aceptación oficial simulada retorna procesando.

**Impacto/corrección:** facturas nunca llegan a estado terminal real y falta comprobante de aceptación/rechazo. Leer campos del contrato, decodificar XML y persistir en el campo declarado; conservar detalle del rechazo. El fallback de URL de auth también omite `/recepcion/` antes de la clave si no hay Location: revisar ese caso junto al contrato.

### F06 — ALTA — Importes emitidos son incoherentes con tarifa, descuentos y etiquetas XML

**Código:** `backend/models/FacturaEmision.js:235-243`; `backend/services/hacienda/xmlBuilder.js:81`, `:95`, `:129`.

**Escenarios:** (a) línea de 1000 con tarifa13 sin factorIVA: el default .01 calcula IVA10; (b) línea1000, descuento100, factor.01: grava1000, no subtotal900; (c) montoTotal del modelo incluye descuento e IVA y el builder lo usa a la vez para MontoTotal y MontoTotalLinea. **Probe combinado:** tarifa13, subtotal1000, descuento100, IVA10, total910, XML MontoTotal=910 y SubTotal=1000.

**Impacto/corrección:** importes incorrectos e identidades aritméticas rotas en XML y conciliación. Definir una única derivación de base bruta, descuento, base neta, tarifa, exoneración, impuesto neto y total; usar el campo adecuado en cada tag y rechazar inputs incompatibles. Son fallos de aritmética interna, sin depender de asesoría fiscal.

### F07 — ALTA — Se permite inventar aceptación de Hacienda desde un endpoint público autenticado

**Código:** `backend/controllers/facturaEmisionController.js:74-88`; `backend/routes/facturaEmisionRoutes.js:20`.

**Escenario:** usuario crea borrador y hace `PUT /api/facturacion/:id/estado` con `{estado:'aceptada'}`. El controlador asigna cualquier enum de estado y respuestaHacienda del cliente; no exige firma, envío, estado previo ni respuesta oficial. También permite regresar una aceptada a borrador.

**Impacto/corrección:** estado contable y D150 pueden incluir documentos nunca validados; se puede reabrir y volver a firmar un comprobante terminal. Reservar estados oficiales para worker/respuesta verificada y validar transiciones. No se afirma acceso a otro tenant: el filtro sí aísla.

### F08 — ALTA — Las ventas de FacturaEmision no alimentan IVA, renta ni exportación general

**Código:** `backend/services/impuestoService.js:6-8`, `:35-38`, `:113-120`; `backend/services/declaracionService.js:30-41`.

**Escenario:** única venta: FE aceptada de base100000 e IVA1000; no existe registro manual en Ingreso. Los cálculos leen exclusivamente Ingreso y arrojan ventas/IVA0. Los flujos de creación/aceptación de Hacienda no crean Ingreso; solo D150 consulta ambas fuentes y deduplica por clave.

**Impacto/corrección:** renta, IVA, dashboard y exportación omiten ventas que la propia aplicación emitió. Integrar ambas fuentes con deduplicación o materializar asiento/Ingreso idempotente al aceptar. No duplicar al usuario que ya registró manualmente la misma clave.

### F09 — ALTA — Montos de facturas USD se suman como CRC

**Código:** `backend/services/impuestoService.js:47-56`, `:128-134`; `backend/services/d150Service.js:174-177`; `backend/services/declaracionService.js:44-47`; `backend/controllers/dashboardController.js:29-31`.

**Contrato interno:** parser `xmlParserService.js:146-147` y Factura guardan moneda/tipoCambio, sin conversión previa de los importes.

**Escenario:** factura USD100 + IVA13, tipoCambio500. Reportes suman 100/13/113 y los presentan en colones en vez de 50000/6500/56500. **Probe:** resultado IVA pagado13 y gastos113, a pesar de monedaUSD y tipoCambio500.

**Impacto/corrección:** subvaloración por factor de cambio de gastos/crédito y mezcla de unidades. Normalizar montos CRC una sola vez con trazabilidad al tipo de cambio del comprobante; conservar moneda original para mostrarla.

### F10 — ALTA — Notas de crédito recibidas aumentan compras e IVA en lugar de reducirlos

**Código:** `backend/services/impuestoService.js:45-57`, `:128-134`; `backend/services/d150Service.js:161-190`; `backend/services/declaracionService.js:44-80`.

**Contrato:** parser reconoce Nota de Crédito (`xmlParserService.js:276`) y mantiene sus importes positivos; D150 aplica signo negativo solo a NC emitidas (`:130-136`).

**Escenario:** compra de100 + IVA13 totalmente anulada por NC recibida con los mismos importes. Ambas se suman, dejando base200/IVA26 en vez de0. **Probe:** NC aislada produce crédito positivo13 en IVA y D150.

**Impacto/corrección:** gastos y crédito inflados, renta/IVA subestimados. Normalizar signo por tipo de documento en todas las fuentes y reflejarlo también en exportaciones y dashboard.

### F11 — ALTA — La renta y exportación deducen precio bruto anterior al descuento

**Código:** `backend/services/impuestoService.js:132-134`; `backend/services/declaracionService.js:45`.

**Escenario:** factura con TotalVenta1000, TotalDescuentos200, TotalVentaNeta800. `gastosDeducibles` y subtotal exportado toman1000. El parser mantiene por separado ambos totales (`xmlParserService.js:488-490`), por lo que no hay compensación previa.

**Impacto/corrección:** deducción superior al gasto neto y discrepancias con D150, cuyo fallback sí prefiere TotalVentaNeta. Usar base neta correcta, respetando cero válido con `??` en vez de `||`; decidir tratamiento de impuestos/cargos fuera de la base con requisito fiscal explícito.

### F12 — ALTA — Conciliación acredita impuesto bruto aunque exista exoneración

**Código:** `backend/services/d150Service.js:174-177` y `:155-156`.

**Escenario:** factura recibida deducible tiene impuesto.monto130, exoneracion.montoExoneracion130 e impuestoNeto0, totalImpuesto0. D150 suma130 como impuesto soportado porque ignora impuestoNeto y exoneración. El parser sí preserva impuestoNeto y exoneración por línea.

**Impacto/corrección:** crédito que no se pagó e inconsistencia con resumen del comprobante. Usar impuesto neto acreditable y respetar explícitamente el cero. La prueba combinada incluye una línea con impuestoNeto0 y confirma que la suma actual usa monto13; validar además fixtures de exoneración real al corregir.

### F13 — MEDIA — IVA cuatrimestral acredita gastos marcados no deducibles

**Código:** `backend/services/impuestoService.js:29-33`, `:45-55`; contraste `backend/services/d150Service.js:162-168`, `backend/services/declaracionService.js:198-203`.

**Escenario:** usuario marca una factura como `esDeducible:false`. Renta y exportación la excluyen de deducciones; D150 la pone sin IVA acreditable; IVA cuatrimestral continúa acreditando su impuesto completo.

**Impacto/corrección:** distintas pantallas calculan saldos incompatibles para el mismo dato y decisión de usuario. Unificar contrato de deducibilidad o separar explícitamente deducibilidad de renta y acreditabilidad IVA. Este hallazgo es inconsistencia interna, no afirmación de que ambos conceptos tributarios sean siempre equivalentes.

### F14 — MEDIA — Editar litros de una venta de leche deja importes anteriores

**Código:** `backend/models/Ingreso.js:114`, `:126-132`; actualización permitida en `backend/controllers/ingresoController.js:70-80`.

**Escenario:** venta de leche10 litros ×100 =1000; PATCH/PUT cambia solo litrosVendidos a20. El hook decide recalcular según varias propiedades, pero omite litrosVendidos y categoriaIngreso. **Probe:** 20litros, subtotal1000 en vez de2000.

**Impacto/corrección:** ingresos e IVA quedan obsoletos después de edición válida. Incluir todas las dependencias en el disparador o derivar siempre esos montos al validar.

### F15 — MEDIA — Chat informa ingresos cero y campos undefined

**Código:** `backend/controllers/chatController.js:114`, `:168-172`.

**Contrato:** modelo Ingreso define montoTotal/montoSubtotal y descripcion; no define monto ni concepto.

**Escenario:** una venta guardada de1010 y descripción milk. El chat suma `i.monto||0` y construye últimos ingresos con i.concepto/i.monto. **Probe:** totalIncome0, lastIncome sin valores. El prompt generado usa esos campos y balance queda negativo con gastos aun habiendo ventas.

**Impacto/corrección:** IA y resumen offline reciben contexto financiero falso. Mapear campos reales y precisar si total financiero usa base o monto con impuesto. Los límites20 facturas/10 ingresos también se presentan como totales sin avisar del recorte: agregar agregados globales o etiquetas de muestra.

### F16 — MEDIA — Chat offline no se activa cuando no hay API keys

**Código:** `backend/services/aiProvider.js:54-67`; `backend/controllers/chatController.js:37-40`, `:293-307`, `:416-425`.

**Escenario:** cero keys. Proveedor activo=heuristic y disponible=true; estaIADisponible retorna true, así que omite resumen offline. generarChatDual no tiene respuesta heurística y lanza Error genérico; chat devuelve500. Streaming emite servicio no configurado en vez del resumen disponible.

**Impacto/corrección:** fallback documentado está inalcanzable justo en su escenario principal. Separar capacidad de clasificar por heurística de capacidad de chat remoto y usar resumen local si la segunda no existe.

### F17 — ALTA — Sanitización CSV se salta cuando la celda contiene separadores

**Código:** `backend/services/declaracionService.js:862-865`.

**Escenario:** nombre del proveedor o descripción comienza con `=SUM(1,2)` (o fórmula equivalente con comillas). escapeCsv detecta coma y retorna la cadena entrecomillada antes de sanitizarFormulaExcel. **Probe:** exporta celda `"=SUM(1,2)"`, sin apóstrofo protector; comillas CSV no neutralizan evaluación en la hoja de cálculo.

**Impacto/corrección:** contenido de factura importada puede convertirse en fórmula al abrir exportación. Sanitizar contenido antes de escapar comillas/separadores, manteniendo protección especial de identificadores. No se ejecutó ninguna fórmula ni Excel; no se afirma que toda instalación ejecute enlaces externos automáticamente.

### F18 — MEDIA — XML v4.4 de tarifa correcta produce falsas alertas por 13%

**Código:** `backend/services/xmlParserService.js:378-386`; consumidor `backend/utils/insumosAgropecuarios.js:160-175`.

**Escenario:** XMLv4.4 usa CodigoTarifaIVA02, Tarifa1, Monto10 sobre1000 en concentrado. Parser solo lee CodigoTarifa y cae a08; conserva tarifa1 pero auditoría decide por código08. **Probe:** alerta “factura cobra13%” y ahorro perdido120, aunque tarifa real1% y diferencia fiscal0.

**Impacto/corrección:** avisos y cuantías de sobrepago falsos. Leer tag según versión con compatibilidad explícita; garantizar coherencia código/tarifa y no inventar un código08 cuando falta un campo.

### F19 — MEDIA — El borrador genérico descarta la referencia de NC/ND

**Código:** `backend/controllers/haciendaController.js:65-68`, `:91-109`; builder `backend/services/hacienda/xmlBuilder.js:155-163`.

**Escenario:** POST `/api/hacienda/emision` con tipo NC/ND y documentoReferencia válido. La desestructuración y create no incluyen documentoReferencia. Builder retorna vacío cuando falta número, sin rechazar la ausencia. La ruta de cancelar sí lo incluye, por lo que no subsana la creación manual.

**Impacto/corrección:** comprobante de ajuste manual pierde enlace al original y se firma sin referencia. Incluir y validar referencia por tipo en el endpoint común y en el modelo/servicio, evitando confiar solo en UI.

### F20 — MEDIA — Dos REP en borrador pueden exceder el saldo al firmarse

**Código:** `backend/controllers/repController.js:52-67`, `:111`; `backend/services/haciendaWorker.js:72-130`.

**Escenario secuencial, sin carrera:** factura crédito aceptada total100; crear REP100 en borrador, luego otro REP100. El cálculo previo solo cuenta firmada/procesando/aceptada, así que ambos pasan. Firmar ambos no revalida saldo. Se registra total abonado200 contra factura100.

**Impacto/corrección:** sobreaplicación de cobros. Reservar saldo al crear o validar/consumir saldo atómicamente al firmar; manejar cancelación de reservas y reintentos idempotentes.

## Límites y observaciones que no se cuentan como fallos confirmados adicionales

- No se certificó conformidad fiscal completa, actualización integral de catálogos 2026 ni aceptación en sandbox. Se contrastaron únicamente los contratos citados. No convertir este informe en consejo para presentar una declaración sin validación contable.
- D-150/D-135-1/Formulario150: las skills llaman D150 anual y la implementación mensual; hay además renumeración de formularios con TRIBU-CR. No se concluyó legislación vigente a partir de un calendario histórico; requiere aclarar alcance/producto y comprobar formulario actual antes de cambiar nombres o periodicidad.
- Falta de reintentos/backoff en worker está documentada como pendiente. No se cuenta como fallo autónomo sin un escenario adicional probado. Tampoco se reportan mocks/offline intencionales como vulnerabilidad.
- El guard `_running` es local al proceso y firmar/enviar carecen de claim persistente; revisar entrega simultánea API/worker y recuperación de timeout. No se ejecutó una carrera distribuida y no se cuenta como hallazgo confirmado.
- `fmtFecha` mezcla reloj local del proceso con offset fijo-06; debe probarse con TZ de Render. No se leyó configuración productiva y no se cuenta aquí como fallo de despliegue demostrado.
- `guardarConfig` asigna certificado base64 directamente en vez de llamar setter cifrado (aprox.107-108). Se notificó al revisor de seguridad para corroborar/deduplicar; no se almacena certificado real ni se reproduce con secretos.
- Enviar dos NC de anulación para una misma FE no está impedido ni vinculado al original. El roadmap pide esa vinculación; conviene cubrirlo junto al flujo de anulación, pero no se realizó su ciclo de aceptación.
- La tabla oficial de renta2026 y créditos fiscales coincide. `parseTagValue:false` está presente. Consecutivo por tenant usa `$inc` atómico cuando Tenant está disponible. Estos comportamientos correctos no deben revertirse.

## Resumen para síntesis del coordinador

Standards: 3 hallazgos (2 altos,1 medio). Spec: 3 (2 altos,1 medio). Funcionales/contratos: 20 (13 altos,7 medios). Máxima severidad ALTA; no se confirmó CRÍTICA con evidencia de exposición entre tenants o pérdida irreversible. Priorizar credenciales→PKCS12→XML/clave→firma→estado, y en paralelo coherencia de importes/contabilidad. Muchos bloqueos son independientes: corregir solo el primero no habilita emisión real.
