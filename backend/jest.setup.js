require('dotenv').config({ path: '../.env' });

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

jest.setTimeout(Number(process.env.JEST_TIMEOUT_MS) || 120000);

let mongod;

function requiereMongoParaEsteArchivo() {
  const testPath = expect.getState().testPath || '';
  const unitariosSinMongo = [
    'clave50.test.js',
    'xmlBuilder.test.js',
    'quotaGuard.test.js',
    'chatController.test.js',
  ];
  return !unitariosSinMongo.some((name) => testPath.endsWith(name));
}

beforeAll(async () => {
  if (!requiereMongoParaEsteArchivo()) return;

  const testUri = process.env.MONGODB_TEST_URI;

  if (testUri) {
    await mongoose.connect(testUri);
    return;
  }

  try {
    mongod = await MongoMemoryServer.create({
      binary: process.env.MONGOMS_VERSION ? { version: process.env.MONGOMS_VERSION } : undefined,
    });
    await mongoose.connect(mongod.getUri());
  } catch (error) {
    throw new Error(
      `No se pudo iniciar MongoDB de pruebas. ` +
      `Configura MONGODB_TEST_URI para usar una instancia local/CI o permite la descarga de mongodb-memory-server. ` +
      `Detalle: ${error.message}`,
      { cause: error }
    );
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
