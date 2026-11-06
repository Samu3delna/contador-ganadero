export default function BrandLogo({ size = 34, className = '', title = 'Logo de ContadorGanadero' }) {
  return (
    <span
      className={`cg-logo-badge ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src="/logo.svg"
        width={Math.round(size * 0.82)}
        height={Math.round(size * 0.82)}
        alt={title}
        decoding="async"
      />
    </span>
  );
}
