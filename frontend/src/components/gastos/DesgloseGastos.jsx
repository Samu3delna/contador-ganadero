export default function DesgloseGastos({ datosGrafico, COLORES, categoriaSeleccionada, setCategoriaSeleccionada, setFacturaSeleccionada }) {
  return (
    <div className="card desglose-card">
      <div className="card-header">
        <h2 className="card-title">Desglose Total (Clic para ver facturas)</h2>
      </div>
      <div className="desglose-lista">
        {datosGrafico.map((item, index) => (
          <div 
            key={index} 
            className={`desglose-item ${categoriaSeleccionada === item.id ? 'activo' : ''}`}
            onClick={() => {
              setCategoriaSeleccionada(item.id === categoriaSeleccionada ? null : item.id);
              setFacturaSeleccionada(null);
            }}
          >
            <div className="desglose-info">
              <div className="desglose-color" style={{ backgroundColor: COLORES[index % COLORES.length] }}></div>
              <span className="desglose-nombre">{item.name}</span>
            </div>
            <span className="desglose-monto">₡{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
