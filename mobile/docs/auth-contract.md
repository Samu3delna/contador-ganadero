# Contrato móvil

Base: /api/mobile/auth. JSON; Cache-Control: no-store; sin Set-Cookie.
El cliente no acepta ni envía tenantId arbitrario.

| POST | Solicitud | Resultado |
|---|---|---|
| /login | email, password; opcional totpCode o backupCode heredado | Sesión o desafío |
| /registro | nombre, email, password, nombreFinca opcional, aceptaTerminos:true | 201 + sesión |
| /mfa/verify | mfaToken y totpCode (6 dígitos) o backupCode | Sesión |
| /refresh | refreshToken | Tokens nuevos |
| /logout | refreshToken | mensaje |

Sesión: {accessToken, refreshToken, expiresIn, user}.
Desafío: {mfaRequired:true, mfaToken, mensaje}; no entrega access ni refresh.
Refresh: {accessToken, refreshToken, expiresIn}; luego GET /api/auth/perfil para identidad actual.
expiresIn expresa segundos restantes del access token firmado, no una constante desconectada de JWT_EXPIRE.

Claims compartidos: id, tenantId, rol, tokenVersion, mfaVerifiedAt, iss y aud.
Refresh agrega type:refresh, jti y familyId. La base guarda hash del jti.
La familia se rota con compare-and-set; el token anterior deja de servir. El refresh rechaza cambios de tenant en la identidad de base de datos.
Los límites generales y específicos de auth se conservan.

Operaciones existentes con bearer:
- GET /api/auth/perfil
- POST /api/auth/logout-all
- POST /api/auth/forgot-password (público, respuesta no enumerante)
- GET /api/dashboard/resumen
- GET /api/facturas?page=1&limit=20&estado=revision
- GET /api/facturas/:id, /:id/xml, /:id/pdf
- POST /api/facturas/upload, multipart campo archivoXML, máximo 2 MB
- POST /api/facturas/manual
- GET/POST /api/ingresos; DELETE /api/ingresos/:id
- GET /api/inventario y /resumen; POST /bovinos, /aves, /peces, /colmenas
- GET /api/impuestos/proyeccion
- GET /api/declaraciones y /api/declaraciones/:id

Errores conservan error/mensaje/codigo según middleware existente. El cliente normaliza el texto visible.
400 entrada inválida; 401 credenciales/sesión; 402 tenant suspendido; 403 permiso/suspensión; 423 bloqueo temporal; 429 límite; 503 indisponibilidad.
415 archivo no XML; el XML inválido devuelve 400. Carga manual: extensión .xml y MIME XML/octet-stream, límite de 2 MB y tenant derivado de la sesión incluso ante otro receptor dentro del XML.
Los errores de transporte no se interpretan como revocación definitiva.

Compatibilidad web: /api/auth conserva respuesta token y cookie httpOnly, path, sameSite y secure existentes.
No se cambian webhooks, CORS, configuración Hacienda, ONVO ni cálculos fiscales.
