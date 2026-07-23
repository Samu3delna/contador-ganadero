/**
 * Almacen en memoria para simular respuestas de Hacienda en ambiente local.
 * Permite que el worker asincrono y los endpoints de consulta/prueba se
 * comporten de igual manera que el ambiente real (sandbox/produccion).
 *
 * No usar en produccion.
 */

const store = new Map();

function set(clave, payload) {
  store.set(clave, payload);
}

function get(clave) {
  return store.get(clave);
}

function update(clave, patch) {
  const cur = store.get(clave);
  if (!cur) return null;
  const merged = { ...cur, ...patch };
  store.set(clave, merged);
  return merged;
}

function pushTransicion(clave, transicion) {
  const cur = store.get(clave);
  if (!cur) return;
  cur.transiciones = cur.transiciones || [];
  cur.transiciones.push(transicion);
}

function eliminar(clave) {
  store.delete(clave);
}

function limpiar() {
  store.clear();
}

function todos() {
  return Array.from(store.values());
}

module.exports = {
  set,
  get,
  update,
  pushTransicion,
  eliminar,
  limpiar,
  todos,
};
