import { useState, useEffect, useCallback } from 'react';
import {
  Settings, TrendingUp, Receipt, Percent, Calculator, Download,
  Save, CheckCircle, XCircle, AlertTriangle, FileText, Landmark,
  Plus, Trash2, Archive, Eye, Send, RotateCcw, History
} from 'lucide-react';
import Modal from '../components/common/Modal';
import {
  obtenerConfigFiscalAPI,
  actualizarConfigFiscalAPI,
  obtenerResumenDeclaracionAPI,
  obtenerGastosDeduciblesAPI,
  obtenerIngresosDeclaracionAPI,
  exportarDatosAPI,
  actualizarDeducibilidadAPI,
  crearIngresoAPI,
  crearGastoManualAPI,
  generarDeclaracionAPI,
  listarDeclaracionesAPI,
  actualizarEstadoDeclaracionAPI,
  eliminarDeclaracionAPI,
} from '../services/api';
import './DeclaracionesPage.css';

const TABS = [
  { key: 'configuracion', label: 'Configuración Fiscal', icon: Settings },
  { key: 'ingresos', label: 'Ingresos / Ventas', icon: TrendingUp },
  { key: 'gastos', label: 'Gastos Deducibles', icon: Receipt },
  { key: 'iva', label: 'IVA (D-104)', icon: Percent },
  { key: 'renta', label: 'Renta (D-101)', icon: Calculator },
  { key: 'historial', label: 'Historial Declaraciones', icon: Archive },
  { key: 'exportar', label: 'Exportar para Contador', icon: Download },
];

const REGIMENES = ['Régimen Tradicional', 'Régimen Especial Agropecuario (REA)'];
const FRECUENCIAS_IVA = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'cuatrimestral', label: 'Cuatrimestral' },
  { value: 'anual', label: 'Anual' },
];

const CAT_INGRESO_LABEL = {
  venta_ganado_pie: 'Venta de Ganado en Pie',
  venta_leche: 'Venta de Leche',
  otros_ingresos: 'Otros Ingresos',
};

const CUATRIMESTRE_LABEL = {
  1: '1er Cuatrimestre (Ene-Abr)',
  2: '2do Cuatrimestre (May-Ago)',
  3: '3er Cuatrimestre (Sep-Dic)',
};

const ESTADO_LABEL = {
  borrador: 'Borrador',
  calculada: 'Calculada',
  presentada: 'Presentada',
};

