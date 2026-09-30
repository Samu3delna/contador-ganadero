import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { esAdministrador } from './utils/adminHelper';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import ChatBot from './components/dashboard/ChatBot';
import AdvertisingSlot from './components/ads/AdvertisingSlot';
import './App.css';

// Lazy-loaded pages (code-splitting)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const TerminosCondicionesPage = lazy(() => import('./pages/TerminosCondicionesPage'));
const CondicionesServicioPage = lazy(() => import('./pages/CondicionesServicioPage'));
const PoliticaPrivacidadPage = lazy(() => import('./pages/PoliticaPrivacidadPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FacturasPage = lazy(() => import('./pages/FacturasPage'));
const IngresosPage = lazy(() => import('./pages/IngresosPage'));
const ImpuestosPage = lazy(() => import('./pages/ImpuestosPage'));
const CalendarioPage = lazy(() => import('./pages/CalendarioPage'));
const GastosPage = lazy(() => import('./pages/GastosPage'));
const DeclaracionesPage = lazy(() => import('./pages/DeclaracionesPage'));
const InventarioPage = lazy(() => import('./pages/InventarioPage'));
const CostosPage = lazy(() => import('./pages/CostosPage'));
const FacturacionPage = lazy(() => import('./pages/FacturacionPage'));
const HaciendaPage = lazy(() => import('./pages/HaciendaPage'));
const D150Page = lazy(() => import('./pages/D150Page'));
const PlanesPage = lazy(() => import('./pages/PlanesPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const PerfilPage = lazy(() => import('./pages/PerfilPage'));

// Páginas de Super Admin
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsuariosPage = lazy(() => import('./pages/admin/AdminUsuariosPage'));
const AdminTenantsPage = lazy(() => import('./pages/admin/AdminTenantsPage'));
const AdminMonitoreoPage = lazy(() => import('./pages/admin/AdminMonitoreoPage'));

function PageLoader() {
  return <div className="loader-center"><div className="loader" /></div>;
}

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PageLoader />;
  return usuario ? children : <Navigate to="/login" />;
}

// Guard de rutas Super Admin: además de autenticado, requiere flag esSuperAdmin o cumplir condición de admin
function RutaAdmin({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PageLoader />;
  return (usuario?.esSuperAdmin || esAdministrador(usuario)) ? children : <Navigate to="/dashboard" replace />;
}

function AppLayout() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.esSuperAdmin || esAdministrador(usuario);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        {!esAdmin && <AdvertisingSlot />}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Si es Administrador, redirigir rutas de usuario común directamente al panel admin */}
            <Route path="/dashboard" element={esAdmin ? <Navigate to="/admin" replace /> : <DashboardPage />} />
            <Route path="/facturas" element={esAdmin ? <Navigate to="/admin" replace /> : <FacturasPage />} />
            <Route path="/gastos" element={esAdmin ? <Navigate to="/admin" replace /> : <GastosPage />} />
            <Route path="/ingresos" element={esAdmin ? <Navigate to="/admin" replace /> : <IngresosPage />} />
            <Route path="/impuestos" element={esAdmin ? <Navigate to="/admin" replace /> : <ImpuestosPage />} />
            <Route path="/declaraciones" element={esAdmin ? <Navigate to="/admin" replace /> : <DeclaracionesPage />} />
            <Route path="/inventario" element={esAdmin ? <Navigate to="/admin" replace /> : <InventarioPage />} />
            <Route path="/costos" element={esAdmin ? <Navigate to="/admin" replace /> : <CostosPage />} />
            <Route path="/facturacion" element={esAdmin ? <Navigate to="/admin" replace /> : <FacturacionPage />} />
            <Route path="/hacienda" element={esAdmin ? <Navigate to="/admin" replace /> : <HaciendaPage />} />
            <Route path="/d150" element={esAdmin ? <Navigate to="/admin" replace /> : <D150Page />} />
            <Route path="/calendario" element={esAdmin ? <Navigate to="/admin" replace /> : <CalendarioPage />} />
            <Route path="/planes" element={esAdmin ? <Navigate to="/admin" replace /> : <PlanesPage />} />
            <Route path="/billing" element={esAdmin ? <Navigate to="/admin" replace /> : <BillingPage />} />
            <Route path="/perfil" element={<PerfilPage />} />

            {/* Rutas Super Admin */}
            <Route path="/admin" element={<RutaAdmin><AdminDashboardPage /></RutaAdmin>} />
            <Route path="/admin/usuarios" element={<RutaAdmin><AdminUsuariosPage /></RutaAdmin>} />
            <Route path="/admin/tenants" element={<RutaAdmin><AdminTenantsPage /></RutaAdmin>} />
            <Route path="/admin/monitoreo" element={<RutaAdmin><AdminMonitoreoPage /></RutaAdmin>} />

            <Route path="*" element={<Navigate to={esAdmin ? "/admin" : "/dashboard"} replace />} />
          </Routes>
        </Suspense>
      </div>
      {!esAdmin && <ChatBot />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<LoginPage />} />
          
          {/* Páginas Legales Públicas */}
          <Route path="/terminos" element={<Suspense fallback={<PageLoader />}><TerminosCondicionesPage /></Suspense>} />
          <Route path="/terminos-y-condiciones" element={<Suspense fallback={<PageLoader />}><TerminosCondicionesPage /></Suspense>} />
          <Route path="/condiciones-servicio" element={<Suspense fallback={<PageLoader />}><CondicionesServicioPage /></Suspense>} />
          <Route path="/condiciones-del-servicio" element={<Suspense fallback={<PageLoader />}><CondicionesServicioPage /></Suspense>} />
          <Route path="/privacidad" element={<Suspense fallback={<PageLoader />}><PoliticaPrivacidadPage /></Suspense>} />
          <Route path="/politica-de-privacidad" element={<Suspense fallback={<PageLoader />}><PoliticaPrivacidadPage /></Suspense>} />

          <Route path="/*" element={<RutaProtegida><AppLayout /></RutaProtegida>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
