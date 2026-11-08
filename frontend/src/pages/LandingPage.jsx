import BenefitsMarquee from '../components/public/BenefitsMarquee';
import ScrollLandscape from '../components/public/ScrollLandscape';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ReceiptText, Sprout, ChartNoAxesCombined, Play } from 'lucide-react';
import BrandLogo from '../components/public/BrandLogo';
import ProductDemo from '../components/public/ProductDemo';
import { CTASection, FAQSection, PricingCards } from '../components/public/PublicBlocks';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <>
      <ScrollLandscape />
      <BenefitsMarquee />
      <div className="cg-landing-journey">
      <section className="cg-hero cg-container cg-hero-motion">
        <div className="cg-hero-brand">
          <BrandLogo size={58} title="Logo oficial de ContadorGanadero" />
          <div>
            <p className="cg-kicker">
              <span className="cg-status-dot" /> ContadorGanadero · contadorganadero.com
            </p>
            <p className="cg-hero-brand-sub">
              Contador ganadero y plataforma de contabilidad ganadera y agropecuaria para Costa Rica (REA)
            </p>
          </div>
        </div>
        <h1>
          Tu finca, tus números{' '}
          <br />y tus decisiones.{' '}
          <br />Todo bajo control.
        </h1>
        <p className="cg-lead">
          Gestiona los ingresos, gastos, facturas XML, inventario y costos de tu actividad con{' '}
          <strong>ContadorGanadero</strong> (<strong>contadorganadero.com</strong>), tu aliado de contabilidad ganadera y agropecuaria diseñado para productores de Costa Rica.
        </p>
        <div className="cg-actions">
          <Link className="cg-button" to="/registro">
            Comenzar gratis <ArrowUpRight size={19} aria-hidden="true" />
          </Link>
          <Link className="cg-button cg-button-secondary" to="/producto/dashboard">
            <Play size={16} aria-hidden="true" />
            Ver demostración
          </Link>
        </div>
        <p className="cg-note">Conoce el producto a tu ritmo. Empieza con el plan Gratis en contadorganadero.com.</p>
        <div className="cg-hero-caption">
          <span>Del registro a la decisión</span>
          <Link to="/producto">
            Explorar el producto <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <ProductDemo />
      </section>

      <section className="cg-section cg-container">
        <div className="cg-section-heading">
          <p className="cg-kicker">Contabilidad ganadera y gestión productiva</p>
          <h2>
            Menos información dispersa.{' '}
            <br />Más contexto para decidir.
          </h2>
          <p>
            Conecta tus registros financieros y comprobantes con el día a día de tu finca desde una misma plataforma de contador ganadero digital.
          </p>
        </div>
        <div className="cg-feature-grid">
          {[
            [
              ReceiptText,
              'Tus comprobantes, organizados',
              'Consulta facturas XML v4.4 y revisa su clasificación para ordenar los gastos de tu actividad agropecuaria.',
              'facturas',
            ],
            [
              Sprout,
              'Cada actividad tiene su lugar',
              'Organiza bovinos, aves, peces y colmenas desde el inventario multiespecie de tu finca.',
              'inventario',
            ],
            [
              ChartNoAxesCombined,
              'Conoce lo que cuesta producir',
              'Consulta indicadores de costos por kilogramo, litro o cartón asociados a tus centros de producción.',
              'costos',
            ],
          ].map(([Icon, title, text, slug]) => (
            <Link className="cg-card cg-feature" key={slug} to={`/producto/${slug}`}>
              <Icon size={28} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
              <span>
                Conocer la herramienta <ArrowUpRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="cg-section cg-soft">
        <div className="cg-container cg-split">
          <div>
            <p className="cg-kicker">Cómo funciona ContadorGanadero</p>
            <h2>
              Una rutina sencilla.{' '}
              <br />Una finca más organizada.
            </h2>
            <p>No necesitas empezar con todos los módulos. Empieza por los registros que ya tienes en tu actividad.</p>
          </div>
          <ol className="cg-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Crea tu cuenta en contadorganadero.com</h3>
                <p>Accede a tu espacio de trabajo y revisa la configuración de tu finca o actividad agropecuaria.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Organiza tus registros</h3>
                <p>Registra ingresos por venta de ganado, consulta comprobantes XML y completa tu inventario.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Revisa antes de decidir</h3>
                <p>Compara ingresos y gastos, consulta estimaciones REA y comparte información ordenada con tu contador.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="cg-section cg-container">
        <div className="cg-section-heading">
          <p className="cg-kicker">Para tu forma de trabajar</p>
          <h2>
            El campo tiene muchas actividades.{' '}
            <br />La claridad es necesaria en todas.
          </h2>
        </div>
        <div className="cg-grid">
          {[
            [
              'Productores ganaderos',
              'Organiza tus bovinos, registros de ingresos por venta de ganado y gastos de la actividad en un solo lugar.',
            ],
            [
              'Actividades agropecuarias',
              'Consulta inventario y costos de producción de bovinos, aves, peces y colmenas con unidades consistentes.',
            ],
            [
              'Profesionales contables',
              'Utiliza los registros y comprobantes ordenados del productor como punto de partida para la revisión bajo el REA.',
            ],
          ].map(([title, text]) => (
            <article key={title} className="cg-card">
              <h3>{title}</h3>
              <p>{text}</p>
              <Link to="/soluciones">Explorar casos de uso</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="cg-section cg-container">
        <div className="cg-section-heading">
          <p className="cg-kicker">Planes simples</p>
          <h2>
            Comienza gratis.{' '}
            <br />Crece a tu ritmo.
          </h2>
          <p>Dos planes, una misma idea: ayudarte a entender los números de tu actividad agropecuaria.</p>
        </div>
        <PricingCards />
        <p className="cg-note">Los anuncios permanecen desactivados mientras se revisa la integración publicitaria.</p>
        <Link to="/precios">Consultar planes y condiciones</Link>
      </section>
      <FAQSection />
      <CTASection />
      </div>
    </>
  );
}
