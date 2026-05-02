/**
 * Configuración del cliente OpenRouter (compatible con SDK de OpenAI)
 */

const configurarOpenRouter = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelo = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  if (!apiKey) {
    console.warn('⚠️  OPENROUTER_API_KEY no configurada. El servicio de IA no funcionará.');
  }

  return {
    apiKey,
    modelo,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': 'https://contador-ganadero.vercel.app',
      'X-Title': 'ContadorGanadero',
    },
  };
};

module.exports = { configurarOpenRouter };
