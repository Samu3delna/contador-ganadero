# Documento de Trabajo — Pendientes de Implementación

**Módulo:** Facturación Electrónica v4.4 Hacienda CR + Conciliación D-150
**Estado actual:** Funcional en ambiente LOCAL (mocks). Pendiente de validación en sandbox Hacienda.
**Última actualización:** 2026-07-23

---

## RESUMEN EJECUTIVO

El módulo está construido end-to-end (clave 50 → XML → firma XAdES → OAuth2 → envío → polling → respuesta) y se ejecuta en modo `local` con mocks que simulan las respuestas de Hacienda. Para llegar a `producción` faltan **validaciones reales contra sandbox** y **completar 5 builders XML distintos** (hoy solo existe el de FE).

El orden recomendado de trabajo respeta dependencias: primero obtener credenciales, luego afinar la firma en sandbox (que valida que el XML correcto), después los builders de NC/ND/FEC/REP, y por último robustecer (reintentos, UI de NC). En paralelo se puede dejar corriendo el ambiente local para pruebas del frontend.

---

## BLOQUE 1 — Credenciales y Ambiente (BLOQUEA TODO LO DEMÁS)

No se puede validar absolutamente nada sin las credenciales reales del emisor.

### 1.1 Trámites en TRIBU-CR (no automatizables)
- [ ] Ingresar a https://ovitribucr.hacienda.go.cr con la cédula del emisor (persona física o jurídica dueña de la finca)
- [ ] **Llave criptográfica**: descargar el archivo `.p12` desde "Comprobantes Electrónicos → Administración de Llaves". Guardarlo en `backend/certificados/emisor.p12`
- [ ] **PIN de 14 caracteres**:-lo crea el emisor al generar la nueva llave (debe cumplir: mayúsculas, minúsculas, números y caracteres especiales). Anotarlo en un lugar seguro
- [ ] **Usuario del API**: en "Desarrollos Propios" generar usuario con formato `cpf-01-XXXXXXXXX@comprobanteselectronicos.go.cr` (donde `01` es el tipo de cédula y `XXXXXXXXX` es el número sin guiones)
- [ ] **Contraseña del API**: la que se define al crear el usuario
- [ ] **Datos del emisor completos**: código de actividad (CABYS de 6 dígitos a nivel de empresa, distinto al CABYS de 13 de cada línea), provincia/cantón/distrito exactos, número de teléfono, correo electrónico del emisor (Hacienda lo requiere válido)

### 1.2 Configuración de `.env`
- [ ] Cambiar `HACIENDA_AMBIENTE=local` → `HACIENDA_AMBIENTE=sandbox` en el archivo `.env` (NO en `.env.example`)
- [ ] Completar `HACIENDA_P12_PATH=./backend/certificados/emisor.p12`
- [ ] Completar `HACIENDA_PIN=<pin de 14 caracteres>`
- [ ] Completar `HACIENDA_USUARIO=cpf-01-XXXXXXXXX@comprobanteselectronicos.go.cr`
- [ ] Completar `HACIENDA_PASSWORD=<contraseña del API>`
- [ ] **Peligro de seguridad:** verificar que `.gitignore` cubre `.env` y `*.p12` (ya está cubierto, pero confirmar antes de cualquier commit)

### 1.3 Pruebas de conectividad básica
- [ ] Verificar que el `.p12` abre con el PIN: `openssl pkcs12 -info -in backend/certificados/emisor.p12` (pedirá PIN). Si no abre, el PIN está mal
- [ ] Verificar que el servidor arranca sin errores y el log del worker Hacienda dice `ambiente: sandbox`
- [ ] Hacer un GET a `/api/hacienda/ambiente` con JWT válido y verificar que `p12Configurado: true` y `usuarioConfigurado: true` aparecen en la respuesta

---

## BLOQUE 2 — Validación de Firma XAdES-EPES en Sandbox

La firma es lo que más se presta a rechazos por parte de Hacienda. Se debe afinar antes de mandar cualquier NC/ND/FEC/REP.