const ESTADO_COLOR = {
  borrador: 'badge-secundario',
  calculada: 'badge-primario',
  presentada: 'badge-exito',
};

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DeclaracionesPage() {
  const [tab, setTab] = useState('configuracion');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [cuatrimestre, setCuatrimestre] = useState(Math.ceil((new Date().getMonth() + 1) / 4));
  const [cargando, setCargando] = useState(false);
  const [config, setConfig] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [gastos, setGastos] = useState({ gastos: [], resumen: {} });
  const [ingresos, setIngresos] = useState({ ingresos: [], resumen: {} });
  const [mensaje, setMensaje] = useState(null);

  // Historial
  const [declaraciones, setDeclaraciones] = useState({ declaraciones: [], total: 0 });
  const [declaracionActiva, setDeclaracionActiva] = useState(null);
  const [filtroHistorial, setFiltroHistorial] = useState({ tipo: '', anio: '' });
  const [confirmarEliminarDeclaracion, setConfirmarEliminarDeclaracion] = useState(null);

  // Formularios
  const [nuevoIngreso, setNuevoIngreso] = useState({
    fecha: new Date().toISOString().split('T')[0],
    categoriaIngreso: 'venta_ganado_pie',
    descripcion: '',
    tipoGanado: 'novillo',
    cantidadCabezas: '',
    pesoTotal: '',
    precioPorKilo: '',
    precioUnitario: '',
    litrosVendidos: '',
    industriaCompradora: '',
    detalleOtros: '',
    tasaIVA: 1,
    compradorNombre: '',
    compradorCedula: '',
    facturaNumero: '',
  });

  const [nuevoGasto, setNuevoGasto] = useState({
    fechaEmision: new Date().toISOString().split('T')[0],
    emisorNombre: '',
    descripcion: '',
    totalVenta: '',
    totalImpuesto: '',
    categoriaManual: 'insumos_agropecuarios',
    numComprobante: '',
  });

  const mostrarMensaje = useCallback((tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 4000);
  }, []);

  const cargarDatos = useCallback(async () => {
    await Promise.resolve();
    setCargando(true);
    try {
      const [cfg, res, gst, ing, dec] = await Promise.all([
        obtenerConfigFiscalAPI(),
        obtenerResumenDeclaracionAPI({ anio, cuatrimestre }),
        obtenerGastosDeduciblesAPI({ anio, cuatrimestre, limit: 200 }),
        obtenerIngresosDeclaracionAPI({ anio, cuatrimestre, limit: 200 }),
        listarDeclaracionesAPI({ anio: filtroHistorial.anio || anio, tipo: filtroHistorial.tipo, limit: 50 }),
      ]);
      setConfig(cfg.data);
      setResumen(res.data);
      setGastos(gst.data);
      setIngresos(ing.data);
      setDeclaraciones(dec.data);
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error cargando datos');
    } finally {
      setCargando(false);
    }
  }, [anio, cuatrimestre, filtroHistorial.anio, filtroHistorial.tipo, mostrarMensaje]);

  useEffect(() => {
    const run = async () => {
      await Promise.resolve();
      cargarDatos();
    };
    run();
  }, [cargarDatos]);

  const guardarConfig = async () => {
    try {
      await actualizarConfigFiscalAPI({
        actividadEconomica: config.actividadEconomica,
        regimenTributario: config.regimenTributario,
        frecuenciaIVA: config.frecuenciaIVA,
        depreciacionActivos: config.depreciacionActivos || [],
      });
      mostrarMensaje('exito', 'Configuración guardada correctamente');
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error guardando configuración');
    }
  };

  const toggleDeducibilidad = async (id, actual) => {
    try {
      await actualizarDeducibilidadAPI(id, {
        esDeducible: !actual,
        motivoNoDeducible: actual ? 'Marcado como no deducible manualmente' : '',
      });
      await cargarDatos();
      mostrarMensaje('exito', actual ? 'Gasto marcado como NO deducible' : 'Gasto marcado como deducible');
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error actualizando deducibilidad');
    }
  };

  const guardarIngreso = async () => {
    try {
      const payload = {
        fecha: nuevoIngreso.fecha,
        descripcion: nuevoIngreso.descripcion || CAT_INGRESO_LABEL[nuevoIngreso.categoriaIngreso],
        categoriaIngreso: nuevoIngreso.categoriaIngreso,
        tasaIVA: Number(nuevoIngreso.tasaIVA),
        montoSubtotal: 0,
        comprador: {
          nombre: nuevoIngreso.compradorNombre,
          cedula: nuevoIngreso.compradorCedula,
        },
        facturaElectronica: { numero: nuevoIngreso.facturaNumero },
      };

      if (nuevoIngreso.categoriaIngreso === 'venta_ganado_pie') {
        payload.tipoGanado = nuevoIngreso.tipoGanado;
        payload.cantidadCabezas = Number(nuevoIngreso.cantidadCabezas) || 0;
        payload.pesoTotal = Number(nuevoIngreso.pesoTotal) || 0;
        payload.precioPorKilo = Number(nuevoIngreso.precioPorKilo) || 0;
        payload.precioUnitario = Number(nuevoIngreso.precioUnitario) || 0;
      } else if (nuevoIngreso.categoriaIngreso === 'venta_leche') {
        payload.litrosVendidos = Number(nuevoIngreso.litrosVendidos) || 0;
        payload.precioUnitario = Number(nuevoIngreso.precioUnitario) || 0;
        payload.industriaCompradora = nuevoIngreso.industriaCompradora;
      } else {
        payload.detalleOtros = nuevoIngreso.detalleOtros;
        payload.montoSubtotal = Number(nuevoIngreso.precioUnitario) || 0;
      }

      await crearIngresoAPI(payload);
      mostrarMensaje('exito', 'Ingreso registrado');
      setNuevoIngreso({
        fecha: new Date().toISOString().split('T')[0],
        categoriaIngreso: 'venta_ganado_pie',
        descripcion: '',
        tipoGanado: 'novillo',
        cantidadCabezas: '',
        pesoTotal: '',
        precioPorKilo: '',
        precioUnitario: '',
        litrosVendidos: '',
        industriaCompradora: '',
        detalleOtros: '',
        tasaIVA: 1,
        compradorNombre: '',
        compradorCedula: '',
        facturaNumero: '',
      });
      await cargarDatos();
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error guardando ingreso');
    }
  };

  const guardarGastoManual = async () => {
    try {
      await crearGastoManualAPI({
        fechaEmision: nuevoGasto.fechaEmision,
        emisorNombre: nuevoGasto.emisorNombre,
        descripcion: nuevoGasto.descripcion,
        totalVenta: Number(nuevoGasto.totalVenta),
        totalImpuesto: Number(nuevoGasto.totalImpuesto),
        categoriaManual: nuevoGasto.categoriaManual,
        numComprobante: nuevoGasto.numComprobante,
      });
      mostrarMensaje('exito', 'Gasto registrado');
      setNuevoGasto({
        fechaEmision: new Date().toISOString().split('T')[0],
        emisorNombre: '',
        descripcion: '',
        totalVenta: '',
        totalImpuesto: '',
        categoriaManual: 'insumos_agropecuarios',
        numComprobante: '',
      });
      await cargarDatos();
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error guardando gasto');
    }
  };

  const descargarCSV = async () => {
    try {
      const res = await exportarDatosAPI({ anio, cuatrimestre, formato: 'csv' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `declaracion_${anio}_Q${cuatrimestre}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      mostrarMensaje('exito', 'Archivo descargado');
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error exportando datos');
    }
  };

  const agregarActivo = () => {
    const nuevos = [...(config.depreciacionActivos || []), {
      descripcion: '', valorOriginal: 0, vidaUtilAnios: 5, anioAdquisicion: anio, depreciacionAnual: 0, activo: true,
    }];
    setConfig({ ...config, depreciacionActivos: nuevos });
  };

  const eliminarActivo = (idx) => {
    const nuevos = [...(config.depreciacionActivos || [])];
    nuevos.splice(idx, 1);
    setConfig({ ...config, depreciacionActivos: nuevos });
  };

  const actualizarActivo = (idx, campo, valor) => {
    const nuevos = [...(config.depreciacionActivos || [])];
    nuevos[idx] = { ...nuevos[idx], [campo]: valor };
    if (campo === 'valorOriginal' || campo === 'vidaUtilAnios') {
      const vo = Number(nuevos[idx].valorOriginal) || 0;
      const vu = Number(nuevos[idx].vidaUtilAnios) || 1;
      nuevos[idx].depreciacionAnual = Math.round((vo / vu) * 100) / 100;
    }
    setConfig({ ...config, depreciacionActivos: nuevos });
  };

  // === GENERAR DECLARACIONES ===

  const generarDeclaracionIVA = async () => {
    try {
      setCargando(true);
      await generarDeclaracionAPI({ tipo: 'D-135-1', periodoFiscal: anio, cuatrimestre });
      mostrarMensaje('exito', 'Declaración IVA generada y guardada');
      await cargarDatos();
      setTab('historial');
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error generando declaración IVA');
    } finally {
      setCargando(false);
    }
  };

  const generarDeclaracionRenta = async () => {
    try {
      setCargando(true);
      await generarDeclaracionAPI({ tipo: 'D-101', periodoFiscal: anio });
      mostrarMensaje('exito', 'Declaración Renta generada y guardada');
      await cargarDatos();
      setTab('historial');
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error generando declaración Renta');
    } finally {
      setCargando(false);
    }
  };

  const presentarDeclaracion = async (id) => {
    try {
      await actualizarEstadoDeclaracionAPI(id, { estado: 'presentada' });
      mostrarMensaje('exito', 'Declaración marcada como Presentada');
      await cargarDatos();
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error actualizando estado');
    }
  };

  const revertirDeclaracion = async (id) => {
    try {
      await actualizarEstadoDeclaracionAPI(id, { estado: 'calculada' });
      mostrarMensaje('exito', 'Declaración revertida a Calculada');
      await cargarDatos();
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error actualizando estado');
    }
  };

  const borrarDeclaracion = (id) => {
    setConfirmarEliminarDeclaracion(id);
  };

  const confirmarEliminarDeclaracionAccion = async () => {
    if (!confirmarEliminarDeclaracion) return;
    try {
      await eliminarDeclaracionAPI(confirmarEliminarDeclaracion);
      mostrarMensaje('exito', 'Declaración eliminada');
      await cargarDatos();
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Error eliminando declaración');
    } finally {
      setConfirmarEliminarDeclaracion(null);
    }
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Declaraciones para Hacienda</h1>
          <p className="page-subtitle">Gestión completa de ingresos, gastos, IVA y Renta</p>
        </div>
      </div>

      {/* Mensajes */}
      {mensaje && (
        <div className={`alerta alerta-${mensaje.tipo}`}>
          {mensaje.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="declaracion-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`declaracion-tab ${tab === t.key ? 'declaracion-tab--activo' : ''}`}
            onClick={() => { setTab(t.key); setDeclaracionActiva(null); }}
          >
            <t.icon size={16} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Controles de Periodo */}
      <div className="declaracion-controls glass-card">
        <div className="form-group">
          <label>Año Fiscal</label>
          <select className="input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Cuatrimestre</label>
          <select className="input" value={cuatrimestre} onChange={(e) => setCuatrimestre(Number(e.target.value))}>
            {[1, 2, 3].map((c) => (
              <option key={c} value={c}>{CUATRIMESTRE_LABEL[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <>
          {/* === TAB: CONFIGURACIÓN FISCAL === */}
          {tab === 'configuracion' && config && (
            <div className="glass-card animate-slide-up">
              <h3><Landmark size={20} style={{ marginRight: 8 }} /> Configuración Fiscal de la Finca</h3>
              <div className="declaracion-grid-2" style={{ marginTop: 'var(--espacio-lg)' }}>
                <div className="form-group">
                  <label>Actividad Económica Registrada</label>
                  <input
                    className="input"
                    type="text"
                    value={config.actividadEconomica || ''}
                    onChange={(e) => setConfig({ ...config, actividadEconomica: e.target.value })}
                    placeholder="Ej. Cría de ganado bovino, Producción de leche"
                  />
                  <small className="form-help">Vital para justificar los gastos ante Hacienda.</small>
                </div>

                <div className="form-group">
                  <label>Régimen Tributario</label>
                  <select
                    className="input"
                    value={config.regimenTributario || 'Régimen Especial Agropecuario (REA)'}
                    onChange={(e) => setConfig({ ...config, regimenTributario: e.target.value })}
                  >
                    {REGIMENES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <small className="form-help">
                    {config.regimenTributario?.includes('REA')
                      ? 'Como REA, declara IVA cuatrimestral y disfruta tarifa 1% en canasta básica.'
                      : 'Régimen Tradicional: IVA según actividad, generalmente 13%.'}
                  </small>
                </div>

                <div className="form-group">
                  <label>Frecuencia de Declaración de IVA</label>
                  <select
                    className="input"
                    value={config.frecuenciaIVA || 'cuatrimestral'}
                    onChange={(e) => setConfig({ ...config, frecuenciaIVA: e.target.value })}
                  >
                    {FRECUENCIAS_IVA.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="divider" />

              <h4>Activos Fijos (Depreciación Anual)</h4>
              <p className="form-help">Animales reproductores de alto valor y bienes depreciables. La depreciación es deducible en Renta.</p>

              {(config.depreciacionActivos || []).map((act, idx) => (
                <div className="activo-row" key={idx}>
                  <input
                    className="input"
                    placeholder="Descripción (ej. Toro de registro)"
                    value={act.descripcion}
                    onChange={(e) => actualizarActivo(idx, 'descripcion', e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Valor original"
                    value={act.valorOriginal}
                    onChange={(e) => actualizarActivo(idx, 'valorOriginal', e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Vida útil (años)"
                    value={act.vidaUtilAnios}
                    onChange={(e) => actualizarActivo(idx, 'vidaUtilAnios', e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Año adquisición"
                    value={act.anioAdquisicion}
                    onChange={(e) => actualizarActivo(idx, 'anioAdquisicion', e.target.value)}
                  />
                  <div className="activo-depreciacion">
                    <span className="text-mono">{formatCRC(act.depreciacionAnual || 0)}/año</span>
                  </div>
                  <button className="btn-icon" onClick={() => eliminarActivo(idx)} title="Eliminar activo">
                    <Trash2 size={16} color="var(--color-error)" />
                  </button>
                </div>
              ))}

              <button className="btn-outline" onClick={agregarActivo} style={{ marginTop: 'var(--espacio-md)' }}>
                <Plus size={16} /> Agregar Activo
              </button>

              <div style={{ marginTop: 'var(--espacio-lg)' }}>
                <button className="btn-primary" onClick={guardarConfig}>
                  <Save size={16} /> Guardar Configuración
                </button>
              </div>
            </div>
          )}

          {/* === TAB: INGRESOS === */}
          {tab === 'ingresos' && (
            <div className="animate-slide-up">
              <div className="glass-card" style={{ marginBottom: 'var(--espacio-lg)' }}>
                <h3><TrendingUp size={20} style={{ marginRight: 8 }} /> Registrar Nuevo Ingreso</h3>
                <div className="declaracion-grid-3" style={{ marginTop: 'var(--espacio-md)' }}>
                  <div className="form-group">
                    <label>Fecha</label>
                    <input className="input" type="date" value={nuevoIngreso.fecha} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, fecha: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Categoría</label>
                    <select className="input" value={nuevoIngreso.categoriaIngreso} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, categoriaIngreso: e.target.value })}>
                      <option value="venta_ganado_pie">Venta de Ganado en Pie</option>
                      <option value="venta_leche">Venta de Leche</option>
                      <option value="otros_ingresos">Otros Ingresos</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tasa IVA (%)</label>
                    <select className="input" value={nuevoIngreso.tasaIVA} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, tasaIVA: e.target.value })}>
                      <option value={0}>0% (Exento)</option>
                      <option value={1}>1% (Canasta Básica)</option>
                      <option value={13}>13% (General)</option>
                    </select>
                  </div>

                  {nuevoIngreso.categoriaIngreso === 'venta_ganado_pie' && (
                    <>
                      <div className="form-group">
                        <label>Tipo de Ganado</label>
                        <select className="input" value={nuevoIngreso.tipoGanado} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, tipoGanado: e.target.value })}>
                          {['novillo', 'vaca', 'ternero', 'ternera', 'toro', 'vaquilla', 'buey', 'otro'].map((t) => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group"><label>Cantidad Cabezas</label><input className="input" type="number" min="0" value={nuevoIngreso.cantidadCabezas} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, cantidadCabezas: e.target.value })} /></div>
                      <div className="form-group"><label>Peso Total (kg)</label><input className="input" type="number" min="0" placeholder="Opcional" value={nuevoIngreso.pesoTotal} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, pesoTotal: e.target.value })} /></div>
                      <div className="form-group"><label>Precio por Kilo</label><input className="input" type="number" min="0" placeholder="Opcional" value={nuevoIngreso.precioPorKilo} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, precioPorKilo: e.target.value })} /></div>
                      <div className="form-group"><label>Precio Unitario (por cabeza)</label><input className="input" type="number" min="0" value={nuevoIngreso.precioUnitario} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, precioUnitario: e.target.value })} /></div>
                    </>
                  )}

                  {nuevoIngreso.categoriaIngreso === 'venta_leche' && (
                    <>
                      <div className="form-group"><label>Litros Vendidos</label><input className="input" type="number" min="0" value={nuevoIngreso.litrosVendidos} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, litrosVendidos: e.target.value })} /></div>
                      <div className="form-group"><label>Precio Unitario (por litro)</label><input className="input" type="number" min="0" value={nuevoIngreso.precioUnitario} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, precioUnitario: e.target.value })} /></div>
                      <div className="form-group"><label>Industria Compradora</label><input className="input" type="text" placeholder="Ej. Dos Pinos" value={nuevoIngreso.industriaCompradora} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, industriaCompradora: e.target.value })} /></div>
                    </>
                  )}

                  {nuevoIngreso.categoriaIngreso === 'otros_ingresos' && (
                    <>
                      <div className="form-group"><label>Detalle</label><input className="input" type="text" placeholder="Ej. Venta de paja" value={nuevoIngreso.detalleOtros} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, detalleOtros: e.target.value })} /></div>
                      <div className="form-group"><label>Monto Subtotal</label><input className="input" type="number" min="0" value={nuevoIngreso.precioUnitario} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, precioUnitario: e.target.value })} /></div>
                    </>
                  )}

                  <div className="form-group"><label>Comprador (Nombre)</label><input className="input" type="text" value={nuevoIngreso.compradorNombre} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, compradorNombre: e.target.value })} /></div>
                  <div className="form-group"><label>Comprador (Cédula)</label><input className="input" type="text" value={nuevoIngreso.compradorCedula} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, compradorCedula: e.target.value })} /></div>
                  <div className="form-group"><label>N° Factura Electrónica Emitida</label><input className="input" type="text" placeholder="Consecutivo o clave numérica" value={nuevoIngreso.facturaNumero} onChange={(e) => setNuevoIngreso({ ...nuevoIngreso, facturaNumero: e.target.value })} /></div>
                </div>
                <div style={{ marginTop: 'var(--espacio-md)' }}>
                  <button className="btn-primary" onClick={guardarIngreso}><Plus size={16} /> Registrar Ingreso</button>
                </div>
              </div>

              <div className="glass-card">
                <h4>Historial de Ingresos — {CUATRIMESTRE_LABEL[cuatrimestre]} {anio}</h4>
                {ingresos.resumen && (
                  <div className="resumen-mini">
                    <span>Total Ingresos: <strong>{formatCRC(ingresos.resumen.totalIngresos)}</strong></span>
                    <span>IVA Cobrado: <strong>{formatCRC(ingresos.resumen.totalIVACobrado)}</strong></span>
                  </div>
                )}
                <div className="tabla-scroll">
                  <table className="tabla tabla-compacta">
                    <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Comprador</th><th>Factura</th><th>Subtotal</th><th>IVA</th><th>Total</th></tr></thead>
                    <tbody>
                      {(ingresos.ingresos || []).map((ing) => (
                        <tr key={ing._id}>
                          <td>{new Date(ing.fecha).toLocaleDateString('es-CR')}</td>
                          <td><span className={`badge badge-${ing.categoriaIngreso === 'venta_ganado_pie' ? 'primario' : ing.categoriaIngreso === 'venta_leche' ? 'exito' : 'secundario'}`}>{CAT_INGRESO_LABEL[ing.categoriaIngreso]}</span></td>
                          <td>{ing.descripcion}</td>
                          <td>{ing.comprador?.nombre || '-'}</td>
                          <td>{ing.facturaElectronica?.numero || '-'}</td>
                          <td className="text-mono">{formatCRC(ing.montoSubtotal)}</td>
                          <td className="text-mono">{formatCRC(ing.ivaVenta)}</td>
                          <td className="text-mono">{formatCRC(ing.montoTotal)}</td>
                        </tr>
                      ))}
                      {(ingresos.ingresos || []).length === 0 && <tr><td colSpan={8} className="tabla-vacia">No hay ingresos registrados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* === TAB: GASTOS === */}
          {tab === 'gastos' && (
            <div className="animate-slide-up">
              <div className="glass-card" style={{ marginBottom: 'var(--espacio-lg)' }}>
                <h3><Receipt size={20} style={{ marginRight: 8 }} /> Registrar Gasto Manual</h3>
                <div className="declaracion-grid-3" style={{ marginTop: 'var(--espacio-md)' }}>
                  <div className="form-group"><label>Fecha</label><input className="input" type="date" value={nuevoGasto.fechaEmision} onChange={(e) => setNuevoGasto({ ...nuevoGasto, fechaEmision: e.target.value })} /></div>
                  <div className="form-group"><label>Proveedor</label><input className="input" type="text" value={nuevoGasto.emisorNombre} onChange={(e) => setNuevoGasto({ ...nuevoGasto, emisorNombre: e.target.value })} /></div>
                  <div className="form-group"><label>Categoría</label><select className="input" value={nuevoGasto.categoriaManual} onChange={(e) => setNuevoGasto({ ...nuevoGasto, categoriaManual: e.target.value })}>
                    <option value="insumos_agropecuarios">Insumos Agropecuarios</option>
                    <option value="veterinaria">Sanidad / Veterinaria</option>
                    <option value="mantenimiento">Mantenimiento de Finca</option>
                    <option value="salarios">Planillas / Peones</option>
                    <option value="servicios_publicos">Servicios Públicos</option>
                    <option value="combustible">Combustible</option>
                    <option value="maquinaria_equipo">Maquinaria y Equipo</option>
                    <option value="transporte">Transporte</option>
                    <option value="otros">Otros</option>
                  </select></div>
                  <div className="form-group"><label>Descripción</label><input className="input" type="text" placeholder="Ej. Concentrado 40kg" value={nuevoGasto.descripcion} onChange={(e) => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })} /></div>
                  <div className="form-group"><label>Subtotal</label><input className="input" type="number" min="0" value={nuevoGasto.totalVenta} onChange={(e) => setNuevoGasto({ ...nuevoGasto, totalVenta: e.target.value })} /></div>
                  <div className="form-group"><label>IVA Pagado</label><input className="input" type="number" min="0" value={nuevoGasto.totalImpuesto} onChange={(e) => setNuevoGasto({ ...nuevoGasto, totalImpuesto: e.target.value })} /></div>
                  <div className="form-group"><label>N° Comprobante</label><input className="input" type="text" placeholder="Factura electrónica de compra" value={nuevoGasto.numComprobante} onChange={(e) => setNuevoGasto({ ...nuevoGasto, numComprobante: e.target.value })} /></div>
                </div>
                <div style={{ marginTop: 'var(--espacio-md)' }}>
                  <button className="btn-primary" onClick={guardarGastoManual}><Plus size={16} /> Registrar Gasto</button>
                </div>
              </div>

              <div className="glass-card">
                <h4>Gastos del Periodo — {CUATRIMESTRE_LABEL[cuatrimestre]} {anio}</h4>
                {gastos.resumen && (
                  <div className="resumen-mini">
                    <span>Deducible: <strong className="text-success">{formatCRC(gastos.resumen.totalDeducible)}</strong></span>
                    <span>No Deducible: <strong className="text-error">{formatCRC(gastos.resumen.totalNoDeducible)}</strong></span>
                  </div>
                )}
                <div className="tabla-scroll">
                  <table className="tabla tabla-compacta">
                    <thead><tr><th>Fecha</th><th>Proveedor</th><th>Descripción</th><th>Categoría</th><th>Subtotal</th><th>IVA</th><th>Total</th><th>Comprobante</th><th>Deducible</th></tr></thead>
                    <tbody>
                      {(gastos.gastos || []).map((g) => (
                        <tr key={g._id} className={g.esDeducible ? '' : 'fila-no-deducible'}>
                          <td>{new Date(g.fecha).toLocaleDateString('es-CR')}</td>
                          <td>{g.emisor?.nombre || '-'}</td>
                          <td>{g.descripcion || '-'}</td>
                          <td><span className="badge badge-secundario">{g.categoria}</span></td>
                          <td className="text-mono">{formatCRC(g.subtotal)}</td>
                          <td className="text-mono">{formatCRC(g.iva)}</td>
                          <td className="text-mono">{formatCRC(g.total)}</td>
                          <td>{g.numComprobante || '-'}</td>
                          <td>
                            <button className={`badge badge-${g.esDeducible ? 'exito' : 'error'} btn-badge`} onClick={() => toggleDeducibilidad(g._id, g.esDeducible)} title="Cambiar deducibilidad">
                              {g.esDeducible ? <><CheckCircle size={12} /> Sí</> : <><XCircle size={12} /> No</>}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(gastos.gastos || []).length === 0 && <tr><td colSpan={9} className="tabla-vacia">No hay gastos registrados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* === TAB: IVA === */}
          {tab === 'iva' && resumen?.iva && (
            <div className="animate-slide-up">
              <div className="glass-card impuesto-resultado">
                <div className="flex-between" style={{ marginBottom: 'var(--espacio-md)' }}>
                  <h3><Percent size={20} style={{ marginRight: 8 }} /> Borrador IVA (D-104) — {CUATRIMESTRE_LABEL[cuatrimestre]} {anio}</h3>
                  <button className="btn-primary" onClick={generarDeclaracionIVA}><Archive size={16} /> Generar y Guardar Declaración</button>
                </div>

                <div className="impuesto-grid" style={{ marginTop: 'var(--espacio-lg)' }}>
                  <div className="impuesto-item"><span className="impuesto-label">IVA Cobrado (Ventas)</span><span className="impuesto-valor text-mono text-success">{formatCRC(resumen.iva.ivaCobrado)}</span></div>
                  <div className="impuesto-item"><span className="impuesto-label">IVA Pagado (Compras)</span><span className="impuesto-valor text-mono text-error">{formatCRC(resumen.iva.ivaPagado)}</span></div>
                  <div className="impuesto-item impuesto-item--resultado">
                    <span className="impuesto-label">{resumen.iva.aPagar ? 'IVA a Pagar a Hacienda' : 'Crédito Fiscal a Favor'}</span>
                    <span className={`impuesto-valor-grande text-mono ${resumen.iva.aPagar ? 'text-error' : 'text-success'}`}>{formatCRC(Math.abs(resumen.iva.ivaResultante))}</span>
                  </div>
                </div>

                {resumen.iva.detalleIVAPorTasa?.length > 0 && (
                  <div className="impuesto-detalle">
                    <h4>Desglose por Tasa de IVA</h4>
                    <table className="tabla">
                      <thead><tr><th>Tasa</th><th>Base Pagada (Compras)</th><th>IVA Pagado</th><th>Base Cobrada (Ventas)</th><th>IVA Cobrado</th></tr></thead>
                      <tbody>
                        {resumen.iva.detalleIVAPorTasa.map((d, i) => (
                          <tr key={i}><td>{d.tasa}%</td><td className="text-mono">{formatCRC(d.basePagada)}</td><td className="text-mono">{formatCRC(d.ivaPagado)}</td><td className="text-mono">{formatCRC(d.baseCobrada)}</td><td className="text-mono">{formatCRC(d.ivaCobrado)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === TAB: RENTA === */}
          {tab === 'renta' && resumen?.renta && (
            <div className="animate-slide-up">
              <div className="glass-card impuesto-resultado">
                <div className="flex-between" style={{ marginBottom: 'var(--espacio-md)' }}>
                  <h3><Calculator size={20} style={{ marginRight: 8 }} /> Borrador Renta (D-101) — Año {anio}</h3>
                  <button className="btn-primary" onClick={generarDeclaracionRenta}><Archive size={16} /> Generar y Guardar Declaración</button>
                </div>

                <div className="impuesto-grid" style={{ marginTop: 'var(--espacio-lg)' }}>
                  <div className="impuesto-item"><span className="impuesto-label">Ingresos Brutos</span><span className="impuesto-valor text-mono">{formatCRC(resumen.renta.ingresosBrutos)}</span></div>
                  <div className="impuesto-item"><span className="impuesto-label">Gastos Brutos</span><span className="impuesto-valor text-mono text-error">{formatCRC(resumen.renta.gastosBrutos)}</span></div>
                  <div className="impuesto-item"><span className="impuesto-label">Gastos Deducibles</span><span className="impuesto-valor text-mono text-success">{formatCRC(resumen.renta.gastosDeducibles)}</span></div>
                  <div className="impuesto-item"><span className="impuesto-label">Utilidad Neta</span><span className="impuesto-valor text-mono" style={{ fontWeight: 700 }}>{formatCRC(resumen.renta.utilidadNeta)}</span></div>
                  <div className="impuesto-item"><span className="impuesto-label">Monto Exento</span><span className="impuesto-valor text-mono">{formatCRC(resumen.renta.montoExento)}</span></div>
                  {resumen.renta.depreciacionTotal > 0 && (
                    <div className="impuesto-item"><span className="impuesto-label">Depreciación Activos</span><span className="impuesto-valor text-mono">{formatCRC(resumen.renta.depreciacionTotal)}</span></div>
                  )}
                </div>

                {resumen.renta.detalleTramos?.length > 0 && (
                  <div className="impuesto-detalle">
                    <h4>Cálculo por Tramos</h4>
                    <table className="tabla">
                      <thead><tr><th>Desde</th><th>Hasta</th><th>Tasa</th><th>Impuesto</th></tr></thead>
                      <tbody>
                        {resumen.renta.detalleTramos.map((t, i) => (
                          <tr key={i}><td className="text-mono">{formatCRC(t.desde)}</td><td className="text-mono">{formatCRC(t.hasta)}</td><td>{t.tasa}%</td><td className="text-mono">{formatCRC(t.impuesto)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="impuesto-grid" style={{ marginTop: 'var(--espacio-lg)' }}>
                  <div className="impuesto-item"><span className="impuesto-label">Créditos Fiscales</span><span className="impuesto-valor text-mono">{formatCRC(resumen.renta.creditosFiscales?.total)}</span></div>
                  <div className="impuesto-item impuesto-item--resultado">
                    <span className="impuesto-label">Impuesto Final a Pagar</span>
                    <span className={`impuesto-valor-grande text-mono ${resumen.renta.impuestoFinal > 0 ? 'text-error' : 'text-success'}`}>{formatCRC(resumen.renta.impuestoFinal)}</span>
                    {resumen.renta.impuestoFinal === 0 && <span className="badge badge-exito">Exento</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === TAB: HISTORIAL === */}
          {tab === 'historial' && (
            <div className="animate-slide-up">
              <div className="glass-card" style={{ marginBottom: 'var(--espacio-lg)' }}>
                <div className="flex-between">
                  <h3><History size={20} style={{ marginRight: 8 }} /> Historial de Declaraciones Guardadas</h3>
                  <div className="flex-row" style={{ gap: 'var(--espacio-sm)' }}>
                    <select className="input" value={filtroHistorial.tipo} onChange={(e) => setFiltroHistorial({ ...filtroHistorial, tipo: e.target.value })}>
                      <option value="">Todos los tipos</option>
                      <option value="D-135-1">IVA (D-135-1)</option>
                      <option value="D-101">Renta (D-101)</option>
                    </select>
                    <select className="input" value={filtroHistorial.anio} onChange={(e) => setFiltroHistorial({ ...filtroHistorial, anio: e.target.value })}>
                      <option value="">Todos los años</option>
                      {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div className="tabla-scroll" style={{ marginTop: 'var(--espacio-md)' }}>
                  <table className="tabla tabla-compacta">
                    <thead>
                      <tr><th>Tipo</th><th>Periodo</th><th>Estado</th><th>Monto Principal</th><th>Impuesto</th><th>Fecha Creación</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {(declaraciones.declaraciones || []).map((d) => (
                        <tr key={d._id} className={declaracionActiva?._id === d._id ? 'fila-activa' : ''}>
                          <td><span className={`badge badge-${d.tipo === 'D-135-1' ? 'primario' : 'exito'}`}>{d.tipo}</span></td>
                          <td>{d.periodoFiscal}{d.cuatrimestre ? ` Q${d.cuatrimestre}` : ''}</td>
                          <td><span className={`badge ${ESTADO_COLOR[d.estado] || 'badge-secundario'}`}>{ESTADO_LABEL[d.estado]}</span></td>
                          <td className="text-mono">
                            {d.tipo === 'D-135-1' ? formatCRC(Math.abs(d.ivaResultante)) : formatCRC(d.utilidadNeta)}
                          </td>
                          <td className="text-mono">
                            {d.tipo === 'D-135-1' ? (d.ivaResultante > 0 ? 'A pagar' : 'Crédito') : formatCRC(d.impuestoFinal)}
                          </td>
                          <td>{new Date(d.createdAt).toLocaleDateString('es-CR')}</td>
                          <td>
                            <div className="acciones-row">
                              <button className="btn-icon" title="Ver detalle" onClick={() => setDeclaracionActiva(d)}><Eye size={16} /></button>
                              {d.estado !== 'presentada' && (
                                <button className="btn-icon" title="Marcar como Presentada" onClick={() => presentarDeclaracion(d._id)}><Send size={16} color="var(--color-exito)" /></button>
                              )}
                              {d.estado === 'presentada' && (
                                <button className="btn-icon" title="Revertir a Calculada" onClick={() => revertirDeclaracion(d._id)}><RotateCcw size={16} color="var(--color-primario-claro)" /></button>
                              )}
                              <button className="btn-icon" title="Eliminar" onClick={() => borrarDeclaracion(d._id)}><Trash2 size={16} color="var(--color-error)" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(declaraciones.declaraciones || []).length === 0 && (
                        <tr><td colSpan={7} className="tabla-vacia">No hay declaraciones guardadas. Genere una desde las pestañas IVA o Renta.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detalle de declaración seleccionada */}
              {declaracionActiva && (
                <div className="glass-card impuesto-resultado animate-slide-up">
                  <div className="flex-between">
                    <h4>Detalle de la Declaración — {declaracionActiva.tipo} {declaracionActiva.periodoFiscal}{declaracionActiva.cuatrimestre ? ` Q${declaracionActiva.cuatrimestre}` : ''}</h4>
                    <button className="btn-icon" onClick={() => setDeclaracionActiva(null)} title="Cerrar"><XCircle size={18} /></button>
                  </div>

                  {declaracionActiva.tipo === 'D-135-1' && (
                    <>
                      <div className="impuesto-grid" style={{ marginTop: 'var(--espacio-md)' }}>
                        <div className="impuesto-item"><span className="impuesto-label">IVA Cobrado</span><span className="impuesto-valor text-mono text-success">{formatCRC(declaracionActiva.ivaCobrado)}</span></div>
                        <div className="impuesto-item"><span className="impuesto-label">IVA Pagado</span><span className="impuesto-valor text-mono text-error">{formatCRC(declaracionActiva.ivaPagado)}</span></div>
                        <div className="impuesto-item impuesto-item--resultado">
                          <span className="impuesto-label">{declaracionActiva.ivaResultante > 0 ? 'A Pagar' : 'Crédito Fiscal'}</span>
                          <span className={`impuesto-valor-grande text-mono ${declaracionActiva.ivaResultante > 0 ? 'text-error' : 'text-success'}`}>{formatCRC(Math.abs(declaracionActiva.ivaResultante))}</span>
                        </div>
                      </div>
                      {declaracionActiva.detalleIVAPorTasa?.length > 0 && (
                        <div className="impuesto-detalle">
                          <h5>Desglose por Tasa</h5>
                          <table className="tabla">
                            <thead><tr><th>Tasa</th><th>Base Pagada</th><th>IVA Pagado</th><th>Base Cobrada</th><th>IVA Cobrado</th></tr></thead>
                            <tbody>
                              {declaracionActiva.detalleIVAPorTasa.map((det, i) => (
                                <tr key={i}><td>{det.tasa}%</td><td className="text-mono">{formatCRC(det.basePagada)}</td><td className="text-mono">{formatCRC(det.ivaPagado)}</td><td className="text-mono">{formatCRC(det.baseCobrada)}</td><td className="text-mono">{formatCRC(det.ivaCobrado)}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {declaracionActiva.tipo === 'D-101' && (
                    <>
                      <div className="impuesto-grid" style={{ marginTop: 'var(--espacio-md)' }}>
                        <div className="impuesto-item"><span className="impuesto-label">Ingresos Brutos</span><span className="impuesto-valor text-mono">{formatCRC(declaracionActiva.ingresosBrutos)}</span></div>
                        <div className="impuesto-item"><span className="impuesto-label">Gastos Deducibles</span><span className="impuesto-valor text-mono text-success">{formatCRC(declaracionActiva.gastosDeducibles)}</span></div>
                        <div className="impuesto-item"><span className="impuesto-label">Utilidad Neta</span><span className="impuesto-valor text-mono" style={{ fontWeight: 700 }}>{formatCRC(declaracionActiva.utilidadNeta)}</span></div>
                        <div className="impuesto-item"><span className="impuesto-label">Monto Exento</span><span className="impuesto-valor text-mono">{formatCRC(declaracionActiva.montoExento)}</span></div>
                        <div className="impuesto-item"><span className="impuesto-label">Impuesto Final</span><span className={`impuesto-valor-grande text-mono ${declaracionActiva.impuestoFinal > 0 ? 'text-error' : 'text-success'}`}>{formatCRC(declaracionActiva.impuestoFinal)}</span></div>
                      </div>
                      {declaracionActiva.detalleTramos?.length > 0 && (
                        <div className="impuesto-detalle">
                          <h5>Cálculo por Tramos</h5>
                          <table className="tabla">
                            <thead><tr><th>Desde</th><th>Hasta</th><th>Tasa</th><th>Impuesto</th></tr></thead>
                            <tbody>
                              {declaracionActiva.detalleTramos.map((t, i) => (
                                <tr key={i}><td className="text-mono">{formatCRC(t.desde)}</td><td className="text-mono">{formatCRC(t.hasta)}</td><td>{t.tasa}%</td><td className="text-mono">{formatCRC(t.impuesto)}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === TAB: EXPORTAR === */}
          {tab === 'exportar' && (
            <div className="glass-card animate-slide-up">
              <h3><Download size={20} style={{ marginRight: 8 }} /> Exportar para el Contador</h3>
              <p className="page-subtitle" style={{ marginTop: 4 }}>
                Genera un archivo CSV con todos los ingresos y gastos del periodo, listo para subir a Excel o sistemas contables.
              </p>

              <div className="exportar-resumen">
                <div className="exportar-metrica"><span className="exportar-label">Facturas registradas</span><span className="exportar-valor">{gastos.total || 0}</span></div>
                <div className="exportar-metrica"><span className="exportar-label">Ingresos registrados</span><span className="exportar-valor">{ingresos.total || 0}</span></div>
                <div className="exportar-metrica"><span className="exportar-label">Periodo</span><span className="exportar-valor">{anio} — {CUATRIMESTRE_LABEL[cuatrimestre]}</span></div>
              </div>

              <div className="exportar-preview">
                <h4>Vista previa de columnas</h4>
                <div className="exportar-columns">
                  {['Tipo', 'Fecha', 'Proveedor/Comprador', 'Cédula', 'Descripción', 'Categoría', 'Subtotal', 'IVA', 'Total', 'N° Comprobante', 'Es Deducible', 'Tasa IVA'].map((c) => (
                    <span className="badge badge-secundario" key={c}>{c}</span>
                  ))}
                </div>
              </div>

              <button className="btn-primary btn-large" onClick={descargarCSV}>
                <FileText size={18} /> Descargar CSV para Excel
              </button>
            </div>
          )}
        </>
      )}

      {confirmarEliminarDeclaracion && (
        <Modal
          isOpen
          onClose={() => setConfirmarEliminarDeclaracion(null)}
          title="Confirmar Eliminación"
          size="sm"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertTriangle size={28} style={{ color: 'var(--color-advertencia)' }} />
            <span>¿Eliminar esta declaración? Esta acción no se puede deshacer.</span>
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setConfirmarEliminarDeclaracion(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={confirmarEliminarDeclaracionAccion}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
