import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { chatAPI } from '../../services/api';
import './ChatBot.css';

const PREGUNTAS_SUGERIDAS = [
  '¿Qué gastos son deducibles en REA?',
  '¿Cuánto IVA debo pagar este cuatrimestre?',
  '¿Cómo clasifico una factura de medicinas?',
  '¿Mi balance actual es positivo o negativo?',
  '¿Qué debo preparar para la declaración de renta?',
];

// Formateador simple de Markdown a HTML seguro
function parsearMarkdown(texto) {
  if (!texto) return '';

  // 1. Escapar caracteres HTML básicos para evitar XSS
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Bloques de código (```código```)
  html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
    return `<pre><code>${p1.trim()}</code></pre>`;
  });

  // 3. Código en línea (`código`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 4. Encabezados (###, ##, #)
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // 5. Negrita (**texto**)
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');

  // 6. Listas ordenadas y desordenadas
  const lineas = html.split('\n');
  let enListaDesordenada = false;
  let enListaOrdenada = false;
  let resultadoLineas = [];

  for (let i = 0; i < lineas.length; i++) {
    let linea = lineas[i];
    
    // Lista desordenada
    const matchDesordenada = linea.match(/^[\s]*[-*]\s+(.+)$/);
    if (matchDesordenada) {
      if (enListaOrdenada) {
        resultadoLineas.push('</ol>');
        enListaOrdenada = false;
      }
      if (!enListaDesordenada) {
        resultadoLineas.push('<ul>');
        enListaDesordenada = true;
      }
      resultadoLineas.push(`<li>${matchDesordenada[1]}</li>`);
      continue;
    }

    // Lista ordenada
    const matchOrdenada = linea.match(/^[\s]*\d+\.\s+(.+)$/);
    if (matchOrdenada) {
      if (enListaDesordenada) {
        resultadoLineas.push('</ul>');
        enListaDesordenada = false;
      }
      if (!enListaOrdenada) {
        resultadoLineas.push('<ol>');
        enListaOrdenada = true;
      }
      resultadoLineas.push(`<li>${matchOrdenada[1]}</li>`);
      continue;
    }

    // Si no es parte de una lista, cerramos cualquier lista abierta
    if (enListaDesordenada) {
      resultadoLineas.push('</ul>');
      enListaDesordenada = false;
    }
    if (enListaOrdenada) {
      resultadoLineas.push('</ol>');
      enListaOrdenada = false;
    }

    resultadoLineas.push(linea);
  }

  if (enListaDesordenada) resultadoLineas.push('</ul>');
  if (enListaOrdenada) resultadoLineas.push('</ol>');

  html = resultadoLineas.join('\n');

  // 7. Párrafos
  const bloques = html.split('\n\n');
  const procesados = bloques.map(bloque => {
    const b = bloque.trim();
    if (!b) return '';
    if (b.startsWith('<h') || b.startsWith('<pre') || b.startsWith('<ul') || b.startsWith('<ol') || b.startsWith('<li>') || b.startsWith('</')) {
      return b;
    }
    return `<p>${b.replace(/\n/g, '<br>')}</p>`;
  });

  return procesados.join('');
}

export default function ChatBot() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([
    { rol: 'bot', contenido: '¡Hola! Soy tu asistente contable ganadero. Tengo acceso a tus facturas, ingresos, inventario y costos. ¿En qué te ayudo hoy?' },
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [historial, setHistorial] = useState([]);
  const mensajesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [abierto]);

  async function enviarMensaje(e) {
    e?.preventDefault();
    if (!input.trim() || cargando) return;

    const mensajeUsuario = input.trim();
    setInput('');
    setCargando(true);

    const nuevosMensajes = [
      ...mensajes,
      { rol: 'user', contenido: mensajeUsuario },
      { rol: 'bot', contenido: '', cargando: true },
    ];
    setMensajes(nuevosMensajes);

    try {
      const res = await chatAPI(mensajeUsuario, historial);
      const respuesta = res.data.respuesta;

      setMensajes(prev => [
        ...prev.slice(0, -1),
        { rol: 'bot', contenido: respuesta },
      ]);

      setHistorial(prev => [
        ...prev,
        { rol: 'user', contenido: mensajeUsuario },
        { rol: 'assistant', contenido: respuesta },
      ].slice(-10));
    } catch (err) {
      console.error(err);
      setMensajes(prev => [
        ...prev.slice(0, -1),
        { rol: 'bot', contenido: 'Error al conectar con la IA. Verifica tu conexión e intenta de nuevo.' },
      ]);
    } finally {
      setCargando(false);
    }
  }

  function usarSugerida(texto) {
    setInput(texto);
    inputRef.current?.focus();
  }

  function toggleChat() {
    setAbierto(!abierto);
  }

  return (
    <>
      <button
        className={`chat-toggle ${abierto ? 'abierto' : ''}`}
        onClick={toggleChat}
        aria-label={abierto ? 'Cerrar chat' : 'Abrir asistente IA'}
      >
        <Sparkles size={24} />
        {!abierto && <span className="chat-label">Asistente IA</span>}
        {abierto && <X size={24} />}
      </button>

      {abierto && (
        <div className="chat-ventana" role="dialog" aria-label="Chat con asistente IA">
          <div className="chat-header">
            <div className="chat-header-info">
              <Bot size={20} className="bot-icon" />
              <span>Asistente Contable Ganadero</span>
            </div>
            <button className="chat-close" onClick={() => setAbierto(false)} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>

          <div className="chat-mensajes" ref={mensajesEndRef}>
            {mensajes.map((msg, idx) => (
              <div key={idx} className={`msg ${msg.rol}`}>
                <div className="msg-avatar">
                  {msg.rol === 'bot' ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className="msg-burbuja">
                  {msg.cargando ? (
                    <div className="msg-typing">
                      <Loader2 size={16} className="spin" />
                      <span>Pensando...</span>
                    </div>
                  ) : (
                    <div className="msg-texto" dangerouslySetInnerHTML={{ __html: parsearMarkdown(msg.contenido) }} />
                  )}
                </div>
              </div>
            ))}
            <div ref={mensajesEndRef} />
          </div>

          {mensajes.length <= 1 && (
            <div className="chat-sugerencias">
              <span className="sugerencias-label">Preguntas frecuentes:</span>
              <div className="sugerencias-lista">
                {PREGUNTAS_SUGERIDAS.map((p, i) => (
                  <button
                    key={i}
                    className="btn-sugerencia"
                    onClick={() => usarSugerida(p)}
                    disabled={cargando}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={enviarMensaje} className="chat-input-area">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribe tu pregunta contable..."
              disabled={cargando}
              className="chat-input"
              aria-label="Tu mensaje"
            />
            <button
              type="submit"
              className="btn-enviar"
              disabled={!input.trim() || cargando}
              aria-label="Enviar"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}