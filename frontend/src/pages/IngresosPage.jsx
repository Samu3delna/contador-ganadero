import { useState, useEffect } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { obtenerIngresosAPI, crearIngresoAPI, eliminarIngresoAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import FormularioIngreso from '../components/ingresos/FormularioIngreso';
import HistorialVentas from '../components/ingresos/HistorialVentas';
import Modal from '../components/common/Modal';
import './IngresosPage.css';

export default function IngresosPage() {
  const [ingresos, setIngresos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
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
      toast.success('Venta registrada correctamente');
    } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar'); }
    finally { setGuardando(false); }
  }

  async function handleEliminar(id) {
    setConfirmarEliminar(id);
  }

  const confirmarEliminarIngreso = async () => {
    if (!confirmarEliminar) return;
    try {
      await eliminarIngresoAPI(confirmarEliminar);
      cargarIngresos();
      toast.success('Ingreso eliminado');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    } finally {
      setConfirmarEliminar(null);
    }
  };

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
        <FormularioIngreso 
          form={form} 
          setForm={setForm} 
          handleSubmit={handleSubmit} 
          setMostrarForm={setMostrarForm} 
          guardando={guardando} 
          subtotal={subtotal} 
          ivaCalc={ivaCalc} 
        />
      )}

      <HistorialVentas 
        cargando={cargando} 
        ingresos={ingresos} 
        handleEliminar={handleEliminar} 
      />

      {confirmarEliminar && (
        <Modal
          isOpen
          onClose={() => setConfirmarEliminar(null)}
          title="Confirmar Eliminación"
          size="sm"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertTriangle size={28} style={{ color: 'var(--color-advertencia)' }} />
            <span>¿Eliminar este ingreso? Esta acción no se puede deshacer.</span>
          </div>
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={confirmarEliminarIngreso}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
