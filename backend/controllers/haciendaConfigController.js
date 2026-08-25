const Tenant = require('../models/Tenant');
const haciendaWorker = require('../services/haciendaWorker');
const { firmarDocumento } = require('../services/hacienda').signer;
const { buildXml } = require('../services/hacienda').xmlBuilder;
const { generarClave } = require('../services/hacienda').clave50;
const { getToken } = require('../services/hacienda').auth;

/**
 * GET /api/hacienda/config
 * Obtiene el estado de la configuración Hacienda del tenant actual (sin secrets)
 */
const obtenerConfig = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    const hc = tenant.configuracionHacienda || {};

    res.json({
      configurado: hc.estaConfigurado?.() || false,
      ambiente: hc.ambiente || 'local',
      sucursal: hc.sucursal || '001',
      terminal: hc.terminal || '00001',
      codigoActividad: hc.codigoActividad || '000000',
      configuradoEn: hc.configuradoEn || null,
      ultimoError: hc.ultimoError || null,
      // No devolver: certificadoP12Base64, pinCertificado, usuarioHacienda, passwordHacienda
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/hacienda/config
 * Guarda/actualiza la configuración Hacienda del tenant actual
 * Body: { ambiente, certificadoP12Base64, pinCertificado, usuarioHacienda, passwordHacienda, sucursal, terminal, codigoActividad }
 */
const guardarConfig = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    const {
      ambiente,
      certificadoP12Base64,
      pinCertificado,
      usuarioHacienda,
      passwordHacienda,
      sucursal,
      terminal,
      codigoActividad,
    } = req.body;

    // Validaciones
    if (!ambiente || !['local', 'sandbox', 'produccion'].includes(ambiente)) {
      res.status(400);
      throw new Error('Ambiente inválido: debe ser local, sandbox o produccion');
    }

    if (ambiente !== 'local') {
      if (!certificadoP12Base64) {
        res.status(400);
        throw new Error('certificadoP12Base64 es obligatorio para sandbox/produccion');
      }
      if (!pinCertificado) {
        res.status(400);
        throw new Error('pinCertificado es obligatorio');
      }
      if (!usuarioHacienda || !usuarioHacienda.startsWith('cpf-')) {
        res.status(400);
        throw new Error('usuarioHacienda debe ser un usuario Hacienda válido (cpf-...)');
      }
      if (!passwordHacienda) {
        res.status(400);
        throw new Error('passwordHacienda es obligatorio');
      }
    }

    // Validar formato del certificado (debe ser base64 válido)
    if (certificadoP12Base64) {
      try {
        const base64Data = certificadoP12Base64.includes('base64,')
          ? certificadoP12Base64.split('base64,')[1]
          : certificadoP12Base64;
        Buffer.from(base64Data, 'base64');
      } catch (e) {
        res.status(400);
        throw new Error('certificadoP12Base64 no es un Base64 válido');
      }
    }

    // Actualizar configuración
    tenant.configuracionHacienda = tenant.configuracionHacienda || {};
    tenant.configuracionHacienda.ambiente = ambiente;
    tenant.configuracionHacienda.sucursal = sucursal || '001';
    tenant.configuracionHacienda.terminal = terminal || '00001';
    tenant.configuracionHacienda.codigoActividad = codigoActividad || '000000';

    if (certificadoP12Base64) {
      tenant.configuracionHacienda.certificadoP12Base64 = certificadoP12Base64;
    }
    if (pinCertificado) {
      tenant.configuracionHacienda.establecerPinCertificado(pinCertificado);
    }
    if (usuarioHacienda) {
      tenant.configuracionHacienda.usuarioHacienda = usuarioHacienda;
    }
    if (passwordHacienda) {
      tenant.configuracionHacienda.establecerPasswordHacienda(passwordHacienda);
    }

    tenant.configuracionHacienda.configuradoEn = new Date();
    tenant.configuracionHacienda.ultimoError = null;

    await tenant.save();

    res.json({
      mensaje: 'Configuración Hacienda guardada correctamente',
      configurado: tenant.configuracionHacienda.estaConfigurado(),
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/hacienda/config/test
 * Prueba la conexión a Hacienda y firma un XML de prueba
 */
const probarConexion = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    const hc = tenant.configuracionHacienda || {};

    if (!hc.estaConfigurado?.()) {
      res.status(400);
      throw new Error('Configuración Hacienda incompleta');
    }

    const cfg = haciendaWorker.getTenantConfig(tenant);

    // 1. Probar autenticación (obtener token)
    let token;
    try {
      token = await getToken({
        ambiente: cfg.ambiente,
        usuario: cfg.usuario,
        password: cfg.password,
      });
    } catch (e) {
      tenant.configuracionHacienda.ultimoError = `Auth falló: ${e.message}`;
      await tenant.save();
      res.status(422);
      throw new Error(`Error de autenticación: ${e.message}`);
    }

    // 2. Generar XML de prueba y firmar
    const facturaPrueba = {
      tipoDocumento: 'FE',
      ambiente: cfg.ambiente,
      claveNumerica: '506' + '010124' + '000000000123' + '00100001010000000001' + '123456789',
      consecutivo: '00100001010000000001',
      codigoActividadEmisor: cfg.codigoActividad,
      indicadorAutomatico: '0',
      fechaEmision: new Date(),
      emisor: {
        nombre: 'Finca Prueba',
        nombreComercial: 'Finca Prueba',
        cedula: { tipo: '01', numero: '123456789' },
        telefono: '22223333',
        correo: 'test@finca.com',
        provincia: '1', canton: '01', distrito: '01', barrio: '01',
        ubicacion: 'San José',
      },
      receptor: {
        nombre: 'Cliente Prueba',
        cedula: { tipo: '02', numero: '3101234567' },
        telefono: '22224444',
        correo: 'cliente@test.com',
        provincia: '1', canton: '01', distrito: '01', barrio: '01',
      },
      condicionVenta: '01',
      medioPago: ['04'],
      plazoCredito: '0',
      lineaDetalle: [{
        numeroLinea: 1,
        codigo: '5010150100000',
        descripcion: 'Servicio de prueba',
        cantidad: 1,
        unidadMedida: 'Sp',
        precioUnitario: 10000,
        subtotal: 10000,
        descuento: { monto: 0 },
        impuesto: { codigo: '01', codigoTarifa: '02', tarifa: 1, monto: 100, factorIVA: 0.01 },
        impuestoNeto: 100,
        montoTotal: 10100,
      }],
      resumenFactura: {
        totalServGravados: 0,
        totalServExentos: 0,
        totalMercanciasGravadas: 10000,
        totalMercanciasExentas: 0,
        totalGravado: 10000,
        totalExento: 0,
        totalVenta: 10000,
        totalDescuentos: 0,
        totalVentaNeta: 10000,
        totalImpuesto: 100,
        totalComprobante: 10100,
      },
    };

    const xml = buildXml(facturaPrueba);
    let xmlFirmado;
    try {
      xmlFirmado = firmarDocumento(xml, {
        p12Base64: cfg.p12Base64,
        pin: cfg.pin,
        cacheKey: cfg.tenantId,
        ambiente: cfg.ambiente,
      });
    } catch (e) {
      tenant.configuracionHacienda.ultimoError = `Firma falló: ${e.message}`;
      await tenant.save();
      res.status(422);
      throw new Error(`Error firmando XML: ${e.message}`);
    }

    // 3. Si es ambiente local, simular éxito
    if (cfg.ambiente === 'local') {
      tenant.configuracionHacienda.ultimoError = null;
      await tenant.save();
      return res.json({
        success: true,
        mensaje: 'Configuración válida (ambiente local - simulación)',
        token: token?.access_token ? 'OK' : 'MOCK',
        xmlFirmado: xmlFirmado.length > 100 ? xmlFirmado.substring(0, 200) + '...' : xmlFirmado,
      });
    }

    // 4. En sandbox/produccion: enviar a Hacienda (solo test de recepción)
    const { enviarComprobante } = require('../services/hacienda').recepcion;
    const documento = {
      clave: facturaPrueba.claveNumerica,
      fecha: facturaPrueba.fechaEmision.toISOString(),
      emisorTipoId: '01',
      emisorNumeroId: '123456789',
      receptorTipoId: '02',
      receptorNumeroId: '3101234567',
      xmlFirmado,
    };

    const resp = await enviarComprobante({
      ambiente: cfg.ambiente,
      documento,
      token,
      credenciales: { usuario: cfg.usuario, password: cfg.password },
    });

    if (resp.httpStatus === 201) {
      tenant.configuracionHacienda.ultimoError = null;
      await tenant.save();
      res.json({
        success: true,
        mensaje: 'Conexión exitosa con Hacienda',
        location: resp.location,
        clave: facturaPrueba.claveNumerica,
      });
    } else {
      tenant.configuracionHacienda.ultimoError = `Envío falló: ${JSON.stringify(resp.error)}`;
      await tenant.save();
      res.status(422);
      throw new Error(`Error enviando a Hacienda: ${JSON.stringify(resp.error)}`);
    }
  } catch (error) { next(error); }
};

/**
 * DELETE /api/hacienda/config
 * Elimina la configuración Hacienda del tenant
 */
const eliminarConfig = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    tenant.configuracionHacienda = {
      ambiente: 'local',
      sucursal: '001',
      terminal: '00001',
      codigoActividad: '000000',
    };
    await tenant.save();
    res.json({ mensaje: 'Configuración Hacienda eliminada' });
  } catch (error) { next(error); }
};

module.exports = {
  obtenerConfig,
  guardarConfig,
  probarConexion,
  eliminarConfig,
};