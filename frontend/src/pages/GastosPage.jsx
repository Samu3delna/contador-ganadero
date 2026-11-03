import Paginacion from '../components/common/Paginacion';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import DistribucionGastos from '../components/gastos/DistribucionGastos';
import DesgloseGastos from '../components/gastos/DesgloseGastos';
import DetalleCategoria from '../components/gastos/DetalleCategoria';
import DetalleFacturaModal from '../components/common/DetalleFacturaModal';
import './GastosPage.css';

export default function GastosPage() {
  const [gastos, setGastos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [meta, setMeta] = useState({});
  const [gastosPorCategoria, setCategorias] = useState({});
  const [cargando, setCargando] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  const cargarGastos = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.get('/facturas/resumen', { params: { page: pagina, limit: 50, categoria: categoriaSeleccionada || undefined } });
      setCategorias(res.data.categorias); setMeta(res.data);
      setGastos(res.data.facturas);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }, [pagina, categoriaSeleccionada]);

  useEffect(() => {
    const run = async () => {
      await Promise.resolve();
      cargarGastos();
    };
    run();
  }, [cargarGastos]);

  const datosGrafico = Object.keys(gastosPorCategoria).map(key => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    id: key,
    value: gastosPorCategoria[key]
  })).sort((a, b) => b.value - a.value);

  const facturasFiltradas = categoriaSeleccionada
    ? gastos.filter(g => (g.categoriaManual || g.categoriaIA || 'sin_clasificar') === categoriaSeleccionada)
    : [];

  const COLORES = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

  return (
    <div className="page-content">
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
          setCategoriaSeleccionada={valor => { setCategoriaSeleccionada(valor); setPagina(1); }}
          setFacturaSeleccionada={setFacturaSeleccionada}
        />
      </div>

      <DetalleCategoria
        categoriaSeleccionada={categoriaSeleccionada}
        datosGrafico={datosGrafico}
        facturasFiltradas={facturasFiltradas}
        setFacturaSeleccionada={setFacturaSeleccionada}
      />

      {categoriaSeleccionada && <Paginacion pagina={pagina} {...meta} onChange={setPagina} cargando={cargando} />}
      <DetalleFacturaModal
        facturaSeleccionada={facturaSeleccionada}
        setFacturaSeleccionada={setFacturaSeleccionada}
      />
    </div>
  );
}
