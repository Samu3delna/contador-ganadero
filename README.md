# 🐄 ContadorGanadero

Aplicación MERN full-stack para funcionar como contador personal automatizado para pequeños productores agropecuarios en Costa Rica, bajo el Régimen Especial Agropecuario (REA).

## Características Principales

1. **Integración de Correo Electrónico:** Escucha activa vía IMAP para descargar facturas electrónicas XML y PDF.
2. **Procesamiento Inteligente:** Utiliza IA (OpenRouter) para categorizar automáticamente los gastos extraídos de las facturas (ej. insumos veterinarios vs gastos generales).
3. **Módulo de Ingresos:** Registro manual de venta de ganado, leche y otros productos.
4. **Lógica Tributaria Costarricense (2026):**
   - Cálculo del **IVA Cuatrimestral** (Formulario D-135-1).
   - Cálculo de la **Renta Anual** (Formulario D-101) con tramos progresivos y exenciones actualizadas.
5. **Dashboard Analítico:** Panel visual con React y Recharts para visualizar métricas, ingresos vs gastos y proyecciones de impuestos.
6. **Control de Inventario Integral:** Base de datos en tiempo real de pesos individuales de bovinos, ciclos de postura de aves, tasas de conversión alimenticia de peces y volúmenes de extracción de miel.
7. **Control de Costos de Producción:** Algoritmo que calcula el costo real de producción por kilo de carne, por cartón de huevos o por kilo de tilapia basándose en el consumo de insumos registrados (alimento, sal, vacunas). Esto asegura un margen de rentabilidad real y constante.
8. **Facturación Electrónica en el REA:** Módulo integrado para cumplir con las directrices de Hacienda, facilitando la recepción de facturas electrónicas de compra al 1% de IVA y la emisión de facturas a clientes directo.

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

## Nuevos Módulos (2026)

### Control de Inventario Integral
- **Bovinos:** Registro individual con historial de pesos, estado reproductivo, producción lechera y sanidad.
- **Aves (Postura):** Control de lotes, ciclos de postura, mortalidad, conversión alimenticia y producción de huevos.
- **Peces (Acuicultura):** Muestreos de peso, biomasa estimada, parámetros de calidad de agua y proyección de cosecha.
- **Abejas (Apicultura):** Registro de colmenas, extracciones de miel, estado de cuadros y tratamientos sanitarios.

### Control de Costos de Producción
- Centros de costo por lote/estanque/colmena.
- Registro de consumo de insumos (alimento, medicamentos, mano de obra).
- Cálculo automático de KPIs: costo por kg producido, Factor de Conversión Alimenticia (FCA), margen operativo.
- Proyección de rentabilidad por actividad productiva.

### Facturación Electrónica REA (Emisión)
- Emisión de facturas electrónicas con tarifa reducida del 1% de IVA.
- Cumplimiento con Hacienda CR para productores inscritos ante el MAG.
- Generación de XML y PDF con clave numérica.
- Estados: borrador, generada, firmada, enviada a Hacienda, aceptada/rechazada.
