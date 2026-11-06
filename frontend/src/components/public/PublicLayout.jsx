import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import BrandLogo from './BrandLogo';
import '../../pages/LandingPage.css';

const products = [
  ['dashboard', 'Dashboard financiero'],
  ['facturas', 'Facturas XML'],
  ['ingresos', 'Ingresos'],
  ['gastos', 'Gastos'],
  ['inventario', 'Inventario'],
  ['costos', 'Costos de producción'],
  ['impuestos', 'Impuestos REA'],
];

export default function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="cg-public">
      <PublicNavbar key={pathname} />
      <main id="contenido-publico">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const menu = useRef(null);
  const menuButton = useRef(null);
  return (
    <header
      className="cg-header"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          setOpen(false);
          const productWasOpen = menu.current?.hasAttribute('open');
          menu.current?.removeAttribute('open');
          if (open) menuButton.current?.focus();
          else if (productWasOpen) menu.current?.querySelector('summary')?.focus();
        }
      }}
    >
      <a href="#contenido-publico" className="cg-skip">
        Saltar al contenido
      </a>
      <div className="cg-nav cg-container">
        <Link to="/" className="cg-brand" aria-label="ContadorGanadero — Inicio (contadorganadero.com)">
          <BrandLogo size={36} />
          ContadorGanadero
          <span>CR</span>
        </Link>
        <button
          ref={menuButton}
          className="cg-menu-button"
          aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'}
          aria-expanded={open}
          aria-controls="public-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav id="public-nav" className={open ? 'cg-navlinks cg-open' : 'cg-navlinks'} aria-label="Navegación principal">
          <details className="cg-product-menu" ref={menu}>
            <summary>
              Producto <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="cg-megamenu">
              <Link to="/producto">Explorar el producto</Link>
              {products.map(([slug, label]) => (
                <Link key={slug} to={`/producto/${slug}`}>
                  {label}
                </Link>
              ))}
            </div>
          </details>
          {[
            ['/soluciones', 'Soluciones'],
            ['/precios', 'Precios'],
          ].map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          <Link to="/login" className="cg-login">
            Iniciar sesión
          </Link>
          <Link className="cg-button cg-small" to="/registro">
            Probar gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="cg-footer">
      <div className="cg-container cg-footer-grid">
        <div>
          <Link to="/" className="cg-brand">
            <BrandLogo size={34} />
            ContadorGanadero
          </Link>
          <p>
            Tu contador ganadero y plataforma de contabilidad ganadera y agropecuaria en{' '}
            <strong>contadorganadero.com</strong>.
          </p>
          <p>Costa Rica · Régimen Especial Agropecuario (REA)</p>
        </div>
        <div>
          <h2>Explorar</h2>
          <Link to="/producto">Producto</Link>
          <Link to="/precios">Precios</Link>
        </div>
        <div>
          <h2>Hablemos</h2>
          <Link to="/contacto">Contacto</Link>
          <Link to="/preguntas-frecuentes">Preguntas frecuentes</Link>
          <Link to="/login">Ingresar a mi cuenta</Link>
        </div>
        <div>
          <h2>Información legal</h2>
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/condiciones-servicio">Condiciones del servicio</Link>
          <Link to="/eliminacion-datos">Eliminar mis datos</Link>
        </div>
      </div>
      <div className="cg-container cg-footer-bottom">
        © {new Date().getFullYear()} ContadorGanadero (contadorganadero.com). Contador ganadero y contabilidad ganadera para el campo costarricense.
      </div>
    </footer>
  );
}
