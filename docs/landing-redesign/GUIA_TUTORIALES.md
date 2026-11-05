# Guía de Grabación, Guiones y Storyboards de Tutoriales — ContadorGanadero

Fecha de actualización: 2026-11-04  
Rama: `feature/landing-saas-adsense-seo`

---

## 1. Instrucciones Generales de Grabación y Protocolo de Privacidad

Antes de grabar cualquiera de los 6 tutoriales iniciales definidos en [`frontend/src/data/learningContent.js`](../../frontend/src/data/learningContent.js), el equipo de producción debe aplicar las siguientes reglas obligatorias:

1. **Entorno y cuenta de demostración aislada**:
   - Utilizar exclusivamente un entorno local o de staging con una cuenta de prueba dedicada (`demo@fincaejemplo.cr`, nombre de finca: **Finca Ejemplo Santa Rosa**).
   - **Prohibido usar cuentas de clientes reales, bases de datos de producción o certificados `.p12` reales.**
2. **Datos 100% sintéticos y verificables**:
   - Todas las cifras, nombres de proveedores, compradores, números de clave de 50 dígitos y etiquetas (`tags`) de animales deben coincidir con los datos sintéticos especificados en esta guía.
   - Nunca mostrar números de cédula física o jurídica reales, teléfonos personales, correos reales ni tokens/variables de entorno.
3. **Fidelidad estricta a la interfaz real (`AUDITORIA_FUNCIONAL.md`)**:
   - Grabar únicamente las pantallas y botones que existen hoy en el código fuente (`DashboardPage.jsx`, `IngresosPage.jsx`, `FacturasPage.jsx`, `InventarioPage.jsx`, `CostosPage.jsx`).
   - No mencionar ni simular funciones inexistentes (rotación de potreros, conteo de ganado por fotos, modo sin conexión o presentación automática de impuestos ante Hacienda).
4. **Locución en español costarricense**:
   - Tono claro, práctico, respetuoso (voseo natural costarricense, sin exageraciones comerciales ni promesas de ahorro o rentabilidad garantizada).

---

## 2. Guiones y Storyboards Escena por Escena

---

### Tutorial 1: `conoce-contadorganadero` — Conoce ContadorGanadero
- **URL**: `/tutoriales/conoce-contadorganadero`
- **Duración objetivo**: 60–90 segundos
- **Módulo principal**: `/producto/dashboard`

| Escena | Tiempo | Pantalla / Vista | Acción en pantalla | Locución (Español CR) | Datos sintéticos y advertencias |
|---|---|---|---|---|---|
| **1. Ubicate en el panel** | 0:00 – 0:20 | `DashboardPage.jsx` (`/dashboard`) | Mostrar la barra lateral (`Sidebar`) y las 4 tarjetas superiores (`ResumenCards.jsx`). Señalar con el cursor Ingresos, Gastos, IVA cuatrimestral y Utilidad neta. | «Bienvenido a ContadorGanadero. Cuando ingresás a tu cuenta, el Dashboard te muestra en cuatro tarjetas los ingresos, gastos, el IVA estimado del cuatrimestre y la utilidad neta. Recordá que cada cifra resume únicamente los registros que hayas cargado.» | Finca Ejemplo Santa Rosa. Ingresos: `₡3.520.000`, Gastos: `₡1.980.000`, IVA: `₡18.500`, Utilidad: `₡1.540.000`. |
| **2. Recorré los documentos** | 0:20 – 0:42 | `FacturasPage.jsx` (`/facturas`) → `IngresosPage.jsx` (`/ingresos`) | Hacer clic en `Facturas` en el menú lateral para mostrar el listado de XML recibidos; luego abrir `Ingresos` para mostrar el historial de ventas registradas. | «En la sección Facturas podés consultar los comprobantes XML de tus compras. Y en Ingresos llevás el historial de tus ventas de ganado. Así mantenés separados los comprobantes recibidos de las ventas registradas.» | Proveedor ficticio: `Agroinsumos del Valle S.A.`. Comprador ficticio: `Subasta Ganadera Ejemplo`. |
| **3. Conectá producción y números** | 0:42 – 1:05 | `InventarioPage.jsx` (`/inventario`) → `CostosPage.jsx` (`/costos`) | Mostrar las pestañas `Bovinos`, `Aves`, `Peces` y `Colmenas` en Inventario; luego abrir `Costos` y mostrar las tarjetas de resumen por centro de costo. | «En Inventario organizás tus fichas de bovinos o tus lotes de aves, peces y colmenas. Luego, en Costos, consultás los indicadores por centro de costo para relacionar lo que invertís con lo que producís.» | Bovino tag `BOV-001`; Centro de costo `Lote Engorde Norte`. |
| **4. Elegí tu primer registro** | 1:05 – 1:25 | `DashboardPage.jsx` (`/dashboard`) | Volver al Dashboard y resaltar la nota de período fiscal en la esquina superior. | «No necesitás cargar todo el año el primer día. Empezá con un documento conocido, verificá cómo aparece en el historial y avanzá paso a paso con datos reales de tu actividad.» | Aclarar en pantalla: *«Datos sintéticos de demostración»*. |