### 2.1 Emisión de un FE de prueba
- [ ] Desde el frontend (`/hacienda`), crear una FE de prueba con un receptor conocido (se puede usar la propia cédula del emisor como receptor)
- [ ] El frontend debe llamar automáticamente al endpoint `/firmar` (ya lo hace)
- [ ] Verificar en el log del backend que no hubo errores en `signer.js` (parseo del `.p12`, firma con `xml-crypto`)
- [ ] Descargar el XML firmado desde el botón "Descargar XML" y abrirlo en un navegador para verificar que el nodo `<ds:Signature>` está presente y dentro de `<FacturaElectronica>`

### 2.2 Envío a Hacienda y verificación de aceptación
- [ ] El worker automáticamente encola el envío. Verificar en el log que aparezca algo como `enviado <clave> -> Location: https://...`
- [ ] Hacienda debe devolver HTTP 201 Created con cabecera `Location`
- [ ] Esperar entre 5 y 60 segundos. El worker consulta el estado. Debe llegar a `aceptado`
- [ ] Si Hacienda devuelve **HTTP 400** con `indEstado: rechazado`, anotar el detalle del error (idError, descripcion). Los más comunes:
  - **Error 23**: XML mal formado ( namespaces mal declarados, atributos faltantes)
  - **Error 42**: Firma inválida (XAdES mal estructurada, prefixes incorrectos)
  - **Error 28**: La clave numérica no coincide con el emisor
  - **Error 25**: Consecutivo no coincide con el tipo de documento declarado

### 2.3 Ajustes posibles en el código (si hay rechazos por firma)
- [ ] En `backend/services/hacienda/signer.js`, función `firmarXml()`:
  - Si Hacienda rechaza por prefix `xades:`, agregar el nodo `QualifiedProperties` manualmente con los datos del certificado (SerialNumber, X509IssuerName, X509SerialNumber)
  - Si rechazan por canonicalización, probar `http://www.w3.org/2001/10/xml-exc-c14n#` en lugar de `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`
  - Si rechazan por `Reference URI=""`, probar con `Reference URI="#SignedProperties` y agregar `ds:SignedInfo` con id explícito
- [ ] Validar el XML contra el XSD oficial de Hacienda (descargable desde `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica_V4.4.xsd`) antes de firnar, para detectar errores de schema antes del envío

### 2.4 Validación opcional con herramienta externa
- [ ] Subir el XML firmado a https://caracteres.hacienda.go.cr/ ATV → Consulta de Documento → Revisión. Si Hacienda lo acepta ahí, nuestro API también lo aceptará

---

## BLOQUE 3 — Builders XML Distintos para NC / ND / FEC / REP

Hoy `backend/services/hacienda/xmlBuilder.js` solo genera `<FacturaElectronica>` para todos los tipos. Hacienda rechaza cualquier documento cuyo nodo raíz no coincida con el schema declarado. **Este es el bloque funcional más grande pendiente.**

### 3.1 Schema-information de los 6 tipos
| Tipo | Código | Nodo raíz XML | Namespace (v4.4) | Schema XSD |
|------|--------|---------------|------------------|------------|
| FE   | 01     | `<FacturaElectronica>` | `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronica` | `facturaElectronica_V4.4.xsd` |
| TE   | 02     | `<TiqueteElectronico>` | `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/tiqueteElectronico` | `tiqueteElectronico_V4.4.xsd` |
| NC   | 03     | `<NotaCreditoElectronica>` | `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/notaCreditoElectronica` | `notaCreditoElectronica_V4.4.xsd` |
| ND   | 04     | `<NotaDebitoElectronica>` | `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/notaDebitoElectronica` | `notaDebitoElectronica_V4.4.xsd` |
| FEC  | 05     | `<FacturaElectronicaCompra>` | `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/facturaElectronicaCompra` | `facturaElectronicaCompra_V4.4.xsd` |
| REP  | 06     | `<MensajeReceptor>` (es un "Mensaje", no un comprobante) | `https://cdn.comprobanteselectronicos.go.cr/xml/v4.4/mensajeReceptor` | `mensajeReceptor_V4.4.xsd` |

