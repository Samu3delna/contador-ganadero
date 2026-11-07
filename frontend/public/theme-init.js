(function () {
  var theme;
  try { theme = localStorage.getItem('cg-theme'); } catch { /* Storage may be unavailable. */ }
  if (theme !== 'light' && theme !== 'dark') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
