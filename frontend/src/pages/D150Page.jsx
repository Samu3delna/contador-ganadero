import { useState } from 'react';
import {
  FileDown,
  FileSpreadsheet,
  Calculator,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
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

  // Wizard TRIBU-CR (1: Ventas generales, 2: Compras totales, 3: Crédito fiscal, 4: Cálculo impuesto, 5: Auditoría)
  const [pasoActivo, setPasoActivo] = useState(2);
  const [acordeonesAbiertos, setAcordeonesAbiertos] = useState({
    'c-13': true,
    'c-1': true,
    'c-0': true,
    'v-13': true,
    'v-1': true,
  });
  const [campoCopiado, setCampoCopiado] = useState(null);

  const toggleAcordeon = (id) => {
    setAcordeonesAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copiarAlPortapapeles = (valorNumerico, label) => {
    const limpio = Math.round(Number(valorNumerico || 0));
    navigator.clipboard.writeText(String(limpio));
    setCampoCopiado(label);
    toast.success(`Copiado: ₡${limpio.toLocaleString('es-CR')} (${label})`);
    setTimeout(() => setCampoCopiado(null), 2000);
  };

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
          <h1 className="page-title">Conciliación D-150 IVA — Guía Oficial TRIBU-CR</h1>
          <p className="page-subtitle">
            Calcula el IVA cobrado / soportado del mes exactamente con la estructura de pasos y casillas del formulario TRIBU-CR de Hacienda.
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div className="filtros-row">
          <div className="form-group form-group--md">
            <label>Mes</label>
            <select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group form-group--sm">
            <label>Año</label>
            <input className="input" type="number" min="2024" max="2099" value={anio}
              onChange={(e) => setAnio(Number(e.target.value))} />
          </div>
          <div className="form-group form-group--auto">
            <label>Retenciones tarjeta (separadas por coma)</label>
            <input className="input" type="text" value={retencionesTexto}
              placeholder="ej: 12000, 8500, 4300"
              onChange={(e) => setRetencionesTexto(e.target.value)} />
          </div>
          <div className="form-group form-group--md">
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
          <p className="text-muted">Seleccioná mes y año, y presioná "Calcular" para generar la conciliación y guía TRIBU-CR.</p>
        </div>
      ) : (
        <div className="tribu-container">
          {/* Tarjetas KPI Superiores */}
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

          {/* Botones de Descarga */}
          <div className="btn-group" style={{ margin: '4px 0' }}>
            <button className="btn btn-secondary" onClick={() => descargar('excel')} disabled={!!descargando}>
              <FileSpreadsheet size={16} /> {descargando === 'excel' ? 'Generando...' : 'Exportar Excel (Guía TRIBU-CR + Detalle)'}
            </button>
            <button className="btn btn-secondary" onClick={() => descargar('pdf')} disabled={!!descargando}>
              <FileDown size={16} /> {descargando === 'pdf' ? 'Generando...' : 'Exportar PDF'}
            </button>
          </div>

          {/* Wizard Stepper oficial TRIBU-CR */}
          <div className="tribu-stepper">
            <button
              type="button"
              className={`tribu-step-btn ${pasoActivo === 1 ? 'tribu-step-btn--active' : ''}`}
              onClick={() => setPasoActivo(1)}
            >
              <span className="tribu-step-dot">1</span>
              <span>Ventas generales</span>
            </button>
            <div className="tribu-step-line" />

            <button
              type="button"
              className={`tribu-step-btn ${pasoActivo === 2 ? 'tribu-step-btn--active' : ''}`}
              onClick={() => setPasoActivo(2)}
            >
              <span className="tribu-step-dot">2</span>
              <span>Compras totales</span>
            </button>
            <div className="tribu-step-line" />

            <button
              type="button"
              className={`tribu-step-btn ${pasoActivo === 3 ? 'tribu-step-btn--active' : ''}`}
              onClick={() => setPasoActivo(3)}
            >
              <span className="tribu-step-dot">3</span>
              <span>Crédito fiscal</span>
            </button>
            <div className="tribu-step-line" />

            <button
              type="button"
              className={`tribu-step-btn ${pasoActivo === 4 ? 'tribu-step-btn--active' : ''}`}
              onClick={() => setPasoActivo(4)}
            >
              <span className="tribu-step-dot">4</span>
              <span>Cálculo del impuesto</span>
            </button>
            <div className="tribu-step-line" />

            <button
              type="button"
              className={`tribu-step-btn ${pasoActivo === 5 ? 'tribu-step-btn--active' : ''}`}
              onClick={() => setPasoActivo(5)}
            >
              <span>📊 Auditoría Tabular</span>
            </button>
          </div>

          {/* PASO 1: VENTAS GENERALES */}
          {pasoActivo === 1 && (
            <div className="tribu-section">
              <div className="tribu-helper-banner">
                <strong>Paso 1 — Ventas generales:</strong> En esta sección debe introducir las ventas y prestaciones de servicios realizadas en este período a cada tarifa. El formulario calcula de forma automática el impuesto devengado para cada una de ellas.
              </div>

              <div className="tribu-accordion-list" style={{ marginTop: '1rem' }}>
                {resultado.detalleVentas.map((v) => {
                  const key = `v-${v.tarifa}`;
                  const isOpen = !!acordeonesAbiertos[key];
                  const labelTarifa = v.tarifa === 0 ? 'Ventas exentas / no sujetas (0%)' : `Ventas a ${v.tarifa}%`;
                  return (
                    <div key={key} className="tribu-accordion-card">
                      <button
                        type="button"
                        className="tribu-accordion-header"
                        onClick={() => toggleAcordeon(key)}
                      >
                        <div className="tribu-header-info">
                          <span>{labelTarifa}</span>
                          <span className="tribu-badge-docs">{v.cantidadDocumentos} comprobantes</span>
                          {v.baseImponible > 0 && (
                            <span className="tribu-badge-monto">₡{Math.round(v.baseImponible).toLocaleString('es-CR')}</span>
                          )}
                        </div>
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>

                      {isOpen && (
                        <div className="tribu-accordion-body">
                          <div className="tribu-input-card">
                            <span className="tribu-input-label">{v.campoImporte || `Total importe ventas a ${v.tarifa}%`}</span>
                            <div className="tribu-input-value-row">
                              <span className="tribu-input-value">₡{Math.round(v.baseImponible).toLocaleString('es-CR')}</span>
                              <button
                                type="button"
                                className={`tribu-btn-copy ${campoCopiado === `Venta ${v.tarifa}%` ? 'tribu-btn-copy--copied' : ''}`}
                                onClick={() => copiarAlPortapapeles(v.baseImponible, `Venta ${v.tarifa}%`)}
                              >
                                {campoCopiado === `Venta ${v.tarifa}%` ? <Check size={14} /> : <Copy size={14} />}
                                Copiar
                              </button>
                            </div>
                          </div>

                          <div className="tribu-input-card">
                            <span className="tribu-input-label">{v.campoImpuesto || `Impuesto devengado a ${v.tarifa}%`}</span>
                            <div className="tribu-input-value-row">
                              <span className="tribu-input-value">₡{Math.round(v.ivaDebitoFiscal).toLocaleString('es-CR')}</span>
                              <button
                                type="button"
                                className={`tribu-btn-copy ${campoCopiado === `IVA Venta ${v.tarifa}%` ? 'tribu-btn-copy--copied' : ''}`}
                                onClick={() => copiarAlPortapapeles(v.ivaDebitoFiscal, `IVA Venta ${v.tarifa}%`)}
                              >
                                {campoCopiado === `IVA Venta ${v.tarifa}%` ? <Check size={14} /> : <Copy size={14} />}
                                Copiar
                              </button>
                            </div>
                          </div>

                          {v.notasCreditoAplicadas > 0 && (
                            <div className="tribu-input-card" style={{ gridColumn: '1 / -1' }}>
                              <span className="tribu-input-label">Notas de crédito aplicadas</span>
                              <div className="tribu-input-value-row">
                                <span className="tribu-input-value" style={{ color: 'var(--color-advertencia)' }}>
                                  -₡{Math.round(v.notasCreditoAplicadas).toLocaleString('es-CR')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setPasoActivo(2)}>
                  Ir a Compras totales (Paso 2) →
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: COMPRAS TOTALES (Idéntico al Screenshot de TRIBU-CR) */}
          {pasoActivo === 2 && (
            <div className="tribu-section">
              <div className="tribu-helper-banner">
                <strong>Compras totales:</strong> En esta sección debe introducir las compras realizadas en este periodo a cada tarifa. El formulario calcula de forma automática el impuesto soportado para cada una de ellas.
              </div>

              <div className="tribu-accordion-list" style={{ marginTop: '1rem' }}>
                {resultado.detalleCompras.map((c) => {
                  const key = `c-${c.tarifa}`;
                  const isOpen = !!acordeonesAbiertos[key];
                  const labelTarifa = c.tarifa === 0
                    ? 'Compras sin IVA soportado o no acreditable'
                    : `Compras a ${c.tarifa}%`;

                  return (
                    <div key={key} className="tribu-accordion-card">
                      <button
                        type="button"
                        className="tribu-accordion-header"
                        onClick={() => toggleAcordeon(key)}
                      >
                        <div className="tribu-header-info">
                          <span>{labelTarifa}</span>
                          <span className="tribu-badge-docs">{c.cantidadDocumentos} comprobantes</span>
                          {c.baseImponible > 0 && (
                            <span className="tribu-badge-monto">₡{Math.round(c.baseImponible).toLocaleString('es-CR')}</span>
                          )}
                        </div>
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>

                      {isOpen && (
                        <div className="tribu-accordion-body">
                          <div className="tribu-input-card">
                            <span className="tribu-input-label">
                              {c.tarifa === 0
                                ? 'Total compras sin IVA soportado o no acreditable'
                                : `Total importe compras a ${c.tarifa}%`}
                            </span>
                            <div className="tribu-input-value-row">
                              <span className="tribu-input-value">₡{Math.round(c.baseImponible).toLocaleString('es-CR')}</span>
                              <button
                                type="button"
                                className={`tribu-btn-copy ${campoCopiado === `Compra ${c.tarifa}%` ? 'tribu-btn-copy--copied' : ''}`}
                                onClick={() => copiarAlPortapapeles(c.baseImponible, `Compra ${c.tarifa}%`)}
                              >
                                {campoCopiado === `Compra ${c.tarifa}%` ? <Check size={14} /> : <Copy size={14} />}
                                Copiar
                              </button>
                            </div>
                          </div>

                          <div className="tribu-input-card">
                            <span className="tribu-input-label">
                              {c.tarifa === 0
                                ? 'Impuesto soportado (no acreditable)'
                                : `Impuesto soportado a ${c.tarifa}%`}
                            </span>
                            <div className="tribu-input-value-row">
                              <span className="tribu-input-value">₡{Math.round(c.ivaCreditoFiscal).toLocaleString('es-CR')}</span>
                              {c.tarifa > 0 && (
                                <button
                                  type="button"
                                  className={`tribu-btn-copy ${campoCopiado === `IVA Compra ${c.tarifa}%` ? 'tribu-btn-copy--copied' : ''}`}
                                  onClick={() => copiarAlPortapapeles(c.ivaCreditoFiscal, `IVA Compra ${c.tarifa}%`)}
                                >
                                  {campoCopiado === `IVA Compra ${c.tarifa}%` ? <Check size={14} /> : <Copy size={14} />}
                                  Copiar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => setPasoActivo(1)}>
                  ← Regresar a Ventas generales
                </button>
                <button className="btn btn-primary" onClick={() => setPasoActivo(3)}>
                  Ir a Crédito fiscal (Paso 3) →
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: CRÉDITO FISCAL (PRORRATA) */}
          {pasoActivo === 3 && (
            <div className="tribu-section">
              <div className="tribu-helper-banner">
                <strong>Paso 3 — Crédito fiscal:</strong> Cálculo de la regla de proporcionalidad o prorrata del crédito fiscal de acuerdo a los artículos 30 al 34 de la Ley del IVA.
              </div>

              <div className="glass-card" style={{ padding: '16px', marginTop: '1rem' }}>
                <div className="d150-grid">
                  <Item label="Ventas gravadas (con derecho a crédito)" valor={`₡${resultado.prorrata.ventasGravadas.toLocaleString('es-CR')}`} />
                  <Item label="Ventas exentas (sin derecho pleno)" valor={`₡${resultado.prorrata.ventasExentas.toLocaleString('es-CR')}`} />
                  <Item label="Porcentaje de crédito deducible (%)" valor={`${resultado.prorrata.porcentajeDeducible}%`} />
                  <Item label="Crédito total soportado" valor={`₡${resultado.prorrata.creditoTotal.toLocaleString('es-CR')}`} />
                  <Item label="Crédito DEDUCIBLE a aplicar" valor={`₡${resultado.prorrata.creditoDeducible.toLocaleString('es-CR')}`} resaltar="verde" />
                  <Item label="Crédito NO deducible (pasa al gasto)" valor={`₡${resultado.prorrata.creditoNoDeducible.toLocaleString('es-CR')}`} resaltar="rojo" />
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => setPasoActivo(2)}>
                  ← Regresar a Compras totales
                </button>
                <button className="btn btn-primary" onClick={() => setPasoActivo(4)}>
                  Ir a Cálculo del impuesto (Paso 4) →
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: CÁLCULO DEL IMPUESTO (LIQUIDACIÓN FINAL) */}
          {pasoActivo === 4 && (
            <div className="tribu-section">
              <div className="tribu-helper-banner">
                <strong>Paso 4 — Cálculo del impuesto:</strong> Liquidación final y determinación de la obligación tributaria neta ante el Ministerio de Hacienda.
              </div>

              <div className="glass-card" style={{ padding: '16px', marginTop: '1rem' }}>
                <div className="d150-grid">
                  <Item label="Débito fiscal (Paso 1)" valor={`₡${resultado.resultadoFinal.debitoFiscal.toLocaleString('es-CR')}`} />
                  <Item label="Menos: Crédito deducible (Paso 3)" valor={`-₡${resultado.resultadoFinal.creditoDeducible.toLocaleString('es-CR')}`} />
                  <Item label="Menos: Retenciones tarjeta del período" valor={`-₡${resultado.resultadoFinal.totalRetencionesTarjeta.toLocaleString('es-CR')}`} />
                  <Item label="Menos: IVA retenido por terceros" valor={`-₡${resultado.resultadoFinal.ivaRetenidoPorTerceros.toLocaleString('es-CR')}`} />
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <div className={`d150-item d150-item--grande ${resultado.resultadoFinal.ivaAPagar > 0 ? 'd150-item--rojo' : 'd150-item--verde'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span className="d150-label" style={{ fontSize: '0.95rem' }}>
                        {resultado.resultadoFinal.ivaAPagar > 0 ? 'TOTAL IVA A PAGAR (HACIENDA)' : 'SALDO A FAVOR DEL CONTRIBUYENTE'}
                      </span>
                      <button
                        type="button"
                        className="tribu-btn-copy"
                        onClick={() => copiarAlPortapapeles(
                          resultado.resultadoFinal.ivaAPagar > 0 ? resultado.resultadoFinal.ivaAPagar : resultado.resultadoFinal.saldoAFavor,
                          resultado.resultadoFinal.ivaAPagar > 0 ? 'IVA a pagar' : 'Saldo a favor'
                        )}
                      >
                        <Copy size={14} /> Copiar monto final
                      </button>
                    </div>
                    <span className="d150-valor" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
                      ₡{(resultado.resultadoFinal.ivaAPagar > 0
                        ? resultado.resultadoFinal.ivaAPagar
                        : resultado.resultadoFinal.saldoAFavor).toLocaleString('es-CR')}
                    </span>
                  </div>
                </div>

                <p style={{ marginTop: '16px', padding: '10px', background: 'rgba(241, 196, 15, 0.07)', borderRadius: '6px', fontSize: '0.85rem', color: '#aaa' }}>
                  ⓘ Este reporte es de <strong>auditoría interna</strong>. Contrastá estos montos con el D-150
                  prellenado por la OVI de TRIBU-CR antes de dar clic en "Presentar". La declaración debe
                  presentarse manualmente en <code>ovitribucr.hacienda.go.cr</code>.
                </p>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => setPasoActivo(3)}>
                  ← Regresar a Crédito fiscal
                </button>
                <button className="btn btn-secondary" onClick={() => setPasoActivo(5)}>
                  Ver Auditoría Tabular Completa
                </button>
              </div>
            </div>
          )}

          {/* VISTA 5: AUDITORÍA TABULAR COMPLETA */}
          {pasoActivo === 5 && (
            <div className="tribu-section">
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

              <h3 className="chart-title" style={{ marginTop: '1.5rem' }}>2. Crédito Fiscal — Compras / Gastos</h3>
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
                  { label: 'Compras exentas / no acreditables', base: resultado.totales.comprasExentas, iva: 0 },
                ]}
              />

              <div style={{ marginTop: '1.25rem' }}>
                <button className="btn btn-secondary" onClick={() => setPasoActivo(2)}>
                  ← Volver a Compras totales (Paso a Paso TRIBU-CR)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TablaCuadros({ head, rows, totales }) {
  return (
    <div className="table-responsive">
      <table className="data-table tabla--stack">
        <thead>
          <tr>
            {head.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td data-label={head[0]}>{r.tarifa === 0 ? 'Exento' : `Tarifa ${r.tarifa}%`}<br /><small>{r.label}</small></td>
              <td data-label={head[1]}>{r.docs}</td>
              <td className="text-mono" data-label={head[2]}>₡{Math.round(r.base).toLocaleString('es-CR')}</td>
              <td className="text-mono" data-label={head[3]}>₡{Math.round(r.iva).toLocaleString('es-CR')}</td>
              {r.nc !== undefined && (
                <td className="text-mono" data-label={head[4]}>
                  {r.nc > 0 ? `₡${Math.round(r.nc).toLocaleString('es-CR')}` : '—'}
                </td>
              )}
            </tr>
          ))}
          {totales.map((t, i) => (
            <tr key={`t${i}`} className="fila-total">
              <td data-label={head[0]}>{t.label}</td>
              <td data-label={head[1]}></td>
              <td className="text-mono" data-label={head[2]}>₡{Math.round(t.base).toLocaleString('es-CR')}</td>
              <td className="text-mono" data-label={head[3]}>₡{Math.round(t.iva).toLocaleString('es-CR')}</td>
              {head.length > 4 && <td data-label={head[4]}></td>}
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
