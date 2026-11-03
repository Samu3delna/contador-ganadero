import { useState, useId } from 'react';

const ESPECIES_PECES = [
  { value: 'tilapia', label: 'Tilapia' },
  { value: 'trucha', label: 'Trucha' },
  { value: 'carpa', label: 'Carpa' },
  { value: 'camaron', label: 'Camarón' },
  { value: 'bagre', label: 'Bagre' },
  { value: 'otro', label: 'Otro' }
];

const ESTADOS_ESTANQUE = [
  { value: 'siembra', label: 'Siembra' },
  { value: 'crecimiento', label: 'Crecimiento' },
  { value: 'engorde', label: 'Engorde' },
  { value: 'cosecha', label: 'Cosecha' },
  { value: 'vacio', label: 'Vacío' }
];

export default function PecesForm({ animal, onSave, onCancel, guardando }) {
  const formId = useId();
  const initialForm = animal ? {
    estanqueId: animal.estanqueId || '',
    especie: animal.especie || 'tilapia',
    capacidadM3: animal.capacidadM3 || 0,
    fechaSiembra: animal.fechaSiembra ? animal.fechaSiembra.split('T')[0] : new Date().toISOString().split('T')[0],
    nInicial: animal.nInicial || 0,
    nActual: animal.nActual || 0,
    mortalidadAcumulada: animal.mortalidadAcumulada || 0,
    pesoPromedioActualKg: animal.pesoPromedioActualKg || 0,
    biomasaTotalKg: animal.biomasaTotalKg || 0,
    tipoAlimento: animal.tipoAlimento || '',
    consumoAlimentoKgAcumulado: animal.consumoAlimentoKgAcumulado || 0,
    tasaConversionAlimenticia: animal.tasaConversionAlimenticia || 0,
    costoAlevines: animal.costoAlevines || 0,
    costoAlimento: animal.costoAlimento || 0,
    costoMedicamentos: animal.costoMedicamentos || 0,
    estado: animal.estado || 'siembra'
  } : {
    estanqueId: '',
    especie: 'tilapia',
    capacidadM3: 0,
    fechaSiembra: new Date().toISOString().split('T')[0],
    nInicial: 0,
    nActual: 0,
    mortalidadAcumulada: 0,
    pesoPromedioActualKg: 0,
    biomasaTotalKg: 0,
    tipoAlimento: '',
    consumoAlimentoKgAcumulado: 0,
    tasaConversionAlimenticia: 0,
    costoAlevines: 0,
    costoAlimento: 0,
    costoMedicamentos: 0,
    estado: 'siembra'
  };

  const [form, setForm] = useState(initialForm);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      estanqueId: form.estanqueId,
      especie: form.especie,
      capacidadM3: form.capacidadM3,
      fechaSiembra: form.fechaSiembra,
      nInicial: form.nInicial,
      nActual: animal ? form.nActual : form.nInicial, // al crear es igual a nInicial
      estado: form.estado,
      ...(animal && {
        mortalidadAcumulada: form.mortalidadAcumulada,
        pesoPromedioActualKg: form.pesoPromedioActualKg,
        biomasaTotalKg: form.biomasaTotalKg,
        tipoAlimento: form.tipoAlimento,
        consumoAlimentoKgAcumulado: form.consumoAlimentoKgAcumulado,
        tasaConversionAlimenticia: form.tasaConversionAlimenticia,
        costoAlevines: form.costoAlevines,
        costoAlimento: form.costoAlimento,
        costoMedicamentos: form.costoMedicamentos
      })
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <div className="form-group">
        <label htmlFor={`${formId}-1`}>Estanque ID *</label>
        <input id={`${formId}-1`}
          className="input"
          type="text"
          value={form.estanqueId}
          onChange={e => setForm({ ...form, estanqueId: e.target.value })}
          required
          disabled={!!animal}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-2`}>Especie *</label>
        <select id={`${formId}-2`}
          className="input"
          value={form.especie}
          onChange={e => setForm({ ...form, especie: e.target.value })}
        >
          {ESPECIES_PECES.map(sp => <option key={sp.value} value={sp.value}>{sp.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-3`}>Capacidad (m³)</label>
        <input id={`${formId}-3`}
          className="input"
          type="number"
          min="0"
          value={form.capacidadM3}
          onChange={e => setForm({ ...form, capacidadM3: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-4`}>Fecha de Siembra *</label>
        <input id={`${formId}-4`}
          className="input"
          type="date"
          value={form.fechaSiembra}
          onChange={e => setForm({ ...form, fechaSiembra: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-5`}>Número de Alevines Inicial *</label>
        <input id={`${formId}-5`}
          className="input"
          type="number"
          min="1"
          value={form.nInicial}
          onChange={e => setForm({ ...form, nInicial: Number(e.target.value) })}
          required
        />
      </div>

      {animal && (
        <>
          <div className="form-group">
            <label htmlFor={`${formId}-6`}>Peces Actuales</label>
            <input id={`${formId}-6`}
              className="input"
              type="number"
              min="0"
              value={form.nActual}
              onChange={e => setForm({ ...form, nActual: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-7`}>Mortalidad Acumulada</label>
            <input id={`${formId}-7`}
              className="input"
              type="number"
              min="0"
              value={form.mortalidadAcumulada}
              onChange={e => setForm({ ...form, mortalidadAcumulada: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-8`}>Peso Promedio Actual (kg)</label>
            <input id={`${formId}-8`}
              className="input"
              type="number"
              step="0.001"
              min="0"
              value={form.pesoPromedioActualKg}
              onChange={e => setForm({ ...form, pesoPromedioActualKg: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-9`}>Biomasa Total (kg)</label>
            <input id={`${formId}-9`}
              className="input"
              type="number"
              step="0.1"
              min="0"
              value={form.biomasaTotalKg}
              onChange={e => setForm({ ...form, biomasaTotalKg: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-10`}>Tipo de Alimento</label>
            <input id={`${formId}-10`}
              className="input"
              type="text"
              value={form.tipoAlimento}
              onChange={e => setForm({ ...form, tipoAlimento: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-11`}>Alimento Consumido Acumulado (kg)</label>
            <input id={`${formId}-11`}
              className="input"
              type="number"
              min="0"
              value={form.consumoAlimentoKgAcumulado}
              onChange={e => setForm({ ...form, consumoAlimentoKgAcumulado: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-12`}>FCA (Factor Conversión)</label>
            <input id={`${formId}-12`}
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={form.tasaConversionAlimenticia}
              onChange={e => setForm({ ...form, tasaConversionAlimenticia: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-13`}>Costo de Alevines (₡)</label>
            <input id={`${formId}-13`}
              className="input"
              type="number"
              min="0"
              value={form.costoAlevines}
              onChange={e => setForm({ ...form, costoAlevines: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-14`}>Costo de Alimento (₡)</label>
            <input id={`${formId}-14`}
              className="input"
              type="number"
              min="0"
              value={form.costoAlimento}
              onChange={e => setForm({ ...form, costoAlimento: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-15`}>Costo de Medicamentos (₡)</label>
            <input id={`${formId}-15`}
              className="input"
              type="number"
              min="0"
              value={form.costoMedicamentos}
              onChange={e => setForm({ ...form, costoMedicamentos: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor={`${formId}-16`}>Estado</label>
        <select id={`${formId}-16`}
          className="input"
          value={form.estado}
          onChange={e => setForm({ ...form, estado: e.target.value })}
        >
          {ESTADOS_ESTANQUE.map(ee => <option key={ee.value} value={ee.value}>{ee.label}</option>)}
        </select>
      </div>

      <div className="form-actions" style={{ gridColumn: 'span 2' }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : animal ? 'Actualizar Estanque' : 'Registrar Estanque'}
        </button>
      </div>
    </form>
  );
}
