---
name: ingesta-facturas-agro-inventario
description: >-
  Flujos de ingesta automática de facturas (Cloudflare Email Worker y WhatsApp Cloud API) y gestión de inventario multiespecie y costos de producción agropecuaria en ContadorGanadero. Úsese siempre que se trabaje en webhooks de correo o WhatsApp, resolución de tenant por cédula/alias/teléfono, inventario (bovinos, aves, peces, abejas) o cálculo de costos de producción y FCA.
---

# Ingesta de Facturas, Inventario Multiespecie y Costos (`ingesta-facturas-agro-inventario`)

Esta skill documenta el pipeline unificado de recepción de comprobantes y los algoritmos de inventario y costos agropecuarios en **ContadorGanadero**.

## Archivos Clave del Módulo

- `cloudflare-email-worker/worker.js`: Cloudflare Email Worker (catch-all `*@contadorganandero.com`) que reenvía el MIME crudo (`message/rfc822`) al backend.
- `backend/services/ingestaFacturaService.js`: Servicio centralizado donde convergen los canales de Email y WhatsApp para extraer XML/PDF, resolver el tenant, clasificar con IA y guardar la factura.
- `backend/services/whatsappService.js`: Integración con Meta WhatsApp Cloud API (`/api/webhooks/whatsapp`) para descarga de adjuntos XML/PDF/imágenes y respuesta automática al productor.
- `backend/services/emailService.js` & `backend/worker.js`: Lector IMAP IDLE heredado y sincronización por cron (`POST /api/cron/sync-emails`).
- `backend/models/Inventario.js`: Esquema multiespecie (`bovinos`, `aves`, `peces`, `abejas`).
- `backend/models/CostoProduccion.js`: Centros de costo por lote/estanque/colmena, consumo de insumos y KPIs de rentabilidad.

## Reglas del Pipeline de Ingesta (`ingestaFacturaService.js`)

1. **Seguridad de Webhooks de Ingesta**:
   - El endpoint `POST /api/webhooks/email` valida el header `X-Email-Webhook-Secret` contra `EMAIL_WEBHOOK_SECRET`.
   - El endpoint `GET/POST /api/webhooks/whatsapp` valida `WHATSAPP_VERIFY_TOKEN` y procesa eventos `messages` usando `WHATSAPP_ACCESS_TOKEN`.
2. **Cascada de Resolución de Tenant**:
   Cuando ingresa una factura por correo o WhatsApp, el tenant destino se resuelve en este orden de prioridad:
   1. **Cédula del receptor en el XML** (`Receptor.Identificacion.Numero`) comparada contra la cédula del `Tenant` o `Usuario`.
   2. **ID explícito** de tenant/usuario si viene en el contexto.
   3. **Alias de correo del tenant** (`emailAlias` extraído del destinatario `X-Email-To`, ej. `finca-el-cedro@contadorganandero.com`).
   4. **Teléfono del remitente** (para mensajes entrantes de WhatsApp).
3. **Deduplicación de Comprobantes**:
   - Verificar siempre la `clave` numérica de 50 dígitos antes de insertar una `Factura` para evitar duplicados cuando un proveedor envía el mismo XML por correo y WhatsApp, o cuando llega posteriormente el `MensajeHacienda` de aceptación.

## Reglas de Inventario Multiespecie y Costos de Producción

1. **Especies Soportadas (`Inventario.js`)**:
   - **Bovinos**: Registro individual (arete/nombre), historial de pesajes, ganancia diaria de peso (GDP), estado reproductivo, producción lechera y registro sanitario.
   - **Aves (Postura)**: Manejo por lote, cantidad de aves, mortalidad, ciclos de postura y recolección diaria de huevos/cartones.
   - **Peces (Acuicultura)**: Manejo por estanque, muestreos de peso promedio, biomasa estimada, parámetros de calidad de agua (oxígeno, pH, temperatura) y fecha proyectada de cosecha.
   - **Abejas (Apicultura)**: Manejo por colmena/apiario, estado de cuadros, reina, tratamientos sanitarios y volúmenes de extracción de miel.
2. **Cálculo de Costos y KPIs (`CostoProduccion.js`)**:
   - **Factor de Conversión Alimenticia (FCA)**: `kg de alimento consumido / kg de ganancia de peso (o producción)`. Proteger siempre contra división por cero.
   - **Costo Unitario de Producción**: Suma de insumos registrados (alimento, medicamentos/vacunas, mano de obra, otros) dividida entre el volumen total producido (`kg` de carne/tilapia, `cartones` de huevos, `litros` de leche o `kg` de miel).

## Verificación

Ejecutar la suite de pruebas del backend al modificar el pipeline de ingesta o los modelos de inventario/costos:
```bash
cd backend && npm test
```
