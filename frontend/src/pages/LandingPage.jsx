import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Tractor, Mail, Sparkles, LayoutDashboard, Warehouse,
  Receipt, TrendingUp, Calendar, Calculator, ArrowRight, Check,
  ChevronLeft, ChevronRight, ChevronDown, Share2, ShieldCheck, Zap
} from 'lucide-react';
import { PLANES } from '../data/planes';
import PlanCard from '../components/billing/PlanCard';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { useReveal, useCarousel } from '../hooks/useReveal';
import useSeo from '../hooks/useSeo';
import fondoLogin from '../assets/videos/fondo_login.webm';
import './LandingPage.css';

const CARACTERISTICAS = [
  {
    icono: Mail,
    titulo: 'Importación por correo',
    descripcion: 'Conecta tu correo y descargamos automáticamente tus facturas electrónicas (XML/PDF) vía IMAP.',
  },
  {
    icono: Sparkles,
    titulo: 'Categorización con IA',
    descripcion: 'La inteligencia artificial clasifica tus gastos automáticamente en las categorías correctas.',
  },
  {
    icono: Warehouse,
    titulo: 'Control de inventario',
    descripcion: 'Bovinos, aves de postura, peces (acuicultura) y abejas (apicultura) en un solo lugar.',
  },
  {
    icono: TrendingUp,
    titulo: 'Costos de producción',
    descripcion: 'Calcula el costo por kg de carne, cartón de huevos, FCA y conoce tus márgenes reales.',
  },
  {
    icono: Calculator,
    titulo: 'Impuestos Costa Rica',
    descripcion: 'IVA Cuatrimestral (D-135-1) y Renta Anual (D-101) con lógica tributaria 2026.',
  },
  {
    icono: Receipt,
    titulo: 'Facturación REA',
    descripcion: 'Facturación electrónica con tarifa reducida del 1% de IVA, en cumplimiento Hacienda/MAG.',
  },
  {
    icono: LayoutDashboard,
    titulo: 'Dashboard analítico',
    descripcion: 'Visualiza ingresos, gastos y rentabilidad de tu finca con gráficos en tiempo real.',
  },
  {
    icono: Calendar,
    titulo: 'Calendario fiscal',
    descripcion: 'Nunca pierdas una fecha de declaración con el calendario fiscal integrado.',
  },
];

const PASOS = [
  {
    numero: '1',
    titulo: 'Conecta tu correo',
    descripcion: 'Vincula tu correo y recibimos las facturas electrónicas automáticamente.',
  },
  {
    numero: '2',
    titulo: 'La IA categoriza tus gastos',
    descripcion: 'Nuestra IA clasifica compras y gastos sin que tengas que digitar nada.',
  },
  {
    numero: '3',
    titulo: 'Reportes y declaraciones listas',
    descripcion: 'Genera los reportes y declaraciones que Hacienda exige, con un clic.',
  },
];

// Tabla comparativa (contabilidad manual vs ContadorGanadero)
const COMPARATIVA = [
  { tarea: 'Descargar facturas de proveedores', manual: 'Manual (abrir cada correo)', app: 'Automático vía IMAP' },
  { tarea: 'Clasificar gastos', manual: 'A mano, una por una', app: 'Automatizado con IA' },
  { tarea: 'IVA cuatrimestral (D-135-1)', manual: 'Cálculo en hojas de cálculo', app: 'Calculado y listo para declarar' },
  { tarea: 'Renta anual (D-101)', manual: 'Contador externo', app: 'Con tramos progresivos actualizados' },
  { tarea: 'Costo real de producción', manual: 'Difícil de estimar', app: 'Por kg, cartón o kilo de tilapia' },
  { tarea: 'Facturación electrónica', manual: 'Software aparte', app: 'Integrada (v4.4 Hacienda)' },
];

