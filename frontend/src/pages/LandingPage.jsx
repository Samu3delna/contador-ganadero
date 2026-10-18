import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  Tractor, Mail, Sparkles, LayoutDashboard, Warehouse,
  Receipt, TrendingUp, Calculator, ArrowRight, Check,
  ChevronDown, Share2, ShieldCheck, Zap,
  MessageSquare, Star, Clock, AlertTriangle, HelpCircle, Lock,
  FileCheck2, DollarSign, Activity, Building2
} from 'lucide-react';
import { PLANES } from '../data/planes';
import PlanCard from '../components/billing/PlanCard';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardFooter } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { useReveal } from '../hooks/useReveal';
import useSeo from '../hooks/useSeo';
import AdvertisingSlot from '../components/ads/AdvertisingSlot';
import './LandingPage.css';

// WhatsApp de contacto para pre-venta y dudas del REA en Costa Rica
const WHATSAPP_CONTACT_NUMBER = '50688888888';
const WHATSAPP_DEFAULT_MSG = encodeURIComponent('Hola, vi la plataforma ContadorGanadero y quisiera información sobre cómo automatizar la contabilidad de mi finca bajo el REA.');

const CARACTERISTICAS = [
  {
    icono: Mail,
    titulo: 'Buzón Cloudflare instantáneo',
    descripcion: 'Tu finca recibe un correo exclusivo (tu-finca@contadorganadero.com). Pide a tus proveedores que envíen las facturas ahí y entran al instante sin configurar IMAP.',
    tag: 'Automático & Seguro',
  },
  {
    icono: MessageSquare,
    titulo: 'Bot de WhatsApp para la finca',
    descripcion: 'Reenvía archivos XML, PDFs o fotos de tiquetes directamente por WhatsApp mientras estás en el potrero, la subasta o la veterinaria.',
    tag: 'Móvil & WhatsApp',
  },
  {
    icono: Sparkles,
    titulo: 'Categorización con IA (Gemini & NVIDIA)',
    descripcion: 'Inteligencia artificial entrenada en códigos Cabys y agropecuarios clasifica cada gasto e insumo en tu contabilidad de inmediato.',
    tag: 'Doble Motor IA',
  },
  {
    icono: ShieldCheck,
    titulo: 'Auditoría de IVA al 1% REA',
    descripcion: 'Detección automática de errores cuando un comercio o ferretería te factura al 13% en vez de la tarifa reducida del 1% del sector agropecuario.',
    tag: 'Ahorro Inmediato',
  },
  {
    icono: Calculator,
    titulo: 'Impuestos Costa Rica (D-135-1 & D-101)',
    descripcion: 'Cálculo automatizado del IVA Cuatrimestral y Renta Anual con los tramos progresivos y deducciones del Régimen Especial Agropecuario.',
    tag: 'Hacienda al Día',
  },
  {
    icono: Receipt,
    titulo: 'Facturas Electrónicas v4.4',
    descripcion: 'Emisión, firma y validación de Factura Electrónica (FE), Tiquete (TE) y Notas de Crédito (NC) con acuses oficiales de Hacienda en tiempo real.',
    tag: 'Versión v4.4',
  },
  {
    icono: TrendingUp,
    titulo: 'Costos reales de producción',
    descripcion: 'Calcula el costo por kg de carne en canal, cartón de huevos, kilo de tilapia o cosecha de miel sin enredos de hojas de cálculo.',
    tag: 'Rentabilidad Real',
  },
  {
    icono: Warehouse,
    titulo: 'Inventario multiespecie',
    descripcion: 'Bovinos de engorde y leche, aves de postura, acuicultura y apicultura en un solo lugar con registro de pesajes y conteo visual.',
    tag: '4 Especies',
  },
  {
    icono: LayoutDashboard,
    titulo: 'Conciliación D-150 TRIBU-CR',
    descripcion: 'Guía paso a paso con los totales de importes e impuestos soportados lista para declarar con tranquilidad ante el Ministerio de Hacienda.',
    tag: 'TRIBU-CR 2026',
  },
];

const PASOS = [
  {
    numero: '1',
    titulo: 'Pasa tu correo o envía por WhatsApp',
    descripcion: 'Da a tus proveedores tu dirección de finca (@contadorganadero.com) o reenvía tus facturas y fotos al bot de WhatsApp desde el campo.',
    icono: Mail,
  },
  {
    numero: '2',
    titulo: 'La IA audita y categoriza al instante',
    descripcion: 'El sistema valida la clave ante Hacienda, audita que te apliquen el IVA del 1% en insumos y clasifica los gastos automáticamente.',
    icono: Sparkles,
  },
  {
    numero: '3',
    titulo: 'Declaraciones y costos con 1 clic',
    descripcion: 'Genera tus formularios D-135-1, D-101 y D-150 con cifras exactas y consulta tu costo por kilo sin depender de hojas de cálculo complejas.',
    icono: FileCheck2,
  },
];

