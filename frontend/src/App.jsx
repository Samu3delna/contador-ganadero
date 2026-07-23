import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import ChatBot from './components/dashboard/ChatBot';
import './App.css';

// Lazy-loaded pages (code-splitting)
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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<RutaProtegida><AppLayout /></RutaProtegida>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