> **Atención sobre el REP:** técnicamente el REP es un "Mensaje Receptor" que el emisor original le envía a Hacienda cuando cobra una venta a crédito. No es un comprobante nuevo; es un mensaje ligado a una FE previa. Tiene una estructura muy distinta a los demás (no tiene `<LineaDetalle>`, sino nodos `<DetalleMensaje>` con monto fijo).

### 3.2 Refactor del `xmlBuilder.js`
- [ ] Crear función `buildXml(factura)` que despache al builder correcto según `factura.tipoDocumento`:
  - `FE` → función existente `buildFacturaElectronica()`
  - `TE` → función nueva `buildTiqueteElectronico()` (muy similar a FE pero sin receptor obligatorio)
  - `NC` → función nueva `buildNotaCredito()` (obligatorio `<InformacionReferencia>`, nodo `<MontoTotalImpuestoAcreditar>` y `<TotalComprobante>`)
  - `ND` → función nueva `buildNotaDebito()` (similar a NC, ajustando los tags de impuesto a acreditar/recargar)
  - `FEC` → función nueva `buildFacturaElectronicaCompra()` (no tiene receptor, el emisor asume el rol de comprador; requiere `<InformacionReferencia>` del documento físico XML del vendedor si existiera)
  - `REP` → función nueva `buildMensajeReceptor()` (estructura completamente distinta, no hereda de FE)
- [ ] Cada builder debe respetar los namespaces oficiales y los nodos obligatorios del schema
- [ ] Actualizar `backend/services/hacienda/signer.js` línea 129 donde se hardcodea `</FacturaElectronica>` — debe detectar dinámicamente el nodo raíz o recibirlo como parámetro
- [ ] Validar que el builder del REP acepta tanto "Mensaje de Aceptación" (cuando el receptor acepta una FE recibida) como "Mensaje de Pago" (cuando el emisor original de FE cobró un crédito) — actualmente la app solo necesita el segundo caso

### 3.3 Pruebas en sandbox (una vez listo el refactor)
- [ ] Emitir una FE de prueba a crédito (condición 02), aceptada
- [ ] Emitir una NC ligada a esa FE (validar que `documentoReferencia` se inyecta correctamente)
- [ ] Emitir un REP sobre la misma FE con monto parcial
- [ ] Emitir una FEC por una compra ficticia a un vendedor con cédula conocida
- [ ] Confirmar que cada tipo llega a `aceptado` en sandbox y el consecutivo tiene el dígito de tipo correcto (posición 9-10 del consecutivo: 01 FE, 02 TE, 03 NC, 04 ND, 05 FEC, 06 REP)

---

## BLOQUE 4 — UI/UX de Notas de Crédito (Anulación)

El controller `cancelarDocumento` hoy solo devuelve instrucciones; no crea la NC automáticamente. Es conveniente tener un flujo de un clic para anular facturas aceptadas.

### 4.1 Backend
- [ ] En `controllers/haciendaController.js`, `cancelarDocumento` debe:
  - Cargar la FE original
  - Crear una nueva FacturaEmision con `tipoDocumento: 'NC'`
  - Copiar emisor/receptor/lineas con montos negativos
  - Setear `documentoReferencia` con la clave de la original y `codigoReferencia: '01'` (anulación)
  - Llamar a `prepararYFirmar` y encolar
  - Marcar la FE original con un flag `anuladaPorNC: <id de la NC>`
- [ ] Validar que la NC solo se pueda emitir si la FE original está en estado `aceptada`

### 4.2 Frontend
- [ ] En `HaciendaPage.jsx` tabla de emisión, agregar botón "Anular" (icono X) solo visible cuando `estado === 'aceptada'`
- [ ] Modal de confirmación: "¿Está seguro que desea anular la factura X por un monto de ₡Y? Esta acción generará una Nota de Crédito que se enviará a Hacienda"
- [ ] Confirmar con motivo (razón de anulación)

### 4.3 Modelo
- [ ] Agregar a `FacturaEmision` campos:
  - `anuladaPor: { type: ObjectId, ref: 'FacturaEmision' }` (NC que anula a esta FE)
  - `anulaA: { type: ObjectId, ref: 'FacturaEmision' }` (esta NC anula a qué FE)

