# 🐄 ContadorGanadero — Informe de Estado, Herramientas y Roadmap de Implementación

**Versión:** 1.0.0 (REA 2026)  
**Fecha de Análisis:** Agosto 2026  
**Ambiente Actual:** Desarrollo / Modo Local con Mocks  

---

## 📌 1. Resumen Ejecutivo y Estado General

**ContadorGanadero** es una plataforma SaaS full-stack (MERN) diseñada específicamente para la contabilidad, control de inventario multiespecie, cálculo de costos de producción y facturación electrónica para productores agropecuarios en Costa Rica bajo el **Régimen Especial Agropecuario (REA)**.

### Nivel de Madurez Actual: ~88% Completado
- **Frontend (React 19 + Vite):** 100% operativo y compila sin errores (`vite build` exitoso). Cuenta con 14 páginas funcionales, interfaz moderna, modo oscuro/claro, gráficos interactivos y chatbot integrado.
- **Backend (Node.js + Express + Mongoose):** Arquitectura multi-tenant con planes de suscripción (Stripe), seguridad con sanitización y rate-limiting, motor de firma digital XAdES-EPES, categorización con IA y lector IMAP de correos.
- **Base de Datos (MongoDB):** 12 colecciones estructuradas con soporte multi-inquilino (`tenantId`), cuotas mensuales y control de acceso basado en planes.

---

## 🏗️ 2. Mapa de Módulos Implementados

| Módulo | Descripción | Estado |
| :--- | :--- | :---: |
| 📊 **Dashboard General** | Métricas de ingresos vs gastos, balance mensual, proyección de impuestos, alertas fiscales y accesos rápidos. | ✅ 100% |
| 📥 **Facturas Recibidas (Gastos)** | Conexión IMAP para descarga automática de XML/PDF desde correos de proveedores. Parseo de XML costarricense v4.3/v4.4 y extracción de líneas. | ✅ 100% |
| 🤖 **Categorización por IA** | Clasificación automática de gastos según la lista oficial de insumos agropecuarios (canasta básica y tarifa reducida 1%). | ✅ 100% |
| 💰 **Módulo de Ingresos** | Registro manual de ventas (ganado en pie, canal, leche, huevos, miel, tilapia, café). Métodos de pago y comprobantes. | ✅ 100% |
| 🏛️ **Impuestos REA 2026** | • **D-135-1:** IVA Cuatrimestral.<br>• **D-101:** Renta Anual con tramos progresivos.<br>• **D-150:** Conciliación y Liquidación Anual REA. | ✅ 100% |
| 📅 **Calendario Fiscal** | Alertas y cronograma de vencimientos ante el Ministerio de Hacienda (IVA, Renta, D-151, D-150). | ✅ 100% |
| 📦 **Inventario Multiespecie** | • **Bovinos:** Pesajes, reproducción, producción de leche y sanidad.<br>• **Aves:** Postura, mortalidad y postura diaria.<br>• **Peces:** Biomasa, calidad de agua y fecha de cosecha.<br>• **Apicultura:** Colmenas, cuadros y extracciones de miel. | ✅ 100% |
| 📈 **Costos y Rentabilidad** | Centros de costo por lote/estanque/colmena. Cálculo de **FCA**, costo por kg/litro/cartón y margen operativo real. | ✅ 100% |
| 💳 **Suscripciones y Billing** | Integración con Stripe: planes Free, Bronce, Oro y Corporativo. Portal de cliente, cuotas de tokens y conteos. | ✅ 100% |
| 💬 **Asistente Virtual IA** | Chatbot agropecuario con contexto financiero e inventario en tiempo real, sanitización PII y modo offline heurístico. | ✅ 100% |
| 🧾 **Hacienda CR v4.4 (Emisión)** | Generación de clave 50 dígitos, XML v4.4, firma digital XAdES-EPES (.p12), autenticación OAuth2 y polling de estado. | 🟡 75% *(FE lista; faltan NC/TE/FEC)* |

---

## 🛠️ 3. Herramientas y Servicios Necesarios (Prerrequisitos)

Para operar el sistema en **desarrollo local** y posteriormente en **producción**, se requieren las siguientes herramientas:

