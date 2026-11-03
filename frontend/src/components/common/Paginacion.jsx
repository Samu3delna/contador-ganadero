export default function Paginacion({ pagina, totalPaginas = 1, total = 0, onChange, cargando = false }) {
  const paginas = Math.max(1, totalPaginas);
  return <nav aria-label="Paginación" className="flex items-center justify-between gap-3 my-4">
    <button type="button" className="btn btn-secondary" disabled={cargando || pagina <= 1} onClick={() => onChange(pagina - 1)}>Anterior</button>
    <span role="status">Página {pagina} de {paginas} · {total} registros</span>
    <button type="button" className="btn btn-secondary" disabled={cargando || pagina >= paginas} onClick={() => onChange(pagina + 1)}>Siguiente</button>
  </nav>;
}
