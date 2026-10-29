const path = require('path');

const originalUploadRoot = process.env.UPLOAD_ROOT;
process.env.UPLOAD_ROOT = path.join(path.parse(process.cwd()).root, 'contador-ganadero-persistent-test-uploads');
const { resolverRutaArchivoSegura } = require('../controllers/facturaController');

afterAll(() => {
  if (originalUploadRoot === undefined) delete process.env.UPLOAD_ROOT;
  else process.env.UPLOAD_ROOT = originalUploadRoot;
});

describe('Persistent upload storage path', () => {
  it('resolves the relative file paths stored by invoice ingestion under UPLOAD_ROOT', () => {
    const ruta = resolverRutaArchivoSegura(path.join('uploads', 'xml', 'factura.xml'));
    expect(ruta).toBe(path.join(process.env.UPLOAD_ROOT, 'xml', 'factura.xml'));
  });

  it('rejects file paths that escape UPLOAD_ROOT', () => {
    expect(resolverRutaArchivoSegura(path.join('uploads', '..', '..', 'outside.xml'))).toBeNull();
  });
});
