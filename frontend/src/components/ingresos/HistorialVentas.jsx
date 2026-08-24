import { Trash2 } from 'lucide-react';

const formatCRC = (n) => `₡${(n||0).toLocaleString('es-CR')}`;

export default function HistorialVentas({ cargando, ingresos, handleEliminar }) {
  return (
    <div className="glass-card">
      <h3 className="chart-title">Historial de Ventas</h3>
      {cargando ? <div className="loader-center"><div className="loader" /></div> :
      ingresos.length === 0 ? (
        <div className="estado-vacio">
          <p>No hay ingresos registrados. ¡Registra tu primera venta!</p>
        </div>
      ) : (
        <div className="tabla-responsive">
          <table className="tabla tabla--stack">
            <thead><tr>
              <th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Cabezas</th><th>Total</th>
              <th><span className="sr-only">Acciones</span></th>
            </tr></thead>
            <tbody>
              {ingresos.map(ing => (
                <tr key={ing._id}>
                  <td data-label="Fecha">{new Date(ing.fecha).toLocaleDateString('es-CR')}</td>
                  <td data-label="Descripción">{ing.descripcion}</td>
                  <td data-label="Tipo"><span className="badge badge-exito">{ing.tipoGanado}</span></td>
                  <td data-label="Cabezas">{ing.cantidadCabezas}</td>
                  <td className="text-mono" data-label="Total">{formatCRC(ing.montoTotal)}</td>
                  <td data-label="Acciones">
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
