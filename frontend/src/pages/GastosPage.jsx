import { useState, useEffect } from 'react';
import api from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import './GastosPage.css';

export default function GastosPage() {
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(false);

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
    value: gastosPorCategoria[key]
  })).sort((a, b) => b.value - a.value);

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
            <h2 className="card-title">Desglose Total</h2>
          </div>
          <div className="desglose-lista">
            {datosGrafico.map((item, index) => (
              <div key={index} className="desglose-item">
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
    </div>
  );
}
