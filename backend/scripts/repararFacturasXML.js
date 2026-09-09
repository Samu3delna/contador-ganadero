/**
 * Script de reparación: Restaura las Claves de 50 dígitos, Consecutivos de 20 dígitos
 * y Cédulas que sufrieron corrupción por parseTagValue: true en facturas existentes.
 *
 * Busca los archivos XML en disco o extrae la clave/consecutivo desde el nombre del archivo.
 * Para facturas sin archivo donde la clave quedó con 'e+', se remueve la clave corrupta
 * manteniendo el número consecutivo intacto.
 *
 * Uso:
 *   node scripts/repararFacturasXML.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Factura = require('../models/Factura');
const { parsearFacturaXML } = require('../services/xmlParserService');

const TIPO_DOC_NOMBRES = {
  '01': 'Factura Electrónica',
  '02': 'Nota de Débito',
  '03': 'Nota de Crédito',
  '04': 'Tiquete Electrónico',
  '05': 'Factura Electrónica de Compra',
  '06': 'Factura de Exportación',
  '07': 'Recibo Electrónico de Pago',
};

async function repararFacturas() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/contador_ganadero';
  console.log('🔌 Conectando a MongoDB en:', uri);

  try {
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB');

    // 1. Limpiar registros de error originados por acuses AHC de Hacienda (no son facturas)
    const eliminadosAHC = await Factura.deleteMany({
      estado: 'error',
      archivoXML: { $regex: /(ahc|mensajehacienda|confirmacion)/i }
    });
    if (eliminadosAHC.deletedCount > 0) {
      console.log(`🧹 Eliminados ${eliminadosAHC.deletedCount} registros residuales de acuses AHC`);
    }

    const facturas = await Factura.find();
    console.log(`📋 Total de facturas en base de datos a examinar: ${facturas.length}`);

    const xmlDir = path.join(__dirname, '..', 'uploads', 'xml');
    const archivosEnDisco = fs.existsSync(xmlDir) ? fs.readdirSync(xmlDir) : [];
    console.log(`📁 Archivos XML disponibles en disco: ${archivosEnDisco.length}`);

    let reparadas = 0;
    let limpiadasEPlus = 0;
    let yaCorrectas = 0;

    for (const f of facturas) {
      let claveReal = null;
      let consecutivoReal = null;
      let emisorNumeroReal = null;
      let emisorTipoReal = null;
      let tipoDocReal = null;

      // Intentar buscar archivo XML en disco
      let rutaXML = null;
      if (f.archivoXML) {
        const rutaDirecta = path.isAbsolute(f.archivoXML)
          ? f.archivoXML
          : path.join(__dirname, '..', f.archivoXML);

        if (fs.existsSync(rutaDirecta)) {
          rutaXML = rutaDirecta;
        } else {
          // Buscar por nombre de archivo en uploads/xml
          const baseName = path.basename(f.archivoXML);
          const rutaAlterna = path.join(xmlDir, baseName);
          if (fs.existsSync(rutaAlterna)) {
            rutaXML = rutaAlterna;
          } else {
            // Buscar si algún archivo en disco contiene el nombre base sin timestamp
            const sinTimestamp = baseName.replace(/^[0-9]+_/, '');
            const encontradaPorNombre = archivosEnDisco.find(a => a.endsWith(sinTimestamp));
            if (encontradaPorNombre) {
              rutaXML = path.join(xmlDir, encontradaPorNombre);
            } else {
              // Buscar si algún archivo en disco contiene la clave
              const matchClave = f.archivoXML.match(/(506[0-9]{47})/);
              if (matchClave) {
                const encontradaPorClave = archivosEnDisco.find(a => a.includes(matchClave[1]));
                if (encontradaPorClave) {
                  rutaXML = path.join(xmlDir, encontradaPorClave);
                }
              }
            }
          }
        }
      }

      // Si se encontró el archivo XML en disco, parsearlo
      if (rutaXML && fs.existsSync(rutaXML)) {
        try {
          const contenidoXML = fs.readFileSync(rutaXML, 'utf-8');
          const parsed = parsearFacturaXML(contenidoXML);
          claveReal = parsed.claveNumerica;
          consecutivoReal = parsed.consecutivo;
          emisorNumeroReal = parsed.emisor?.cedula?.numero;
          emisorTipoReal = parsed.emisor?.cedula?.tipo;
          tipoDocReal = parsed.tipoDocumento;
        } catch (err) {
          console.warn(`  ⚠️ Error al parsear XML (${rutaXML}):`, err.message);
        }
      }

      // Fallback 1: Extraer de la clave de 50 dígitos en el nombre de archivo
      if ((!claveReal || claveReal.includes('e+')) && f.archivoXML) {
        const matchClave = f.archivoXML.match(/(506[0-9]{47})/);
        if (matchClave) {
          claveReal = matchClave[1];
          consecutivoReal = claveReal.substring(21, 41);
          const rawCedula = claveReal.substring(9, 21);
          emisorNumeroReal = rawCedula.replace(/^0+/, '');
          const tipoCodigo = consecutivoReal.substring(8, 10);
          tipoDocReal = TIPO_DOC_NOMBRES[tipoCodigo] || 'Factura Electrónica';
        }
      }

      // Fallback 2: Si el nombre de archivo tiene el consecutivo de 20 dígitos (ej. ...-FE-01000006010000180008.xml)
      if (!consecutivoReal && f.archivoXML) {
        const matchConsecutivo = f.archivoXML.match(/([0-9]{20})/);
        if (matchConsecutivo) {
          consecutivoReal = matchConsecutivo[1];
        }
      }

      // Si f.consecutivo no tiene 20 dígitos pero f.claveNumerica tiene 50 dígitos
      if (!consecutivoReal && f.claveNumerica && f.claveNumerica.length === 50 && !f.claveNumerica.includes('e+')) {
        consecutivoReal = f.claveNumerica.substring(21, 41);
      }

      const updates = {};
      const unsets = {};
      let huboCambio = false;

      // Actualizar o limpiar Clave
      if (claveReal && (f.claveNumerica !== claveReal || String(f.claveNumerica).includes('e+'))) {
        updates.claveNumerica = claveReal;
        huboCambio = true;
      } else if (!claveReal && f.claveNumerica && String(f.claveNumerica).includes('e+')) {
        // La clave está corrupta y no hay XML disponible para reconstruirla: remover clave corrupta para no mostrar e+
        console.log(`  🧹 [${f._id}] Removiendo clave corrupta "${f.claveNumerica}" (consecutivo conservado: "${f.consecutivo}")`);
        unsets.claveNumerica = 1;
        huboCambio = true;
        limpiadasEPlus++;
      }

      // Actualizar Consecutivo
      if (consecutivoReal && f.consecutivo !== consecutivoReal) {
        updates.consecutivo = consecutivoReal;
        huboCambio = true;
      }

      // Actualizar Cédula
      if (emisorNumeroReal && f.emisor?.cedula?.numero !== emisorNumeroReal) {
        updates['emisor.cedula.numero'] = emisorNumeroReal;
        if (emisorTipoReal) updates['emisor.cedula.tipo'] = emisorTipoReal;
        huboCambio = true;
      }

      // Actualizar Tipo Documento
      if (tipoDocReal && f.tipoDocumento !== tipoDocReal) {
        updates.tipoDocumento = tipoDocReal;
        huboCambio = true;
      }

      if (huboCambio) {
        // Manejo de duplicados de clave única
        if (updates.claveNumerica) {
          const duplicado = await Factura.findOne({ claveNumerica: updates.claveNumerica, _id: { $ne: f._id } });
          if (duplicado) {
            if (f.estado === 'error' || !f.resumenFactura?.totalComprobante) {
              console.log(`  🗑️ Eliminando registro duplicado incompleto ${f._id}`);
              await Factura.deleteOne({ _id: f._id });
              continue;
            } else if (duplicado.estado === 'error' || !duplicado.resumenFactura?.totalComprobante) {
              console.log(`  🗑️ Eliminando duplicado previo incompleto ${duplicado._id}`);
              await Factura.deleteOne({ _id: duplicado._id });
            } else {
              console.warn(`  ⚠️ Clave ya existe en ${duplicado._id}, omitiendo actualizar clave en ${f._id}`);
              delete updates.claveNumerica;
            }
          }
        }

        const queryUpdate = {};
        if (Object.keys(updates).length > 0) queryUpdate.$set = updates;
        if (Object.keys(unsets).length > 0) queryUpdate.$unset = unsets;

        if (Object.keys(queryUpdate).length > 0) {
          console.log(`  🔧 [${f._id}] Factura actualizada: Consecutivo=${updates.consecutivo || f.consecutivo}`);
          await Factura.updateOne({ _id: f._id }, queryUpdate);
          reparadas++;
        }
      } else {
        yaCorrectas++;
      }
    }

    console.log('\n======================================');
    console.log(`🎉 Resumen de Reparación:`);
    console.log(`   - Facturas examinadas: ${facturas.length}`);
    console.log(`   - Facturas reparadas / actualizadas: ${reparadas}`);
    console.log(`   - Claves corruptas 'e+' saneadas: ${limpiadasEPlus}`);
    console.log(`   - Facturas ya correctas o manuales: ${yaCorrectas}`);
    console.log('======================================\n');

  } catch (error) {
    console.error('❌ Error en proceso de reparación:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

if (require.main === module) {
  repararFacturas().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { repararFacturas };
