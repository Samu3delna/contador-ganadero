const MiB = 1024 * 1024;
function limiteAdjunto() {
  const error = new Error('Adjuntos exceden los límites de tamaño, cantidad o profundidad');
  error.status = 413; error.code = 'LIMITE_ADJUNTOS'; return error;
}
async function leerEntrada(entry, limite, presupuesto) {
  const chunks = []; let size = 0;
  const stream = entry.nodeStream('nodebuffer');
  return new Promise((resolve, reject) => {
    let terminado = false;
    stream.on('data', chunk => {
      if (terminado) return;
      size += chunk.length; presupuesto.bytes += chunk.length;
      if (size > limite || presupuesto.bytes > 20 * MiB) {
        terminado = true; stream.pause(); stream.destroy(); reject(limiteAdjunto()); return;
      }
      chunks.push(chunk);
    });
    stream.on('error', error => { if (!terminado) { terminado = true; reject(error); } });
    stream.on('end', () => { if (!terminado) { terminado = true; resolve(Buffer.concat(chunks, size)); } });
  });
}
module.exports = { MiB, limiteAdjunto, leerEntrada };