const TESTIMONIOS = [
  {
    nombre: 'Don Minor Quesada',
    rol: 'Ganadero de Doble Propósito',
    lugar: 'San Carlos, Alajuela',
    foto: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
    iniciales: 'MQ',
    rating: 5,
    texto: 'Antes pasaba los domingos cuadrando facturas arrugadas y tiquetes de la cooperativa. Ahora le paso el correo a la veterinaria y ContadorGanadero me tiene el IVA cuatrimestral y el costo por kilo al día.',
    resultado: 'Ahorro de ~18 hrs/mes',
  },
  {
    nombre: 'Doña Xinia Alvarado',
    rol: 'Productora Avícola y Hortalizas',
    lugar: 'Pérez Zeledón, San José',
    foto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    iniciales: 'XA',
    rating: 5,
    texto: 'Descubrí que un almacén me estaba cobrando el concentrado al 13% de IVA en vez del 1% del REA. Solo en esa auditoría automática me ahorré más de ₡90,000 el primer cuatrimestre.',
    resultado: 'Recuperó ₡90,000 en IVA',
  },
  {
    nombre: 'Ing. Roberto Brenes',
    rol: 'Acuicultura y Ganadería Bovina',
    lugar: 'Cañas, Guanacaste',
    foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    iniciales: 'RB',
    rating: 5,
    texto: 'El cálculo del costo por kilo de tilapia y la conciliación anual D-150 de Hacienda son precisos. Mi contador externo me felicitó porque todo le llega estructurado en segundos.',
    resultado: 'Cero multas en Hacienda',
  },
];

const COMPARATIVA = [
  { tarea: 'Recepción de facturas de proveedores', manual: 'Manual (descargar una a una de correos personales)', app: 'Buzón automático Cloudflare y WhatsApp desde el potrero' },
  { tarea: 'Auditoría del IVA 1% agropecuario', manual: 'Riesgo de pagar 13% en vez de 1% (pérdida de dinero)', app: 'Alerta inmediata de tarifas incorrectas del MAG' },
  { tarea: 'Clasificación de insumos y Cabys', manual: 'A mano en libretas o Excel que nadie actualiza', app: 'Categorización automática con Inteligencia Artificial' },
  { tarea: 'Declaración IVA Cuatrimestral (D-135-1)', manual: 'Cálculo de última hora con riesgo de sanción', app: 'Borrador con casillas oficiales listo para presentar' },
  { tarea: 'Renta Anual REA (D-101)', manual: 'Contador costoso o cálculos imprecisos', app: 'Tramos progresivos y deducciones legales aplicadas' },
  { tarea: 'Costo real de producción', manual: 'Estimaciones "a ojo" que ocultan pérdidas', app: 'Costo exacto por kg de carne, cartón de huevos o pez' },
  { tarea: 'Facturación Electrónica v4.4', manual: 'Sistemas genéricos complejos que cobran por factura', app: 'Especializada para el agro, con Notas de Crédito directas' },
];

const FAQ = [
  {
    pregunta: '¿Necesito estar inscrito en Hacienda para usar ContadorGanadero?',
    respuesta:
      'Para emitir facturas electrónicas oficiales necesitas estar inscrito como contribuyente (usualmente en el Régimen Especial Agropecuario REA del MAG/Hacienda). Sin embargo, para llevar tu control de gastos, inventario ganadero, costo por kilo y recepción de facturas puedes empezar desde hoy mismo con el Plan Gratis.',
  },
  {
    pregunta: '¿Cómo funciona la recepción automática de facturas?',
    respuesta:
      'Al crear tu cuenta, tu finca recibe un correo exclusivo (ej: tu-finca@contadorganadero.com) con tecnología Cloudflare y un número de bot de WhatsApp. Pides a tus proveedores que envíen sus XMLs ahí o los reenvías por WhatsApp. La plataforma valida la clave de Hacienda, extrae los montos y clasifica todo con IA en segundos.',
  },
  {
    pregunta: '¿Cómo me ayuda la plataforma a ahorrar en el IVA del 1% del REA?',
    respuesta:
      'Por ley en Costa Rica, los insumos agropecuarios esenciales (alimentos balanceados, medicinas veterinarias, fertilizantes, semillas) tienen tarifa reducida del 1% o 2%. Muchos comercios cometen el error de facturar al 13%. ContadorGanadero audita automáticamente cada línea y te alerta para que no pagues impuestos de más.',
  },
  {
    pregunta: '¿Cuáles impuestos y declaraciones de Hacienda calcula?',
    respuesta:
      'Calcula el IVA cuatrimestral del Régimen Agropecuario (formulario D-135-1), la Renta Anual (D-101) con los tramos progresivos actualizados y la Conciliación Anual de Insumos (D-150 / TRIBU-CR), además de incluir el calendario con las fechas límites de pago.',
  },
  {
    pregunta: '¿Puedo llevar el control de mis animales y cosechas?',
    respuesta:
      'Sí. Cuenta con módulos para 4 especies: bovinos (carne y leche), aves de postura (huevos), acuicultura (tilapias/truchas) y apicultura (miel). Registra pesajes, mortandades, tratamientos sanitarios y calcula tu costo de producción por kilo o unidad.',
  },
  {
    pregunta: '¿Es realmente gratis? ¿Piden tarjeta de crédito para empezar?',
    respuesta:
      'No pedimos tarjeta de crédito para el Plan Gratis. Puedes usar la plataforma sin costo (sostenido con anuncios no invasivos de Google). Si luego deseas funciones avanzadas como visión artificial VLM, módulo D-150 y trabajar sin publicidad, puedes pasar al plan Pro por solo $10 al mes.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.pregunta,
    acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
  })),
};

const NEGOCIO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'ContadorGanadero',
  url: 'https://contadorganandero.com',
  image: 'https://contadorganandero.com/favicon.svg',
  description:
    'Contabilidad, inventario y facturación electrónica para productores agropecuarios de Costa Rica bajo el Régimen Especial Agropecuario (REA).',
  areaServed: { '@type': 'Country', name: 'Costa Rica' },
  priceRange: '$$',
  knowsAbout: [
    'Facturación electrónica Costa Rica v4.4',
    'Régimen Especial Agropecuario REA',
    'Declaración IVA D-135-1',
    'Declaración de renta D-101',
    'Conciliación D-150 TRIBU-CR',
  ],
};

