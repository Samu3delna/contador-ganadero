import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import DistribucionGastos from '../components/gastos/DistribucionGastos';
import DesgloseGastos from '../components/gastos/DesgloseGastos';
import DetalleCategoria from '../components/gastos/DetalleCategoria';
import DetalleFacturaModal from '../components/common/DetalleFacturaModal';
import './GastosPage.css';

export default function GastosPage() {
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  const cargarGastos = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.get('/facturas?limit=500');
      setGastos(res.data.facturas);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await Promise.resolve();
      cargarGastos();
    };
    run();
  }, [cargarGastos]);

  // Agrupar gastos por categoría
  const gastosPorCategoria = gastos.reduce((acc, gasto) => {
    const cat = gasto.categoriaIA || 'sin_clasificar';
    acc[cat] = (acc[cat] || 0) + (gasto.resumenFactura?.totalComprobante || 0);
    return acc;
  }, {});

  const datosGrafico = Object.keys(gastosPorCategoria).map(key => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    id: key,
    value: gastosPorCategoria[key]
  })).sort((a, b) => b.value - a.value);

  const facturasFiltradas = categoriaSeleccionada 
    ? gastos.filter(g => (g.categoriaIA || 'sin_clasificar') === categoriaSeleccionada)
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
        <DistribucionGastos 
          cargando={cargando} 
          datosGrafico={datosGrafico} 
          COLORES={COLORES} 
        />

        <DesgloseGastos 
          datosGrafico={datosGrafico} 
          COLORES={COLORES} 
          categoriaSeleccionada={categoriaSeleccionada} 
          setCategoriaSeleccionada={setCategoriaSeleccionada} 
          setFacturaSeleccionada={setFacturaSeleccionada} 
        />
      </div>

      <DetalleCategoria 
        categoriaSeleccionada={categoriaSeleccionada} 
        datosGrafico={datosGrafico} 
        facturasFiltradas={facturasFiltradas} 
        setFacturaSeleccionada={setFacturaSeleccionada} 
      />

      <DetalleFacturaModal 
        facturaSeleccionada={facturaSeleccionada} 
        setFacturaSeleccionada={setFacturaSeleccionada} 
      />
    </div>
  );
}
