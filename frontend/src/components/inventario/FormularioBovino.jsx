import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './FormularioBovino.css';

const TIPOS_BOVINO = [
  { value: 'novillo', label: 'Novillo' },
  { value: 'vaca', label: 'Vaca' },
  { value: 'toro', label: 'Toro' },
  { value: 'ternero', label: 'Ternero' },
  { value: 'vaquilla', label: 'Vaquilla' },
];

const RAZAS_COMUNES = [
  'Brahman', 'Nelore', 'Gyr', 'Guzerat', 'Sindi', 'Angus', 'Hereford', 
  'Charolais', 'Limousin', 'Simmental', 'Holstein', 'Jersey', 'Cruce', 'Otra'
];

const ESTADOS_SANITARIOS = ['sano', 'en_tratamiento', 'cuarentena', 'bajo_observacion'];
const ESTADOS_REPRODUCTIVOS = ['vacio', 'gestante', 'lactancia', 'secado'];

export default function FormularioBovino({ 
  onClose, 
  onSubmit, 
  bovinoEditando = null, 
  guardando = false 
}) {
  const initialForm = bovinoEditando ? {
    tagId: bovinoEditando.tagId || '',
    nombre: bovinoEditando.nombre || '',
    raza: bovinoEditando.raza || '',
    tipo: bovinoEditando.tipo || 'novillo',
    sexo: bovinoEditando.sexo || 'M',
    fechaNacimiento: bovinoEditando.fechaNacimiento ? bovinoEditando.fechaNacimiento.split('T')[0] : '',
    pesoActualKg: bovinoEditando.pesoActualKg || '',
    observaciones: bovinoEditando.observaciones || '',
    estadoSanitario: bovinoEditando.estadoSanitario || 'sano',
    estadoReproductivo: bovinoEditando.estadoReproductivo || 'vacio',
  } : {
    tagId: '',
    nombre: '',
    raza: '',
    tipo: 'novillo',
    sexo: 'M',
    fechaNacimiento: new Date().toISOString().split('T')[0],
    pesoActualKg: '',
    observaciones: '',
    estadoSanitario: 'sano',
    estadoReproductivo: 'vacio',
  };

  const [form, setForm] = useState(initialForm);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: e.target.checked }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.tagId.trim()) {
      toast.error('El Tag ID es obligatorio');
      return;
    }
    if (!form.pesoActualKg || parseFloat(form.pesoActualKg) <= 0) {
      toast.error('El peso actual debe ser mayor a 0');
      return;
    }

    const datos = {
      tagId: form.tagId.trim(),
      nombre: form.nombre.trim() || undefined,
      raza: form.raza || undefined,
      tipo: form.tipo,
      sexo: form.sexo,
      fechaNacimiento: form.fechaNacimiento || undefined,
      pesoActualKg: parseFloat(form.pesoActualKg),
      observaciones: form.observaciones.trim() || undefined,
      estadoSanitario: form.estadoSanitario,
      estadoReproductivo: form.estadoReproductivo,
    };

    try {
      await onSubmit(datos, bovinoEditando?._id);
      toast.success(bovinoEditando ? 'Bovino actualizado correctamente' : 'Bovino agregado correctamente');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al guardar');
    }
  };

  const isEditing = !!bovinoEditando;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container formulario-bovino" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Editar Bovino' : 'Agregar Bovino'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="formulario-grid">
          <div className="form-group full-width">
            <label htmlFor="tagId">Tag ID *</label>
            <input
              type="text"
              id="tagId"
              name="tagId"
              value={form.tagId}
              onChange={handleChange}
              placeholder="Ej: B-001"
              disabled={isEditing}
              required
            />
            {isEditing && <small className="form-help">El Tag ID no se puede modificar</small>}
          </div>

          <div className="form-group">
            <label htmlFor="nombre">Nombre</label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Opcional"
            />
          </div>

          <div className="form-group">
            <label htmlFor="raza">Raza</label>
            <select id="raza" name="raza" value={form.raza} onChange={handleChange}>
              <option value="">Seleccionar...</option>
              {RAZAS_COMUNES.map(raza => (
                <option key={raza} value={raza}>{raza}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tipo">Tipo *</label>
            <select id="tipo" name="tipo" value={form.tipo} onChange={handleChange} required>
              {TIPOS_BOVINO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sexo">Sexo *</label>
            <select id="sexo" name="sexo" value={form.sexo} onChange={handleChange} required>
              <option value="M">Macho</option>
              <option value="H">Hembra</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="fechaNacimiento">Fecha de Nacimiento</label>
            <input
              type="date"
              id="fechaNacimiento"
              name="fechaNacimiento"
              value={form.fechaNacimiento}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="pesoActualKg">Peso Actual (kg) *</label>
            <input
              type="number"
              id="pesoActualKg"
              name="pesoActualKg"
              value={form.pesoActualKg}
              onChange={handleChange}
              placeholder="Ej: 450"
              step="0.1"
              min="0.1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="estadoSanitario">Estado Sanitario</label>
            <select id="estadoSanitario" name="estadoSanitario" value={form.estadoSanitario} onChange={handleChange}>
              {ESTADOS_SANITARIOS.map(e => (
                <option key={e} value={e}>{e.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="estadoReproductivo">Estado Reproductivo</label>
            <select id="estadoReproductivo" name="estadoReproductivo" value={form.estadoReproductivo} onChange={handleChange}>
              {ESTADOS_REPRODUCTIVOS.map(e => (
                <option key={e} value={e}>{e.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="form-group full-width">
            <label htmlFor="observaciones">Observaciones</label>
            <textarea
              id="observaciones"
              name="observaciones"
              value={form.observaciones}
              onChange={handleChange}
              rows={3}
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Agregar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
