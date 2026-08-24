import Modal from './Modal';

export default function DetalleFacturaModal({ facturaSeleccionada, setFacturaSeleccionada }) {
  if (!facturaSeleccionada) return null;

  return (
    <Modal
      isOpen={Boolean(facturaSeleccionada)}
      onClose={() => setFacturaSeleccionada(null)}
      title="Detalle del Gasto"
      size="md"
    >
      <div className="detalle-modal-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--color-texto)', marginBottom: '2px' }}>
              {facturaSeleccionada.emisor?.nombre || 'Emisor sin nombre'}
            </h3>
            <span style={{ fontSize: '0.84rem', color: 'var(--color-texto-muted)' }}>
              {new Date(facturaSeleccionada.fechaEmision).toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <span className="badge badge-primario">
            {facturaSeleccionada.categoriaManual || facturaSeleccionada.categoriaIA || 'Sin categorizar'}
          </span>
        </div>
        
        <div style={{
          backgroundColor: 'var(--color-superficie-2)',
          border: '1px solid var(--color-borde)',
          borderRadius: 'var(--radio-md)',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem'
        }}>
          <span style={{ color: 'var(--color-texto-sec)', fontWeight: '600', fontSize: '0.9rem' }}>Total Comprobante:</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-primario-claro)', fontFamily: 'var(--font-mono)' }}>
            ₡{facturaSeleccionada.resumenFactura?.totalComprobante?.toLocaleString('es-CR') || 0}
          </span>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
          gap: '0.75rem',
          padding: '0.75rem 0',
          borderBottom: '1px solid var(--color-borde)',
          marginBottom: '1rem',
          fontSize: '0.88rem'
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-texto-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Origen</span>
            <span style={{ fontWeight: '500' }}>{facturaSeleccionada.claveNumerica ? 'Factura Electrónica (XML)' : 'Ingreso Manual'}</span>
          </div>
          {facturaSeleccionada.resumenFactura?.totalImpuesto !== undefined && (
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-texto-muted)', textTransform: 'uppercase', fontWeight: '600' }}>IVA Total</span>
              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>₡{facturaSeleccionada.resumenFactura.totalImpuesto.toLocaleString('es-CR')}</span>
            </div>
          )}
        </div>

        {facturaSeleccionada.lineaDetalle && facturaSeleccionada.lineaDetalle.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.92rem', marginBottom: '0.5rem', color: 'var(--color-texto-sec)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conceptos</h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {facturaSeleccionada.lineaDetalle.map((linea, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.45rem 0.6rem',
                  borderRadius: 'var(--radio-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.025)',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ color: 'var(--color-texto)' }}>{linea.cantidad || 1}x {linea.descripcion || 'Sin descripción'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>₡{(linea.montoTotal || 0).toLocaleString('es-CR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
