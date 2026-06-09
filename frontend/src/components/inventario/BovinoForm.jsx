import { useState } from 'react';

const TIPOS_BOVINO = [
  { value: 'novillo', label: 'Novillo' },
  { value: 'vaca_lechera', label: 'Vaca Lechera' },
  { value: 'vaca_carne', label: 'Vaca de Carne' },
  { value: 'ternero', label: 'Ternero' },
  { value: 'ternera', label: 'Ternera' },
  { value: 'toro', label: 'Toro' },
  { value: 'vaquilla', label: 'Vaquilla' },
  { value: 'buey', label: 'Buey' },
  { value: 'otro', label: 'Otro' }
];

const ESTADOS_SANITARIOS = [
  { value: 'sano', label: 'Sano' },
  { value: 'en_tratamiento', label: 'En Tratamiento' },
  { value: 'cuarentena', label: 'Cuarentena' },
  { value: 'baja', label: 'Baja' }
];

const ESTADOS_REPRODUCTIVOS = [
  { value: 'no_aplica', label: 'No Aplica' },
  { value: 'vacia', label: 'Vacía' },
  { value: 'gestante', label: 'Gestante' },
  { value: 'lactancia', label: 'En Lactancia' },
  { value: 'servida', label: 'Servida' }
];

export default function BovinoForm({ animal, onSave, onCancel, guardando }) {
  const initialForm = animal ? {
    tagId: animal.tagId || '',
    nombre: animal.nombre || '',
    raza: animal.raza || '',
    tipo: animal.tipo || 'novillo',
    sexo: animal.sexo || 'macho',
    fechaNacimiento: animal.fechaNacimiento ? animal.fechaNacimiento.split('T')[0] : '',
    pesoActualKg: animal.pesoActualKg || 0,
    estadoSanitario: animal.estadoSanitario || 'sano',
    estadoReproductivo: animal.estadoReproductivo || 'no_aplica',
    observaciones: animal.observaciones || ''
  } : {
    tagId: '',
    nombre: '',
    raza: '',
    tipo: 'novillo',
    sexo: 'macho',
    fechaNacimiento: '',
    pesoActualKg: 0,
    estadoSanitario: 'sano',
    estadoReproductivo: 'no_aplica',
    observaciones: ''
  };

  const [form, setForm] = useState(initialForm);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <div className="form-group">
        <label>Tag / Ficha ID *</label>
        <input
          className="input"
          type="text"
          value={form.tagId}
          onChange={e => setForm({ ...form, tagId: e.target.value })}
          required
          disabled={!!animal} // Tag ID no debería cambiarse al editar
        />
      </div>

      <div className="form-group">
        <label>Nombre / Apodo</label>
        <input
          className="input"
          type="text"
          value={form.nombre}
          onChange={e => setForm({ ...form, nombre: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Tipo *</label>
        <select
          className="input"
          value={form.tipo}
          onChange={e => setForm({ ...form, tipo: e.target.value })}
        >
          {TIPOS_BOVINO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Sexo *</label>
        <select
          className="input"
          value={form.sexo}
          onChange={e => setForm({ ...form, sexo: e.target.value })}
        >
          <option value="macho">Macho</option>
          <option value="hembra">Hembra</option>
        </select>
      </div>

      <div className="form-group">
        <label>Raza</label>
        <input
          className="input"
          type="text"
          placeholder="Ej: Brahman, Holstein"
          value={form.raza}
          onChange={e => setForm({ ...form, raza: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Peso Actual (kg)</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.pesoActualKg}
          onChange={e => setForm({ ...form, pesoActualKg: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Fecha de Nacimiento</label>
        <input
          className="input"
          type="date"
          value={form.fechaNacimiento}
          onChange={e => setForm({ ...form, fechaNacimiento: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Estado Sanitario</label>
        <select
          className="input"
          value={form.estadoSanitario}
          onChange={e => setForm({ ...form, estadoSanitario: e.target.value })}
        >
          {ESTADOS_SANITARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Estado Reproductivo</label>
        <select
          className="input"
          value={form.estadoReproductivo}
          onChange={e => setForm({ ...form, estadoReproductivo: e.target.value })}
        >
          {ESTADOS_REPRODUCTIVOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <label>Observaciones</label>
        <textarea
          className="input"
          rows="3"
          placeholder="Notas de salud, genealogía, etc."
          value={form.observaciones}
          onChange={e => setForm({ ...form, observaciones: e.target.value })}
        />
      </div>

      <div className="form-actions" style={{ gridColumn: 'span 2' }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : animal ? 'Actualizar Bovino' : 'Registrar Bovino'}
        </button>
      </div>
    </form>
  );
}
