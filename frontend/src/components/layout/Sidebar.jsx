import { LayoutDashboard, FileText, DollarSign, Calculator, LogOut, Menu, X, Tractor, Calendar, CreditCard } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import './Sidebar.css';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/facturas', label: 'Facturas', icon: FileText },
  { path: '/gastos', label: 'Gastos por Categoría', icon: CreditCard },
  { path: '/ingresos', label: 'Ingresos', icon: DollarSign },
  { path: '/impuestos', label: 'Impuestos', icon: Calculator },
  { path: '/calendario', label: 'Calendario', icon: Calendar },
];

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);

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
              <span className="sidebar-user-finca">{usuario?.nombreFinca || 'Mi Finca'}</span>
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
