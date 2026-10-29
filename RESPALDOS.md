# Procedimiento de Respaldos Cifradas y Recuperación ante Desastres (DRP)

## 1. Objetivos de Recuperación (RPO / RTO)

- **RPO (Recovery Point Objective)**: **24 horas** mediante respaldos diarios automatizados (o **continuo / 1 hora** con Point-in-Time Recovery de MongoDB Atlas en clústeres M10+).
- **RTO (Recovery Time Objective)**: **< 2 horas** para restaurar datos y levantar servicios en Render y Cloudflare.

## 2. Generación de Respaldo Cifrado (AES-256-GCM + SHA-256)

1. Generar una llave exclusiva para respaldos (`BACKUP_ENCRYPTION_KEY`, 64 caracteres hex) distinta de `EMAIL_ENC_KEY`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Simular el respaldo sin escribir en disco (`--dry-run`):
   ```bash
   cd backend
   node scripts/backup-mongodb.js --dry-run
   ```
3. Ejecutar respaldo cifrado:
   ```bash
   cd backend
   node scripts/backup-mongodb.js --output-dir=./backups
   ```
   Se generarán dos archivos:
   - `backup-YYYY-MM-DDTHH-mm-ss.cgbk` (comprimido con gzip y cifrado con AES-256-GCM).
   - `backup-YYYY-MM-DDTHH-mm-ss.cgbk.sha256` (checksum SHA-256 del paquete cifrado).

## 3. Verificación y Restauración en Base de Datos Temporal

1. Validar integridad y contenido sin modificar la base (`dryRun: true` por defecto):
   - El script verifica primero el hash SHA-256 y luego el `AuthTag` de 16 bytes de AES-256-GCM antes de descomprimir.
2. Para probar la restauración periódica trimestral, apuntar `MONGODB_URI` a una base temporal aislada (`contador_ganadero_dr_test`) y ejecutar la restauración verificada.
