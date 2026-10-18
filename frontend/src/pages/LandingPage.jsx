import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Tractor,
  ArrowRight,
  Check,
  Wallet,
  Smartphone,
  Laptop,
  Sprout,
  ChevronRight,
  Sparkles,
  Dna,
  Stethoscope,
} from 'lucide-react';
import useSeo from '../hooks/useSeo';
import fondoGanadero from '../assets/fondo-ganadero.webm';
import './LandingPage.css';

// Datos interactivos para el Mockup del Hero (Lotes de la Finca)
const LOTES_HERO = {
  todos: {
    nombre: 'Hato Completo · Finca La Esmeralda',
    totalCabezas: 428,
    desglose: [
      { categoria: 'Vacas en producción', cantidad: 164, cambio: '+6.2%', color: 'text-emerald-400' },
      { categoria: 'Novillos de engorde', cantidad: 132, cambio: '+0.94 kg/día', color: 'text-emerald-400' },
      { categoria: 'Terneros y crías', cantidad: 114, cambio: '96.5% destete', color: 'text-amber-400' },
      { categoria: 'Toros reproductores', cantidad: 18, cambio: '100% activos', color: 'text-gray-300' },
    ],
    gdpPromedio: '0.92 kg/día',
    pesoPromedio: '442 kg',
    curvaPeso: [
      { mes: 'May', peso: 348, meta: 340 },
      { mes: 'Jun', peso: 369, meta: 360 },
      { mes: 'Jul', peso: 392, meta: 382 },
      { mes: 'Ago', peso: 416, meta: 404 },
      { mes: 'Sep', peso: 442, meta: 425 },
      { mes: 'Oct', peso: 468, meta: 448 },
    ],
    potreros: [
      { id: 'P-01', nombre: 'El Roble (Brachiaria)', estado: 'En ocupación · Día 2/4', carga: '2.6 UGM/ha', tipo: 'ocupado' },
      { id: 'P-02', nombre: 'La Quebrada (Estrella)', estado: 'Descanso · Día 24/28', carga: 'Óptimo en 4d', tipo: 'optimo' },
      { id: 'P-03', nombre: 'Los Llanos (Mombaza)', estado: 'Listo para pastoreo', carga: '3,400 kg MS/ha', tipo: 'listo' },
    ],
    finanzas: {
      ingresosMes: '₡14,850,000',
      costosOperativos: '₡6,420,000',
      margenNeto: '56.8%',
      costoPorCabeza: '₡15,000 / mes',
      ahorroIvaRea: '₡412,500',
    },
  },
  engorde: {
    nombre: 'Lote 01 · Engorde Intensivo',
    totalCabezas: 132,
    desglose: [
      { categoria: 'Novillos Brahman', cantidad: 84, cambio: '+1.08 kg/día', color: 'text-emerald-400' },
      { categoria: 'Toretes F1 Nelore', cantidad: 48, cambio: '+0.98 kg/día', color: 'text-emerald-400' },
      { categoria: 'Meta salida subasta', cantidad: 520, cambio: 'kg objetivo', color: 'text-amber-400' },
      { categoria: 'Conversión alimenticia', cantidad: 6.4, cambio: 'kg MS / kg carne', color: 'text-gray-300' },
    ],
    gdpPromedio: '1.04 kg/día',
    pesoPromedio: '486 kg',
    curvaPeso: [
      { mes: 'May', peso: 375, meta: 365 },
      { mes: 'Jun', peso: 398, meta: 386 },
      { mes: 'Jul', peso: 421, meta: 408 },
      { mes: 'Ago', peso: 444, meta: 430 },
      { mes: 'Sep', peso: 466, meta: 452 },
      { mes: 'Oct', peso: 486, meta: 472 },
    ],
    potreros: [
      { id: 'P-04', nombre: 'Vega del Río (Mombaza)', estado: 'En ocupación · Día 1/3', carga: '3.1 UGM/ha', tipo: 'ocupado' },
      { id: 'P-05', nombre: 'Alto Mirador (Toledo)', estado: 'Listo para entrada', carga: '3,800 kg MS/ha', tipo: 'listo' },
      { id: 'P-06', nombre: 'Corral Viejo (Suplem.)', estado: 'En recuperación · Día 16/25', carga: 'Fertiliz. aplicada', tipo: 'optimo' },
    ],
    finanzas: {
      ingresosMes: '₡8,920,000',
      costosOperativos: '₡3,610,000',
      margenNeto: '59.5%',
      costoPorCabeza: '₡27,348 / mes',
      ahorroIvaRea: '₡248,000',
    },
  },
  lecheria: {
    nombre: 'Lote 02 · Lechería Alta Producción',
    totalCabezas: 164,
    desglose: [
      { categoria: 'Vacas en ordeño', cantidad: 138, cambio: '18.4 L/día prom.', color: 'text-emerald-400' },
      { categoria: 'Vacas secas próximas', cantidad: 26, cambio: 'Parto < 30 días', color: 'text-amber-400' },
      { categoria: 'Sólidos totales', cantidad: 12.8, cambio: '% bonificación', color: 'text-emerald-400' },
      { categoria: 'Intervalo entre partos', cantidad: 388, cambio: 'días promedio', color: 'text-gray-300' },
    ],
    gdpPromedio: '18.4 L/vaca',
    pesoPromedio: '512 kg',
    curvaPeso: [
      { mes: 'May', peso: 410, meta: 400 },
      { mes: 'Jun', peso: 428, meta: 415 },
      { mes: 'Jul', peso: 445, meta: 430 },
      { mes: 'Ago', peso: 468, meta: 450 },
      { mes: 'Sep', peso: 490, meta: 470 },
      { mes: 'Oct', peso: 512, meta: 485 },
    ],
    potreros: [
      { id: 'L-01', nombre: 'Aparto Ordeño A (Estrella)', estado: 'Rotación diaria · Franja 4', carga: '3.4 UGM/ha', tipo: 'ocupado' },
      { id: 'L-02', nombre: 'Aparto Ordeño B (Kikuyo)', estado: 'Listo mañana 6:00 AM', carga: '4,100 kg MS/ha', tipo: 'listo' },
      { id: 'L-03', nombre: 'Aparto Sombra (Brizantha)', estado: 'Descanso · Día 21/24', carga: 'En rebrote', tipo: 'optimo' },
    ],
    finanzas: {
      ingresosMes: '₡5,930,000',
      costosOperativos: '₡2,810,000',
      margenNeto: '52.6%',
      costoPorCabeza: '₡17,134 / mes',
      ahorroIvaRea: '₡164,500',
    },
  },
};

