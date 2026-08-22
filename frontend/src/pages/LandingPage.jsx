import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Tractor, Mail, Sparkles, LayoutDashboard, Warehouse,
  Receipt, TrendingUp, Calendar, Calculator, ArrowRight, Check,
  ChevronLeft, ChevronRight, ChevronDown, Share2
} from 'lucide-react';
import { PLANES } from '../data/planes';
import PlanCard from '../components/billing/PlanCard';
import { useReveal, useCarousel } from '../hooks/useReveal';
import useSeo from '../hooks/useSeo';
import fondoLogin from '../Recursos/fondo_login.webm';
import './LandingPage.css';

// ===== SEO: FAQ (se usa también para el schema FAQPage) =====
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
      'Hay un plan Free sin costo y sin tarjeta para probar la plataforma, y planes pagos (Bronce, Oro y Corporativo) que se ajustan al tamaño de tu operación. Podés cancelar cuando quieras.',
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

// Schema de negocio (servicio profesional) — completar con datos reales
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

const ITEMS_POR_VISTA = { mobile: 1, tablet: 2, desktop: 3 };

function getItemsPerView() {
  if (typeof window === 'undefined') return ITEMS_POR_VISTA.desktop;
  if (window.innerWidth < 640) return ITEMS_POR_VISTA.mobile;
  if (window.innerWidth < 1024) return ITEMS_POR_VISTA.tablet;
  return ITEMS_POR_VISTA.desktop;
}

