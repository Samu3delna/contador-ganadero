/**
 * Servicio de IA para categorización de gastos
 * Usa NVIDIA NIM API (compatible con SDK de OpenAI)
 */

const OpenAI = require('openai');
const { configurarOpenRouter: configurarIA } = require('../config/ai');

let clienteIA = null;
let modeloIA = null;

/**
 * Inicializar el cliente de IA (NVIDIA NIM)
 */
function inicializarCliente() {
  if (clienteIA) return;
  const config = configurarIA();
  if (!config.apiKey) {
    console.warn('⚠️  Servicio de IA no inicializado: falta AI_API_KEY');
    return;
  }
  clienteIA = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.headers,
  });
  modeloIA = config.modelo;
  console.log(`🤖 Servicio de IA inicializado (modelo: ${modeloIA})`);
}

// Prompt del sistema base para categorización
const SYSTEM_PROMPT_BASE = `Eres un asistente contable especializado en el sector ganadero de Costa Rica.
Tu trabajo es analizar facturas electrónicas y clasificar los gastos.

CONTEXTO:
- El usuario es un pequeño ganadero bajo el Régimen Especial Agropecuario (REA).
- Los insumos agropecuarios para producción de canasta básica tributan al 1% de IVA.
- La tarifa general de IVA es del 13%.
- Medicamentos veterinarios pueden tener IVA al 2%.

CATEGORÍAS VÁLIDAS:
- veterinaria: Medicamentos, consultas, vacunas, desparasitantes
- alimentacion_animal: Concentrados, sales minerales, melaza, pacas de heno
- maquinaria_equipo: Compra o alquiler de equipo agrícola
- transporte: Fletes, transporte de ganado, combustible de vehículos
- servicios_profesionales: Honorarios de contador, abogado, agrónomo
- combustible: Diesel, gasolina para maquinaria o vehículos
- mantenimiento: Reparaciones de cercas, corrales, instalaciones
- seguros: Pólizas de ganado, finca, vehículos
- insumos_agropecuarios: Semillas de pasto, fertilizantes, alambre, postes
- salarios: Planilla de peones, mandadores
- servicios_publicos: Agua, electricidad, internet, teléfono
- otros: Todo lo que no encaje en las anteriores

RESPONDE SIEMPRE en JSON válido con esta estructura exacta:
{
  "categoria": "nombre_categoria",
  "subcategoria": "descripción breve específica",
  "esDeducible": true,
  "justificacion": "explicación corta de por qué esta categoría",
  "confianza": 0.95
}`;

let INSUMOS_OFICIALES_TEXTO = "";
try {
  const fs = require('fs');
  const path = require('path');
  const insumosOficiales = JSON.parse(fs.readFileSync(path.join(__dirname, '../insumos_oficiales.json'), 'utf8'));
  INSUMOS_OFICIALES_TEXTO = `\n\nLISTA OFICIAL DE INSUMOS AGROPECUARIOS (Anexo del Ministerio de Hacienda):\nPara ayudarte a diferenciar los objetos en las facturas, aquí tienes la lista oficial de insumos que gozan de beneficios fiscales. Úsala como referencia para clasificar correctamente los gastos:\n` + insumosOficiales.map(i => `- ${i}`).join('\n');
} catch (error) {
  console.warn("⚠️ No se pudo cargar insumos_oficiales.json para el prompt de la IA:", error.message);
}

function getSystemPrompt() {
  return SYSTEM_PROMPT_BASE + INSUMOS_OFICIALES_TEXTO;
}

const { categorizarFacturaDual, inicializarProveedores } = require('./aiProvider');

/**
 * Categorizar una factura usando el motor dual de IA (Gemini / NVIDIA / Heurística)
 * @param {object} datosFactura - Datos parseados de la factura
 * @returns {object} Categorización de la IA
 */
async function categorizarFactura(datosFactura) {
  try {
    return await categorizarFacturaDual(datosFactura, getSystemPrompt());
  } catch (error) {
    console.error('❌ Error en categorización IA:', error.message);
    return categoriaFallback();
  }
}

/**
 * Categoría por defecto cuando la IA falla
 */
function categoriaFallback() {
  return {
    categoriaIA: 'sin_clasificar',
    subcategoriaIA: 'Pendiente de revisión manual',
    esDeducible: true,
    justificacionIA: 'No se pudo categorizar automáticamente',
    confianzaIA: 0,
  };
}

module.exports = { categorizarFactura, inicializarCliente: inicializarProveedores };
