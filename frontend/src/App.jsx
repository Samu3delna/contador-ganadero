import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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

function PageLoader() {
  return <div className="loader-center"><div className="loader" /></div>;
}

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PageLoader />;
  return usuario ? children : <Navigate to="/login" />;
}

function AppLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <AdvertisingSlot />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/facturas" element={<FacturasPage />} />
            <Route path="/gastos" element={<GastosPage />} />
            <Route path="/ingresos" element={<IngresosPage />} />
            <Route path="/impuestos" element={<ImpuestosPage />} />
            <Route path="/declaraciones" element={<DeclaracionesPage />} />
            <Route path="/inventario" element={<InventarioPage />} />
            <Route path="/costos" element={<CostosPage />} />
            <Route path="/facturacion" element={<FacturacionPage />} />
            <Route path="/hacienda" element={<HaciendaPage />} />
            <Route path="/d150" element={<D150Page />} />
            <Route path="/calendario" element={<CalendarioPage />} />
            <Route path="/planes" element={<PlanesPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </div>
      <ChatBot />
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