// FAQ (se usa también para el schema FAQPage)
const FAQ = [
  {
    pregunta: '¿Necesito estar inscrito en Hacienda para usar ContadorGanadero?',
    respuesta:
      'Para emitir facturas electrónicas y presentar declaraciones necesitas estar inscrito como contribuyente. Los productores agropecuarios de Costa Rica suelen estar en el Régimen Especial Agropecuario (REA), con inscripción ante el MAG. Para registrar gastos e ingresos internos puedes empezar sin estar al día con Hacienda.',
  },
  {
    pregunta: '¿Cómo se descargan mis facturas electrónicas automáticamente?',
    respuesta:
      'Conectas una cuenta de correo (Gmail, Outlook u otro con IMAP) donde recibís las facturas de tus proveedores. La plataforma lee los correos, descarga los archivos XML y PDF, extrae los datos y los categoriza con inteligencia artificial. No tenés que digitar nada.',
  },
  {
    pregunta: '¿Funciona con facturas del 1% de IVA del régimen agropecuario?',
    respuesta:
      'Sí. ContadorGanadero está diseñado específicamente para la tarifa reducida del 1% del Régimen Especial Agropecuario (REA) y para la facturación electrónica v4.4 de Hacienda, incluyendo la clave numérica de 50 dígitos y la firma digital.',
  },
  {
    pregunta: '¿Qué impuestos calcula la plataforma?',
    respuesta:
      'Calcula el IVA cuatrimestral (formulario D-135-1), la renta anual (D-101) con tramos progresivos y la conciliación anual del REA (D-150). Además incluye un calendario fiscal con los vencimientos de Hacienda.',
  },
  {
    pregunta: '¿Puedo controlar bovinos, aves, peces y abejas?',
    respuesta:
      'Sí. El módulo de inventario multiespecie registra pesos de bovinos, ciclos de postura de aves, biomasa de peces y extracciones de miel de colmenas. También calcula el costo real de producción por kilo, cartón de huevos o kilo de tilapia.',
  },
  {
    pregunta: '¿Cuánto cuesta? ¿Hay plan gratuito?',
    respuesta:
      'Hay un plan Gratis sin costo y sin tarjeta para probar la plataforma (con anuncios en la web), y dos planes de pago: Pro ($19/mes) y Agro ($49/mes). Los planes de pago eliminan los anuncios y suman más conteos, VLM y soporte. Podés cancelar cuando quieras.',
  },
];

// Schema FAQPage generado a partir de las preguntas
const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.pregunta,
    acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
  })),
};

// Schema de negocio (servicio profesional)
const NEGOCIO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'ContadorGanadero',
  url: 'https://contadorganadero.com',
  image: 'https://contadorganadero.com/favicon.svg',
  description:
    'Contabilidad, inventario y facturación electrónica para productores agropecuarios de Costa Rica bajo el Régimen Especial Agropecuario (REA).',
  areaServed: { '@type': 'Country', name: 'Costa Rica' },
  priceRange: '$$',
  knowsAbout: [
    'Facturación electrónica Costa Rica v4.4',
    'Régimen Especial Agropecuario REA',
    'Declaración IVA D-135-1',
    'Declaración de renta D-101',
    'Conciliación D-150',
  ],
};

const ITEMS_POR_VISTA = { mobile: 1, tablet: 2, desktop: 3 };

function getItemsPerView() {
  if (typeof window === 'undefined') return ITEMS_POR_VISTA.desktop;
  if (window.innerWidth < 640) return ITEMS_POR_VISTA.mobile;
  if (window.innerWidth < 1024) return ITEMS_POR_VISTA.tablet;
  return ITEMS_POR_VISTA.desktop;
}

