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
  // En móvil sólo cabe la inicial del día; se muestra la versión larga en
  // pantallas mayores y siempre queda el nombre completo para lectores de pantalla.
  const diasSemana = [
    { corto: 'L', largo: 'Lun', completo: 'Lunes' },
    { corto: 'M', largo: 'Mar', completo: 'Martes' },
    { corto: 'X', largo: 'Mié', completo: 'Miércoles' },
    { corto: 'J', largo: 'Jue', completo: 'Jueves' },
    { corto: 'V', largo: 'Vie', completo: 'Viernes' },
    { corto: 'S', largo: 'Sáb', completo: 'Sábado' },
    { corto: 'D', largo: 'Dom', completo: 'Domingo' },
  ];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="page-content">
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
                <button className="btn-icon" onClick={mesAnterior} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
                <button className="btn btn-outline btn-sm" onClick={() => setFechaActual(new Date())}>Hoy</button>
                <button className="btn-icon" onClick={mesSiguiente} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
              </div>
            </div>

            <div className="calendario-grid">
              {diasSemana.map(dia => (
                <div key={dia.completo} className="calendario-dia-header">
                  <abbr title={dia.completo}>
                    <span className="dia-corto">{dia.corto}</span>
                    <span className="dia-largo">{dia.largo}</span>
                  </abbr>
                </div>
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
                        <button
                          type="button"
                          key={f._id}
                          className={`factura-pill ${f.categoriaManual ? 'manual' : 'xml'}`}
                          onClick={() => setFacturaSeleccionada(f)}
                          title={`${f.emisor?.nombre || 'Factura'} — ₡${f.resumenFactura?.totalComprobante?.toLocaleString('es-CR') || 0}`}
                        >
                          ₡{f.resumenFactura?.totalComprobante?.toLocaleString('es-CR') || 0}
                        </button>
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
