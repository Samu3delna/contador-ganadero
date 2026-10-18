/**
 * Configuración centralizada del cliente de IA (Dual: Google Gemini + NVIDIA NIM)
 * Soporta Google Gemini (@google/genai) como proveedor nativo de primera clase,
 * y NVIDIA NIM / OpenAI como alternativa configurable.
 */

const configurarIA = () => {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const nvidiaApiKey = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY;
  const frontendUrl = process.env.FRONTEND_URL || 'https://contador-ganadero.vercel.app';

  // Determinar proveedor activo
  let proveedor = 'none';
  if (geminiApiKey) {
    proveedor = 'gemini';
  } else if (nvidiaApiKey) {
    proveedor = 'nvidia';
  }

  return {
    proveedor,
    gemini: {
      apiKey: geminiApiKey,
      modelo: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
    nvidia: {
      apiKey: nvidiaApiKey,
      modelo: process.env.AI_MODEL || process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b',
      baseURL: process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      headers: {
        'HTTP-Referer': frontendUrl,
        'X-Title': 'Contador Ganadero - Asistente Contable Ganadero CR',
      },
    },
    // Parámetros por defecto para generación
    defaults: {
      temperature: 0.2,
      max_tokens: 1500,
      timeout: 45000,
      maxRetries: 3,
    },
  };
};

// Alias por compatibilidad
const configurarOpenRouter = configurarIA;

module.exports = { configurarIA, configurarOpenRouter };
