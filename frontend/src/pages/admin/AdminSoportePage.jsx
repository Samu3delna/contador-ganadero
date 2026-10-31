import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, LifeBuoy, Send } from 'lucide-react';
import {
  listarTicketsSoporteAPI, obtenerTicketSoporteAPI,
  actualizarTicketSoporteAPI, responderTicketSoporteAPI,
} from '../../services/adminApi';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import './admin.css';

const LIMITE = 15;

const ESTADOS = [
  { valor: 'abierto', etiqueta: 'Abierto' },
  { valor: 'en_progreso', etiqueta: 'En progreso' },
  { valor: 'resuelto', etiqueta: 'Resuelto' },
  { valor: 'cerrado', etiqueta: 'Cerrado' },
];

const PRIORIDADES = [
  { valor: 'baja', etiqueta: 'Baja' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'alta', etiqueta: 'Alta' },
];

const ETIQUETA_ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.valor, e.etiqueta]));
const ETIQUETA_PRIORIDAD = Object.fromEntries(PRIORIDADES.map((p) => [p.valor, p.etiqueta]));

const formatoFecha = (fecha) => new Date(fecha).toLocaleDateString('es-CR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function AdminSoportePage() {
  const [tickets, setTickets] = useState([]);
  const [resumen, setResumen] = useState({});
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [cargando, setCargando] = useState(true);

  const [ticketSel, setTicketSel] = useState(null);   // ticket cargado en el modal
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [estadoModal, setEstadoModal] = useState('abierto');
  const [prioridadModal, setPrioridadModal] = useState('media');
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const paginasTotales = Math.max(1, Math.ceil(total / LIMITE));

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listarTicketsSoporteAPI({
        q: busqueda, estado: filtroEstado, prioridad: filtroPrioridad, page: pagina, limit: LIMITE,
      });
      setTickets(res.data.tickets);
      setResumen(res.data.resumen || {});
      setTotal(res.data.total);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cargar los tickets de soporte');
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroEstado, filtroPrioridad, pagina]);

  useEffect(() => {
    let cancelado = false;
    listarTicketsSoporteAPI({
      q: busqueda, estado: filtroEstado, prioridad: filtroPrioridad, page: pagina, limit: LIMITE,
    })
      .then((res) => {
        if (!cancelado) {
          setTickets(res.data.tickets);
          setResumen(res.data.resumen || {});
          setTotal(res.data.total);
          setCargando(false);
        }
      })
      .catch((err) => {
        if (!cancelado) {
          toast.error(err.response?.data?.message || 'Error al cargar los tickets de soporte');
          setCargando(false);
        }
      });
    return () => { cancelado = true; };
  }, [busqueda, filtroEstado, filtroPrioridad, pagina]);

  const abrirDetalle = async (id) => {
    setCargandoDetalle(true);
    try {
      const res = await obtenerTicketSoporteAPI(id);
      setTicketSel(res.data.ticket);
      setEstadoModal(res.data.ticket.estado);
      setPrioridadModal(res.data.ticket.prioridad);
      setRespuesta('');
    } catch {
      toast.error('No se pudo cargar el detalle del ticket');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const guardarClasificacion = async () => {
    if (!ticketSel) return;
    setGuardandoEstado(true);
    try {
      const res = await actualizarTicketSoporteAPI(ticketSel._id, {
        estado: estadoModal, prioridad: prioridadModal,
      });
      setTicketSel(res.data.ticket);
      toast.success('Ticket actualizado');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar el ticket');
    } finally {
      setGuardandoEstado(false);
    }
  };

  const enviarRespuesta = async () => {
    if (!ticketSel) return;
    if (!respuesta.trim()) {
      toast.error('Escribe la respuesta antes de enviar');
      return;
    }
    setEnviando(true);
    try {
      const res = await responderTicketSoporteAPI(ticketSel._id, respuesta.trim());
      setTicketSel(res.data.ticket);
      setRespuesta('');
      if (res.data.emailEnviado) {
        toast.success('Respuesta enviada por email al remitente');
      } else {
        toast.error(res.data.mensaje || 'La respuesta quedó registrada, pero el email no se pudo enviar');
      }
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar la respuesta');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Soporte</h1>
          <p className="page-subtitle">Bandeja de tickets enviados desde el formulario de contacto de la plataforma.</p>
        </div>
      </div>

      {/* Tarjetas resumen por estado */}
      <div className="admin-grid-cards">
        {ESTADOS.map((e) => (
          <div key={e.valor} className="admin-stat-card">
            <div className="stat-label">{e.etiqueta}</div>
            <div className="stat-value">{resumen[e.valor] || 0}</div>
            <div className="stat-sub">tickets</div>
          </div>
        ))}
      </div>

      <div className="admin-toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar por asunto, email o nombre..."
            style={{ paddingLeft: 30 }}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
        </select>
        <select
          value={filtroPrioridad}
          onChange={(e) => { setFiltroPrioridad(e.target.value); setPagina(1); }}
          aria-label="Filtrar por prioridad"
        >
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
        </select>
      </div>

      {cargando ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <div className="admin-panel" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.85rem', color: '#cbd5e1', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.8rem' }}>Ticket</th>
                <th style={{ padding: '0.8rem' }}>Remitente</th>
                <th style={{ padding: '0.8rem' }}>Finca / Tenant</th>
                <th style={{ padding: '0.8rem' }}>Prioridad</th>
                <th style={{ padding: '0.8rem' }}>Estado</th>
                <th style={{ padding: '0.8rem' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t._id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>{t.asunto}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {formatoFecha(t.createdAt)} · {t.mensajes?.length || 0} mensaje(s)
                    </div>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>{t.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.email}</div>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>{t.tenantId?.nombreFinca || '—'}</td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <span className={`admin-badge admin-badge--prioridad-${t.prioridad}`}>
                      {ETIQUETA_PRIORIDAD[t.prioridad] || t.prioridad}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <span className={`admin-badge admin-badge--ticket-${t.estado}`}>
                      {ETIQUETA_ESTADO[t.estado] || t.estado}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <div className="admin-acciones">
                      <button className="admin-btn" onClick={() => abrirDetalle(t._id)}>
                        <LifeBuoy size={13} /> Atender
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No hay tickets de soporte con los filtros actuales.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-paginacion">
        <span>{total} ticket(s) en total — página {pagina} de {paginasTotales}</span>
        <div className="paginacion-botones">
          <button className="admin-btn" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <button className="admin-btn" disabled={pagina >= paginasTotales} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      </div>

      {/* Modal de atención del ticket */}
      <Dialog open={!!ticketSel} onOpenChange={(open) => { if (!open) setTicketSel(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ticketSel?.asunto}</DialogTitle>
            <DialogDescription>
              {ticketSel ? `${ticketSel.nombre} · ${ticketSel.email}` : ''}
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="loader-center"><div className="loader" /></div>
          ) : ticketSel && (
            <>
              {/* Datos del ticket */}
              <div className="admin-ticket-datos">
                <span><strong>Finca:</strong> {ticketSel.tenantId?.nombreFinca || '—'}</span>
                <span><strong>Recibido:</strong> {formatoFecha(ticketSel.createdAt)}</span>
                {ticketSel.mensajes?.[0]?.emailEnviado === false && (
                  <span className="admin-error-text">
                    ⚠ Notificación inicial no entregada{ticketSel.mensajes[0].errorEnvio ? `: ${ticketSel.mensajes[0].errorEnvio}` : ''}
                  </span>
                )}
              </div>

              {/* Hilo de conversación */}
              <div className="admin-ticket-thread">
                {ticketSel.mensajes?.map((m, i) => (
                  <div key={i} className={`admin-ticket-msg admin-ticket-msg--${m.autor}`}>
                    <div className="admin-ticket-msg-cabecera">
                      <strong>{m.autor === 'soporte' ? (m.autorNombre || 'Soporte') : ticketSel.nombre}</strong>
                      <span>{formatoFecha(m.fecha)}</span>
                    </div>
                    <div className="admin-ticket-msg-texto">{m.texto}</div>
                    {m.autor === 'soporte' && m.emailEnviado === false && (
                      <div className="admin-error-text">⚠ Email no entregado{m.errorEnvio ? `: ${m.errorEnvio}` : ''}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Clasificación */}
              <div className="admin-ticket-clasificacion">
                <label>
                  Estado
                  <select value={estadoModal} onChange={(e) => setEstadoModal(e.target.value)}>
                    {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
                  </select>
                </label>
                <label>
                  Prioridad
                  <select value={prioridadModal} onChange={(e) => setPrioridadModal(e.target.value)}>
                    {PRIORIDADES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                  </select>
                </label>
                <button
                  className="admin-btn"
                  disabled={guardandoEstado
                    || (estadoModal === ticketSel.estado && prioridadModal === ticketSel.prioridad)}
                  onClick={guardarClasificacion}
                >
                  Guardar clasificación
                </button>
              </div>

              {/* Responder */}
              <label className="admin-ticket-respuesta">
                Respuesta (se enviará por email a {ticketSel.email})
                <textarea
                  rows={4}
                  placeholder="Escribe la respuesta para el remitente..."
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                />
              </label>
            </>
          )}

          <DialogFooter>
            <button className="admin-btn" onClick={() => setTicketSel(null)}>Cerrar</button>
            <button
              className="admin-btn admin-btn--primario"
              disabled={enviando || cargandoDetalle || !ticketSel}
              onClick={enviarRespuesta}
            >
              <Send size={13} /> {enviando ? 'Enviando...' : 'Enviar respuesta'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
