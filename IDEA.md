🐄 AeroContador AI — Módulo de Conteo Aéreo y Drones para Contador Ganadero

1. Resumen Ejecutivo

AeroContador AI es una extensión inteligente para Contador Ganadero (contadorganandero.com) que transforma un ordenador (PC) en una Estación de Mando y Auditoría Ganadera impulsada por un Agente de IA en Hermes (Soul Engine).

El sistema permite procesar vuelos de drones (en tiempo real vía RTSP/Telemetría o mediante videos grabados en MP4) directamente en el ordenador para contar cabezas de ganado automáticamente, detectar animales rezagados, evaluar el estado de los potreros y sincronizar las discrepancias con la base de datos en MongoDB.

2. Problema que Resuelve

Conteo manual lento e inexacto: Contar ganado en potreros extensos o con pasturas altas (Brizantha, Mombaca, Humidicola, etc.) consume horas de trabajo a caballo o a pie.

Doble conteo por movimiento: Cuando el ganado camina durante el conteo, es fácil contar dos veces al mismo animal o perder de vista terneros.

Desconexión entre el campo y el software: Los datos obtenidos en vuelos de dron suelen quedarse en videos sueltos en una tarjeta SD sin actualizar automáticamente el inventario del sistema ganadero.

Costo de hardware en el dron: Procesar IA a bordo del dron encarece el equipo y reduce el tiempo de batería. Al procesar todo en el ordenador (PC), se puede usar cualquier dron comercial o ensamblado.

3. Arquitectura del Sistema (Enfoque 100% en Ordenador / PC)

+-------------------------------------------------------------------------+
|                        ORDENADOR CENTRAL (PC / GCS)                     |
|                                                                         |
|  +-----------------------+        MCP / Tools        +---------------+  |
|  | Agente Hermes (Soul)  | <-----------------------> | Servidor MCP  |  |
|  | (Cerebro de Misión)   |                           | (Node/Python) |  |
|  +-----------------------+                           +-------+-------+  |
|              |                                               |          |
|              v                                               v          |
|  +-----------------------+                           +---------------+  |
|  | Motor de Visión (PC)  | <---- Video / Stream ---- | Enlace Dron / |  |
|  | YOLOv8/v11 + ByteTrack|                           | MSP / MAVLink |  |
|  +-----------------------+                           +---------------+  |
+--------------|----------------------------------------------------------+
               | REST API / WebSockets (JSON + Capturas)
               v
+-------------------------------------------------------------------------+
|                 PLATAFORMA WEB: CONTADOR GANADERO (MERN)                |
|                                                                         |
|   [ React Frontend ] <---> [ Node.js + Express API ] <---> [ MongoDB ]  |
+-------------------------------------------------------------------------+


Componentes Principales:

Cerebro Orquestador (Hermes + Soul): Recibe instrucciones en lenguaje natural del ganadero o administrador, coordina la ejecución en la PC y analiza los resultados.

Motor de Visión Computacional (Local en PC): Script en Python con aceleración por GPU/CPU usando YOLO (detección de ganado Brahman/otros) + ByteTrack / BoT-SORT (asignación de ID único por animal para evitar el doble conteo).

Protocolos de Comunicación (MCP + MSP/MAVLink):

MCP (Model Context Protocol): Conecta el agente Hermes con el sistema de archivos de la PC, el script de visión y la API de Contador Ganadero.

MSP (MultiWii Serial Protocol) / MAVLink: Permite a la PC leer telemetría (GPS, batería, altitud) o enviar rutas de barrido en zigzag (grid) al controlador de vuelo o simulador.

Integración Full-Stack (MERN): El backend en Express recibe el reporte final, actualiza el historial del potrero en MongoDB y muestra alertas en el dashboard de React.

4. Herramientas del Servidor MCP para Hermes

Para que el agente en Hermes opere de forma autónoma desde el ordenador, el servidor MCP expondrá las siguientes herramientas (Tools):

obtener_inventario_potrero(potreroId)

Consulta en MongoDB (contadorganandero.com) cuántas cabezas de ganado y qué lotes están registrados actualmente en ese potrero.

iniciar_conteo_aereo(fuenteVideo, potreroId, mostrarVentana)

Ejecuta en el ordenador el modelo YOLO + ByteTrack sobre un archivo .mp4 o stream rtsp://.

Devuelve un JSON con el total de IDs únicos detectados, nivel de confianza promedio y ruta de las capturas de evidencia.

