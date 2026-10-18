# Guía de Configuración: Cloudflare Email Routing y WhatsApp Bot

Esta guía explica cómo activar los dos canales automáticos para recibir facturas electrónicas y comprobantes sin necesidad de servidores IMAP.

---

## CANAL 1: Cloudflare Email Routing (Gratis y Automático)

Con este canal, cualquier factura enviada a `finca-nombre@contadorganandero.com` (o `facturas@contadorganandero.com`) se procesa en 2 segundos en tu aplicación.

### Paso 1: Activar Email Routing en Cloudflare
1. Entra a tu panel de **Cloudflare** y haz clic en tu dominio **`contadorganandero.com`**.
2. En el menú de la izquierda, haz clic en **Email** > **Email Routing**.
3. Pulsa el botón **Enable Email Routing** (Habilitar enrutamiento de correo).
4. Cloudflare te pedirá agregar unos registros DNS (MX y SPF) automáticamente. Haz clic en **Add records and enable**.

### Paso 2: Crear el Email Worker
1. En ese mismo menú de **Email Routing**, ve a la pestaña **Email Workers**.
2. Haz clic en **Create Email Worker**.
3. Borra el código que sale y pega el contenido de [cloudflare-email-worker/worker.js](file:///c:/Users/samu3/Desktop/Contador%20IA/cloudflare-email-worker/worker.js):
   ```javascript
   export default {
     async email(message, env, ctx) {
       try {
         console.log(`📥 [CF Worker] Recibiendo correo para: ${message.to} de: ${message.from}`);
         const rawEmail = await new Response(message.raw).arrayBuffer();
         console.log(`📦 [CF Worker] Tamaño MIME: ${rawEmail.byteLength} bytes`);
         const webhookUrl = env.BACKEND_WEBHOOK_URL || 'https://contador-ganadero.onrender.com/api/webhooks/email';

         const response = await fetch(webhookUrl, {
           method: 'POST',
           headers: {
             'Content-Type': 'message/rfc822',
             'X-Email-To': message.to,
             'X-Email-From': message.from,
             'X-Email-Webhook-Secret': env.EMAIL_WEBHOOK_SECRET || '',
           },
           body: rawEmail,
         });

         const responseText = await response.text();
         if (!response.ok) {
           console.error(`❌ [CF Worker] Error del backend (${response.status}): ${responseText}`);
         } else {
           console.log(`✅ [CF Worker] Éxito (${response.status}): ${responseText}`);
         }
       } catch (err) {
         console.error('❌ [CF Worker] Error al procesar correo:', err.message);
       }
     },
   };
   ```
4. Haz clic en **Save and Deploy**.

### Paso 3: Configurar la regla de captura (Catch-All o Dirección Custom)
1. En **Email Routing**, ve a la pestaña **Routing rules** (Reglas de enrutamiento).
2. En la sección **Catch-all rule** (Regla para cualquier dirección `*@contadorganandero.com`):
   - **Action:** Selecciona **Send to a Worker**.
   - **Destination:** Selecciona el Worker que acabas de crear.
   - Guarda los cambios.
3. ¡Listo! Ahora cualquier correo enviado a `cualquier-finca@contadorganandero.com` viajará en milisegundos a tu servidor en Render, el cual extraerá el XML, leerá la cédula del ganadero y guardará la factura.

---

## CANAL 2: WhatsApp Bot (Meta Cloud API)

Permite a los ganaderos reenviar XMLs, PDFs o fotos de tiquetes de caja directamente por WhatsApp.

### Variables de Entorno a configurar en Render:
- `WHATSAPP_VERIFY_TOKEN`: Un texto secreto para la verificación (por defecto `contador_ganadero_wa_secret`).
- `WHATSAPP_ACCESS_TOKEN`: Token permanente de tu aplicación en Meta for Developers.
- `WHATSAPP_PHONE_NUMBER_ID`: Identificador de número de teléfono de WhatsApp Business.

### Paso 1: Configurar el Webhook en Meta for Developers
1. Entra a [developers.facebook.com](https://developers.facebook.com) y selecciona tu App de WhatsApp Business.
2. Ve a **WhatsApp** > **Configuración** > **Webhook**.
3. Haz clic en **Editar**:
   - **URL de devolución de llamada (Callback URL):**
     `https://contador-ganadero.onrender.com/api/webhooks/whatsapp`
   - **Identificador de verificación (Verify Token):**
     `contador_ganadero_wa_secret` (o el que pongas en tu Render).
4. Haz clic en **Verificar y guardar**. Meta hará un `GET` a tu servidor y quedará verificado con un check verde.
5. En **Campos de webhook**, suscríbete al evento **`messages`**.

### Paso 2: ¿Cómo lo usa el Ganadero?
1. En su perfil de ContadorGanadero, el ganadero guarda su número de teléfono celular (ej: `50688888888`).
2. Agrega el número de WhatsApp de tu bot.
3. Le reenvía un archivo `.XML` o `.PDF` de factura.
4. El bot responde al instante confirmando el emisor, total y categoría de gasto.
