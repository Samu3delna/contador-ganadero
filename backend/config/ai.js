/**
 * Configuración centralizada del cliente de IA (NVIDIA NIM API)
 * Usa la API de NVIDIA (compatible con el SDK de OpenAI).
 * Incluye defaults para temperature, max_tokens, timeout, y retries.
 */

const configurarIA = () => {
  const apiKey = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY;
  const modelo = process.env.AI_MODEL || process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b';
  const frontendUrl = process.env.FRONTEND_URL || 'https://contador-ganadero.vercel.app';

  if (!apiKey) {
    console.warn('⚠️  AI_API_KEY no configurada. El servicio de IA no funcionará.');
  }

  return {
    apiKey,
    modelo,
    baseURL: process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    headers: {
      'HTTP-Referer': frontendUrl,
      'X-Title': 'Contador Ganadero - Asistente Contable Ganadero CR',
    },
    // Defaults para llamadas al modelo
    defaults: {
      temperature: 0.2,       // Bajo para respuestas factuales
      max_tokens: 1500,        // Espacio suficiente para respuestas completas con formato
      timeout: 60000,          // 60s para consultas complejas
      maxRetries: 3,           // Reintentos con backoff exponencial
    },
  };
};

// Alias por compatibilidad con código existente
const configurarOpenRouter = configurarIA;

module.exports = { configurarIA, configurarOpenRouter };
