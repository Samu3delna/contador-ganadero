# Configuración de Cron Externo (Opción B - Backup Gratis)

## cron-job.org (Recomendado - Gratis, 1 min intervalo)

1. Crear cuenta en https://cron-job.org
2. Crear nuevo cron job:
   - **URL**: `https://TU_BACKEND.onrender.com/api/facturas/email/sincronizar?soloNoLeidos=true`
   - **Método**: `POST`
   - **Headers**: 
     - `Authorization: Bearer TU_JWT_TOKEN` (ver nota abajo)
   - **Schedule**: Cada 5 minutos (`*/5 * * * *`)
   - **Timeout**: 60 segundos

## UptimeRobot (Alternativa - Gratis, 5 min intervalo)

1. Crear cuenta en https://uptimerobot.com
2. Add Monitor → "HTTP(s)"
   - **URL**: `https://TU_BACKEND.onrender.com/api/facturas/email/sincronizar?soloNoLeidos=true`
   - **Method**: POST
   - **Interval**: 5 minutes
   - **Alert Contacts**: Email/Telegram para notificaciones si falla

---

## ⚠️ AUTENTICACIÓN PARA CRON JOBS

El endpoint `/api/facturas/email/sincronizar` requiere autenticación JWT. Tienes 2 opciones:

### Opción 1: Token de larga duración (Simple)
En `backend/server.js`, agregar endpoint sin auth solo para cron (IP allowlist opcional):

```javascript
// Cron job endpoint - sin auth, solo para IPs conocidas
app.post('/api/cron/sync-emails', async (req, res) => {
  // Verificar IP si quieres (opcional)
  const allowedIPs = ['IP_DE_CRON_JOB_ORG', 'IP_DE_UPTIMEROBOT'];
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'IP no autorizada' });
  }
  
  try {
    const { iniciarListener, sincronizarManual } = require('./services/emailService');
    const Usuario = require('./models/Usuario');
    
    const usuario = await Usuario.findOne();
    if (!usuario) return res.status(404).json({ error: 'No hay usuario' });
    
    const result = await sincronizarManual(usuario._id, { soloNoLeidos: true });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

### Opción 2: Generar token y pasarlo en header
1. Login en frontend → obtener token
2. Usar ese token en cron job header: `Authorization: Bearer TOKEN`
3. Renovar token cada hora (o crear refresh token endpoint)

---

## RENDER BACKGROUND WORKER (Opción A - Recomendado como principal)

El `worker.js` corre 24/7 SIN spin-down en plan FREE de Render.

### Deploy:
1. Push a GitHub
2. En Render Dashboard → New → Background Worker
3. Connect repo
4. Config:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && node worker.js`
5. Add Environment Variables (mismas que Web Service):
   - MONGODB_URI
   - IMAP_USER
   - IMAP_PASSWORD
   - EMAIL_ENC_KEY
6. Deploy

### Ventajas:
- ✅ Listener IMAP IDLE siempre activo (push real-time)
- ✅ Sync inicial al arrancar
- ✅ Reconexión automática si se cae
- ✅ NO se duerme (plan free background workers no spin down)

---

## ARQUITECTURA FINAL RECOMENDADA

```
┌─────────────────────────────────────────────────────────────┐
│                     RENDER (Free)                           │
├─────────────────────────┬───────────────────────────────────┤
│   Web Service           │   Background Worker               │
│   (API REST)            │   (IMAP Listener 24/7)            │
│   - /api/*              │   - iniciarListener()             │
│   - Health check        │   - IDLE push notifications       │
│   - Spin down 15 min    │   - Auto-reconnect                │
│   - Wakes on HTTP       │   - NO spin down                  │
└───────────┬─────────────┴───────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │  MongoDB Atlas │
    └───────────────┘
            ▲
            │
    ┌───────┴───────┐
    │  VERCEL       │
    │  Frontend     │
    │  (React)      │
    └───────────────┘
```

### Cron Job (Opción B) como Backup:
- Cron-job.org llama a `POST /api/cron/sync-emails` cada 5 min
- Despierta Web Service si se durmió
- Ejecuta sync rápido (solo no leídos)

---

## CHECKLIST DE DEPLOY

### Render Web Service:
- [ ] `MONGODB_URI` (direct connection string)
- [ ] `JWT_SECRET` (64+ chars hex)
- [ ] `IMAP_USER` = `contadoriasam@gmail.com`
- [ ] `IMAP_PASSWORD` = App Password actual
- [ ] `OPENROUTER_API_KEY`
- [ ] `FRONTEND_URL` = `https://tu-app.vercel.app`
- [ ] `EMAIL_ENC_KEY` = (regenerar con `openssl rand -hex 32` — el valor previamente expuesto en versiones históricas de este documento queda comprometido y debe rotarse)

### Render Background Worker:
- [ ] Mismas variables que Web Service (excepto JWT_SECRET, OPENROUTER_API_KEY, FRONTEND_URL)

### Vercel Frontend:
- [ ] `VITE_API_URL` = `https://tu-backend.onrender.com/api`

### Cron-job.org (Backup):
- [ ] Crear job POST a `/api/cron/sync-emails` cada 5 min
- [ ] Configurar IP allowlist o token auth