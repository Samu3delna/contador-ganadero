const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const { resolverDestinatario } = require('../services/ingestaFacturaService');

async function crearTenantYUsuario({ nombre, alias, email, cedula }) {
  const tenant = await Tenant.create({ nombreFinca: nombre, emailAlias: alias, plan: 'free' });
  const usuario = await Usuario.create({
    nombre,
    email,
    password: 'Password123!',
    cedula: { tipo: 'fisica', numero: cedula },
    tenantId: tenant._id,
    rol: 'owner',
  });
  return { tenant, usuario };
}

describe('Resolución de destinatario de facturas', () => {
  it('prioriza la cédula receptora del XML sobre el alias del correo', async () => {
    const receptor = await crearTenantYUsuario({
      nombre: 'Finca Receptora',
      alias: 'finca-receptora',
      email: 'receptora@finca.test',
      cedula: '109990888',
    });
    await crearTenantYUsuario({
      nombre: 'Finca del Alias',
      alias: 'finca-del-alias',
      email: 'alias@finca.test',
      cedula: '201234567',
    });

    const resultado = await resolverDestinatario({
      cedulaReceptor: '109990888',
      emailDestino: 'finca-del-alias@contadorganandero.com',
    });

    expect(String(resultado.usuario._id)).toBe(String(receptor.usuario._id));
    expect(String(resultado.tenantId)).toBe(String(receptor.tenant._id));
  });

  it('resuelve por tenantId explícito cuando no hay cédula ni usuario', async () => {
    const finca = await crearTenantYUsuario({
      nombre: 'Finca por ID',
      alias: 'finca-por-id',
      email: 'id@finca.test',
      cedula: '301234567',
    });

    const resultado = await resolverDestinatario({ tenantId: finca.tenant._id });

    expect(String(resultado.usuario._id)).toBe(String(finca.usuario._id));
    expect(String(resultado.tenantId)).toBe(String(finca.tenant._id));
  });
});


test('S-05: alias parciales, sufijos y correo personal no asignan finca', async () => {
  await crearTenantYUsuario({ nombre:'Esperanza',alias:'esperanza-abcd',email:'esperanza@example.test',cedula:'101110111' });
  await crearTenantYUsuario({ nombre:'Otra',alias:'otra-abcd',email:'otra@example.test',cedula:'202220222' });
  for (const alias of ['esperanza','abcd','inventado-abcd']) {
    const r=await resolverDestinatario({emailDestino:`${alias}@contadorganandero.com`});
    expect(r.usuario).toBeNull(); expect(r.tenantId).toBeNull();
  }
  const exacto=await resolverDestinatario({emailDestino:'esperanza-abcd@contadorganandero.com'});
  expect(exacto.tenantId).toBeTruthy();
});

test('S-05: cedula o telefono compartidos entre fincas quedan sin asignar sin fallback a alias',async()=>{
  const a=await crearTenantYUsuario({nombre:'A',alias:'finca-a',email:'a@ambiguo.test',cedula:'109990888'});
  const b=await crearTenantYUsuario({nombre:'B',alias:'finca-b',email:'b@ambiguo.test',cedula:'109990888'});
  await Usuario.updateMany({_id:{$in:[a.usuario._id,b.usuario._id]}},{$set:{telefono:'88887777'}});
  const ambigua=await resolverDestinatario({cedulaReceptor:'109990888',emailDestino:'finca-a@contadorganandero.com'});
  expect(ambigua.usuario).toBeNull();expect(ambigua.tenantId).toBeNull();
  expect((await resolverDestinatario({telefono:'+50688887777'})).usuario).toBeNull();
  expect((await resolverDestinatario({telefono:'+188887777'})).usuario).toBeNull();
});
