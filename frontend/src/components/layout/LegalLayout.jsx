import { Link, NavLink } from 'react-router-dom';
import { 
  Tractor, 
  ArrowLeft, 
  Printer, 
  FileText, 
  ShieldCheck, 
  Scale, 
  Calendar, 
  MapPin, 
  ListTree
} from 'lucide-react';
import '../../pages/LegalPages.css';

export default function LegalLayout({
  title,
  subtitle,
  badgeText = 'Marco Legal Vigente',
  badgeType = 'green', // 'green' | 'amber' | 'cyan'
  fechaActualizacion = 'Agosto 2026',
  jurisdiccion = 'República de Costa Rica',
  tocItems = [],
  children
}) {
  const handlePrint = () => {
    window.print();
  };

  const getBadgeClass = (type) => {
    switch (type) {
      case 'amber':
        return 'legal-badge--amber';
      case 'cyan':
        return 'legal-badge--cyan';
      case 'green':
      default:
        return 'legal-badge--green';
    }
  };

  return (
    <div className="legal-page-wrapper">
      {/* Header Sticky */}
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link to="/" className="legal-brand" title="Ir al Inicio de ContadorGanadero">
            <div className="legal-brand-logo">
              <Tractor size={22} />
            </div>
            <div className="legal-brand-text">
              <span className="legal-brand-title">ContadorGanadero</span>
              <span className="legal-brand-badge">Centro Legal y Normativo</span>
            </div>
          </Link>

          <div className="legal-header-actions">
            <Link to="/" className="btn-legal-back">
              <ArrowLeft size={16} />
              <span>Inicio</span>
            </Link>
            <Link to="/login" className="btn-legal-login">
              <span>Iniciar Sesión</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Selector de Vistas / Pestañas Legales */}
      <nav className="legal-nav-tabs-wrapper" aria-label="Navegación legal">
        <div className="legal-nav-tabs">
          <NavLink 
            to="/terminos" 
            className={({ isActive }) => `legal-tab-item ${isActive ? 'active' : ''}`}
          >
            <Scale size={18} />
            <span>Términos y Condiciones</span>
          </NavLink>

          <NavLink 
            to="/condiciones-servicio" 
            className={({ isActive }) => `legal-tab-item ${isActive ? 'active' : ''}`}
          >
            <FileText size={18} />
            <span>Condiciones del Servicio</span>
          </NavLink>

          <NavLink 
            to="/privacidad" 
            className={({ isActive }) => `legal-tab-item ${isActive ? 'active' : ''}`}
          >
            <ShieldCheck size={18} />
            <span>Política de Privacidad</span>
          </NavLink>
        </div>
      </nav>

      {/* Hero del Documento */}
      <section className="legal-hero">
        <div className="legal-hero-badge-row">
          <span className={`legal-badge ${getBadgeClass(badgeType)}`}>
            {badgeText}
          </span>
          <span className="legal-badge legal-badge--cyan">
            Leyes Tributarias CR 2026
          </span>
        </div>

        <h1 className="legal-hero-title">{title}</h1>
        <p className="legal-hero-subtitle">{subtitle}</p>

        <div className="legal-meta-bar">
          <div className="legal-meta-info">
            <div className="legal-meta-item">
              <Calendar size={15} />
              <span>Última actualización: <strong>{fechaActualizacion}</strong></span>
            </div>
            <div className="legal-meta-item">
              <MapPin size={15} />
              <span>Jurisdicción: <strong>{jurisdiccion}</strong></span>
            </div>
          </div>

          <div className="legal-meta-actions">
            <button 
              type="button" 
              onClick={handlePrint} 
              className="btn-print-legal"
              title="Imprimir o guardar como PDF"
            >
              <Printer size={15} />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </section>

      {/* Contenido Principal con Tabla de Contenidos */}
      <main className="legal-content-container">
        {tocItems && tocItems.length > 0 && (
          <aside className="legal-toc-sidebar" aria-label="Índice del documento">
            <div className="legal-toc-title">
              <ListTree size={16} />
              <span>Índice del Contenido</span>
            </div>
            <ul className="legal-toc-list">
              {tocItems.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="legal-toc-link">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <article className="legal-document-card">
          {children}
        </article>
      </main>

      {/* Footer Legal */}
      <footer className="legal-footer">
        <div className="legal-footer-inner">
          <div className="legal-footer-nav">
            <Link to="/">Inicio</Link>
            <Link to="/login">Acceso Clientes</Link>
            <Link to="/terminos">Términos y Condiciones</Link>
            <Link to="/condiciones-servicio">Condiciones del Servicio</Link>
            <Link to="/privacidad">Política de Privacidad</Link>
          </div>
          <p className="legal-footer-copy">
            © {new Date().getFullYear()} ContadorGanadero. Plataforma especializada en el Régimen Especial Agropecuario (REA) de Costa Rica.
          </p>
        </div>
      </footer>
    </div>
  );
}