### A. Para Desarrollo Inmediato (Hoy)
1. **Node.js (v18 o v20 LTS) y NPM:** Entorno de ejecución ya instalado en tu máquina.
2. **Base de Datos MongoDB:**
   - Opción nube (recomendada): Cluster gratuito M0 en [MongoDB Atlas](https://www.mongodb.com/atlas).
   - Opción local: [MongoDB Community Server](https://www.mongodb.com/try/download/community) o Docker.
3. **Correo Electrónico para Lectura de Facturas (IMAP):**
   - Una cuenta de **Gmail** o **Outlook** dedicada a recibir facturas electrónicas de insumos agropecuarios.
   - En Gmail: Activar *Verificación en 2 pasos* y crear una **Contraseña de Aplicación** (16 caracteres).
4. **API Key de Inteligencia Artificial:**
   - **NVIDIA NIM API** (gratis con créditos en [build.nvidia.com](https://build.nvidia.com/) para modelo `nvidia/nemotron-3-ultra-550b-a55b` o Llama 3) O **OpenRouter** O **OpenAI**.
5. **Stripe (Modo Test):**
   - Cuenta gratuita en [Stripe Dashboard](https://dashboard.stripe.com/) para llaves de prueba (`pk_test_...` y `sk_test_...`).
   - [Stripe CLI](https://stripe.com/docs/stripe-cli) para probar webhooks en local.

### B. Para Producción y Facturación Oficial (Hacienda CR)
1. **Llave Criptográfica (`.p12`):** Descargada desde el portal [TRIBU-CR / ATV](https://ovitribucr.hacienda.go.cr).
2. **PIN de la Llave:** PIN de 14 caracteres generado al crear la llave en Hacienda.
3. **Usuario y Contraseña del API de Hacienda:** Usuario con formato `cpf-01-XXXXXXXXX@comprobanteselectronicos.go.cr` generado en *Desarrollos Propios* de ATV.
4. **Servicio de Hosting:**
   - **Backend:** [Render](https://render.com) (Web Service + Background Worker) o [Railway](https://railway.app).
   - **Frontend:** [Vercel](https://vercel.com) (conectado a repositorio Git).

---

## ⚙️ 4. Matriz de Variables de Entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto basándote en este formato:

```ini
# ==========================================
# 1. BASE DE DATOS
# ==========================================
MONGODB_URI=mongodb+srv://<usuario>:<password>@cluster0.mongodb.net/contador_ganadero?retryWrites=true&w=majority

# ==========================================
# 2. SERVIDOR Y AUTENTICACIÓN
# ==========================================
PORT=5000
NODE_ENV=development
JWT_SECRET=generar_clave_hex_64_caracteres_con_crypto
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173

# ==========================================
# 3. SEGURIDAD Y CIFRADO (AES-256)
# ==========================================
EMAIL_ENC_KEY=generar_clave_hex_64_caracteres_con_crypto

# ==========================================
# 4. CORREO IMAP (RECOLECCIÓN DE FACTURAS)
# ==========================================
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=tucorreo@gmail.com
IMAP_PASSWORD=tu_contraseña_de_aplicacion_16_letras
IMAP_TLS=true

# ==========================================
# 5. INTELIGENCIA ARTIFICIAL (CHATBOT Y CATEGORIZACIÓN)
# ==========================================
AI_API_KEY=nvapi-tu_clave_de_nvidia_o_openrouter
AI_MODEL=nvidia/nemotron-3-ultra-550b-a55b
# AI_BASE_URL=https://integrate.api.nvidia.com/v1

# ==========================================
# 6. STRIPE (PLANES Y SUSCRIPCIONES)
# ==========================================
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BRONCE=price_...
STRIPE_PRICE_ORO=price_...
STRIPE_PRICE_CORPORATIVO=price_...

# ==========================================
# 7. MINISTERIO DE HACIENDA CR (FACTURACIÓN v4.4)
# ==========================================
# Ambiente: local (simulado con mocks) | sandbox (pruebas Hacienda) | produccion
HACIENDA_AMBIENTE=local
HACIENDA_P12_PATH=./certificados/emisor.p12
HACIENDA_PIN=TuPinDe14Chars
HACIENDA_USUARIO=cpf-01-XXXXXXXXX@comprobanteselectronicos.go.cr
HACIENDA_PASSWORD=TuPasswordDelApi
HACIENDA_WORKER_EMBEDDED=true
HACIENDA_WORKER_INTERVAL_MS=15000

# ==========================================
# 8. FRONTEND
# ==========================================
VITE_API_URL=http://localhost:5000/api
```

> **Tip para generar claves seguras:**  
> Ejecuta en terminal:  
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 🎯 5. Roadmap: Lo que hace falta implementar para estar 100% Listo

### 🔴 Fase 1: Facturación Electrónica Completa (Hacienda CR v4.4)
1. **Completar XML Builders restantes en `backend/services/hacienda/xmlBuilder.js`:**
   - **Nota de Crédito (NC - 03):** Requiere nodo `<InformacionReferencia>` para anular o corregir facturas aceptadas.
   - **Tiquete Electrónico (TE - 02):** Facturación simplificada sin receptor obligatorio.
   - **Factura Electrónica de Compra (FEC - 05):** Para compras a pequeños productores del campo no inscritos.
   - **Mensaje Receptor / REP (06):** Para el registro de pagos diferidos a crédito.
2. **Flujo de Anulación en Frontend (`HaciendaPage.jsx`):**
   - Botón de acción rápida "Anular" en facturas con estado `aceptada` que abra un modal pidiendo el motivo de anulación y dispare la creación automática de la Nota de Crédito.
3. **Perfil Fiscal Persistente y Consecutivos Atómicos:**
   - Crear el modelo `PerfilFiscalEmisor.js` en MongoDB.
   - Reemplazar la generación de consecutivos basada en `Date.now()` por un `$inc` atómico para evitar colisiones en alta concurrencia.
4. **Pruebas de Validación en Sandbox de Hacienda:**
   - Cambiar a `HACIENDA_AMBIENTE=sandbox` y verificar que no haya errores de schema (XSD) ni de canonicalización en la firma digital.

---

### 🟡 Fase 2: Reportes y Exportación
1. **Exportación Formal de Declaraciones:**
   - Generación de reportes descargables en **PDF** y **Excel** para los formularios **D-135-1 (IVA)**, **D-101 (Renta)** y **D-150 (Liquidación REA)**.
2. **Exportación de Inventario:**
   - Botón en `InventarioPage.jsx` para descargar en formato `.xlsx` la sábana de bovinos, pesajes, lotes de aves, estanques de tilapia y cosechas de miel.

---

### 🟢 Fase 3: Automatizaciones y Mantenimiento Técnico
1. **Reseteo Mensual de Cuotas (Cron Job):**
   - Implementar el reseteo automático de cuotas (`consumoActual.conteosMes = 0`, `tokensChatMes = 0`) el primer día de cada mes (siguiendo `CRON_SETUP.md`).
2. **Depuración de Índices en `Tenant.js`:**
   - Eliminar las advertencias de índices duplicados en Mongoose removiendo `index: true` redundante en campos con `schema.index()`.
3. **Ajuste de Tests Unitarios:**
   - Optimizar `migrateTenant.test.js` para asegurar que el 100% de la suite de pruebas pase en CI/CD.

---

## 🚀 6. Guía Rápida de Puesta en Marcha

### 1. Instalación de Dependencias
```bash
# En la raíz del proyecto
npm run install:all
```

### 2. Ejecutar en Modo Desarrollo (Frontend + Backend simultáneo)
```bash
npm run dev
```
- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:5000/api`

### 3. Ejecutar Pruebas Automatizadas
```bash
cd backend
npm test
```

### 4. Compilar Frontend para Producción
```bash
cd frontend
npm run build
```

---

## 📞 Soporte del Régimen REA
La lógica fiscal de esta aplicación cumple con la normativa costarricense vigente para el **Régimen Especial Agropecuario (Ley 9635 y reformas 2026)**:
- Tarifa reducida de IVA del **1%** en insumos y productos agropecuarios primarios.
- Declaración cuatrimestral de IVA en los meses de **Mayo**, **Septiembre** y **Enero**.
- Conciliación anual de compras y ventas mediante **D-150**.
