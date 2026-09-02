import { useState, useEffect } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { obtenerIngresosAPI, crearIngresoAPI, eliminarIngresoAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import FormularioIngreso from '../components/ingresos/FormularioIngreso';
import HistorialVentas from '../components/ingresos/HistorialVentas';
import Modal from '../components/common/Modal';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title text-2xl md:text-3xl font-bold font-heading text-white">Ingresos & Ventas</h1>
            <Badge variant="default" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Régimen REA
            </Badge>
          </div>
          <p className="page-subtitle text-slate-400 text-sm mt-1">Registro y control de ventas de ganado, subastas y productos de la finca</p>
        </div>
        <Button
          variant={mostrarForm ? 'secondary' : 'gradient'}
          size="default"
          className="gap-2 shadow-md shadow-emerald-950/40 self-start sm:self-auto"
          onClick={() => setMostrarForm(!mostrarForm)}
        >
          <Plus size={18} className={mostrarForm ? 'rotate-45 transition-transform' : ''} />
          {mostrarForm ? 'Cerrar Formulario' : 'Registrar Venta'}
        </Button>
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
          <div className="confirm-dialog-body flex items-start gap-3 p-2">
            <AlertTriangle size={24} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-slate-200 text-sm">¿Está seguro de que desea eliminar este registro de ingreso? Esta acción no se puede deshacer.</span>
          </div>
          <div className="form-actions flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => setConfirmarEliminar(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmarEliminarIngreso}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
