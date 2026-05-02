import { useState, useEffect } from 'react';
import api from '../services/api';
import { CreditCard, Save } from 'lucide-react';
import './GastosPage.css';

export default function GastosPage() {
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const categoriasManuales = [
    { value: 'veterinaria', label: 'Veterinaria' },
    { value: 'alimentacion_animal', label: 'Alimentación Animal' },
    { value: 'maquinaria_equipo', label: 'Maquinaria y Equipo' },
    { value: 'transporte', label: 'Transporte' },
    { value: 'servicios_profesionales', label: 'Servicios Profesionales' },
    { value: 'combustible', label: 'Combustible' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
    { value: 'seguros', label: 'Seguros' },
    { value: 'insumos_agropecuarios', label: 'Insumos Agropecuarios' },
    { value: 'salarios', label: 'Salarios' },
    { value: 'servicios_publicos', label: 'Servicios Públicos' },
    { value: 'otros', label: 'Otros' }
  ];

  const [form, setForm] = useState({
    fechaEmision: new Date().toISOString().split('T')[0],
    emisorNombre: '',
    descripcion: '',
    categoriaManual: 'otros',
    totalVenta: '',
    totalImpuesto: ''
  });

  useEffect(() => {
    cargarGastosManuales();
  }, []);

  const cargarGastosManuales = async () => {
    setCargando(true);
    try {
      // Obtenemos solo facturas donde la claveNumerica no existe (son las manuales)
      const res = await api.get('/facturas');
      const manuales = res.data.facturas.filter(f => !f.claveNumerica);
      setGastos(manuales);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setExito('');
    try {
      await api.post('/facturas/manual', form);
      setExito('Gasto manual registrado exitosamente');
      setForm({
        ...form,
        emisorNombre: '',
        descripcion: '',
        totalVenta: '',
        totalImpuesto: ''
      });
      cargarGastosManuales();
      
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar gasto');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gastos Manuales</h1>
          <p className="page-subtitle">Registra gastos que no tienen factura electrónica (XML)</p>
        </div>
      </div>

      <div className="gastos-layout">
        <div className="card form-card">
          <div className="card-header">
            <h2 className="card-title">
              <CreditCard size={20} color="var(--color-primario)" />
              Nuevo Gasto Manual
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="gasto-form">
            <div className="form-group">
              <label className="form-label">Fecha del Gasto</label>
              <input type="date" className="input" name="fechaEmision" value={form.fechaEmision} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Proveedor / Comercio</label>
              <input type="text" className="input" name="emisorNombre" placeholder="Ej. Ferretería El Pueblo" value={form.emisorNombre} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Descripción</label>
              <input type="text" className="input" name="descripcion" placeholder="Ej. Compra de alambre" value={form.descripcion} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="select" name="categoriaManual" value={form.categoriaManual} onChange={handleChange} required>
                {categoriasManuales.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Monto sin IVA (₡)</label>
                <input type="number" className="input" name="totalVenta" min="0" value={form.totalVenta} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">IVA Pagado (₡)</label>
                <input type="number" className="input" name="totalImpuesto" min="0" value={form.totalImpuesto} onChange={handleChange} />
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {exito && <div className="alert alert-success">{exito}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={guardando}>
              <Save size={18} />
              {guardando ? 'Guardando...' : 'Registrar Gasto'}
            </button>
          </form>
        </div>

        <div className="card historial-card">
          <div className="card-header">
            <h2 className="card-title">Historial de Gastos Manuales</h2>
          </div>
          
          <div className="historial-lista">
            {cargando ? (
              <p className="text-muted">Cargando...</p>
            ) : gastos.length === 0 ? (
              <div className="empty-state">
                <p>No has registrado gastos manuales aún.</p>
              </div>
            ) : (
              gastos.map(g => (
                <div key={g._id} className="gasto-item">
                  <div className="gasto-item-info">
                    <h4>{g.emisor.nombre}</h4>
                    <p>{new Date(g.fechaEmision).toLocaleDateString()} — {g.categoriaManual}</p>
                  </div>
                  <div className="gasto-item-monto">
                    ₡{g.resumenFactura.totalComprobante.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
