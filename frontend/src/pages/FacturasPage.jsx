import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Wifi, WifiOff, Eye } from 'lucide-react';
import { obtenerFacturasAPI, estadoEmailAPI, sincronizarEmailAPI } from '../services/api';
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

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [fRes, eRes] = await Promise.all([obtenerFacturasAPI({ limit: 50 }), estadoEmailAPI().catch(() => null)]);
      setFacturas(fRes.data.facturas);
      if (eRes) setEstadoEmail(eRes.data);
    } catch(err) { console.error(err); }
    finally { setCargando(false); }
  }

  async function handleSincronizar() {
    setSincronizando(true);
    try { await sincronizarEmailAPI(); await cargar(); } catch(err) { alert('Error al sincronizar'); }
    finally { setSincronizando(false); }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturas Electrónicas</h1>
          <p className="page-subtitle">Facturas descargadas y procesadas por IA</p>
        </div>
        <button className="btn btn-primary" onClick={handleSincronizar} disabled={sincronizando}>
          <RefreshCw size={18} className={sincronizando ? 'spin' : ''} />
          {sincronizando ? 'Sincronizando...' : 'Sincronizar Email'}
        </button>
      </div>

      {/* Estado del email */}
      <div className="glass-card email-status animate-slide-up">
        <div className="email-status-indicator">
          {estadoEmail?.conectado ? <Wifi size={18} className="status-green" /> : <WifiOff size={18} className="status-red" />}
          <span>{estadoEmail?.conectado ? 'Email conectado' : 'Email desconectado'}</span>
        </div>
        <span className="email-status-detail">
          {estadoEmail?.usuario || 'No configurado'} • Última sync: {estadoEmail?.ultimaSincronizacion ? new Date(estadoEmail.ultimaSincronizacion).toLocaleString('es-CR') : 'Nunca'}
        </span>
      </div>

      {/* Tabla de facturas */}
      <div className="glass-card animate-slide-up" style={{ '--delay':'0.1s' }}>
        {cargando ? <div className="loader-center"><div className="loader" /></div> :
        facturas.length === 0 ? (
          <p style={{ color:'var(--color-texto-sec)', textAlign:'center', padding:'3rem' }}>
            <FileText size={48} style={{ opacity:0.3, marginBottom:'1rem', display:'block', margin:'0 auto 1rem' }} />
            No hay facturas aún. Configura tu email IMAP o sincroniza manualmente.
          </p>
        ) : (
          <div className="tabla-responsive">
            <table className="tabla">
              <thead><tr>
                <th>Fecha</th><th>Emisor</th><th>Total</th><th>IVA</th><th>Categoría IA</th><th>Estado</th>
              </tr></thead>
              <tbody>
                {facturas.map(f => (
                  <tr key={f._id}>
                    <td>{new Date(f.fechaEmision).toLocaleDateString('es-CR')}</td>
                    <td>{f.emisor?.nombre || '—'}</td>
                    <td className="text-mono">{formatCRC(f.resumenFactura?.totalComprobante)}</td>
                    <td className="text-mono">{formatCRC(f.resumenFactura?.totalImpuesto)}</td>
                    <td>
                      <span className={`badge ${f.confianzaIA > 0.7 ? 'badge-exito' : f.confianzaIA > 0.4 ? 'badge-advertencia' : 'badge-error'}`}>
                        {CATEGORIAS_LABEL[f.categoriaManual || f.categoriaIA] || f.categoriaIA}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${f.estado === 'procesada' ? 'badge-exito' : f.estado === 'error' ? 'badge-error' : 'badge-advertencia'}`}>
                        {f.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