---

### Tutorial 2: `dashboard` — Cómo utilizar el dashboard
- **URL**: `/tutoriales/dashboard`
- **Duración objetivo**: 2–4 minutos
- **Módulo principal**: `/producto/dashboard`

| Escena | Tiempo | Pantalla / Vista | Acción en pantalla | Locución (Español CR) | Datos sintéticos y advertencias |
|---|---|---|---|---|---|
| **1. Revisá el período** | 0:00 – 0:40 | `DashboardPage.jsx` (encabezado y botón `Refrescar`) | Señalar el indicador de período fiscal activo y pulsar el botón `Refrescar`. | «Antes de interpretar cualquier número en el Dashboard, comprobá qué período fiscal estás viendo. Si acabás de cargar una factura o una venta, usá el botón Refrescar para actualizar el resumen.» | Mostrar período `2026`. Si hubiera un error de red, indicar que se debe esperar a recuperar los datos antes de tomar decisiones. |
| **2. Leé las cuatro tarjetas** | 0:40 – 1:25 | `ResumenCards.jsx` dentro de `DashboardPage.jsx` | Recorrer una por una las tarjetas: Ingresos Totales, Gastos Totales, IVA Cuatrimestral y Utilidad Neta. | «Las primeras dos tarjetas suman tus ingresos y gastos registrados. La utilidad neta muestra la diferencia entre ambos, pero ojo: no equivale al saldo de tu cuenta bancaria. Y la tarjeta de IVA es una estimación del cuatrimestre que no reemplaza revisar documentos faltantes.» | Ingresos: `₡3.520.000`, Gastos: `₡1.980.000`, IVA: `₡18.500`, Utilidad: `₡1.540.000`. |
| **3. Compará los meses** | 1:25 – 2:10 | `TendenciaChart.jsx` (Ingresos vs. gastos mensuales) | Pasar el cursor sobre las barras/puntos de Enero, Febrero, Marzo y Abril para mostrar la variación mensual. | «En el gráfico mensual podés comparar ingresos contra gastos. Si ves un pico en un mes, revisá primero el historial: puede deberse a una venta estacional de animales o a la compra de alimento para varios meses, no necesariamente a un cambio de productividad.» | Enero: `₡740.000` / `₡420.000`; Febrero: `₡920.000` / `₡510.000`; Marzo: `₡810.000` / `₡460.000`; Abril: `₡1.050.000` / `₡590.000`. |
| **4. Abrí la conversación fiscal** | 2:10 – 2:55 | `GastosCategoriaList.jsx` y `ProyeccionFiscal.jsx` | Mostrar la distribución de gastos por categoría y el bloque de Proyección Fiscal. | «Más abajo encontrás tus gastos agrupados por categoría y la proyección fiscal anual. Usá este resumen para preparar tus consultas con tu contador. Recordá que el panel organiza estimaciones y no presenta declaraciones ante Hacienda.» | Categorías: `Alimentación (45%)`, `Insumos Veterinarios (20%)`. Advertencia visible: *«Estimación informativa, no constituye declaración oficial»*. |

---

