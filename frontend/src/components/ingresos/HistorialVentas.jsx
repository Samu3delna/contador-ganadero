import { Trash2 } from 'lucide-react';

const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

export default function HistorialVentas({ cargando, ingresos, handleEliminar }) {
  return (
    <div className="glass-card">
      <h3 className="chart-title">Historial de Ventas</h3>
      {cargando ? <div className="loader-center"><div className="loader" /></div> :
      ingresos.length === 0 ? (
        <p style={{ color: 'var(--color-texto-sec)', textAlign:'center', padding:'2rem' }}>
          No hay ingresos registrados. ¡Registra tu primera venta!
        </p>
      ) : (
        <div className="tabla-responsive">
          <table className="tabla">
            <thead><tr>
              <th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Cabezas</th><th>Total</th><th></th>
            </tr></thead>
            <tbody>
              {ingresos.map(ing => (
                <tr key={ing._id}>
                  <td>{new Date(ing.fecha).toLocaleDateString('es-CR')}</td>
                  <td>{ing.descripcion}</td>
                  <td><span className="badge badge-exito">{ing.tipoGanado}</span></td>
                  <td>{ing.cantidadCabezas}</td>
                  <td className="text-mono">{formatCRC(ing.montoTotal)}</td>
                  <td>
                    <button className="btn-icon" onClick={() => handleEliminar(ing._id)} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
