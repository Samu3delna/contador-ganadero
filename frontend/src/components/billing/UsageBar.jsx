import './UsageBar.css';

export default function UsageBar({ consumo = 0, limite = 1, label = 'Uso' }) {
  let porcentaje = limite > 0 ? Math.min(100, (consumo / limite) * 100) : 0;

  let nivel = 'verde';
  if (porcentaje >= 90) nivel = 'rojo';
  else if (porcentaje >= 70) nivel = 'amarillo';

  const limiteAlcanzado = consumo >= limite && limite > 0;

  return (
    <div className="usage-bar">
      <div className="usage-bar-head">
        <span className="usage-bar-label">{label}</span>
        <span className={`usage-bar-count ${limiteAlcanzado ? 'usage-bar-count--limite' : ''}`}>
          {consumo} / {limite}
          {limiteAlcanzado ? ' · Límite alcanzado' : ''}
        </span>
      </div>
      <div className="usage-bar-track">
        <div className={`usage-bar-fill usage-bar-fill--${nivel}`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}
