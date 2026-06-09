import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoginHeader from '../components/login/LoginHeader';
import LoginForm from '../components/login/LoginForm';
import fondoLogin from '../Recursos/fondo_login.webm';
import './LoginPage.css';

export default function LoginPage() {
  const { login, registro } = useAuth();
  const navigate = useNavigate();
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
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      <video className="login-bg-video" autoPlay muted loop playsInline>
        <source src={fondoLogin} type="video/webm" />
      </video>
      <div className="login-card glass-card animate-slide-up">
        <LoginHeader />

        <LoginForm 
          form={form} 
          setForm={setForm} 
          handleSubmit={handleSubmit} 
          error={error} 
          cargando={cargando} 
          esRegistro={esRegistro} 
        />

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
