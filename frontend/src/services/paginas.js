export async function obtenerPaginas(pedir, campo) {
  const primera = await pedir(1);
  const docs = [...(primera.data[campo] || [])];
  for (let pagina = 2; pagina <= (primera.data.totalPaginas || 1); pagina++) {
    const res = await pedir(pagina); docs.push(...(res.data[campo] || []));
  }
  return docs;
}
