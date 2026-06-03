import { createContext, useContext, useState, useEffect } from 'react';
import { loginAPI, registroAPI, obtenerPerfilAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      obtenerPerfilAPI()
        .then(res => setUsuario(res.data))
        .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('usuario'); })
        .finally(() => setCargando(false));
    }
  }, []);

  const login = async (email, password) => {
    const res = await loginAPI({ email, password });
    localStorage.setItem('token', res.data.token);
    setUsuario(res.data);
    return res.data;
  };

  const registro = async (datos) => {
    const res = await registroAPI(datos);
    localStorage.setItem('token', res.data.token);
    setUsuario(res.data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registro, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
