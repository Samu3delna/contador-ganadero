require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const coll = mongoose.connection.collection('facturas');
  try {
    const res = await coll.createIndex(
      { claveNumerica: 1, tenantId: 1 },
      { 
        unique: true, 
        partialFilterExpression: { claveNumerica: { $type: 'string' } },
        background: true 
      }
    );
    console.log('Compound unique partial index created successfully:', res);
  } catch (e) {
    console.error('Create index error:', e.message);
  }
  await mongoose.disconnect();
}
run();
