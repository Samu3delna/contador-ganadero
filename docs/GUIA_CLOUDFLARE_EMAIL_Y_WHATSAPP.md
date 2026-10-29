# Guía de Configuración: Cloudflare Email Routing y WhatsApp Bot

Esta guía explica cómo activar los dos canales automáticos para recibir facturas electrónicas y comprobantes sin necesidad de servidores IMAP.

---

## CANAL 1: Cloudflare Email Routing

El Worker y su regla catch-all están definidos en `cloudflare-email-worker/wrangler.jsonc`, separados de la configuración Wrangler del frontend.

1. En Cloudflare, habilita Email Routing para `contadorganandero.com` y verifica los registros MX/DNS.
2. Desde la raíz del proyecto, carga el mismo secreto configurado como `EMAIL_WEBHOOK_SECRET` en Render:
   `npx wrangler secret put EMAIL_WEBHOOK_SECRET --config cloudflare-email-worker/wrangler.jsonc`
3. Revisa las reglas actuales de Email Routing y confirma que no haya otro destino que deba conservar el catch-all. Wrangler administra `*@contadorganandero.com` desde el archivo de configuración.
4. Despliega el Worker con `npm run deploy:email-worker`.
5. Revisa los logs del Worker durante el envío de un correo de prueba con un XML válido. El Worker reintenta fallos HTTP 429/5xx hasta tres veces; cada resultado se registra sin copiar el cuerpo ni los adjuntos a los logs.

El endpoint del backend distingue correo sin XML (200), factura procesada (200), resultado parcial (207) y XML que no pudo procesarse (422). Revisa también los logs del backend para distinguir errores de parseo, asignación y almacenamiento.

### Persistencia de XML y PDF en Render

En el servicio API de Render, agrega un Persistent Disk montado en `/var/data` y define `UPLOAD_ROOT=/var/data/uploads`. Confirma que el plan del servicio permita discos persistentes. Después de reiniciar el servicio, abre una factura ya importada y descarga su XML/PDF para comprobar que el archivo sigue disponible. No uses `./uploads` como ruta de producción si el servicio no tiene disco persistente.

---

## CANAL 2: WhatsApp Bot (Meta Cloud API)

Permite a los ganaderos reenviar XMLs, PDFs o fotos de tiquetes de caja directamente por WhatsApp.

### Variables de entorno requeridas en Render
- `WHATSAPP_VERIFY_TOKEN`: secreto aleatorio para el handshake de Meta.
- `META_APP_SECRET`: secreto de la aplicación Meta para validar `X-Hub-Signature-256`.
- `WHATSAPP_ACCESS_TOKEN`: token de acceso de WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: identificador del número de WhatsApp Business.

### Paso 1: Configurar el Webhook en Meta for Developers
1. Entra a [developers.facebook.com](https://developers.facebook.com) y selecciona tu App de WhatsApp Business.
2. Ve a **WhatsApp** > **Configuración** > **Webhook**.
3. Haz clic en **Editar**:
   - **URL de devolución de llamada (Callback URL):**
     `https://contador-ganadero.onrender.com/api/webhooks/whatsapp`
   - **Identificador de verificación (Verify Token):** el mismo valor configurado en Render como `WHATSAPP_VERIFY_TOKEN`.
4. Haz clic en **Verificar y guardar**. Meta hará un `GET` a tu servidor y quedará verificado con un check verde.
5. En **Campos de webhook**, suscríbete al evento **`messages`**.

El backend valida la firma sobre los bytes originales recibidos. Un webhook sin firma válida se rechaza. En los logs busca `whatsapp_invoice_processing_finished` o `whatsapp_invoice_processing_failed` para comprobar el resultado posterior al acuse `EVENT_RECEIVED`.

### Paso 2: ¿Cómo lo usa el Ganadero?
1. En su perfil de ContadorGanadero, el ganadero guarda su número de teléfono celular (ej: `50688888888`).
2. Agrega el número de WhatsApp de tu bot.
3. Le reenvía un archivo `.XML` o `.PDF` de factura.
4. El bot responde al instante confirmando el emisor, total y categoría de gasto.
