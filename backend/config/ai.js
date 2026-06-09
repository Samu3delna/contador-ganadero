/**
 * Configuración centralizada del cliente OpenRouter (compatible con SDK de OpenAI)
 * Incluye defaults para temperature, max_tokens, timeout, y retries.
 */

const configurarOpenRouter = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelo = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const frontendUrl = process.env.FRONTEND_URL || 'https://contador-ganadero.vercel.app';

  if (!apiKey) {
    console.warn('⚠️  OPENROUTER_API_KEY no configurada. El servicio de IA no funcionará.');
  }

  return {
    apiKey,
    modelo,
    baseURL: 'https://openrouter.ai/api/v1',
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

module.exports = { configurarOpenRouter };
