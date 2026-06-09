const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const { configurarOpenRouter } = require('../config/ai');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const Inventario = require('../models/Inventario');
const CostoProduccion = require('../models/CostoProduccion');
const ChatFeedback = require('../models/ChatFeedback');
const { encoding_for_model } = require('tiktoken');
const { contextCache } = require('../utils/chatCache');
const { sanitizarInput, filtrarPII, sanitizarContexto } = require('../utils/sanitizer');

// ============ INICIALIZACIÓN DEL CLIENTE IA ============

let clienteIA = null;
let modeloIA = null;
let aiDefaults = null;
let clienteInicializado = false;
let tiktokenEncoder = null;

function obtenerEncoder() {
  if (!tiktokenEncoder) {
    try {
      tiktokenEncoder = encoding_for_model('gpt-4');
    } catch (e) {
      tiktokenEncoder = encoding_for_model('cl100k_base');
    }
  }
  return tiktokenEncoder;
}

function contarTokens(texto) {
  try {
    const encoder = obtenerEncoder();
    return encoder.encode(texto).length;
  } catch {
    // Fallback: estimación por caracteres
    return Math.ceil(texto.length / 4);
  }
}

function inicializarCliente() {
  if (clienteInicializado) return !!clienteIA;
  clienteInicializado = true;

  const config = configurarOpenRouter();
  if (!config.apiKey) {
    console.warn('⚠️  Servicio de IA no inicializado: falta OPENROUTER_API_KEY');
    return false;
  }
  try {
    clienteIA = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.headers,
      timeout: config.defaults.timeout,
      maxRetries: config.defaults.maxRetries,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    });
    modeloIA = config.modelo;
    aiDefaults = config.defaults;
    console.log(`🤖 Chat IA inicializado (modelo: ${modeloIA})`);
    return true;
  } catch (error) {
    console.error('❌ Error inicializando cliente IA:', error.message);
    return false;
  }
}

function estaIADisponible() {
  return inicializarCliente();
}

// ============ SYSTEM PROMPT ============

const SYSTEM_PROMPT_CHAT = `Eres un asistente contable experto en el sector ganadero de Costa Rica, especializado en el Régimen Especial Agropecuario (REA).

CONTEXTO REA - LÍMITES DE DEDUCIBILIDAD POR CATEGORÍA:
- Insumos agropecuarios para canasta básica: 1% IVA (deducible 100% del IVA pagado)
- Medicamentos veterinarios: 2% IVA (deducible 100% del IVA pagado)
- Bienes y servicios generales: 13% IVA (deducible según proporción de ingresos gravados)
- Combustibles: 13% IVA (deducible 100% si uso exclusivo ganadero, parcial si mixto)
- Servicios profesionales: 13% IVA (deducible 100% si directa relación actividad)

CONTEXTO DEL USUARIO:
- Pequeño ganadero bajo REA
- Debe llevar contabilidad simplificada pero ordenada
- Declaraciones: D-104 mensual, D-101 anual, D-151 si aplica

REGLAS ESTRICTAS:
- NUNCA inventes datos, cifras, ni normativa. Si no tienes la información exacta, responde EXACTAMENTE: "No tengo esa información"
- NO des asesoría legal vinculante. Siempre incluye disclaimer.
- NO asumas datos del usuario que no estén en el contexto provisto.
- Cuando cites facturas o ingresos del usuario, incluye la fecha y el emisor/concepto para que pueda identificarlos.

FORMATO OBLIGATORIO DE RESPUESTA:
**Respuesta:** [Respuesta directa y concisa]

**Cálculo:** [Solo si aplica: muestra el cálculo paso a paso con fórmulas]

**Fuentes:** [Cita normativa: Ley 7092, Reglamento IVA, Resoluciones DGT, jurisprudencia]

**Disclaimer:** Esta es orientación contable general. Para decisiones vinculantes, consulta a un contador público autorizado o a la Administración Tributaria.

EJEMPLOS (FEW-SHOT):

Usuario: "¿Cuánto IVA puedo deducir de una factura de ₡500,000 de insumos para canasta básica?"
Asistente:
**Respuesta:** Puede deducir el 100% del IVA pagado (1%), equivalente a ₡4,950 aproximadamente.
**Cálculo:** ₡500,000 × 1% / 1.01 = ₡4,950.50 de IVA contenido
**Fuentes:** Ley 7092 Art. 14, Reglamento IVA Art. 30, Resolución DGT-R-044-2023
**Disclaimer:** Esta es orientación contable general. Para decisiones vinculantes, consulta a un contador público autorizado o a la Administración Tributaria.

Usuario: "¿Los gastos de veterinario son deducibles al 100%?"
Asistente:
**Respuesta:** Sí, los medicamentos veterinarios (2% IVA) son deducibles al 100% del IVA contenido si son para la actividad ganadera.
**Cálculo:** IVA contenido = Total factura × 2% / 1.02
**Fuentes:** Ley 7092 Art. 14, Reglamento IVA Art. 30 incisos a) y b)
**Disclaimer:** Esta es orientación contable general. Para decisiones vinculantes, consulta a un contador público autorizado o a la Administración Tributaria.

Usuario: "¿Cuál es el tope de deducibilidad para combustibles?"
Asistente:
**Respuesta:** No tengo esa información específica sobre topes máximos de deducibilidad de combustibles en REA.
**Fuentes:** Ley 7092, Reglamento IVA
**Disclaimer:** Esta es orientación contable general. Para decisiones vinculantes, consulta a un contador público autorizado o a la Administración Tributaria.

RESPONDE EN ESPAÑOL, de forma concisa y práctica. Usa formato markdown.`;

