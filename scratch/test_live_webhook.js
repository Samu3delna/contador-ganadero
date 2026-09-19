const https = require('https');

const claveAleatoria = '5061809260300404512300010000101' + Math.floor(1000000000000000000 + Math.random() * 9000000000000000000);

const xml = `<?xml version="1.0" encoding="utf-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica">
  <Clave>${claveAleatoria}</Clave>
  <CodigoActividad>012101</CodigoActividad>
  <NumeroConsecutivo>00100001010000000099</NumeroConsecutivo>
  <FechaEmision>2026-09-18T10:00:00-06:00</FechaEmision>
  <Emisor>
    <Nombre>Veterinaria San Jeronimo S.A.</Nombre>
    <Identificacion><Tipo>02</Tipo><Numero>3101999999</Numero></Identificacion>
  </Emisor>
  <Receptor>
    <Nombre>Juan Perez Ganaderia</Nombre>
    <Identificacion><Tipo>01</Tipo><Numero>112340567</Numero></Identificacion>
  </Receptor>
  <CondicionVenta>01</CondicionVenta>
  <ResumenFactura>
    <CodigoTipoMoneda><CodigoMoneda>CRC</CodigoMoneda><TipoCambio>1.0</TipoCambio></CodigoTipoMoneda>
    <TotalComprobante>85000.00</TotalComprobante>
  </ResumenFactura>
</FacturaElectronica>`;

const boundary = '----=_Part_987_654321';
const rawEmail = [
  'From: samu3delgado@gmail.com',
  'To: pepe-af2e@contadorganandero.com',
  'Subject: Factura Electronica Veterinaria',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="' + boundary + '"',
  '',
  '--' + boundary,
  'Content-Type: text/plain; charset=UTF-8',
  '',
  'Estimado cliente, adjuntamos su factura electronica.',
  '',
  '--' + boundary,
  'Content-Type: text/xml; name="Factura.xml"',
  'Content-Disposition: attachment; filename="Factura.xml"',
  'Content-Transfer-Encoding: 7bit',
  '',
  xml,
  '',
  '--' + boundary + '--'
].join('\r\n');

const req = https.request('https://contador-ganadero.onrender.com/api/webhooks/email', {
  method: 'POST',
  headers: {
    'Content-Type': 'message/rfc822',
    'X-Email-To': 'pepe-af2e@contadorganandero.com',
    'X-Email-From': 'samu3delgado@gmail.com'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
});

req.on('error', (e) => console.error('ERROR:', e.message));
req.write(rawEmail);
req.end();
