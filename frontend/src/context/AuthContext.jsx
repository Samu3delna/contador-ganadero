import { createContext, useContext, useState, useEffect } from 'react';
import { loginAPI, registroAPI, obtenerPerfilAPI, logoutAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      obtenerPerfilAPI()
        .then(res => {
          setUsuario(res.data);
          localStorage.setItem('usuario', JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
        })
        .finally(() => setCargando(false));
    }
  }, []);

  const login = async (email, password) => {
    const res = await loginAPI({ email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('usuario', JSON.stringify(res.data));
    setUsuario(res.data);
    return res.data;
  };

  const registro = async (datos) => {
    const res = await registroAPI(datos);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('usuario', JSON.stringify(res.data));
    setUsuario(res.data);
    return res.data;
  };

  // Recarga el perfil desde el backend y actualiza el estado
  const refrescarSesion = async () => {
    try {
      const res = await obtenerPerfilAPI();
      setUsuario(res.data);
      localStorage.setItem('usuario', JSON.stringify(res.data));
      return res.data;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    try {
      await logoutAPI();
    } catch { /* no fallar si no hay cookie */ }
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registro, logout, refrescarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
