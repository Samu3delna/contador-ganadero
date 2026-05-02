import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tractor } from 'lucide-react';
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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="login-container">
      <div className="login-card glass-card animate-slide-up">
        <div className="login-header">
          <span className="login-logo"><Tractor size={48} color="var(--color-primario-claro)" /></span>
          <h1 className="login-title">ContadorGanadero</h1>
          <p className="login-subtitle">Régimen Especial Agropecuario</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {esRegistro && (
            <>
              <input className="input" name="nombre" placeholder="Nombre completo"
                value={form.nombre} onChange={handleChange} required />
              <input className="input" name="nombreFinca" placeholder="Nombre de la finca (opcional)"
                value={form.nombreFinca} onChange={handleChange} />
            </>
          )}
          <input className="input" name="email" type="email" placeholder="Correo electrónico"
            value={form.email} onChange={handleChange} required />
          <input className="input" name="password" type="password" placeholder="Contraseña"
            value={form.password} onChange={handleChange} required minLength={6} />

          {error && <div className="login-error">{error}</div>}

          <button className="btn btn-primary login-btn" type="submit" disabled={cargando}>
            {cargando ? 'Procesando...' : esRegistro ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

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
