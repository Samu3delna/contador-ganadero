# Integración Hacienda SDK — resultado local

La primera etapa integra `@dojocoding/hacienda-sdk@0.12.1` con claves, XML/XSD, firma XAdES-EPES, OAuth, recepción y consulta, conservando MongoDB y aislamiento por finca.

- Backend: 192 pruebas Jest + 26 pruebas SDK/integración = **218 aprobadas**.
- Frontend: **44 aprobadas**; ESLint y build correctos.
- Sin despliegue, llamadas reales a Hacienda, cambios de `.env` ni certificados reales.
- REP real bloqueado hasta validar la distribución fiscal de pagos.
- Falta aceptación controlada en sandbox antes de emitir en producción.
- Configuraciones antiguas con AAD incorrecto requieren recargar certificado, PIN y contraseña. No resetear contadores.

La guía completa y las decisiones operativas están en [docs/HACIENDA_SDK.md](../../docs/HACIENDA_SDK.md). Evidencias: [backend-tests.log](backend-tests.log), [frontend-lint.log](frontend-lint.log), [frontend-build.log](frontend-build.log), [validacion.json](validacion.json).

Los artifacts de Deska no están disponibles en esta tarea. Este informe se guardó en el proyecto.
