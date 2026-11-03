---
name: hacienda-cr-v44
description: >-
  Guía técnica y procedimientos para el módulo de Facturación Electrónica v4.4 del Ministerio de Hacienda de Costa Rica en ContadorGanadero. Úsese siempre que se trabaje con comprobantes electrónicos (FE, TE, NC, ND, FEC, REP), generación de clave numérica de 50 dígitos, builders XML v4.4, firma digital XAdES-EPES (.p12), parseo de XML recibidos, cifrado AES-256 de credenciales por tenant o el worker asíncrono de Hacienda.
---

# Facturación Electrónica Hacienda CR v4.4 (`hacienda-cr-v44`)

Esta skill define las reglas estrictas, arquitectura y procedimientos para modificar o extender el módulo de Facturación Electrónica v4.4 del Ministerio de Hacienda de Costa Rica en **ContadorGanadero**.

## Archivos Clave del Módulo

- `backend/services/hacienda/clave50.js`: Generación de clave numérica de 50 dígitos y consecutivo de 20 dígitos.
- `backend/services/hacienda/xmlBuilder.js`: Construcción de XML v4.4 para emisión de comprobantes.
- `backend/services/hacienda/signer.js`: Firma XAdES-EPES mediante `@dojocoding/hacienda-sdk@0.12.1`, con `.p12` descifrado solo en memoria.
- `backend/services/hacienda/sdkAdapter.js`: puente ESM/CommonJS, ambientes y OAuth aislado por tenant.
- `backend/services/hacienda/auth.js`: Autenticación OAuth2 contra IDP de Hacienda (`stag` / `prod`).
- `backend/services/hacienda/recepcion.js`: Envío y consulta de estado de comprobantes ante el API de Recepción.
- `backend/services/haciendaWorker.js`: Worker asíncrono para firmar, enviar y hacer polling de documentos en `FacturaEmision`.
- `backend/services/xmlParserService.js`: Parseo de XML recibidos (compras/gastos y `MensajeHacienda`).
- `backend/models/FacturaEmision.js`: Modelo Mongoose de comprobantes emitidos.
- `backend/utils/crypto.js`: AES-256-GCM con AAD de tenant/campo para secretos nuevos; lectura CBC heredada.
- `docs/PENDIENTES_HACIENDA.md`: Hoja de ruta técnica detallada y checklist de sandbox.

## Reglas Inquebrantables

1. **Parseo de XML Recibidos (`xmlParserService.js`)**:
   - **NUNCA** cambiar `parseTagValue: false` en `fast-xml-parser`. Es indispensable para preservar claves numéricas de 50 dígitos, consecutivos de 20 dígitos y códigos CABYS/cédulas con ceros a la izquierda sin que JavaScript los trunque a `Number`.
2. **Estructura de los 6 Tipos de Comprobantes v4.4**:
   Cada tipo de documento requiere su propio nodo raíz y namespace oficial v4.4:
   - `01` FE: `<FacturaElectronica>` — `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica`
   - `02` ND: `<NotaDebitoElectronica>` — `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica`
   - `03` NC: `<NotaCreditoElectronica>` — `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica`
   - `04` TE: `<TiqueteElectronico>` — `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico` (receptor opcional).
   - `08` FEC: `<FacturaElectronicaCompra>` — `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaCompra`. En XML, Emisor es proveedor y Receptor es comprador; clave y firma corresponden al comprador.
   - `10` REP: `<ReciboElectronicoPago>` — `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/reciboElectronicoPago`. Es distinto de `MensajeReceptor`. Condición 09/11 y referencia 17; emisión real bloqueada hasta validar los importes de pagos.
   - Fuente normativa: [anexo oficial v4.4](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/S/2020-2029/2020-2024/2024/1936C/1701B7.HTML). No restaurar los códigos ni namespaces incorrectos de versiones anteriores de esta skill.
3. **Firma Digital XAdES-EPES (`signer.js`)**:
   - Al soportar múltiples tipos de comprobantes, asegurarse de que la inserción del nodo `<ds:Signature>` sea dinámica sobre el nodo raíz (`xpath: '/*'`) y no dependa de `</FacturaElectronica>` hardcodeado en el modo simulado (`local`).
   - La firma es asíncrona: usar `await firmarDocumento(...)`. No cachear llaves descifradas. Invalidar OAuth con `limpiarCacheTokens(tenantId)` al rotar credenciales.
4. **Consecutivos Atómicos**:
   - Evitar colisiones por `Date.now()` usando incrementos atómicos en MongoDB (`findOneAndUpdate` con `$inc`) por `tenantId` y `tipoDocumento`.
   - Reservar antes de firmar, conservar la reserva al reintentar y no resetear contadores al borrar credenciales.
   - El outbox vive en MongoDB. Registrar `enviada_hacienda` antes del POST con compare-and-set; después de un envío incierto solo consultar la misma clave. Un fallo HTTP no constituye rechazo fiscal.
5. **Seguridad y Cifrado (`EMAIL_ENC_KEY`)**:
   - `EMAIL_ENC_KEY` debe tener exactamente 64 caracteres hexadecimales (32 bytes) para que `utils/crypto.js` cifre el `.p12`, el PIN y la contraseña del API de Hacienda.
   - Nunca commitear archivos `.p12` ni `.env` al repositorio.

## Flujo de Validación y Pruebas

1. Ejecutar pruebas unitarias e integración del backend:
   ```bash
   cd backend && npm test
   ```
2. Configurar `tenant.configuracionHacienda.ambiente = 'local'` explícitamente para simulación. No usar credenciales globales como fallback de una finca. Las pruebas SDK reales sin red se ejecutan con `npm run test:hacienda-sdk`.
3. Antes de cambios en builders o firma, revisar `docs/PENDIENTES_HACIENDA.md`.
