import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Scale, FileText } from 'lucide-react';
import LoginHeader from '../components/login/LoginHeader';
import LoginForm from '../components/login/LoginForm';
import useSeo from '../hooks/useSeo';
import fondoLogin from '../assets/videos/fondo_login.webm';
import './LoginPage.css';

export default function LoginPage() {
  const { login, registro } = useAuth();
  const navigate = useNavigate();

  // La página de login no aporta valor en buscadores: se no-indexa.
  useSeo({
    title: 'Iniciar sesión | ContadorGanadero',
    description: 'Accede a tu cuenta de ContadorGanadero para gestionar la contabilidad de tu finca.',
    path: '/login',
    robots: 'noindex, follow',
  });
  const [esRegistro, setEsRegistro] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', nombreFinca: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      if (esRegistro) {
        await registro(form);
      } else {
        await login(form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <div className="login-container">
      <video className="login-bg-video" autoPlay muted loop playsInline>
        <source src={fondoLogin} type="video/webm" />
      </video>
      <div className="login-card glass-card animate-slide-up">
        <button
          type="button"
          className="login-volver"
          onClick={() => navigate('/')}
          aria-label="Volver a la página principal"
        >
          <ArrowLeft size={18} />
          <span>Volver al inicio</span>
        </button>

        <LoginHeader />

        <LoginForm 
          form={form} 
          setForm={setForm} 
          handleSubmit={handleSubmit} 
          error={error} 
          cargando={cargando} 
          esRegistro={esRegistro}
        />

        <div className="login-divider">
          <span>o</span>
        </div>

        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={cargando}
          aria-label="Continuar con Google"
        >
          <svg className="google-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continuar con Google</span>
        </button>

        <div className="login-footer">
          {esRegistro ? (
            <p>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                className="btn-link"
                onClick={() => { setEsRegistro(false); setError(''); }}
              >
                Inicia sesión
              </button>
            </p>
          ) : (
            <p>
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                className="btn-link"
                onClick={() => { setEsRegistro(true); setError(''); }}
              >
                Regístrate gratis
              </button>
            </p>
          )}
        </div>

        {/* Sección Legal Destacada y Responsiva */}
        <div className="login-legal-box" aria-label="Información legal y normativas">
          <div className="login-legal-text">
            <ShieldCheck size={14} className="login-legal-icon" />
            <span>
              Al acceder o registrarte, aceptas nuestros{' '}
              <Link to="/terminos" className="login-legal-link">Términos</Link>,{' '}
              <Link to="/condiciones-servicio" className="login-legal-link">Condiciones</Link> y{' '}
              <Link to="/privacidad" className="login-legal-link">Privacidad</Link>.
            </span>
          </div>

          <div className="login-legal-pills">
            <Link to="/terminos" className="login-legal-pill" title="Ver Términos y Condiciones">
              <Scale size={12} />
              <span>Términos</span>
            </Link>
            <Link to="/condiciones-servicio" className="login-legal-pill" title="Ver Condiciones del Servicio">
              <FileText size={12} />
              <span>Condiciones</span>
            </Link>
            <Link to="/privacidad" className="login-legal-pill" title="Ver Política de Privacidad">
              <ShieldCheck size={12} />
              <span>Privacidad</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