### Tutorial 3: `registrar-ingresos` — Cómo registrar ingresos por venta de ganado
- **URL**: `/tutoriales/registrar-ingresos`
- **Duración objetivo**: 2–4 minutos
- **Módulo principal**: `/producto/ingresos`

| Escena | Tiempo | Pantalla / Vista | Acción en pantalla | Locución (Español CR) | Datos sintéticos y advertencias |
|---|---|---|---|---|---|
| **1. Prepará el respaldo** | 0:00 – 0:35 | `IngresosPage.jsx` (`/ingresos`) | Mostrar la vista principal de Ingresos y los documentos de referencia sintéticos antes de abrir el formulario. | «Para registrar un ingreso de forma ordenada, tené a mano la fecha de la operación, el tipo de ganado, la cantidad de cabezas, el precio unitario y el nombre del comprador. Si estás practicando, usá datos ficticios.» | Prohibido ingresar cédulas reales. Comprador sintético: `Comercializadora Ganadera del Norte (Demo)`. |
| **2. Completá la venta** | 0:35 – 1:25 | `FormularioIngreso.jsx` en `IngresosPage.jsx` | Pulsar nueva venta, seleccionar fecha `2026-04-15`, tipo de ganado `Novillos de engorde`, cantidad `2`, precio unitario `₡300.000` y comprador `Comercializadora Ganadera del Norte (Demo)`. | «Abrimos el formulario de nueva venta. Este formulario está diseñado para ventas de ganado por cabezas. Seleccionamos la fecha, el tipo de ganado, escribimos dos cabezas y un precio unitario de trescientos mil colones, junto con la descripción y el comprador.» | Advertir que no se deben convertir litros de leche o kilos en cabezas para forzar el formulario. |
| **3. Revisá el cálculo** | 1:25 – 2:00 | `FormularioIngreso.jsx` (resumen de subtotal e IVA) | Mostrar cómo el formulario calcula el subtotal (`₡600.000`) y el selector de tarifa de IVA. | «Verificá que dos cabezas a trescientos mil colones den el subtotal de seiscientos mil colones. Seleccioná la tarifa de impuesto únicamente según el tratamiento que hayas validado con tu contador para tu actividad.» | Subtotal: `₡600.000`. Aclarar que el ejemplo no prescribe una tarifa tributaria. |
| **4. Guardá y verificá** | 2:00 – 2:40 | Tabla de historial en `IngresosPage.jsx` | Hacer clic una sola vez en `Guardar`, esperar el mensaje de confirmación y señalar la nueva fila en el historial. | «Pulsamos Guardar una sola vez y esperamos la confirmación. Luego buscamos el registro en el historial para comprobar fecha, comprador y monto total. Tené presente que este registro es interno y no emite por sí solo una factura electrónica ante Hacienda.» | Confirmar fila en historial: `2026-04-15 · 2 cabezas · ₡600.000`. |

---

### Tutorial 4: `facturas-xml` — Cómo gestionar facturas XML
- **URL**: `/tutoriales/facturas-xml`
- **Duración objetivo**: 3–5 minutos
- **Módulo principal**: `/producto/facturas`