// ============ CONTEXTO DEL USUARIO ============

async function obtenerContextoUsuario(usuarioId) {
  // Verificar cache primero
  const cached = contextCache.get(usuarioId);
  if (cached) return cached;

  const [facturas, ingresos, inventario, costos] = await Promise.all([
    Factura.find({ usuario: usuarioId }).sort({ fechaEmision: -1 }).limit(20).lean(),
    Ingreso.find({ usuario: usuarioId }).sort({ fecha: -1 }).limit(10).lean(),
    Inventario.findOne({ usuario: usuarioId }).lean(),
    CostoProduccion.find({ usuario: usuarioId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const totalGastos = facturas.reduce((sum, f) => sum + (f.resumenFactura?.totalComprobante || 0), 0);
  const totalIngresos = ingresos.reduce((sum, i) => sum + (i.monto || 0), 0);
  const gastosPorCategoria = {};
  facturas.forEach(f => {
    const cat = f.categoriaIA || 'sin_clasificar';
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (f.resumenFactura?.totalComprobante || 0);
  });

  // KPIs ganaderos
  const costosAbiertos = costos.filter(c => c.estado === 'abierto');
  const costosCerrados = costos.filter(c => c.estado === 'cerrado');
  let costoKgPromedio = null;
  if (costosCerrados.length > 0) {
    const totalCosto = costosCerrados.reduce((sum, c) => sum + (c.costoTotal || 0), 0);
    const totalKg = costosCerrados.reduce((sum, c) => sum + (c.produccionTotal?.kg || 0), 0);
    if (totalKg > 0) costoKgPromedio = totalCosto / totalKg;
  }

  const bovinos = inventario?.bovinos?.length || 0;
  const aves = inventario?.aves?.reduce((sum, l) => sum + (l.cantidad || 0), 0) || 0;
  const peces = inventario?.peces?.reduce((sum, e) => sum + (e.cantidad || 0), 0) || 0;
  const colmenas = inventario?.colmenas?.length || 0;

  // Gastos por mes (últimos 3 meses) para tendencia
  const hace3Meses = new Date();
  hace3Meses.setMonth(hace3Meses.getMonth() - 3);
  const gastosPorMes = {};
  facturas.filter(f => new Date(f.fechaEmision) >= hace3Meses).forEach(f => {
    const fecha = new Date(f.fechaEmision);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    gastosPorMes[mes] = (gastosPorMes[mes] || 0) + (f.resumenFactura?.totalComprobante || 0);
  });

  const contexto = {
    resumen: {
      totalFacturas: facturas.length,
      totalGastos,
      totalIngresos,
      balance: totalIngresos - totalGastos,
      gastosPorCategoria,
      gastosPorMes,
    },
    kpis: {
      costoKgPromedio: costoKgPromedio ? Math.round(costoKgPromedio) : null,
      margen: totalIngresos > 0 ? Math.round(((totalIngresos - totalGastos) / totalIngresos) * 100) : null,
    },
    inventario: { bovinos, aves, peces, colmenas },
    ultimasFacturas: facturas.slice(0, 5).map(f => ({
      id: f._id?.toString(),
      fecha: f.fechaEmision,
      emisor: f.emisor?.nombre,
      total: f.resumenFactura?.totalComprobante,
      categoria: f.categoriaIA,
      iva: f.resumenFactura?.totalImpuesto,
    })),
    ultimosIngresos: ingresos.slice(0, 3).map(i => ({
      id: i._id?.toString(),
      fecha: i.fecha,
      concepto: i.concepto,
      monto: i.monto,
    })),
    centrosCostoActivos: costosAbiertos.length,
  };

  // Guardar en cache (5 min)
  contextCache.set(usuarioId, contexto);

  return contexto;
}

// ============ CONSTRUCCIÓN DEL PROMPT DE CONTEXTO ============

function construirPromptContexto(contexto) {
  const kpisStr = [];
  if (contexto.kpis?.costoKgPromedio) kpisStr.push(`Costo/kg promedio: ₡${contexto.kpis.costoKgPromedio.toLocaleString()}`);
  if (contexto.kpis?.margen != null) kpisStr.push(`Margen: ${contexto.kpis.margen}%`);

  const gastosMesStr = Object.entries(contexto.resumen.gastosPorMes || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, val]) => `  - ${mes}: ₡${val.toLocaleString()}`)
    .join('\n');

  return `DATOS ACTUALES DEL USUARIO:
- Facturas registradas: ${contexto.resumen.totalFacturas}
- Total gastos: ₡${contexto.resumen.totalGastos.toLocaleString()}
- Total ingresos: ₡${contexto.resumen.totalIngresos.toLocaleString()}
- Balance: ₡${contexto.resumen.balance.toLocaleString()}
- Inventario: ${contexto.inventario.bovinos} bovinos, ${contexto.inventario.aves} aves, ${contexto.inventario.peces} peces, ${contexto.inventario.colmenas} colmenas
- Centros de costo abiertos: ${contexto.centrosCostoActivos}
${kpisStr.length > 0 ? `- KPIs: ${kpisStr.join(', ')}` : ''}

GASTOS POR CATEGORÍA:
${Object.entries(contexto.resumen.gastosPorCategoria).map(([cat, val]) => `  - ${cat}: ₡${val.toLocaleString()}`).join('\n') || '  (sin datos)'}

TENDENCIA GASTOS (últimos 3 meses):
${gastosMesStr || '  (sin datos)'}

ÚLTIMAS FACTURAS:
${contexto.ultimasFacturas.map(f => `  - [${f.id?.slice(-6) || '?'}] ${f.fecha}: ${f.emisor} - ₡${f.total} (${f.categoria}) IVA: ₡${f.iva || 0}`).join('\n') || '  (ninguna)'}

ÚLTIMOS INGRESOS:
${contexto.ultimosIngresos.map(i => `  - [${i.id?.slice(-6) || '?'}] ${i.fecha}: ${i.concepto} - ₡${i.monto}`).join('\n') || '  (ninguno)'}`;
}

// ============ TRUNCAMIENTO INTELIGENTE ============

const MAX_MENSAJE_LENGTH = 2000;
const MAX_HISTORIAL_MESSAGES = 10; // Aumentado de 6 a 10
const MAX_CONTEXTO_TOKENS = 3000;

function truncarContexto(contexto, maxTokens = MAX_CONTEXTO_TOKENS) {
  const promptCompleto = construirPromptContexto(contexto);
  const tokensActuales = contarTokens(promptCompleto);

  if (tokensActuales <= maxTokens) return promptCompleto;

  // Prioridad: siempre mantener resumen financiero + inventario + KPIs + últimas 3 facturas
  // Reducir ingresos y facturas proporcionalmente
  const factor = maxTokens / tokensActuales;
  const numFacturas = Math.max(3, Math.floor(5 * factor)); // Mínimo 3
  const numIngresos = Math.max(1, Math.floor(3 * factor));

  const contextoRecortado = {
    ...contexto,
    ultimasFacturas: contexto.ultimasFacturas.slice(0, numFacturas),
    ultimosIngresos: contexto.ultimosIngresos.slice(0, numIngresos),
    resumen: {
      ...contexto.resumen,
      // Comprimir gastos por mes si hay muchos
      gastosPorMes: Object.fromEntries(
        Object.entries(contexto.resumen.gastosPorMes || {}).slice(-2) // Últimos 2 meses
      ),
    },
  };

  return construirPromptContexto(contextoRecortado);
}

// ============ RESPUESTA FALLBACK OFFLINE ============

function generarRespuestaOffline(contexto) {
  if (!contexto) {
    return 'El servicio de IA no está disponible en este momento. No se pudieron cargar tus datos. Intenta de nuevo más tarde.';
  }

  return `⚠️ **El servicio de IA no está disponible temporalmente.** Aquí tienes un resumen de tus datos actuales:

**Resumen Financiero:**
- Total gastos: ₡${contexto.resumen.totalGastos.toLocaleString()}
- Total ingresos: ₡${contexto.resumen.totalIngresos.toLocaleString()}
- Balance: ₡${contexto.resumen.balance.toLocaleString()}
- Facturas registradas: ${contexto.resumen.totalFacturas}

**Inventario:**
- ${contexto.inventario.bovinos} bovinos, ${contexto.inventario.aves} aves, ${contexto.inventario.peces} peces, ${contexto.inventario.colmenas} colmenas

**Gastos por Categoría:**
${Object.entries(contexto.resumen.gastosPorCategoria).map(([cat, val]) => `- ${cat}: ₡${val.toLocaleString()}`).join('\n') || '(sin datos)'}

_Intenta tu pregunta de nuevo cuando el servicio se restablezca._`;
}

// ============ ENDPOINT PRINCIPAL: CHAT ============

async function chat(req, res) {
  const startTime = Date.now();
  const requestId = uuidv4().slice(0, 8);

  try {
    const { mensaje, historial = [] } = req.body;
    const usuarioId = req.usuario._id;

    // Sanitizar input
    const { valido, texto: mensajeLimpio, error: errorSanitizacion } = sanitizarInput(mensaje);
    if (!valido) {
      return res.status(400).json({
        error: errorSanitizacion,
        respuesta: errorSanitizacion,
      });
    }

    // Verificar disponibilidad de IA
    if (!estaIADisponible()) {
      // Fallback offline: responder con datos locales
      try {
        const contexto = await obtenerContextoUsuario(usuarioId);
        return res.json({
          respuesta: generarRespuestaOffline(contexto),
          offline: true,
        });
      } catch {
        return res.status(503).json({
          error: 'Servicio de IA no disponible',
          respuesta: 'El servicio de IA no está configurado. Contacta al administrador.',
        });
      }
    }

    // Obtener y sanitizar contexto
    const contextoRaw = await obtenerContextoUsuario(usuarioId);
    const contexto = sanitizarContexto(contextoRaw);
    const promptContexto = truncarContexto(contexto);

    // Filtrar PII del mensaje del usuario
    const mensajeFiltrado = filtrarPII(mensajeLimpio);

    // Construir historial (aumentado a 10 mensajes)
    const historialRecortado = historial.slice(-MAX_HISTORIAL_MESSAGES).map(h => ({
      role: h.rol === 'user' ? 'user' : 'assistant',
      content: (h.contenido || '').substring(0, 1000),
    }));

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT_CHAT },
      { role: 'system', content: promptContexto },
      ...historialRecortado,
      { role: 'user', content: mensajeFiltrado },
    ];

    // Llamada a la IA
    const respuesta = await clienteIA.chat.completions.create({
      model: modeloIA,
      messages,
      temperature: aiDefaults.temperature,
      max_tokens: aiDefaults.max_tokens,
    });

    const contenido = respuesta.choices[0]?.message?.content || 'No se pudo generar respuesta.';
    const tokensUsados = respuesta.usage?.total_tokens || 0;

    const duracion = Date.now() - startTime;
    console.log(`💬 [${requestId}] Chat: usuario=${usuarioId} tokens=${tokensUsados} tiempo=${duracion}ms modelo=${modeloIA}`);

    res.json({ respuesta: contenido, requestId });
  } catch (error) {
    const duracion = Date.now() - startTime;
    console.error(`❌ [${requestId}] Error en chat (${duracion}ms):`, error.message);

    // Manejo granular de errores por código HTTP
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Límite de tasa excedido',
        respuesta: 'Demasiadas consultas al servicio de IA. Espera un momento e intenta de nuevo.',
        retryAfter: error.headers?.['retry-after'] || 30,
      });
    }

    if (error.status === 401) {
      return res.status(401).json({
        error: 'Error de autenticación IA',
        respuesta: 'Error de configuración del servicio de IA. Contacta al administrador.',
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Solicitud inválida a la IA',
        respuesta: 'La consulta no pudo ser procesada. Intenta reformular tu pregunta.',
      });
    }

    if (error.status === 503 || error.status === 502) {
      // Fallback offline
      try {
        const contexto = await obtenerContextoUsuario(req.usuario._id);
        return res.json({
          respuesta: generarRespuestaOffline(contexto),
          offline: true,
        });
      } catch {
        // Si también falla la DB, error genérico
      }
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      respuesta: 'Ocurrió un error al procesar tu consulta. Intenta de nuevo.',
    });
  }
}

