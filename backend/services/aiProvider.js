/**
 * Proveedor Dual de Inteligencia Artificial para ContadorGanadero
 * Soporta de manera transparente:
 * 1. Google Gemini (@google/genai) con gemini-3.8-flash
 * 2. NVIDIA NIM / OpenAI (openai)
 * 3. Modo heurístico local sin dependencias externas
 */

const { configurarIA } = require('../config/ai');

let geminiClient = null;
let openAIClient = null;
let proveedorActivo = 'none';

function inicializarProveedores() {
  const config = configurarIA();

  // 1. Intentar Google Gemini primero
  if (config.gemini?.apiKey) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      geminiClient = new GoogleGenAI({
        apiKey: config.gemini.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      proveedorActivo = 'gemini';
      console.log(`🤖 IA Proveedor Activo: Google Gemini (${config.gemini.modelo})`);
      return { proveedor: 'gemini', geminiClient, config };
    } catch (err) {
      console.warn('⚠️ No se pudo inicializar @google/genai:', err.message);
    }
  }

  // 2. Intentar NVIDIA NIM / OpenAI
  if (config.nvidia?.apiKey) {
    try {
      const OpenAI = require('openai');
      openAIClient = new OpenAI({
        apiKey: config.nvidia.apiKey,
        baseURL: config.nvidia.baseURL,
        defaultHeaders: config.nvidia.headers,
        timeout: config.defaults.timeout,
      });
      proveedorActivo = 'nvidia';
      console.log(`🤖 IA Proveedor Activo: NVIDIA NIM (${config.nvidia.modelo})`);
      return { proveedor: 'nvidia', openAIClient, config };
    } catch (err) {
      console.warn('⚠️ No se pudo inicializar OpenAI client:', err.message);
    }
  }

  proveedorActivo = 'heuristic';
  console.log('ℹ️ IA Operando en modo heurístico local (sin API Key configurada)');
  return { proveedor: 'heuristic', config };
}

function obtenerEstadoIA() {
  if (proveedorActivo === 'none') {
    inicializarProveedores();
  }
  return {
    proveedor: proveedorActivo,
    disponible: proveedorActivo !== 'none',
  };
}

/**
 * Clasificación con IA de factura electrónica
 */
async function categorizarFacturaDual(datosFactura, systemPrompt) {
  const { proveedor, config } = inicializarProveedores();

  const resumenLineas = (datosFactura.lineaDetalle || [])
    .map((l, i) => `  ${i + 1}. ${l.descripcion} — ₡${l.subtotal} (IVA: ${l.impuesto?.tarifa || 0}%)`)
    .join('\n');

  const promptUsuario = `Analiza esta factura electrónica y clasifica el gasto para un productor agropecuario costarricense (REA):

EMISOR: ${datosFactura.emisor?.nombre || 'Desconocido'}
CÉDULA EMISOR: ${datosFactura.emisor?.cedula?.numero || 'N/A'}
FECHA: ${datosFactura.fechaEmision}
TOTAL: ₡${datosFactura.resumenFactura?.totalComprobante || 0}
IVA TOTAL: ₡${datosFactura.resumenFactura?.totalImpuesto || 0}
TASA IVA PREDOMINANTE: ${datosFactura.tasaIVA || 1}%

DETALLE DE LÍNEAS:
${resumenLineas || '  (sin detalle)'}`;

  // 1. Ejecución con Google Gemini
  if (proveedor === 'gemini' && geminiClient) {
    try {
      const { Type } = require('@google/genai');
      const response = await geminiClient.models.generateContent({
        model: config.gemini.modelo || 'gemini-3.8-flash',
        contents: promptUsuario,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categoria: { type: Type.STRING },
              subcategoria: { type: Type.STRING },
              esDeducible: { type: Type.BOOLEAN },
              justificacion: { type: Type.STRING },
              confianza: { type: Type.NUMBER },
            },
            required: ['categoria', 'esDeducible', 'justificacion', 'confianza'],
          },
        },
      });

      const parsed = JSON.parse(response.text.trim());
      return normalizarCategorizacion(parsed);
    } catch (err) {
      console.warn('⚠️ Fallo en Gemini categorización, intentando fallback:', err.message);
    }
  }

  // 2. Ejecución con NVIDIA NIM / OpenAI
  if (openAIClient) {
    try {
      const respuesta = await openAIClient.chat.completions.create({
        model: config.nvidia.modelo,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptUsuario },
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const contenido = respuesta.choices[0]?.message?.content;
      if (contenido) {
        const parsed = JSON.parse(contenido);
        return normalizarCategorizacion(parsed);
      }
    } catch (err) {
      console.warn('⚠️ Fallo en NVIDIA categorización, usando heurística:', err.message);
    }
  }

  // 3. Heurística contable local
  return categorizacionHeuristica(datosFactura);
}

/**
 * Normaliza y valida la salida JSON de la IA
 */
function normalizarCategorizacion(resultado) {
  const categoriasValidas = [
    'veterinaria', 'alimentacion_animal', 'maquinaria_equipo',
    'transporte', 'servicios_profesionales', 'combustible',
    'mantenimiento', 'seguros', 'insumos_agropecuarios',
    'salarios', 'servicios_publicos', 'otros',
  ];

  let cat = (resultado.categoria || '').toLowerCase().trim();
  if (!categoriasValidas.includes(cat)) {
    cat = 'otros';
  }

  return {
    categoriaIA: cat,
    subcategoriaIA: resultado.subcategoria || '',
    esDeducible: resultado.esDeducible !== false,
    justificacionIA: resultado.justificacion || 'Categorización automática por IA',
    confianzaIA: Math.min(Math.max(Number(resultado.confianza) || 0.85, 0), 1),
  };
}

