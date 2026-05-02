import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { obtenerIngresosAPI, crearIngresoAPI, eliminarIngresoAPI } from '../services/api';
import './IngresosPage.css';

const TIPOS_GANADO = ['novillo','vaca','ternero','ternera','toro','vaquilla','buey','otro'];
const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

export default function IngresosPage() {
  const [ingresos, setIngresos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '', tipoGanado: 'novillo', cantidadCabezas: 1, precioUnitario: 0, tasaIVA: 0,
    comprador: { nombre: '', cedula: '' },
  });

  useEffect(() => { cargarIngresos(); }, []);

  async function cargarIngresos() {
    try {
      const res = await obtenerIngresosAPI({ limit: 50 });
      setIngresos(res.data.ingresos);
    } catch (err) { console.error(err); }
    finally { setCargando(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await crearIngresoAPI(form);
      setMostrarForm(false);
      setForm({ fecha: new Date().toISOString().split('T')[0], descripcion:'', tipoGanado:'novillo', cantidadCabezas:1, precioUnitario:0, tasaIVA:0, comprador:{nombre:'',cedula:''} });
      cargarIngresos();
    } catch (err) { alert(err.response?.data?.error || 'Error al guardar'); }
    finally { setGuardando(false); }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    try { await eliminarIngresoAPI(id); cargarIngresos(); } catch(err) { console.error(err); }
  }

  const subtotal = form.cantidadCabezas * form.precioUnitario;
  const ivaCalc = subtotal * (form.tasaIVA / 100);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ingresos</h1>
          <p className="page-subtitle">Registro de ventas de ganado</p>
        </div>
        <button className="btn btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          <Plus size={18} /> Registrar Venta
        </button>
      </div>

      {mostrarForm && (
        <div className="glass-card form-ingreso animate-slide-up">
          <h3>Nueva Venta de Ganado</h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>Fecha</label>
              <input className="input" type="date" value={form.fecha}
                onChange={e => setForm({...form, fecha: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Tipo de Ganado</label>
              <select className="input" value={form.tipoGanado}
                onChange={e => setForm({...form, tipoGanado: e.target.value})}>
                {TIPOS_GANADO.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Cantidad de Cabezas</label>
              <input className="input" type="number" min="1" value={form.cantidadCabezas}
                onChange={e => setForm({...form, cantidadCabezas: Number(e.target.value)})} required />
            </div>
            <div className="form-group">
              <label>Precio por Cabeza (₡)</label>
              <input className="input" type="number" min="0" value={form.precioUnitario}
                onChange={e => setForm({...form, precioUnitario: Number(e.target.value)})} required />
            </div>
            <div className="form-group">
              <label>Tasa IVA (%)</label>
              <select className="input" value={form.tasaIVA}
                onChange={e => setForm({...form, tasaIVA: Number(e.target.value)})}>
                <option value={0}>0% — Exento</option>
                <option value={1}>1% — Canasta Básica</option>
                <option value={13}>13% — General</option>
              </select>
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input className="input" placeholder="Ej: Venta de 5 novillos gordos" value={form.descripcion}
                onChange={e => setForm({...form, descripcion: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Comprador (nombre)</label>
              <input className="input" placeholder="Nombre del comprador" value={form.comprador.nombre}
                onChange={e => setForm({...form, comprador: {...form.comprador, nombre: e.target.value}})} />
            </div>
            <div className="form-group">
              <label>Cédula comprador</label>
              <input className="input" placeholder="Cédula del comprador" value={form.comprador.cedula}
                onChange={e => setForm({...form, comprador: {...form.comprador, cedula: e.target.value}})} />
            </div>

            <div className="form-resumen glass-card">
              <div><span>Subtotal:</span> <span className="text-mono">{formatCRC(subtotal)}</span></div>
              <div><span>IVA ({form.tasaIVA}%):</span> <span className="text-mono">{formatCRC(ivaCalc)}</span></div>
              <div className="form-resumen-total"><span>Total:</span> <span className="text-mono">{formatCRC(subtotal + ivaCalc)}</span></div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="btn btn-primary" type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar Venta'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card">
        <h3 className="chart-title">Historial de Ventas</h3>
        {cargando ? <div className="loader-center"><div className="loader" /></div> :
        ingresos.length === 0 ? (
          <p style={{ color: 'var(--color-texto-sec)', textAlign:'center', padding:'2rem' }}>
            No hay ingresos registrados. ¡Registra tu primera venta!
          </p>
        ) : (
          <div className="tabla-responsive">
            <table className="tabla">
              <thead><tr>
                <th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Cabezas</th><th>Total</th><th></th>
              </tr></thead>
              <tbody>
                {ingresos.map(ing => (
                  <tr key={ing._id}>
                    <td>{new Date(ing.fecha).toLocaleDateString('es-CR')}</td>
                    <td>{ing.descripcion}</td>
                    <td><span className="badge badge-exito">{ing.tipoGanado}</span></td>
                    <td>{ing.cantidadCabezas}</td>
                    <td className="text-mono">{formatCRC(ing.montoTotal)}</td>
                    <td>
                      <button className="btn-icon" onClick={() => handleEliminar(ing._id)} title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
