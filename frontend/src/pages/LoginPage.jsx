import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import LoginHeader from '../components/login/LoginHeader';
import LoginForm from '../components/login/LoginForm';
import useSeo from '../hooks/useSeo';
import fondoLogin from '../Recursos/fondo_login.webm';
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
          <span>o continúa con</span>
        </div>

        <button
          type="button"
          className="btn btn-google"
          onClick={handleGoogleLogin}
          disabled={cargando}
        >
          <Mail size={18} />
          <span>Iniciar sesión con Google</span>
        </button>

        <p className="login-switch">
          {esRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
          <button className="login-switch-btn" onClick={() => { setEsRegistro(!esRegistro); setError(''); }}>
            {esRegistro ? 'Inicia Sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </div>
  );
}