---

## BLOQUE 5 — Datos del Emisor Persistentes (Perfil Fiscal)

Hoy el frontend saca los datos del emisor del `localStorage` del usuario logueado. En producción conviene que estén en MongoDB.

### 5.1 Modelo
- [ ] Crear `backend/models/PerfilFiscalEmisor.js` con campos:
  - nombre, nombreComercial
  - cedula: { tipo, numero }
  - codigoActividad (CABYS de 6 dígitos a nivel de empresa)
  - ubicacion: { provincia, canton, distrito, barrio, otrasSenas }
  - telefono, correo
  - numeroMAG (para REA)
  - regimen (REA / General / Simplificado)
  - sucursal, terminal
  - consecutivoActualFE, consecutivoActualTE, consecutivoActualNC, consecutivoActualND, consecutivoActualFEC, consecutivoActualREP (para no regenerar consecutivos aleatorios)
- [ ] Asociar a `Usuario` con `ref: 'PerfilFiscalEmisor'`

### 5.2 Servicios
- [ ] `services/emisorService.js` que provea:
  - `getNextConsecutivo(tipoDocumento, usuarioId)` — atomicidad MongoDB con `findOneAndUpdate` con `$inc` sobre el contador secuencial. Hoy el código genera consecutivos con `Date.now().slice(-10)`, lo cual puede generar duplicados en alta concurrencia
  - `getEmisor(usuarioId)` que devuelva los datos del perfil fiscal
- [ ] Sustituir en `haciendaController.crearBorrador` y `haciendaWorker.prepararYFirmar` la lectura del emisor desde `localStorage` por una lectura desde MongoDB

### 5.3 UI
- [ ] Pantalla "Mi Perfil Fiscal" dentro de `/hacienda` (puede ser tab o ruta `/hacienda/perfil`)
- [ ] Formulario editable para los datos del emisor
- [ ] Sección de gestión de consecutivos: ver próximo consecutivo por tipo, reset si hace falta (con confirmación)

---

## BLOQUE 6 — Worker Asíncrono Robusto

### 6.1 Backoff exponencial
- [ ] En `services/haciendaWorker.js`, función `enviarPendientes`:
  - Si `resp.retry === true` (Hacienda devolvió 5xx), registrar `fechaProximoIntento = Date.now() + (Math.pow(2, intentos) * 1000)` en el documento
  - En el query `find({ estado: 'firmada' })` agregar filtro `fechaProximoIntento: { $lte: new Date() }`
  - Limitar a 6 reintentos. Si se acaba, marcar como `rechazada` con detalle `Reintentos agotados`
- [ ] Agregar campo al modelo: `intentosEnvio: { type: Number, default: 0 }` y `fechaProximoIntento: { type: Date }`

### 6.2 Reintentos de consulta (`consultarProcesando`)
- [ ] Implementar igual lógica: si el documento lleva más de 24 horas en `procesando`, marcarlo como `rechazada` con mensaje `Timeout — Hacienda no respondió`

### 6.3 Observabilidad
- [ ] Loguear cada transición de estado con `console.log` (ya se hace parcialmente)
- [ ] Opcional: guardar en colección `HaciendaEventLog` cada POST/GET a Hacienda (clave, endpoint, status, respuesta). Útil para auditar

---

## BLOQUE 7 — Conector de Datos del Receptor en FEC no Inscrito

### 7.1 Builder
- [ ] En el builder de FEC (`buildFacturaElectronicaCompra`), si `receptor.cedula.numero` viene vacío o `receptor.noInscrito === true`, usar el nodo `<IdentificacionExtranjera>` en lugar de `<Identificacion>`:
  ```xml
  <Receptor>
    <Nombre>...</Nombre>
    <IdentificacionExtranjera>
      <TipoIdentificacionExtranjera>01</TipoIdentificacionExtranjera>
      <NumeroIdentificacionExtranjera>...</NumeroIdentificacionExtranjera>
      <NombrePaisOrigen>Costa Rica</NombrePaisOringen>
    </IdentificacionExtranjera>
  </Receptor>
  ```

