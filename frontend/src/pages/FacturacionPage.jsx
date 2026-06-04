import { useState, useEffect } from 'react';
import { obtenerFacturasEmisionAPI, obtenerResumenEmisionAPI } from '../services/api';

export default function FacturacionPage() {
  const [facturas, setFacturas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [facturasRes, resumenRes] = await Promise.all([
        obtenerFacturasEmisionAPI(),
        obtenerResumenEmisionAPI(),
      ]);
      setFacturas(facturasRes.data.facturas || []);
      setResumen(resumenRes.data);
    } catch {
      setError('Error cargando facturación');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const estadoColor = (estado) => {
    const colores = {
      borrador: 'gray',
      generada: 'blue',
      firmada: 'purple',
      enviada_hacienda: 'orange',
      aceptada: 'green',
      rechazada: 'red',
      anulada: 'darkgray',
    };
    return colores[estado] || 'gray';
  };

  if (cargando) return <div className="loader-center"><div className="loader" /></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="page-container">
      <h1 className="page-title">Facturación Electrónica REA</h1>

      {/* Resumen */}
      <div className="cards-grid">
        <div className="card">
          <h3>Total Facturas</h3>
          <p className="big-number">{resumen?.totalFacturas || 0}</p>
        </div>
        <div className="card">
          <h3>Total Emitido</h3>
          <p className="big-number">₡{resumen?.totalEmitido?.toLocaleString() || 0}</p>
        </div>
        <div className="card">
          <h3>IVA Recaudado (1%)</h3>
          <p className="big-number">₡{resumen?.totalIVARecaudado?.toLocaleString() || 0}</p>
        </div>
        <div className="card">
          <h3>Aceptadas</h3>
          <p className="big-number">{resumen?.porEstado?.aceptada || 0}</p>
        </div>
      </div>

      {/* Lista de facturas */}
      <h2 className="section-title">Facturas Emitidas</h2>
      {facturas.length === 0 ? (
        <p>No hay facturas emitidas.</p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Consecutivo</th>
                <th>Receptor</th>
                <th>Producto</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>IVA (1%)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f._id}>
                  <td>{f.consecutivo}</td>
                  <td>{f.receptor?.nombre}</td>
                  <td>{f.tipoProducto}</td>
                  <td>{new Date(f.fechaEmision).toLocaleDateString('es-CR')}</td>
                  <td>₡{f.resumenFactura?.totalComprobante?.toLocaleString()}</td>
                  <td>₡{f.resumenFactura?.totalImpuesto?.toLocaleString()}</td>
                  <td>
                    <span className={`badge badge--${estadoColor(f.estado)}`}>
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
  );
}
