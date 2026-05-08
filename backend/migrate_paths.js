/**
 * Script de migración: convierte rutas absolutas de archivos a rutas relativas
 * para que funcionen tanto en Windows (local) como en Linux (Render)
 */
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Factura = require('./models/Factura');

async function migrar() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/contador_ganadero');
    console.log('Conectado a BD');

    const facturas = await Factura.find({
      $or: [
        { archivoXML: { $regex: /^[A-Z]:\\/ } },  // Rutas Windows absolutas
        { archivoXML: { $regex: /^\// } },          // Rutas Linux absolutas
        { archivoPDF: { $regex: /^[A-Z]:\\/ } },
        { archivoPDF: { $regex: /^\// } },
      ]
    });

    console.log(`Encontradas ${facturas.length} factura(s) con rutas absolutas`);

    for (const f of facturas) {
      let cambios = false;

      if (f.archivoXML) {
        // Extraer solo la parte relativa: uploads/xml/archivo.xml
        const matchXML = f.archivoXML.match(/uploads[/\\]xml[/\\].+$/);
        if (matchXML) {
          const nuevaRuta = matchXML[0].replace(/\\/g, '/');
          console.log(`  XML: ${f.archivoXML} → ${nuevaRuta}`);
          f.archivoXML = nuevaRuta;
          cambios = true;
        }
      }

      if (f.archivoPDF) {
        const matchPDF = f.archivoPDF.match(/uploads[/\\]pdf[/\\].+$/);
        if (matchPDF) {
          const nuevaRuta = matchPDF[0].replace(/\\/g, '/');
          console.log(`  PDF: ${f.archivoPDF} → ${nuevaRuta}`);
          f.archivoPDF = nuevaRuta;
          cambios = true;
        }
      }

      if (cambios) {
        await f.save();
      }
    }

    console.log('Migración completada.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

migrar();
