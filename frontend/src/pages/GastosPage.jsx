import { useState, useEffect } from 'react';
import api from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import './GastosPage.css';

export default function GastosPage() {
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  useEffect(() => {
    cargarGastos();
  }, []);

  const cargarGastos = async () => {
    setCargando(true);
    try {
      const res = await api.get('/facturas?limit=500');
      setGastos(res.data.facturas);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // Agrupar gastos por categoría
  const gastosPorCategoria = gastos.reduce((acc, gasto) => {
    const cat = gasto.categoriaIA || 'otros';
    acc[cat] = (acc[cat] || 0) + (gasto.resumenFactura?.totalComprobante || 0);
    return acc;
  }, {});

  const datosGrafico = Object.keys(gastosPorCategoria).map(key => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    id: key,
    value: gastosPorCategoria[key]
  })).sort((a, b) => b.value - a.value);

  const facturasFiltradas = categoriaSeleccionada 
    ? gastos.filter(g => (g.categoriaIA || 'otros') === categoriaSeleccionada)
    : [];

  const COLORES = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen de Gastos</h1>
          <p className="page-subtitle">Análisis de todas tus facturas electrónicas por categoría agrícola</p>
        </div>
      </div>

      <div className="gastos-layout">
        <div className="card grafico-card">
          <div className="card-header">
            <h2 className="card-title">Distribución de Gastos</h2>
          </div>
          <div className="grafico-container">
            {cargando ? (
              <p>Cargando datos...</p>
            ) : datosGrafico.length === 0 ? (
              <p className="text-muted">No hay facturas procesadas aún.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={datosGrafico}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {datosGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₡${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card desglose-card">
          <div className="card-header">
            <h2 className="card-title">Desglose Total (Clic para ver facturas)</h2>
          </div>
          <div className="desglose-lista">
            {datosGrafico.map((item, index) => (
              <div 
                key={index} 
                className={`desglose-item ${categoriaSeleccionada === item.id ? 'activo' : ''}`}
                onClick={() => {
                  setCategoriaSeleccionada(item.id === categoriaSeleccionada ? null : item.id);
                  setFacturaSeleccionada(null);
                }}
              >
                <div className="desglose-info">
                  <div className="desglose-color" style={{ backgroundColor: COLORES[index % COLORES.length] }}></div>
                  <span className="desglose-nombre">{item.name}</span>
                </div>
                <span className="desglose-monto">₡{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {categoriaSeleccionada && (
        <div className="card detalle-categoria-card animate-slide-up mt-4">
          <div className="card-header">
            <h2 className="card-title">Facturas en {datosGrafico.find(d => d.id === categoriaSeleccionada)?.name}</h2>
          </div>
          
          <div className="facturas-grid">
            {facturasFiltradas.map(f => (
              <div key={f._id} className="factura-mini-card" onClick={() => setFacturaSeleccionada(f)}>
                <div className="factura-mini-header">
                  <strong>{f.emisor?.nombre || 'Desconocido'}</strong>
                  <span className="factura-mini-fecha">{new Date(f.fechaEmision).toLocaleDateString()}</span>
                </div>
                <div className="factura-mini-body">
                  <span className="factura-mini-monto">₡{f.resumenFactura?.totalComprobante?.toLocaleString() || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {facturaSeleccionada && (
        <div className="modal-overlay" onClick={() => setFacturaSeleccionada(null)}>
          <div className="card detalle-factura-modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="detalle-header">
              <h3>Detalle del Gasto</h3>
              <button className="btn-icon" onClick={() => setFacturaSeleccionada(null)}>✕</button>
            </div>
            <div className="detalle-body">
              <p className="detalle-emisor">{facturaSeleccionada.emisor?.nombre}</p>
              <p className="detalle-fecha">{new Date(facturaSeleccionada.fechaEmision).toLocaleDateString()}</p>
              
              <div className="detalle-monto">
                <span className="monto-label">Total:</span>
                <span className="monto-valor">₡{facturaSeleccionada.resumenFactura?.totalComprobante?.toLocaleString() || 0}</span>
              </div>
              
              <div className="detalle-info">
                <p><strong>Categoría IA:</strong> <span className="badge badge-primary">{facturaSeleccionada.categoriaIA}</span></p>
                <p><strong>Clave XML:</strong> {facturaSeleccionada.claveNumerica || 'N/A'}</p>
                <p><strong>IVA Pagado:</strong> ₡{facturaSeleccionada.resumenFactura?.totalImpuesto?.toLocaleString() || 0}</p>
              </div>

              {facturaSeleccionada.lineaDetalle && facturaSeleccionada.lineaDetalle.length > 0 && (
                <div className="detalle-lineas">
                  <h4>Conceptos Facturados</h4>
                  <ul>
                    {facturaSeleccionada.lineaDetalle.map((linea, idx) => (
                      <li key={idx}>
                        <span>{linea.cantidad}x {linea.descripcion}</span>
                        <span>₡{linea.montoTotal.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
