const mockGemini = jest.fn();
const mockStreamGemini = jest.fn();
const mockNvidia = jest.fn();
jest.mock('@google/genai',()=>({GoogleGenAI:jest.fn().mockImplementation(()=>({models:{generateContent:mockGemini,generateContentStream:mockStreamGemini}})),Type:{OBJECT:'object',STRING:'string',BOOLEAN:'boolean',NUMBER:'number'}}));
jest.mock('openai',()=>jest.fn().mockImplementation(()=>({chat:{completions:{create:mockNvidia}}})));
const ai=require('../services/aiProvider');
beforeEach(()=>{process.env.GEMINI_API_KEY='synthetic';process.env.AI_API_KEY='synthetic';mockGemini.mockReset();mockNvidia.mockReset();mockStreamGemini.mockReset();});
test('S-03: fallo de peticion Gemini usa NVIDIA para clasificacion y chat',async()=>{
  mockGemini.mockRejectedValue(new Error('fallo sintetico'));
  mockNvidia.mockResolvedValue({choices:[{message:{content:JSON.stringify({categoria:'veterinaria',confianza:0.9})}}]});
  expect((await ai.categorizarFacturaDual({lineaDetalle:[]},'test')).categoriaIA).toBe('veterinaria');
  mockNvidia.mockResolvedValue({choices:[{message:{content:'respuesta secundaria'}}]});
  expect((await ai.generarChatDual({systemPrompt:'test',messages:[]})).contenido).toBe('respuesta secundaria');
  expect(mockNvidia).toHaveBeenCalledTimes(2);
});
test('S-03: streaming falla en Gemini y continua en NVIDIA',async()=>{
  mockStreamGemini.mockRejectedValue(new Error('fallo sintetico'));
  mockNvidia.mockImplementation(async()=> (async function*(){yield {choices:[{delta:{content:'secundario'}}]};})());
  const onChunk=jest.fn(),onDone=jest.fn(),onError=jest.fn();
  await ai.streamChatDual({systemPrompt:'test',messages:[],onChunk,onDone,onError});
  expect(onChunk).toHaveBeenCalledWith('secundario');expect(onDone).toHaveBeenCalled();expect(onError).not.toHaveBeenCalled();
});
test('F-34: sin keys conserva clasificacion heuristica y activa resumen offline',async()=>{
  process.env.GEMINI_API_KEY='';process.env.AI_API_KEY='';process.env.NVIDIA_API_KEY='';
  const cat=await ai.categorizarFacturaDual({lineaDetalle:[{descripcion:'concentrado para ganado'}]},'test');
  expect(cat.categoriaIA).toBeTruthy();expect(ai.obtenerEstadoIA().disponible).toBe(false);
  expect(require('../controllers/chatController').estaIADisponible()).toBe(false);
});
