# Pendientes de Hacienda después de integrar el SDK

Actualizado: 1 de noviembre de 2026.

La implementación y el procedimiento vigente están en [HACIENDA_SDK.md](HACIENDA_SDK.md). Este archivo sustituye el checklist anterior, que contenía códigos de documento, namespaces e instrucciones de firma incorrectos.

## Completado localmente

- SDK 0.12.1 fijado; puente ESM/CommonJS.
- Claves oficiales, XML con validación XSD, firma XAdES-EPES, OAuth y recepción.
- Configuración cifrada por finca; sin credenciales globales como fallback.
- Contadores atómicos, outbox MongoDB y reconciliación de intentos inciertos.
- Formulario de emisor/configuración, ubicación, referencia FEC y sesión de React.
- Pruebas con SDK real, P12 sintético, transporte simulado y MongoDB efímero.

## Pendiente antes de habilitar emisión productiva

1. Conciliar credenciales, identidad fiscal y consecutivos existentes con el titular. Reconfigurar secretos antiguos si fueron cifrados con AAD incorrecto.
2. Revisar los documentos firmados por el motor anterior consultando su clave, sin reenvíos ni sustituciones automáticas.
3. Ejecutar y documentar aceptación controlada en sandbox de cada tipo y caso monetario que se usará. No confundir éxito de OAuth o validación XSD con aceptación fiscal.
4. Validar REP real: distribución del pago e IVA, tarifas mixtas, exoneraciones, redondeos y reservas concurrentes de saldo. Actualmente solo simulación.
5. Definir recuperación operativa de envíos que Hacienda no reconoce sin introducir reenvíos ciegos ni falsos rechazos.
6. Abordar las incidencias contables y de declaraciones identificadas en la auditoría general; son un alcance separado de sustituir el motor de comprobantes.

## Referencias

- [Anexo oficial Hacienda v4.4](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/S/2020-2029/2020-2024/2024/1936C/1701B7.HTML)
- [SDK 0.12.1](https://github.com/DojoCodingLabs/hacienda-cr/releases/tag/v0.12.1)
- [Corrección sandbox documentada por el mantenedor](https://github.com/DojoCodingLabs/hacienda-cr/blob/main/docs/testing/sandbox-403-debug.md)
