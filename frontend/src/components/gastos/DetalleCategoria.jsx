export default function DetalleCategoria({ categoriaSeleccionada, datosGrafico, facturasFiltradas, setFacturaSeleccionada }) {
  if (!categoriaSeleccionada) return null;

  return (
    <div className="card detalle-categoria-card animate-slide-up mt-4">
      <div className="card-header">
        <h2 className="card-title">Facturas en {datosGrafico.find(d => d.id === categoriaSeleccionada)?.name}</h2>
      </div>
      
      <div className="facturas-grid">
        {facturasFiltradas.map(f => (
          <div key={f._id} className="factura-mini-card" onClick={() => setFacturaSeleccionada(f)}>
            <div className="factura-mini-header">
              <strong>{f.emisor?.nombre || 'Desconocido'}</strong>
              <span className="factura-mini-fecha">{new Date(f.fechaEmision).toLocaleDateString()}</span>
            </div>
            <div className="factura-mini-body">
              <span className="factura-mini-monto">₡{f.resumenFactura?.totalComprobante?.toLocaleString() || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
