import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import {
  obtenerFacturasAPI, estadoEmailAPI, sincronizarEmailAPI,
  descargarXML_API, descargarPDF_API, obtenerAlertasTarifaAPI
} from '../services/api';
import { toast } from 'react-hot-toast';
import AlertasPanel from '../components/facturas/AlertasPanel';
import EmailStatus from '../components/facturas/EmailStatus';
import FacturasTable from '../components/facturas/FacturasTable';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
    try {
      await sincronizarEmailAPI();
      await cargar();
      toast.success('Correos sincronizados correctamente');
    } catch(err) {
      console.error(err);
      toast.error('Error al sincronizar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSincronizando(false);
    }
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
    } catch(err) {
      console.error(err);
      toast.error('No se pudo descargar el XML: ' + (err.response?.data?.error || err.message));
    } finally {
      setDescargando(null);
    }
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
    } catch(err) {
      console.error(err);
      toast.error('No se pudo descargar el PDF: ' + (err.response?.data?.error || err.message));
    } finally {
      setDescargando(null);
    }
  }

  function toggleDetalle(facturaId) {
    setDetalleExpandido(detalleExpandido === facturaId ? null : facturaId);
  }

  return (
    <div className="page-content">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title text-2xl md:text-3xl font-bold font-heading text-white">Facturas Electrónicas</h1>
            <Badge variant="outline" className="text-xs bg-slate-800/60 border-slate-700 text-slate-300">
              XML v4.4
            </Badge>
          </div>
          <p className="page-subtitle text-slate-400 text-sm mt-1">Facturas descargadas automáticamente por IMAP y validadas con IA</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filtroAlertas ? 'destructive' : 'outline'}
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => setFiltroAlertas(!filtroAlertas)}
            id="btn-filtro-alertas"
          >
            <AlertTriangle size={15} />
            {filtroAlertas ? 'Ver todas' : 'Solo alertas'}
          </Button>

          <Button
            variant="gradient"
            size="sm"
            className="gap-2 h-9 shadow-md shadow-emerald-950/40"
            onClick={handleSincronizar}
            disabled={sincronizando}
            id="btn-sincronizar"
          >
            {sincronizando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>Sincronizar Email</span>
              </>
            )}
          </Button>
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
