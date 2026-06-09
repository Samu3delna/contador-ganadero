import { useState } from 'react';

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
        <label>Lote ID *</label>
        <input
          className="input"
          type="text"
          value={form.loteId}
          onChange={e => setForm({ ...form, loteId: e.target.value })}
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
          {ESPECIES_AVES.map(sp => <option key={sp.value} value={sp.value}>{sp.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Galpón / Ubicación</label>
        <input
          className="input"
          type="text"
          value={form.galpon}
          onChange={e => setForm({ ...form, galpon: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Raza o Línea</label>
        <input
          className="input"
          type="text"
          placeholder="Ej: Hy-Line Brown, Lohmann"
          value={form.razaLinea}
          onChange={e => setForm({ ...form, razaLinea: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Fecha de Inicio del Ciclo *</label>
        <input
          className="input"
          type="date"
          value={form.fechaInicio}
          onChange={e => setForm({ ...form, fechaInicio: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Aves Iniciales *</label>
        <input
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
          <label>Aves Actuales</label>
          <input
            className="input"
            type="number"
            min="0"
            value={form.nActualAves}
            onChange={e => setForm({ ...form, nActualAves: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="form-group">
        <label>Semana de Vida al Iniciar</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.semanaVidaInicio}
          onChange={e => setForm({ ...form, semanaVidaInicio: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Semanas Producción Esperadas</label>
        <input
          className="input"
          type="number"
          min="1"
          value={form.semanasProduccionEsperadas}
          onChange={e => setForm({ ...form, semanasProduccionEsperadas: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Huevos Semanales Esperados</label>
        <input
          className="input"
          type="number"
          min="0"
          value={form.huevosSemanalesEsperados}
          onChange={e => setForm({ ...form, huevosSemanalesEsperados: Number(e.target.value) })}
        />
      </div>

      <div className="form-group">
        <label>Estado del Ciclo</label>
        <select
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
            <label>Total Huevos Producidos</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.totalHuevosProducidos}
              onChange={e => setForm({ ...form, totalHuevosProducidos: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label>Total Cartones Producidos</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.totalCartonesProducidos}
              onChange={e => setForm({ ...form, totalCartonesProducidos: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label>Costo de Alimento Acumulado (₡)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.costoAlimentoTotal}
              onChange={e => setForm({ ...form, costoAlimentoTotal: Number(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label>Costo de Vacunas Acumulado (₡)</label>
            <input
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
