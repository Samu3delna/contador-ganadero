# Remediación de los 67 hallazgos

Fecha de cierre local: 2 de noviembre de 2026. Proyecto: ContadorGanadero. Auditoría original: 31 de octubre de 2026.

Se contrastaron los 67 IDs originales con el código actual y se implementaron sus correcciones locales. La [matriz Markdown](matriz.md) y la [matriz JSON](matriz.json) contienen problema, severidad, evidencia con archivo/línea, estado, corrección y prueba por ID. Hay 57 hallazgos confirmados corregidos durante este trabajo y 10 correcciones previas verificadas: S-08, P-01, P-02, P-03, P-08, F-04, F-05, F-06, F-08 y F-09. No quedan abiertos los escenarios locales de esos 67 hallazgos; esto no certifica ausencia de otros errores ni aceptación externa.

Los estados conservan `confirmado` y `corregido previamente`; `resultadoRemediacion` registra el cierre posterior de los confirmados. No se descartó ningún hallazgo por suposición ni se cerró automáticamente por existir el SDK. `node artifacts/remediacion/generar-matriz.cjs` regenera referencias y verifica los 67 IDs, archivos, anclas y pruebas.

## Resultados por grupo

| Grupo | Cambios y evidencia |
|---|---|
| Seguridad, permisos y autenticación | Chat por usuario/finca; permisos en API y rutas heredadas; D-150 por plan; alias exactos; CSV neutralizado antes de escapar; ZIP limitado durante lectura; desafío MFA común contraseña/Google; secreto pendiente separado; refresh atómico; auditoría persistente. Pruebas: `remediacion`, `mfaRemediacion`, `limiterParserRemediacion`, `zipLimits`, `security/tenantIsolation` y `uiRegresiones`. Incluyen cuatro roles, dos fincas, códigos de recuperación y renovaciones concurrentes. |
| Pagos y cuotas | ONVO con lease, recuperación y ledger atómico de efectos sobre tenant; cancelación deja free activo; ciclo mensual Costa Rica y gracia vencida; AuthContext sincronizado; SDK de checkout recuperable. Pruebas: `onvoController`, `onvoSdk`, `uiRegresiones`, con ONVO simulado y fallos intermedios. |
| Datos e ingesta | Persistencia por adjunto antes de éxito; recuperación tras reinicio; IMAP unificado y UPLOAD_ROOT; PDF por identidad; fotos sin guardado ficticio; eliminación durable con fallos recuperables; migraciones reanudables; respaldo/restauración BSON v2. Pruebas: `inboxRecovery`, `deletionRecovery`, `backupMigrationRemediacion`, `ingestaFacturaService`, `uploadStorage`. Incluyen dry-run sin escrituras, idempotencia y ObjectId/Date/Binary/Long. |
| Facturación y SDK | Conserva SDK 0.12.1, firma XAdES, XML, claves, credenciales por finca, TE opcional y cálculos previos. Corrige parser, referencias NC/ND y reserva atómica REP. API heredada no puede inventar aceptación. Pruebas: `test-sdk/sdk.test.cjs`, `test-sdk/worker.test.cjs`, `repReservations`. XSD, certificado sintético y verificación matemática local; POST incierto consultado sin repetirlo. |
| Contabilidad e IA | Fuentes compartidas; ventas aceptadas y manuales deduplicadas; CRC una vez; NC negativa; base neta y exoneraciones con ceros explícitos; alcance tenant completo; litros recalculados; cascada Gemini/NVIDIA/heurística y chat local. Pruebas: `contabilidadRemediacion`, `aiFallbackRemediacion`, `remediacion`, con fixtures contrastados entre IVA, renta, D-150, exportación y chat. |
| Frontend, inventario y configuración | envDir raíz con VITE_; guard inmediato de guardado; etiquetas accesibles; agregados completos/paginación visible; respuestas fiscales obsoletas descartadas; fechas civiles; refresco veraz; recuperación de cuenta durable; unidades normalizadas e identidad única por finca/período. Pruebas: `uiRegresiones`, `fechaCivilSingleFlight`, `viteEnv`, `paginationDates`, `accountRecoveryRemediacion`, `inventoryCostsRemediacion`; lint y build completos. |

Pruebas backend en `backend/__tests__/`, frontend en `frontend/tests/`, salvo SDK. La matriz enlaza cada caso y su código.

## Validación final

| Control | Resultado | Registro |
|---|---|---|
| `npm test` backend | 251 pruebas Jest, 33 suites; 26 pruebas SDK; cero fallos | [Backend](validacion/backend-verificacion-final.txt) |
| `npm test` frontend | 57 pruebas; cero fallos | [Frontend](validacion/frontend-verificacion-final.txt) |
| `npm run lint` frontend | Salida 0, cero errores y advertencias | [Lint](validacion/lint-verificacion-final.txt) |
| `npm run build` frontend | Salida 0; genera `frontend/dist` | [Build](validacion/build-verificacion-final.txt) |
| `git diff --check` | Salida 0 | [Diff](validacion/diff-check-final.txt) |

Se usaron MongoDB efímero, certificados sintéticos, proveedores simulados y datos de prueba. No se probaron secretos, certificados ni bases productivas. No se desplegó, publicó, cobró, envió correo/WhatsApp real ni emitió comprobante real. El build compila la configuración pública existente; no se publicaron sus archivos.

