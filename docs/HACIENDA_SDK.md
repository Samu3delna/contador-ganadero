# Integración de Hacienda SDK — primera etapa

Fecha: 1 de noviembre de 2026. Dependencia fijada: `@dojocoding/hacienda-sdk@0.12.1`.

La aplicación utiliza el SDK de [DojoCodingLabs/hacienda-cr](https://github.com/DojoCodingLabs/hacienda-cr/releases/tag/v0.12.1) desde el backend Node de Render. MongoDB conserva documentos, consecutivos y estados; el frontend continúa en Cloudflare. No se instala el CLI ni el servidor MCP del repositorio externo.

## Alcance implementado

| Componente | Comportamiento |
| --- | --- |
| Clave y consecutivo | Códigos FE 01, ND 02, NC 03, TE 04, FEC 08, REP 10. Fecha de Costa Rica, situación y seguridad de ocho dígitos mediante SDK. Reserva atómica en MongoDB, sin `Date.now()` ni reinicio al borrar credenciales. |
| XML | Adaptación del modelo a los builders SDK y validación offline contra sus XSD v4.4 antes de firmar. Se conservan actividad, identificación del proveedor del sistema, ubicación, moneda, tipo de cambio y referencias. |
| Cálculo ordinario | Importes calculados en servidor a cinco decimales; descuentos antes del IVA, tarifa coherente con catálogo, factor enviado por cliente ignorado. Pruebas para 0,5 %, 1 %, 2 % y 13 %. Leche/huevo se clasifican por CABYS como mercancías. |
| Firma | `.p12` en memoria, validación de PIN/certificado y firma XAdES-EPES SDK. No se cachean llaves privadas. Firma simulada solo cuando la finca tiene ambiente `local`. |
| OAuth | Caché separada por finca y ambiente, sustituida al cambiar usuario/contraseña e invalidada al guardar o eliminar configuración. No hay fallback a credenciales de otra finca ni a variables globales. |
| Transporte | SDK `submitDocument`/`getStatus`, POST sin reintentos automáticos y URL de consulta construida para el ambiente; no se siguen direcciones arbitrarias de `Location`. Se interpreta `ind-estado` y se conserva el XML de respuesta. |
| Outbox | Compare-and-set antes del primer POST. Dos procesos no toman la misma factura. Una respuesta incierta queda pendiente de consulta, incluso después de reiniciar el proceso. |
| Interfaz | Configuración por finca, carga de `.p12`, datos editables del emisor, ubicación, referencias FEC y plazo de crédito. Se usa la sesión de React, no `localStorage.usuario`. Las dos pantallas de creación usan el mismo contrato y contador. |
| Permisos | Configuración de secretos: dueño/admin. Mutaciones de comprobantes: dueño/admin/contador. Se aplica también en las rutas antiguas de emisión. |

FE, TE, NC, ND y FEC usan este recorrido. Los seis tipos tienen pruebas de estructura XML; esto no implica que Hacienda haya aceptado comprobantes reales de esta integración.

**REP permanece disponible únicamente en simulación local.** Se bloquea tanto en su ruta de creación como al intentar firmar documentos existentes en sandbox/producción. Su distribución de IVA entre pagos parciales, tarifas mixtas y exoneraciones necesita una validación fiscal específica. El builder general y un XML válido no demuestran que esa distribución sea correcta.

El SDK distingue el REP (`ReciboElectronicoPago`) del `MensajeReceptor`. Según el [anexo oficial v4.4](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/S/2020-2029/2020-2024/2024/1936C/1701B7.HTML), los REP usan condiciones 09/11 para originales con 08/10 y referencia de pago 17. La simulación no debe usarse como un registro fiscal de pagos reales.

## Configuración y uso

1. Instalar las dependencias desde la raíz con `bun install --frozen-lockfile`. Se requiere Node 22.12 o posterior, según los engines del proyecto.
2. Conservar la clave de cifrado existente: `EMAIL_ENC_KEY` o `MASTER_KEK_CURRENT` debe contener 64 caracteres hexadecimales. No cambiarla para resolver un error de PIN.
3. Entrar a Hacienda → **Configurar Hacienda** como dueño/admin. Indicar sucursal de tres dígitos, terminal de cinco, actividad económica de seis dígitos y la identificación real del proveedor del sistema. No usar un identificador ficticio en comprobantes reales.
4. Elegir `local` para simulación. Para sandbox, cargar el certificado y credenciales propios de ese ambiente y de la finca. Los secretos vacíos conservan los existentes; una sustitución completa requiere volver a introducir certificado, PIN y contraseña.
5. **Probar configuración guardada** comprueba certificado y OAuth. Nunca envía una factura ficticia. Su éxito no garantiza recepción ni aceptación de un comprobante.
6. Completar datos reales de las partes y CABYS al crear un borrador. La pantalla Hacienda firma y encola; la pantalla Facturación crea el borrador para continuar desde Hacienda. La firma validará los campos faltantes con mensajes visibles.
7. Consultar el estado para confirmar el resultado. `Envío por confirmar` representa un intento que todavía necesita reconciliación; no equivale a aceptación ni rechazo.

Las rutas `/api/hacienda/config`, `/config/test`, `/emision`, `/emision/:id/firmar`, `/emision/:id/enviar`, `/emision/:id/estado` y `/emision/:id/xml` conservan su ubicación. Las rutas de autenticación y webhooks, CORS y cookies no se modificaron.

### FEC

El formulario y la API de creación conservan `emisor = comprador` y `receptor = proveedor` para mantener el contrato de entrada. Al persistir la FEC se adaptan a los roles del XML: `Emisor = proveedor`, `Receptor = comprador`. La clave y la identidad remitente de recepción corresponden al comprador. Deben completarse la identificación, ubicación y correo del proveedor, los datos del comprador, su actividad y un documento de referencia válido. No se convierte automáticamente un productor no inscrito en una identificación extranjera.

### Endpoint sandbox

La versión 0.12.1 contiene una base sandbox antigua. El adaptador aplica exclusivamente a sandbox:

`https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1`

El IDP conserva `rut-stag`. Producción conserva la base oficial de recepción. El cambio sandbox sigue la [investigación publicada por el mantenedor](https://github.com/DojoCodingLabs/hacienda-cr/blob/main/docs/testing/sandbox-403-debug.md); sus pruebas de aceptación no son pruebas ejecutadas por este proyecto.

## Estados y recuperación

```text
borrador → firmada → enviada_hacienda → procesando → aceptada / rechazada
                          │
                          └─ sin confirmación: consultar la misma clave, sin repetir POST
```

`enviada_hacienda` se persiste antes del POST. Si el proceso termina entre esa escritura y el envío, el documento queda conservadoramente pendiente de revisión. Esto sacrifica reenvío automático para impedir duplicados de un comprobante que podría haber sido recibido. No hay botón de reenvío ciego ni recuperación mediante reseteo de contadores.

HTTP 400/401/403/409/429/5xx, un timeout o un fallo de red no se convierten en `rechazada`. Solo una consulta de la misma clave con estado terminal `rechazado` establece rechazo fiscal. Se conservan errores operativos separados y el XML de respuesta de Hacienda.

No se permite cambiar el ambiente ni eliminar credenciales mientras existan documentos firmados o en proceso. El ambiente del documento debe coincidir con el de la configuración para firmar/enviar/consultar. La anulación local se limita a borradores sin firma/intento de envío; el flujo de NC se ofrece para FE/TE aceptadas, en su ambiente original.

## Datos anteriores y puesta en producción

- **Firmas antiguas:** el worker no envía automáticamente documentos sin la marca del nuevo motor. Primero consultar la clave original y revisar su historial. Nunca sustituir una factura posiblemente recibida creando otra sin reconciliación. Los XML históricos no se reescriben.
- **Consecutivos antiguos con tipo incorrecto:** no se modifican silenciosamente al firmar. El error exige revisar el borrador y su historial. Los contadores existentes se conservan, también al borrar credenciales.
- **Cifrado antiguo:** se corrigió la vinculación AAD para usar el identificador real de la finca. Credenciales v2 guardadas anteriormente con AAD `undefined` o global deben sustituirse completas desde la configuración, con certificado/PIN/contraseña originales. No se agrega un fallback que permita copiar secretos entre fincas.
- **Otro emisor o sistema:** antes de emitir, conciliar los consecutivos ya usados por ese contribuyente, sucursal, terminal y tipo. El contador actual es por finca/tipo; no coordina aplicaciones externas ni dos fincas independientes que facturen con la misma identidad fiscal.
- **Prueba necesaria:** ejecutar un ciclo controlado en sandbox con las credenciales del titular y revisar la respuesta XML. Probar cada tipo que vaya a habilitarse, tarifas y redondeos usados por la finca. No se realizaron estos envíos en la implementación local.
- **Etapas posteriores:** REP real; casos especiales y aritmética fiscal completa; conciliación de envíos inciertos con intervención del operador; integración contable de ventas/NC/moneda en declaraciones. La auditoría general contiene incidencias adicionales que esta integración no pretende cerrar.

## Validación automatizada

```powershell
# Desde backend/: Jest existente y pruebas reales del SDK sin llamadas externas
npm test

# Solo SDK, MongoDB efímero y API de integración
npm run test:hacienda-sdk

# Desde frontend/
npm test
npm run lint
npm run build
```

Las pruebas SDK usan un `.p12` sintético generado en memoria, verifican política XAdES, digests, firma RSA y detección de modificaciones; autentican y transportan contra `fetch` simulado sin salida a Hacienda. MongoDB efímero prueba firma local, dos workers concurrentes, recuperación tras POST incierto, aislamiento por finca, reserva concurrente de consecutivos y conservación del contador. Las pruebas API cubren configuración, FE/TE, XML, consultas y permisos.

No se modificó `.env`, no se usaron certificados reales, no se migraron datos de producción, no se publicó ni desplegó. La interfaz fue compilada y revisada con ESLint; no se validó visualmente en un navegador autenticado.

Los resultados locales y el resumen están en `artifacts/hacienda-sdk-2026-11-01/`. Los artifacts de Deska no están disponibles en esta tarea; estos archivos están guardados dentro del proyecto.
