import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Bot, User, Sparkles, Copy, Check, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { chatStreamAPI, chatAPI, chatFeedbackAPI } from '../../services/api';
import './ChatBot.css';

// ============ CONSTANTES ============

const STORAGE_KEY = 'chatbot_mensajes_v1';
const MAX_MENSAJES_STORAGE = 50;

const PREGUNTAS_SUGERIDAS = [
  '¿Qué gastos son deducibles en REA?',
  '¿Cuánto IVA debo pagar este cuatrimestre?',
  '¿Cómo clasifico una factura de medicinas?',
  '¿Mi balance actual es positivo o negativo?',
  '¿Qué debo preparar para la declaración de renta?',
];

const MENSAJE_BIENVENIDA = {
  rol: 'bot',
  contenido: '¡Hola! Soy tu asistente contable ganadero. Tengo acceso a tus facturas, ingresos, inventario y costos. ¿En qué te ayudo hoy?',
  timestamp: Date.now(),
};

// ============ HELPERS ============

/** Sanitiza contenido Markdown para renderizar de forma segura */
function sanitizarMarkdown(texto) {
  if (!texto) return '';
  return DOMPurify.sanitize(texto, {
    ALLOWED_TAGS: [],   // react-markdown renderiza, no necesitamos HTML
    ALLOWED_ATTR: [],
  });
}

/** Cargar mensajes desde localStorage */
function cargarMensajesGuardados() {
  try {
    const guardados = localStorage.getItem(STORAGE_KEY);
    if (!guardados) return [MENSAJE_BIENVENIDA];
    const parsed = JSON.parse(guardados);
    if (!Array.isArray(parsed) || parsed.length === 0) return [MENSAJE_BIENVENIDA];
    return parsed;
  } catch {
    return [MENSAJE_BIENVENIDA];
  }
}

/** Guardar mensajes en localStorage (máximo MAX_MENSAJES_STORAGE) */
function guardarMensajes(mensajes) {
  try {
    const paraGuardar = mensajes
      .filter(m => !m.cargando) // No guardar mensajes de carga
      .slice(-MAX_MENSAJES_STORAGE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paraGuardar));
  } catch {
    // localStorage lleno, limpiar
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }
}

// ============ COMPONENTE PRINCIPAL ============