export default function LandingPage() {
  const navigate = useNavigate();

  // ===== SEO =====
  useSeo({
    title: 'ContadorGanadero | Contabilidad Agrícola y Facturación REA en Costa Rica',
    description:
      'Plataforma para productores agropecuarios de Costa Rica: importa facturas electrónicas por correo, categoriza gastos con IA y genera tus declaraciones de IVA y Renta del Régimen Especial Agropecuario (REA).',
    path: '/',
    jsonLd: [NEGOCIO_SCHEMA, FAQ_SCHEMA],
  });

  const handleSeleccionarPlan = () => {
    navigate('/login');
  };

  // Compartir
  const [copiado, setCopiado] = useState(false);
  const handleCompartir = async () => {
    const url = window.location.href;
    const titulo = document.title;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }
    } catch {
      /* usuario canceló el share */
    }
  };

  // FAQ acordeón
  const [faqAbierta, setFaqAbierta] = useState(0);

  // Reveal animations for sections
  const [heroRef, heroVisible] = useReveal({ rootMargin: '0px 0px -20% 0px' });
  const [tldrRef, tldrVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [featuresRef, featuresVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [stepsRef, stepsVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [comparativaRef, comparativaVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [pricingRef, pricingVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [faqRef, faqVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [ctaRef, ctaVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [footerRef, footerVisible] = useReveal({ rootMargin: '0px 0px -10% 0px' });

  const carouselRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchEndRef = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);

  const [itemsPerView, setItemsPerView] = useState(getItemsPerView);

  const slides = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < CARACTERISTICAS.length; i += itemsPerView) {
      chunks.push(CARACTERISTICAS.slice(i, i + itemsPerView));
    }
    return chunks;
  }, [itemsPerView]);

  const { currentIndex, goTo, next, prev, pause, resume } = useCarousel({
    items: slides,
    interval: 5000,
    autoPlay: true,
  });

  const safeIndex = Math.min(currentIndex, Math.max(slides.length - 1, 0));

  useEffect(() => {
    const sync = () => setItemsPerView((actual) => {
      const siguiente = getItemsPerView();
      return siguiente === actual ? actual : siguiente;
    });

    sync();

    const consultas = [
      window.matchMedia('(max-width: 639px)'),
      window.matchMedia('(max-width: 1023px)'),
    ];
    consultas.forEach((mq) => mq.addEventListener('change', sync));
    window.addEventListener('orientationchange', sync);
    return () => {
      consultas.forEach((mq) => mq.removeEventListener('change', sync));
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!carouselRef.current) return;
      if (!carouselRef.current.contains(document.activeElement) && e.target !== carouselRef.current) {
        const carouselEl = document.querySelector('.landing-carousel');
        if (!carouselEl || !carouselEl.contains(document.activeElement)) return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [next, prev]);

  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchEndRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchMovedRef.current = false;
    pause();
  }, [pause]);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current.x) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    touchEndRef.current = { x: currentX, y: currentY };
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      touchMovedRef.current = true;
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current.x || !touchMovedRef.current) {
      resume();
      return;
    }
    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) next();
      else prev();
    }
    resume();
  }, [next, prev, resume]);

  const handleMouseEnter = useCallback(() => pause(), [pause]);
  const handleMouseLeave = useCallback(() => resume(), [resume]);
  const handleFocusIn = useCallback(() => pause(), [pause]);
  const handleFocusOut = useCallback(() => resume(), [resume]);

  return (
    <div className="landing">
      {/* Navbar */}
      <header className={`landing-nav ${heroVisible ? 'landing-nav--scrolled' : ''}`}>
        <div className="landing-nav-brand">
          <div className="landing-nav-logo">
            <Tractor size={26} />
          </div>
          <span className="landing-nav-title">ContadorGanadero</span>
        </div>
        <nav className="landing-nav-links" aria-label="Navegación principal">
          <a href="#caracteristicas">Características</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#comparativa">Comparativa</a>
          <a href="#planes">Planes</a>
          <a href="#faq">Preguntas</a>
        </nav>
        <div className="landing-nav-actions">
          <Button
            variant="ghost"
            size="sm"
            className="landing-share-btn gap-1.5"
            onClick={handleCompartir}
            aria-label="Compartir"
            title="Compartir"
          >
            <Share2 size={16} /> {copiado ? '¡Copiado!' : ''}
          </Button>
          <Button asChild variant="outline" size="sm" className="landing-nav-login">
            <Link to="/login">Iniciar Sesión</Link>
          </Button>
          <Button asChild variant="gradient" size="sm" className="landing-nav-cta">
            <Link to="/login">Comenzar Gratis</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section ref={heroRef} className={`landing-hero ${heroVisible ? 'landing-hero--visible' : ''}`}>
        <video className="landing-hero-video" autoPlay muted loop playsInline preload="auto">
          <source src={fondoLogin} type="video/webm" />
        </video>
        <div className="landing-hero-overlay" />
        <div className="landing-hero-contenido animate-slide-up">
          <div className="inline-flex items-center gap-2 mb-4">
            <Badge variant="default" className="text-xs px-3.5 py-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 backdrop-blur-md shadow-md">
              <ShieldCheck size={14} className="mr-1.5 inline" /> Régimen Especial Agropecuario (REA)
            </Badge>
          </div>
          <h1 className="landing-hero-titulo font-heading font-black tracking-tight">
            Tu contador personal<br />automatizado para la finca
          </h1>
          <p className="landing-hero-subtitulo text-slate-300">
            ContadorGanadero es la plataforma para pequeños productores agropecuarios
            de Costa Rica: importa facturas por correo, categoriza gastos con IA y
            genera tus declaraciones de Hacienda sin esfuerzo.
          </p>
          <div className="landing-hero-ctas flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-xs sm:max-w-none mx-auto pt-2">
            <Button asChild variant="gradient" size="lg" className="h-12 px-7 text-base shadow-xl w-full sm:w-auto">
              <Link to="/login">
                Comenzar Gratis <ArrowRight size={18} className="ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-7 text-base bg-slate-900/60 backdrop-blur-md border-slate-700 w-full sm:w-auto">
              <a href="#como-funciona">
                Ver cómo funciona
              </a>
            </Button>
          </div>
          <ul className="landing-hero-stats" aria-label="Datos clave">
            <li><strong>4</strong> especies controladas</li>
            <li><strong>IVA 1%</strong> régimen REA</li>
            <li><strong>3</strong> declaraciones automatizadas</li>
            <li><strong>100%</strong> en línea</li>
          </ul>
        </div>
      </section>

      {/* TL;DR / En resumen */}
      <section ref={tldrRef} id="resumen" className={`landing-seccion ${tldrVisible ? 'landing-seccion--visible' : ''}`}>
        <Card className="landing-tldr max-w-4xl mx-auto p-8 border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-amber-400" />
            <h2 className="landing-tldr-titulo text-2xl font-bold font-heading text-white">En resumen</h2>
          </div>
          <ul className="landing-tldr-lista space-y-3.5 my-6 text-slate-200">
            <li className="flex items-start gap-3">
              <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Automatiza tu contabilidad:</strong> las facturas llegan solas desde tu correo y la IA las clasifica.</span>
            </li>
            <li className="flex items-start gap-3">
              <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Cumple con Hacienda:</strong> IVA (D-135-1), Renta (D-101) y conciliación REA (D-150) listas para declarar.</span>
            </li>
            <li className="flex items-start gap-3">
              <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Conoce tu rentabilidad real:</strong> costo por kilo de carne, cartón de huevos o kilo de tilapia.</span>
            </li>
            <li className="flex items-start gap-3">
              <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Todo en un solo lugar:</strong> inventario de bovinos, aves, peces y abejas, sin hojas de cálculo.</span>
            </li>
          </ul>
          <div className="pt-2">
            <Button asChild variant="gradient" size="default">
              <Link to="/login">
                Empieza hoy, gratis <ArrowRight size={16} className="ml-1.5" />
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      {/* Características - Carrusel */}
      <section ref={featuresRef} id="caracteristicas" className={`landing-seccion ${featuresVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo font-heading font-extrabold text-3xl md:text-4xl text-white">Todo lo que tu finca necesita</h2>
          <p className="landing-seccion-subtitulo text-slate-400">
            Una plataforma completa diseñada para el productor agropecuario costarricense.
          </p>
        </div>

        <div
          ref={carouselRef}
          className="landing-carousel"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocusIn={handleFocusIn}
          onFocusOut={handleFocusOut}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="region"
          aria-label="Carrusel de características"
          aria-roledescription="carousel"
        >
          <div className="landing-carousel-viewport">
            <div
              className="landing-carousel-track"
              style={{ transform: `translateX(-${safeIndex * 100}%)` }}
            >
              {slides.map((slide, slideIndex) => (
                <div
                  key={slideIndex}
                  className="landing-carousel-slide"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Slide ${slideIndex + 1} de ${slides.length}`}
                  aria-hidden={slideIndex !== safeIndex}
                  inert={slideIndex !== safeIndex}
                >
                  <div className="landing-caracteristicas-grid">
                    {slide.map(({ icono: Icono, titulo, descripcion }) => (
                      <Card key={titulo} className="landing-caracteristica border-slate-800 bg-slate-900/70 hover:border-emerald-500/40 hover:shadow-xl transition-all duration-300">
                        <CardHeader className="p-6">
                          <div className="landing-caracteristica-icono mb-2">
                            <Icono size={22} className="text-emerald-400" />
                          </div>
                          <CardTitle className="text-xl font-bold font-heading">{titulo}</CardTitle>
                          <CardDescription className="text-slate-400 text-sm mt-2 leading-relaxed">
                            {descripcion}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div aria-live="polite" aria-atomic="true" className="sr-only">
            Mostrando slide {safeIndex + 1} de {slides.length}
          </div>

          {slides.length > 1 && (
            <>
              <button className="landing-carousel-btn landing-carousel-btn--prev" onClick={prev} aria-label="Slide anterior">
                <ChevronLeft size={22} />
              </button>
              <button className="landing-carousel-btn landing-carousel-btn--next" onClick={next} aria-label="Slide siguiente">
                <ChevronRight size={22} />
              </button>

              <div className="landing-carousel-dots" role="tablist" aria-label="Navegación del carrusel">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    className={`landing-carousel-dot ${i === safeIndex ? 'landing-carousel-dot--active' : ''}`}
                    onClick={() => goTo(i)}
                    role="tab"
                    aria-selected={i === safeIndex}
                    aria-label={`Ir a slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Cómo funciona */}
      <section ref={stepsRef} id="como-funciona" className={`landing-seccion ${stepsVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo font-heading font-extrabold text-3xl md:text-4xl text-white">¿Cómo funciona?</h2>
          <p className="landing-seccion-subtitulo text-slate-400">
            En tres pasos, tu contabilidad queda bajo control.
          </p>
        </div>
        <div className="landing-pasos">
          {PASOS.map(({ numero, titulo, descripcion }, i) => (
            <Card key={numero} className={`landing-paso border-slate-800 bg-slate-900/70 shadow-lg ${stepsVisible ? 'landing-paso--visible' : ''}`} style={{ animationDelay: `${i * 150}ms` }}>
              <CardContent className="p-6">
                <div className="landing-paso-numero">{numero}</div>
                <h3 className="landing-paso-titulo text-xl font-bold font-heading text-white mt-4">{titulo}</h3>
                <p className="landing-paso-desc text-slate-400 text-sm mt-2">{descripcion}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparativa (tabla) */}
      <section ref={comparativaRef} id="comparativa" className={`landing-seccion ${comparativaVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo font-heading font-extrabold text-3xl md:text-4xl text-white">Contabilidad manual vs. ContadorGanadero</h2>
          <p className="landing-seccion-subtitulo text-slate-400">
            Deja atrás las hojas de cálculo y los cuadernos: esto es lo que ganas al automatizar.
          </p>
        </div>
        <div className="table-responsive landing-tabla-wrap">
          <table className="landing-tabla tabla--stack">
            <thead>
              <tr>
                <th scope="col">Tarea</th>
                <th scope="col">Forma tradicional</th>
                <th scope="col">Con ContadorGanadero</th>
              </tr>
            </thead>
            <tbody>
              {COMPARATIVA.map((fila) => (
                <tr key={fila.tarea}>
                  <td data-label="Tarea">{fila.tarea}</td>
                  <td data-label="Forma tradicional">{fila.manual}</td>
                  <td className="landing-tabla-ventaja" data-label="Con ContadorGanadero">
                    <Check size={14} /> {fila.app}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Planes y precios */}
      <section ref={pricingRef} id="planes" className={`landing-seccion ${pricingVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo font-heading font-extrabold text-3xl md:text-4xl text-white">Planes y precios</h2>
          <p className="landing-seccion-subtitulo text-slate-400">
            Empezá gratis y subí de plan cuando tu finca lo necesite. Pro y Agro no muestran anuncios.
          </p>
        </div>
        <div className="landing-planes-grid">
          {PLANES.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              planActual={undefined}
              onSeleccionar={handleSeleccionarPlan}
              disabled={false}
            />
          ))}
        </div>
        <p className="landing-planes-nota text-slate-400">
          <Check size={14} className="text-emerald-400 inline mr-1" /> Sin tarjeta para el plan Gratis. Cancela cuando quieras.
        </p>
      </section>

      {/* FAQ */}
      <section ref={faqRef} id="faq" className={`landing-seccion ${faqVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo font-heading font-extrabold text-3xl md:text-4xl text-white">Preguntas frecuentes</h2>
          <p className="landing-seccion-subtitulo text-slate-400">
            Las dudas más comunes de los productores agropecuarios.
          </p>
        </div>
        <div className="landing-faq max-w-3xl mx-auto space-y-3">
          {FAQ.map((item, i) => {
            const abierta = faqAbierta === i;
            return (
              <div key={item.pregunta} className={`landing-faq-item rounded-xl border border-slate-800 bg-slate-900/70 ${abierta ? 'landing-faq-item--abierta border-emerald-500/40 shadow-lg' : ''}`}>
                <button
                  className="landing-faq-pregunta w-full flex items-center justify-between p-5 text-left"
                  onClick={() => setFaqAbierta(abierta ? -1 : i)}
                  aria-expanded={abierta}
                >
                  <h3 className="font-semibold text-base text-white">{item.pregunta}</h3>
                  <ChevronDown size={20} className={`landing-faq-chevron transition-transform duration-200 text-slate-400 ${abierta ? 'rotate-180 text-emerald-400' : ''}`} />
                </button>
                {abierta && <p className="landing-faq-respuesta px-5 pb-5 text-slate-300 text-sm leading-relaxed border-t border-slate-800/60 pt-3">{item.respuesta}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section ref={ctaRef} id="comenzar" className={`landing-seccion ${ctaVisible ? 'landing-seccion--visible' : ''}`}>
        <Card className="landing-cta-final max-w-4xl mx-auto p-10 text-center border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-900 shadow-2xl">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="landing-cta-final-titulo text-3xl md:text-4xl font-black font-heading text-white">Empieza hoy a controlar tu finca</CardTitle>
            <CardDescription className="landing-cta-final-subtitulo text-slate-300 text-base max-w-xl mx-auto mt-2">
              Crea tu cuenta gratis y ten tu contabilidad agropecuaria lista en minutos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Button asChild variant="gradient" size="lg" className="h-12 px-8 text-base shadow-xl">
              <Link to="/login">
                Crear cuenta gratis <ArrowRight size={18} className="ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer ref={footerRef} className={`landing-footer ${footerVisible ? 'landing-footer--visible' : ''}`}>
        <div className="landing-footer-brand">
          <div className="landing-footer-logo">
            <Tractor size={22} />
          </div>
          <span>ContadorGanadero</span>
        </div>
        <p className="landing-footer-desc">
          Cumplimiento tributario con Hacienda y MAG — Costa Rica.
        </p>
        <div className="landing-footer-links">
          <Link to="/login">Iniciar Sesión</Link>
          <a href="#caracteristicas">Características</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#comparativa">Comparativa</a>
          <a href="#planes">Planes</a>
          <a href="#faq">Preguntas frecuentes</a>
          <Link to="/terminos">Términos y Condiciones</Link>
          <Link to="/condiciones-servicio">Condiciones del Servicio</Link>
          <Link to="/privacidad">Política de Privacidad</Link>
        </div>
        <p className="landing-footer-copy">
          © {new Date().getFullYear()} ContadorGanadero. Todos los derechos reservados.
        </p>
      </footer>

      {/* CTA fijo en móvil */}
      <div className="landing-cta-movil">
        <Button asChild variant="gradient" className="w-full shadow-lg">
          <Link to="/login">
            Comenzar Gratis <ArrowRight size={16} className="ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}