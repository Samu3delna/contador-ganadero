# Facturación electrónica con Hacienda

La aplicación usa la dependencia ya instalada `@dojocoding/hacienda-sdk@0.12.1`. La única pantalla de emisión es `/facturacion`. `/hacienda` redirige allí.

## Flujo

1. Configurar por finca el ambiente, actividad económica, credenciales y certificado `.p12`.
2. Crear un borrador FE, TE, NC o ND con CABYS y datos fiscales completos.
3. Revisar emisor, receptor, líneas, referencia y total; firmar el borrador.
4. Enviar el comprobante firmado una sola vez.
5. Consultar el estado por la misma clave. Un envío pendiente no equivale a aceptación.

Las rutas autenticadas `/api/hacienda/config`, `/config/test`, `/emision`, `/emision/:id/firmar`, `/emision/:id/enviar`, `/emision/:id/estado` y `/emision/:id/xml` siguen vigentes. `/api/facturacion` ofrece historial y resumen de solo lectura.

FEC y REP existentes permanecen en el historial. Sus borradores y documentos firmados no pueden enviarse. Los documentos ya enviados permiten consulta de estado y descarga de XML por su misma clave. No hay creación nueva de FEC o REP ni rutas `/api/hacienda/fec` o `/api/hacienda/rep`.

## Seguridad y recuperación

La configuración y las consultas usan el contexto `tenantId`. Certificado y credenciales se cifran por finca. Los consecutivos se reservan de forma atómica. El worker persiste `enviada_hacienda` antes del POST; ante resultado incierto se consulta la clave original y no se reenvía automáticamente.

El ambiente del comprobante debe coincidir con el de la configuración. La firma genera XML y XAdES; la consulta conserva la respuesta de Hacienda. Las pruebas locales con un `.p12` sintético no demuestran aceptación real. Antes de usar producción se necesita un ciclo controlado por tipo en sandbox con credenciales del titular.

## Verificación

Desde `backend/`: `npm test` y `npm run test:hacienda-sdk`. Desde `frontend/`: `npm test`, `npm run lint` y `npm run build`.