| Escena | Tiempo | Pantalla / Vista | Acción en pantalla | Locución (Español CR) | Datos sintéticos y advertencias |
|---|---|---|---|---|---|
| **1. Prepará un XML autorizado** | 0:00 – 0:45 | `FacturasPage.jsx` (`/facturas`) | Mostrar el listado de facturas y el botón para subir un archivo XML. | «El archivo XML de una factura electrónica contiene los datos estructurados del comprobante. Conservá siempre el archivo original sin editar sus etiquetas. Para este ejemplo usamos un XML sintético de prueba.» | Clave sintética de 50 dígitos de ejemplo: `50615042600310199999900100001010000000123100000001`. Emisor ficticio: `Agroinsumos del Valle S.A.`. |
| **2. Cargá el archivo** | 0:45 – 1:40 | Modal / selector de carga de XML en `FacturasPage.jsx` | Seleccionar `factura-demo-alimento.xml`, iniciar la carga y esperar la confirmación en pantalla. | «En la pantalla Facturas elegimos la opción de subir XML, seleccionamos nuestro archivo y esperamos la respuesta. Si aparece un mensaje de error, leelo con calma para verificar si el archivo está incompleto o repetido antes de volver a intentarlo.» | Archivo: `factura-demo-alimento.xml` (10 sacos de alimento concentrado 40 kg a `₡12.000` c/u = `₡120.000` + IVA 1% `₡1.200` = `₡121.200`). |
| **3. Inspeccioná el documento** | 1:40 – 2:45 | Vista de detalle de la factura en `FacturasPage.jsx` | Abrir el detalle de la factura recién cargada. Señalar proveedor, fecha, clave de 50 dígitos, líneas de detalle y categoría sugerida. | «Al abrir el detalle comprobamos proveedor, fecha, líneas e impuestos. La aplicación puede sugerir una categoría de gasto o identificar un insumo agropecuario, pero esa sugerencia siempre requiere tu revisión y no equivale a una resolución fiscal.» | Mostrar líneas: `10 x Alimento Concentrado 40kg — ₡120.000`. Advertir que la recepción en la app no equivale a aceptación fiscal ante Hacienda. |
| **4. Consultá los adjuntos** | 2:45 – 3:30 | Acciones de descarga en `FacturasPage.jsx` | Mostrar los botones de descarga de XML/PDF cuando están disponibles en el registro. | «Desde el registro podés descargar el XML o el PDF cuando hayan sido cargados. Recordá que la recepción automática por correo o WhatsApp depende de la configuración de tu cuenta.» | No prometer recepción automática si no se muestra la configuración previamente verificada. |

---

### Tutorial 5: `inventario` — Cómo utilizar el inventario
- **URL**: `/tutoriales/inventario`
- **Duración objetivo**: 3–5 minutos
- **Módulo principal**: `/producto/inventario`

| Escena | Tiempo | Pantalla / Vista | Acción en pantalla | Locución (Español CR) | Datos sintéticos y advertencias |
|---|---|---|---|---|---|
| **1. Elegí la especie** | 0:00 – 0:45 | `InventarioPage.jsx` (`/inventario`) | Recorrer las 4 pestañas del módulo: `Bovinos`, `Aves`, `Peces` y `Colmenas`. | «En Inventario podés organizar cuatro tipos de unidades productivas: fichas individuales de bovinos, lotes de aves, estanques de peces y colmenas. Cada pestaña tiene campos pensados para esa actividad.» | Mostrar conteo inicial sintético: `25 Bovinos`, `2 Lotes de aves`, `1 Estanque`, `4 Colmenas`. |
| **2. Registrá un bovino de prueba** | 0:45 – 1:45 | Formulario de nuevo bovino en `InventarioPage.jsx` | Abrir el formulario en la pestaña `Bovinos`, ingresar tag `BOV-026`, nombre `Lucero (Demo)`, raza `Brahman`, sexo `Macho`, peso `340 kg` y estado sanitario `Vacunación al día`. | «Para registrar un bovino asignamos un identificador interno único, en este caso BOV-026, junto con la raza, el sexo y el último peso conocido. Si no conocés una fecha o un dato, es preferible dejarlo pendiente antes que inventarlo.» | Tag: `BOV-026`, Raza: `Brahman`, Peso: `340 kg`. |
| **3. Verificá y editá** | 1:45 – 2:35 | Listado y modal de edición en `InventarioPage.jsx` | Guardar la ficha, buscar `BOV-026` en la lista, abrir `Editar`, actualizar el peso a `355 kg` tras un nuevo pesaje y guardar. | «Una vez guardado, localizamos la ficha BOV-026 en la tabla. Si realizaste un nuevo pesaje en condiciones comparables, abrís Editar, actualizás el peso a trescientos cincuenta y cinco kilos y confirmás el cambio.» | Aclarar que el registro de peso y notas sanitarias es administrativo y no sustituye el criterio de un médico veterinario. |
| **4. Revisá otras unidades** | 2:35 – 3:25 | Pestañas `Aves`, `Peces` y `Colmenas` en `InventarioPage.jsx` | Cambiar brevemente a las pestañas de `Aves` y `Colmenas` para mostrar cómo se registran por lote o colmena. | «A diferencia de los bovinos, las aves y los peces se administran por lote o estanque, y las abejas por colmena. Tené en cuenta que este módulo organiza tus existencias; no incluye rotación de potreros ni conteo automático por fotografías.» | Lote sintético: `Lote Postura A-01 (120 aves)`. |

