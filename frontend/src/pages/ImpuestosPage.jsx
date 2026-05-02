import { useState, useEffect } from 'react';
import { calcularIVA_API, calcularRentaAPI } from '../services/api';
import './ImpuestosPage.css';

const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;
const CUATRIMESTRE_LABEL = { 1:'1er Cuatrimestre (Ene-Abr)', 2:'2do Cuatrimestre (May-Ago)', 3:'3er Cuatrimestre (Sep-Dic)' };

export default function ImpuestosPage() {
  const [tab, setTab] = useState('iva');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [cuatrimestre, setCuatrimestre] = useState(Math.ceil((new Date().getMonth()+1)/4));
  const [iva, setIva] = useState(null);
  const [renta, setRenta] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { calcular(); }, [tab, anio, cuatrimestre]);

  async function calcular() {
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
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cálculo de Impuestos</h1>
          <p className="page-subtitle">Simulador de declaraciones fiscales</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="impuesto-tabs">
        <button className={`impuesto-tab ${tab==='iva'?'impuesto-tab--activo':''}`} onClick={()=>setTab('iva')}>
          IVA Cuatrimestral (D-135-1)
        </button>
        <button className={`impuesto-tab ${tab==='renta'?'impuesto-tab--activo':''}`} onClick={()=>setTab('renta')}>
          Renta Anual (D-101)
        </button>
      </div>

      {/* Controles */}
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
          {/* Panel IVA */}
          {tab === 'iva' && iva && (
            <div className="glass-card impuesto-resultado animate-slide-up">
              <h3>Resultado IVA — {CUATRIMESTRE_LABEL[cuatrimestre]} {anio}</h3>
              <div className="impuesto-grid">
                <div className="impuesto-item">
                  <span className="impuesto-label">IVA Cobrado (Ventas)</span>
                  <span className="impuesto-valor text-mono" style={{color:'var(--color-exito)'}}>{formatCRC(iva.ivaCobrado)}</span>
                </div>
                <div className="impuesto-item">
                  <span className="impuesto-label">IVA Pagado (Compras)</span>
                  <span className="impuesto-valor text-mono" style={{color:'var(--color-error)'}}>{formatCRC(iva.ivaPagado)}</span>
                </div>
                <div className="impuesto-item impuesto-item--resultado">
                  <span className="impuesto-label">{iva.aPagar ? 'A Pagar a Hacienda' : 'Crédito Fiscal a Favor'}</span>
                  <span className={`impuesto-valor-grande text-mono ${iva.aPagar?'text-error':'text-success'}`}>
                    {formatCRC(Math.abs(iva.ivaResultante))}
                  </span>
                </div>
              </div>
              {iva.detalleIVAPorTasa?.length > 0 && (
                <div className="impuesto-detalle">
                  <h4>Desglose por Tasa de IVA</h4>
                  <table className="tabla"><thead><tr><th>Tasa</th><th>Base Pagada</th><th>IVA Pagado</th><th>Base Cobrada</th><th>IVA Cobrado</th></tr></thead>
                    <tbody>{iva.detalleIVAPorTasa.map((d,i)=>(
                      <tr key={i}><td>{d.tasa}%</td><td className="text-mono">{formatCRC(d.basePagada)}</td><td className="text-mono">{formatCRC(d.ivaPagado)}</td><td className="text-mono">{formatCRC(d.baseCobrada)}</td><td className="text-mono">{formatCRC(d.ivaCobrado)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Panel Renta */}
          {tab === 'renta' && renta && (
            <div className="glass-card impuesto-resultado animate-slide-up">
              <h3>Impuesto sobre la Renta — Año {anio}</h3>
              <div className="impuesto-grid">
                <div className="impuesto-item"><span className="impuesto-label">Ingresos Brutos</span><span className="impuesto-valor text-mono">{formatCRC(renta.ingresosBrutos)}</span></div>
                <div className="impuesto-item"><span className="impuesto-label">Gastos Deducibles</span><span className="impuesto-valor text-mono">{formatCRC(renta.gastosDeducibles)}</span></div>
                <div className="impuesto-item"><span className="impuesto-label">Utilidad Neta</span><span className="impuesto-valor text-mono" style={{fontWeight:700}}>{formatCRC(renta.utilidadNeta)}</span></div>
                <div className="impuesto-item"><span className="impuesto-label">Monto Exento</span><span className="impuesto-valor text-mono">{formatCRC(renta.montoExento)}</span></div>
              </div>
              {renta.detalleTramos?.length > 0 && (
                <div className="impuesto-detalle">
                  <h4>Desglose por Tramos</h4>
                  <table className="tabla"><thead><tr><th>Desde</th><th>Hasta</th><th>Tasa</th><th>Impuesto</th></tr></thead>
                    <tbody>{renta.detalleTramos.map((t,i)=>(
                      <tr key={i}><td className="text-mono">{formatCRC(t.desde)}</td><td className="text-mono">{formatCRC(t.hasta)}</td><td>{t.tasa}%</td><td className="text-mono">{formatCRC(t.impuesto)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <div className="impuesto-grid" style={{marginTop:'var(--espacio-lg)'}}>
                <div className="impuesto-item"><span className="impuesto-label">Créditos Fiscales</span><span className="impuesto-valor text-mono">{formatCRC(renta.creditosFiscales?.total)}</span></div>
                <div className="impuesto-item impuesto-item--resultado">
                  <span className="impuesto-label">Impuesto Final a Pagar</span>
                  <span className={`impuesto-valor-grande text-mono ${renta.impuestoFinal > 0 ? 'text-error':'text-success'}`}>{formatCRC(renta.impuestoFinal)}</span>
                  {renta.impuestoFinal === 0 && <span className="badge badge-exito">Exento</span>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
