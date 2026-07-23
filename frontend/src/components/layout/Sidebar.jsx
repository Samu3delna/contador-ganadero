import { LayoutDashboard, FileText, DollarSign, Calculator, LogOut, Menu, X, Tractor, Calendar, CreditCard, Landmark, Warehouse, TrendingUp, Receipt, Building2, FileBarChart2, Crown, AlertTriangle } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import './Sidebar.css';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/facturas', label: 'Facturas', icon: FileText },
  { path: '/gastos', label: 'Gastos por Categoría', icon: CreditCard },
  { path: '/ingresos', label: 'Ingresos', icon: DollarSign },
  { path: '/inventario', label: 'Inventario', icon: Warehouse },
  { path: '/costos', label: 'Costos de Producción', icon: TrendingUp },
  { path: '/facturacion', label: 'Facturación REA', icon: Receipt },
  { path: '/hacienda', label: 'Hacienda v4.4', icon: Building2 },
  { path: '/d150', label: 'Conciliación D-150', icon: FileBarChart2 },
  { path: '/declaraciones', label: 'Declaraciones Hacienda', icon: Landmark },
  { path: '/impuestos', label: 'Impuestos', icon: Calculator },
  { path: '/calendario', label: 'Calendario', icon: Calendar },
  { path: '/planes', label: 'Planes & Facturación', icon: Crown },
  { path: '/billing', label: 'Mi Suscripción', icon: CreditCard },
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
      <button className="sidebar-toggle" onClick={() => setAbierto(!abierto)}>
        {abierto ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside className={`sidebar ${abierto ? 'sidebar--abierto' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo"><Tractor size={28} color="var(--color-primario-claro)" /></span>
          <div>
            <h2 className="sidebar-title">ContadorGanadero</h2>
            <span className="sidebar-badge">REA</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link--activo' : ''}`}
              onClick={() => setAbierto(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {(usuario?.nombre || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{usuario?.nombre || 'Usuario'}</span>
              <span className="sidebar-user-finca">{usuario?.nombreFinca || usuario?.tenant?.nombreFinca || 'Mi Finca'}</span>
              {planNombre && (
                <span
                  className="sidebar-user-plan"
                  onClick={() => { setAbierto(false); navigate('/billing'); }}
                  title="Ver mi suscripción"
                >
                  <Crown size={11} /> Plan: {planNombre}
                </span>
              )}
              {estadoTenant && estadoTenant !== 'activo' && (
                <span
                  className="sidebar-user-alerta"
                  onClick={() => { setAbierto(false); navigate('/billing'); }}
                  title="Acceso limitado"
                >
                  <AlertTriangle size={11} /> Acceso limitado
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
