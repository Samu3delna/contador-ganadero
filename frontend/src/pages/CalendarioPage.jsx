import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DetalleFacturaModal from '../components/common/DetalleFacturaModal';
import './CalendarioPage.css';

export default function CalendarioPage() {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  const cargarFacturasMes = useCallback(async () => {
    setCargando(true);
    try {
      // Obtenemos un límite alto para poder pintar el mes
      const res = await api.get(`/facturas?limit=500`);
      // Filtramos en el cliente las del mes actual (podría hacerse en el backend pero esto es rápido)
      const facturasMes = res.data.facturas.filter(f => {
        const date = new Date(f.fechaEmision);
        return date.getMonth() === fechaActual.getMonth() && date.getFullYear() === fechaActual.getFullYear();
      });
      setFacturas(facturasMes);
    } catch (error) {
      console.error('Error cargando facturas del calendario:', error);
    } finally {
      setCargando(false);
    }
  }, [fechaActual]);

  useEffect(() => {
    const run = async () => {
      await Promise.resolve();
      cargarFacturasMes();
    };
    run();
  }, [cargarFacturasMes]);

  const mesAnterior = () => setFechaActual(new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1));
  const mesSiguiente = () => setFechaActual(new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1));

  const getDiasMes = (fecha) => {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const dias = [];
    
    // Rellenar espacios en blanco del principio
    let diaSemana = primerDia.getDay(); // 0 = Domingo, 1 = Lunes
    // Ajustar para que Lunes sea el primer día de la semana
    diaSemana = diaSemana === 0 ? 6 : diaSemana - 1;
    
    for (let i = 0; i < diaSemana; i++) {
      dias.push(null);
    }
    
    // Días del mes
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      dias.push(new Date(año, mes, i));
    }
    return dias;
  };

  const dias = getDiasMes(fechaActual);
  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendario de Gastos</h1>
          <p className="page-subtitle">Visualiza tus facturas y gastos por día</p>
        </div>
      </div>

      {cargando ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <div className="calendario-layout">
          <div className="card calendario-card">
            <div className="calendario-header">
              <h2>{meses[fechaActual.getMonth()]} {fechaActual.getFullYear()}</h2>
              <div className="calendario-nav">
                <button className="btn-icon" onClick={mesAnterior}><ChevronLeft /></button>
                <button className="btn btn-outline" onClick={() => setFechaActual(new Date())}>Hoy</button>
                <button className="btn-icon" onClick={mesSiguiente}><ChevronRight /></button>
              </div>
            </div>

            <div className="calendario-grid">
              {diasSemana.map(dia => (
                <div key={dia} className="calendario-dia-header">{dia}</div>
              ))}
              
              {dias.map((dia, index) => {
                if (!dia) return <div key={`empty-${index}`} className="calendario-celda vacia"></div>;
                
                const facturasDelDia = facturas.filter(f => new Date(f.fechaEmision).getDate() === dia.getDate());
                const esHoy = new Date().toDateString() === dia.toDateString();

                return (
                  <div key={dia.toISOString()} className={`calendario-celda ${esHoy ? 'hoy' : ''}`}>
                    <span className="numero-dia">{dia.getDate()}</span>
                    <div className="facturas-dia-lista">
                      {facturasDelDia.map(f => (
                        <div 
                          key={f._id} 
                          className={`factura-pill ${f.categoriaManual ? 'manual' : 'xml'}`}
                          onClick={() => setFacturaSeleccionada(f)}
                        >
                          ₡{f.resumenFactura?.totalComprobante?.toLocaleString() || 0}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DetalleFacturaModal 
            facturaSeleccionada={facturaSeleccionada} 
            setFacturaSeleccionada={setFacturaSeleccionada} 
          />
        </div>
      )}
    </div>
  );
}
