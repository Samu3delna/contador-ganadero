# Plan de Auditoría Integral, Limpieza y Mejoras Funcionales — ContadorGanadero

Auditoría técnica profunda del repositorio, eliminación de artefactos residuales, implementación de soporte dual de IA (Google Gemini + NVIDIA NIM), ampliación de builders XML v4.4 de Hacienda (NC/TE/FEC) y enriquecimiento del modo demostración agropecuario para Costa Rica (REA).

## User Review & Critical Decisions

> [!IMPORTANT]
> A continuación se resumen las decisiones acordadas para esta fase de trabajo:

- **Enfoque Prioritario**: Auditoría integral del sistema, saneamiento de código obsoleto y resolución de cuellos de botella funcionales.
- **Motor de Inteligencia Artificial**: **Soporte Dual** entre Google Gemini (`@google/genai` con `gemini-3.8-flash`) y NVIDIA NIM (`openai` compatible), con detección automática y fallback transparente.
- **Depuración de Archivos**: Eliminación de scripts temporales en `/scratch/`, reportes pesados de cobertura en `/backend/coverage/` y dependencias no utilizadas.
- **Facturación Electrónica REA**: Completar la parametrización de esquemas XML para Notas de Crédito (NC), Tiquetes Electrónicos (TE) y Facturas Electrónicas de Compra (FEC).

---

## 1. Overview & Core Concept

- **Qué hace el proyecto**: Plataforma SaaS para productores agropecuarios costarricenses en el Régimen Especial Agropecuario (REA), que automatiza la ingesta de facturas por correo/WhatsApp, clasifica gastos con IA (IVA 1% canasta agropecuaria vs 13%), controla inventario multiespecie (bovinos, aves, peces, abejas), calcula costos unitarios de producción y gestiona la facturación electrónica ante el Ministerio de Hacienda (v4.4).
- **Público Objetivo**: Ganaderos, avicultores, apicultores y piscicultores de Costa Rica, así como sus contadores y administradores de finca.
- **Valor Principal de esta Fase**: Transformar una aplicación con dependencias externas rígidas y archivos huérfanos en un sistema robusto, modular, con IA dual moderna y preparado tanto para validación en sandbox de Hacienda como para demostración inmediata.

---

## 2. User Experience & Visual Design

- **Flujo de Usuario Mejorado**:
  1. *Acceso Directo o Demo*: El usuario puede ingresar con su cuenta o activar el modo demostración interactivo con datos representativos de una finca ganadera de Guanacaste/San Carlos.
  2. *Auditoría de Insumos*: Visualización clara de tarifas de IVA (1% agropecuario oficial, 2% medicamentos veterinarios, 13% general) con alertas de ahorro perdido en facturas mal cobradas.
  3. *Facturación y Anulación*: Flujo para emitir Factura Electrónica y anular o ajustar mediante Nota de Crédito (NC) y Tiquete (TE) directamente desde la UI de Hacienda.
  4. *Asistente Inteligente*: Chatbot tributario agropecuario potenciado por Gemini o NVIDIA que responde en streaming Server-Sent Events con contexto en tiempo real.
- **Lineamientos de Diseño (frontend-design SaaS)**:
  - *Identidad*: Estética agropecuaria moderna (verde bosque `#1B5E20`, esmeralda `#4CAF50`, ámbar `#F57F17` y superficie oscura `#0B131B` / `#13202D`).
  - *Disciplina Tipográfica y Cero Píldoras Estáticas*: Metadatos en texto limpio sin pastillas estáticas innecesarias; cifras numéricas con `tabular-nums` o tipografía monoespaciada para evitar saltos de línea.
  - *Controles Interactivos Claros*: Selectores segmentados para estados de documentos (Borrador, Firmada, Enviada, Aceptada, Rechazada).

---