### 7.2 UI
- [ ] En `EmitirComprobanteModal.jsx`, cuando `tipoDoc === 'FEC'`, agregar un checkbox "Vendedor no inscrito en Hacienda" que cambie los campos de receptor del esquema normal al esquema `IdentificacionExtranjera`

---

## BLOQUE 8 — Pruebas automatizadas

No existen tests para los módulos nuevos.

### 8.1 Unit tests mínimos
- [ ] `tests/clave50.test.js`:
  - Genera clave de exactamente 50 dígitos numéricos
  - Genera consecutivo de 20 dígitos con dígito de tipo correcto para FE/TE/NC/ND/FEC/REP
  - Reccha cédula vacía
- [ ] `tests/xmlBuilder.test.js`:
  - Produces XML parses como XML válido (XML.parse no lanza)
  - Para FE: contiene `<FacturaElectronica>`, `<Clave>`, CABYS de 13 dígitos en `<Codigo><Codigo>`
  - Para TE: no contiene `<Receptor>` si no se pasa receptor
- [ ] `tests/d150Service.test.js`:
  - Given N facturas aceptadas en un mes, el detalleVentas agrupa correctamente por tarifa
  - Prorrata: si todas las ventas son gravadas, porcentaje = 100%; si son mitad/mitad, porcentaje = 50%
  - Si no hay ventas/exentas, no divide por cero (retorna porcentaje = 100%)

### 8.2 Integration test con MongoDB memory server
- [ ] `tests/haciendaWorker.test.js`:
  - Crear una FacturaEmision en estado `borrador`
  - Llamar a `prepararYFirmar`
  - Verificar que pasa a `firmada` con XML no vacío
  - Ambiente `local`, llamar a `enviarPendientes`
  - Verificar que pasa a `procesando`
  - Esperar 7 segundos (`MOCK_PROCESANDO_MS = 6000`)
  - Llamar a `consultarProcesando`
  - Verificar que pasa a `aceptada`

---

## BLOQUE 9 — Documentación

### 9.1 Manual de operación
- [ ] Documento `docs/HACIENDA.md` con:
  - Cómo obtener credenciales en TRIBU-CR
  - Cómo configurar el `.env`
  - Cómo hacer la primera prueba en sandbox
  - Tabla de códigos de error de Hacienda y qué hacer con cada uno
  - Cómo leer el log del worker

### 9.2 README principal
- [ ] Actualizar el README de la raíz para mencionar el módulo de Hacienda (hoy describe Facturación REA 1% pero no la integración v4.4 nativa)

---

## ORDEN RECOMENDADO DE EJECUCIÓN

| Prioridad | Bloque | Esfuerzo estimado | Bloquea a |
|-----------|--------|-------------------|-----------|
| 🔴 P0     | 1.1, 1.2 | 2-4 horas (trámites) | No código, pero sin esto nada se valida |
| 🔴 P0     | 2.1, 2.2 | 2 horas | 2.3, 3 |
| 🟠 P1     | 2.3 (si hay rechazos) | 4-12 horas (depende del error) | 3 |
| 🟠 P1     | 3.1, 3.2 (NC + REP mínimo) | 8 horas | 4 |
| 🟡 P2     | 3 (TE, ND, FEC completos) | 6 horas | 7 |
| 🟡 P2     | 4 (UI anulación) | 4 horas | nada |
| 🟡 P2     | 5 (perfil fiscal) | 6 horas | nada |
| 🟢 P3     | 6 (worker robusto) | 4 horas | nada |
| 🟢 P3     | 7 (FEC no inscrito) | 2 horas | nada |
| 🟢 P3     | 8 (tests) | 8 horas | nada |
| 🟢 P3     | 9 (docs) | 4 horas | nada |

**Total estimado: 50-60 horas de trabajo** para llevar el módulo de "funcional en local" a "listo para producción validado contra sandbox".

---

## ARCHIVOS DONDE SE CENTRARÍA CADA BLOQUE

