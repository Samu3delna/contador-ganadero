/**
 * Configuración del cliente OpenRouter (compatible con SDK de OpenAI)
 */

const configurarOpenRouter = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelo = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
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
      'X-Title': 'ContadorGanadero',
    },
  };
};

module.exports = { configurarOpenRouter };
