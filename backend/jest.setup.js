const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Configurar variables de entorno sintéticas seguras para pruebas (nunca leer .env real)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-automated-tests-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-automated-tests-32!!';
process.env.EMAIL_ENC_KEY = process.env.EMAIL_ENC_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}, 30000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}, 30000);
