import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Tractor, ArrowRight, Sparkles, Check, ShieldCheck, Activity, TrendingUp,
  Receipt, Warehouse, Smartphone, Monitor, Milk, Beef, Sprout, MapPin,
  Wallet, MessageSquare, Zap, ClipboardList, PlayCircle, Clock
} from 'lucide-react';
import fondoLogin from '../Recursos/fondo_login.webm';
import { useReveal } from '../hooks/useReveal';
import useSeo from '../hooks/useSeo';
import AdvertisingSlot from '../components/ads/AdvertisingSlot';
import { Button } from '../components/ui/button';
import './LandingPage.css';

// WhatsApp de contacto para pre-venta y dudas del REA en Costa Rica
const WHATSAPP_CONTACT_NUMBER = '50688888888';
const WHATSAPP_DEFAULT_MSG = encodeURIComponent(
  'Hola, vi la plataforma ContadorGanadero y quisiera información sobre cómo digitalizar la gestión de mi finca.'
);
const WHATSAPP_VENTAS_MSG = encodeURIComponent(
  'Hola, represento una agroempresa/cooperativa y quisiera una propuesta para múltiples fincas en ContadorGanadero.'
);

const NEGOCIO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'ContadorGanadero',
  url: 'https://contadorganandero.com',
  image: 'https://contadorganandero.com/favicon.svg',
  description:
    'Gestión integral de fincas: inventario bovino, pastoreo rotacional, contabilidad y facturación electrónica para productores de Costa Rica bajo el Régimen Especial Agropecuario (REA).',
  areaServed: { '@type': 'Country', name: 'Costa Rica' },
  priceRange: '$$',
  knowsAbout: [
    'Inventario y trazabilidad bovina',
    'Pastoreo rotacional y potreros',
    'Facturación electrónica Costa Rica v4.4',
    'Régimen Especial Agropecuario REA',
    'Costos de producción ganadera',
  ],
};

/* -------------------------------------------------------------------------- */
/*  Contenido de secciones                                                    */
/* -------------------------------------------------------------------------- */

const METRICAS = [
  { valor: '+100%', texto: 'Claridad en costos por cabeza' },
  { valor: '~18 hrs', texto: 'Ahorro de horas semanales en registros manuales' },
  { valor: '100%', texto: 'Control preciso de natalidad, destetes y pesajes' },
  { valor: '4', texto: 'Especies: bovinos, aves, peces y colmenas' },
];

const PASOS = [
  {
    numero: '01',
    titulo: 'Registra tu finca y tus lotes',
    descripcion:
      'Crea tus potreros, lotes y categorías (toros, vacas en producción, terneros) en menos de 5 minutos.',
    icono: ClipboardList,
  },
  {
    numero: '02',
    titulo: 'Actualiza eventos en segundos desde el corral',
    descripcion:
      'Nacimientos, pesajes, vacunas y ventas directamente desde el celular, incluso con señal débil.',
    icono: Smartphone,
  },
  {
    numero: '03',
    titulo: 'Toma decisiones con reportes automáticos',
    descripcion:
      'Rentabilidad por animal, flujo de caja mensual y costo por kilo siempre al día, sin hojas de cálculo.',
    icono: TrendingUp,
  },
];

