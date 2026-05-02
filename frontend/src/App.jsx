import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FacturasPage from './pages/FacturasPage';
import IngresosPage from './pages/IngresosPage';
import ImpuestosPage from './pages/ImpuestosPage';
import './App.css';

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="loader-center"><div className="loader" /></div>;
  return usuario ? children : <Navigate to="/login" />;
}

function AppLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/facturas" element={<FacturasPage />} />
          <Route path="/ingresos" element={<IngresosPage />} />
          <Route path="/impuestos" element={<ImpuestosPage />} />
        </Routes>
      </div>
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
