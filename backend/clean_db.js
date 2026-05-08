require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Factura = require('./models/Factura');

async function cleanDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/contador_ganadero');
    await Factura.deleteMany({});
    console.log('Facturas borradas.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanDB();
