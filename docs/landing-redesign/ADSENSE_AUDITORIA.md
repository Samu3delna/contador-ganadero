# AdSense: auditoría y control de activación

Fecha: 2026-11-03. Estado: **desactivado; aprobación de Google no confirmada**.

## Hallazgos comprobados

Antes del cambio, `frontend/index.html` cargaba `adsbygoogle.js` globalmente. `App.jsx` montaba `AdvertisingSlot` sobre las pantallas privadas y la landing también lo importaba. El componente podía insertar un script antes de comprobar si finalmente renderizaba una ubicación y mostraba un espacio reservado cuando faltaba configuración. El filtrado por plan no resolvía explícitamente sesión en carga ni datos contradictorios de plan.

No se puede atribuir el rechazo informado a una única URL. Google restringe anuncios en páginas sin contenido editorial, de poco valor, en construcción o dedicadas principalmente a navegación; la revisión humana de contenido sigue siendo necesaria. [Política oficial](https://support.google.com/publisherpolicies/answer/11112688?hl=en).

## Correcciones implementadas

- `src/config/adPolicy.js`: interruptores independientes `enabled=false`, `approved=false`, lista de rutas revisadas vacía. Las variables de entorno por sí solas no activan anuncios.
- `AdvertisingSlot.jsx`: puerta de elegibilidad por ruta exacta, contenido listo, sesión resuelta, consentimiento afirmativo y configuración válida. Bloquea Pro, plan desconocido y administrador. Si cualquiera de las fuentes de plan indica Pro, bloquea.
- `AdPlacement.jsx`: montaje únicamente elegible, una solicitud por instancia y cancelación de solicitudes pendientes al desmontar. La navegación cambia la clave de la ubicación.
- `adsenseLoader.js`: promesa compartida, un único script, reintento después de error. No existe carga global.
- Sin placeholders en rutas bloqueadas ni antes de aprobación.
- `index.html` conserva el editor mediante la meta `google-adsense-account`, método admitido por Google sin cargar publicidad. [Conectar sitio](https://support.google.com/adsense/answer/7584263?hl=en).

## Ubicaciones

| Pantalla | Política |
|---|---|
| Landing, login, registro, precios, planes, checkout, perfil, administración, legales | Bloqueadas |
| Aplicación privada, formularios, cargas, errores, páginas vacías | Bloqueadas |
| Índices de academia y tutoriales | Bloqueados |
| Artículo o tutorial individual sustancial | Candidato a revisión manual futura; ninguno habilitado |
| Cualquier pantalla para Pro | Bloqueada |

El componente no está integrado en los nuevos artículos. No habilitarlo en layouts globales. Una futura ubicación debe estar después del contenido, separada de botones, enlaces de navegación y acciones de formulario.

## Verificación técnica

- Editor existente: `ca-pub-1077407420035302`.
- `frontend/public/ads.txt` conserva `google.com, pub-1077407420035302, DIRECT, f08c47fec0942fa0`.
- Consulta HTTP directa de `https://contadorganadero.com/ads.txt`: **200**, contenido coincide con el archivo local. El navegador de búsqueda no pudo abrirlo; PowerShell sí confirmó la respuesta.
- La nueva meta está comprobada en el checkout mediante prueba automatizada. **Todavía no está desplegada**.
- No se inspeccionó una sesión del panel AdSense ni Search Console; propiedad aceptada por Google, estado de revisión y anuncios automáticos permanecen sin verificar.
- `node --test frontend/tests/adPolicy.test.js`: **6/6 pasan**. Incluye denegación por ruta, consentimiento, sesión, plan, configuración; verificación estática y simulación de carga/error del script con JSDOM. No llama a Google ni prueba anuncios reales.

## Consentimiento y navegación SPA

El valor `consent` es una interfaz de integración, **no una CMP implementada**. Se mantiene en `unknown` por defecto. Antes de publicidad real, integrar y verificar una solución de consentimiento según el tráfico y la configuración publicitaria. Google exige CMP certificada con TCF para publicidad personalizada en EEE, Reino Unido y Suiza. [Requisitos oficiales](https://support.google.com/adsense/answer/13554116?hl=en), [configuración](https://support.google.com/adsense/answer/7670013?hl=en).

Desmontar una ubicación SPA evita nuevas solicitudes propias, pero no descarga código de terceros ya ejecutado. Antes de activar: deshabilitar anuncios automáticos en AdSense, validar exclusiones y probar navegación desde contenido elegible a rutas bloqueadas y cambio de plan. No asumir que retirar una etiqueta script revierte su ejecución. Si se requiere ausencia total del runtime tras abandonar una página elegible, separar esas páginas mediante navegación de documento completo. Con los interruptores actuales el runtime nunca se carga.

## Checklist para nueva solicitud

1. Revisar editorialmente el contenido original, afirmaciones del producto, navegación, contacto y políticas de privacidad.
2. Desplegar solo tras autorización; confirmar meta y ads.txt públicos en el dominio exacto.
3. En AdSense → Sitios → contadorganadero.com, seleccionar meta/ads.txt como verificación y confirmar el editor. Verificar y solicitar revisión.
4. Mantener anuncios automáticos y ubicaciones desactivados durante la revisión; verificar el estado real en el panel.
5. Resolver avisos concretos que Google presente. No prometer aprobación ni plazo.
6. Tras aprobación y autorización separada: integrar CMP, revisar política de privacidad/proveedores, elegir una ruta editorial, validar posición y configurar su bloque real.
7. Ejecutar pruebas de navegación, consentimiento denegado/revocado, Pro y sesión en carga antes de cambiar interruptores. Registrar evidencia de aprobación y autorización en la revisión del cambio.
