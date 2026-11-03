import { useState, useId } from 'react';

const ESPECIES_AVES = [
  { value: 'gallina_ponedora', label: 'Gallina Ponedora' },
  { value: 'pollo_engorde', label: 'Pollo de Engorde' }
];

const ESTADOS_CICLO = [
  { value: 'pre_puesta', label: 'Pre-puesta' },
  { value: 'pico_postura', label: 'Pico de Postura' },
  { value: 'produccion_estable', label: 'Producción Estable' },
  { value: 'declive', label: 'Declive' },
  { value: 'fin_ciclo', label: 'Fin de Ciclo' }
];

export default function AvesForm({ animal, onSave, onCancel, guardando }) {
  const formId = useId();
  const initialForm = animal ? {
    loteId: animal.loteId || '',
    especie: animal.especie || 'gallina_ponedora',
    galpon: animal.galpon || '',
    fechaInicio: animal.cicloActual?.fechaInicio ? animal.cicloActual.fechaInicio.split('T')[0] : new Date().toISOString().split('T')[0],
    nInicialAves: animal.cicloActual?.nInicialAves || 0,
    nActualAves: animal.cicloActual?.nActualAves || 0,
    razaLinea: animal.cicloActual?.razaLinea || '',
    semanaVidaInicio: animal.cicloActual?.semanaVidaInicio || 0,
    semanasProduccionEsperadas: animal.cicloActual?.semanasProduccionEsperadas || 60,
    huevosSemanalesEsperados: animal.cicloActual?.huevosSemanalesEsperados || 0,
    estado: animal.cicloActual?.estado || 'pre_puesta',
    totalHuevosProducidos: animal.totalHuevosProducidos || 0,
    totalCartonesProducidos: animal.totalCartonesProducidos || 0,
    costoAlimentoTotal: animal.costoAlimentoTotal || 0,
    costoVacunasTotal: animal.costoVacunasTotal || 0
  } : {
    loteId: '',
    especie: 'gallina_ponedora',
    galpon: '',
    fechaInicio: new Date().toISOString().split('T')[0],
    nInicialAves: 0,
    nActualAves: 0,
    razaLinea: '',
    semanaVidaInicio: 0,
    semanasProduccionEsperadas: 60,
    huevosSemanalesEsperados: 0,
    estado: 'pre_puesta',
    totalHuevosProducidos: 0,
    totalCartonesProducidos: 0,
    costoAlimentoTotal: 0,
    costoVacunasTotal: 0
  };

  const [form, setForm] = useState(initialForm);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Reconstruir objeto anidado para coincidir con la API del backend
    const payload = {
      loteId: form.loteId,
      especie: form.especie,
      galpon: form.galpon,
      cicloActual: {
        fechaInicio: form.fechaInicio,
        nInicialAves: form.nInicialAves,
        nActualAves: animal ? form.nActualAves : form.nInicialAves, // al crear, nActual es igual a nInicial
        razaLinea: form.razaLinea,
        semanaVidaInicio: form.semanaVidaInicio,
        semanasProduccionEsperadas: form.semanasProduccionEsperadas,
        huevosSemanalesEsperados: form.huevosSemanalesEsperados,
        estado: form.estado
      },
      ...(animal && {
        totalHuevosProducidos: form.totalHuevosProducidos,
        totalCartonesProducidos: form.totalCartonesProducidos,
        costoAlimentoTotal: form.costoAlimentoTotal,
        costoVacunasTotal: form.costoVacunasTotal
      })
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <div className="form-group">
        <label htmlFor={`${formId}-1`}>Lote ID *</label>
        <input id={`${formId}-1`}
          className="input"
          type="text"
          value={form.loteId}
          onChange={e => setForm({ ...form, loteId: e.target.value })}
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
          {ESPECIES_AVES.map(sp => <option key={sp.value} value={sp.value}>{sp.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-3`}>Galpón / Ubicación</label>
        <input id={`${formId}-3`}
          className="input"
          type="text"
          value={form.galpon}
          onChange={e => setForm({ ...form, galpon: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-4`}>Raza o Línea</label>
        <input id={`${formId}-4`}
          className="input"
          type="text"
          placeholder="Ej: Hy-Line Brown, Lohmann"
          value={form.razaLinea}
          onChange={e => setForm({ ...form, razaLinea: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-5`}>Fecha de Inicio del Ciclo *</label>
        <input id={`${formId}-5`}
          className="input"
          type="date"
          value={form.fechaInicio}
          onChange={e => setForm({ ...form, fechaInicio: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-6`}>Aves Iniciales *</label>
        <input id={`${formId}-6`}
          className="input"
          type="number"
          min="1"
          value={form.nInicialAves}
          onChange={e => setForm({ ...form, nInicialAves: Number(e.target.value) })}
          required
        />
      </div>

      {animal && (
        <div className="form-group">
          <label htmlFor={`${formId}-7`}>Aves Actuales</label>
          <input id={`${formId}-7`}
            className="input"
            type="number"
            min="0"
            value={form.nActualAves}
            onChange={e => setForm({ ...form, nActualAves: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor={`${formId}-8`}>Semana de Vida al Iniciar</label>
        <input id={`${formId}-8`}
          className="input"
          type="number"
          min="0"
          value={form.semanaVidaInicio}
          onChange={e => setForm({ ...form, semanaVidaInicio: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-9`}>Semanas Producción Esperadas</label>
        <input id={`${formId}-9`}
          className="input"
          type="number"
          min="1"
          value={form.semanasProduccionEsperadas}
          onChange={e => setForm({ ...form, semanasProduccionEsperadas: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-10`}>Huevos Semanales Esperados</label>
        <input id={`${formId}-10`}
          className="input"
          type="number"
          min="0"
          value={form.huevosSemanalesEsperados}
          onChange={e => setForm({ ...form, huevosSemanalesEsperados: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${formId}-11`}>Estado del Ciclo</label>
        <select id={`${formId}-11`}
          className="input"
          value={form.estado}
          onChange={e => setForm({ ...form, estado: e.target.value })}
        >
          {ESTADOS_CICLO.map(ec => <option key={ec.value} value={ec.value}>{ec.label}</option>)}
        </select>
      </div>

      {animal && (
        <>
          <div className="form-group">
            <label htmlFor={`${formId}-12`}>Total Huevos Producidos</label>
            <input id={`${formId}-12`}
              className="input"
              type="number"
              min="0"
              value={form.totalHuevosProducidos}
              onChange={e => setForm({ ...form, totalHuevosProducidos: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-13`}>Total Cartones Producidos</label>
            <input id={`${formId}-13`}
              className="input"
              type="number"
              min="0"
              value={form.totalCartonesProducidos}
              onChange={e => setForm({ ...form, totalCartonesProducidos: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-14`}>Costo de Alimento Acumulado (₡)</label>
            <input id={`${formId}-14`}
              className="input"
              type="number"
              min="0"
              value={form.costoAlimentoTotal}
              onChange={e => setForm({ ...form, costoAlimentoTotal: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-15`}>Costo de Vacunas Acumulado (₡)</label>
            <input id={`${formId}-15`}
              className="input"
              type="number"
              min="0"
              value={form.costoVacunasTotal}
              onChange={e => setForm({ ...form, costoVacunasTotal: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      <div className="form-actions" style={{ gridColumn: 'span 2' }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : animal ? 'Actualizar Lote' : 'Registrar Lote'}
        </button>
      </div>
    </form>
  );
}
