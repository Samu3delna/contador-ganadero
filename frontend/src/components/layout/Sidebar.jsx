import { LayoutDashboard, FileText, DollarSign, Calculator, LogOut, Menu, X, PanelLeftClose, Calendar, CreditCard, Landmark, Warehouse, TrendingUp, Receipt, Building2, FileBarChart2, Crown, AlertTriangle, ChevronRight, User, Shield, Users, Building, Activity, LifeBuoy } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { esAdministrador } from '../../utils/adminHelper';
import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import PrivateBrand from './PrivateBrand';
import ThemeToggle from './ThemeToggle';
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
      { path: '/perfil', label: 'Mi Perfil', icon: User },
      { path: '/planes', label: 'Planes & Precios', icon: Crown },
      { path: '/billing', label: 'Mi Suscripción', icon: CreditCard },
    ]
  }
];

const PLAN_NOMBRES = {
  free: 'Gratis',
  pro: 'Pro',
};

// Sección exclusiva del Super Admin (flag esSuperAdmin del perfil)
const SECCION_ADMIN = {
  titulo: 'ADMINISTRACIÓN',
  items: [
    { path: '/admin', label: 'Panel Global', icon: Shield },
    { path: '/admin/usuarios', label: 'Usuarios', icon: Users },
    { path: '/admin/tenants', label: 'Tenants & Planes', icon: Building },
    { path: '/admin/monitoreo', label: 'Monitoreo', icon: Activity },
    { path: '/admin/soporte', label: 'Soporte', icon: LifeBuoy },
  ]
};

// Título legible de la ruta actual, para mostrarlo en la barra superior móvil.
export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [compact, setCompact] = useState(false);
  const navigate = useNavigate();

  const asideRef = useRef(null);
  const toggleRef = useRef(null);

  const planUsuario = usuario?.plan || usuario?.tenant?.plan;
  const estadoTenant = usuario?.estadoTenant || usuario?.tenant?.estado;
  const planNombre = PLAN_NOMBRES[planUsuario] || (planUsuario ? planUsuario : null);

  const cerrar = () => { setAbierto(false); if (abierto) toggleRef.current?.focus(); };

  // Bloquea el scroll del fondo mientras el panel está abierto en móvil.
  useEffect(() => {
    if (!abierto) return undefined;
    document.body.classList.add('no-scroll');
    const main = document.getElementById('main-content');
    if (main) main.inert = true;
    // Transfer focus after the click and opening styles have been committed.
    const focusTimer = window.setTimeout(() => asideRef.current?.querySelector('a, button')?.focus(), 50);
    return () => { window.clearTimeout(focusTimer); document.body.classList.remove('no-scroll'); if (main) main.inert = false; };
  }, [abierto]);

  // Cierra con Escape y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!abierto) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Tab') {
        const items = [...asideRef.current.querySelectorAll('a, button')].filter(el => el.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
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

  // Si es administrador, muestra ÚNICAMENTE las vistas de administración.
  // Si es usuario normal, muestra las secciones de usuario y NADA de administración.
  const esAdmin = usuario?.esSuperAdmin || esAdministrador(usuario);
  const seccionesVisibles = esAdmin
    ? [SECCION_ADMIN]
    : menuSections;

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

        <div className="topbar-brand"><PrivateBrand admin={esAdmin} /></div>
        <ThemeToggle />
      </header>

      <aside
        id="sidebar-nav"
        ref={asideRef}
        className={`sidebar ${abierto ? 'sidebar--abierto' : ''} ${compact ? 'sidebar--compact' : ''}`}
        aria-hidden={undefined}
      >
        <div className="sidebar-header">
          <PrivateBrand admin={esAdmin} />
          <button
            className="sidebar-cerrar"
            onClick={cerrar}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <button className="sidebar-collapse" onClick={() => setCompact(v => !v)} aria-label={compact ? "Expandir menu" : "Contraer menu"} aria-expanded={!compact}><PanelLeftClose size={18} /><span>Contraer menu</span></button>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {seccionesVisibles.map((seccion) => (
            <div key={seccion.titulo} className="sidebar-section">
              <span className="sidebar-section-title">{seccion.titulo}</span>
              <div className="sidebar-section-items">
                {seccion.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end
                    title={item.label}
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
            <button className="sidebar-logout" aria-label="Ver mi perfil" onClick={() => { cerrar(); navigate('/perfil'); }}><Avatar
              className="h-9 w-9 border-emerald-500/40 cursor-pointer"
              title="Ver mi perfil"
            >
              <AvatarFallback className="bg-emerald-950 text-emerald-300 font-bold">
                {inicialUsuario}
              </AvatarFallback>
            </Avatar></button>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name" title={usuario?.nombre || (esAdmin ? 'Super Admin' : 'Usuario')}>
                {usuario?.nombre || (esAdmin ? 'Super Admin' : 'Usuario')}
              </span>
              {esAdmin ? (
                <div className="sidebar-user-tags">
                  <span className="sidebar-user-plan border-amber-500/40 text-amber-400 bg-amber-500/10 cursor-default">
                    <Shield size={10} /> Panel Admin
                  </span>
                </div>
              ) : (
                <>
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
                </>
              )}
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
