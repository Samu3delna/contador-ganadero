import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Bot, User, Sparkles, Copy, Check, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { chatStreamAPI, chatAPI, chatFeedbackAPI } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
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
  contenido: '¡Hola! Soy tu asistente contable ganadero con IA. Tengo acceso a tus facturas, ingresos, inventario y costos. ¿En qué te puedo asesorar hoy?',
  timestamp: Date.now(),
};

// ============ HELPERS ============

function sanitizarMarkdown(texto) {
  if (!texto) return '';
  return DOMPurify.sanitize(texto, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

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

function guardarMensajes(mensajes) {
  try {
    const paraGuardar = mensajes
      .filter(m => !m.cargando)
      .slice(-MAX_MENSAJES_STORAGE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paraGuardar));
  } catch {
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
  const [copiado, setCopiado] = useState(null);
  const [feedbackEnviado, setFeedbackEnviado] = useState({});
  const mensajesEndRef = useRef(null);
  const chatMensajesRef = useRef(null);
  const inputRef = useRef(null);
  const streamingRef = useRef(false);

  useEffect(() => {
    if (chatMensajesRef.current) {
      chatMensajesRef.current.scrollTop = chatMensajesRef.current.scrollHeight;
    }
  }, [mensajes]);

  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [abierto]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      guardarMensajes(mensajes);
    }, 300);
    return () => clearTimeout(timeout);
  }, [mensajes]);

  const construirHistorial = useCallback(() => {
    return mensajes
      .filter(m => !m.cargando && m.contenido)
      .map(m => ({
        rol: m.rol === 'bot' ? 'assistant' : 'user',
        contenido: m.contenido,
      }))
      .slice(-10);
  }, [mensajes]);

  async function enviarMensaje(e) {
    e?.preventDefault();
    if (!input.trim() || cargando) return;

    const mensajeUsuario = input.trim();
    setInput('');
    setCargando(true);
    streamingRef.current = true;

    setMensajes(prev => [
      ...prev,
      { rol: 'user', contenido: mensajeUsuario, timestamp: Date.now() },
      { rol: 'bot', contenido: '', cargando: true, streaming: true, timestamp: Date.now() },
    ]);

    const historial = construirHistorial();

    try {
      let respuestaAcumulada = '';

      await chatStreamAPI(
        mensajeUsuario,
        historial,
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
            console.error('Fallback falló:', err);
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
      console.error('Error en enviarMensaje:', err);
      streamingRef.current = false;
      setMensajes(prev => [
        ...prev.slice(0, -1),
        { rol: 'bot', contenido: 'Error inesperado. Intenta de nuevo.', timestamp: Date.now(), error: true },
      ]);
      setCargando(false);
    }
  }

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

  return (
    <>
      <Button
        variant="gradient"
        size="lg"
        className={`chat-toggle fixed bottom-6 right-6 z-50 rounded-full shadow-2xl h-14 px-5 gap-2.5 font-semibold transition-transform hover:scale-105 ${abierto ? 'abierto ring-4 ring-emerald-500/30' : ''}`}
        onClick={toggleChat}
        aria-label={abierto ? 'Cerrar chat' : 'Abrir asistente IA'}
        id="chat-toggle-btn"
      >
        <Sparkles size={20} className="text-amber-300 animate-pulse" />
        {!abierto ? <span>Asistente IA</span> : <X size={20} />}
      </Button>

      {abierto && (
        <Card
          className="chat-ventana fixed bottom-24 right-6 z-50 w-[92vw] max-w-[420px] h-[580px] max-h-[82vh] flex flex-col rounded-2xl border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          role="dialog"
          aria-label="Chat con asistente IA"
          aria-modal="false"
          id="chat-window"
        >
          {/* Header */}
          <div className="chat-header flex items-center justify-between px-4 py-3.5 border-b border-slate-800/80 bg-slate-950/60">
            <div className="chat-header-info flex items-center gap-2.5">
              <Avatar className="h-8 w-8 border-emerald-500/40">
                <AvatarFallback className="bg-emerald-950 text-emerald-400">
                  <Bot size={18} />
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="font-semibold font-heading text-sm text-white leading-tight block">Asistente IA</span>
                <Badge variant="default" className="text-[9px] px-1.5 py-0 h-3.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-medium">
                  Régimen REA
                </Badge>
              </div>
            </div>
            <div className="chat-header-actions flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={limpiarHistorial}
                aria-label="Limpiar historial"
                title="Limpiar historial"
                id="chat-clear-btn"
              >
                <Trash2 size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                id="chat-close-btn"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          {/* Mensajes */}
          <div
            className="chat-mensajes flex-1 overflow-y-auto p-4 space-y-4"
            ref={chatMensajesRef}
            role="log"
            aria-live="polite"
            aria-label="Historial de mensajes"
            id="chat-messages"
          >
            {mensajes.map((msg, idx) => (
              <div
                key={`${idx}-${msg.timestamp || idx}`}
                className={`msg flex gap-2.5 ${msg.rol === 'user' ? 'justify-end' : 'justify-start'} ${msg.error ? 'error' : ''} ${msg.offline ? 'offline' : ''}`}
                id={`msg-${idx}`}
              >
                {msg.rol === 'bot' && (
                  <Avatar className="h-7 w-7 mt-0.5 border-emerald-500/30 shrink-0">
                    <AvatarFallback className="bg-emerald-950 text-emerald-400">
                      <Bot size={14} />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className={`msg-content max-w-[85%] space-y-1 ${msg.rol === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.rol === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950/40'
                        : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-md'
                    }`}
                  >
                    {msg.cargando && !msg.contenido ? (
                      <div className="msg-typing flex items-center gap-1.5 py-1" role="status" aria-label="El asistente está pensando">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <div className={`msg-texto ${msg.streaming ? 'streaming' : ''}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ children, ...props }) => (
                              <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline underline-offset-2">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {sanitizarMarkdown(msg.contenido)}
                        </ReactMarkdown>
                        {msg.streaming && <span className="cursor-blink inline-block text-emerald-400 ml-0.5 font-bold" aria-hidden="true">▊</span>}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {msg.rol === 'bot' && !msg.cargando && !msg.streaming && msg.contenido && (
                    <div className="flex items-center gap-1 px-1 pt-0.5 text-slate-400">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-white"
                        onClick={() => copiarMensaje(idx, msg.contenido)}
                        aria-label={copiado === idx ? 'Copiado' : 'Copiar mensaje'}
                        title={copiado === idx ? '¡Copiado!' : 'Copiar'}
                      >
                        {copiado === idx ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 text-slate-400 hover:text-emerald-400 ${feedbackEnviado[idx] === 'positivo' ? 'text-emerald-400 bg-emerald-950/40' : ''}`}
                        onClick={() => enviarFeedback(idx, 'positivo')}
                        disabled={!!feedbackEnviado[idx]}
                        aria-label="Respuesta útil"
                        title="Útil"
                      >
                        <ThumbsUp size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 text-slate-400 hover:text-red-400 ${feedbackEnviado[idx] === 'negativo' ? 'text-red-400 bg-red-950/40' : ''}`}
                        onClick={() => enviarFeedback(idx, 'negativo')}
                        disabled={!!feedbackEnviado[idx]}
                        aria-label="Respuesta no útil"
                        title="No útil"
                      >
                        <ThumbsDown size={12} />
                      </Button>
                    </div>
                  )}
                </div>

                {msg.rol === 'user' && (
                  <Avatar className="h-7 w-7 mt-0.5 border-slate-700 shrink-0">
                    <AvatarFallback className="bg-slate-800 text-slate-300">
                      <User size={14} />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={mensajesEndRef} />
          </div>

          {/* Sugerencias */}
          {mensajes.length <= 1 && (
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/40" id="chat-suggestions">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Preguntas frecuentes:</span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {PREGUNTAS_SUGERIDAS.map((p, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 py-1 px-2.5 rounded-full bg-slate-800/70 hover:bg-slate-700 text-slate-300 border-slate-700 font-normal"
                    onClick={() => usarSugerida(p)}
                    disabled={cargando}
                    id={`suggestion-${i}`}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input form */}
          <form onSubmit={enviarMensaje} className="p-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center gap-2" id="chat-input-form">
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribe tu consulta tributaria o de finca..."
              disabled={cargando}
              className="flex-1 h-10 text-sm bg-slate-900 border-slate-700"
              aria-label="Tu mensaje"
              id="chat-input"
              maxLength={2000}
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="gradient"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-lg shadow-md"
              disabled={!input.trim() || cargando}
              aria-label="Enviar"
              id="chat-send-btn"
            >
              <Send size={16} />
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}