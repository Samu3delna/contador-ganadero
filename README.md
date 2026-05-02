# 🐄 ContadorGanadero

Aplicación MERN full-stack para funcionar como contador personal automatizado para pequeños ganaderos en Costa Rica, bajo el Régimen Especial Agropecuario (REA).

## Características Principales

1. **Integración de Correo Electrónico:** Escucha activa vía IMAP para descargar facturas electrónicas XML y PDF.
2. **Procesamiento Inteligente:** Utiliza IA (OpenRouter) para categorizar automáticamente los gastos extraídos de las facturas (ej. insumos veterinarios vs gastos generales).
3. **Módulo de Ingresos:** Registro manual de venta de ganado.
4. **Lógica Tributaria Costarricense (2026):** 
   - Cálculo del **IVA Cuatrimestral** (Formulario D-135-1).
   - Cálculo de la **Renta Anual** (Formulario D-101) con tramos progresivos y exenciones actualizadas.
5. **Dashboard Analítico:** Panel visual con React y Recharts para visualizar métricas, ingresos vs gastos y proyecciones de impuestos.

## Instalación

1. Clona el repositorio
2. Instala dependencias del backend:
   ```bash
   cd backend
   npm install
   ```
3. Instala dependencias del frontend:
   ```bash
   cd frontend
   npm install
   ```
4. Configura el archivo `.env` en la raíz copiando el `.env.example`
5. Ejecuta en terminales separadas:
   ```bash
   # Backend
   cd backend
   npm run dev

   # Frontend
   cd frontend
   npm run dev
   ```

## Estructura
- `/backend`: Servidor Node.js, Express, Mongoose, servicios IMAP y de IA.
- `/frontend`: Aplicación React construida con Vite.