export default function ChatBot() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState(() => cargarMensajesGuardados());
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(null); // Índice del mensaje copiado
  const [feedbackEnviado, setFeedbackEnviado] = useState({}); // { [idx]: 'positivo'|'negativo' }
  const mensajesEndRef = useRef(null);
  const chatMensajesRef = useRef(null);
  const inputRef = useRef(null);
  const streamingRef = useRef(false); // Controlar streaming activo

  // Scroll to bottom cuando hay nuevos mensajes
  useEffect(() => {
    if (chatMensajesRef.current) {
      chatMensajesRef.current.scrollTop = chatMensajesRef.current.scrollHeight;
    }
  }, [mensajes]);

  // Focus al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [abierto]);

  // Guardar mensajes cuando cambian (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      guardarMensajes(mensajes);
    }, 300);
    return () => clearTimeout(timeout);
  }, [mensajes]);

  // Construir historial para la API
  const construirHistorial = useCallback(() => {
    return mensajes
      .filter(m => !m.cargando && m.contenido)
      .map(m => ({
        rol: m.rol === 'bot' ? 'assistant' : 'user',
        contenido: m.contenido,
      }))
      .slice(-10);
  }, [mensajes]);

  // ============ ENVIAR MENSAJE ============

  async function enviarMensaje(e) {
    e?.preventDefault();
    if (!input.trim() || cargando) return;

    const mensajeUsuario = input.trim();
    setInput('');
    setCargando(true);
    streamingRef.current = true;

    // Agregar mensaje del usuario + placeholder de respuesta
    setMensajes(prev => [
      ...prev,
      { rol: 'user', contenido: mensajeUsuario, timestamp: Date.now() },
      { rol: 'bot', contenido: '', cargando: true, streaming: true, timestamp: Date.now() },
    ]);

    const historial = construirHistorial();

    // Intentar streaming primero, fallback a chat normal
    try {
      let respuestaAcumulada = '';

      await chatStreamAPI(
        mensajeUsuario,
        historial,
        // onChunk: agregar token a la respuesta
        (chunk) => {
          respuestaAcumulada += chunk;
          setMensajes(prev => {
            const nuevos = [...prev];
            const ultimo = nuevos[nuevos.length - 1];
            if (ultimo?.rol === 'bot') {
              nuevos[nuevos.length - 1] = {
                ...ultimo,
                contenido: respuestaAcumulada,
                cargando: false,
                streaming: true,
              };
            }
            return nuevos;
          });
        },
        // onDone: marcar como completado
        () => {
          streamingRef.current = false;
          setMensajes(prev => {
            const nuevos = [...prev];
            const ultimo = nuevos[nuevos.length - 1];
            if (ultimo?.rol === 'bot') {
              nuevos[nuevos.length - 1] = {
                ...ultimo,
                streaming: false,
                cargando: false,
                contenido: respuestaAcumulada || 'No se pudo generar respuesta.',
              };
            }
            return nuevos;
          });
          setCargando(false);
        },
        // onError: fallback a chat normal
        async (errorMsg) => {
          console.warn('Stream falló, usando fallback:', errorMsg);
          try {
            const res = await chatAPI(mensajeUsuario, historial);
            const respuesta = res.data.respuesta;
            setMensajes(prev => [
              ...prev.slice(0, -1),
              { rol: 'bot', contenido: respuesta, timestamp: Date.now(), offline: res.data.offline },
            ]);
          } catch (err) {
            console.error('Fallback también falló:', err);
            setMensajes(prev => [
              ...prev.slice(0, -1),
              { rol: 'bot', contenido: 'Error al conectar con la IA. Verifica tu conexión e intenta de nuevo.', timestamp: Date.now(), error: true },
            ]);
          }
          streamingRef.current = false;
          setCargando(false);
        }
      );
    } catch (err) {
      // Error catastrófico
      console.error('Error en enviarMensaje:', err);
      streamingRef.current = false;
      setMensajes(prev => [
        ...prev.slice(0, -1),
        { rol: 'bot', contenido: 'Error inesperado. Intenta de nuevo.', timestamp: Date.now(), error: true },
      ]);
      setCargando(false);
    }
  }

  // ============ ACCIONES DE MENSAJE ============

  function usarSugerida(texto) {
    setInput(texto);
    inputRef.current?.focus();
  }

  async function copiarMensaje(idx, contenido) {
    try {
      await navigator.clipboard.writeText(contenido);
      setCopiado(idx);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Fallback para navegadores sin clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = contenido;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(idx);
      setTimeout(() => setCopiado(null), 2000);
    }
  }

  async function enviarFeedback(idx, tipo) {
    const mensaje = mensajes[idx];
    const mensajeAnterior = mensajes[idx - 1];

    if (!mensaje || !mensajeAnterior) return;

    setFeedbackEnviado(prev => ({ ...prev, [idx]: tipo }));

    try {
      await chatFeedbackAPI({
        mensajeUsuario: mensajeAnterior.contenido,
        respuestaIA: mensaje.contenido,
        feedback: tipo,
      });
    } catch (err) {
      console.error('Error enviando feedback:', err);
      // No revertir el estado visual, el feedback se guardará eventualmente
    }
  }

  function limpiarHistorial() {
    setMensajes([MENSAJE_BIENVENIDA]);
    setFeedbackEnviado({});
    localStorage.removeItem(STORAGE_KEY);
  }

  function toggleChat() {
    setAbierto(!abierto);
  }

  // ============ RENDER ============

  return (
    <>
      <button
        className={`chat-toggle ${abierto ? 'abierto' : ''}`}
        onClick={toggleChat}
        aria-label={abierto ? 'Cerrar chat' : 'Abrir asistente IA'}
        id="chat-toggle-btn"
      >
        <Sparkles size={24} />
        {!abierto && <span className="chat-label">Asistente IA</span>}
        {abierto && <X size={24} />}
      </button>

      {abierto && (
        <div
          className="chat-ventana"
          role="dialog"
          aria-label="Chat con asistente IA"
          aria-modal="false"
          id="chat-window"
        >
          <div className="chat-header">
            <div className="chat-header-info">
              <Bot size={20} className="bot-icon" />
              <span>Asistente Contable Ganadero</span>
            </div>
            <div className="chat-header-actions">
              <button
                className="chat-header-btn"
                onClick={limpiarHistorial}
                aria-label="Limpiar historial"
                title="Limpiar historial"
                id="chat-clear-btn"
              >
                <Trash2 size={16} />
              </button>
              <button
                className="chat-close"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                id="chat-close-btn"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div
            className="chat-mensajes"
            ref={chatMensajesRef}
            role="log"
            aria-live="polite"
            aria-label="Historial de mensajes"
            id="chat-messages"
          >
            {mensajes.map((msg, idx) => (
              <div
                key={`${idx}-${msg.timestamp || idx}`}
                className={`msg ${msg.rol} ${msg.error ? 'error' : ''} ${msg.offline ? 'offline' : ''}`}
                id={`msg-${idx}`}
              >
                <div className="msg-avatar" aria-hidden="true">
                  {msg.rol === 'bot' ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className="msg-content">
                  <div className="msg-burbuja">
                    {msg.cargando && !msg.contenido ? (
                      <div className="msg-typing" role="status" aria-label="El asistente está pensando">
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    ) : (
                      <div className={`msg-texto ${msg.streaming ? 'streaming' : ''}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // Abrir links en nueva pestaña
                            a: ({ children, ...props }) => (
                              <a {...props} target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {sanitizarMarkdown(msg.contenido)}
                        </ReactMarkdown>
                        {msg.streaming && <span className="cursor-blink" aria-hidden="true">▊</span>}
                      </div>
                    )}
                  </div>

                  {/* Acciones de mensaje (solo para respuestas del bot completadas) */}
                  {msg.rol === 'bot' && !msg.cargando && !msg.streaming && msg.contenido && (
                    <div className="msg-acciones" aria-label="Acciones del mensaje">
                      <button
                        className={`msg-accion-btn ${copiado === idx ? 'copiado' : ''}`}
                        onClick={() => copiarMensaje(idx, msg.contenido)}
                        aria-label={copiado === idx ? 'Copiado' : 'Copiar mensaje'}
                        title={copiado === idx ? '¡Copiado!' : 'Copiar'}
                      >
                        {copiado === idx ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        className={`msg-accion-btn ${feedbackEnviado[idx] === 'positivo' ? 'activo positivo' : ''}`}
                        onClick={() => enviarFeedback(idx, 'positivo')}
                        disabled={!!feedbackEnviado[idx]}
                        aria-label="Respuesta útil"
                        title="Útil"
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button
                        className={`msg-accion-btn ${feedbackEnviado[idx] === 'negativo' ? 'activo negativo' : ''}`}
                        onClick={() => enviarFeedback(idx, 'negativo')}
                        disabled={!!feedbackEnviado[idx]}
                        aria-label="Respuesta no útil"
                        title="No útil"
                      >
                        <ThumbsDown size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={mensajesEndRef} />
          </div>

          {mensajes.length <= 1 && (
            <div className="chat-sugerencias" id="chat-suggestions">
              <span className="sugerencias-label">Preguntas frecuentes:</span>
              <div className="sugerencias-lista">
                {PREGUNTAS_SUGERIDAS.map((p, i) => (
                  <button
                    key={i}
                    className="btn-sugerencia"
                    onClick={() => usarSugerida(p)}
                    disabled={cargando}
                    id={`suggestion-${i}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={enviarMensaje} className="chat-input-area" id="chat-input-form">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribe tu pregunta contable..."
              disabled={cargando}
              className="chat-input"
              aria-label="Tu mensaje"
              id="chat-input"
              maxLength={2000}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn-enviar"
              disabled={!input.trim() || cargando}
              aria-label="Enviar"
              id="chat-send-btn"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}