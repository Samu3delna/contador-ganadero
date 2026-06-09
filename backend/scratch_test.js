const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Factura = require('./models/Factura');
const Usuario = require('./models/Usuario');
const { calcularProyeccion } = require('./services/impuestoService');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const user = await Usuario.findOne();
    if (!user) {
      console.log('No user found');
      process.exit(0);
    }
    
    console.log('User ID:', user._id);
    
    const countFacturas = await Factura.countDocuments({ usuario: user._id });
    console.log('Total facturas for user:', countFacturas);
    
    if (countFacturas > 0) {
      const factura = await Factura.findOne({ usuario: user._id });
      console.log('Sample factura periodoFiscal:', factura.periodoFiscal, 'fechaEmision:', factura.fechaEmision, 'esDeducible:', factura.esDeducible, 'estado:', factura.estado);
    }
    
    const proj = await calcularProyeccion(user._id);
    console.log('Proyeccion:', JSON.stringify(proj.resumen, null, 2));

    const anio = 2026;
    const agg = await Factura.aggregate([
        { $match: { usuario: user._id, periodoFiscal: anio, estado: { $ne: 'error' } } },
        { $group: { _id: { $month: '$fechaEmision' }, total: { $sum: '$resumenFactura.totalComprobante' } } },
        { $sort: { '_id': 1 } },
      ]);
    console.log('Aggregate tendencia gastos:', agg);
    
    const cat = await Factura.aggregate([
      { $match: { usuario: user._id, estado: { $ne: 'error' }, periodoFiscal: anio } },
      {
        $group: {
          _id: '$categoriaIA',
          totalGasto: { $sum: '$resumenFactura.totalComprobante' },
          totalIVA: { $sum: '$resumenFactura.totalImpuesto' },
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { totalGasto: -1 } },
    ]);
    console.log('Aggregate categoria gastos:', cat);
    
  } catch (e) {
    console.error(e);
  } finally {
    mongoose.disconnect();
  }
});
