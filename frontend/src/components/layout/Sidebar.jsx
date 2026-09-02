import { LayoutDashboard, FileText, DollarSign, Calculator, LogOut, Menu, X, Tractor, Calendar, CreditCard, Landmark, Warehouse, TrendingUp, Receipt, Building2, FileBarChart2, Crown, AlertTriangle, ChevronRight } from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import './Sidebar.css';

const menuSections = [
  {
    titulo: 'PRINCIPAL',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/facturas', label: 'Facturas XML', icon: FileText },
      { path: '/gastos', label: 'Gastos por Categoría', icon: CreditCard },
      { path: '/ingresos', label: 'Ingresos', icon: DollarSign },
    ]
  },
  {
    titulo: 'GESTIÓN AGROPECUARIA',
    items: [
      { path: '/inventario', label: 'Inventario', icon: Warehouse },
      { path: '/costos', label: 'Costos de Producción', icon: TrendingUp },
      { path: '/facturacion', label: 'Facturación REA', icon: Receipt },
    ]
  },
  {
    titulo: 'HACIENDA & FISCAL',
    items: [
      { path: '/hacienda', label: 'Hacienda v4.4', icon: Building2 },
      { path: '/d150', label: 'Conciliación D-150', icon: FileBarChart2 },
      { path: '/declaraciones', label: 'Declaraciones', icon: Landmark },
      { path: '/impuestos', label: 'Cálculo Impuestos', icon: Calculator },
      { path: '/calendario', label: 'Calendario Fiscal', icon: Calendar },
    ]
  },
  {
    titulo: 'PLAN & CUENTA',
    items: [
      { path: '/planes', label: 'Planes & Precios', icon: Crown },
      { path: '/billing', label: 'Mi Suscripción', icon: CreditCard },
    ]
  }
];

const PLAN_NOMBRES = {
  free: 'Gratis',
  pro: 'Pro',
  agro: 'Agro',
};

// Título legible de la ruta actual, para mostrarlo en la barra superior móvil.
const TITULOS_RUTA = menuSections
  .flatMap((s) => s.items)
  .reduce((acc, item) => ({ ...acc, [item.path]: item.label }), {});

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const asideRef = useRef(null);
  const toggleRef = useRef(null);

  const planUsuario = usuario?.plan || usuario?.tenant?.plan;
  const estadoTenant = usuario?.estadoTenant || usuario?.tenant?.estado;
  const planNombre = PLAN_NOMBRES[planUsuario] || (planUsuario ? planUsuario : null);
  const tituloActual = TITULOS_RUTA[location.pathname] || 'ContadorGanadero';

  const cerrar = () => setAbierto(false);

  // Bloquea el scroll del fondo mientras el panel está abierto en móvil.
  useEffect(() => {
    if (!abierto) return undefined;
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [abierto]);

  // Cierra con Escape y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!abierto) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setAbierto(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [abierto]);

  // Si se vuelve a escritorio con el panel abierto, se restablece el estado.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => { if (e.matches) setAbierto(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const inicialUsuario = (usuario?.nombre || 'U').charAt(0).toUpperCase();

  return (
    <>
      {/* Barra superior: sólo visible en móvil y tablet */}
      <header className="topbar">
        <button
          ref={toggleRef}
          className="topbar-toggle"
          onClick={() => setAbierto((v) => !v)}
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={abierto}
          aria-controls="sidebar-nav"
        >
          {abierto ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="topbar-brand">
          <Tractor size={20} className="topbar-brand-icon" />
          <span className="topbar-title">{tituloActual}</span>
        </div>

        <button className="topbar-logout" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={19} />
        </button>
      </header>

      <aside
        id="sidebar-nav"
        ref={asideRef}
        className={`sidebar ${abierto ? 'sidebar--abierto' : ''}`}
        aria-hidden={undefined}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <Tractor size={26} className="sidebar-logo-icon" />
          </div>
          <div className="sidebar-brand-info">
            <h2 className="sidebar-title">ContadorGanadero</h2>
            <Badge variant="default" className="text-[10px] px-2 py-0 h-4 font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              RÉGIMEN REA
            </Badge>
          </div>
          <button
            className="sidebar-cerrar"
            onClick={cerrar}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {menuSections.map((seccion) => (
            <div key={seccion.titulo} className="sidebar-section">
              <span className="sidebar-section-title">{seccion.titulo}</span>
              <div className="sidebar-section-items">
                {seccion.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link--activo' : ''}`}
                    onClick={cerrar}
                  >
                    <item.icon size={18} className="sidebar-link-icon" />
                    <span>{item.label}</span>
                    <ChevronRight size={14} className="sidebar-link-arrow opacity-0 transition-opacity ml-auto" />
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Avatar className="h-9 w-9 border-emerald-500/40">
              <AvatarFallback className="bg-emerald-950 text-emerald-300 font-bold">
                {inicialUsuario}
              </AvatarFallback>
            </Avatar>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name" title={usuario?.nombre || 'Usuario'}>
                {usuario?.nombre || 'Usuario'}
              </span>
              <span className="sidebar-user-finca" title={usuario?.nombreFinca || usuario?.tenant?.nombreFinca || 'Mi Finca'}>
                {usuario?.nombreFinca || usuario?.tenant?.nombreFinca || 'Mi Finca'}
              </span>
              <div className="sidebar-user-tags">
                {planNombre && (
                  <button
                    type="button"
                    className="sidebar-user-plan"
                    onClick={() => { cerrar(); navigate('/billing'); }}
                    title="Ver mi suscripción"
                  >
                    <Crown size={10} /> {planNombre}
                  </button>
                )}
                {estadoTenant && estadoTenant !== 'activo' && (
                  <button
                    type="button"
                    className="sidebar-user-alerta"
                    onClick={() => { cerrar(); navigate('/billing'); }}
                    title="Acceso limitado"
                  >
                    <AlertTriangle size={10} /> Limitado
                  </button>
                )}
              </div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div
        className={`sidebar-overlay ${abierto ? 'sidebar-overlay--visible' : ''}`}
        onClick={cerrar}
        aria-hidden="true"
      />
    </>
  );
}
