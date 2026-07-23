import { useState } from 'react';
import { FileDown, FileSpreadsheet, Calculator, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  conciliacionD150GETAPI,
  reporteD150PDFAPI,
  reporteD150ExcelAPI,
} from '../services/api';
import './D150Page.css';

const MESES = [
  { v: 1, label: 'Enero' }, { v: 2, label: 'Febrero' }, { v: 3, label: 'Marzo' },
  { v: 4, label: 'Abril' }, { v: 5, label: 'Mayo' }, { v: 6, label: 'Junio' },
  { v: 7, label: 'Julio' }, { v: 8, label: 'Agosto' }, { v: 9, label: 'Setiembre' },
  { v: 10, label: 'Octubre' }, { v: 11, label: 'Noviembre' }, { v: 12, label: 'Diciembre' },
];

export default function D150Page() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [retencionesTexto, setRetencionesTexto] = useState('');
  const [ivaRetenido, setIvaRetenido] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [descargando, setDescargando] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const crudo = (retencionesTexto || '')
        .split(/[,\n]/)
        .map((r) => Number(r.trim()))
        .filter((n) => !isNaN(n) && n > 0);
      const retenciones = crudo.length > 0 ? crudo : [];
      const r = await conciliacionD150GETAPI({
        mes,
        anio,
        retencionesTarjeta: retenciones.join(','),
        ivaRetenidoPorTerceros: ivaRetenido,
      });
      setResultado(r.data);
      toast.success('Conciliación calculada');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setCargando(false);
    }
  };

  const descargar = async (fmt) => {
    setDescargando(fmt);
    try {
      const retenciones = retencionesTexto
        ? retencionesTexto.split(/[,\n]/).map((r) => Number(r.trim())).filter((n) => !isNaN(n) && n > 0).join(',')
        : '';
      const params = { mes, anio, retencionesTarjeta: retenciones, ivaRetenidoPorTerceros: ivaRetenido };
      const r = fmt === 'pdf'
        ? await reporteD150PDFAPI(params)
        : await reporteD150ExcelAPI(params);
      const mime = fmt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = fmt === 'pdf' ? 'pdf' : 'xlsx';
      const url = window.URL.createObjectURL(new Blob([r.data], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `D-150_${anio}-${String(mes).padStart(2, '0')}.${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setDescargando('');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Conciliación D-150 IVA</h1>
          <p className="page-subtitle">
            Calcula el IVA cobrado / soportado del mes y lo contrasta con el prellenado de la OVI de TRIBU-CR
            antes de presentarlo. Hacienda NO expone API de envío: la declaración se presenta manualmente.
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Mes</label>
            <select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Año</label>
            <input className="input" type="number" min="2024" max="2099" value={anio}
              onChange={(e) => setAnio(Number(e.target.value))} style={{ width: '100px' }} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 240px' }}>
            <label>Retenciones tarjeta (separadas por coma)</label>
            <input className="input" type="text" value={retencionesTexto}
              placeholder="ej: 12000, 8500, 4300"
              onChange={(e) => setRetencionesTexto(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0, width: '160px' }}>
            <label>IVA retenido por terceros</label>
            <input className="input" type="number" min="0" step="any" value={ivaRetenido}
              onChange={(e) => setIvaRetenido(Number(e.target.value))} />
          </div>
          <button className="btn btn-primary" onClick={cargar} disabled={cargando}>
            <Calculator size={18} /> {cargando ? 'Calculando...' : 'Calcular'}
          </button>
        </div>
      </div>

      {!resultado ? (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <RefreshCw size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
          <p className="text-muted">Seleccioná mes y año, y presioná "Calcular" para generar la conciliación.</p>
        </div>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="dashboard-cards">
            <div className="glass-card dash-card">
              <div className="dash-card-icon dash-card-icon--blue"><Calculator size={20} /></div>
              <div className="dash-card-info">
                <span className="dash-card-label">Débito fiscal</span>
                <span className="dash-card-value">₡{resultado.resultadoFinal.debitoFiscal.toLocaleString('es-CR')}</span>
              </div>
            </div>
            <div className="glass-card dash-card">
              <div className="dash-card-icon dash-card-icon--green"><Calculator size={20} /></div>
              <div className="dash-card-info">
                <span className="dash-card-label">Crédito deducible</span>
                <span className="dash-card-value">₡{resultado.resultadoFinal.creditoDeducible.toLocaleString('es-CR')}</span>
              </div>
            </div>
            <div className="glass-card dash-card">
              <div className="dash-card-icon dash-card-icon--amber"><Calculator size={20} /></div>
              <div className="dash-card-info">
                <span className="dash-card-label">Prorrata %</span>
                <span className="dash-card-value">{resultado.prorrata.porcentajeDeducible}%</span>
              </div>
            </div>
            <div className={`glass-card dash-card ${resultado.resultadoFinal.ivaAPagar > 0 ? 'esto-no__rojo' : 'esto-no__verde'}`}>
              <div className="dash-card-icon"><Calculator size={20} /></div>
              <div className="dash-card-info">
                <span className="dash-card-label">{resultado.resultadoFinal.ivaAPagar > 0 ? 'IVA a pagar' : 'Saldo a favor'}</span>
                <span className="dash-card-value">
                  ₡{(resultado.resultadoFinal.ivaAPagar > 0
                    ? resultado.resultadoFinal.ivaAPagar
                    : resultado.resultadoFinal.saldoAFavor).toLocaleString('es-CR')}
                </span>
              </div>
            </div>
          </div>

          {/* Exportar */}
          <div style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
            <button className="btn btn-secondary" onClick={() => descargar('pdf')} disabled={!!descargando}>
              <FileDown size={16} /> {descargando === 'pdf' ? 'Generando...' : 'Exportar PDF'}
            </button>
            <button className="btn btn-secondary" onClick={() => descargar('excel')} disabled={!!descargando}>
              <FileSpreadsheet size={16} /> {descargando === 'excel' ? 'Generando...' : 'Exportar Excel'}
            </button>
          </div>

          {/* Tabla ventas */}
          <h3 className="chart-title">1. Débito Fiscal — Ventas / Servicios</h3>
          <TablaCuadros
            head={['Tarifa', 'Docs', 'Base imponible', 'IVA débito', 'NC aplicadas']}
            rows={resultado.detalleVentas.map((d) => ({
              tarifa: d.tarifa,
              label: d.label,
              docs: d.cantidadDocumentos,
              base: d.baseImponible,
              iva: d.ivaDebitoFiscal,
              nc: d.notasCreditoAplicadas,
            }))}
            totales={[
              { label: 'Subtotal ventas', base: resultado.totales.ventasGravadasBase, iva: resultado.totales.ventasIVADebito },
              { label: 'Ventas exentas', base: resultado.totales.ventasExentas, iva: 0 },
            ]}
          />

          {/* Tabla compras */}
          <h3 className="chart-title">2. Crédito Fiscal — Compras / Gastos</h3>
          <TablaCuadros
            head={['Tarifa', 'Docs', 'Base imponible', 'IVA crédito']}
            rows={resultado.detalleCompras.map((d) => ({
              tarifa: d.tarifa,
              label: d.label,
              docs: d.cantidadDocumentos,
              base: d.baseImponible,
              iva: d.ivaCreditoFiscal,
            }))}
            totales={[
              { label: 'Subtotal compras', base: resultado.totales.comprasGravadasBase, iva: resultado.totales.comprasIVACredito },
              { label: 'Compras exentas', base: resultado.totales.comprasExentas, iva: 0 },
            ]}
          />

          {/* Prorrata + resultado */}
          <div className="glass-card" style={{ padding: '16px', marginTop: '12px' }}>
            <h3 style={{ marginTop: 0 }}>3. Prorrata de Crédito Fiscal</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
              <Item label="Ventas gravadas" valor={`₡${resultado.prorrata.ventasGravadas.toLocaleString('es-CR')}`} />
              <Item label="Ventas exentas" valor={`₡${resultado.prorrata.ventasExentas.toLocaleString('es-CR')}`} />
              <Item label="Porcentaje deducible" valor={`${resultado.prorrata.porcentajeDeducible}%`} />
              <Item label="Crédito total" valor={`₡${resultado.prorrata.creditoTotal.toLocaleString('es-CR')}`} />
              <Item label="Crédito DEDUCIBLE" valor={`₡${resultado.prorrata.creditoDeducible.toLocaleString('es-CR')}`} resaltar="verde" />
              <Item label="Crédito NO deducible" valor={`₡${resultado.prorrata.creditoNoDeducible.toLocaleString('es-CR')}`} resaltar="rojo" />
            </div>

            <h3>4. Resultado del período</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
              <Item label="Débito fiscal" valor={`₡${resultado.resultadoFinal.debitoFiscal.toLocaleString('es-CR')}`} />
              <Item label="Menos crédito deducible" valor={`-₡${resultado.resultadoFinal.creditoDeducible.toLocaleString('es-CR')}`} />
              <Item label="Menos retenciones tarjeta" valor={`-₡${resultado.resultadoFinal.totalRetencionesTarjeta.toLocaleString('es-CR')}`} />
              <Item label="Menos IVA retenido por terceros" valor={`-₡${resultado.resultadoFinal.ivaRetenidoPorTerceros.toLocaleString('es-CR')}`} />
              <Item
                label={resultado.resultadoFinal.ivaAPagar > 0 ? 'IVA A PAGAR' : 'SALDO A FAVOR'}
                valor={`₡${(resultado.resultadoFinal.ivaAPagar > 0
                  ? resultado.resultadoFinal.ivaAPagar
                  : resultado.resultadoFinal.saldoAFavor).toLocaleString('es-CR')}`}
                resaltar={resultado.resultadoFinal.ivaAPagar > 0 ? 'rojo' : 'verde'}
                grande
              />
            </div>

            <p style={{ marginTop: '16px', padding: '10px', background: 'rgba(241, 196, 15, 0.07)', borderRadius: '6px', fontSize: '0.85rem', color: '#aaa' }}>
              ⓘ Este reporte es de <strong>auditoría interna</strong>. Contrastá estos montos con el D-150
              prellenado por la OVI de TRIBU-CR antes de dar clic en "Presentar". La declaración debe
              presentarse manualmente en <code>ovitribucr.hacienda.go.cr</code>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function TablaCuadros({ head, rows, totales }) {
  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.tarifa === 0 ? 'Exento' : `Tarifa ${r.tarifa}%`}<br /><small>{r.label}</small></td>
              <td>{r.docs}</td>
              <td className="text-mono">₡{Math.round(r.base).toLocaleString('es-CR')}</td>
              <td className="text-mono">₡{Math.round(r.iva).toLocaleString('es-CR')}</td>
              {r.nc !== undefined && <td className="text-mono">{r.nc > 0 ? `₡${Math.round(r.nc).toLocaleString('es-CR')}` : '—'}</td>}
            </tr>
          ))}
          {totales.map((t, i) => (
            <tr key={`t${i}`} style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.03)' }}>
              <td>{t.label}</td>
              <td></td>
              <td className="text-mono">₡{Math.round(t.base).toLocaleString('es-CR')}</td>
              <td className="text-mono">₡{Math.round(t.iva).toLocaleString('es-CR')}</td>
              {head.length > 4 && <td></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Item({ label, valor, resaltar, grande }) {
  const cls = resaltar === 'rojo' ? 'd150-item d150-item--rojo'
    : resaltar === 'verde' ? 'd150-item d150-item--verde'
    : 'd150-item';
  return (
    <div className={cls + (grande ? ' d150-item--grande' : '')}>
      <span className="d150-label">{label}</span>
      <span className="d150-valor">{valor}</span>
    </div>
  );
}
