import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { esAdministrador } from './utils/adminHelper';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import ChatBot from './components/dashboard/ChatBot';
import { publicRoutes } from './publicRoutes';
import SEOHead from './components/public/SEOHead';
import './App.css';

// Lazy-loaded pages (code-splitting)

const TerminosCondicionesPage = lazy(() => import('./pages/TerminosCondicionesPage'));
const CondicionesServicioPage = lazy(() => import('./pages/CondicionesServicioPage'));
const PoliticaPrivacidadPage = lazy(() => import('./pages/PoliticaPrivacidadPage'));
const EliminacionDatosPage = lazy(() => import('./pages/EliminacionDatosPage'));
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
const AdminSoportePage = lazy(() => import('./pages/admin/AdminSoportePage'));

const RecuperarCuentaPage = lazy(() => import('./pages/RecuperarCuentaPage'));

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

function RutaUsuario({ children }) {
  const { usuario } = useAuth();
  return (usuario?.esSuperAdmin || esAdministrador(usuario)) ? <Navigate to="/admin" replace /> : children;
}

function AppLayout() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.esSuperAdmin || esAdministrador(usuario);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        
        <Suspense fallback={<PageLoader />}>
          <Outlet />
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
        <SEOHead /><Suspense fallback={<PageLoader />}><Routes>
          {publicRoutes()}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<LoginPage />} />
          <Route path="/recuperar-password" element={<Suspense fallback={<PageLoader />}><RecuperarCuentaPage /></Suspense>} />
          <Route path="/restablecer-password" element={<Suspense fallback={<PageLoader />}><RecuperarCuentaPage /></Suspense>} />
          <Route path="/verificar-email" element={<Suspense fallback={<PageLoader />}><RecuperarCuentaPage verificar /></Suspense>} />
          
          {/* Páginas Legales Públicas */}
          <Route path="/terminos" element={<Suspense fallback={<PageLoader />}><TerminosCondicionesPage /></Suspense>} />
          <Route path="/terminos-y-condiciones" element={<Suspense fallback={<PageLoader />}><TerminosCondicionesPage /></Suspense>} />
          <Route path="/condiciones-servicio" element={<Suspense fallback={<PageLoader />}><CondicionesServicioPage /></Suspense>} />
          <Route path="/condiciones-del-servicio" element={<Suspense fallback={<PageLoader />}><CondicionesServicioPage /></Suspense>} />
          <Route path="/privacidad" element={<Suspense fallback={<PageLoader />}><PoliticaPrivacidadPage /></Suspense>} />
          <Route path="/politica-de-privacidad" element={<Suspense fallback={<PageLoader />}><PoliticaPrivacidadPage /></Suspense>} />
          <Route path="/eliminacion-datos" element={<Suspense fallback={<PageLoader />}><EliminacionDatosPage /></Suspense>} />
          <Route path="/eliminacion-de-datos" element={<Suspense fallback={<PageLoader />}><EliminacionDatosPage /></Suspense>} />
          <Route path="/deletion" element={<Suspense fallback={<PageLoader />}><EliminacionDatosPage /></Suspense>} />

          <Route element={<RutaProtegida><AppLayout /></RutaProtegida>}>
            <Route path="/dashboard" element={<RutaUsuario><DashboardPage /></RutaUsuario>} />
            <Route path="/facturas" element={<RutaUsuario><FacturasPage /></RutaUsuario>} />
            <Route path="/gastos" element={<RutaUsuario><GastosPage /></RutaUsuario>} />
            <Route path="/ingresos" element={<RutaUsuario><IngresosPage /></RutaUsuario>} />
            <Route path="/impuestos" element={<RutaUsuario><ImpuestosPage /></RutaUsuario>} />
            <Route path="/declaraciones" element={<RutaUsuario><DeclaracionesPage /></RutaUsuario>} />
            <Route path="/inventario" element={<RutaUsuario><InventarioPage /></RutaUsuario>} />
            <Route path="/costos" element={<RutaUsuario><CostosPage /></RutaUsuario>} />
            <Route path="/facturacion" element={<RutaUsuario><FacturacionPage /></RutaUsuario>} />
            <Route path="/hacienda" element={<RutaUsuario><HaciendaPage /></RutaUsuario>} />
            <Route path="/d150" element={<RutaUsuario><D150Page /></RutaUsuario>} />
            <Route path="/calendario" element={<RutaUsuario><CalendarioPage /></RutaUsuario>} />
            <Route path="/planes" element={<RutaUsuario><PlanesPage /></RutaUsuario>} />
            <Route path="/billing" element={<RutaUsuario><BillingPage /></RutaUsuario>} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/admin" element={<RutaAdmin><AdminDashboardPage /></RutaAdmin>} />
            <Route path="/admin/usuarios" element={<RutaAdmin><AdminUsuariosPage /></RutaAdmin>} />
            <Route path="/admin/tenants" element={<RutaAdmin><AdminTenantsPage /></RutaAdmin>} />
            <Route path="/admin/monitoreo" element={<RutaAdmin><AdminMonitoreoPage /></RutaAdmin>} />
            <Route path="/admin/soporte" element={<RutaAdmin><AdminSoportePage /></RutaAdmin>} />
          </Route>
        </Routes></Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
