const TIPOS_GANADO = ['novillo','vaca','ternero','ternera','toro','vaquilla','buey','otro'];
const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

export default function FormularioIngreso({ form, setForm, handleSubmit, setMostrarForm, guardando, subtotal, ivaCalc }) {
  return (
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
  );
}