/**
 * Clasificación heurística según palabras clave comunes en facturas agrícolas y tarifas
 */
function categorizacionHeuristica(datosFactura) {
  const texto = [
    datosFactura.emisor?.nombre || '',
    ...(datosFactura.lineaDetalle || []).map(l => l.descripcion || ''),
  ].join(' ').toLowerCase();

  let cat = 'otros';
  let sub = 'Gasto general';
  let justificacion = 'Clasificación basada en reglas contables de insumos';

  if (texto.includes('alimento') || texto.includes('concentrado') || texto.includes('melaza') || texto.includes('sal mineral') || texto.includes('paca')) {
    cat = 'alimentacion_animal';
    sub = 'Nutrición del ganado';
    justificacion = 'Insumo alimenticio con tarifa agropecuaria REA';
  } else if (texto.includes('veterin') || texto.includes('vacuna') || texto.includes('desparasit') || texto.includes('antibiot') || texto.includes('ivermectina')) {
    cat = 'veterinaria';
    sub = 'Salud y sanidad animal';
    justificacion = 'Medicamento o insumo veterinario';
  } else if (texto.includes('diesel') || texto.includes('gasolina') || texto.includes('combustible')) {
    cat = 'combustible';
    sub = 'Combustible maquinaria/transporte';
    justificacion = 'Combustible para operación de la finca';
  } else if (texto.includes('alambre') || texto.includes('poste') || texto.includes('grapa') || texto.includes('malla') || texto.includes('fertilizante') || texto.includes('semilla')) {
    cat = 'insumos_agropecuarios';
    sub = 'Insumos de cerca y pastura';
    justificacion = 'Insumo indispensable para la producción agropecuaria';
  } else if (texto.includes('taller') || texto.includes('repuesto') || texto.includes('mantenimiento') || texto.includes('reparacion')) {
    cat = 'mantenimiento';
    sub = 'Reparación de equipos e infraestructura';
    justificacion = 'Mantenimiento de instalaciones agropecuarias';
  }

  return {
    categoriaIA: cat,
    subcategoriaIA: sub,
    esDeducible: true,
    justificacionIA: justificacion,
    confianzaIA: 0.82,
  };
}

/**
 * Streaming para el Chatbot con soporte dual
 */
async function streamChatDual({ systemPrompt, messages, onChunk, onDone, onError }) {
  const { proveedor, config } = inicializarProveedores();

  // 1. Stream con Google Gemini
  if (proveedor === 'gemini' && geminiClient) {
    try {
      // Construir historial y último mensaje
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const stream = await geminiClient.models.generateContentStream({
        model: config.gemini.modelo || 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          onChunk(chunk.text);
        }
      }
      onDone();
      return;
    } catch (err) {
      console.warn('⚠️ Error en streaming Gemini:', err.message);
      if (!openAIClient) {
        return onError(err.message || 'Error en streaming Gemini');
      }
    }
  }

  // 2. Stream con NVIDIA NIM / OpenAI
  if (openAIClient) {
    try {
      const stream = await openAIClient.chat.completions.create({
        model: config.nvidia.modelo,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: config.defaults.temperature,
        max_tokens: config.defaults.max_tokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          onChunk(delta);
        }
      }
      onDone();
      return;
    } catch (err) {
      console.warn('⚠️ Error en streaming NVIDIA:', err.message);
      return onError(err.message || 'Error en streaming OpenAI/NVIDIA');
    }
  }

  // 3. Fallback Heurístico si no hay conexión
  onError('Servicio de IA no configurado con API Key');
}

/**
 * Consulta unaria (no streaming) para el chat con soporte dual
 */
async function generarChatDual({ systemPrompt, messages }) {
  const { proveedor, config } = inicializarProveedores();

  // 1. Google Gemini
  if (proveedor === 'gemini' && geminiClient) {
    try {
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await geminiClient.models.generateContent({
        model: config.gemini.modelo || 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
        },
      });

      return {
        contenido: response.text || 'Sin respuesta generada.',
        tokensUsados: response.usageMetadata?.totalTokenCount || 0,
        modelo: config.gemini.modelo || 'gemini-3.8-flash',
        proveedor: 'gemini',
      };
    } catch (err) {
      console.warn('⚠️ Error en chat unario Gemini, intentando fallback:', err.message);
      if (!openAIClient) throw err;
    }
  }

  // 2. NVIDIA NIM / OpenAI
  if (openAIClient) {
    const respuesta = await openAIClient.chat.completions.create({
      model: config.nvidia.modelo,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: config.defaults.temperature,
      max_tokens: config.defaults.max_tokens,
    });

    return {
      contenido: respuesta.choices[0]?.message?.content || 'Sin respuesta generada.',
      tokensUsados: respuesta.usage?.total_tokens || 0,
      modelo: config.nvidia.modelo,
      proveedor: 'nvidia',
    };
  }

  throw new Error('Servicio de IA no disponible ni configurado');
}

module.exports = {
  inicializarProveedores,
  obtenerEstadoIA,
  categorizarFacturaDual,
  streamChatDual,
  generarChatDual,
};
