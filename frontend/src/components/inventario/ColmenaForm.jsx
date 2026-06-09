import { useState } from 'react';

const ESPECIES_ABEJAS = [
  { value: 'africanizada', label: 'Africanizada' },
  { value: 'apis_mellifera', label: 'Apis Mellifera' },
  { value: 'otra', label: 'Otra' }
];

const TIPOS_COLMENA = [
  { value: 'langstroth', label: 'Langstroth' },
  { value: 'top_bar', label: 'Top Bar' },
  { value: 'kenya', label: 'Kenya' },
  { value: 'warre', label: 'Warré' },
  { value: 'tradicional', label: 'Tradicional' }
];

const ESTADOS_COLONIA = [
  { value: 'fuerte', label: 'Fuerte' },
  { value: 'media', label: 'Media' },
  { value: 'debil', label: 'Débil' },
  { value: 'sin_reina', label: 'Sin Reina' },
  { value: 'absconding', label: 'Evasión (Absconding)' },
  { value: 'muerta', label: 'Muerta' }
];

export default function ColmenaForm({ animal, onSave, onCancel, guardando }) {
  const initialForm = animal ? {
    colmenaId: animal.colmenaId || '',
    especie: animal.especie || 'africanizada',
    ubicacion: animal.ubicacion || '',
    tipoColmena: animal.tipoColmena || 'langstroth',
    estadoColonia: animal.estadoColonia || 'media',
    nCuerposAlza: animal.nCuerposAlza || 0,
    nCuadrosCera: animal.nCuadrosCera || 0,
    nCuadrosMiel: animal.nCuadrosMiel || 0,
    nCuadrosCria: animal.nCuadrosCria || 0,
    nCuadrosAlimento: animal.nCuadrosAlimento || 0,
    observaciones: animal.observaciones || ''
  } : {
    colmenaId: '',
    especie: 'africanizada',
    ubicacion: '',
    tipoColmena: 'langstroth',
    estadoColonia: 'media',
    nCuerposAlza: 0,
    nCuadrosCera: 0,
    nCuadrosMiel: 0,
    nCuadrosCria: 0,
    nCuadrosAlimento: 0,
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
        <label>Colmena ID *</label>
        <input
          className="input"
          type="text"
          value={form.colmenaId}
          onChange={e => setForm({ ...form, colmenaId: e.target.value })}
          required
          disabled={!!animal}
        />
      </div>

      <div className="form-group">
        <label>Especie *</label>
        <select
          className="input"
          value={form.especie}
          onChange={e => setForm({ ...form, especie: e.target.value })}
        >
          {ESPECIES_ABEJAS.map(sp => <option key={sp.value} value={sp.value}>{sp.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Ubicación / Apiario</label>
        <input
          className="input"
          type="text"
          value={form.ubicacion}
          onChange={e => setForm({ ...form, ubicacion: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Tipo de Colmena *</label>
        <select
          className="input"
          value={form.tipoColmena}
          onChange={e => setForm({ ...form, tipoColmena: e.target.value })}
        >
          {TIPOS_COLMENA.map(tc => <option key={tc.value} value={tc.value}>{tc.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Estado de la Colonia</label>
        <select
          className="input"
          value={form.estadoColonia}
          onChange={e => setForm({ ...form, estadoColonia: e.target.value })}
        >
          {ESTADOS_COLONIA.map(ec => <option key={ec.value} value={ec.value}>{ec.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Cuerpos de Alza</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.nCuerposAlza}
          onChange={e => setForm({ ...form, nCuerposAlza: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Cuadros de Cera</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.nCuadrosCera}
          onChange={e => setForm({ ...form, nCuadrosCera: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Cuadros de Miel</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.nCuadrosMiel}
          onChange={e => setForm({ ...form, nCuadrosMiel: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Cuadros de Cría</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.nCuadrosCria}
          onChange={e => setForm({ ...form, nCuadrosCria: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Cuadros de Alimento</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.nCuadrosAlimento}
          onChange={e => setForm({ ...form, nCuadrosAlimento: Number(e.target.value) })}
        />
      </div>

      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <label>Observaciones</label>
        <textarea
          className="input"
          rows="3"
          placeholder="Notas de salud de la reina, producción de propóleo, etc."
          value={form.observaciones}
          onChange={e => setForm({ ...form, observaciones: e.target.value })}
        />
      </div>

      <div className="form-actions" style={{ gridColumn: 'span 2' }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : animal ? 'Actualizar Colmena' : 'Registrar Colmena'}
        </button>
      </div>
    </form>
  );
}