| # | Archivos a tocar |
|---|---|
| 1 | Solo `.env` (regenerado del usuario). Sin cambios de código |
| 2 | `backend/services/hacienda/signer.js` si hay rechazos por firma |
| 3 | `backend/services/hacienda/xmlBuilder.js` (+ `signer.js` para flexibilizar el nodo raíz) |
| 4 | `backend/controllers/haciendaController.js`, `backend/models/FacturaEmision.js`, `frontend/src/pages/HaciendaPage.jsx` |
| 5 | `backend/models/PerfilFiscalEmisor.js` (nuevo), `backend/services/emisorService.js` (nuevo), `frontend/src/pages/HaciendaPerfil.jsx` (nuevo), `backend/controllers/haciendaController.js` |
| 6 | `backend/services/haciendaWorker.js`, `backend/models/FacturaEmision.js` |
| 7 | `backend/services/hacienda/xmlBuilder.js`, `frontend/src/components/hacienda/EmitirComprobanteModal.jsx` |
| 8 | `backend/__tests__/` (nuevos) |
| 9 | `docs/HACIENDA.md` (nuevo), `README.md` |

---

## CHECKLIST RÁPIDO PARA PROBAR EN SANDBOX

```bash
# 1) .env configurado con HACIENDA_AMBIENTE=sandbox y credenciales reales

# 2) Arrancar servidor
cd backend && npm run dev

# 3) En otra terminal, probar infoAmbiente (con JWT válido)
curl http://localhost:5000/api/hacienda/ambiente \
  -H "Authorization: Bearer <token-JWT>" | jq

# 4) En el navegador: entrar a /hacienda, crear una FE de prueba
#    - Receptor: usar tu propia cédula del emisor (valido en sandbox)
#    - CABYS: 0212010100100 (carne bovino)
#    - 1% IVA, ₡1000
#    - Esperar a que el estado llegue a "aceptada"

# 5) Ver en el log del backend todo el proceso:
#    [hacienda worker] enviado 506... -> Location: https://...
#    [hacienda worker] 506... -> aceptada

# 6) Si hay reject, mirar el XML de respuesta (gnfica 28 etc.). Anotar el idError
#    y buscarlo en https://www.hacienda.go.cr/ATV/ComprobanteElectronico

# 7) En caso de rechazo por firma, modificar signer.js y repetir desde paso 4
```

---

## ALARMA: ERRORES CONOCIDOS A LA HORA DE IMPLEMENTAR

1. **El depósito `Date.now().slice(-10)` para consecutivos colisiona en pruebas rápidas**. Por eso el Bloque 5 incluye `getNextConsecutivo` con `$inc` atómico. Mientras tanto, en sandbox es válido porque Hacienda permite escribir sobre el rastro del consecutivo siempre que no se repita exactamente dentro del tipo.

2. **Hacienda sandbox tiene rate-limit severo** (max ~10 documentos por minuto por usuario). El worker actual envía de a 5 por tick cada 15 segundos — está dentro del límite, pero si se acelera puede haber throttling (HTTP 429).

3. **La firma XAdES-EPES pura de `xml-crypto` no incluye los elementos de "firma electrónica avanzada" que pide el Decreto 8088 (verification del certificado contra lista de revocados, marca de tiempo RFC3161)**. Para producción oficialmente válida habría que agregar:
   - `<xades:RevocationValues>` con CRL/OCSP
   - `<xades:SignatureTimeStamp>` contra un TSA (Time Stamp Authority) de Hacienda
   - Este nivel de sofisticación NO es bloqueante para que Hacienda acepte el documento en sandbox; sí lo es para auditorías formales de la Dirección General de Tributación. Algunas propuestas usan middleware solo para esta parte.

4. **El REP tiene restricción temporal**: Hacienda espera que el REP llegue en los **3 días hábiles posteriores al cobro efectivo**. El worker actual no valida esta ventana; debería loguear advertencia si se emite fuera de plazo.

5. **El módulo D-150 no maneja Zonas Francas ni exenciones por Ley 9277**. Para productores regulares del REA no aplica, pero si la finca opera también con exportación es necesario agregar CUADRO de exportaciones.
