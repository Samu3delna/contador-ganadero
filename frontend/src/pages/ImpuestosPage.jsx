import { useState, useEffect, useCallback } from 'react';
import { calcularIVA_API, calcularRentaAPI } from '../services/api';
import PanelIVA from '../components/impuestos/PanelIVA';
import PanelRenta from '../components/impuestos/PanelRenta';
import './ImpuestosPage.css';

const CUATRIMESTRE_LABEL = { 1:'1er Cuatrimestre (Ene-Abr)', 2:'2do Cuatrimestre (May-Ago)', 3:'3er Cuatrimestre (Sep-Dic)' };

export default function ImpuestosPage() {
  const [tab, setTab] = useState('iva');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [cuatrimestre, setCuatrimestre] = useState(Math.ceil((new Date().getMonth()+1)/4));
  const [iva, setIva] = useState(null);
  const [renta, setRenta] = useState(null);
  const [cargando, setCargando] = useState(false);

  const calcular = useCallback(async () => {
    setCargando(true);
    try {
      if (tab === 'iva') {
        const res = await calcularIVA_API(cuatrimestre, anio);
        setIva(res.data);
      } else {
        const res = await calcularRentaAPI(anio);
        setRenta(res.data);
      }
    } catch(err) { console.error(err); }
    finally { setCargando(false); }
  }, [tab, anio, cuatrimestre]);

  useEffect(() => {
    const run = async () => {
      await Promise.resolve();
      setCargando(true);
      calcular();
    };
    run();
  }, [calcular]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cálculo de Impuestos</h1>
          <p className="page-subtitle">Simulador de declaraciones fiscales</p>
        </div>
      </div>

      <div className="impuesto-tabs">
        <button className={`impuesto-tab ${tab==='iva'?'impuesto-tab--activo':''}`} onClick={()=>setTab('iva')}>
          IVA Cuatrimestral (D-135-1)
        </button>
        <button className={`impuesto-tab ${tab==='renta'?'impuesto-tab--activo':''}`} onClick={()=>setTab('renta')}>
          Renta Anual (D-101)
        </button>
      </div>

      <div className="impuesto-controls glass-card">
        <div className="form-group">
          <label>Año Fiscal</label>
          <select className="input" value={anio} onChange={e=>setAnio(Number(e.target.value))}>
            {[2024,2025,2026,2027].map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {tab === 'iva' && (
          <div className="form-group">
            <label>Cuatrimestre</label>
            <select className="input" value={cuatrimestre} onChange={e=>setCuatrimestre(Number(e.target.value))}>
              {[1,2,3].map(c=><option key={c} value={c}>{CUATRIMESTRE_LABEL[c]}</option>)}
            </select>
          </div>
        )}
      </div>

      {cargando ? <div className="loader-center"><div className="loader" /></div> : (
        <>
          {tab === 'iva' && iva && (
            <PanelIVA 
              iva={iva} 
              CUATRIMESTRE_LABEL={CUATRIMESTRE_LABEL} 
              cuatrimestre={cuatrimestre} 
              anio={anio} 
            />
          )}

          {tab === 'renta' && renta && (
            <PanelRenta 
              renta={renta} 
              anio={anio} 
            />
          )}
        </>
      )}
    </div>
  );
}
