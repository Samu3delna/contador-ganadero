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
- `backend/services/hacienda/signer.js`: Firma digital XAdES-EPES (`node-forge` + `xml-crypto`) con llave criptográfica `.p12`.
- `backend/services/hacienda/auth.js`: Autenticación OAuth2 contra IDP de Hacienda (`stag` / `prod`).
- `backend/services/hacienda/recepcion.js`: Envío y consulta de estado de comprobantes ante el API de Recepción.
- `backend/services/haciendaWorker.js`: Worker asíncrono para firmar, enviar y hacer polling de documentos en `FacturaEmision`.
- `backend/services/xmlParserService.js`: Parseo de XML recibidos (compras/gastos y `MensajeHacienda`).
- `backend/models/FacturaEmision.js`: Modelo Mongoose de comprobantes emitidos.
- `backend/utils/crypto.js`: Cifrado `AES-256-CBC` para credenciales `.p12` y PIN de Hacienda por tenant.
- `docs/PENDIENTES_HACIENDA.md`: Hoja de ruta técnica detallada y checklist de sandbox.

## Reglas Inquebrantables

1. **Parseo de XML Recibidos (`xmlParserService.js`)**:
   - **NUNCA** cambiar `parseTagValue: false` en `fast-xml-parser`. Es indispensable para preservar claves numéricas de 50 dígitos, consecutivos de 20 dígitos y códigos CABYS/cédulas con ceros a la izquierda sin que JavaScript los trunque a `Number`.
2. **Estructura de los 6 Tipos de Comprobantes v4.4**:
   Cada tipo de documento requiere su propio nodo raíz y namespace oficial v4.4:
   - `01` (**FE** - Factura Electrónica): `<FacturaElectronica>` — `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica`
   - `02` (**TE** - Tiquete Electrónico): `<TiqueteElectronico>` — `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/tiqueteElectronico` (Receptor opcional)
   - `03` (**NC** - Nota de Crédito): `<NotaCreditoElectronica>` — `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/notaCreditoElectronica` (Requiere `<InformacionReferencia>` obligatorio)
   - `04` (**ND** - Nota de Débito): `<NotaDebitoElectronica>` — `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/notaDebitoElectronica` (Requiere `<InformacionReferencia>` obligatorio)
   - `05` (**FEC** - Factura Electrónica de Compra): `<FacturaElectronicaCompra>` — `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronicaCompra` (Para compras a productores no inscritos; usa `<IdentificacionExtranjera>` cuando `receptor.noInscrito === true`)
   - `06` (**REP** - Recibo Electrónico de Pago / Mensaje Receptor): `<MensajeReceptor>` — `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/mensajeReceptor`
3. **Firma Digital XAdES-EPES (`signer.js`)**:
   - Al soportar múltiples tipos de comprobantes, asegurarse de que la inserción del nodo `<ds:Signature>` sea dinámica sobre el nodo raíz (`xpath: '/*'`) y no dependa de `</FacturaElectronica>` hardcodeado en el modo simulado (`local`).
   - El cache de llaves en memoria (`_keyCache`) se indexa por `tenantId` o ruta; llamar a `limpiarCacheLlave(tenantId)` cuando un tenant actualice su `.p12` o PIN.
4. **Consecutivos Atómicos**:
   - Evitar colisiones por `Date.now()` usando incrementos atómicos en MongoDB (`findOneAndUpdate` con `$inc`) por `tenantId` y `tipoDocumento`.
5. **Seguridad y Cifrado (`EMAIL_ENC_KEY`)**:
   - `EMAIL_ENC_KEY` debe tener exactamente 64 caracteres hexadecimales (32 bytes) para que `utils/crypto.js` cifre el `.p12`, el PIN y la contraseña del API de Hacienda.
   - Nunca commitear archivos `.p12` ni `.env` al repositorio.

## Flujo de Validación y Pruebas

1. Ejecutar pruebas unitarias e integración del backend:
   ```bash
   cd backend && npx jest --runInBand
   ```
2. Para probar en modo local (`HACIENDA_AMBIENTE=local`), verificar el ciclo completo: `borrador` -> `firmada` -> `procesando` -> `aceptada`.
3. Antes de cambios en builders o firma, revisar `docs/PENDIENTES_HACIENDA.md`.
