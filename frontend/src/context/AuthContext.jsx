import { createContext, useContext, useState, useEffect } from 'react';
import {
  loginAPI,
  registroAPI,
  refreshTokenAPI,
  obtenerPerfilAPI,
  logoutAPI,
  setAccessToken,
} from '../services/api';
import { esAdministrador } from '../utils/adminHelper';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Limpiar cualquier token residual en URL o localStorage (migración a sesión en memoria + cookie httpOnly)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token')) {
      urlParams.delete('token');
      const cleanSearch = urlParams.toString();
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`
      );
    }
    setAccessToken(null);

    refreshTokenAPI()
      .then((refreshRes) => {
        if (refreshRes.data?.token) {
          setAccessToken(refreshRes.data.token);
        }
        return obtenerPerfilAPI();
      })
      .then((res) => {
        const esAdmin = esAdministrador(res.data);
        setUsuario({
          ...res.data,
          esSuperAdmin: esAdmin,
        });
      })
      .catch(() => {
        setAccessToken(null);
        setUsuario(null);
      })
      .finally(() => setCargando(false));
  }, []);

  const login = async (email, password, totpCode) => {
    const res = await loginAPI({ email, password, ...(totpCode ? { totpCode } : {}) });
    if (res.data?.mfaRequired) {
      return res.data;
    }
    const esAdmin = esAdministrador(res.data);
    const datos = {
      ...res.data,
      esSuperAdmin: esAdmin,
    };
    setAccessToken(datos.token);
    setUsuario(datos);
    return datos;
  };

  const registro = async (datos) => {
    const res = await registroAPI(datos);
    const esAdmin = esAdministrador(res.data);
    const datosNormalizados = {
      ...res.data,
      esSuperAdmin: esAdmin,
    };
    setAccessToken(datosNormalizados.token);
    setUsuario(datosNormalizados);
    return datosNormalizados;
  };

  const refrescarSesion = async () => {
    try {
      const res = await obtenerPerfilAPI();
      const esAdmin = esAdministrador(res.data);
      const datos = {
        ...res.data,
        esSuperAdmin: esAdmin,
      };
      setUsuario(datos);
      return datos;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    try {
      await logoutAPI();
    } catch { /* no fallar si no hay cookie */ }
    setAccessToken(null);
    setUsuario(null);
  };

  const actualizarUsuario = (datosActualizados) => {
    setUsuario((prev) => ({ ...prev, ...datosActualizados }));
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registro, logout, refrescarSesion, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
