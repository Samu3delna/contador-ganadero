# Migracion Tenant (Backfill)

Script de migracion backfill para modo SaaS multi-tenant.

## Que hace

Asigna `tenantId` a datos existentes creados antes del modo SaaS:

1. Busca usuarios con `tenantId` nulo o inexistente.
2. Para cada uno crea un `Tenant` (1 Tenant = 1 Usuario dueño, plan `free`).
3. Asigna `tenantId` y `rol='dueno'` al usuario.
4. Propaga `tenantId` a todos los documentos del usuario en los modelos:
   Factura, FacturaEmision, Ingreso, Inventario, Declaracion,
   CostoProduccion, RecordatorioFiscal, ChatFeedback.
5. `Categoria` NO se toca (catalogo global).

## Ejecutar

Simulacion (no escribe nada):

```bash
cd backend && npm run migrate:tenant -- --dry-run
```

Ejecucion real:

```bash
cd backend && npm run migrate:tenant
```

## Backup previo

Antes de ejecutar, haz un respaldo de la base de datos:

```bash
mongodump --uri="$MONGODB_URI" --out=./backup_pre_tenant
```

## Idempotencia

El script es seguro de re-ejecutar:

- Usuarios que ya tienen `tenantId` son omitidos.
- Documentos con `tenantId` existente se excluyen via `$exists: false`.

## Solucion de problemas

- **Error de conexion MongoDB**: verifica `MONGODB_URI` en `backend/.env`.
- **Modelo no encontrado**: asegurate que todos los `require` en
  `scripts/migrateTenant.js` corresponden a archivos existentes en `models/`.
- **Tenant duplicado**: si ya existe un Tenant para un usuario, el script
  puede fallar en `crearParaUsuario`; elimina documentos huergfanos o corre el
  script completo desde cero tras restaurar el backup.
