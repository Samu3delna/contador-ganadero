import { useState, useEffect, useCallback } from 'react';
import { PenTool, Send, Search, XCircle, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Paginacion from '../components/common/Paginacion';
import ConfigHaciendaModal from '../components/hacienda/ConfigHaciendaModal';
import EmitirComprobanteModal from '../components/hacienda/EmitirComprobanteModal';
import Modal from '../components/common/Modal';
import {
  infoAmbienteHaciendaAPI, obtenerFacturasEmisionAPI, crearBorradorHaciendaAPI,
  firmarDocumentoHaciendaAPI, enviarAHaciendaAPI, consultarEstadoHaciendaAPI,
  cancelarDocumentoHaciendaAPI, descargarXmlHaciendaAPI,
} from '../services/api';
import './HaciendaPage.css';

const NOMBRES = { FE: 'Factura electrónica', TE: 'Tiquete electrónico', NC: 'Nota de crédito', ND: 'Nota de débito', FEC: 'Factura de compra', REP: 'Recibo de pago' };
const HISTORICOS = ['FEC', 'REP'];
const ESTADOS = { borrador: 'Borrador', firmada: 'Firmada', enviada_hacienda: 'Envío por confirmar', procesando: 'En proceso', aceptada: 'Aceptada', rechazada: 'Rechazada', anulada: 'Anulada' };

export default function HaciendaPage() {
  const [facturas, setFacturas] = useState([]);
  const [meta, setMeta] = useState({});
  const [pagina, setPagina] = useState(1);
  const [ambiente, setAmbiente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [configAbierta, setConfigAbierta] = useState(false);
  const [modalTipo, setModalTipo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [revisando, setRevisando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [config, docs] = await Promise.all([
        infoAmbienteHaciendaAPI(),
        obtenerFacturasEmisionAPI({ page: pagina, limit: 50 }),
      ]);
      setAmbiente(config.data);
      setFacturas(docs.data.facturas || []);
      setMeta(docs.data);
    } catch {
      setError('No pudimos cargar los comprobantes. Intenta nuevamente.');
    } finally { setCargando(false); }
  }, [pagina]);
  useEffect(() => {
    const timer = setTimeout(cargar, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  async function crear(datos, tipo) {
    setGuardando(true);
    try {
      await crearBorradorHaciendaAPI({ ...datos, tipoDocumento: tipo });
      setModalTipo(null);
      toast.success('Borrador guardado. Revísalo antes de firmar.');
      await cargar();
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo crear el borrador'); }
    finally { setGuardando(false); }
  }
  async function accion(id, solicitud, mensaje) {
    try { await solicitud(id); toast.success(mensaje); await cargar(); }
    catch (e) { toast.error(e.response?.data?.error || 'No se pudo completar la acción'); }
  }
  async function descargar(id, clave) {
    try {
      const response = await descargarXmlHaciendaAPI(id);
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url; a.download = (clave || id) + '.xml'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo descargar el XML'); }
  }
  function cancelar(id) {
    if (!window.confirm('¿Crear una nota de crédito para este comprobante aceptado?')) return;
    accion(id, cancelarDocumentoHaciendaAPI, 'Nota de crédito creada en borrador');
  }
  const moneda = (valor, codigo) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: codigo || 'CRC' }).format(valor || 0);

  return <div className="page-content">
    <div className="page-header">
      <div><h1 className="page-title">Facturación electrónica</h1><p className="page-subtitle">Crea, firma y consulta tus comprobantes.</p></div>
      <div className="btn-group">
        <button className="btn btn-secondary" onClick={() => setConfigAbierta(true)}>Configurar emisión</button>
        <button className="btn btn-primary" onClick={() => setModalTipo('FE')}>Crear factura</button>
        <button className="btn btn-secondary" onClick={() => setModalTipo('TE')}>Crear tiquete</button>
        <button className="btn btn-secondary" onClick={() => setModalTipo('NC')}>Nota de crédito</button>
        <button className="btn btn-secondary" onClick={() => setModalTipo('ND')}>Nota de débito</button>
      </div>
    </div>
    <div className="hacienda-flow-banner">
      <p><strong>{ambiente?.ambiente === 'local' ? 'Ambiente de prueba' : ambiente?.ambiente === 'sandbox' ? 'Sandbox' : 'Producción'}</strong>{ambiente?.ambiente === 'local' ? ' · Los comprobantes no se envían a Hacienda.' : !ambiente?.p12Configurado ? ' · Falta configurar el certificado.' : ''}</p>
      <p>Borrador → Revisar y firmar → Enviar → Consultar respuesta. Un envío pendiente no equivale a aceptación.</p>
    </div>
    {error && <p role="alert" className="error-message">{error} <button className="btn btn-secondary" onClick={cargar}>Reintentar</button></p>}
    {cargando && !facturas.length ? <div className="loader-center"><div className="loader" /></div> : <>
      <Paginacion pagina={pagina} {...meta} onChange={setPagina} cargando={cargando} />
      <h2 className="chart-title">Comprobantes e historial</h2>
      {!facturas.length ? <p className="text-muted">No hay comprobantes todavía. Crea un borrador para comenzar.</p> : <div className="table-responsive"><table className="data-table tabla--stack"><thead><tr><th>Comprobante</th><th>Receptor</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{facturas.map(d => {
        const historico = HISTORICOS.includes(d.tipoDocumento);
        return <tr key={d._id}><td data-label="Comprobante"><strong>{NOMBRES[d.tipoDocumento] || d.tipoDocumento}</strong><br /><small>{d.consecutivo || 'Sin consecutivo'}{historico ? ' · Histórico de solo lectura' : ''}</small></td><td data-label="Receptor">{d.receptor?.nombre || '—'}</td><td data-label="Fecha">{new Date(d.fechaEmision).toLocaleDateString('es-CR')}</td><td data-label="Total">{moneda(d.resumenFactura?.totalComprobante, d.moneda)}</td><td data-label="Estado"><span className="factura-status-chip">{ESTADOS[d.estado] || d.estado}</span>{d.erroresValidacion?.length > 0 && <p role="status" className="text-sm">{d.erroresValidacion.join(' ')}</p>}</td><td data-label="Acciones"><div className="acciones-cell">
          {!historico && d.estado === 'borrador' && <button className="btn btn-secondary btn-sm" title="Revisar y firmar" onClick={() => setRevisando(d)}><PenTool size={16} /> Revisar y firmar</button>}
          {!historico && d.estado === 'firmada' && <button className="btn btn-primary btn-sm" onClick={() => accion(d._id, enviarAHaciendaAPI, 'Encolado para envío. Consulta el estado para confirmar la respuesta.')}><Send size={16} /> Enviar</button>}
          {['enviada_hacienda', 'procesando', 'aceptada', 'rechazada'].includes(d.estado) && <button className="btn btn-secondary btn-sm" onClick={() => accion(d._id, consultarEstadoHaciendaAPI, 'Estado consultado')}><Search size={16} /> Consultar</button>}
          {!historico && d.estado === 'aceptada' && ['FE', 'TE'].includes(d.tipoDocumento) && <button className="btn btn-secondary btn-sm" onClick={() => cancelar(d._id)}><XCircle size={16} /> Crear NC</button>}
          {(d.hashFirma || d.xmlFirmado) && <button className="btn btn-secondary btn-sm" onClick={() => descargar(d._id, d.claveNumerica)}><Download size={16} /> XML</button>}
          {historico && !['enviada_hacienda', 'procesando', 'aceptada', 'rechazada'].includes(d.estado) && <span>Solo lectura</span>}
        </div></td></tr>;
      })}</tbody></table></div>}
    </>}
    {configAbierta && <ConfigHaciendaModal isOpen onClose={() => setConfigAbierta(false)} actual={ambiente} onSaved={cargar} />}
    {modalTipo && <EmitirComprobanteModal isOpen onClose={() => setModalTipo(null)} onSave={crear} guardando={guardando} tipoDoc={modalTipo} />}
    <Modal isOpen={Boolean(revisando)} onClose={() => setRevisando(null)} title="Revisar borrador antes de firmar" size="lg">
      {revisando && <>
        <p><strong>{NOMBRES[revisando.tipoDocumento]}</strong> · {revisando.consecutivo}</p>
        <p>Emisor: {revisando.emisor?.nombre} · Receptor: {revisando.receptor?.nombre || 'Consumidor final'}</p>
        <ul>{revisando.lineaDetalle?.map((linea, index) => <li key={index}>{linea.descripcion} · CABYS {linea.codigo} · {linea.cantidad} × {moneda(linea.precioUnitario, revisando.moneda)}</li>)}</ul>
        {revisando.documentoReferencia && <p>Referencia: {revisando.documentoReferencia.numeroReferencia}</p>}
        <p><strong>Total: {moneda(revisando.resumenFactura?.totalComprobante, revisando.moneda)}</strong></p>
        <p>La firma confirma estos datos. El envío a Hacienda se realiza en el siguiente paso.</p>
        <div className="form-actions"><button className="btn btn-secondary" onClick={() => setRevisando(null)}>Volver</button><button className="btn btn-primary" onClick={async () => { await accion(revisando._id, firmarDocumentoHaciendaAPI, 'Comprobante firmado. Ya puedes enviarlo.'); setRevisando(null); }}>Firmar comprobante</button></div>
      </>}
    </Modal>
  </div>;
}
