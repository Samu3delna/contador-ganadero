import { LayoutDashboard, FileText, DollarSign, Calculator, LogOut, Menu, X, Tractor, Calendar, CreditCard, Landmark, Warehouse, TrendingUp, Receipt, Building2, FileBarChart2, Crown, AlertTriangle } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import './Sidebar.css';

const menuSections = [
  {
    titulo: 'PRINCIPAL',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
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
  free: 'Free',
  bronce: 'Bronce',
  oro: 'Oro',
  corporativo: 'Corporativo',
};

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();

  const planUsuario = usuario?.plan || usuario?.tenant?.plan;
  const estadoTenant = usuario?.estadoTenant || usuario?.tenant?.estado;
  const planNombre = PLAN_NOMBRES[planUsuario] || (planUsuario ? planUsuario : null);

  return (
    <>
      <button 
        className="sidebar-toggle" 
        onClick={() => setAbierto(!abierto)}
        aria-label="Alternar menú"
      >
        {abierto ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside className={`sidebar ${abierto ? 'sidebar--abierto' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <Tractor size={28} className="sidebar-logo-icon" />
          </div>
          <div className="sidebar-brand-info">
            <h2 className="sidebar-title">ContadorGanadero</h2>
            <span className="sidebar-badge">RÉGIMEN REA</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuSections.map((seccion) => (
            <div key={seccion.titulo} className="sidebar-section">
              <span className="sidebar-section-title">{seccion.titulo}</span>
              <div className="sidebar-section-items">
                {seccion.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link--activo' : ''}`}
                    onClick={() => setAbierto(false)}
                  >
                    <item.icon size={18} className="sidebar-link-icon" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {(usuario?.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name" title={usuario?.nombre || 'Usuario'}>
                {usuario?.nombre || 'Usuario'}
              </span>
              <span className="sidebar-user-finca" title={usuario?.nombreFinca || usuario?.tenant?.nombreFinca || 'Mi Finca'}>
                {usuario?.nombreFinca || usuario?.tenant?.nombreFinca || 'Mi Finca'}
              </span>
              {planNombre && (
                <span
                  className="sidebar-user-plan"
                  onClick={() => { setAbierto(false); navigate('/billing'); }}
                  title="Ver mi suscripción"
                >
                  <Crown size={10} /> {planNombre}
                </span>
              )}
              {estadoTenant && estadoTenant !== 'activo' && (
                <span
                  className="sidebar-user-alerta"
                  onClick={() => { setAbierto(false); navigate('/billing'); }}
                  title="Acceso limitado"
                >
                  <AlertTriangle size={10} /> Limitado
                </span>
              )}
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {abierto && <div className="sidebar-overlay" onClick={() => setAbierto(false)} />}
    </>
  );
}
