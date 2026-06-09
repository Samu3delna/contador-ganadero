import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  obtenerFacturasAPI, estadoEmailAPI, sincronizarEmailAPI,
  descargarXML_API, descargarPDF_API, obtenerAlertasTarifaAPI
} from '../services/api';
import { toast } from 'react-hot-toast';
import AlertasPanel from '../components/facturas/AlertasPanel';
import EmailStatus from '../components/facturas/EmailStatus';
import FacturasTable from '../components/facturas/FacturasTable';
import './FacturasPage.css';

export default function FacturasPage() {
  const [facturas, setFacturas] = useState([]);
  const [estadoEmail, setEstadoEmail] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [alertasTarifa, setAlertasTarifa] = useState(null);
  const [filtroAlertas, setFiltroAlertas] = useState(false);
  const [detalleExpandido, setDetalleExpandido] = useState(null);
  const [descargando, setDescargando] = useState(null);

  const cargar = useCallback(async () => {
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
  }, [filtroAlertas]);

  useEffect(() => {
    const run = async () => {
      await Promise.resolve();
      setCargando(true);
      cargar();
    };
    run();
  }, [cargar]);

  async function handleSincronizar() {
    setSincronizando(true);
    try { await sincronizarEmailAPI(); await cargar(); toast.success('Correos sincronizados correctamente'); }
    catch(err) { console.error(err); toast.error('Error al sincronizar: ' + (err.response?.data?.error || err.message)); }
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
    } catch(err) { console.error(err); toast.error('No se pudo descargar el XML: ' + (err.response?.data?.error || err.message)); }
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
    } catch(err) { console.error(err); toast.error('No se pudo descargar el PDF: ' + (err.response?.data?.error || err.message)); }
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

      <AlertasPanel alertasTarifa={alertasTarifa} />

      <EmailStatus estadoEmail={estadoEmail} />

      <FacturasTable 
        cargando={cargando}
        facturas={facturas}
        filtroAlertas={filtroAlertas}
        detalleExpandido={detalleExpandido}
        toggleDetalle={toggleDetalle}
        descargando={descargando}
        handleDescargarXML={handleDescargarXML}
        handleDescargarPDF={handleDescargarPDF}
      />
    </div>
  );
}
