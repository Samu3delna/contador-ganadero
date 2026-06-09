const OpenAI = require('openai');
const { configurarOpenRouter } = require('../config/ai');
const Factura = require('../models/Factura');
const Ingreso = require('../models/Ingreso');
const Inventario = require('../models/Inventario');
const CostoProduccion = require('../models/CostoProduccion');

let clienteIA = null;
let modeloIA = null;

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
  console.log(`🤖 Chat IA inicializado (modelo: ${modeloIA})`);
}

const SYSTEM_PROMPT_CHAT = `Eres un asistente contable experto en el sector ganadero de Costa Rica, especializado en el Régimen Especial Agropecuario (REA).

CONTEXTO DEL USUARIO:
- Pequeño ganadero bajo REA
- Insumos agropecuarios para canasta básica: 1% IVA
- IVA general: 13%
- Medicamentos veterinarios: 2% IVA
- Debe llevar contabilidad simplificada pero ordenada

TU ROL:
- Responder preguntas contables, fiscales y de gestión ganadera
- Explicar conceptos de forma clara y práctica
- Dar orientación sobre deducibilidad, IVA, declaraciones
- NO dar asesoría legal vinculante (siempre aclarar que es orientación)

RESPONDE EN ESPAÑOL, de forma concisa y práctica. Usa formato markdown si ayuda.`;

async function obtenerContextoUsuario(usuarioId) {
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

  const bovinos = inventario?.bovinos?.length || 0;
  const aves = inventario?.aves?.reduce((sum, l) => sum + (l.cantidad || 0), 0) || 0;
  const peces = inventario?.peces?.reduce((sum, e) => sum + (e.cantidad || 0), 0) || 0;
  const colmenas = inventario?.colmenas?.length || 0;

  return {
    resumen: {
      totalFacturas: facturas.length,
      totalGastos,
      totalIngresos,
      balance: totalIngresos - totalGastos,
      gastosPorCategoria,
    },
    inventario: { bovinos, aves, peces, colmenas },
    ultimasFacturas: facturas.slice(0, 5).map(f => ({
      fecha: f.fechaEmision,
      emisor: f.emisor?.nombre,
      total: f.resumenFactura?.totalComprobante,
      categoria: f.categoriaIA,
    })),
    ultimosIngresos: ingresos.slice(0, 3).map(i => ({
      fecha: i.fecha,
      concepto: i.concepto,
      monto: i.monto,
    })),
    centrosCostoActivos: costos.filter(c => c.estado === 'abierto').length,
  };
}

function construirPromptContexto(contexto) {
  return `DATOS ACTUALES DEL USUARIO:
- Facturas registradas: ${contexto.resumen.totalFacturas}
- Total gastos: ₡${contexto.resumen.totalGastos.toLocaleString()}
- Total ingresos: ₡${contexto.resumen.totalIngresos.toLocaleString()}
- Balance: ₡${contexto.resumen.balance.toLocaleString()}
- Inventario: ${contexto.inventario.bovinos} bovinos, ${contexto.inventario.aves} aves, ${contexto.inventario.peces} peces, ${contexto.inventario.colmenas} colmenas
- Centros de costo abiertos: ${contexto.centrosCostoActivos}

GASTOS POR CATEGORÍA:
${Object.entries(contexto.resumen.gastosPorCategoria).map(([cat, val]) => `  - ${cat}: ₡${val.toLocaleString()}`).join('\n') || '  (sin datos)'}

ÚLTIMAS FACTURAS:
${contexto.ultimasFacturas.map(f => `  - ${f.fecha}: ${f.emisor} - ₡${f.total} (${f.categoria})`).join('\n') || '  (ninguna)'}

ÚLTIMOS INGRESOS:
${contexto.ultimosIngresos.map(i => `  - ${i.fecha}: ${i.concepto} - ₡${i.monto}`).join('\n') || '  (ninguno)'}`;
}

async function chat(req, res) {
  try {
    const { mensaje, historial = [] } = req.body;
    const usuarioId = req.usuario._id;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }

    inicializarCliente();

    if (!clienteIA) {
      return res.status(503).json({ 
        error: 'Servicio de IA no disponible',
        respuesta: 'El servicio de IA no está configurado. Contacta al administrador.',
      });
    }

    const contexto = await obtenerContextoUsuario(usuarioId);
    const promptContexto = construirPromptContexto(contexto);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT_CHAT },
      { role: 'system', content: promptContexto },
      ...historial.slice(-6).map(h => ({ role: h.rol, content: h.contenido })),
      { role: 'user', content: mensaje.trim() },
    ];

    const respuesta = await clienteIA.chat.completions.create({
      model: modeloIA,
      messages,
      temperature: 0.4,
      max_tokens: 800,
    });

    const contenido = respuesta.choices[0]?.message?.content || 'No se pudo generar respuesta.';

    res.json({ respuesta: contenido });
  } catch (error) {
    console.error('❌ Error en chat:', error.message);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      respuesta: 'Ocurrió un error al procesar tu consulta. Intenta de nuevo.',
    });
  }
}

module.exports = { chat };