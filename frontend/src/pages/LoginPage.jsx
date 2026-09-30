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
import fondoLogin from '../assets/videos/fondo_login.webm';
import './LoginPage.css';

export default function LoginPage() {
  const { login, registro, usuario, cargando: authCargando } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Permite abrir directamente en modo registro si viene de enlaces como "Comenzar Gratis" o ruta /registro
  const searchParams = new URLSearchParams(location.search);
  const esModoRegistroInicial = location.state?.registro || searchParams.get('registro') === 'true' || searchParams.get('modo') === 'registro' || location.pathname === '/registro';

  // Si ya hay una sesión activa, redirigir al panel correspondiente
  useEffect(() => {
    if (!authCargando && usuario) {
      const esAdmin = esAdministrador(usuario);
      navigate(esAdmin ? '/admin' : '/dashboard', { replace: true });
    }
  }, [usuario, authCargando, navigate]);

  // La página de login no aporta valor en buscadores: se no-indexa.
  useSeo({
    title: 'Iniciar sesión | ContadorGanadero',
    description: 'Accede a tu cuenta de ContadorGanadero para gestionar la contabilidad de tu finca.',
    path: '/login',
    robots: 'noindex, follow',
  });
  const [esRegistro, setEsRegistro] = useState(Boolean(esModoRegistroInicial));
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', nombreFinca: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      let datosSesion;
      if (esRegistro) {
        let datosRegistro = { ...form };
        if (datosRegistro.telefono) {
          const digits = datosRegistro.telefono.replace(/\D/g, '');
          if (digits.length === 8) {
            datosRegistro.telefono = `+506${digits}`;
          } else if (digits.startsWith('506') && digits.length === 11) {
            datosRegistro.telefono = `+${digits}`;
          } else if (!datosRegistro.telefono.startsWith('+')) {
            datosRegistro.telefono = `+506${digits}`;
          }
        }
        datosSesion = await registro(datosRegistro);
      } else {
        datosSesion = await login(form.email, form.password);
      }

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
      setError(err.response?.data?.error || err.response?.data?.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      <video className="login-bg-video" autoPlay muted loop playsInline>
        <source src={fondoLogin} type="video/webm" />
      </video>
      <Card className="login-card p-8 sm:p-10 border-slate-800/90 bg-slate-900/85 backdrop-blur-xl shadow-2xl animate-slide-up max-w-md w-full">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="login-volver text-slate-400 hover:text-white mb-3 -ml-2 self-start gap-1.5"
          onClick={() => navigate('/')}
          aria-label="Volver a la página principal"
        >
          <ArrowLeft size={16} />
          <span>Volver al inicio</span>
        </Button>

        <LoginHeader esRegistro={esRegistro} />

        <LoginForm 
          form={form} 
          setForm={setForm} 
          handleSubmit={handleSubmit} 
          error={error} 
          cargando={cargando} 
          esRegistro={esRegistro}
        />

        <div className="login-divider my-5">
          <span>{esRegistro ? '¿Ya tienes una cuenta?' : '¿Nuevo productor en la plataforma?'}</span>
        </div>

        {esRegistro ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="btn-registro-accion w-full gap-2.5 bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200"
            onClick={() => {
              setEsRegistro(false);
              setError('');
            }}
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
            onClick={() => {
              setEsRegistro(true);
              setError('');
            }}
            disabled={cargando}
            aria-label="Registrar gratis"
          >
            <UserPlus size={18} className="text-emerald-400 shrink-0" />
            <span>Registrar gratis</span>
          </Button>
        )}

        <div className="login-footer mt-3 text-center text-xs text-slate-400">
          <p className="text-slate-400 text-[11px]">
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
