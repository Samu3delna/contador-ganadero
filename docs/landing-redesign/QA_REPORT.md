# Validaci?n final del sitio p?blico

Fecha: 2026-11-06. Base: `65550d3`. Rama: `feature/landing-saas-adsense-seo`.

Este informe sustituye las conclusiones generales anteriores para el cierre actual. Los resultados se limitan a lo ejecutado en el entorno local.

| Validaci?n | Resultado real |
|---|---|
| `npm run lint --workspace frontend` | PASS, sin errores ni warnings |
| `npm test --workspace frontend` | PASS, 68 pruebas |
| `npm run build --workspace frontend` | PASS, 28 p?ginas prerenderizadas, 32 URLs en sitemap |
| Playwright / Edge headless | PASS, 180 comprobaciones |
| P?ginas responsive | 32 rutas ? 320, 375, 768, 1024 y 1440 px: 160 PASS |
| Men?, demo y p?ginas inexistentes | 20 comprobaciones dirigidas: PASS |
| Rutas privadas con App y AuthProvider reales | 4 pruebas incluidas en las 68: usuario autenticado, an?nimo, usuario com?n y superadministrador |
| Revisi?n de capturas | Capturas m?vil y escritorio inspeccionadas; estilos aplicados y sin desbordamiento en el alcance probado |
| `git diff --check` | PASS |

## Evidencia y reproducci?n

- `qa/report.json`: resultado consolidado. Incluye referencias a la primera ejecuci?n y al reintento dirigido.
- `qa/initial-report.json`: conserva 8 falsos negativos del script original. Se corrigi? el reconocimiento del texto ?No encontramos? y se esper? el H1 de la p?gina de destino antes de operar la demo; la URL sola no garantiza que la ruta lazy ya haya terminado de renderizar.
- `qa/retry/report.json`: reintento de las interacciones con esperas corregidas, 20/20 PASS.
- `frontend/scripts/public-qa.mjs`: suite reproducible. Ejecutar desde ra?z con preview local en `http://127.0.0.1:4173` y `PLAYWRIGHT_MODULE` apuntando a `playwright/index.mjs`. Durante este cierre se instal? Playwright en `%TEMP%/cg-public-qa`, fuera de las dependencias del proyecto. Usa Edge mediante `channel: msedge`.
- `qa/*--.png`: capturas completas por ancho.

## Cambios comprobados

Las rutas privadas usan un layout con Outlet en lugar de Routes descendientes bajo rutas exactas. Las pruebas comprueban la navegaci?n y los permisos con respuestas API sint?ticas.

El build fuerza NODE_ENV=production sin alterar el .env de desarrollo del backend. Login y chat se cargan de forma diferida. El bundle principal local pas? de 846,23 kB a 387,82 kB, sin comprimir. El CSS p?blico se incluye en el HTML prerenderizado.

No se observaron errores JavaScript no capturados, overflow horizontal ni scripts, slots o solicitudes AdSense en el recorrido p?blico. La pol?tica contin?a enabled=false, approved=false y sin rutas aprobadas. Esto no acredita aprobaci?n de Google.

## L?mites y pendientes externos

Las llamadas API y recursos externos se bloquearon en las pruebas del navegador. No se comprob? login contra una cuenta real, correo, WhatsApp, emisi?n oficial Hacienda, pagos ONVO ni una sesi?n productiva Pro. Las pruebas de permisos y de pol?tica publicitaria s? usan datos sint?ticos.

No se ejecut? Lighthouse ni se acredita cumplimiento WCAG completo o Core Web Vitals de campo. El video del login pesa aproximadamente 7,2 MB y su optimizaci?n queda fuera de este cierre. Las cuatro p?ginas legales del sitemap se renderizan con JavaScript, no est?n entre los 28 HTML prerenderizados.

Los tutoriales son gu?as escritas; los videos est?n pendientes de grabaci?n y no se anuncian como disponibles. Search Console y el panel de AdSense requieren revisi?n externa. No hubo despliegue ni cambios de servicios productivos.

Deska Artifacts no est? disponible. La vista est?tica autocontenida se guarda en `artifacts/contador-publico-revision.html`; no constituye una publicaci?n ni una grabaci?n de la aplicaci?n.