---

### Tutorial 6: `costos-produccion` — Cómo interpretar los costos de producción
- **URL**: `/tutoriales/costos-produccion`
- **Duración objetivo**: 2–4 minutos
- **Módulo principal**: `/producto/costos`

| Escena | Tiempo | Pantalla / Vista | Acción en pantalla | Locución (Español CR) | Datos sintéticos y advertencias |
|---|---|---|---|---|---|
| **1. Revisá los datos de origen** | 0:00 – 0:45 | `CostosPage.jsx` (`/costos`) | Mostrar la pantalla de Costos con un centro de costo sintético previamente cargado (`Lote Engorde Norte — Abril 2026`). | «Para que un indicador de costos sea útil, los insumos consumidos y la producción obtenida deben corresponder al mismo grupo y al mismo período. En esta pantalla consultamos los indicadores calculados a partir de esos registros.» | No mostrar ni mencionar botones de formulación de dietas ni funciones que no existan en `CostosPage.jsx`. |
| **2. Leé el resumen** | 0:45 – 1:30 | Tarjetas superiores en `CostosPage.jsx` | Señalar `Costo Total Insumos`, `Ingreso Total Ventas` y `Margen Operativo`. | «En la parte superior vemos el Costo Total de Insumos registrados, el Ingreso Total por Ventas asociadas y el Margen Operativo resultante. Si todavía faltan costos por registrar, como mano de obra o transporte, tomá este margen como un resultado parcial.» | Costo Total Insumos: `₡960.000`; Producción del período: `800 kg` de ganancia de peso. |
| **3. Compará unidades** | 1:30 – 2:15 | Tabla / tarjetas de indicadores unitarios en `CostosPage.jsx` | Señalar el costo por kilogramo (`₡1.200 / kg`) y la relación de conversión alimenticia (`5,0 kg de alimento / kg ganado`). | «Mirá este ejemplo: novecientos sesenta mil colones divididos entre ochocientos kilos ganados dan un costo registrado de mil doscientos colones por kilo. Y cuatro mil kilos de alimento entre esos ochocientos kilos dan una razón de cinco a uno. Solo compará períodos que usen exactamente la misma unidad.» | Costo unitario: `₡1.200 / kg`; Alimento consumido: `4.000 kg`; FCA: `5,0`. |
| **4. Identificá una acción** | 2:15 – 2:55 | Vista general de `CostosPage.jsx` | Resaltar las notas del centro de costo y comparar con el período anterior. | «Si el costo por unidad cambió de un mes a otro, preguntate primero si varió el precio del insumo, la producción o si quedó una factura pendiente de registrar. Así usás los números para definir una mejora concreta para el próximo cierre.» | Advertencia final: *«Los indicadores dependen de los datos registrados y no garantizan un ahorro ni una rentabilidad determinada»*. |

---

## 3. Lista de Control Post-Grabación (QA Audiovisual)

Antes de publicar cualquier archivo `.mp4` en `frontend/public/videos/`, el revisor debe marcar cada punto:

- [ ] ¿Se utilizó únicamente la cuenta sintética **Finca Ejemplo Santa Rosa** sin datos personales ni cédulas reales?
- [ ] ¿Todas las pantallas mostradas corresponden exactamente a la versión actual de `frontend/src/pages/`?
- [ ] ¿Se incluyeron los subtítulos sincronizados en español (`.es.vtt`) y se verificó que `VideoPlayer` los carga por defecto?
- [ ] ¿La locución incluye las aclaraciones de alcance (las estimaciones no sustituyen al contador ni equivalen a declaraciones presentadas ante Hacienda)?
- [ ] ¿El archivo `.mp4` tiene `movflags +faststart` y pesa menos de 25 MB para facilitar su reproducción en conexiones móviles?