// Ejemplares para la Tarjeta 1 del Bento Grid (Inventario y Trazabilidad Individual)
const EJEMPLARES_TRAZABILIDAD = [
  {
    arete: 'CR-0482',
    nombre: 'Sultán del Pacífico',
    raza: 'Brahman Rojo Puro',
    categoria: 'Toro Reproductor · Lote Cría',
    edad: '34 meses',
    pesoActual: '648 kg',
    ultimoPesaje: 'Hace 4 días (+24 kg en 30d)',
    gdp: '+0.89 kg/día',
    condicionCorporal: '4.2 / 5.0',
    padre: 'CR-0109 · Monarca Red (Reg. ASocebú)',
    madre: 'CR-0218 · Emperatriz 44 (Línea Lechera)',
    sanidad: [
      { vacuna: 'Ivermectina + Vitamina ADE', fecha: '12 Oct 2026', estado: 'Vigente' },
      { vacuna: 'Clostridiosis Polivalente 9 Vías', fecha: '04 Ago 2026', estado: 'Vigente' },
      { vacuna: 'Prueba Brucelosis / Tuberculosis', fecha: '18 Jul 2026', estado: 'Negativo Oficial' },
    ],
  },
  {
    arete: 'CR-0914',
    nombre: 'Duquesa de San Carlos',
    raza: 'Gyrolando F1 Plus',
    categoria: 'Vaca en Producción · 2° Parto',
    edad: '42 meses',
    pesoActual: '524 kg',
    ultimoPesaje: 'Hace 6 días (+19.8 L/día)',
    gdp: '19.8 L/día',
    condicionCorporal: '3.8 / 5.0',
    padre: 'BR-4410 · Sansão Gyr Lechero',
    madre: 'CR-0390 · Reina Holstein 12',
    sanidad: [
      { vacuna: 'Control Mastitis California (CMT)', fecha: '15 Oct 2026', estado: 'Libre 4 cuartos' },
      { vacuna: 'Suplementación Mineral Fosforada', fecha: '01 Oct 2026', estado: 'Activa' },
      { vacuna: 'Refuerzo Reproductivo IBR / DVB', fecha: '22 Jun 2026', estado: 'Vigente' },
    ],
  },
  {
    arete: 'CR-1108',
    nombre: 'Relámpago de Guanacaste',
    raza: 'Nelore Mocho',
    categoria: 'Novillo de Engorde · Lote 01',
    edad: '21 meses',
    pesoActual: '492 kg',
    ultimoPesaje: 'Ayer (+32 kg en 30d)',
    gdp: '+1.07 kg/día',
    condicionCorporal: '4.5 / 5.0',
    padre: 'CR-0142 · Titán Nelore',
    madre: 'CR-0512 · Flor de Cañas',
    sanidad: [
      { vacuna: 'Implante Promotor + Desparasitante', fecha: '10 Oct 2026', estado: 'En protocolo' },
      { vacuna: 'Carbón Sintomático Triple', fecha: '19 Ago 2026', estado: 'Vigente' },
      { vacuna: 'Trazabilidad Salida Subasta', fecha: 'Programada Nov', estado: 'Listo en 24 días' },
    ],
  },
];

// Planes de suscripción (Sección de Precios)
const PLANES_GANADEROS = [
  {
    id: 'free',
    nombre: 'Finca Pequeña / Productor',
    subtitulo: 'Ideal para digitalizar tu primer hato bovino y abandonar el cuaderno de apuntes.',
    precioMensual: 0,
    precioAnual: 0,
    destacado: false,
    ctaTexto: 'Comenzar gratis ahora',
    caracteristicas: [
      'Hasta 50 cabezas de ganado con ficha individual',
      'Control básico de hasta 6 potreros y pesajes',
      'Recepción de hasta 30 facturas mensuales por correo',
      'Cálculo de IVA agropecuario 1% REA (D-135-1)',
      'Acceso desde celular en el corral y computadora',
    ],
  },
  {
    id: 'pro',
    nombre: 'Hacienda Profesional',
    subtitulo: 'Control integral de lotes, pastoreo rotacional, trazabilidad genética y finanzas REA.',
    precioMensual: 10,
    precioAnual: 8,
    destacado: true,
    etiqueta: 'Más Popular',
    ctaTexto: 'Probar Hacienda Profesional',
    caracteristicas: [
      'Hato bovino y lotes ilimitados con genealogía completa',
      'Optimizador de rotación de potreros y carga animal (UGM/ha)',
      'Bot de WhatsApp para registrar pesajes, partos y facturas',
      'Facturación electrónica Hacienda v4.4 y declaraciones D-135 / D-101',
      'Costo real por kilo producido y flujo de caja en tiempo real',
      'Sin anuncios publicitarios y exportación contable en 1 clic',
    ],
  },
  {
    id: 'agroempresa',
    nombre: 'Agroempresa',
    subtitulo: 'Para operaciones multi-finca, lecherías tecnificadas, subastas y asesores agropecuarios.',
    precioMensual: 29,
    precioAnual: 24,
    destacado: false,
    ctaTexto: 'Contactar para Agroempresa',
    caracteristicas: [
      'Gestión multi-finca consolidada desde un único panel',
      'Accesos por rol para capataces, veterinarios y contador',
      'Integración con lectores de bastón RFID / aretes electrónicos',
      'Auditoría tributaria avanzada D-150 y centros de costo por actividad',
      'Soporte prioritario por WhatsApp e implementación asistida',
    ],
  },
];

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Contador Ganadero',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android',
  url: 'https://contadorganadero.com',
  description:
    'Aplicación web moderna para la gestión integral de fincas, control de inventario bovino, pastoreo rotacional y finanzas agropecuarias.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '29',
    priceCurrency: 'USD',
    offerCount: '3',
  },
};