## 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Soporte Dual de IA (Gemini `@google/genai` + NVIDIA NIM)**
  - *Enfoque*: Implementar un adaptador unificado `aiProvider.js` en el backend. Si existe `GEMINI_API_KEY` (por ejemplo en AI Studio / GCP), utiliza `gemini-3.8-flash` de alta velocidad y razonamiento; si está configurada `AI_API_KEY` / `NVIDIA_API_KEY`, utiliza el endpoint de NVIDIA; si ninguna está configurada, recurre a heurísticas contables locales.
  - *Por qué*: Elimina la dependencia crítica de un único proveedor y optimiza la compatibilidad con el entorno AI Studio Build.

- **Decisión 2: Builders XML v4.4 de Hacienda para NC / TE / FEC**
  - *Enfoque*: Modularizar `backend/services/hacienda/xmlBuilder.js` para que el nodo raíz y la estructura coincidan exactamente con la especificación técnica de Hacienda (`FacturaElectronica`, `NotaCreditoElectronica`, `TiqueteElectronico`, `FacturaElectronicaCompra`).
  - *Por qué*: Actualmente el sistema generaba `<FacturaElectronica>` para todos los tipos, lo cual provocaría rechazo inmediato en sandbox para Notas de Crédito.

- **Decisión 3: Limpieza y Eliminación de Archivos Obsoletos**
  - *Enfoque*: Eliminar `/scratch/`, `/backend/coverage/`, y limpiar scripts del `package.json`.
  - *Por qué*: Reducción de peso, eliminación de archivos temporales con tokens o pruebas obsoletas, y claridad en el repositorio.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Cliente Web (Vite React 19)          │
│  Landing · Dashboard · Facturas · Hacienda · Inventario│
└───────────────────────────┬────────────────────────────┘
                            │ /api (HTTP + SSE Streaming)
┌───────────────────────────▼────────────────────────────┐
│              Servidor Express Backend (:3000)          │
│  ┌───────────────────────┐   ┌───────────────────────┐ │
│  │   Rutas & Auth JWT    │   │  Hacienda v4.4 Engine │ │
│  │  (Tenant / RBAC / REA)│   │(Clave50, Signer, XML) │ │
│  └───────────┬───────────┘   └───────────┬───────────┘ │
│              │                           │             │
│  ┌───────────▼───────────┐   ┌───────────▼───────────┐ │
│  │   AI Engine Router    │   │ XML Multi-Document    │ │
│  │ Gemini 3.8 / NVIDIA   │   │  FE / NC / TE / FEC   │ │
│  └───────────────────────┘   └───────────────────────┘ │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    MongoDB / Fallback Stubs      Google Gemini API
    (In-memory / Persistent)     & NVIDIA NIM Endpoint
```

### Plan de Tareas por Fases:

1. **Fase 1: Depuración y Limpieza del Repositorio**
   - Eliminar directorio `/scratch/` con pruebas transitorias.
   - Eliminar `/backend/coverage/` con reportes HTML estáticos pesados.
   - Limpiar scripts en `package.json` para reflejar el estado actual.

2. **Fase 2: Motor Dual de IA (Google Gemini + NVIDIA)**
   - Instalar `@google/genai` en el backend.
   - Crear servicio unificado de IA con conmutación inteligente y soporte de streaming SSE para el chatbot agropecuario.
   - Actualizar categorización automática de facturas para utilizar el prompt oficial de insumos REA con ambos motores.

3. **Fase 3: Builders XML de Hacienda v4.4**
   - Implementar generadores XML para:
     - `NotaCreditoElectronica` (v4.4 con nodo `InformacionReferencia`)
     - `TiqueteElectronico` (v4.4 simplificado)
     - `FacturaElectronicaCompra` (v4.4 para compras a régimen simplificado)
   - Vincular con el motor de firma digital XAdES-EPES existente.

4. **Fase 4: Modo Demostración y Enriquecimiento Funcional**
   - Incorporar generador de datos semilla (seed) para pruebas inmediatas en vivo.
   - Añadir validación visual y resumen en la UI de Hacienda para emisión y anulación.
   - Ejecutar suite de validación `compile_applet` y `lint_applet`.
