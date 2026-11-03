# Revisión final del cambio local

Se revisó el diff del árbol de trabajo, incluidas rutas alternativas y archivos nuevos. No se hizo reset, checkout, limpieza de archivos ajenos ni commit. El diff contra HEAD incluye la integración SDK que ya estaba presente al comenzar; no representa exclusivamente cambios de esta remediación.

Comprobaciones conservadas:

- CORS dinámico en server; ONVO montado antes del parser JSON global; cookies y withCredentials cross-origin conservados.
- Permisos y tenant en rutas de negocio, configuración fiscal y rutas heredadas. Los tests API verifican cuatro roles y dos fincas; free no puede consultar ni exportar D-150.
- Hacienda SDK fijado en 0.12.1. Parser mantiene parseTagValue:false. Outbox y contadores permanecen en MongoDB. Tests comprueban worker concurrente, incertidumbre de transporte y consulta sin repetir POST.
- REP real bloqueado también si se intenta saltar la ruta dedicada; simulación reserva saldo atómicamente y solo libera borradores sin envío.
- Refresh explícito de AuthContext e interceptor comparten una misma promesa, además del CAS del servidor. La sesión MFA conserva los campos públicos usados para precargar emisor y no incluye certificado.
- Identidades duplicadas entre fincas por cédula/teléfono quedan sin asignar; no se resuelven por orden de consulta ni por fallback a alias. Los alias aproximados se rechazan.
- Ingesta y eliminación persisten antes del éxito; errores recuperables no se anuncian como finalizados. No se asigna el primer PDF arbitrariamente.
- Ceros, descuentos y exoneraciones contrastados entre proyecciones. Los originales fiscales no se reescriben.
- Nuevas dependencias de testing frontend registradas en package.json y bun.lock. Pruebas DOM ejecutadas con JSDOM y adaptadores simulados, sin navegador ni proveedores productivos.
- Diff sin errores de whitespace. No se eliminaron archivos rastreados; se conservaron pruebas existentes y expectativas de seguridad.

Se registran como límites externos el navegador real Cloudflare/Render, aceptación sandbox, correo y ONVO reales. Los avisos de índice duplicado y tamaño del bundle permanecen visibles, sin ocultarlos ni elevar límites para silenciarlos. Ver informe-final.md para pasos operativos.
