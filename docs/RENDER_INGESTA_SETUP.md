# Configuración de Render para ingesta e inventario

Este documento cubre las variables de arranque que faltan en Render y la persistencia de los adjuntos de facturas. Los secretos se configuran directamente en Render y Cloudflare; no deben guardarse en este repositorio.

## API Web Service

En Render, abre `contador-ganadero-api` → **Environment** y configura las variables que faltan del log:

| Variable | Requisito |
| --- | --- |
| `JWT_REFRESH_SECRET` | Secreto aleatorio de al menos 32 caracteres y distinto de `JWT_SECRET`. Cambiarlo puede invalidar sesiones de renovación existentes. |
| `EMAIL_ENC_KEY` | Exactamente 64 caracteres hexadecimales. Debe ser la clave vigente que descifra las credenciales cifradas que ya están en MongoDB. No uses placeholders ni una clave histórica expuesta; rotar exige migrar los datos cifrados. |
| `FRONTEND_URL` | Origen exacto del frontend, actualmente `https://contadorganandero.com`. El backend ya permite usarlo como alternativa a `CORS_ORIGINS`. |
| `ONVO_WEBHOOK_SECRET` | Al menos 32 caracteres y el mismo valor configurado para el webhook de ONVO. |
| `EMAIL_WEBHOOK_SECRET` | Al menos 32 caracteres y el mismo valor configurado como secreto del Worker de Cloudflare. |

Para más de un dominio de frontend, se puede definir `CORS_ORIGINS` con los orígenes exactos separados por comas. No se permiten comodines ni rutas, por ejemplo: `https://contadorganandero.com,https://app.contadorganandero.com`.

Para activar WhatsApp también deben estar definidos `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`. `META_APP_SECRET` debe coincidir con la aplicación de Meta; el token de verificación debe coincidir con el usado en el handshake. El backend no imprime estos valores.

Después de guardar las variables, selecciona **Save, rebuild, and deploy** o **Save and deploy** para que el proceso arranque con ellas. Render solo las aplica al servicio cuando inicia un nuevo deploy. Consulta la [guía de variables y secretos de Render](https://render.com/docs/configure-environment-variables).

## Archivos XML y PDF persistentes

La API ya escribe los adjuntos bajo `UPLOAD_ROOT`. Para conservarlos después de reinicios y despliegues:

1. En `contador-ganadero-api`, crea un disco persistente con el punto de montaje `/var/data`. Render requiere un Web Service de pago para adjuntar discos.
2. Configura `UPLOAD_ROOT=/var/data/uploads` en las variables del mismo servicio.
3. Despliega de nuevo y verifica que una factura de prueba pueda descargarse desde la API.

Render usa un sistema de archivos efímero por defecto. Un disco conserva únicamente los archivos escritos bajo su punto de montaje; solo puede conectarse a un servicio a la vez y deshabilita los despliegues sin interrupción. Revisa las [limitaciones de los discos persistentes de Render](https://render.com/docs/disks) antes de adjuntarlo.

Los flujos de Cloudflare Email y WhatsApp escriben desde la API, por lo que el disco debe estar conectado al Web Service. El Background Worker de IMAP es otro servicio y no comparte ese disco. Si se necesita que archivos escritos por ese proceso estén disponibles en la API, se requiere almacenamiento compartido como R2/S3 o una migración del proceso para que pase los adjuntos por la API.

El Background Worker que ejecuta Hacienda también debe recibir el mismo `MONGODB_URI` y `EMAIL_ENC_KEY` si descifra credenciales de fincas.

## Worker de correo de Cloudflare

El Worker tiene su configuración en `cloudflare-email-worker/wrangler.jsonc`; la regla `*@contadorganandero.com` se administra desde ese archivo. El secreto no se guarda en `vars` ni en el repositorio. Configúralo en Cloudflare Wrangler:

```bash
npx --yes wrangler@4.113.0 secret put EMAIL_WEBHOOK_SECRET --config cloudflare-email-worker/wrangler.jsonc
```

Usa en Render el mismo valor que ingresaste en Wrangler. Para desplegar o validar el Worker:

```bash
npm run deploy:email-worker
```

El script fija Wrangler 4.113.0, que admite configurar `addresses` desde `wrangler.jsonc`. El Worker registra por separado los correos sin XML, el procesamiento completo, el procesamiento parcial y los errores HTTP del backend.

## Inventario y costos

Las rutas autenticadas de `/api/inventario` y `/api/costos` aplican aislamiento por `tenantId`; las pruebas de integración cubren las cuatro especies, centros de costo, consumo, producción y resumen. Una factura ingresada no genera consumos automáticamente: antes de conectar ambos módulos deben definirse el mapeo de productos del XML a insumos, unidades, cantidades y centro de costo.