// ============ ENDPOINT SSE: STREAMING ============

async function chatStream(req, res) {
  const startTime = Date.now();
  const requestId = uuidv4().slice(0, 8);

  // Configurar headers SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Request-Id': requestId,
  });

  try {
    const { mensaje, historial = [] } = req.body;
    const usuarioId = req.usuario._id;

    // Sanitizar input
    const { valido, texto: mensajeLimpio, error: errorSanitizacion } = sanitizarInput(mensaje);
    if (!valido) {
      res.write(`data: ${JSON.stringify({ error: errorSanitizacion })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    if (!estaIADisponible()) {
      try {
        const contexto = await obtenerContextoUsuario(usuarioId);
        res.write(`data: ${JSON.stringify({ contenido: generarRespuestaOffline(contexto), offline: true })}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ error: 'Servicio de IA no disponible' })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Obtener y sanitizar contexto
    const contextoRaw = await obtenerContextoUsuario(usuarioId);
    const contexto = sanitizarContexto(contextoRaw);
    const promptContexto = truncarContexto(contexto);
    const mensajeFiltrado = filtrarPII(mensajeLimpio);

    const historialRecortado = historial.slice(-MAX_HISTORIAL_MESSAGES).map(h => ({
      role: h.rol === 'user' ? 'user' : 'assistant',
      content: (h.contenido || '').substring(0, 1000),
    }));

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT_CHAT },
      { role: 'system', content: promptContexto },
      ...historialRecortado,
      { role: 'user', content: mensajeFiltrado },
    ];

    // Stream desde OpenRouter
    const stream = await clienteIA.chat.completions.create({
      model: modeloIA,
      messages,
      temperature: aiDefaults.temperature,
      max_tokens: aiDefaults.max_tokens,
      stream: true,
    });

    let tokensOut = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        tokensOut++;
        res.write(`data: ${JSON.stringify({ contenido: delta })}\n\n`);
      }
    }

    const duracion = Date.now() - startTime;
    console.log(`💬 [${requestId}] Stream: usuario=${usuarioId} chunks=${tokensOut} tiempo=${duracion}ms`);

    res.write(`data: ${JSON.stringify({ done: true, requestId })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const duracion = Date.now() - startTime;
    console.error(`❌ [${requestId}] Error en stream (${duracion}ms):`, error.message);

    const errorMsg = error.status === 429
      ? 'Demasiadas consultas. Espera un momento.'
      : error.status === 401
      ? 'Error de configuración del servicio de IA.'
      : 'Error al procesar tu consulta. Intenta de nuevo.';

    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

// ============ ENDPOINT: FEEDBACK ============

async function enviarFeedback(req, res) {
  try {
    const { mensajeUsuario, respuestaIA, feedback, comentario } = req.body;
    const usuarioId = req.usuario._id;

    if (!mensajeUsuario || !respuestaIA || !['positivo', 'negativo'].includes(feedback)) {
      return res.status(400).json({ error: 'Datos de feedback inválidos' });
    }

    const feedbackDoc = await ChatFeedback.create({
      usuario: usuarioId,
      mensajeUsuario: mensajeUsuario.substring(0, 2000),
      respuestaIA: respuestaIA.substring(0, 10000),
      feedback,
      comentario: comentario?.substring(0, 500),
      modelo: modeloIA,
    });

    console.log(`📊 Feedback ${feedback}: usuario=${usuarioId} id=${feedbackDoc._id}`);

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error guardando feedback:', error.message);
    res.status(500).json({ error: 'Error al guardar feedback' });
  }
}

// ============ EXPORTS ============

module.exports = {
  chat,
  chatStream,
  enviarFeedback,
  estaIADisponible,
  // Exportar para testing
  obtenerContextoUsuario,
  truncarContexto,
  construirPromptContexto,
  generarRespuestaOffline,
  contarTokens,
};