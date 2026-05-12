const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

export default function GastosCategoriaList({ categorias }) {
  return (
    <div className="glass-card animate-slide-up" style={{ '--delay': '0.5s' }}>
      <h3 className="chart-title">Gastos por Categoría (IA)</h3>
      {categorias.length === 0 ? (
        <p style={{ color: 'var(--color-texto-sec)', padding: '2rem 0', textAlign: 'center' }}>
          Sin datos aún. Las facturas serán categorizadas automáticamente.
        </p>
      ) : (
        <div className="categoria-list">
          {categorias.map((cat) => (
            <div key={cat.categoria} className="categoria-item">
              <div className="categoria-info">
                <span className="categoria-nombre">{cat.categoria.replace(/_/g, ' ')}</span>
                <span className="categoria-count">{cat.cantidad} factura(s)</span>
              </div>
              <span className="categoria-monto text-mono">{formatCRC(cat.totalGasto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
