---
name: rea-impuestos-cr
description: >-
  Reglas fiscales, contables y de categorización por IA para el Régimen Especial Agropecuario (REA - Ley 9635 Costa Rica) en ContadorGanadero. Úsese siempre que se trabaje en cálculos de IVA cuatrimestral (D-135-1), Renta anual progresiva (D-101), liquidación anual REA (D-150), catálogo de insumos agropecuarios al 1%, exportación de declaraciones o prompts del asistente contable IA.
---

# Régimen Especial Agropecuario e Impuestos CR (`rea-impuestos-cr`)

Esta skill rige toda la lógica tributaria costarricense (período fiscal 2026, Decreto Ejecutivo N.° 45333-H y Ley 9635) y la clasificación inteligente de gastos en **ContadorGanadero**.

## Archivos Clave del Módulo

- `backend/utils/costaRicaTax.js`: Constantes fiscales 2026 (tramos de renta, créditos fiscales, tarifas de IVA, fechas de cuatrimestres).
- `backend/services/impuestoService.js`: Cálculo de IVA cuatrimestral (D-135-1) y Renta anual (D-101).
- `backend/services/d150Service.js`: Conciliación anual de compras y ventas del REA (Formulario D-150) y cálculo de prorrata.
- `backend/services/declaracionService.js`: Generación y exportación de reportes fiscales en CSV y Excel (`exceljs`).
- `backend/insumos_oficiales.json`: Catálogo oficial de insumos agropecuarios y veterinarios autorizados al 1% de IVA.
- `backend/services/aiProvider.js`: Cascada de proveedores IA (Gemini -> NVIDIA NIM -> heurística local por palabras clave).
- `backend/services/aiService.js`: Construcción de prompts en español con contexto REA, sanitización de PII y auditoría de tarifas de IVA.

## Reglas Tributarias y de Dominio (Costa Rica 2026)

1. **Cuatrimestres del REA (Formulario D-135-1)**:
   - **1er Cuatrimestre**: 1 Enero – 30 Abril (Vence el 15 de Mayo).
   - **2do Cuatrimestre**: 1 Mayo – 31 Agosto (Vence el 15 de Septiembre).
   - **3er Cuatrimestre**: 1 Septiembre – 31 Diciembre (Vence el 15 de Enero del año siguiente).
2. **Tarifas de IVA en el Sector Agropecuario (`TASAS_IVA`)**:
   - `1%` (`codigoTarifa: '02'` o `'06'`): Canasta básica e insumos agropecuarios para productores inscritos ante el MAG.
   - `0.5%`: Productos orgánicos certificados (Ley N.° 10.256).
   - `2%` (`'03'`): Medicamentos veterinarios/humanos específicos.
   - `13%` (`'08'`): Tarifa general (gastos no agropecuarios o proveedores que facturan sin aplicar exoneración/tarifa REA; genera alerta de auditoría si el insumo está en `insumos_oficiales.json`).
   - `0%` (`'01'` / `'05'`): Exento.
3. **Impuesto sobre la Renta Anual (Formulario D-101 - Persona Física con Actividad Lucrativa 2026)**:
   - Hasta `₡6,244,000`: **0%** (Exento)
   - Sobre el exceso de `₡6,244,000` hasta `₡8,329,000`: **10%**
   - Sobre el exceso de `₡8,329,000` hasta `₡10,414,000`: **15%**
   - Sobre el exceso de `₡10,414,000` hasta `₡20,872,000`: **20%**
   - Sobre el exceso de `₡20,872,000`: **25%**
   - Créditos fiscales anuales: `₡20,520` por hijo, `₡31,080` por cónyuge.
4. **Conciliación Anual D-150 (`d150Service.js`)**:
   - Exclusiva del plan `pro` (`limites.moduloD150 === true`).
   - Al calcular la prorrata de crédito fiscal (`ventasGravadas / ventasTotales`), proteger siempre contra división por cero cuando `ventasTotales === 0` (retornar `100%` por defecto).
5. **Proveedores de IA y Fallback Offline (`aiProvider.js` / `aiService.js`)**:
   - Orden estricto de ejecución: **Google Gemini** (`GEMINI_API_KEY`) -> **NVIDIA NIM** (`AI_API_KEY` con `https://integrate.api.nvidia.com/v1`) -> **Heurística local** (sin llamadas de red).
   - Nunca eliminar el fallback heurístico local: garantiza que la categorización de facturas y los tests funcionen sin conexión ni API keys.

## Verificación

Ejecutar los tests de impuestos y servicios de IA tras cualquier cambio:
```bash
cd backend && npx jest --runInBand
```
