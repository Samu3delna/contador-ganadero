function paginacion({ page, limit } = {}) {
  const pageNum = Math.min(1000000, Math.max(1, Math.floor(Number(page) || 1)));
  const limitNum = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
}
module.exports = { paginacion };
