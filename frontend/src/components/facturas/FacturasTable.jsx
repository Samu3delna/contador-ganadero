import { Fragment } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, CheckCircle, XCircle, FileCode, Download, FileText } from 'lucide-react';

const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

const CATEGORIAS_LABEL = {
  veterinaria:'Veterinaria', alimentacion_animal:'Alimentación Animal', maquinaria_equipo:'Maquinaria',
  transporte:'Transporte', servicios_profesionales:'Servicios Prof.', combustible:'Combustible',
  mantenimiento:'Mantenimiento', seguros:'Seguros', insumos_agropecuarios:'Insumos Agro',
  salarios:'Salarios', servicios_publicos:'Serv. Públicos', otros:'Otros', sin_clasificar:'Sin Clasificar',
};

export default function FacturasTable({ 
  cargando, facturas, filtroAlertas, detalleExpandido, toggleDetalle, 
  descargando, handleDescargarXML, handleDescargarPDF 
}) {
  if (cargando) {
    return (
      <div className="glass-card animate-slide-up" style={{ '--delay':'0.1s' }}>
        <div className="loader-center"><div className="loader" /></div>
      </div>
    );
  }

  if (facturas.length === 0) {
    return (
      <div className="glass-card animate-slide-up" style={{ '--delay':'0.1s' }}>
        <p style={{ color:'var(--color-texto-sec)', textAlign:'center', padding:'3rem' }}>
          <FileText size={48} style={{ opacity:0.3, marginBottom:'1rem', display:'block', margin:'0 auto 1rem' }} />
          {filtroAlertas ? 'No hay facturas con alertas de tarifa.' : 'No hay facturas aún. Configura tu email IMAP o sincroniza manualmente.'}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card animate-slide-up" style={{ '--delay':'0.1s' }}>
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
              <Fragment key={f._id}>
                <tr className={`fila-factura ${f.resumenValidacionTarifa?.alertasError > 0 ? 'fila-alerta' : ''}`} onClick={() => toggleDetalle(f._id)}>
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
