import ThemeProvider from './context/ThemeProvider';
import ThemeToggle from './components/layout/ThemeToggle';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { esAdministrador } from './utils/adminHelper';
import Sidebar from './components/layout/Sidebar';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ChatBot = lazy(() => import('./components/dashboard/ChatBot'));
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
  return <div className="shell-loading" role="status" aria-busy="true"><span className="sr-only">Cargando la plataforma...</span><div aria-hidden="true"><div className="dashboard-skeleton" style={{ height: 48, width: '60%', marginBottom: 24 }} /><div className="shell-loading-cards">{[0,1,2,3].map(i => <div key={i} className="dashboard-skeleton" style={{ height: 130 }} />)}</div><div className="dashboard-skeleton" style={{ height: 300, marginTop: 24 }} /></div></div>;
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
      <a className="skip-link" href="#main-content">Saltar al contenido</a><Sidebar />
      <main id="main-content" className="main-content" tabIndex={-1}><header className="desktop-topbar"><span>{esAdmin ? 'Administración' : 'Mi finca'}</span><ThemeToggle /></header>
        
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      {!esAdmin && <Suspense fallback={null}><ChatBot /></Suspense>}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider><BrowserRouter>
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
            <Route path="/hacienda" element={<Navigate to="/facturacion" replace />} />
            <Route path="/d150" element={<Navigate to="/declaraciones" replace />} />
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
    </BrowserRouter></ThemeProvider>
  );
}

export default App;
