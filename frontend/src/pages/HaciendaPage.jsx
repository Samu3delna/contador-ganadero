import { useState, useEffect, useCallback } from 'react';
import { FileText, PenTool, Send, Search, FilePlus, Receipt } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  infoAmbienteHaciendaAPI,
  crearBorradorHaciendaAPI,
  firmarDocumentoHaciendaAPI,
  enviarAHaciendaAPI,
  consultarEstadoHaciendaAPI,
  descargarXmlHaciendaAPI,
  crearRepAPI,
  listarRepAPI,
  crearFecAPI,
  listarFecAPI,
} from '../services/api';
import EmitirFacturaModalv44 from '../components/hacienda/EmitirComprobanteModal';
import './HaciendaPage.css';

const ESTADO_BADGE = {
  borrador: 'badge-advertencia',
  firmada: 'badge-primario',
  procesando: 'badge-info',
  aceptada: 'badge-exito',
  rechazada: 'badge-error',
  anulada: 'badge-secundario',
};

const TABS = [
  { id: 'emision', label: 'Emisión FE/TE', icon: FileText },
  { id: 'rep', label: 'Recibos de Pago (REP)', icon: Receipt },
  { id: 'fec', label: 'Facturas de Compra (FEC)', icon: FilePlus },
];

export default function HaciendaPage() {
  const [tab, setTab] = useState('emision');
  const [ambiente, setAmbiente] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [reps, setReps] = useState([]);
  const [fecs, setFecs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modalTipo, setModalTipo] = useState('FE');

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [ambRes, fac, rep, fec] = await Promise.all([
        infoAmbienteHaciendaAPI().catch(() => ({ data: null })),
        apiLis('/hacienda/emision').catch(() => ({ facturas: [] })),
        listarRepAPI().catch(() => ({ data: { docs: [] } })),
        listarFecAPI().catch(() => ({ data: { docs: [] } })),
      ]);
      setAmbiente(ambRes.data);
      setFacturas(fac.data?.facturas || []);
      setReps(rep.data?.docs || []);
      setFecs(fec.data?.docs || []);
    } catch (e) {
      console.error(e);
      toast.error('Error cargando Hacienda');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const handleEmitir = async (datos, tipoDoc) => {
    setGuardando(true);
    try {
      let r;
      if (tipoDoc === 'REP') {
        r = await crearRepAPI(datos);
      } else if (tipoDoc === 'FEC') {
        r = await crearFecAPI(datos);
      } else {
        r = await crearBorradorHaciendaAPI({ ...datos, tipoDocumento: tipoDoc });
      }
      toast.success(`${tipoDoc} creada en borrador`);
      setModalAbierto(false);
      await cargar();
      //Auto-firmar y encolar para FE/TE/NC/ND/FEC/REP (no en REP todavía, ambos funcionan)
      const id = r.data?._id || r._id;
      if (id) {
        try {
          await firmarDocumentoHaciendaAPI(id);
          toast.success('Firmado ✓');
          await enviarAHaciendaAPI(id);
          toast.success('Enviado a Hacienda (worker)');
          await cargar();
        } catch (e) {
          toast.error(`No se pudo firmar/enviar: ${e.response?.data?.error || e.message}`);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleFirmar = async (id) => {
    try {
      await firmarDocumentoHaciendaAPI(id);
      toast.success('Firmado ✓');
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const handleEnviar = async (id) => {
    try {
      await enviarAHaciendaAPI(id);
      toast.success('Encolado para envío');
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const handleEstado = async (id) => {
    try {
      const r = await consultarEstadoHaciendaAPI(id);
      toast.success(`Estado: ${r.data.estado}`);
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const handleDescargarXml = async (id, clave) => {
    try {
      const r = await descargarXmlHaciendaAPI(id);
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clave || id}.xml`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const abrirModal = (tipo) => {
    setModalTipo(tipo);
    setModalAbierto(true);
  };

  const listaActual = tab === 'emision' ? facturas : tab === 'rep' ? reps : fecs;

  if (cargando) return <div className="loader-center"><div className="loader" /></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hacienda v4.4 — Facturación Nativa</h1>
          <p className="page-subtitle">
            Ambiente: <strong className={ambiente?.ambiente === 'local' ? 'text-amarillo' : 'text-verde'}>
              {ambiente?.ambiente || 'local'}
            </strong>
            {!ambiente?.p12Configurado && ambiente?.ambiente !== 'local' && ' · ⚠️ .p12 no configurado'}
            {ambiente?.ambiente === 'local' && ' · modo prueba (no envía a Hacienda)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => abrirModal('FE')}>
            <FileText size={18} /> Emitir Factura
          </button>
          <button className="btn btn-secondary" onClick={() => abrirModal('FEC')}>
            <FilePlus size={18} /> Compra (FEC)
          </button>
          <button className="btn btn-secondary" onClick={() => abrirModal('REP')}>
            <Receipt size={18} /> Abono (REP)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="hacienda-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`hacienda-tab ${tab === t.id ? 'hacienda-tab--activo' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <TablaDocumentos
        docs={listaActual}
        tipo={tab}
        onFirmar={handleFirmar}
        onEnviar={handleEnviar}
        onEstado={handleEstado}
        onXml={handleDescargarXml}
      />

      <EmitirFacturaModalv44
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onSave={handleEmitir}
        guardando={guardando}
        tipoDoc={modalTipo}
      />
    </div>
  );
}

// helper local
async function apiLis(url) {
  const { default: api } = await import('../services/api');
  return api.get(url);
}

function TablaDocumentos({ docs, tipo, onFirmar, onEnviar, onEstado, onXml }) {
  if (!docs || docs.length === 0) {
    return <p className="text-muted">No hay documentos en esta lista. {tipo === 'rep' ? 'Para registrar un abono, debés tener una factura a crédito ya aceptada.' : ''}</p>;
  }
  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>Clave / Consecutivo</th>
            <th>Receptor</th>
            <th>Fecha</th>
            <th>Total</th>
            <th>IVA</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d._id}>
              <td className="text-mono text-sm">{d.claveNumerica || '—'}<br /><small>{d.consecutivo}</small></td>
              <td>{d.receptor?.nombre || '—'}</td>
              <td>{new Date(d.fechaEmision).toLocaleDateString('es-CR')}</td>
              <td className="text-mono">₡{d.resumenFactura?.totalComprobante?.toLocaleString('es-CR') || 0}</td>
              <td className="text-mono">₡{d.resumenFactura?.totalImpuesto?.toLocaleString('es-CR') || 0}</td>
              <td><span className={`badge ${ESTADO_BADGE[d.estado] || ''}`}>{d.estado}</span></td>
              <td>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {d.estado === 'borrador' && (
                    <button className="btn-icon" title="Firmar" onClick={() => onFirmar(d._id)}><PenTool size={14} /></button>
                  )}
                  {d.estado === 'firmada' && (
                    <button className="btn-icon" title="Enviar a Hacienda" onClick={() => onEnviar(d._id)}><Send size={14} /></button>
                  )}
                  {(d.estado === 'procesando' || d.estado === 'enviada_hacienda') && (
                    <button className="btn-icon" title="Consultar estado" onClick={() => onEstado(d._id)}><Search size={14} /></button>
                  )}
                  {d.estado === 'aceptada' && (
                    <button className="btn-icon" title="Ver estado" onClick={() => onEstado(d._id)}><Search size={14} /></button>
                  )}
                  {d.xmlFirmado && (
                    <button className="btn-icon" title="Descargar XML" onClick={() => onXml(d._id, d.claveNumerica)}><FileText size={14} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
