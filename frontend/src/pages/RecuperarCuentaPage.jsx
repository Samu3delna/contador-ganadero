import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordAPI, resetPasswordAPI } from '../services/api';
export default function RecuperarCuentaPage({ verificar = false }) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendiente, setPendiente] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [completado, setCompletado] = useState(false);
  const submit = async e => {
    e.preventDefault(); if (pendiente) return;
    setPendiente(true); setError(''); setMensaje('');
    try {
      const res = verificar
        ? await (await import('../services/api')).default.post('/auth/verify-email', { token })
        : token ? await resetPasswordAPI({ token, passwordNueva: password }) : await forgotPasswordAPI({ email });
      setMensaje(res.data.mensaje); setCompletado(true);
      if (token) window.history.replaceState({}, '', window.location.pathname);
    } catch (err) { setError(err.response?.data?.error || 'No se pudo completar la solicitud'); }
    finally { setPendiente(false); }
  };
  return <main className="page-content max-w-lg mx-auto p-6"><h1>{verificar ? 'Verificar correo' : token ? 'Restablecer contraseña' : 'Recuperar contraseña'}</h1>
    <form onSubmit={submit} className="space-y-4">
      {!verificar && !completado && (token ? <label>Nueva contraseña<input className="input" type="password" minLength={12} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
        : <label>Correo registrado<input className="input" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>)}
      {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
      {!completado && <button className="btn btn-primary" disabled={pendiente || (verificar && !token)}>{pendiente ? 'Procesando…' : verificar ? 'Verificar correo' : token ? 'Guardar contraseña' : 'Solicitar enlace'}</button>}
    </form><Link to="/login">Volver a iniciar sesión</Link>
  </main>;
}