export default function LandingPage() {
  const navigate = useNavigate();

  useSeo({
    title: 'Contador Ganadero | Gestión Integral de Fincas, Inventario Bovino y Finanzas Agropecuarias',
    description:
      'Gestiona tu hato bovino, optimiza la rotación de potreros, registra pesos, vacunas y controla la rentabilidad de tu finca en tiempo real desde cualquier dispositivo.',
    path: '/',
    jsonLd: ORGANIZATION_SCHEMA,
  });

  // Estados interactivos para el Mockup y Bento Grid
  const [loteActivo, setLoteActivo] = useState('todos');
  const [ejemplarIdx, setEjemplarIdx] = useState(0);
  const [dispositivoCampo, setDispositivoCampo] = useState('corral');
  const [cicloAnual, setCicloAnual] = useState(false);
  const [potreroSeleccionado, setPotreroSeleccionado] = useState(0);

  const datosLote = useMemo(() => LOTES_HERO[loteActivo] || LOTES_HERO.todos, [loteActivo]);
  const ejemplarActual = EJEMPLARES_TRAZABILIDAD[ejemplarIdx] || EJEMPLARES_TRAZABILIDAD[0];

  const POTREROS_BENTO = [
    { codigo: 'Potrero 01 · El Roble', pasto: 'Brachiaria brizantha', ocupacion: 3, descansoMeta: 28, descansoActual: 28, ugm: '2.6 UGM/ha', estado: 'En pastoreo (Día 3 de 4)', alerta: false },
    { codigo: 'Potrero 02 · La Vega', pasto: 'Estrella Africana', ocupacion: 4, descansoMeta: 26, descansoActual: 25, ugm: '2.9 UGM/ha', estado: 'Listo mañana · Aforo alto', alerta: false },
    { codigo: 'Potrero 03 · Mirador', pasto: 'Panicum Mombaza', ocupacion: 5, descansoMeta: 30, descansoActual: 14, ugm: '2.2 UGM/ha', estado: 'En recuperación (Día 14 de 30)', alerta: true },
  ];

  const potreroBento = POTREROS_BENTO[potreroSeleccionado] || POTREROS_BENTO[0];

  const irARegistro = (planId = 'free') => {
    navigate('/login', { state: { registro: true, plan: planId } });
  };

  return (
    <div className="min-h-screen bg-[#070B09] text-white font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
      {/* =====================================================================
          1. NAVBAR FLOTANTE (Sticky & Glassmorphism — Top Bar Contract)
          ===================================================================== */}
      <div className="fixed top-4 inset-x-0 z-50 mx-auto max-w-6xl px-4 sm:px-6">
        <header className="rounded-full bg-black/55 backdrop-blur-xl border border-white/10 px-5 sm:px-7 py-3 flex items-center justify-between gap-8 shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
          {/* Zona 1: Brand Wordmark (una sola línea, sin subtítulos anexos) */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
              <Tractor size={17} />
            </span>
            <span>Contador Ganadero</span>
          </Link>

          {/* Zona 2: Enlaces de navegación (4 enlaces limpios en una línea) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-300" aria-label="Navegación principal">
            <a
              href="#funciones"
              className="hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Funciones
            </a>
            <a
              href="#pastoreo"
              className="hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Pastoreo
            </a>
            <a
              href="#finanzas"
              className="hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Finanzas
            </a>
            <a
              href="#precios"
              className="hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline"
            >
              Precios
            </a>
          </nav>

          {/* Zona 3: Acciones de acceso */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/login"
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-gray-300 hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 rounded-full"
            >
              Iniciar Sesión
            </Link>
            <button
              type="button"
              onClick={() => irARegistro('free')}
              className="px-4 sm:px-5 py-2 rounded-full bg-[#10B981] hover:bg-emerald-400 text-[#070B09] font-semibold text-xs sm:text-sm transition-all duration-150 shadow-[0_0_24px_rgba(16,185,129,0.4)] hover:shadow-[0_0_32px_rgba(16,185,129,0.65)] whitespace-nowrap shrink-0"
            >
              Probar Gratis
            </button>
          </div>
        </header>
      </div>

      {/* =====================================================================
          2. HERO SECTION DE ALTO IMPACTO (Con Video de Fondo + Mockup Cristal)
          ===================================================================== */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        {/* Video de fondo original (compartido con Login) */}
        <video
          className="landing-hero-video opacity-45"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        >
          <source src={fondoGanadero} type="video/webm" />
        </video>

        {/* Scrim de contraste medido para legibilidad WCAG AA sobre el video */}
        <div
          className="
            absolute inset-0 z-0 pointer-events-none
            bg-gradient-to-b from-[#070B09]/70 via-[#070B09]/80 to-[#070B09]
          "
        />

        {/* Resplandor radial esmeralda difuminado detrás del Hero */}
        <div
          className="
            absolute top-24 left-1/2 -translate-x-1/2 z-0 pointer-events-none
            w-[820px] h-[420px] rounded-full
            bg-emerald-500/15 blur-[130px]
          "
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Encabezado centrado del Hero */}
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
            {/* Kicker luminoso */}
            <a
              href="#funciones"
              className="group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-emerald-500/30 hover:border-emerald-400/60 text-xs sm:text-sm text-emerald-300 mb-6 transition-all duration-200 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
            >
              <Sparkles size={14} className="text-emerald-400 shrink-0" />
              <span>Nuevo: Control inteligente de lotes y trazabilidad bovina</span>
              <ChevronRight size={14} className="text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </a>

            {/* Headline H1 */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-6"
              style={{ textWrap: 'balance' }}
            >
              El control total de tu ganadería,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-300">
                sin papeles ni complicaciones.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-[#9CA3AF] leading-relaxed max-w-2xl mb-9">
              Gestiona tu hato bovino, optimiza la rotación de potreros, registra pesos, vacunas y controla la rentabilidad de tu finca en tiempo real desde cualquier dispositivo.
            </p>

            {/* CTAs Primario y Secundario */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 w-full sm:w-auto mb-14">
              <button
                type="button"
                onClick={() => irARegistro('free')}
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#10B981] hover:bg-emerald-400 text-[#070B09] font-bold text-sm sm:text-base transition-all duration-150 shadow-[0_0_32px_rgba(16,185,129,0.4)] hover:shadow-[0_0_45px_rgba(16,185,129,0.65)] whitespace-nowrap shrink-0"
              >
                <span>Comenzar ahora — Es Gratis</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#mockup-interactivo"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/40 text-white font-semibold text-sm sm:text-base transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <span>Ver demostración interactiva</span>
              </a>
            </div>
          </div>

          {/* =================================================================
              HERO VISUAL (MOCKUP UI EN MARCO DE CRISTAL INTERACTIVO)
              ================================================================= */}
          <div id="mockup-interactivo" className="relative mx-auto max-w-6xl">
            {/* Resplandor perimetral detrás del Mockup */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-emerald-500/25 via-emerald-500/5 to-transparent blur-xl pointer-events-none" />

            <div className="relative rounded-2xl bg-[#0D1512]/90 backdrop-blur-xl border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.75)] overflow-hidden">
              {/* Barra superior de la ventana del Dashboard + Selector interactivo de Lote */}
              <div className="px-4 sm:px-6 py-3.5 bg-[#070B09]/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-300 truncate">
                    {datosLote.nombre}
                  </span>
                </div>

                {/* Selector funcional de lote para explorar datos en vivo */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/10">
                  {[
                    { id: 'todos', label: 'Hato Completo (428)' },
                    { id: 'engorde', label: 'Lote Engorde (132)' },
                    { id: 'lecheria', label: 'Lechería (164)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLoteActivo(tab.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                        loteActivo === tab.id
                          ? 'bg-[#10B981] text-[#070B09] font-semibold shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cuerpo del Dashboard Mockup */}
              <div className="p-5 sm:p-7 space-y-6">
                {/* Fila 1: Contador total de cabezas y desglose por categoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Tarjeta destacada: Total Cabezas */}
                  <div className="lg:col-span-1 p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/30 flex flex-col justify-between">
                    <span className="text-xs font-medium text-emerald-300">Total Cabezas</span>
                    <div className="my-2 text-3xl font-bold font-mono tabular-nums text-white">
                      {datosLote.totalCabezas}
                    </div>
                    <span className="text-xs text-emerald-300/90 font-mono tabular-nums">
                      Peso prom: {datosLote.pesoPromedio}
                    </span>
                  </div>

                  {/* Desglose de las 4 categorías */}
                  {datosLote.desglose.map((item) => (
                    <div
                      key={item.categoria}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between"
                    >
                      <span className="text-xs text-[#9CA3AF] truncate">{item.categoria}</span>
                      <div className="my-2 text-2xl font-bold font-mono tabular-nums text-white">
                        {item.cantidad}
                      </div>
                      <span className={`text-xs font-mono tabular-nums ${item.color}`}>
                        {item.cambio}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Fila 2: 3 Paneles analíticos (Curva de Ganancia de Peso + Estado de Potreros + Flujo de Caja Mensual) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Panel 1: Gráfica de Ganancia de Peso (5 cols) */}
                  <div className="lg:col-span-5 p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-white">Curva de Ganancia de Peso</h2>
                        <p className="text-xs text-[#9CA3AF]">Evolución últimos 6 meses vs. objetivo</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-[#9CA3AF] block">GDP Promedio</span>
                        <span className="text-sm font-bold font-mono tabular-nums text-emerald-400">
                          {datosLote.gdpPromedio}
                        </span>
                      </div>
                    </div>

                    {/* Barras comparativas de crecimiento */}
                    <div className="grid grid-cols-6 gap-2.5 items-end h-36 pt-4 px-1 border-b border-white/10">
                      {datosLote.curvaPeso.map((punto) => {
                        const alturaReal = Math.min(100, Math.max(28, Math.round((punto.peso / 540) * 100)));
                        const alturaMeta = Math.min(100, Math.max(24, Math.round((punto.meta / 540) * 100)));
                        return (
                          <div key={punto.mes} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                            <span className="text-[10px] font-mono tabular-nums text-emerald-300 opacity-85 group-hover:opacity-100">
                              {punto.peso}
                            </span>
                            <div className="w-full flex items-end justify-center gap-1 h-24">
                              <div
                                className="w-2.5 rounded-t bg-white/15 transition-all duration-300"
                                style={{ height: `${alturaMeta}%` }}
                                title={`Meta: ${punto.meta} kg`}
                              />
                              <div
                                className="w-3.5 rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all duration-300"
                                style={{ height: `${alturaReal}%` }}
                                title={`Peso real: ${punto.peso} kg`}
                              />
                            </div>
                            <span className="text-[11px] text-[#9CA3AF] font-mono pb-1">{punto.mes}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#9CA3AF] pt-3">
                      <span>Unidad: kilogramos (kg) en pie</span>
                      <span className="text-emerald-400 font-medium">+4.2% sobre meta proyectada</span>
                    </div>
                  </div>

                  {/* Panel 2: Estado de Potreros y Rotación (4 cols) */}
                  <div className="lg:col-span-4 p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-sm font-semibold text-white">Estado de Potreros</h2>
                        <p className="text-xs text-[#9CA3AF]">Rotación Voisin y aforo de pasturas</p>
                      </div>
                      <Sprout size={16} className="text-emerald-400 shrink-0" />
                    </div>

                    <div className="space-y-2.5 my-auto">
                      {datosLote.potreros.map((pot) => (
                        <div
                          key={pot.id}
                          className="p-3 rounded-lg bg-[#070B09]/70 border border-white/10 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {pot.id} · {pot.nombre}
                            </div>
                            <div className="text-[11px] text-[#9CA3AF] truncate">{pot.estado}</div>
                          </div>
                          <span
                            className={`text-xs font-mono tabular-nums shrink-0 font-semibold ${
                              pot.tipo === 'listo'
                                ? 'text-emerald-400'
                                : pot.tipo === 'ocupado'
                                ? 'text-amber-400'
                                : 'text-gray-300'
                            }`}
                          >
                            {pot.carga}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between text-xs text-[#9CA3AF]">
                      <span>Descanso promedio: 27 días</span>
                      <span className="text-white font-mono tabular-nums">Aforo óptimo</span>
                    </div>
                  </div>

                  {/* Panel 3: Flujo de Caja Mensual y Rentabilidad (3 cols) */}
                  <div className="lg:col-span-3 p-5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-sm font-semibold text-white">Flujo de Caja Mensual</h2>
                        <p className="text-xs text-[#9CA3AF]">Rentabilidad y auditoría REA</p>
                      </div>
                      <Wallet size={16} className="text-amber-400 shrink-0" />
                    </div>

                    <div className="space-y-3 my-auto">
                      <div className="p-3 rounded-lg bg-[#070B09]/70 border border-white/10">
                        <span className="text-[11px] text-[#9CA3AF] block">Ingresos (Venta / Leche)</span>
                        <span className="text-base font-bold font-mono tabular-nums text-emerald-400">
                          {datosLote.finanzas.ingresosMes}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[#070B09]/70 border border-white/10">
                        <span className="text-[11px] text-[#9CA3AF] block">Costos de Suplementación y Vet.</span>
                        <span className="text-base font-bold font-mono tabular-nums text-white">
                          {datosLote.finanzas.costosOperativos}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                          <span className="text-[10px] text-emerald-300 block">Margen Operativo</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-white">
                            {datosLote.finanzas.margenNeto}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                          <span className="text-[10px] text-amber-300 block">IVA 1% Ahorrado</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-amber-300">
                            {datosLote.finanzas.ahorroIvaRea}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between text-xs text-[#9CA3AF]">
                      <span>Costo/cabeza:</span>
                      <span className="font-mono tabular-nums text-white font-semibold">
                        {datosLote.finanzas.costoPorCabeza}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. SECCIÓN DE MÉTRICAS E IMPACTO (Social Proof & Resultados)
          ===================================================================== */}
      <section className="py-12 border-y border-white/10 bg-[#0D1512]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-emerald-400">
                +100%
              </div>
              <div className="text-sm font-semibold text-white">
                Claridad en costos por cabeza
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Conoce exactamente cuánto inviertes en concentrado, sales minerales y sanidad por cada animal.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-white">
                8.5 hrs
              </div>
              <div className="text-sm font-semibold text-white">
                Ahorro de horas semanales en registros
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Elimina cuadernos mojados en el corral y hojas de Excel propensas a errores manuales.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-amber-400">
                99.4%
              </div>
              <div className="text-sm font-semibold text-white">
                Control preciso de natalidad, destetes y pesajes
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Alertas tempranas de palpación, partos programados, curvas de engorde y calendario sanitario.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-emerald-400">
                1% IVA
              </div>
              <div className="text-sm font-semibold text-white">
                Auditoría REA y Hacienda v4.4 al día
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Detecta cobros indebidos del 13% en insumos agropecuarios y prepara tus declaraciones D-135-1 y D-101.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. BENTO GRID DE CARACTERÍSTICAS PRINCIPALES (Estilo Layers.ai)
          ===================================================================== */}
      <section id="funciones" className="relative py-24 md:py-32">
        {/* Resplandor radial sutil detrás del Bento Grid */}
        <div
          className="
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none
            w-[760px] h-[480px] rounded-full
            bg-emerald-500/10 blur-[140px]
          "
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Encabezado de sección */}
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-semibold text-emerald-400 tracking-wide mb-2">
              Plataforma Agro-Tech Integral
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4"
              style={{ textWrap: 'balance' }}
            >
              Diseñada para el ritmo real de la finca y la exigencia contable moderna
            </h2>
            <p className="text-base text-[#9CA3AF] leading-relaxed">
              Cada módulo conecta lo que ocurre en el potrero con el flujo financiero de tu operación ganadera.
            </p>
          </div>

          {/* Cuadrícula Asimétrica Bento (3 columnas en desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ---------------------------------------------------------------
                TARJETA 1 (Grande - 2 columnas): Inventario y Trazabilidad Individual
                --------------------------------------------------------------- */}
            <div className="lg:col-span-2 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-200 p-6 sm:p-8 flex flex-col justify-between">
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    01. Inventario y Trazabilidad Individual
                  </h3>
                  <span className="text-xs text-[#9CA3AF] font-mono">
                    Arete · Raza · Peso · Sanidad · Genealogía
                  </span>
                </div>
                <p className="text-sm text-[#9CA3AF] leading-relaxed max-w-2xl">
                  Consulta la hoja de vida completa de cada cabeza de ganado al instante. Selecciona un ejemplar para inspeccionar su historial sanitario, ganancia diaria de peso y árbol genealógico.
                </p>
              </div>

              {/* Micro-componente interactivo: Ficha Técnica Individual del Animal */}
              <div className="rounded-xl bg-[#070B09]/90 border border-white/10 p-4 sm:p-5 space-y-4">
                {/* Selector de ejemplar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {EJEMPLARES_TRAZABILIDAD.map((animal, idx) => (
                      <button
                        key={animal.arete}
                        type="button"
                        onClick={() => setEjemplarIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums transition-all duration-150 whitespace-nowrap shrink-0 ${
                          ejemplarIdx === idx
                            ? 'bg-emerald-500 text-[#070B09] font-bold'
                            : 'bg-white/[0.04] text-gray-300 hover:text-white border border-white/10'
                        }`}
                      >
                        #{animal.arete} · {animal.raza.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    Trazabilidad SENASA Activa
                  </span>
                </div>

                {/* Datos principales del ejemplar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-5 space-y-3">
                    <div>
                      <div className="text-xs text-[#9CA3AF] font-mono">
                        Arete Oficial #{ejemplarActual.arete} · {ejemplarActual.edad}
                      </div>
                      <div className="text-lg font-bold text-white mt-0.5">
                        {ejemplarActual.nombre}
                      </div>
                      <div className="text-xs text-emerald-400 font-medium">
                        {ejemplarActual.raza} · {ejemplarActual.categoria}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                        <span className="text-[11px] text-[#9CA3AF] block">Peso Actual</span>
                        <span className="text-lg font-bold font-mono tabular-nums text-white">
                          {ejemplarActual.pesoActual}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                          {ejemplarActual.gdp}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                        <span className="text-[11px] text-[#9CA3AF] block">Condición Corp.</span>
                        <span className="text-lg font-bold font-mono tabular-nums text-amber-400">
                          {ejemplarActual.condicionCorporal}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF] block mt-0.5">
                          Escala 1 a 5
                        </span>
                      </div>
                    </div>

                    {/* Genealogía */}
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-300 font-semibold mb-1">
                        <Dna size={13} className="text-emerald-400 shrink-0" />
                        <span>Genealogía Registrada</span>
                      </div>
                      <div className="text-[#9CA3AF] truncate">
                        <strong className="text-gray-200">Padre:</strong> {ejemplarActual.padre}
                      </div>
                      <div className="text-[#9CA3AF] truncate">
                        <strong className="text-gray-200">Madre:</strong> {ejemplarActual.madre}
                      </div>
                    </div>
                  </div>

                  {/* Historial Sanitario */}
                  <div className="md:col-span-7 p-3.5 rounded-lg bg-white/[0.02] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Stethoscope size={14} className="text-emerald-400" />
                        Historial Sanitario y Pesajes Recientes
                      </span>
                      <span className="text-[11px] text-[#9CA3AF] font-mono">
                        {ejemplarActual.ultimoPesaje}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {ejemplarActual.sanidad.map((evento) => (
                        <div
                          key={evento.vacuna}
                          className="p-2.5 rounded-lg bg-[#0D1512] border border-white/10 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">{evento.vacuna}</div>
                            <div className="text-[11px] text-[#9CA3AF] font-mono">{evento.fecha}</div>
                          </div>
                          <span className="text-xs font-mono text-emerald-400 shrink-0">
                            {evento.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------
                TARJETA 2 (1 columna): Rotación de Potreros y Pasturas
                --------------------------------------------------------------- */}
            <div
              id="pastoreo"
              className="lg:col-span-1 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-200 p-6 sm:p-8 flex flex-col justify-between"
            >
              <div className="mb-5">
                <h3 className="text-xl font-bold text-white tracking-tight mb-2">
                  02. Rotación de Potreros y Pasturas
                </h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">
                  Equilibra días de ocupación frente a días de descanso del pasto y controla la carga animal por hectárea sin sobrepastoreo.
                </p>
              </div>

              {/* Micro-gráfico interactivo de potreros */}
              <div className="rounded-xl bg-[#070B09]/90 border border-white/10 p-4 space-y-4">
                <div className="grid grid-cols-3 gap-1.5">
                  {POTREROS_BENTO.map((p, idx) => (
                    <button
                      key={p.codigo}
                      type="button"
                      onClick={() => setPotreroSeleccionado(idx)}
                      className={`p-2 rounded-lg border text-left transition-all duration-150 ${
                        potreroSeleccionado === idx
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                          : 'bg-white/[0.02] border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[11px] font-mono font-bold truncate">
                        P-0{idx + 1}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono truncate">
                        {p.ugm}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate">{potreroBento.codigo}</span>
                    <span className="text-amber-400 font-mono tabular-nums font-semibold">
                      {potreroBento.ugm}
                    </span>
                  </div>
                  <div className="text-xs text-[#9CA3AF]">
                    Forraje: <span className="text-gray-200">{potreroBento.pasto}</span>
                  </div>

                  {/* Barra visual de días de ocupación vs descanso */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-emerald-400">Ocupación: {potreroBento.ocupacion}d</span>
                      <span className="text-gray-300">
                        Descanso: {potreroBento.descansoActual}/{potreroBento.descansoMeta}d
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden flex">
                      <div
                        className="bg-amber-400 h-full"
                        style={{ width: '16%' }}
                        title="Días de ocupación"
                      />
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{
                          width: `${Math.round((potreroBento.descansoActual / potreroBento.descansoMeta) * 84)}%`,
                        }}
                        title="Progreso de descanso de pastura"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-emerald-300 font-medium pt-1">
                    {potreroBento.estado}
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------
                TARJETA 3 (1 columna): Contabilidad y Finanzas Ganaderas
                --------------------------------------------------------------- */}
            <div
              id="finanzas"
              className="lg:col-span-1 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-200 p-6 sm:p-8 flex flex-col justify-between"
            >
              <div className="mb-5">
                <h3 className="text-xl font-bold text-white tracking-tight mb-2">
                  03. Contabilidad y Finanzas Ganaderas
                </h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">
                  Compara ingresos por venta de ganado o leche contra costos de suplementación y veterinaria, con validación de IVA 1% REA.
                </p>
              </div>

              {/* Micro-componente financiero */}
              <div className="rounded-xl bg-[#070B09]/90 border border-white/10 p-4 space-y-3.5">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                  <span className="text-gray-300 font-medium">Balance Operativo Trimestral</span>
                  <span className="text-emerald-400 font-mono tabular-nums font-semibold">+56.8% Margen</span>
                </div>

                {/* Barras horizontales minimalistas de Ingresos vs Costos */}
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1 font-mono tabular-nums">
                      <span className="text-gray-300">Venta Ganado y Leche</span>
                      <span className="text-emerald-400 font-bold">₡14,850,000</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 font-mono tabular-nums">
                      <span className="text-gray-300">Suplementación y Concentrado</span>
                      <span className="text-amber-400 font-bold">₡4,280,000</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: '34%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 font-mono tabular-nums">
                      <span className="text-gray-300">Sanidad y Veterinaria (IVA 2%)</span>
                      <span className="text-gray-200 font-bold">₡2,140,000</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-300/70 rounded-full" style={{ width: '19%' }} />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
                  <span className="text-gray-200">Declaración D-135-1 / D-101</span>
                  <span className="font-mono text-emerald-300 font-semibold">Lista en 1 clic</span>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------
                TARJETA 4 (Grande - 2 columnas): Modo Campo & Acceso Multi-dispositivo
                --------------------------------------------------------------- */}
            <div className="lg:col-span-2 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-200 p-6 sm:p-8 flex flex-col justify-between">
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    04. Modo Campo y Acceso Multi-dispositivo
                  </h3>

                  {/* Selector interactivo Corral vs Oficina */}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070B09] border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDispositivoCampo('corral')}
                      className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 ${
                        dispositivoCampo === 'corral'
                          ? 'bg-emerald-500 text-[#070B09] font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Smartphone size={13} />
                      <span>Modo Corral (Celular)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDispositivoCampo('oficina')}
                      className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 ${
                        dispositivoCampo === 'oficina'
                          ? 'bg-emerald-500 text-[#070B09] font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Laptop size={13} />
                      <span>Modo Oficina (PC)</span>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-[#9CA3AF] leading-relaxed max-w-2xl">
                  Diseñado con botones táctiles amplios de alta visibilidad bajo el sol del corral, sincronizado al instante con la consola contable de la oficina y el bot de WhatsApp.
                </p>
              </div>

              {/* Simulación visual de Modo Campo vs Modo Oficina */}
              <div className="rounded-xl bg-[#070B09]/90 border border-white/10 p-4 sm:p-5">
                {dispositivoCampo === 'corral' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="space-y-3">
                      <div className="text-xs font-mono text-emerald-400">
                        Vista Móvil · Manga de Trabajo / Corral
                      </div>
                      <h4 className="text-base font-bold text-white">
                        Registra pesajes, partos o facturas desde WhatsApp en menos de 10 segundos
                      </h4>
                      <p className="text-xs text-[#9CA3AF] leading-relaxed">
                        Sin menús complicados: digita el número de arete, ingresa el peso en báscula o envía una foto del tiquete de compra del agroservicio.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 pt-1">
                        <span>Botones de 48px para uso en campo</span>
                        <span aria-hidden="true">·</span>
                        <span>Buzón automático Cloudflare</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#0D1512] border border-emerald-500/30 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-gray-300 pb-2 border-b border-white/10">
                        <span className="font-semibold text-white">Registro Rápido en Manga</span>
                        <span className="font-mono text-emerald-400">Sincronizado</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[#9CA3AF]">Arete escaneado:</span>
                        <span className="font-mono font-bold text-white">#CR-1108 (Nelore)</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[#9CA3AF]">Peso en báscula:</span>
                        <span className="font-mono font-bold text-emerald-400">492.0 kg (+1.07 kg/d)</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[#9CA3AF]">Tratamiento aplicado:</span>
                        <span className="font-mono text-amber-300">Bovisan + Vitamina ADE</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="space-y-3">
                      <div className="text-xs font-mono text-amber-400">
                        Vista Escritorio · Administración y Contador
                      </div>
                      <h4 className="text-base font-bold text-white">
                        Reportes ejecutivos, conciliación de Hacienda y centros de costo por lote
                      </h4>
                      <p className="text-xs text-[#9CA3AF] leading-relaxed">
                        Mientras el capataz registra en el corral, la oficina recibe los costos actualizados por kilo producido y los borradores listos para TRIBU-CR.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 pt-1">
                        <span>Exportación Excel y PDF</span>
                        <span aria-hidden="true">·</span>
                        <span>Facturación Electrónica v4.4</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#0D1512] border border-white/15 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-gray-300 pb-2 border-b border-white/10">
                        <span className="font-semibold text-white">Cierre Contable y Rentabilidad</span>
                        <span className="font-mono text-amber-400">Octubre 2026</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[#9CA3AF]">Costo real por kg carne:</span>
                        <span className="font-mono font-bold text-white">₡1,185 / kg</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[#9CA3AF]">Precio venta subasta:</span>
                        <span className="font-mono font-bold text-emerald-400">₡1,940 / kg (+63.7%)</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/40 border border-white/10">
                        <span className="text-[#9CA3AF]">Crédito Fiscal IVA 1% REA:</span>
                        <span className="font-mono text-emerald-300">₡412,500 acreditados</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. SECCIÓN DE FLUJO DE TRABAJO ("Cómo funciona en 3 pasos")
          ===================================================================== */}
      <section className="py-20 md:py-28 border-t border-white/10 bg-[#0D1512]/35">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-xs font-semibold text-emerald-400 tracking-wide mb-2">
              Implementación Sin Fricción
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4"
              style={{ textWrap: 'balance' }}
            >
              Cómo funciona en 3 pasos
            </h2>
            <p className="text-base text-[#9CA3AF]">
              Digitaliza tu operación ganadera hoy mismo sin necesidad de conocimientos técnicos ni contables.
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Línea punteada conectora en desktop */}
            <div
              className="hidden md:block absolute top-10 left-[16%] right-[16%] border-t border-dashed border-emerald-500/35 pointer-events-none"
              aria-hidden="true"
            />

            {/* Paso 01 */}
            <div className="relative rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-200 p-7">
              <div className="w-12 h-12 rounded-xl bg-[#070B09] border border-emerald-500/40 text-emerald-400 font-mono font-bold text-base flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                01
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                01. Registra tu finca y tus lotes
              </h3>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">
                Configura tus potreros, carga tu inventario inicial de animales (toros, vacas, terneros o novillos) y activa tu buzón tributario exclusivo en menos de 2 minutos.
              </p>
            </div>

            {/* Paso 02 */}
            <div className="relative rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-200 p-7">
              <div className="w-12 h-12 rounded-xl bg-[#070B09] border border-emerald-500/40 text-emerald-400 font-mono font-bold text-base flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                02
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                02. Actualiza eventos en segundos desde el corral
              </h3>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">
                Registra nacimientos, pesajes, cambios de potrero, vacunaciones y ventas desde el celular, o reenvía tus facturas de insumos por WhatsApp y correo electrónico.
              </p>
            </div>

            {/* Paso 03 */}
            <div className="relative rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 transition-all duration-200 p-7">
              <div className="w-12 h-12 rounded-xl bg-[#070B09] border border-amber-500/40 text-amber-400 font-mono font-bold text-base flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(245,158,11,0.18)]">
                03
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5">
                03. Toma decisiones con reportes automáticos de rentabilidad
              </h3>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">
                Visualiza la ganancia diaria de peso por lote, el costo real por kilo producido, el flujo de caja mensual y tus declaraciones listas para presentar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. SECCIÓN DE PRECIOS (Pricing Cards — 3 Tarjetas Limpias)
          ===================================================================== */}
      <section id="precios" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <p className="text-xs font-semibold text-emerald-400 tracking-wide mb-2">
              Planes Transparentes y Escalables
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4"
              style={{ textWrap: 'balance' }}
            >
              Inversión pensada para cada etapa de tu ganadería
            </h2>
            <p className="text-base text-[#9CA3AF] mb-8">
              Empieza gratis hoy mismo y escala conforme crece el tamaño de tu hato bovino.
            </p>

            {/* Selector interactivo Mensual / Anual */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
              <button
                type="button"
                onClick={() => setCicloAnual(false)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${
                  !cicloAnual
                    ? 'bg-[#10B981] text-[#070B09]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Facturación Mensual
              </button>
              <button
                type="button"
                onClick={() => setCicloAnual(true)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${
                  cicloAnual
                    ? 'bg-[#10B981] text-[#070B09]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Anual (Ahorra 20%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
            {PLANES_GANADEROS.map((plan) => {
              const precioMostrar = cicloAnual ? plan.precioAnual : plan.precioMensual;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 ${
                    plan.destacado
                      ? 'bg-[#0D1512] border-2 border-emerald-500/60 shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]'
                      : 'bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-emerald-500/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-xl font-bold text-white">{plan.nombre}</h3>
                      {plan.etiqueta && (
                        <span className="text-xs font-semibold text-emerald-300 font-mono">
                          ★ {plan.etiqueta}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
                      {plan.subtitulo}
                    </p>

                    <div className="flex items-baseline gap-1.5 mb-7 pb-6 border-b border-white/10">
                      <span className="text-4xl sm:text-5xl font-bold font-mono tabular-nums text-white">
                        ${precioMostrar}
                      </span>
                      <span className="text-sm text-[#9CA3AF]">
                        / mes {cicloAnual && precioMostrar > 0 ? '(facturado anual)' : ''}
                      </span>
                    </div>

                    <ul className="space-y-3.5 mb-8">
                      {plan.caracteristicas.map((item) => (
                        <li key={item} className="flex items-start gap-3 text-sm text-gray-200">
                          <Check size={17} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => irARegistro(plan.id)}
                    className={`w-full py-3.5 px-5 rounded-xl font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
                      plan.destacado
                        ? 'bg-[#10B981] hover:bg-emerald-400 text-[#070B09] shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10'
                    }`}
                  >
                    <span>{plan.ctaTexto}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. CTA FINAL + FOOTER MINIMALISTA
          ===================================================================== */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto relative rounded-3xl bg-gradient-to-b from-[#0D1512] to-[#070B09] border border-emerald-500/30 p-8 sm:p-14 text-center overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
          {/* Resplandor verde esmeralda de fondo */}
          <div
            className="
              absolute -top-24 left-1/2 -translate-x-1/2 pointer-events-none
              w-[520px] h-[280px] rounded-full
              bg-emerald-500/20 blur-[110px]
            "
          />

          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-white"
              style={{ textWrap: 'balance' }}
            >
              Digitaliza tu finca hoy mismo y lleva el control de cada cabeza de ganado en tu bolsillo
            </h2>
            <p className="text-base text-[#9CA3AF] leading-relaxed">
              Únete a los productores que ya optimizan su pastoreo rotacional, trazabilidad bovina y contabilidad agropecuaria sin hojas de cálculo.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => irARegistro('free')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#10B981] hover:bg-emerald-400 text-[#070B09] font-bold text-base transition-all duration-150 shadow-[0_0_32px_rgba(16,185,129,0.45)] whitespace-nowrap shrink-0"
              >
                <span>Comenzar ahora — Es Gratis</span>
                <ArrowRight size={18} />
              </button>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-semibold text-base transition-all duration-150 whitespace-nowrap shrink-0"
              >
                <span>Acceder a mi cuenta</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER MINIMALISTA */}
      <footer className="border-t border-white/10 bg-[#070B09] py-12 px-4 sm:px-6 lg:px-8 text-sm text-[#9CA3AF]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
              <Tractor size={16} />
            </span>
            <span className="font-bold text-white tracking-tight">Contador Ganadero</span>
            <span aria-hidden="true">·</span>
            <span className="text-xs text-[#9CA3AF]">contadorganadero.com</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
            <a href="#funciones" className="hover:text-white transition-colors">Funciones</a>
            <a href="#pastoreo" className="hover:text-white transition-colors">Pastoreo</a>
            <a href="#finanzas" className="hover:text-white transition-colors">Finanzas</a>
            <a href="#precios" className="hover:text-white transition-colors">Precios</a>
            <Link to="/terminos" className="hover:text-white transition-colors">Términos</Link>
            <Link to="/condiciones-servicio" className="hover:text-white transition-colors">Condiciones</Link>
            <Link to="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
          </div>

          <div className="text-xs text-emerald-400 font-mono">
            ● Todos los sistemas operativos
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} contadorganadero.com. Todos los derechos reservados. Gestión de inventario bovino, pastoreo rotacional y finanzas agropecuarias.
        </div>
      </footer>
    </div>
  );
}