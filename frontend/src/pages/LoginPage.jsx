import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { esAdministrador } from '../utils/adminHelper';
import { ArrowLeft, ShieldCheck, Scale, FileText, UserPlus, LogIn } from 'lucide-react';
import LoginHeader from '../components/login/LoginHeader';
import LoginForm from '../components/login/LoginForm';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import useSeo from '../hooks/useSeo';
// Video de fondo original de la marca (restaurado desde el historial de git)
import fondoLogin from '../Recursos/fondo_login.webm';
import './LoginPage.css';

const ERRORES_OAUTH = {
  google_auth_failed: 'No se pudo completar el inicio de sesión con Google. Intenta nuevamente.',
  invalid_oauth_state: 'La sesión de autenticación expiró por seguridad. Intenta iniciar sesión de nuevo.',
  google_email_unverified: 'Tu cuenta de Google debe tener un correo electrónico verificado.',
  account_exists_use_password: 'Ya existe una cuenta con ese correo. Inicia sesión con tu contraseña.',
  account_suspended: 'Tu cuenta se encuentra suspendida. Contacta a soporte.',
  tenant_inactive: 'La cuenta de la finca se encuentra inactiva. Contacta a soporte.',
};

function extraerMensajeError(err) {
  const data = err?.response?.data;
  if (data) {
    if (typeof data.mensaje === 'string' && data.mensaje.trim() && (!data.error || /^[A-Z0-9_]+$/.test(String(data.error)))) {
      return data.mensaje;
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
    if (typeof data.mensaje === 'string' && data.mensaje.trim()) {
      return data.mensaje;
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  }
  return 'Error de conexión con el servidor. Verifica tu conexión e intenta nuevamente.';
}

export default function LoginPage() {
  const { login, registro, completarMfa, usuario, cargando: authCargando } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Permite abrir directamente en modo registro si viene de enlaces como "Comenzar Gratis" o ruta /registro
  const searchParams = new URLSearchParams(location.search);
  const esModoRegistroPorRuta = Boolean(
    location.state?.registro ||
    searchParams.get('registro') === 'true' ||
    searchParams.get('modo') === 'registro' ||
    location.pathname === '/registro'
  );
  const rutaKey = `${location.pathname}${location.search}`;

  const [modoManual, setModoManual] = useState(null);
  const esRegistro = modoManual?.rutaKey === rutaKey ? modoManual.valor : esModoRegistroPorRuta;

  const [animandoCambio, setAnimandoCambio] = useState(false);
  const [saliendoInicio, setSaliendoInicio] = useState(false);
  const [error, setError] = useState(() => {
    const oauthErr = new URLSearchParams(location.search).get('error');
    return oauthErr ? (ERRORES_OAUTH[oauthErr] || 'No se pudo completar la autenticación.') : '';
  });
  const [mfa, setMfa] = useState(() => new URLSearchParams(location.search).get('mfa') === '1' ? {} : null);
  const [codigoMfa, setCodigoMfa] = useState('');
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    nombreFinca: '',
    telefono: '',
    cedula: '',
    aceptaTerminos: false,
  });

  // Si ya hay una sesión activa, redirigir al panel correspondiente
  useEffect(() => {
    if (!authCargando && usuario) {
      const esAdmin = esAdministrador(usuario);
      navigate(esAdmin ? '/admin' : '/dashboard', { replace: true });
    }
  }, [usuario, authCargando, navigate]);

  // La página de login/registro no aporta valor en buscadores: se no-indexa.
  useSeo({
    title: esRegistro ? 'Crear cuenta gratis | ContadorGanadero' : 'Iniciar sesión | ContadorGanadero',
    description: esRegistro
      ? 'Crea tu cuenta gratuita en ContadorGanadero para gestionar el IVA REA, Renta, inventario y facturación de tu finca en Costa Rica.'
      : 'Accede a tu cuenta de ContadorGanadero para gestionar la contabilidad de tu finca.',
    path: location.pathname === '/registro' ? '/registro' : '/login',
    robots: 'noindex, follow',
  });

  // Cambio animado entre Iniciar Sesión y Registrar Gratis
  const cambiarModo = (nuevoModoRegistro) => {
    if (cargando || Boolean(nuevoModoRegistro) === esRegistro) return;
    setAnimandoCambio(true);
    setError('');
    setModoManual({ rutaKey, valor: Boolean(nuevoModoRegistro) });
    window.setTimeout(() => {
      setAnimandoCambio(false);
    }, 380);
  };

  // Transición suave al volver al inicio
  const handleVolverInicio = () => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      navigate('/');
      return;
    }
    setSaliendoInicio(true);
    window.setTimeout(() => {
      if (typeof document !== 'undefined' && document.startViewTransition) {
        document.startViewTransition(() => navigate('/'));
      } else {
        navigate('/');
      }
    }, 240);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // El registro requiere aceptar explícitamente los Términos y Condiciones.
    if (esRegistro && !mfa) {
      if (!form.aceptaTerminos) {
        setError('Debes aceptar los Términos y Condiciones para crear tu cuenta.');
        return;
      }
      const pass = String(form.password || '');
      if (pass.length < 12) {
        setError('La contraseña debe tener al menos 12 caracteres.');
        return;
      }
      if (!/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass)) {
        setError('La contraseña debe incluir mayúsculas, minúsculas y al menos un número o carácter especial.');
        return;
      }
    }
    setCargando(true);
    try {
      let datosSesion;
      if (mfa) {
        datosSesion = await completarMfa({ ...(mfa.mfaToken ? { mfaToken: mfa.mfaToken } : {}), [usarRecuperacion ? 'backupCode' : 'totpCode']: codigoMfa.trim() });
      } else if (esRegistro) {
        const datosRegistro = {
          nombre: String(form.nombre || '').trim(),
          email: String(form.email || '').trim().toLowerCase(),
          password: form.password,
          aceptaTerminos: Boolean(form.aceptaTerminos),
        };
        const fincaLimpia = String(form.nombreFinca || '').trim();
        if (fincaLimpia) {
          datosRegistro.nombreFinca = fincaLimpia;
        }
        if (form.telefono) {
          const digits = String(form.telefono).replace(/\D/g, '');
          if (digits) {
            if (digits.length === 8) {
              datosRegistro.telefono = `+506${digits}`;
            } else if (digits.startsWith('506') && digits.length === 11) {
              datosRegistro.telefono = `+${digits}`;
            } else if (!String(form.telefono).trim().startsWith('+')) {
              datosRegistro.telefono = `+506${digits}`;
            } else {
              datosRegistro.telefono = String(form.telefono).trim();
            }
          }
        }
        const cedulaLimpia = String(form.cedula || '').replace(/[-\s]/g, '').trim();
        if (cedulaLimpia) {
          datosRegistro.cedula = cedulaLimpia;
        }
        datosSesion = await registro(datosRegistro);
      } else {
        datosSesion = await login(String(form.email || '').trim(), form.password);
      }

      if (datosSesion?.mfaRequired) { setMfa(datosSesion); return; }

      // Variable y condición: Si ingresa como administrador o el correo electrónico es de administrador,
      // se redirige al panel de administración (/admin) y NO al dashboard de usuario (/dashboard).
      const esAdmin = esAdministrador(datosSesion, form.email);
      if (esAdmin) {
        navigate('/admin', { replace: true });
      } else if (location.state?.plan === 'pro') {
        navigate('/planes', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(extraerMensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      {fondoLogin && (
        <video className="login-bg-video" autoPlay muted loop playsInline>
          <source src={fondoLogin} type="video/webm" />
        </video>
      )}
      <div className="login-bg-overlay" aria-hidden="true" />

      <Card
        className={`login-card login-card-enter p-8 sm:p-10 border-slate-800/90 bg-slate-900/85 backdrop-blur-xl shadow-2xl max-w-md w-full ${
          animandoCambio ? 'login-card--morphing' : ''
        } ${saliendoInicio ? 'login-card--saliendo' : ''}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="login-volver text-slate-400 hover:text-white mb-3 -ml-2 self-start gap-1.5"
          onClick={handleVolverInicio}
          aria-label="Volver a la página principal"
        >
          <ArrowLeft size={16} />
          <span>Volver al inicio</span>
        </Button>

        <LoginHeader esRegistro={esRegistro} />

        {/* Selector segmentado animado: Iniciar Sesión ↔ Registrar Gratis */}
        {!mfa && (
          <div
            className="login-mode-tabs mb-5"
            role="tablist"
            aria-label="Seleccionar entre iniciar sesión o registrarse"
          >
            <span
              className="login-mode-pill"
              style={{
                transform: esRegistro ? 'translateX(100%)' : 'translateX(0%)',
              }}
              aria-hidden="true"
            />
            <button
              type="button"
              role="tab"
              aria-selected={!esRegistro}
              onClick={() => cambiarModo(false)}
              disabled={cargando}
              className={`login-mode-tab ${!esRegistro ? 'login-mode-tab--active' : ''}`}
            >
              <LogIn size={14} />
              <span>Iniciar sesión</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={esRegistro}
              onClick={() => cambiarModo(true)}
              disabled={cargando}
              className={`login-mode-tab ${esRegistro ? 'login-mode-tab--active' : ''}`}
            >
              <UserPlus size={14} />
              <span>Registrar gratis</span>
            </button>
          </div>
        )}

        {mfa ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-left login-mode-fade">
            <div className="space-y-1.5">
              <label htmlFor="codigo-mfa" className="text-xs font-medium text-slate-300 block">
                {usarRecuperacion ? 'Código de recuperación' : 'Código de autenticación'}
              </label>
              <input
                id="codigo-mfa"
                autoComplete="one-time-code"
                inputMode={usarRecuperacion ? 'text' : 'numeric'}
                placeholder={usarRecuperacion ? 'XXXX-XXXX' : '000000'}
                value={codigoMfa}
                onChange={(e) => setCodigoMfa(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 p-3 text-white text-center tracking-widest font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {error && (
              <p role="alert" className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                {error}
              </p>
            )}
            <Button variant="gradient" size="lg" className="w-full font-semibold" type="submit" disabled={cargando}>
              {cargando ? 'Verificando…' : 'Verificar e ingresar'}
            </Button>
            <div className="flex flex-col gap-2 pt-1 text-center">
              <button
                type="button"
                className="text-xs text-emerald-400 hover:text-emerald-300 underline transition-colors"
                onClick={() => { setUsarRecuperacion((v) => !v); setCodigoMfa(''); setError(''); }}
              >
                Usar {usarRecuperacion ? 'autenticador' : 'código de recuperación'}
              </button>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                onClick={() => { setMfa(null); setCodigoMfa(''); setError(''); }}
              >
                Volver al inicio de sesión
              </button>
            </div>
          </form>
        ) : (
          <LoginForm
            form={form}
            setForm={setForm}
            handleSubmit={handleSubmit}
            error={error}
            cargando={cargando}
            esRegistro={esRegistro}
          />
        )}

        {!mfa && (
          <>
            <div className="login-divider my-5">
              <span>{esRegistro ? '¿Ya tienes una cuenta?' : '¿Nuevo productor en la plataforma?'}</span>
            </div>

            {esRegistro ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="btn-registro-accion w-full gap-2.5 bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200"
                onClick={() => cambiarModo(false)}
                disabled={cargando}
                aria-label="Iniciar sesión con cuenta existente"
              >
                <LogIn size={18} className="text-emerald-400 shrink-0" />
                <span>Iniciar sesión</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="btn-registro-accion w-full gap-2.5 bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-600/50 text-emerald-300 hover:text-emerald-200"
                onClick={() => cambiarModo(true)}
                disabled={cargando}
                aria-label="Registrar gratis"
              >
                <UserPlus size={18} className="text-emerald-400 shrink-0" />
                <span>Registrar gratis</span>
              </Button>
            )}
          </>
        )}

        <div className="login-footer mt-3 text-center text-xs text-slate-400">
          <p key={esRegistro ? 'foot-reg' : 'foot-log'} className="text-slate-400 text-[11px] login-mode-fade">
            {esRegistro
              ? 'Tus datos están protegidos y son de uso exclusivo para tu gestión REA.'
              : 'Acceso inmediato sin tarjeta de crédito. Plan gratuito para pequeños productores.'}
          </p>
        </div>

        {/* Sección Legal Destacada */}
        <div className="login-legal-box mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-400 space-y-2" aria-label="Información legal y normativas">
          <div className="login-legal-text flex items-center gap-1.5 justify-center text-[11px] text-slate-400">
            <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
            <span>
              Al acceder, aceptas los{' '}
              <Link to="/terminos" className="text-slate-300 hover:text-white underline">Términos</Link>,{' '}
              <Link to="/condiciones-servicio" className="text-slate-300 hover:text-white underline">Condiciones</Link> y{' '}
              <Link to="/privacidad" className="text-slate-300 hover:text-white underline">Privacidad</Link>.
            </span>
          </div>

          <div className="login-legal-pills flex items-center justify-center gap-2 pt-1">
            <Link to="/terminos" className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-200 bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-700/60" title="Ver Términos y Condiciones">
              <Scale size={11} />
              <span>Términos</span>
            </Link>
            <Link to="/condiciones-servicio" className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-200 bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-700/60" title="Ver Condiciones del Servicio">
              <FileText size={11} />
              <span>Condiciones</span>
            </Link>
            <Link to="/privacidad" className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-200 bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-700/60" title="Ver Política de Privacidad">
              <ShieldCheck size={11} />
              <span>Privacidad</span>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
