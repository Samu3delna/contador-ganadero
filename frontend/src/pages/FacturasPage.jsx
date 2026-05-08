import { useState, useEffect } from 'react';
import {
  FileText, RefreshCw, Wifi, WifiOff, Download, AlertTriangle,
  CheckCircle, XCircle, Filter, ChevronDown, ChevronUp, FileCode, Eye
} from 'lucide-react';
import {
  obtenerFacturasAPI, estadoEmailAPI, sincronizarEmailAPI,
  descargarXML_API, descargarPDF_API, obtenerAlertasTarifaAPI
} from '../services/api';
import './FacturasPage.css';

const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

const CATEGORIAS_LABEL = {
  veterinaria:'Veterinaria', alimentacion_animal:'Alimentación Animal', maquinaria_equipo:'Maquinaria',
  transporte:'Transporte', servicios_profesionales:'Servicios Prof.', combustible:'Combustible',
  mantenimiento:'Mantenimiento', seguros:'Seguros', insumos_agropecuarios:'Insumos Agro',
  salarios:'Salarios', servicios_publicos:'Serv. Públicos', otros:'Otros', sin_clasificar:'Sin Clasificar',
};

export default function FacturasPage() {
  const [facturas, setFacturas] = useState([]);
  const [estadoEmail, setEstadoEmail] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [alertasTarifa, setAlertasTarifa] = useState(null);
  const [filtroAlertas, setFiltroAlertas] = useState(false);
  const [detalleExpandido, setDetalleExpandido] = useState(null);
  const [descargando, setDescargando] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const params = { limit: 50 };
      if (filtroAlertas) params.soloAlertas = 'true';

      const [fRes, eRes, aRes] = await Promise.all([
        obtenerFacturasAPI(params),
        estadoEmailAPI().catch(() => null),
        obtenerAlertasTarifaAPI().catch(() => null),
      ]);
      setFacturas(fRes.data.facturas);
      if (eRes) setEstadoEmail(eRes.data);
      if (aRes) setAlertasTarifa(aRes.data);
    } catch(err) { console.error(err); }
    finally { setCargando(false); }
  }

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [filtroAlertas]);

  async function handleSincronizar() {
    setSincronizando(true);
    try { await sincronizarEmailAPI(); await cargar(); } catch(err) { alert('Error al sincronizar'); }
    finally { setSincronizando(false); }
  }

  async function handleDescargarXML(facturaId, e) {
    e.stopPropagation();
    setDescargando(facturaId);
    try {
      const res = await descargarXML_API(facturaId);
      const blob = new Blob([res.data], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${facturaId}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) { alert('No se pudo descargar el XML: ' + (err.response?.data?.error || err.message)); }
    finally { setDescargando(null); }
  }

  async function handleDescargarPDF(facturaId, e) {
    e.stopPropagation();
    setDescargando(facturaId);
    try {
      const res = await descargarPDF_API(facturaId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${facturaId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) { alert('No se pudo descargar el PDF: ' + (err.response?.data?.error || err.message)); }
    finally { setDescargando(null); }
  }

  function toggleDetalle(facturaId) {
    setDetalleExpandido(detalleExpandido === facturaId ? null : facturaId);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturas Electrónicas</h1>
          <p className="page-subtitle">Facturas XML descargadas, procesadas y validadas por IA</p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${filtroAlertas ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setFiltroAlertas(!filtroAlertas)}
            id="btn-filtro-alertas"
          >
            <AlertTriangle size={18} />
            {filtroAlertas ? 'Todas' : 'Solo alertas'}
          </button>
          <button className="btn btn-primary" onClick={handleSincronizar} disabled={sincronizando} id="btn-sincronizar">
            <RefreshCw size={18} className={sincronizando ? 'spin' : ''} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Email'}
          </button>
        </div>
      </div>

      {/* Panel de alertas de tarifa */}
      {alertasTarifa && alertasTarifa.totalAlertas > 0 && (
        <div className="glass-card alertas-panel animate-slide-up">
          <div className="alertas-header">
            <div className="alertas-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="alertas-info">
              <h3>⚠️ Alertas de Tarifa Agropecuaria</h3>
              <p>
                Se encontraron <strong>{alertasTarifa.totalAlertas}</strong> producto(s) que podrían estar
                cobrando IVA al 13% cuando deberían pagar solo el 1%.
              </p>
            </div>
            <div className="alertas-monto">
              <span className="alertas-label">Ahorros perdidos</span>
              <span className="alertas-valor">{formatCRC(alertasTarifa.totalAhorrosPerdidos)}</span>
            </div>
          </div>
          <div className="alertas-detalle">
            {alertasTarifa.alertas.slice(0, 5).map((a, i) => (
              <div key={i} className={`alerta-item alerta-${a.severidad}`}>
                {a.severidad === 'error' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                <div className="alerta-texto">
                  <strong>{a.emisor}</strong> — {a.descripcion}
                  <span className="alerta-tarifa">
                    Código {a.codigoTarifaActual} ({a.tarifaActual}%) →
                    Debería ser {a.codigoTarifaEsperado} ({a.tarifaEsperada}%)
                  </span>
                </div>
                {a.diferenciaIVA > 0 && (
                  <span className="alerta-diff">+{formatCRC(a.diferenciaIVA)}</span>
                )}
              </div>
            ))}
            {alertasTarifa.totalAlertas > 5 && (
              <p className="alertas-mas">
                ... y {alertasTarifa.totalAlertas - 5} alerta(s) más
              </p>
            )}
          </div>
        </div>
      )}

      {/* Estado del email */}
      <div className="glass-card email-status animate-slide-up">
        <div className="email-status-indicator">
          {estadoEmail?.conectado ? <Wifi size={18} className="status-green" /> : <WifiOff size={18} className="status-red" />}
          <span>{estadoEmail?.conectado ? 'Email conectado' : 'Email desconectado'}</span>
        </div>
        <span className="email-status-detail">
          {estadoEmail?.usuario || 'No configurado'} • Última sync: {estadoEmail?.ultimaSincronizacion ? new Date(estadoEmail.ultimaSincronizacion).toLocaleString('es-CR') : 'Nunca'}
          {estadoEmail?.estadisticas && ` • XMLs: ${estadoEmail.estadisticas.xmlsDescargados} • Alertas: ${estadoEmail.estadisticas.alertasTarifa}`}
        </span>
      </div>

      {/* Tabla de facturas */}
      <div className="glass-card animate-slide-up" style={{ '--delay':'0.1s' }}>
        {cargando ? <div className="loader-center"><div className="loader" /></div> :
        facturas.length === 0 ? (
          <p style={{ color:'var(--color-texto-sec)', textAlign:'center', padding:'3rem' }}>
            <FileText size={48} style={{ opacity:0.3, marginBottom:'1rem', display:'block', margin:'0 auto 1rem' }} />
            {filtroAlertas ? 'No hay facturas con alertas de tarifa.' : 'No hay facturas aún. Configura tu email IMAP o sincroniza manualmente.'}
          </p>
        ) : (
          <div className="tabla-responsive">
            <table className="tabla" id="tabla-facturas">
              <thead><tr>
                <th></th>
                <th>Fecha</th>
                <th>Emisor</th>
                <th>Total</th>
                <th>IVA</th>
                <th>Tarifa</th>
                <th>Categoría IA</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr></thead>
              <tbody>
                {facturas.map(f => (
                  <>
                    <tr key={f._id} className={`fila-factura ${f.resumenValidacionTarifa?.alertasError > 0 ? 'fila-alerta' : ''}`} onClick={() => toggleDetalle(f._id)}>
                      <td className="expand-cell">
                        {detalleExpandido === f._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td>{new Date(f.fechaEmision).toLocaleDateString('es-CR')}</td>
                      <td>
                        <div className="emisor-cell">
                          {f.emisor?.nombre || '—'}
                          {f.carpetaOrigen && f.carpetaOrigen !== 'INBOX' && (
                            <span className="badge badge-info-small">{f.carpetaOrigen.replace('[Gmail]/', '')}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-mono">{formatCRC(f.resumenFactura?.totalComprobante)}</td>
                      <td className="text-mono">{formatCRC(f.resumenFactura?.totalImpuesto)}</td>
                      <td>
                        {f.resumenValidacionTarifa?.alertasError > 0 ? (
                          <span className="badge badge-error" title="Tarifa incorrecta detectada">
                            <AlertTriangle size={12} style={{marginRight:'4px'}} />
                            {f.resumenValidacionTarifa.alertasError} alerta(s)
                          </span>
                        ) : (
                          <span className="badge badge-exito">
                            <CheckCircle size={12} style={{marginRight:'4px'}} />
                            OK
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${f.confianzaIA > 0.7 ? 'badge-exito' : f.confianzaIA > 0.4 ? 'badge-advertencia' : 'badge-error'}`}>
                          {CATEGORIAS_LABEL[f.categoriaManual || f.categoriaIA] || f.categoriaIA}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${f.estado === 'procesada' ? 'badge-exito' : f.estado === 'revision' ? 'badge-advertencia' : f.estado === 'error' ? 'badge-error' : 'badge-advertencia'}`}>
                          {f.estado}
                        </span>
                      </td>
                      <td>
                        <div className="acciones-cell">
                          <button
                            className="btn-icon"
                            title="Descargar XML"
                            onClick={(e) => handleDescargarXML(f._id, e)}
                            disabled={descargando === f._id}
                            id={`btn-xml-${f._id}`}
                          >
                            <FileCode size={16} />
                          </button>
                          {f.archivoPDF && (
                            <button
                              className="btn-icon"
                              title="Descargar PDF"
                              onClick={(e) => handleDescargarPDF(f._id, e)}
                              disabled={descargando === f._id}
                              id={`btn-pdf-${f._id}`}
                            >
                              <Download size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Fila expandida con detalle de líneas y alertas */}
                    {detalleExpandido === f._id && (
                      <tr key={`${f._id}-detail`} className="fila-detalle">
                        <td colSpan={9}>
                          <div className="detalle-contenido">
                            <div className="detalle-meta">
                              <span><strong>Clave:</strong> {f.claveNumerica || 'N/A'}</span>
                              <span><strong>Versión XML:</strong> {f.versionEsquema || '—'}</span>
                              <span><strong>Moneda:</strong> {f.moneda}</span>
                              <span><strong>Carpeta:</strong> {f.carpetaOrigen || 'INBOX'}</span>
                            </div>

                            {/* Alertas de tarifa de esta factura */}
                            {f.alertasTarifa && f.alertasTarifa.length > 0 && (
                              <div className="detalle-alertas">
                                <h4>🚨 Alertas de Tarifa</h4>
                                {f.alertasTarifa.map((a, i) => (
                                  <div key={i} className={`alerta-item alerta-${a.severidad}`}>
                                    {a.severidad === 'error' ? <XCircle size={14} /> : a.severidad === 'advertencia' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                                    <span>{a.mensaje}</span>
                                  </div>
                                ))}
                                {f.resumenValidacionTarifa?.ahorrosPerdidos > 0 && (
                                  <div className="ahorros-perdidos">
                                    💸 Estás pagando <strong>{formatCRC(f.resumenValidacionTarifa.ahorrosPerdidos)}</strong> de más por tarifa incorrecta
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Líneas de detalle */}
                            {f.lineaDetalle && f.lineaDetalle.length > 0 && (
                              <div className="detalle-lineas">
                                <h4>📋 Detalle de líneas</h4>
                                <table className="tabla tabla-mini">
                                  <thead><tr>
                                    <th>#</th>
                                    <th>Descripción</th>
                                    <th>Cant.</th>
                                    <th>Precio Unit.</th>
                                    <th>Cód. Tarifa</th>
                                    <th>IVA %</th>
                                    <th>IVA ₡</th>
                                    <th>Total</th>
                                  </tr></thead>
                                  <tbody>
                                    {f.lineaDetalle.map((l, idx) => (
                                      <tr key={idx} className={l.impuesto?.codigoTarifa === '08' ? 'linea-tarifa-general' : l.impuesto?.codigoTarifa === '02' ? 'linea-tarifa-reducida' : ''}>
                                        <td>{l.numeroLinea || idx + 1}</td>
                                        <td>{l.descripcion}</td>
                                        <td className="text-mono">{l.cantidad}</td>
                                        <td className="text-mono">{formatCRC(l.precioUnitario)}</td>
                                        <td>
                                          <span className={`codigo-tarifa ${l.impuesto?.codigoTarifa === '08' ? 'tarifa-general' : l.impuesto?.codigoTarifa === '02' || l.impuesto?.codigoTarifa === '01' ? 'tarifa-reducida' : ''}`}>
                                            {l.impuesto?.codigoTarifa || '—'}
                                          </span>
                                        </td>
                                        <td className="text-mono">{l.impuesto?.tarifa ?? '—'}%</td>
                                        <td className="text-mono">{formatCRC(l.impuesto?.monto)}</td>
                                        <td className="text-mono">{formatCRC(l.montoTotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
