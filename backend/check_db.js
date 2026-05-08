require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Factura = require('./models/Factura');

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/contador_ganadero');
    const facturas = await Factura.find();
    console.log(`Hay ${facturas.length} facturas en la base de datos.`);
    if (facturas.length > 0) {
      console.log('Las primeras 3 facturas:');
      facturas.slice(0, 3).forEach(f => {
        console.log(`- ${f.claveNumerica || 'Sin clave'} | Estado: ${f.estado} | XML: ${f.archivoXML} | Carpeta: ${f.carpetaOrigen}`);
      });
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDB();