const PLANES_LANDING = [
  {
    id: 'free',
    nombre: 'Finca Pequeña',
    subtitulo: 'Para el productor que empieza a digitalizar',
    precio: '$0',
    periodo: '/mes',
    destacado: false,
    cta: 'Comenzar gratis',
    caracteristicas: [
      'Buzón exclusivo @contadorganandero.com',
      'Bot de WhatsApp para facturas',
      'Auditoría del IVA 1% REA',
      'Inventario bovino y multiespecie',
      '10 conteos de ganado con IA al mes',
      '1 usuario · 2 GB de almacenamiento',
    ],
  },
  {
    id: 'pro',
    nombre: 'Hacienda Profesional',
    subtitulo: 'Ganaderías que viven de su producción',
    precio: '$10',
    periodo: '/mes',
    destacado: true,
    badge: 'Más Popular',
    cta: 'Probar Hacienda Pro',
    caracteristicas: [
      'Todo lo del plan Finca Pequeña',
      'Módulo D-150 / Conciliación TRIBU-CR',
      'Visión artificial VLM para conteos',
      '300 conteos con IA al mes',
      '3 usuarios y 25 GB',
      '100% libre de anuncios',
    ],
  },
  {
    id: 'agroempresa',
    nombre: 'Agroempresa',
    subtitulo: 'Cooperativas y operaciones multi-finca',
    precio: 'A medida',
    periodo: '',
    destacado: false,
    cta: 'Hablar con ventas',
    whatsapp: true,
    caracteristicas: [
      'Multi-finca con reportes consolidados',
      'Usuarios y roles por finca',
      'Facturación electrónica v4.4',
      'Soporte prioritario dedicado',
      'Capacitación para tu equipo',
      'Acompañamiento contable continuo',
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Helper de animación de entrada                                            */
/* -------------------------------------------------------------------------- */

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal--visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Micro-visual del Hero: Dashboard en marco de cristal                      */
/* -------------------------------------------------------------------------- */

function HeroMockup() {
  return (
    <div className="hero-mockup relative mx-auto w-full max-w-4xl">
      {/* Resplandor detrás del mockup */}
      <div className="absolute -inset-6 bg-emerald-500/15 blur-[90px] rounded-full pointer-events-none" aria-hidden="true" />

      <div className="hero-mockup-frame relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl shadow-emerald-950/50 overflow-hidden text-left">
        {/* Barra de título estilo ventana */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-2 text-[11px] sm:text-xs text-gray-400 font-mono truncate">
              ContadorGanadero · Panel de Finca
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <Activity size={10} className="animate-pulse" /> REA Activo
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Contador de cabezas de ganado */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400 mb-1">
                <Beef size={13} className="text-emerald-400" /> Toros
              </div>
              <div className="text-lg sm:text-2xl font-bold font-heading text-white tracking-tight">12</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400 mb-1">
                <Milk size={13} className="text-emerald-400" /> Vacas en producción
              </div>
              <div className="text-lg sm:text-2xl font-bold font-heading text-white tracking-tight">86</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400 mb-1">
                <Sparkles size={13} className="text-amber-400" /> Terneros
              </div>
              <div className="text-lg sm:text-2xl font-bold font-heading text-amber-300 tracking-tight">23</div>
            </div>
          </div>

          {/* Gráfica de ganancia de peso + estado de potreros */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-300">Ganancia de peso promedio</span>
                <span className="text-[10px] text-emerald-400 font-semibold">+850 g/día</span>
              </div>
              <svg viewBox="0 0 320 90" className="w-full h-20" role="img" aria-label="Gráfica de ganancia de peso">
                <defs>
                  <linearGradient id="gradPeso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,72 L53,64 L106,52 L159,47 L212,32 L265,24 L320,12 L320,90 L0,90 Z" fill="url(#gradPeso)" />
                <path d="M0,72 L53,64 L106,52 L159,47 L212,32 L265,24 L320,12" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="212" cy="32" r="3.5" fill="#10B981" />
                <circle cx="320" cy="12" r="3.5" fill="#10B981" />
              </svg>
              <div className="flex justify-between text-[9px] text-gray-500 font-mono px-0.5">
                {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 mb-3">
                <MapPin size={13} className="text-emerald-400" /> Estado de potreros
              </div>
              <ul className="space-y-2 text-[11px]">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-gray-300 truncate">Potrero 1 · Lote A</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Ocupado 3d
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-gray-300 truncate">Potrero 2</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Descanso 12d
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-gray-300 truncate">Potrero 3 · Lote B</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Ocupado 1d
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-gray-300 truncate">Potrero 4</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Listo
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Flujo de caja mensual */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-300">Flujo de caja mensual</span>
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Ingresos</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" /> Costos</span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 h-16">
              {[
                { i: 62, c: 38 }, { i: 74, c: 42 }, { i: 55, c: 30 },
                { i: 88, c: 46 }, { i: 70, c: 36 }, { i: 95, c: 40 },
              ].map(({ i, c }, idx) => (
                <div key={idx} className="flex items-end gap-1 flex-1 justify-center">
                  <div className="w-2.5 sm:w-3 rounded-t bg-emerald-500/80" style={{ height: `${i}%` }} />
                  <div className="w-2.5 sm:w-3 rounded-t bg-amber-500/70" style={{ height: `${c}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Componente principal                                                      */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  const navigate = useNavigate();

  // ===== SEO =====
  useSeo({
    title: 'ContadorGanadero | Control total de tu ganadería — Costa Rica',
    description:
      'Gestiona tu hato bovino, optimiza la rotación de potreros, registra pesos, vacunas y controla la rentabilidad de tu finca en tiempo real. Facturación electrónica y REA incluidos.',
    path: '/',
    jsonLd: [NEGOCIO_SCHEMA],
  });

  // Navbar: sombra al hacer scroll
  const [navScrolled, setNavScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Tracking de conversión para Google Ads
  const trackConversion = (etiqueta = 'inicio_registro', plan = 'free') => {
    try {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
          send_to: window.GOOGLE_ADS_CONVERSION_ID || 'AW-DEFAULT/conversion',
          value: plan === 'pro' ? 10.0 : 1.0,
          currency: 'USD',
          event_category: 'Google Ads Lead',
          event_label: etiqueta,
        });
      }
    } catch {
      // no-op
    }
  };

  const handleSeleccionarPlan = (planId) => {
    trackConversion('seleccion_plan_' + planId, planId);
    navigate('/login', { state: { registro: true, plan: planId } });
  };

  const handleCtaPrincipal = (etiqueta = 'hero_cta') => {
    trackConversion(etiqueta, 'free');
    navigate('/login', { state: { registro: true } });
  };

  // Brillo radial que sigue el cursor en las tarjetas Bento
  const brilloBento = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div className="landing font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ================================================================== */}
      {/* NAVBAR FLOTANTE (píldora glassmorphism)                            */}
      {/* ================================================================== */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3 sm:px-4 pt-3 sm:pt-4 pointer-events-none">
        <header
          className={`landing-nav-pill pointer-events-auto w-full max-w-5xl flex items-center justify-between gap-3 rounded-full border px-3 sm:px-5 py-2.5 transition-all duration-300 ${
            navScrolled
              ? 'border-white/10 bg-black/60 shadow-xl shadow-black/40'
              : 'border-white/10 bg-black/40'
          } backdrop-blur-md`}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="ContadorGanadero — inicio">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/30">
              <Tractor size={20} />
            </span>
            <span className="font-heading font-bold text-white tracking-tight text-base leading-none hidden min-[380px]:block">
              Contador<span className="text-emerald-400">Ganadero</span>
            </span>
          </Link>

          {/* Enlaces centrales */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300" aria-label="Navegación principal">
            <a href="#funciones" className="hover:text-emerald-400 transition-colors">Funciones</a>
            <a href="#pastoreo" className="hover:text-emerald-400 transition-colors">Pastoreo</a>
            <a href="#finanzas" className="hover:text-emerald-400 transition-colors">Finanzas</a>
            <a href="#precios" className="hover:text-emerald-400 transition-colors">Precios</a>
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex text-gray-300 hover:text-white hover:bg-white/10"
            >
              <Link to="/login">Iniciar Sesión</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/30 px-4"
              onClick={() => handleCtaPrincipal('nav_cta')}
              data-conversion="nav_signup"
            >
              Probar Gratis
            </Button>
          </div>
        </header>
      </div>

      {/* ================================================================== */}
      {/* HERO SECTION DE ALTO IMPACTO                                       */}
      {/* ================================================================== */}
      <section className="landing-hero relative overflow-hidden">
        {/* Video de fondo de la marca */}
        <video className="landing-hero-video" autoPlay muted loop playsInline preload="auto">
          <source src={fondoLogin} type="video/webm" />
        </video>
        <div className="landing-hero-overlay" />

        {/* Resplandores radiales sutiles */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[720px] h-[420px] bg-emerald-500/15 blur-[140px] rounded-full pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 sm:pt-36 pb-16 md:pb-24 flex flex-col items-center text-center">
          {/* Badge superior */}
          <Reveal>
            <a
              href="#funciones"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:border-emerald-400/70 transition-colors"
            >
              <Sparkles size={13} className="text-emerald-400" />
              Nuevo: Control inteligente de lotes y trazabilidad bovina
              <ArrowRight size={12} />
            </a>
          </Reveal>

          {/* Headline */}
          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-white tracking-tight leading-[1.08] max-w-4xl">
              El control total de tu ganadería,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
                sin papeles ni complicaciones.
              </span>
            </h1>
          </Reveal>

          {/* Subheadline */}
          <Reveal delay={140}>
            <p className="mt-6 text-base sm:text-lg text-gray-400 leading-relaxed max-w-2xl">
              Gestiona tu hato bovino, optimiza la rotación de potreros, registra pesos, vacunas y
              controla la rentabilidad de tu finca en tiempo real desde cualquier dispositivo.
            </p>
          </Reveal>

          {/* CTAs */}
          <Reveal delay={200}>
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/30 hover:shadow-emerald-400/40 transition-all group"
                onClick={() => handleCtaPrincipal('hero_btn_comenzar')}
                data-conversion="hero_signup"
              >
                Comenzar ahora — Es Gratis
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-12 px-7 rounded-full border-white/15 bg-white/[0.03] backdrop-blur-md text-gray-200 hover:bg-white/10 hover:text-white hover:border-emerald-500/40 text-base"
              >
                <a href="#funciones" className="flex items-center justify-center gap-2">
                  <PlayCircle size={18} className="text-emerald-400" />
                  Ver demostración interactiva
                </a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-4 text-xs text-gray-500 flex items-center justify-center gap-4">
              <span className="flex items-center gap-1.5"><Check size={13} className="text-emerald-400" /> Sin tarjeta de crédito</span>
              <span className="flex items-center gap-1.5"><Clock size={13} className="text-emerald-400" /> Listo en 2 minutos</span>
            </p>
          </Reveal>

          {/* Mockup del Dashboard */}
          <Reveal delay={280} className="w-full mt-14 md:mt-16">
            <HeroMockup />
          </Reveal>
        </div>
      </section>

      {/* ================================================================== */}
      {/* BENTO GRID DE CARACTERÍSTICAS (Estilo Layers.ai)                   */}
      {/* ================================================================== */}
      <section id="funciones" className="relative py-16 md:py-24 scroll-mt-20 bg-[#0D1512]">
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[380px] bg-emerald-500/[0.08] blur-[130px] rounded-full pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-emerald-300">
                <Warehouse size={12} /> Funciones
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
                Una plataforma, todo el control
              </h2>
              <p className="mt-3 text-gray-400 text-base">
                Cada módulo está diseñado para el trabajo real de la finca: del corral a la declaración de Hacienda.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Tarjeta 1 (2 columnas): Inventario y Trazabilidad Individual */}
            <Reveal className="md:col-span-2">
              <article onMouseMove={brilloBento} className="bento-card group h-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 sm:p-8 hover:border-emerald-500/40 hover:shadow-[0_0_40px_rgba(16,185,129,0.12)] transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                      <Beef size={20} />
                    </span>
                    <h3 className="mt-4 text-xl font-bold font-heading text-white tracking-tight">
                      Inventario y trazabilidad individual
                    </h3>
                    <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                      Ficha completa por animal: arete, raza, peso, historial sanitario y genealogía en un solo lugar.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Trazabilidad total
                  </span>
                </div>

                {/* Mini-ficha del animal */}
                <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 font-bold font-heading text-sm">
                        CR
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white">Arete #CR-04512</div>
                        <div className="text-[11px] text-gray-400">Brahman · Cebra · Hembra</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      <TrendingUp size={11} /> +850 g/día
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Peso actual</div>
                      <div className="text-sm font-bold text-white">435 kg</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Lote</div>
                      <div className="text-sm font-bold text-white">Lote A</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Potrero</div>
                      <div className="text-sm font-bold text-emerald-300">Potrero 3</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">Edad</div>
                      <div className="text-sm font-bold text-white">28 meses</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-white/10">
                    <span className="text-[10px] text-gray-500 mr-1">Sanidad:</span>
                    {['Aftosa ✓', 'Babesiosis ✓', 'Vitamina A ✓', 'Desparasitación ✓'].map((v) => (
                      <span key={v} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-gray-300">
                        {v}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-3 mt-3 border-t border-white/10 text-[11px] text-gray-400">
                    <span>Padre: <span className="text-gray-200 font-medium">Toro «El Cobre» · CR-0012</span></span>
                    <span>Madre: <span className="text-gray-200 font-medium">Vaca «Estrella» · CR-0088</span></span>
                  </div>
                </div>
              </article>
            </Reveal>

            {/* Tarjeta 2 (1 columna): Rotación de Potreros y Pasturas */}
            <Reveal delay={80}>
              <article id="pastoreo" onMouseMove={brilloBento} className="bento-card group h-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 sm:p-8 hover:border-emerald-500/40 hover:shadow-[0_0_40px_rgba(16,185,129,0.12)] transition-all duration-300 scroll-mt-24">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Sprout size={20} />
                </span>
                <h3 className="mt-4 text-xl font-bold font-heading text-white tracking-tight">
                  Rotación de potreros y pasturas
                </h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  Días de ocupación vs. descanso del pasto y carga animal por hectárea, siempre bajo control.
                </p>

                {/* Mini-gráfico de rotación */}
                <div className="mt-6 space-y-3">
                  {[
                    { nombre: 'Potrero 1', ocupacion: 3, descanso: 24 },
                    { nombre: 'Potrero 2', ocupacion: 0, descanso: 12 },
                    { nombre: 'Potrero 3', ocupacion: 1, descanso: 30 },
                    { nombre: 'Potrero 4', ocupacion: 4, descanso: 18 },
                  ].map((p) => (
                    <div key={p.nombre}>
                      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                        <span className="text-gray-300 font-medium">{p.nombre}</span>
                        <span>
                          <span className="text-amber-300">{p.ocupacion}d ocupado</span>
                          {' · '}
                          <span className="text-emerald-300">{p.descanso}d descanso</span>
                        </span>
                      </div>
                      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-black/40">
                        <div className="h-full rounded-full bg-amber-500/80" style={{ width: `${(p.ocupacion / (p.ocupacion + p.descanso)) * 100}%` }} />
                        <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(p.descanso / (p.ocupacion + p.descanso)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px]">
                    <span className="text-gray-400">Carga animal</span>
                    <span className="font-bold text-white">2.1 UA/ha <span className="text-emerald-400 font-medium">· óptima</span></span>
                  </div>
                </div>
              </article>
            </Reveal>

            {/* Tarjeta 3 (1 columna): Contabilidad y Finanzas Ganaderas */}
            <Reveal>
              <article id="finanzas" onMouseMove={brilloBento} className="bento-card group h-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 sm:p-8 hover:border-emerald-500/40 hover:shadow-[0_0_40px_rgba(16,185,129,0.12)] transition-all duration-300 scroll-mt-24">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Wallet size={20} />
                </span>
                <h3 className="mt-4 text-xl font-bold font-heading text-white tracking-tight">
                  Contabilidad y finanzas ganaderas
                </h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  Ingresos por venta de ganado y leche contra costos de suplementación y veterinaria.
                </p>

                {/* Mini-gráfica de ingresos vs costos */}
                <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Ingresos</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" /> Costos</span>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      Margen +32%
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2 h-24">
                    {[
                      { i: 55, c: 40 }, { i: 70, c: 44 }, { i: 62, c: 36 }, { i: 90, c: 48 },
                    ].map(({ i, c }, idx) => (
                      <div key={idx} className="flex items-end gap-1 flex-1 justify-center">
                        <div className="w-3 rounded-t bg-emerald-500/80" style={{ height: `${i}%` }} />
                        <div className="w-3 rounded-t bg-amber-500/70" style={{ height: `${c}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] text-gray-500 font-mono">
                    <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-400">
                  <Receipt size={13} className="text-emerald-400 shrink-0" />
                  Facturación electrónica v4.4 y D-135-1 listos para Hacienda.
                </div>
              </article>
            </Reveal>

            {/* Tarjeta 4 (2 columnas): Modo Campo & Acceso Multi-dispositivo */}
            <Reveal delay={80} className="md:col-span-2">
              <article onMouseMove={brilloBento} className="bento-card group h-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 sm:p-8 hover:border-emerald-500/40 hover:shadow-[0_0_40px_rgba(16,185,129,0.12)] transition-all duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center h-full">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                        <Smartphone size={20} />
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-gray-300">
                        <Monitor size={11} className="text-emerald-400" /> Web · Móvil · Tablet
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-bold font-heading text-white tracking-tight">
                      Modo campo & multi-dispositivo
                    </h3>
                    <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                      Rápido en el celular desde el corral y potente en la computadora de la oficina.
                      Todo se sincroniza automáticamente entre dispositivos.
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2">
                        <Check size={15} className="text-emerald-400 shrink-0" /> Registra eventos con señal débil.
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={15} className="text-emerald-400 shrink-0" /> Foto del arete → identificación con IA.
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={15} className="text-emerald-400 shrink-0" /> Conteos de ganado con la cámara.
                      </li>
                    </ul>
                  </div>

                  {/* Mini-mockup móvil */}
                  <div className="flex justify-center">
                    <div className="w-52 rounded-[1.6rem] border border-white/15 bg-black/50 p-2.5 shadow-2xl shadow-emerald-950/40 rotate-2 group-hover:rotate-0 transition-transform duration-500">
                      <div className="rounded-[1.2rem] border border-white/10 bg-[#0D1512] p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-gray-300">Registro rápido</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        {[
                          { icono: Sparkles, label: 'Nacimiento', color: 'text-amber-300' },
                          { icono: TrendingUp, label: 'Pesaje', color: 'text-emerald-300' },
                          { icono: Wallet, label: 'Venta', color: 'text-emerald-300' },
                        ].map(({ icono: Icono, label, color }) => (
                          <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                            <span className={`flex items-center gap-2 text-[11px] font-medium ${color}`}>
                              <Icono size={13} /> {label}
                            </span>
                            <ArrowRight size={11} className="text-gray-500" />
                          </div>
                        ))}
                        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-[10px] text-emerald-300 font-medium text-center">
                          ✓ Sincronizado con la oficina
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECCIÓN DE MÉTRICAS / IMPACTO                                      */}
      {/* ================================================================== */}
      <section className="py-14 md:py-20 border-y border-white/5 bg-[#070B09]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {METRICAS.map((m, idx) => (
              <Reveal key={m.texto} delay={idx * 70}>
                <div className="text-center lg:text-left">
                  <div className={`text-3xl sm:text-4xl font-bold font-heading tracking-tight ${
                    idx === 1 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {m.valor}
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-gray-400 leading-relaxed">{m.texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CÓMO FUNCIONA EN 3 PASOS                                           */}
      {/* ================================================================== */}
      <section id="como-funciona" className="relative py-16 md:py-24 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-emerald-300">
                <Zap size={12} /> Simple & rápido
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
                Cómo funciona en 3 pasos
              </h2>
            </div>
          </Reveal>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Línea punteada conectora (desktop) */}
            <div className="hidden md:block absolute top-10 left-[16%] right-[16%] border-t border-dashed border-white/15" aria-hidden="true" />

            {PASOS.map((paso, idx) => (
              <Reveal key={paso.numero} delay={idx * 100}>
                <article className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 sm:p-8 hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 font-heading font-bold text-white text-lg shadow-lg shadow-emerald-500/25 relative z-10">
                      {paso.numero}
                    </span>
                    <paso.icono size={24} className="text-emerald-400/60 group-hover:text-emerald-300" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold font-heading text-white tracking-tight">{paso.titulo}</h3>
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">{paso.descripcion}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PRECIOS                                                            */}
      {/* ================================================================== */}
      <section id="precios" className="relative py-16 md:py-24 scroll-mt-20 bg-[#0D1512]">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/[0.08] blur-[140px] rounded-full pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-emerald-300">
                <Wallet size={12} /> Precios
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
                Precios justos para cada operación
              </h2>
              <p className="mt-3 text-gray-400 text-base">
                Empieza gratis hoy. Crece a tu ritmo cuando tu finca lo necesite.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {PLANES_LANDING.map((plan, idx) => (
              <Reveal key={plan.id} delay={idx * 80} className="h-full">
                <article
                  className={`relative h-full flex flex-col rounded-2xl border p-6 sm:p-8 backdrop-blur-md transition-all duration-300 ${
                    plan.destacado
                      ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-500/[0.08] to-white/[0.02] shadow-[0_0_50px_rgba(16,185,129,0.15)] lg:scale-[1.03]'
                      : 'border-white/10 bg-white/[0.03] hover:border-emerald-500/40'
                  }`}
                >
                  {plan.destacado && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-emerald-500/40">
                      {plan.badge}
                    </span>
                  )}

                  <h3 className="text-lg font-bold font-heading text-white tracking-tight">{plan.nombre}</h3>
                  <p className="mt-1 text-xs text-gray-400">{plan.subtitulo}</p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className={`text-4xl font-bold font-heading tracking-tight ${plan.destacado ? 'text-emerald-400' : 'text-white'}`}>
                      {plan.precio}
                    </span>
                    {plan.periodo && <span className="text-sm text-gray-400">{plan.periodo}</span>}
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-gray-300 flex-1">
                    {plan.caracteristicas.map((c) => (
                      <li key={c} className="flex items-start gap-2.5">
                        <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {plan.whatsapp ? (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-11 rounded-full border-white/15 bg-white/[0.03] text-gray-200 hover:bg-white/10 hover:text-white hover:border-emerald-500/40 font-semibold"
                      >
                        <a
                          href={`https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${WHATSAPP_VENTAS_MSG}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <MessageSquare size={16} className="text-emerald-400" />
                          {plan.cta}
                        </a>
                      </Button>
                    ) : (
                      <Button
                        className={`w-full h-11 rounded-full font-semibold ${
                          plan.destacado
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30'
                            : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                        }`}
                        onClick={() => handleSeleccionarPlan(plan.id)}
                        data-conversion={`pricing_${plan.id}`}
                      >
                        {plan.cta}
                      </Button>
                    )}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="mt-8 text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400" />
              Sin tarjeta de crédito para empezar. Cancela o actualiza cuando quieras.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA FINAL                                                          */}
      {/* ================================================================== */}
      <section id="comenzar" className="relative py-16 md:py-24 scroll-mt-20 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/60 via-[#0D1512] to-[#070B09] p-8 sm:p-14 text-center overflow-hidden">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/20 blur-[110px] rounded-full pointer-events-none" aria-hidden="true" />

              <div className="relative z-10 space-y-5">
                <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
                  Digitaliza tu finca hoy mismo
                </h2>
                <p className="text-gray-400 text-base max-w-xl mx-auto">
                  Únete a los productores que ya controlan su ganado, sus potreros y sus finanzas
                  sin papeles. Tu primera cuenta es gratis y tarda 2 minutos.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/30 transition-all group"
                    onClick={() => handleCtaPrincipal('cta_final')}
                    data-conversion="bottom_signup"
                  >
                    Crear cuenta gratis ahora
                    <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto h-12 px-7 rounded-full border-white/15 bg-white/[0.03] text-gray-200 hover:bg-white/10 hover:text-white"
                  >
                    <a
                      href={`https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${WHATSAPP_DEFAULT_MSG}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={18} className="text-emerald-400" />
                      Consultar por WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Espacio publicitario Google AdSense (solo visible si está configurado) */}
      <div className="max-w-4xl mx-auto px-4 my-6">
        <AdvertisingSlot mostrarPublico={true} tamaño="banner" />
      </div>

      {/* ================================================================== */}
      {/* FOOTER MINIMALISTA                                                 */}
      {/* ================================================================== */}
      <footer className="border-t border-white/5 bg-[#070B09] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Marca */}
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                <Tractor size={20} />
              </span>
              <div>
                <div className="font-heading font-bold text-white tracking-tight">
                  Contador<span className="text-emerald-400">Ganadero</span>
                </div>
                <div className="text-xs text-gray-500">Gestión integral de fincas · contadorganandero.com</div>
              </div>
            </div>

            {/* Enlaces */}
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400" aria-label="Enlaces de pie de página">
              <a href="#funciones" className="hover:text-emerald-400 transition-colors">Funciones</a>
              <a href="#pastoreo" className="hover:text-emerald-400 transition-colors">Pastoreo</a>
              <a href="#finanzas" className="hover:text-emerald-400 transition-colors">Finanzas</a>
              <a href="#precios" className="hover:text-emerald-400 transition-colors">Precios</a>
              <Link to="/login" className="hover:text-emerald-400 transition-colors">Iniciar Sesión</Link>
              <Link to="/terminos" className="hover:text-emerald-400 transition-colors">Términos</Link>
              <Link to="/privacidad" className="hover:text-emerald-400 transition-colors">Privacidad</Link>
              <Link to="/eliminacion-datos" className="hover:text-emerald-400 transition-colors">Eliminación de Datos</Link>
            </nav>

            {/* Estado del sistema */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Todos los sistemas operativos
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/5 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} ContadorGanadero · contadorganandero.com — Todos los derechos reservados.
            No afiliado directamente con el Ministerio de Hacienda ni el MAG de Costa Rica.
          </div>
        </div>
      </footer>

      {/* ================================================================== */}
      {/* BOTÓN FLOTANTE DE WHATSAPP                                         */}
      {/* ================================================================== */}
      <a
        href={`https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${WHATSAPP_DEFAULT_MSG}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-500 text-slate-950 font-bold text-sm shadow-2xl shadow-emerald-500/40 hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all"
        aria-label="Hablar con un asesor por WhatsApp"
      >
        <MessageSquare size={18} />
        <span className="hidden sm:inline">¿Dudas? Hablar por WhatsApp</span>
      </a>

      {/* CTA FIJO EN MÓVIL */}
      <div className="landing-cta-movil md:hidden">
        <Button
          size="lg"
          className="w-full rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-xl"
          onClick={() => handleCtaPrincipal('mobile_sticky_cta')}
          data-conversion="sticky_signup"
        >
          Comenzar Gratis (Sin Tarjeta) <ArrowRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