export default function LandingPage() {
  const navigate = useNavigate();

  // ===== SEO =====
  useSeo({
    title: 'ContadorGanadero | Contabilidad y Facturación Electrónica REA Costa Rica',
    description:
      'Plataforma oficial para productores agropecuarios en Costa Rica: recibe facturas por correo y WhatsApp, audita el IVA 1% del REA y genera tus declaraciones D-135-1 y D-101 de Hacienda.',
    path: '/',
    jsonLd: [NEGOCIO_SCHEMA, FAQ_SCHEMA],
  });

  // Calculadora interactiva de ahorro para el productor
  const [facturasAlMes, setFacturasAlMes] = useState(40);
  const calculoAhorro = useMemo(() => {
    // Estimación basada en promedio de compras agropecuarias en CR:
    // ~15 min por factura manual + 4 hrs por declaración
    const horasAhorradas = Math.round((facturasAlMes * 0.25) + 4);
    // Estimación conservadora de fugas de IVA (facturas al 13% en vez de 1% no detectadas): ~3-5% del gasto
    const fugaIvaEstimada = Math.round(facturasAlMes * 2800);
    // Multa Hacienda por no presentar a tiempo (medio salario base aprox ₡231,100)
    const multaEvitada = 231100;
    return {
      horas: horasAhorradas,
      ahorroDinero: fugaIvaEstimada.toLocaleString('es-CR'),
      multa: multaEvitada.toLocaleString('es-CR'),
    };
  }, [facturasAlMes]);

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
      /* usuario canceló */
    }
  };

  // FAQ acordeón
  const [faqAbierta, setFaqAbierta] = useState(0);

  // Reveal animations
  const [heroRef, heroVisible] = useReveal({ rootMargin: '0px 0px -20% 0px' });
  const [trustRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [calculatorRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [tabsRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [featuresRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [stepsRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [testimonialsRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [comparativaRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [pricingRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [faqRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [ctaRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });
  const [footerRef] = useReveal({ rootMargin: '0px 0px -10% 0px' });

  return (
    <div className="landing font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Barra de anuncio superior para Google Ads Quality Score */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-b border-emerald-500/20 py-2 px-4 text-center text-xs text-slate-300 flex items-center justify-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-emerald-300">Costa Rica 🇨🇷:</span>
        <span>Alineado con Facturación Electrónica Hacienda v4.4 & Régimen Especial Agropecuario (REA).</span>
        <span className="hidden md:inline text-slate-400">• Plan Gratis Disponible Sin Tarjeta</span>
      </div>

      {/* Navbar con shadcn UI tokens */}
      <header className={`landing-nav ${heroVisible ? 'landing-nav--scrolled' : ''}`}>
        <div className="landing-nav-brand">
          <div className="landing-nav-logo">
            <Tractor size={24} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="landing-nav-title font-heading font-black text-lg text-white tracking-tight leading-none">
              Contador<span className="text-emerald-400">Ganadero</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Costa Rica REA</span>
          </div>
        </div>

        <nav className="landing-nav-links" aria-label="Navegación principal">
          <a href="#como-funciona" className="hover:text-emerald-400 transition-colors">Cómo funciona</a>
          <a href="#calculadora" className="hover:text-emerald-400 transition-colors">Calculadora</a>
          <a href="#demostracion" className="hover:text-emerald-400 transition-colors">Demostración</a>
          <a href="#testimonios" className="hover:text-emerald-400 transition-colors">Testimonios</a>
          <a href="#planes" className="hover:text-emerald-400 transition-colors">Planes</a>
          <a href="#faq" className="hover:text-emerald-400 transition-colors">Preguntas</a>
        </nav>

        <div className="landing-nav-actions flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex text-slate-300 hover:text-white"
            onClick={handleCompartir}
            title="Compartir enlace"
          >
            <Share2 size={16} className="mr-1" /> {copiado ? '¡Copiado!' : ''}
          </Button>

          <Button asChild variant="outline" size="sm" className="landing-nav-login border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
            <Link to="/login">Iniciar Sesión</Link>
          </Button>

          <Button
            variant="gradient"
            size="sm"
            className="landing-nav-cta shadow-md shadow-emerald-950/50"
            onClick={() => handleCtaPrincipal('nav_cta')}
            data-conversion="nav_signup"
          >
            Comenzar Gratis <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      </header>

      {/* HERO SECTION — Split Layout con Mockup de SaaS en vivo */}
      <section ref={heroRef} className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
        {/* Glow de fondo decorativo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-emerald-600/10 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Columna Izquierda: Mensaje de Valor de Alto Rendimiento para Google Ads */}
            <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6">
              
              <div className="inline-flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3.5 py-1 text-xs gap-1.5 backdrop-blur-md shadow-sm">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  Régimen Especial Agropecuario (REA) • Hacienda v4.4
                </Badge>
                <Badge variant="secondary" className="hidden sm:inline-flex bg-slate-800 text-slate-300 text-xs">
                  Costa Rica 🇨🇷
                </Badge>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-heading text-white tracking-tight leading-[1.12]">
                Tu contador personal inteligente para la finca <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
                  sin hojas de cálculo
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                ContadorGanadero automatiza tus compras, audita que no te cobren el 13% de IVA en insumos y genera tus declaraciones <strong>D-135-1, D-101 y D-150</strong> al instante recibiendo facturas por correo y WhatsApp.
              </p>

              {/* Puntos de valor con icono check */}
              <ul className="space-y-2.5 text-sm sm:text-base text-slate-200">
                <li className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check size={14} />
                  </div>
                  <span><strong>Auditoría de IVA al 1%:</strong> detecta de inmediato errores en agroservicios y veterinarias.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check size={14} />
                  </div>
                  <span><strong>Recepción por WhatsApp:</strong> reenvía PDFs, fotos de tiquetes o XMLs desde el potrero.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check size={14} />
                  </div>
                  <span><strong>Costos reales por kilo:</strong> margen de rentabilidad en carne, leche, huevos o peces.</span>
                </li>
              </ul>

              {/* Botones de acción (CTAs Google Ads) */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="gradient"
                  size="lg"
                  className="h-13 px-8 text-base shadow-xl shadow-emerald-950/60 font-bold group"
                  onClick={() => handleCtaPrincipal('hero_btn_comenzar')}
                  data-conversion="hero_signup"
                >
                  Comenzar Gratis Ahora
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-13 px-6 text-base border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                >
                  <a href="#demostracion">
                    Ver cómo funciona
                  </a>
                </Button>
              </div>

              {/* Micrométricas de confianza */}
              <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Check size={15} className="text-emerald-400" />
                  <span>Sin tarjeta de crédito requerida</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={15} className="text-emerald-400" />
                  <span>Configuración en 2 minutos</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="font-semibold text-slate-200 ml-1">4.9/5</span>
                  <span className="text-slate-400">por productores ticos</span>
                </div>
              </div>

            </div>

            {/* Columna Derecha: Mockup Interactivo de la Aplicación (shadcn Card) */}
            <div className="lg:col-span-5">
              <Card className="relative border-slate-700/80 bg-slate-900/90 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl overflow-hidden hover:border-emerald-500/40 transition-all duration-300">
                
                {/* Cabecera del Mockup de Software (estilo ventana SaaS) */}
                <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="text-xs text-slate-400 font-mono ml-2 truncate">ContadorGanadero v4.4 • Panel Finca</span>
                  </div>
                  <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    <Activity size={10} className="mr-1 animate-pulse" /> REA Activo
                  </Badge>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Fila superior: KPIs de Finca */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Gasto Cuatrimestre</span>
                        <Receipt size={14} className="text-emerald-400" />
                      </div>
                      <div className="text-lg font-bold font-heading text-white">₡4,820,000</div>
                      <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                        <TrendingUp size={11} /> 38 facturas procesadas
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>Auditoría IVA 1%</span>
                        <ShieldCheck size={14} className="text-amber-400" />
                      </div>
                      <div className="text-lg font-bold font-heading text-amber-300">₡184,200</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Ahorro evitado en cobro 13%
                      </div>
                    </div>
                  </div>

                  {/* Facturas entrantes en vivo (Simulación de Feed) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
                      <span>Últimas facturas procesadas con IA</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Zap size={11} /> Tiempo real
                      </span>
                    </div>

                    {/* Factura 1 */}
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <Receipt size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">CoopeAgri R.L. (Pérez Zeledón)</div>
                          <div className="text-[11px] text-slate-400 truncate">Alimento Vacuno Engorde • ₡24,500</div>
                        </div>
                      </div>
                      <Badge variant="default" className="text-[10px] shrink-0 bg-emerald-500/20 text-emerald-300">
                        IVA 1% OK ✓
                      </Badge>
                    </div>

                    {/* Factura 2 */}
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                          <MessageSquare size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">Veterinaria El Colono (San Carlos)</div>
                          <div className="text-[11px] text-slate-400 truncate">Vía WhatsApp • Vacuna Bovisan 50 dosis</div>
                        </div>
                      </div>
                      <Badge variant="blue" className="text-[10px] shrink-0 bg-sky-500/20 text-sky-300">
                        IVA 2% Mag ✓
                      </Badge>
                    </div>
                  </div>

                  {/* Estado de Declaración Hacienda */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Calculator size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Declaración D-135-1 (IVA Cuatrimestral)</div>
                        <div className="text-[11px] text-emerald-400/90">Crédito fiscal REA calculado: ₡48,200</div>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-emerald-500 text-slate-950 font-bold text-[10px]">
                      Lista para presentar
                    </Badge>
                  </div>

                  {/* Footer del mockup */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Lock size={12} className="text-emerald-400" /> Cifrado 256-bit seguro
                    </span>
                    <span className="text-slate-300 font-medium">Buzón Cloudflare Activo</span>
                  </div>

                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </section>

      {/* BARRA DE CONFIANZA Y COMPATIBILIDAD OFICIAL (CRITICAL FOR GOOGLE ADS QUALITY SCORE) */}
      <section ref={trustRef} className="py-8 bg-slate-950/80 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">
            Alineado con las normativas tributarias y estándares tecnológicos oficiales de Costa Rica
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 items-center justify-center text-center">
            
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center gap-1.5 hover:border-emerald-500/30 transition-all">
              <Building2 size={22} className="text-emerald-400" />
              <span className="font-heading font-bold text-xs text-white">Hacienda Costa Rica</span>
              <span className="text-[10px] text-slate-400">Facturación v4.4 & Acuses</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center gap-1.5 hover:border-emerald-500/30 transition-all">
              <Tractor size={22} className="text-emerald-400" />
              <span className="font-heading font-bold text-xs text-white">MAG / REA</span>
              <span className="text-[10px] text-slate-400">Canasta Insumos 1% & 2%</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center gap-1.5 hover:border-emerald-500/30 transition-all">
              <ShieldCheck size={22} className="text-emerald-400" />
              <span className="font-heading font-bold text-xs text-white">Cloudflare Ingestion</span>
              <span className="text-[10px] text-slate-400">Enrutamiento anti-spam</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center gap-1.5 hover:border-emerald-500/30 transition-all">
              <Sparkles size={22} className="text-amber-400" />
              <span className="font-heading font-bold text-xs text-white">Gemini & NVIDIA</span>
              <span className="text-[10px] text-slate-400">Clasificación IA Cabys</span>
            </div>

            <div className="col-span-2 md:col-span-1 p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center gap-1.5 hover:border-emerald-500/30 transition-all">
              <Lock size={22} className="text-emerald-400" />
              <span className="font-heading font-bold text-xs text-white">Seguridad Criptográfica</span>
              <span className="text-[10px] text-slate-400">Llaves .p12 protegidas</span>
            </div>

          </div>
        </div>
      </section>

      {/* CALCULADORA INTERACTIVA DE AHORRO PARA EL PRODUCTOR */}
      <section ref={calculatorRef} id="calculadora" className="py-16 md:py-24 max-w-5xl mx-auto px-4 sm:px-6">
        <Card className="border-emerald-500/30 bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950 shadow-2xl p-6 sm:p-10">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs px-3 py-1 mb-3">
              <Calculator size={13} className="mr-1 inline text-amber-400" /> Calculadora de Ahorro Real
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black font-heading text-white">
              ¿Cuánto tiempo y dinero pierde tu finca en papeleo?
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Mueve el selector según la cantidad de facturas o tiquetes que recibes al mes y calcula tu ahorro con ContadorGanadero.
            </p>
          </div>

          {/* Selector de facturas */}
          <div className="max-w-xl mx-auto mb-10 space-y-4">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-300">
              <span>Facturas o compras al mes:</span>
              <span className="text-xl font-bold font-heading text-emerald-400">{facturasAlMes} facturas</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={facturasAlMes}
              onChange={(e) => setFacturasAlMes(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>10 (Finca pequeña)</span>
              <span>50 (Promedio REA)</span>
              <span>100+ (Cooperativa / Intensivo)</span>
            </div>
          </div>

          {/* Resultados de la Calculadora con shadcn Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            
            <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3">
                <Clock size={20} />
              </div>
              <div className="text-2xl font-black font-heading text-white">~{calculoAhorro.horas} horas</div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mt-1">Ahorradas al mes</span>
              <p className="text-xs text-slate-400 mt-2">
                Menos noches digitando en hojas de cálculo y buscando papeles perdidos.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center mb-3">
                <DollarSign size={20} />
              </div>
              <div className="text-2xl font-black font-heading text-amber-300">₡{calculoAhorro.ahorroDinero}</div>
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide mt-1">Ahorro anual en IVA</span>
              <p className="text-xs text-slate-400 mt-2">
                Recupera dinero al evitar cobros indebidos del 13% en fertilizantes y vacunas.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center mb-3">
                <AlertTriangle size={20} />
              </div>
              <div className="text-2xl font-black font-heading text-white">₡{calculoAhorro.multa}</div>
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wide mt-1">Multa Hacienda evitada</span>
              <p className="text-xs text-slate-400 mt-2">
                Medio salario base por declaraciones tardías del D-135-1 o D-101.
              </p>
            </div>

          </div>

          <div className="text-center pt-2">
            <Button
              variant="gradient"
              size="lg"
              className="h-12 px-8 text-base shadow-xl shadow-emerald-950/40"
              onClick={() => handleCtaPrincipal('calculadora_cta')}
              data-conversion="calc_signup"
            >
              Quiero empezar a ahorrar hoy gratis <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </Card>
      </section>

      {/* DEMOSTRACIÓN INTERACTIVA POR PESTAÑAS (shadcn Tabs) */}
      <section ref={tabsRef} id="demostracion" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1 mb-3">
            <Sparkles size={13} className="mr-1 inline text-emerald-400" /> Diseñado para el Agro Tico
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            Así resuelve cada problema de tu finca
          </h2>
          <p className="text-slate-400 text-base mt-2">
            Explora las herramientas que transforman la gestión de compras, impuestos e inventario.
          </p>
        </div>

        <Tabs defaultValue="hacienda" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 max-w-3xl w-full h-auto p-1.5 bg-slate-900 border border-slate-800 rounded-xl">
              <TabsTrigger value="hacienda" className="py-2.5 text-xs sm:text-sm">
                <Calculator size={15} className="mr-1.5" /> Impuestos REA
              </TabsTrigger>
              <TabsTrigger value="auditoria" className="py-2.5 text-xs sm:text-sm">
                <ShieldCheck size={15} className="mr-1.5" /> Auditoría IVA 1%
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="py-2.5 text-xs sm:text-sm">
                <MessageSquare size={15} className="mr-1.5" /> Correo & WhatsApp
              </TabsTrigger>
              <TabsTrigger value="inventario" className="py-2.5 text-xs sm:text-sm">
                <Warehouse size={15} className="mr-1.5" /> Inventario y Costos
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Contenido Tab 1: Impuestos REA */}
          <TabsContent value="hacienda">
            <Card className="border-slate-800 bg-slate-900/80 p-6 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <Badge variant="default" className="text-xs">D-135-1 • D-101 • D-150</Badge>
                  <h3 className="text-2xl font-bold font-heading text-white">
                    Declaraciones listas para el Ministerio de Hacienda
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Olvídate de sumar facturas la noche anterior al vencimiento. ContadorGanadero agrupa tus compras cuatrimestrales, separa el crédito fiscal del 1% y 2% y genera los borradores con las casillas exactas para el portal de Hacienda.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Cálculo automático de IVA Cuatrimestral (D-135-1).
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Declaración de Renta Anual (D-101) con tramos progresivos.
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Calendario fiscal con alertas de vencimientos de pago.
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Button variant="gradient" size="sm" onClick={() => handleCtaPrincipal('tab_impuestos')}>
                      Probar con mis facturas <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold text-white uppercase">Resumen D-135-1 (Cuatrimestre 1)</span>
                    <Badge variant="default" className="text-[10px]">Cuadrado 100%</Badge>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Base imponible compras insumos 1%:</span>
                      <span className="font-mono font-bold text-white">₡5,420,000</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Crédito fiscal soportado (1% REA):</span>
                      <span className="font-mono font-bold text-emerald-400">₡54,200</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Ventas declaradas (Canasta Básica):</span>
                      <span className="font-mono font-bold text-white">₡7,150,000</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Débito fiscal generado:</span>
                      <span className="font-mono font-bold text-white">₡71,500</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex justify-between font-bold text-emerald-300 text-sm">
                      <span>Saldo a pagar / crédito a favor:</span>
                      <span>₡17,300</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Contenido Tab 2: Auditoría IVA 1% */}
          <TabsContent value="auditoria">
            <Card className="border-slate-800 bg-slate-900/80 p-6 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <Badge variant="amber" className="text-xs">Auditoría en Tiempo Real</Badge>
                  <h3 className="text-2xl font-bold font-heading text-white">
                    Protege tu bolsillo de cobros erróneos al 13%
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Muchos agroservicios, ferreterías y cooperativas facturan por error al 13% insumos que están exentos o reducidos al 1% según el Decreto del MAG. Nuestro motor de IA audita cada línea y te avisa al instante para pedir la Nota de Crédito.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Validación cruzada contra la canasta oficial de insumos REA.
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Emisión directa de Notas de Crédito para anular facturas.
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Button variant="gradient" size="sm" onClick={() => handleCtaPrincipal('tab_auditoria')}>
                      Activar auditoría gratis <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-slate-950 border border-amber-500/30 space-y-4">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase">
                    <AlertTriangle size={16} /> Alerta de Tarifa Detectada
                  </div>
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs space-y-1">
                    <div className="font-semibold text-white">Ferretería Rural S.A. • Factura #0010000100000439</div>
                    <div className="text-red-300">Línea 2: Fertilizante Triple 15 (50kg) cobrado al 13% (₡4,550 IVA)</div>
                    <div className="text-slate-400">Tarifa legal según lista MAG: 1% (₡350 IVA). Sobreprecio: ₡4,200.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
                    <span>Acción sugerida: Solicitar Nota de Crédito</span>
                    <Badge variant="default" className="text-[10px]">Plantilla lista</Badge>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Contenido Tab 3: WhatsApp y Correo */}
          <TabsContent value="whatsapp">
            <Card className="border-slate-800 bg-slate-900/80 p-6 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <Badge variant="blue" className="text-xs">Movilidad Total</Badge>
                  <h3 className="text-2xl font-bold font-heading text-white">
                    Facturas procesadas desde el potrero por WhatsApp
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    No necesitas sentarte frente a una computadora. Reenvía el archivo XML o toma una foto del comprobante y mándala a nuestro bot de WhatsApp. La inteligencia artificial extrae emisor, montos e insumos al instante.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Correo exclusivo @contadorganadero.com respaldado por Cloudflare.
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Cero configuración de contraseñas de correo ni servidores IMAP.
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Button variant="gradient" size="sm" onClick={() => handleCtaPrincipal('tab_whatsapp')}>
                      Empezar con WhatsApp <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-sans">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-800">
                    <MessageSquare size={14} className="text-emerald-400" /> Chat de WhatsApp • ContadorGanadero Bot
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 text-xs text-slate-200 max-w-[85%] ml-auto space-y-1">
                    <span className="text-[10px] text-slate-400 block">Tú (11:42 AM)</span>
                    <span>📎 Factura_Electronica_Veterinaria_001.xml</span>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200 max-w-[90%] space-y-1.5">
                    <span className="text-[10px] text-emerald-400 font-bold block">Bot ContadorGanadero (11:42 AM)</span>
                    <p>✅ <strong>Factura procesada con éxito:</strong></p>
                    <p>• Emisor: Almacén Ganadero San Carlos<br />• Insumo: Vacuna Antrax (50 dosis)<br />• Monto: ₡28,000 + ₡280 IVA (1% REA)<br />• Estado Hacienda: Aceptada</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Contenido Tab 4: Inventario y Costos */}
          <TabsContent value="inventario">
            <Card className="border-slate-800 bg-slate-900/80 p-6 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <Badge variant="purple" className="text-xs">Multiespecie</Badge>
                  <h3 className="text-2xl font-bold font-heading text-white">
                    Conoce tu costo real por kilo de carne o huevo
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Saber si ganas o pierdes no puede ser una suposición. Registra pesajes de ganado, lotes de aves de postura, estanques de tilapias y colmenas. ContadorGanadero cruza tus compras de concentrado y forraje para darte el costo real por kilo producido.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Soporte nativo para 4 especies agropecuarias.
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400" /> Registro de ganancia diaria de peso (GDP) y conversión alimenticia.
                    </li>
                  </ul>
                  <div className="pt-2">
                    <Button variant="gradient" size="sm" onClick={() => handleCtaPrincipal('tab_inventario')}>
                      Gestionar mi ganado <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800 pb-2">
                    <span>Lote #4 - Novillos Engorde (32 animales)</span>
                    <Badge variant="default" className="text-[10px]">San Carlos</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Peso promedio:</span>
                      <span className="text-white font-bold text-sm">435 kg</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Ganancia Diaria:</span>
                      <span className="text-emerald-400 font-bold text-sm">+850 g/día</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between items-center">
                    <span className="text-slate-300">Costo acumulado por kg:</span>
                    <span className="text-white font-mono font-bold text-sm">₡1,120 / kg</span>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs flex justify-between items-center text-emerald-300 font-semibold">
                    <span>Precio estimado subasta: ₡1,650 / kg</span>
                    <span>Margen: +32%</span>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* CARACTERÍSTICAS COMPLETAS DE LA PLATAFORMA (GRID SHADCN) */}
      <section ref={featuresRef} id="caracteristicas" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-850">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1 mb-3">
            Plataforma Integral
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            Todo lo que tu finca necesita en un solo lugar
          </h2>
          <p className="text-slate-400 text-base mt-2">
            Diseñado para cumplir con el Ministerio de Hacienda y el MAG sin complicaciones técnicas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CARACTERISTICAS.map(({ icono: IconoCaract, titulo, descripcion, tag }) => (
            <Card key={titulo} className="border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between hover:border-emerald-500/40 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <IconoCaract size={22} />
                  </div>
                  {tag && (
                    <Badge variant="secondary" className="text-[10px] bg-slate-800 text-emerald-300 border border-slate-700">
                      {tag}
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-bold font-heading text-white mb-2">{titulo}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{descripcion}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA EN 3 PASOS */}
      <section ref={stepsRef} id="como-funciona" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1 mb-3">
            Simple & Rápido
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            ¿Cómo funciona en el día a día?
          </h2>
          <p className="text-slate-400 text-base mt-2">
            Tres pasos sencillos para que tu contabilidad trabaje sola en la finca.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PASOS.map(({ numero, titulo, descripcion, icono: IconoPaso }) => (
            <Card key={numero} className="border-slate-800 bg-slate-900/70 p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center font-heading font-black text-xl shadow-lg shadow-emerald-950/40">
                  {numero}
                </div>
                <IconoPaso size={24} className="text-emerald-400/70 group-hover:scale-110 group-hover:text-emerald-300 transition-all" />
              </div>
              <h3 className="text-xl font-bold font-heading text-white mb-2">{titulo}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{descripcion}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* PRUEBA SOCIAL / TESTIMONIOS TICOS (CRITICAL FOR GOOGLE ADS CONVERSION) */}
      <section ref={testimonialsRef} id="testimonios" className="py-16 md:py-24 bg-slate-950/60 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs px-3 py-1 mb-3">
              <Star size={13} className="mr-1 inline text-amber-400" /> Productores que ya no sufren con Hacienda
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
              Lo que dicen los ganaderos y agricultores en Costa Rica
            </h2>
            <p className="text-slate-400 text-base mt-2">
              Productores de San Carlos, Pérez Zeledón y Guanacaste cuentan su experiencia real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIOS.map((t, idx) => (
              <Card key={idx} className="border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
                <CardContent className="p-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex">
                      {[...Array(t.rating)].map((_, i) => (
                        <Star key={i} size={15} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <Badge variant="default" className="text-[10px] bg-emerald-500/20 text-emerald-300">
                      {t.resultado}
                    </Badge>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed italic">
                    "{t.texto}"
                  </p>
                </CardContent>

                <CardFooter className="p-0 pt-6 mt-6 border-t border-slate-800 flex items-center gap-3">
                  <Avatar className="h-11 w-11 border border-slate-700">
                    <AvatarImage src={t.foto} alt={t.nombre} />
                    <AvatarFallback>{t.iniciales}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-bold font-heading text-white text-sm">{t.nombre}</div>
                    <div className="text-xs text-slate-400">{t.rol} • <span className="text-emerald-400">{t.lugar}</span></div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARATIVA DETALLADA */}
      <section ref={comparativaRef} id="comparativa" className="py-16 md:py-24 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs px-3 py-1 mb-3">
            Comparativa
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            Contabilidad tradicional vs. ContadorGanadero
          </h2>
          <p className="text-slate-400 text-base mt-2">
            La diferencia entre perder fines de semana en Excel o tener tu finca automatizada.
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-heading uppercase text-slate-400">
                <tr>
                  <th className="py-4 px-6">Tarea o Proceso</th>
                  <th className="py-4 px-6 text-slate-400">Forma Tradicional</th>
                  <th className="py-4 px-6 text-emerald-400 font-bold">Con ContadorGanadero</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {COMPARATIVA.map((fila, i) => (
                  <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-white">{fila.tarea}</td>
                    <td className="py-3.5 px-6 text-slate-400">{fila.manual}</td>
                    <td className="py-3.5 px-6 text-emerald-300 font-medium flex items-center gap-2">
                      <Check size={16} className="text-emerald-400 shrink-0" />
                      <span>{fila.app}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* PLANES Y PRECIOS TRANSPARENTES */}
      <section ref={pricingRef} id="planes" className="py-16 md:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1 mb-3">
            Planes Transparentes
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            Precios justos pensados para el productor
          </h2>
          <p className="text-slate-400 text-base mt-2">
            Comienza gratis con todas las herramientas esenciales de contabilidad e inventario, o activa Pro para trabajar sin anuncios y con visión artificial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
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

        <div className="mt-8 text-center text-xs text-slate-400 max-w-xl mx-auto space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-slate-300">
            <Check size={14} className="text-emerald-400" /> No se requiere tarjeta de crédito para el Plan Gratis.
          </p>
          <p>Puedes cancelar o actualizar tu plan en cualquier momento desde tu panel de usuario.</p>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES (FAQ ACORDEÓN) */}
      <section ref={faqRef} id="faq" className="py-16 md:py-24 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs px-3 py-1 mb-3">
            <HelpCircle size={13} className="mr-1 inline text-slate-400" /> Dudas Comunes
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            Preguntas Frecuentes
          </h2>
          <p className="text-slate-400 text-base mt-2">
            Todo lo que necesitas saber antes de empezar a usar ContadorGanadero.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ.map((item, i) => {
            const abierta = faqAbierta === i;
            return (
              <div
                key={item.pregunta}
                className={`rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden transition-all duration-200 ${
                  abierta ? 'border-emerald-500/40 shadow-lg' : 'hover:border-slate-700'
                }`}
              >
                <button
                  className="w-full flex items-center justify-between p-5 text-left"
                  onClick={() => setFaqAbierta(abierta ? -1 : i)}
                  aria-expanded={abierta}
                >
                  <h3 className="font-semibold text-base text-white pr-4">{item.pregunta}</h3>
                  <ChevronDown
                    size={20}
                    className={`transition-transform duration-200 text-slate-400 shrink-0 ${
                      abierta ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>
                {abierta && (
                  <div className="px-5 pb-5 text-slate-300 text-sm leading-relaxed border-t border-slate-800/60 pt-3">
                    {item.respuesta}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA FINAL DE ALTA CONVERSIÓN */}
      <section ref={ctaRef} id="comenzar" className="py-16 md:py-20 max-w-5xl mx-auto px-4 sm:px-6">
        <Card className="p-8 sm:p-12 text-center border-emerald-500/50 bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <Badge variant="default" className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
              Prueba 100% Gratuita • Sin Compromiso
            </Badge>

            <h2 className="text-3xl sm:text-4xl font-black font-heading text-white tracking-tight">
              Empieza hoy mismo a controlar tu finca con tranquilidad
            </h2>

            <p className="text-slate-300 text-base">
              Crea tu cuenta en menos de 2 minutos y ten tu contabilidad agropecuaria, auditoría del 1% de IVA e inventario al día.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="gradient"
                size="lg"
                className="h-13 px-8 text-base shadow-xl font-bold w-full sm:w-auto"
                onClick={() => handleCtaPrincipal('cta_final')}
                data-conversion="bottom_signup"
              >
                Crear cuenta gratis ahora <ArrowRight size={18} className="ml-2" />
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-13 px-6 text-base border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 w-full sm:w-auto"
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

            <div className="pt-2 text-xs text-slate-400">
              Compatible con el Régimen Especial Agropecuario (REA) de Costa Rica.
            </div>
          </div>
        </Card>
      </section>

      {/* Espacio publicitario Google AdSense (solo visible si AdSense está configurado) */}
      <div className="max-w-4xl mx-auto px-4 my-8">
        <AdvertisingSlot mostrarPublico={true} tamaño="banner" />
      </div>

      {/* FOOTER */}
      <footer ref={footerRef} className="border-t border-slate-800 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Tractor size={20} />
            </div>
            <div>
              <div className="font-heading font-black text-white text-base">ContadorGanadero</div>
              <div className="text-xs text-slate-400">Cumplimiento tributario con Hacienda y MAG — Costa Rica</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <Link to="/login" className="hover:text-emerald-400 transition-colors">Iniciar Sesión</Link>
            <a href="#como-funciona" className="hover:text-emerald-400 transition-colors">Cómo funciona</a>
            <a href="#planes" className="hover:text-emerald-400 transition-colors">Planes</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">Preguntas</a>
            <Link to="/terminos" className="hover:text-emerald-400 transition-colors">Términos y Condiciones</Link>
            <Link to="/condiciones-servicio" className="hover:text-emerald-400 transition-colors">Condiciones del Servicio</Link>
            <Link to="/privacidad" className="hover:text-emerald-400 transition-colors">Política de Privacidad</Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-900 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ContadorGanadero Costa Rica. Todos los derechos reservados. No afiliado directamente con el Ministerio de Hacienda ni el MAG.
        </div>
      </footer>

      {/* BOTÓN FLOTANTE DE WHATSAPP PARA CONVERSIÓN PRE-VENTA (GOOGLE ADS) */}
      <a
        href={`https://wa.me/${WHATSAPP_CONTACT_NUMBER}?text=${WHATSAPP_DEFAULT_MSG}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-500 text-slate-950 font-bold text-sm shadow-2xl shadow-emerald-500/40 hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all group"
        aria-label="Hablar con un asesor por WhatsApp"
      >
        <MessageSquare size={18} className="text-slate-950" />
        <span className="hidden sm:inline">¿Dudas? Hablar por WhatsApp</span>
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-900" />
        </span>
      </a>

      {/* CTA FIJO EN MÓVIL */}
      <div className="landing-cta-movil md:hidden">
        <Button
          variant="gradient"
          size="lg"
          className="w-full font-bold shadow-xl"
          onClick={() => handleCtaPrincipal('mobile_sticky_cta')}
          data-conversion="sticky_signup"
        >
          Comenzar Gratis (Sin Tarjeta) <ArrowRight size={16} className="ml-1" />
        </Button>
      </div>

    </div>
  );
}