export default function LandingPage() {
  const navigate = useNavigate();

  // ===== SEO: meta-título ≠ H1, meta-descripción, canonical, schemas =====
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

  // Compartir (Web Share API con fallback a copiar enlace)
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

  // Carousel for features
  const [slides, setSlides] = useState(() => {
    const perView = getItemsPerView();
    const chunks = [];
    for (let i = 0; i < CARACTERISTICAS.length; i += perView) {
      chunks.push(CARACTERISTICAS.slice(i, i + perView));
    }
    return chunks;
  });

  const { currentIndex, goTo, next, prev } = useCarousel({
    items: slides,
    interval: 5000,
    autoPlay: true,
  });

  // Update slides on resize
  useEffect(() => {
    const handleResize = () => {
      const perView = getItemsPerView();
      const chunks = [];
      for (let i = 0; i < CARACTERISTICAS.length; i += perView) {
        chunks.push(CARACTERISTICAS.slice(i, i + perView));
      }
      setSlides(chunks);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          <button className="landing-share-btn" onClick={handleCompartir} aria-label="Compartir" title="Compartir">
            <Share2 size={18} /> {copiado ? '¡Copiado!' : ''}
          </button>
          <Link to="/login" className="btn btn-outline">Iniciar Sesión</Link>
          <Link to="/login" className="btn btn-primary">Comenzar Gratis</Link>
        </div>
      </header>

      {/* Hero (único H1 de la página) */}
      <section ref={heroRef} className={`landing-hero ${heroVisible ? 'landing-hero--visible' : ''}`}>
        <video className="landing-hero-video" autoPlay muted loop playsInline preload="auto">
          <source src={fondoLogin} type="video/webm" />
        </video>
        <div className="landing-hero-overlay" />
        <div className="landing-hero-contenido animate-slide-up">
          <span className="landing-badge">Régimen Especial Agropecuario (REA)</span>
          <h1 className="landing-hero-titulo">
            Tu contador personal<br />automatizado para la finca
          </h1>
          <p className="landing-hero-subtitulo">
            ContadorGanadero es la plataforma para pequeños productores agropecuarios
            de Costa Rica: importa facturas por correo, categoriza gastos con IA y
            genera tus declaraciones de Hacienda sin esfuerzo.
          </p>
          <div className="landing-hero-ctas">
            <Link to="/login" className="btn btn-primary btn-lg">
              Comenzar Gratis <ArrowRight size={18} />
            </Link>
            <a href="#como-funciona" className="btn btn-outline btn-lg">
              Ver cómo funciona
            </a>
          </div>
          <ul className="landing-hero-stats" aria-label="Datos clave">
            <li><strong>4</strong> especies controladas</li>
            <li><strong>IVA 1%</strong> régimen REA</li>
            <li><strong>3</strong> declaraciones automatizadas</li>
            <li><strong>100%</strong> en línea</li>
          </ul>
        </div>
      </section>

      {/* TL;DR / En resumen (después de la intención de búsqueda) */}
      <section ref={tldrRef} id="resumen" className={`landing-seccion ${tldrVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-tldr glass-card">
          <h2 className="landing-tldr-titulo">En resumen</h2>
          <ul className="landing-tldr-lista">
            <li>
              <Check size={16} />
              <span><strong>Automatiza tu contabilidad:</strong> las facturas llegan solas desde tu correo y la IA las clasifica.</span>
            </li>
            <li>
              <Check size={16} />
              <span><strong>Cumple con Hacienda:</strong> IVA (D-135-1), Renta (D-101) y conciliación REA (D-150) listas para declarar.</span>
            </li>
            <li>
              <Check size={16} />
              <span><strong>Conoce tu rentabilidad real:</strong> costo por kilo de carne, cartón de huevos o kilo de tilapia.</span>
            </li>
            <li>
              <Check size={16} />
              <span><strong>Todo en un solo lugar:</strong> inventario de bovinos, aves, peces y abejas, sin hojas de cálculo.</span>
            </li>
          </ul>
          <Link to="/login" className="btn btn-primary">
            Empieza hoy, gratis <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Características - Carrusel */}
      <section ref={featuresRef} id="caracteristicas" className={`landing-seccion ${featuresVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo">Todo lo que tu finca necesita</h2>
          <p className="landing-seccion-subtitulo">
            Una plataforma completa diseñada para el productor agropecuario costarricense.
          </p>
        </div>

        <div className="landing-carousel">
          <div className="landing-carousel-track" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
            {slides.map((slide, slideIndex) => (
              <div key={slideIndex} className="landing-carousel-slide">
                <div className="landing-caracteristicas-grid">
                  {slide.map(({ icono: Icono, titulo, descripcion }) => (
                    <div key={titulo} className="landing-caracteristica glass-card animate-fade-in" style={{ animationDelay: `${slideIndex * 150}ms` }}>
                      <div className="landing-caracteristica-icono">
                        <Icono size={22} />
                      </div>
                      <h3 className="landing-caracteristica-titulo">{titulo}</h3>
                      <p className="landing-caracteristica-desc">{descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {slides.length > 1 && (
            <>
              <button className="landing-carousel-btn landing-carousel-btn--prev" onClick={prev} aria-label="Anterior">
                <ChevronLeft size={22} />
              </button>
              <button className="landing-carousel-btn landing-carousel-btn--next" onClick={next} aria-label="Siguiente">
                <ChevronRight size={22} />
              </button>

              <div className="landing-carousel-dots" role="tablist" aria-label="Navegación del carrusel">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    className={`landing-carousel-dot ${i === currentIndex ? 'landing-carousel-dot--active' : ''}`}
                    onClick={() => goTo(i)}
                    role="tab"
                    aria-selected={i === currentIndex}
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
          <h2 className="landing-seccion-titulo">¿Cómo funciona?</h2>
          <p className="landing-seccion-subtitulo">
            En tres pasos, tu contabilidad queda bajo control.
          </p>
        </div>
        <div className="landing-pasos">
          {PASOS.map(({ numero, titulo, descripcion }, i) => (
            <div key={numero} className={`landing-paso glass-card ${stepsVisible ? 'landing-paso--visible' : ''}`} style={{ animationDelay: `${i * 150}ms` }}>
              <div className="landing-paso-numero">{numero}</div>
              <h3 className="landing-paso-titulo">{titulo}</h3>
              <p className="landing-paso-desc">{descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativa (tabla) */}
      <section ref={comparativaRef} id="comparativa" className={`landing-seccion ${comparativaVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo">Contabilidad manual vs. ContadorGanadero</h2>
          <p className="landing-seccion-subtitulo">
            Deja atrás las hojas de cálculo y los cuadernos: esto es lo que ganas al automatizar.
          </p>
        </div>
        <div className="table-responsive">
          <table className="landing-tabla">
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
                  <td>{fila.tarea}</td>
                  <td>{fila.manual}</td>
                  <td className="landing-tabla-ventaja"><Check size={14} /> {fila.app}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Planes y precios */}
      <section ref={pricingRef} id="planes" className={`landing-seccion ${pricingVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo">Planes y precios</h2>
          <p className="landing-seccion-subtitulo">
            Elige el plan que mejor se adapta al tamaño de tu operación.
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
        <p className="landing-planes-nota">
          <Check size={14} /> Sin tarjeta para el plan Free. Cancela cuando quieras.
        </p>
      </section>

      {/* FAQ */}
      <section ref={faqRef} id="faq" className={`landing-seccion ${faqVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo">Preguntas frecuentes</h2>
          <p className="landing-seccion-subtitulo">
            Las dudas más comunes de los productores agropecuarios.
          </p>
        </div>
        <div className="landing-faq">
          {FAQ.map((item, i) => {
            const abierta = faqAbierta === i;
            return (
              <div key={item.pregunta} className={`landing-faq-item ${abierta ? 'landing-faq-item--abierta' : ''}`}>
                <button
                  className="landing-faq-pregunta"
                  onClick={() => setFaqAbierta(abierta ? -1 : i)}
                  aria-expanded={abierta}
                >
                  <h3>{item.pregunta}</h3>
                  <ChevronDown size={20} className="landing-faq-chevron" />
                </button>
                {abierta && <p className="landing-faq-respuesta">{item.respuesta}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section ref={ctaRef} id="comenzar" className={`landing-seccion ${ctaVisible ? 'landing-seccion--visible' : ''}`}>
        <div className="landing-cta-final glass-card">
          <h2 className="landing-cta-final-titulo">Empieza hoy a controlar tu finca</h2>
          <p className="landing-cta-final-subtitulo">
            Crea tu cuenta gratis y ten tu contabilidad agropecuaria lista en minutos.
          </p>
          <Link to="/login" className="btn btn-primary btn-lg">
            Crear cuenta gratis <ArrowRight size={18} />
          </Link>
        </div>
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
        </div>
        <p className="landing-footer-copy">
          © {new Date().getFullYear()} ContadorGanadero. Todos los derechos reservados.
        </p>
      </footer>

      {/* CTA fijo en móvil */}
      <div className="landing-cta-movil">
        <Link to="/login" className="btn btn-primary">
          Comenzar Gratis <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
