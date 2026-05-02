/**
 * Servicio de IA para categorización de gastos
 * Usa OpenRouter (compatible con SDK de OpenAI)
 */

const OpenAI = require('openai');
const { configurarOpenRouter } = require('../config/ai');

let clienteIA = null;
let modeloIA = null;

/**
 * Inicializar el cliente de OpenRouter
 */
function inicializarCliente() {
  if (clienteIA) return;
  const config = configurarOpenRouter();
  if (!config.apiKey) {
    console.warn('⚠️  Servicio de IA no inicializado: falta OPENROUTER_API_KEY');
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

// Prompt del sistema para categorización
const SYSTEM_PROMPT = `Eres un asistente contable especializado en el sector ganadero de Costa Rica.
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

/**
 * Categorizar una factura usando IA
 * @param {object} datosFactura - Datos parseados de la factura
 * @returns {object} Categorización de la IA
 */
async function categorizarFactura(datosFactura) {
  inicializarCliente();

  if (!clienteIA) {
    console.warn('⚠️  Cliente de IA no disponible, retornando categoría por defecto');
    return categoriaFallback();
  }

  try {
    // Construir resumen de la factura para el prompt
    const resumenLineas = (datosFactura.lineaDetalle || [])
      .map((l, i) => `  ${i + 1}. ${l.descripcion} — ₡${l.subtotal} (IVA: ${l.impuesto?.tarifa || 0}%)`)
      .join('\n');

    const promptUsuario = `Analiza esta factura y clasifica el gasto:

EMISOR: ${datosFactura.emisor?.nombre || 'Desconocido'}
CÉDULA EMISOR: ${datosFactura.emisor?.cedula?.numero || 'N/A'}
FECHA: ${datosFactura.fechaEmision}
TOTAL: ₡${datosFactura.resumenFactura?.totalComprobante || 0}
IVA TOTAL: ₡${datosFactura.resumenFactura?.totalImpuesto || 0}
TASA IVA PREDOMINANTE: ${datosFactura.tasaIVA}%

DETALLE DE LÍNEAS:
${resumenLineas || '  (sin detalle)'}`;

    const respuesta = await clienteIA.chat.completions.create({
      model: modeloIA,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: promptUsuario },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const contenido = respuesta.choices[0]?.message?.content;
    if (!contenido) return categoriaFallback();

    const resultado = JSON.parse(contenido);

    // Validar que la categoría sea válida
    const categoriasValidas = [
      'veterinaria', 'alimentacion_animal', 'maquinaria_equipo',
      'transporte', 'servicios_profesionales', 'combustible',
      'mantenimiento', 'seguros', 'insumos_agropecuarios',
      'salarios', 'servicios_publicos', 'otros',
    ];

    if (!categoriasValidas.includes(resultado.categoria)) {
      resultado.categoria = 'otros';
      resultado.confianza = Math.min(resultado.confianza || 0.5, 0.5);
    }

    return {
      categoriaIA: resultado.categoria,
      subcategoriaIA: resultado.subcategoria || '',
      esDeducible: resultado.esDeducible !== false,
      justificacionIA: resultado.justificacion || '',
      confianzaIA: Math.min(Math.max(resultado.confianza || 0.5, 0), 1),
    };
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

module.exports = { categorizarFactura, inicializarCliente };