Los logs de intentos anteriores se conservan, incluidos fallos que condujeron a correcciones. Los registros `verificacion-final` son la referencia vigente. La suite informa una advertencia existente de índice duplicado `fecha` y el build avisa de chunks mayores de 500 kB; no son fallos de los controles. Las advertencias Git LF/CRLF no son errores del diff.

La [revisión final](validacion/revision-final.md) registra los contratos comprobados en el diff y las rutas alternativas. Las pruebas frontend usan componentes reales con JSDOM y adaptadores simulados; no equivalen a un recorrido en navegador real Cloudflare/Render.

La prueba existente de aislamiento de costos ahora envía `periodoFiscal` obligatorio y conserva todas sus comprobaciones de permisos, aislamiento y FCA. Una nueva regresión verifica 400 al omitirlo y que referencias repetidas en dos años modifican solamente el año indicado. No se eliminaron pruebas ni se rebajaron expectativas para esconder fallos.

## Contratos y restricciones

Se conserva `@dojocoding/hacienda-sdk@0.12.1`, `parseTagValue: false`, contadores y outbox MongoDB. Un POST incierto se consulta por la misma clave, sin repetir envío. Errores HTTP no constituyen rechazo fiscal. XSD, firma y OAuth son controles independientes de aceptación fiscal. REP real permanece bloqueado en rutas y worker; las reservas se ejercitan solo en simulación local.

Se preservan CORS dinámico, `withCredentials`, cookies de producción, planes free/pro y webhook ONVO antes de `express.json()`. Se mantuvo el trabajo SDK y ajeno del árbol inicial, sin revertirlo ni crear commits de esos cambios.

Contrato del producto: `esDeducible:false` no genera crédito IVA ni gasto deducible en renta. El documento continúa en totales de gasto y exportaciones con su clasificación. Los reportes normalizan una proyección sin reescribir XML histórico.

Consumo, producción y cierre de centro exigen `periodoFiscal` en cuerpo o query, además de referencia y finca autenticada. No había consumidores frontend de esas mutaciones. Se mantienen URLs; los listados añaden controles visibles y `/api/facturas/resumen` calcula agregados antes de paginar.

El worker recupera leases vencidos de ingesta, ONVO y notificaciones. Los PDF ambiguos quedan `sin_asignar`. La eliminación registra progreso/fallos y admite reanudación interna, sin un endpoint público para ejecutar códigos arbitrarios.

## Validaciones externas y pasos operativos pendientes

Requieren entorno y autorización separados; no fueron ejecutados en esta remediación.

1. En una copia de ensayo aislada, respaldar y ejecutar primero con `--dry-run`: `scripts/migrateTenant.js`, `utils/migrateNewCollections.js`, `scripts/migrateCryptoGcm.js` y `scripts/migrateInventoryIdentity.js`, desde backend. Revisar informes antes de aplicar sin ese flag y repetir después para verificar idempotencia. Conflictos de inventario/costos bloquean con salida 2: conciliar manualmente sin eliminar datos automáticamente.
2. Secretos con AAD antiguo incompatible requieren sustitución explícita de credenciales/certificado de esa finca. Revisar `pendientesReconfiguracion`; no intentar fallback global ni trasladar secretos entre fincas.
3. Ensayar backup con `node scripts/backup-mongodb.js --output-dir=<directorio-de-ensayo> --dry-run`, luego crear copia y conservar `.cgbk`, `.sha256` y llave fuera del repositorio. Ensayar restore con `node scripts/restore-mongodb.js --file=<copia> --dry-run`; `--confirm-restore` permite escribir únicamente en el destino designado. EJSON v2 preserva tipos e índices. Legacy ambiguo exige conversión revisada. Detener escritores y mantener copia previa durante restore: los reemplazos entre colecciones no son una transacción frente a caída abrupta. Inspeccionar `_cgr_restore_*` si el proceso se interrumpe.
4. Configurar adaptador de correo y `FRONTEND_URL` en ensayo. `ACCOUNT_EMAIL_DELIVERY_ENABLED=true` habilita explícitamente entrega automática; por defecto no se envía. Validar entrega/expiración/uso único en buzones autorizados; localmente el remitente es simulado. El adaptador se alineó con la [API REST oficial de Cloudflare Email Service](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/).
5. Validar ONVO real en su entorno de pruebas autorizado: secreto de webhook, reentrega, pago, cancelación y checkout. Revisar eventos sin tenant y cancelaciones anteriores que requieran conciliación. No se realizaron cargos.
6. Validar aceptación fiscal sandbox por tipo y caso. OAuth/certificado, firma y XSD no demuestran aceptación. Mantener REP real deshabilitado hasta validar el tratamiento monetario/fiscal. Revisar firmas del motor anterior, claves inciertas y reservas REP huérfanas; no repetir POST para recuperarlas.
7. Antes de un despliegue separado, verificar índices únicos y flujo Cloudflare/Render con cookies cross-origin en ensayo. Conservar CORS y webhooks. Este trabajo no incluye despliegue.

Los entregables permanecen en el proyecto y se guardan también como bundle Deska si el servicio está disponible. No se utilizan paneles comunitarios como sustituto.
