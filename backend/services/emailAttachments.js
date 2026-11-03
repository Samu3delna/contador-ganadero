const { simpleParser } = require('mailparser');
const JSZip = require('jszip');
const { MiB, limiteAdjunto, leerEntrada } = require('../utils/limitedZip');

async function extraerContenidoFactura(parsed) {
  const xmls = [];
  let pdfBuffer = null;
  const pdfs = [];
  const presupuesto = { bytes: 0, entradas: 0 };

  async function procesarAdjunto(adjunto, depth = 0) {
    if (!adjunto || !adjunto.content) return;
    if (depth > 3 || ++presupuesto.entradas > 20) throw limiteAdjunto();
    const nombre = (adjunto.filename || '').toLowerCase();
    const ctype = (adjunto.contentType || '').toLowerCase();
    const content = adjunto.content;

    // 1. Archivos XML directos
    if (nombre.endsWith('.xml') || ctype.includes('xml')) {
      presupuesto.bytes += content.length;
      if (content.length > 2 * MiB || presupuesto.bytes > 20 * MiB) throw limiteAdjunto();
      xmls.push(content.toString('utf-8'));
      return;
    }

    // 2. Archivos PDF directos
    if (nombre.endsWith('.pdf') || ctype.includes('pdf')) {
      presupuesto.bytes += content.length;
      if (content.length > 10 * MiB || presupuesto.bytes > 20 * MiB) throw limiteAdjunto();
      if (!pdfBuffer) pdfBuffer = content;
      pdfs.push({ nombre, buffer: content });
      return;
    }

    // 3. Correo anidado (.eml o message/rfc822 reenviado desde Gmail/Outlook)
    if (nombre.endsWith('.eml') || ctype === 'message/rfc822') {
      try {
        const subParsed = await simpleParser(content);
        for (const subAdj of (subParsed.attachments || [])) {
          await procesarAdjunto(subAdj, depth + 1);
        }
      } catch (err) {
        if (err.code === 'LIMITE_ADJUNTOS') throw err;
        console.warn('⚠️ Error al parsear .eml anidado:', err.message);
      }
      return;
    }

    // 4. Archivos comprimidos (.zip) — muy común en emisores de Costa Rica
    if (nombre.endsWith('.zip') || ctype.includes('zip') || ctype.includes('compressed')) {
      try {
        const zip = await JSZip.loadAsync(content);
        const entries = Object.entries(zip.files).filter(([, e]) => !e.dir);
        if (presupuesto.entradas + entries.length > 20) throw limiteAdjunto();
        for (const [relativePath, zipEntry] of entries) {
          presupuesto.entradas++;
          if (zipEntry.dir) continue;
          const lowerName = relativePath.toLowerCase();
          if (lowerName.endsWith('.xml')) {
            const xmlText = (await leerEntrada(zipEntry, 2 * MiB, presupuesto)).toString('utf8');
            if (Buffer.byteLength(xmlText, 'utf8') <= 2 * 1024 * 1024) {
              xmls.push(xmlText);
            }
          } else if (lowerName.endsWith('.pdf')) {
            const buf = await leerEntrada(zipEntry, 10 * MiB, presupuesto);
            if (buf.length <= 10 * 1024 * 1024) {
              pdfBuffer = buf;
              pdfs.push({ nombre: relativePath, buffer: buf });
            }
          }
        }
      } catch (err) {
        if (err.code === 'LIMITE_ADJUNTOS') throw err;
        console.warn('⚠️ Error al descomprimir adjunto .zip:', err.message);
      }
      return;
    }

    // 5. Detección por contenido (archivos sin extensión .xml cuyo contenido es XML de Hacienda)
    if (Buffer.isBuffer(content) && content.length > 50 && content.length <= 2 * 1024 * 1024) {
      const inicio = content.slice(0, 1000).toString('utf-8');
      if (inicio.includes('<?xml') || inicio.includes('<FacturaElectronica') || inicio.includes('<NotaCreditoElectronica') || inicio.includes('<TiqueteElectronico')) {
        xmls.push(content.toString('utf-8'));
      }
    }
  }

  for (const adj of (parsed.attachments || [])) {
    await procesarAdjunto(adj);
  }

  if (xmls.length === 0 && (parsed.html || parsed.text)) {
    const cuerpo = (parsed.html || '') + '\n' + (parsed.text || '');
    const xmlRegex = /<\?xml[\s\S]*?<\/(?:FacturaElectronica|NotaCreditoElectronica|TiqueteElectronico)>/gi;
    const matches = cuerpo.match(xmlRegex);
    if (matches) xmls.push(...matches);
  }

  return { xmls, pdfBuffer, pdfs };
}


module.exports = { extraerContenidoFactura };
