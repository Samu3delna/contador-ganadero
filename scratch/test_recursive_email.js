const { simpleParser } = require('c:/Users/samu3/Desktop/Contador IA/backend/node_modules/mailparser');

async function extraerAdjuntosYXMLs(parsed) {
  const xmls = [];
  let pdfBuffer = null;

  async function procesarAdjunto(adjunto) {
    const nombre = (adjunto.filename || '').toLowerCase();
    const ctype = (adjunto.contentType || '').toLowerCase();
    const content = adjunto.content;

    // Caso A: Es un XML directo por nombre o content-type
    if (nombre.endsWith('.xml') || ctype.includes('xml')) {
      xmls.push(content.toString('utf-8'));
      return;
    }

    // Caso B: Es un correo anidado (.eml o message/rfc822)
    if (nombre.endsWith('.eml') || ctype === 'message/rfc822') {
      try {
        const parsedNested = await simpleParser(content);
        for (const subAdj of (parsedNested.attachments || [])) {
          await procesarAdjunto(subAdj);
        }
      } catch (err) {
        console.warn('Error parseando .eml anidado:', err.message);
      }
      return;
    }

    // Caso C: Es un PDF
    if (nombre.endsWith('.pdf') || ctype.includes('pdf')) {
      if (!pdfBuffer) pdfBuffer = content;
      return;
    }

    // Caso D: Por contenido (si el archivo no tiene extensión .xml pero su contenido es XML de Hacienda)
    if (Buffer.isBuffer(content)) {
      const textoInicio = content.slice(0, 1000).toString('utf-8');
      if (textoInicio.includes('<?xml') || textoInicio.includes('<FacturaElectronica') || textoInicio.includes('<NotaCreditoElectronica') || textoInicio.includes('<TiqueteElectronico')) {
        xmls.push(content.toString('utf-8'));
        return;
      }
    }
  }

  for (const adj of (parsed.attachments || [])) {
    await procesarAdjunto(adj);
  }

  // Caso E: Si vino en el HTML o texto
  if (xmls.length === 0 && (parsed.html || parsed.text)) {
    const cuerpo = (parsed.html || '') + '\n' + (parsed.text || '');
    const xmlRegex = /<\?xml[\s\S]*?<\/(?:FacturaElectronica|NotaCreditoElectronica|TiqueteElectronico)>/gi;
    const matches = cuerpo.match(xmlRegex);
    if (matches) xmls.push(...matches);
  }

  return { xmls, pdfBuffer };
}

async function run() {
  const innerXml = '<?xml version="1.0"?><FacturaElectronica><Clave>123</Clave></FacturaElectronica>';
  const innerEmail = [
    'From: emisor@test.com',
    'To: cliente@test.com',
    'Subject: Factura original',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="inner_bound"',
    '',
    '--inner_bound',
    'Content-Type: text/xml; name="factura.xml"',
    'Content-Disposition: attachment; filename="factura.xml"',
    '',
    innerXml,
    '--inner_bound--'
  ].join('\r\n');

  const outerEmail = [
    'From: cliente@gmail.com',
    'To: "Mi Finca" <pepe-af2e@contadorganandero.com>',
    'Subject: Fwd: Factura original',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="outer_bound"',
    '',
    '--outer_bound',
    'Content-Type: message/rfc822; name="mensaje.eml"',
    'Content-Disposition: attachment; filename="mensaje.eml"',
    '',
    innerEmail,
    '--outer_bound--'
  ].join('\r\n');

  const parsed = await simpleParser(outerEmail);
  const res = await extraerAdjuntosYXMLs(parsed);
  console.log('XMLs extraídos de email anidado:', res.xmls.length);
  console.log('Primer XML:', res.xmls[0]);
}

run();
