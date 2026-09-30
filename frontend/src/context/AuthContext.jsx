import { createContext, useContext, useState, useEffect } from 'react';
import { loginAPI, registroAPI, obtenerPerfilAPI, logoutAPI } from '../services/api';
import { esAdministrador } from '../utils/adminHelper';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('token');
    if (token) {
      obtenerPerfilAPI()
        .then(res => {
          const esAdmin = esAdministrador(res.data);
          const datos = {
            ...res.data,
            esSuperAdmin: esAdmin,
          };
          setUsuario(datos);
          localStorage.setItem('usuario', JSON.stringify(datos));
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
        })
        .finally(() => setCargando(false));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCargando(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await loginAPI({ email, password });
    const esAdmin = esAdministrador(res.data, email);
    const datos = {
      ...res.data,
      esSuperAdmin: esAdmin,
    };
    localStorage.setItem('token', datos.token);
    localStorage.setItem('usuario', JSON.stringify(datos));
    setUsuario(datos);
    return datos;
  };

  const registro = async (datos) => {
    const res = await registroAPI(datos);
    const esAdmin = esAdministrador(res.data, datos.email);
    const datosNormalizados = {
      ...res.data,
      esSuperAdmin: esAdmin,
    };
    localStorage.setItem('token', datosNormalizados.token);
    localStorage.setItem('usuario', JSON.stringify(datosNormalizados));
    setUsuario(datosNormalizados);
    return datosNormalizados;
  };

  // Recarga el perfil desde el backend y actualiza el estado
  const refrescarSesion = async () => {
    try {
      const res = await obtenerPerfilAPI();
      const esAdmin = esAdministrador(res.data);
      const datos = {
        ...res.data,
        esSuperAdmin: esAdmin,
      };
      setUsuario(datos);
      localStorage.setItem('usuario', JSON.stringify(datos));
      return datos;
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

  // Actualiza los datos de usuario en memoria y localStorage
  const actualizarUsuario = (datosActualizados) => {
    setUsuario(prev => {
      const nuevo = { ...prev, ...datosActualizados };
      localStorage.setItem('usuario', JSON.stringify(nuevo));
      return nuevo;
    });
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registro, logout, refrescarSesion, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
