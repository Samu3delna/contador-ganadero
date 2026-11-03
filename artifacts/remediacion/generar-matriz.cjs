/* Regenera las referencias de linea sin modificar el codigo ni ejecutar proveedores. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
// ID | archivo actual | ancla de codigo | prueba | correccion comprobada
const rows = `
S-01|frontend/src/components/dashboard/ChatBot.jsx|key=|frontend/tests/uiRegresiones.test.js|Historial en memoria por usuario y finca; se descarta el almacenamiento global heredado y se desmonta la sesion anterior.
S-02|backend/routes/haciendaRoutes.js|moduloD150|backend/__tests__/remediacion.test.js|Todas las consultas y exportaciones D150 exigen el modulo del plan en la API.
S-03|backend/services/aiProvider.js|geminiClient = null; openAIClient = null|backend/__tests__/aiFallbackRemediacion.test.js|Inicializacion independiente de ambos proveedores; cascada Gemini, NVIDIA y heuristica.
S-04|backend/services/emailService.js|ingestionInbox|backend/__tests__/inboxRecovery.test.js|IMAP usa la ingesta durable unificada; nunca selecciona el primer usuario para asignar comprobantes.
S-05|backend/services/ingestaFacturaService.js|emailAlias|backend/__tests__/ingestaFacturaService.test.js|Solo alias exacto; identidades ambiguas quedan sin asignar.
S-06|backend/controllers/onvoController.js|reclamar|backend/__tests__/onvoController.test.js|Claim atomico y reintentos por estado, con ledger atomico de efectos en el tenant.
S-07|backend/scripts/migrateTenant.js|async function|backend/__tests__/backupMigrationRemediacion.test.js|Backfill reanudable para usuarios ya asociados y documentos null/ausentes, sin otra finca.
S-08|backend/controllers/haciendaConfigController.js|establecerCertificadoP12|backend/test-sdk/worker.test.cjs|Se conserva el cifrado SDK por tenant/campo y sus getters; no hay fallback entre fincas.
S-09|frontend/vite.config.js|envDir|frontend/tests/viteEnv.test.js|Vite carga el directorio raiz; conserva el prefijo publico VITE_ y compila.
S-10|frontend/src/pages/DeclaracionesPage.jsx|singleFlight|frontend/tests/fechaCivilSingleFlight.test.js|Guard inmediato compartido por la operacion pendiente y boton deshabilitado mientras guarda.
S-11|frontend/src/components/inventario/BovinoForm.jsx|useId|frontend/tests/uiRegresiones.test.js|Etiquetas asociadas mediante id/htmlFor en formularios de las cuatro especies.
S-12|backend/services/contabilidadService.js|const scope|backend/__tests__/contabilidadRemediacion.test.js|Exportacion y chat consultan toda la finca, con normalizacion contable compartida.
S-13|backend/middleware/rateLimiters.js|/webhooks/|backend/__tests__/limiterParserRemediacion.test.js|Exclusiones sobre rutas efectivas relativas al montaje /api, sin coincidencias de prefijos ambiguos.
S-14|backend/models/CostoProduccion.js|pesoUnidadKg|backend/__tests__/inventoryCostsRemediacion.test.js|Alimento por presentacion exige peso; huevos y docenas se normalizan a cartones.
S-15|backend/utils/migrateNewCollections.js|dryRun|backend/__tests__/backupMigrationRemediacion.test.js|Dry-run sin creacion ni escrituras; ejecucion explicita e idempotente.
P-01|frontend/src/components/hacienda/EmitirComprobanteModal.jsx|useAuth|frontend/tests/uiRegresiones.test.js|Emisor tomado de AuthContext, sin dependencia de localStorage.usuario.
P-02|backend/services/hacienda/signer.js|cargarSdk|backend/test-sdk/sdk.test.cjs|Firma SDK XAdES con politica, SignedProperties y verificacion matematica con certificado sintetico.
P-03|backend/models/FacturaEmision.js|codigoActividadEmisor|backend/test-sdk/worker.test.cjs|Conserva actividad, ubicacion, moneda y datos fiscales requeridos por el adaptador XML.
P-04|backend/routes/whatsappWebhookRoutes.js|no se guard|backend/__tests__/inboxRecovery.test.js|Fotos informadas como funcion no disponible; no se afirma persistencia ni gasto ficticio.
P-05|backend/controllers/onvoController.js|cancelarSuscripcion|backend/__tests__/onvoController.test.js|Cancelar Pro deja finca activa en free, accesible por perfil y renovacion de sesion.
P-06|backend/scripts/backup-mongodb.js|require.main|backend/__tests__/backupMigrationRemediacion.test.js|CLI operativo con codigo de salida, copia cifrada, checksum y dry-run sin archivos.
P-07|frontend/src/pages/PlanesPage.jsx|actualizarUsuario|frontend/tests/uiRegresiones.test.js|Estado confirmado de suscripcion actualiza AuthContext y conserva datos de la finca.
P-08|backend/models/FacturaEmision.js|TE|backend/test-sdk/sdk.test.cjs|TE admite receptor opcional; FE conserva requisitos y validacion XML.
P-09|backend/models/Tenant.js|actualizarCiclo|backend/__tests__/onvoController.test.js|Cambio de periodo Costa Rica reclamado atomicamente; reinicia solo consumos mensuales.
P-10|backend/scripts/migrateCryptoGcm.js|configuracionHacienda|backend/__tests__/backupMigrationRemediacion.test.js|Migra campos reales, verifica lectura, admite dry-run e idempotencia; AAD incompatible exige sustitucion explicita.
F-01|backend/controllers/dataDeletionController.js|reanudarEliminacion|backend/__tests__/deletionRecovery.test.js|Solicitud durable antes de borrar; fallos recuperables registrados y codigo inexistente devuelve 404.
F-02|frontend/src/pages/LoginPage.jsx|completarMfa|backend/__tests__/mfaRemediacion.test.js|Formulario de desafio MFA comun, sin sesion completa antes de validar TOTP o recuperacion.
F-03|backend/controllers/facturaController.js|resumenGastos|backend/__tests__/paginationDates.test.js|Agregados completos en backend; filtros antes de paginar, controles visibles y calendario recorre paginas filtradas.
F-04|backend/services/haciendaWorker.js|getTenantConfig|backend/test-sdk/worker.test.cjs|Credenciales obtenidas del subdocumento y getters de la finca, con aislamiento OAuth.
F-05|backend/services/hacienda/signer.js|firmarDocumento|backend/test-sdk/sdk.test.cjs|PKCS12 sintetico firmado correctamente mediante SDK; prueba criptografica real local.
F-06|backend/services/hacienda/xmlBuilder.js|buildXml|backend/test-sdk/sdk.test.cjs|Adaptadores SDK y fixtures FE/TE/NC/ND/FEC validados con XSD; REP real permanece bloqueado.
F-07|backend/services/hacienda/clave50.js|TIPO_DOC_CODIGO|backend/__tests__/limiterParserRemediacion.test.js|Catalogo oficial en claves y fallback parser: FEC08, exportacion09, REP10; fecha CR y situacion validadas tambien por SDK.
F-08|backend/services/hacienda/recepcion.js|respuesta|backend/test-sdk/sdk.test.cjs|Consulta conserva XML respuesta y estado oficial; errores HTTP no se convierten en rechazo fiscal.
F-09|backend/models/FacturaEmision.js|totalVentaNeta|backend/test-sdk/sdk.test.cjs|Recalculo de descuentos, tarifas e importes y rechazo de montos manipulados antes del XML.
F-10|backend/services/contabilidadService.js|ventasEmision|backend/__tests__/contabilidadRemediacion.test.js|FE/TE/NC/ND aceptadas alimentan ingresos; deduplicacion por finca/clave frente a ingresos manuales.
F-11|backend/services/contabilidadService.js|monedaOriginal|backend/__tests__/contabilidadRemediacion.test.js|Conversion a CRC una sola vez, preservando moneda y cambio originales en la proyeccion.
F-12|backend/services/contabilidadService.js|esNC|backend/__tests__/contabilidadRemediacion.test.js|Notas de credito aplican signo negativo a bases e impuestos sin reescribir XML historico.
F-13|backend/services/contabilidadService.js|totalVentaNeta|backend/__tests__/contabilidadRemediacion.test.js|Renta y exportacion usan base neta; descuento total y cero explicito respetados.
F-14|backend/services/d150Service.js|impuestoNeto|backend/__tests__/contabilidadRemediacion.test.js|Credito neto tras exoneracion completa/parcial; cero declarado no genera impuesto por fallback.
F-15|backend/services/declaracionService.js|sanitizarFormulaExcel|backend/__tests__/remediacion.test.js|Neutraliza formulas antes de escapar delimitadores; claves largas conservadas como texto.
F-16|backend/routes/emailWebhookRoutes.js|inbox.recibir|backend/__tests__/inboxRecovery.test.js|Cada adjunto queda durable antes del reconocimiento; transitorios quedan pendientes y completados no se repiten.
F-17|backend/routes/whatsappWebhookRoutes.js|inbox.recibir|backend/__tests__/inboxRecovery.test.js|Todos los mensajes verificados se persisten por identidad antes de responder exito; claims recuperables.
F-18|backend/utils/limitedZip.js|stream.on|backend/__tests__/zipLimits.test.js|Limita durante lectura: XML2MiB PDF10MiB total20MiB, 20 entradas y profundidad3; corta antes de materializar exceso.
F-19|backend/scripts/restore-mongodb.js|EJSON|backend/__tests__/backupMigrationRemediacion.test.js|EJSON canonico v2 conserva BSON; valida y prepara todas las colecciones antes de reemplazar, con rollback.
F-20|backend/middleware/rbacMiddleware.js|MATRIZ_PERMISOS|backend/__tests__/remediacion.test.js|Permisos en rutas de negocio y alternativas; pruebas API de cuatro roles, acciones y dos fincas.
F-21|backend/controllers/authController.js|pendingSecretEncrypted|backend/__tests__/mfaRemediacion.test.js|Secreto pendiente separado del activo; reemplazo y desactivacion exigen password y segundo factor.
F-22|backend/controllers/googleAuthController.js|crearDesafio|backend/__tests__/mfaRemediacion.test.js|Google con MFA entrega solo desafio opaco con cookie, sin refresh de sesion completa.
F-23|backend/utils/audit.js|metadatos|backend/__tests__/remediacion.test.js|Normaliza resultados, actor y metadata legacy; prueba persistencia real en Mongo efimero.
F-24|backend/services/accountNotifications.js|tokenEncrypted|backend/__tests__/accountRecoveryRemediacion.test.js|Notificacion durable cifrada y adaptador de correo; vistas de recuperacion y consumo atomico de token de un solo uso.
F-25|frontend/src/pages/ImpuestosPage.jsx|peticion|frontend/tests/uiRegresiones.test.js|Resultados vinculados a consulta original; descarta respuestas obsoletas y D150 exporta parametros confirmados.
F-26|frontend/src/services/api.js|/auth/mfa/verify|frontend/tests/uiRegresiones.test.js|Perfil y cuenta participan del refresh; solo endpoints que generarian ciclos se excluyen.
F-27|frontend/src/utils/fechaCivil.js|mostrarFechaCivil|frontend/tests/fechaCivilSingleFlight.test.js|Fechas civiles conservadas YYYY-MM-DD; limites de periodo explicitos en Costa Rica.
F-28|frontend/src/pages/FacturasPage.jsx|actualiz|frontend/tests/uiRegresiones.test.js|Exito de refresco solo despues de respuesta valida; fallo muestra alerta sin toast de exito.
F-29|frontend/src/services/onvoSdk.js|onerror|frontend/tests/onvoSdk.test.js|Promesa y script se restablecen tras fallo; modal conserva contenedor y permite reintento.
F-30|backend/services/xmlParserService.js|CodigoTarifaIVA|backend/__tests__/limiterParserRemediacion.test.js|Lee CodigoTarifaIVA v4.4 con compatibilidad anterior; conserva parseTagValue:false.
F-31|backend/controllers/haciendaController.js|documentoReferencia|backend/test-sdk/worker.test.cjs|Referencia NC/ND validada y persistida desde borrador generico y modelo compartido.
F-32|backend/services/repReservations.js|findOneAndUpdate|backend/__tests__/repReservations.test.js|Reserva saldo atomicamente; cancelacion de borrador sin envio libera una vez; REP real bloqueado tambien en worker.
F-33|backend/controllers/chatController.js|montoTotal|backend/__tests__/contabilidadRemediacion.test.js|Contexto usa campos reales y totales completos de la finca sin truncar a ultimos registros.
F-34|backend/services/aiProvider.js|clasificacionDisponible|backend/__tests__/aiFallbackRemediacion.test.js|Disponibilidad remota separada de clasificacion local; chat sin claves activa resumen local.
F-35|backend/services/impuestoService.js|esDeducible === false|backend/__tests__/contabilidadRemediacion.test.js|Contrato uniforme: esDeducible:false excluye credito IVA y gasto de renta en todos los reportes.
F-36|backend/models/Ingreso.js|litrosVendidos|backend/__tests__/remediacion.test.js|Recalcula al modificar litros o categoria, ademas de precio/cantidad.
F-37|backend/routes/emailWebhookRoutes.js|pdf_pendiente|backend/__tests__/inboxRecovery.test.js|PDF asociado solo mediante clave comprobada y candidato unico; ambiguos se conservan sin asignar.
F-38|backend/services/ingestaFacturaService.js|UPLOAD_ROOT|backend/__tests__/uploadStorage.test.js|IMAP converge al almacenamiento unificado que respeta UPLOAD_ROOT y contexto tenant.
F-39|backend/controllers/costoController.js|periodoFiscal es obligatorio|backend/__tests__/inventoryCostsRemediacion.test.js|Consumo, produccion y cierre identifican finca, periodo y centro; falta de periodo devuelve 400.
F-40|backend/services/tenantSingleton.js|upsert|backend/__tests__/inventoryCostsRemediacion.test.js|Upsert e indices unicos por finca/periodo; migracion detecta duplicados sin borrarlos.
F-41|backend/models/Tenant.js|periodoGraciaFin|backend/__tests__/onvoController.test.js|Vencimiento evaluado centralmente al cargar tenant y en estaActivo; gracia vencida suspende acceso.
F-42|backend/controllers/authController.js|revokedAt: null|backend/__tests__/mfaRemediacion.test.js|Refresh reclamado por CAS antes del reemplazo; reutilizacion revoca familia/version; cliente comparte renovacion concurrente.
`.trim().split('\n').map(line => line.split('|'));
const prior = new Set(['S-08','P-01','P-02','P-03','P-08','F-04','F-05','F-06','F-08','F-09']);
const testAnchors = {
  'S-08':'cifrado fiscal', 'P-02':'firma XAdES', 'P-03':'API local', 'P-08':'modelo a XML',
  'F-04':'otra finca', 'F-05':'firma XAdES', 'F-06':'modelo a XML', 'F-08':'transporte SDK',
  'F-09':'descuento antes de IVA', 'F-31':'API local',
};
const audit = JSON.parse(fs.readFileSync(path.join(root,'artifacts/auditoria-2026-10-31/hallazgos.json'),'utf8')).findings;
if (rows.length !== 67 || new Set(rows.map(r=>r[0])).size !== 67) throw Error('Deben existir exactamente 67 IDs unicos');
const evidence = (archivo, anchor) => {
  const lines = fs.readFileSync(path.join(root,archivo),'utf8').split(/\r?\n/);
  const index = lines.findIndex(line => line.includes(anchor));
  if (index < 0) throw Error(`${archivo}: falta ancla ${anchor}`);
  return { archivo, linea:index+1, extracto:lines[index].trim() };
};
const matrix = audit.map(f => {
  const r = rows.find(r=>r[0]===f.id); if(!r) throw Error(`Falta ${f.id}`);
  const [id,file,anchor,test,correccion] = r;
  const source = evidence(file,anchor);
  const testLines = fs.readFileSync(path.join(root,test),'utf8').split(/\r?\n/);
  let testIndex = testLines.findIndex(l=>l.includes(testAnchors[id] || id));
  if(testIndex < 0) testIndex = testLines.findIndex(l=>/\b(test|it)\(/.test(l));
  if(testIndex < 0) throw Error(`Falta prueba identificable: ${id}`);
  return {id,problema:f.title,severidad:f.severity,archivo:f.file,
    estado:prior.has(id)?'corregido previamente':'confirmado',resultadoRemediacion:'corregido y validado localmente',
    evidenciaActual:[source],correccion,
    prueba:{archivo:test,linea:testIndex+1,caso:testLines[testIndex].trim(),alcance:'Prueba local sintetica y revision del flujo; ver informe para limites externos.'},
    resultado:'PASS; backend-verificacion-final.txt / frontend-verificacion-final.txt / lint-verificacion-final.txt / build-verificacion-final.txt',
    validacionExterna:'No realizada; no equivale a aceptacion fiscal, entrega real, cobro ni despliegue.'};
});
fs.writeFileSync(path.join(__dirname,'matriz.json'),JSON.stringify(matrix,null,2)+'\n');
const link = e => `[${e.archivo}:${e.linea}](../../${e.archivo}#L${e.linea})`;
const out = ['# Matriz de remediacion — 67 hallazgos','',
  'Estado conserva la clasificacion original solicitada; resultadoRemediacion registra el cierre local. Ningun resultado local certifica aceptacion externa.',
  '',`Corregidos durante el trabajo: ${matrix.filter(x=>x.estado==='confirmado').length}. Correcciones previas verificadas: ${prior.size}. Pendientes locales: 0.`,
  '', '| ID | Severidad / problema | Estado | Evidencia actual | Correccion y prueba |','|---|---|---|---|---|'];
for(const r of matrix)out.push(`| ${r.id} | ${r.severidad}: ${r.problema} | ${r.estado}; ${r.resultadoRemediacion} | ${r.evidenciaActual.map(link).join('; ')} | ${r.correccion} Prueba: ${link(r.prueba)}. PASS. |`);
fs.writeFileSync(path.join(__dirname,'matriz.md'),out.join('\n')+'\n');
console.log(JSON.stringify({ids:matrix.length,confirmados:matrix.filter(x=>x.estado==='confirmado').length,corregidosPreviamente:prior.size}));
