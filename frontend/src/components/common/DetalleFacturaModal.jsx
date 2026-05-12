export default function DetalleFacturaModal({ facturaSeleccionada, setFacturaSeleccionada }) {
  if (!facturaSeleccionada) return null;

  return (
    <div className="modal-overlay" onClick={() => setFacturaSeleccionada(null)}>
      <div className="card detalle-factura-modal animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="detalle-header">
          <h3>Detalle del Gasto</h3>
          <button className="btn-icon" onClick={() => setFacturaSeleccionada(null)}>✕</button>
        </div>
        <div className="detalle-body">
          <p className="detalle-emisor">{facturaSeleccionada.emisor?.nombre}</p>
          <p className="detalle-fecha">{new Date(facturaSeleccionada.fechaEmision).toLocaleDateString()}</p>
          
          <div className="detalle-monto">
            <span className="monto-label">Total:</span>
            <span className="monto-valor">₡{facturaSeleccionada.resumenFactura?.totalComprobante?.toLocaleString() || 0}</span>
          </div>
          
          <div className="detalle-info">
            <p><strong>Categoría:</strong> <span className="badge badge-primary">{facturaSeleccionada.categoriaIA || facturaSeleccionada.categoriaManual || 'N/A'}</span></p>
            <p><strong>Clave XML:</strong> {facturaSeleccionada.claveNumerica ? 'Factura Electrónica (XML)' : 'Ingreso Manual'}</p>
            {facturaSeleccionada.resumenFactura?.totalImpuesto !== undefined && (
              <p><strong>IVA:</strong> ₡{facturaSeleccionada.resumenFactura.totalImpuesto.toLocaleString()}</p>
            )}
          </div>

          {facturaSeleccionada.lineaDetalle && facturaSeleccionada.lineaDetalle.length > 0 && (
            <div className="detalle-lineas">
              <h4>Conceptos</h4>
              <ul>
                {facturaSeleccionada.lineaDetalle.map((linea, idx) => (
                  <li key={idx}>
                    <span>{linea.cantidad}x {linea.descripcion}</span>
                    <span>₡{linea.montoTotal.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
