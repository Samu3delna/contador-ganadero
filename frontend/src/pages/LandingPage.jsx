import { Link, useNavigate } from 'react-router-dom';
import {
  Tractor, Mail, Sparkles, FileCheck, LayoutDashboard, Warehouse,
  Receipt, TrendingUp, Calendar, Calculator, ArrowRight, Check
} from 'lucide-react';
import { PLANES } from '../data/planes';
import PlanCard from '../components/billing/PlanCard';
import fondoLogin from '../Recursos/fondo_login.webm';
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

export default function LandingPage() {
  const navigate = useNavigate();

  const handleSeleccionarPlan = () => {
    navigate('/login');
  };

  return (
    <div className="landing">
      {/* Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <div className="landing-nav-logo">
            <Tractor size={26} />
          </div>
          <span className="landing-nav-title">ContadorGanadero</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-outline">Iniciar Sesión</Link>
          <Link to="/login" className="btn btn-primary">Comenzar Gratis</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <video className="landing-hero-video" autoPlay muted loop playsInline>
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
            <Link to="/login" className="btn btn-outline btn-lg">
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="landing-seccion" id="caracteristicas">
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo">Todo lo que tu finca necesita</h2>
          <p className="landing-seccion-subtitulo">
            Una plataforma completa diseñada para el productor agropecuario costarricense.
          </p>
        </div>
        <div className="landing-caracteristicas-grid">
          {CARACTERISTICAS.map(({ icono: Icono, titulo, descripcion }) => (
            <div key={titulo} className="landing-caracteristica glass-card">
              <div className="landing-caracteristica-icono">
                <Icono size={22} />
              </div>
              <h3 className="landing-caracteristica-titulo">{titulo}</h3>
              <p className="landing-caracteristica-desc">{descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="landing-seccion" id="como-funciona">
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo">¿Cómo funciona?</h2>
          <p className="landing-seccion-subtitulo">
            En tres pasos, tu contabilidad queda bajo control.
          </p>
        </div>
        <div className="landing-pasos">
          {PASOS.map(({ numero, titulo, descripcion }) => (
            <div key={numero} className="landing-paso glass-card">
              <div className="landing-paso-numero">{numero}</div>
              <h3 className="landing-paso-titulo">{titulo}</h3>
              <p className="landing-paso-desc">{descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes y precios */}
      <section className="landing-seccion" id="planes">
        <div className="landing-seccion-head">
          <h2 className="landing-seccion-titulo">Planes y precios</h2>
          <p className="landing-seccion-subtitulo">
            Elige el plan que mejor se adapta al tamaño de tu operación.
          </p>
        </div>
        <div className="landing-planes-grid">
          {PLANES.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSeleccionar={handleSeleccionarPlan}
            />
          ))}
        </div>
        <p className="landing-planes-nota">
          <Check size={14} /> Sin tarjeta para el plan Free. Cancela cuando quieras.
        </p>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
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
          <a href="#planes">Planes</a>
        </div>
        <p className="landing-footer-copy">
          © {new Date().getFullYear()} ContadorGanadero. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