telemetria_dron_msp(puertoSerial) (Opcional para vuelos controlados por PC)

Lee las coordenadas GPS, altitud y voltaje de batería del dron conectado por radio/USB mediante protocolo MSP/MAVLink.

registrar_auditoria_hato(potreroId, esperados, detectados, evidenciaUrl, notasAgente)

Guarda el resultado del conteo en MongoDB y dispara una alerta en React si detectados != esperados.

5. Flujo de Usuario (Caso de Uso Paso a Paso)

Orden Inicial: El usuario abre la consola o chat conectado a Hermes en su PC y escribe:

"Analiza el video del vuelo de hoy en el Potrero El Ceibo (vuelo_ceibo.mp4) y verifica si están los novillos completos según Contador Ganadero."

Consulta de Base de Datos: Hermes invoca obtener_inventario_potrero("el-ceibo") y descubre que debe haber 55 novillos Brahman.

Procesamiento Visual en PC: Hermes invoca iniciar_conteo_aereo("vuelo_ceibo.mp4", "el-ceibo"). En la pantalla del ordenador se abre el visor marcando cada animal con su caja delimitadora e ID único (ID #1, ID #2... ID #53).

Cruce de Datos y Alerta: Al terminar el video, el motor reporta 53 animales únicos.

Sincronización con la Web: Hermes invoca registrar_auditoria_hato(...) enviando los datos a contadorganandero.com y responde al usuario:

"Auditoría completada en Potrero El Ceibo. Se contabilizaron 53 de los 55 novillos registrados (Discrepancia: -2 cabezas). Se ha guardado el reporte y las capturas con marca de tiempo en Contador Ganadero para revisión en campo."

6. Estructura de Datos (Esquema Sugerido para MongoDB)

Nueva colección AuditoriasAereas en el backend de Contador Ganadero:

{
  "_id": "6711bc902f8b9c0015a4d123",
  "fincaId": "finca_san_carlos_01",
  "potreroId": "potrero_el_ceibo",
  "fechaVuelo": "2026-10-17T21:00:00Z",
  "origen": "PC_HERMES_AGENT",
  "conteoEsperado": 55,
  "conteoDetectado": 53,
  "diferencia": -2,
  "estado": "ALERTA_FALTANTE",
  "metricasIA": {
    "modelo": "yolov8m-cattle-custom",
    "tracker": "ByteTrack",
    "confianzaPromedio": 0.91,
    "duracionProcesamientoSeg": 42
  },
  "capturasEvidencia": [
    "/uploads/auditorias/ceibo_frame_1020.jpg"
  ],
  "observacionesAgente": "Se detectaron 51 animales agrupados cerca del bebedero norte y 2 animales aislados en el extremo sur. Faltan 2 cabezas respecto al inventario."
}


7. Hoja de Ruta (Roadmap de Implementación)

Fase 1: Motor de Visión Local en PC (Semana 1-2)

Configurar entorno Python en el ordenador (PyTorch + Ultralytics YOLO + OpenCV).

Probar el conteo sin duplicados usando ByteTrack con videos aéreos de ganado grabados en MP4.

Fase 2: Construcción del Servidor MCP y Prompt en Hermes (Semana 3)

Crear el servidor MCP que envuelva el script de Python y se conecte a los endpoints de Express de contadorganandero.com.

Configurar el System Prompt de Hermes en Soul para que actúe como Auditor Ganadero Autónomo.

Fase 3: Integración con Dashboard MERN (Semana 4)

Crear la vista de "Auditorías con Dron" en React dentro de Contador Ganadero para visualizar el historial de vuelos, diferencias de inventario y fotos aéreas.

Fase 4: Telemetría en Vivo y Simulador (Semana 5+)

Integrar repositorios de telemetría (MSP / MAVLink) o simuladores en PC para vuelos automatizados por coordenadas GPS de cada potrero.

8. Espacio para Integración de Repositorios

(Al agregar los enlaces a los repositorios, se conectarán bajo esta estructura):

Repositorio 1 (Detección/Tracking): Se integrará como módulo dentro del servicio local de Python en la PC.

Repositorio 2 (Control/MSP/Dron): Se expondrá mediante puerto serie/UDP al servidor MCP para lectura de telemetría.

Repositorio 3 (Agente/MCP): Servirá como puente directo hacia la API REST de contadorganandero.com.
