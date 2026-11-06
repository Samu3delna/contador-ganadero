import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle2, Eye, EyeOff, Check } from 'lucide-react';
import api, { forgotPasswordAPI, resetPasswordAPI } from '../services/api';
import LoginHeader from '../components/login/LoginHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import useSeo from '../hooks/useSeo';
import './LoginPage.css';

function leerTokenInicial() {
  if (typeof window === 'undefined') return '';
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get('token') || searchParams.get('token') || '';
}

export default function RecuperarCuentaPage({ verificar = false }) {
  const [token] = useState(leerTokenInicial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [completado, setCompletado] = useState(false);

  const titulo = verificar ? 'Verificar correo' : token ? 'Restablecer contraseña' : 'Recuperar contraseña';

  useSeo({
    title: `${titulo} | ContadorGanadero`,
    description: 'Recupera el acceso a tu cuenta o verifica tu correo electrónico en ContadorGanadero.',
    path: verificar ? '/verificar-email' : token ? '/restablecer-password' : '/recuperar-password',
    robots: 'noindex, follow',
  });

  const cumpleLongitud = password.length >= 12;
  const cumpleMayusMinus = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const cumpleNumeroOSimbolo = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const submit = async (e) => {
    e.preventDefault();
    if (pendiente) return;
    setPendiente(true);
    setError('');
    setMensaje('');
    try {
      const res = verificar
        ? await api.post('/auth/verify-email', { token })
        : token
          ? await resetPasswordAPI({ token, passwordNueva: password })
          : await forgotPasswordAPI({ email: email.trim().toLowerCase() });
      setMensaje(res.data?.mensaje || 'Solicitud procesada correctamente.');
      setCompletado(true);
      if (token && typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.error || data?.mensaje || data?.message || 'No se pudo completar la solicitud');
    } finally {
      setPendiente(false);
    }
  };

  return (
    <main className="login-container">
      <div className="login-bg-overlay" aria-hidden="true" />
      <Card className="login-card login-card-enter p-8 sm:p-10 border-slate-800/90 bg-slate-900/85 backdrop-blur-xl shadow-2xl max-w-md w-full">
        <LoginHeader esRegistro={false} />
        <h2 className="text-lg font-bold text-white text-center mb-2">{titulo}</h2>
        <p className="text-xs text-slate-400 text-center mb-5">
          {verificar
            ? 'Confirma la titularidad de tu dirección de correo electrónico.'
            : token
              ? 'Define una nueva contraseña segura para tu cuenta agropecuaria.'
              : 'Ingresa tu correo registrado y te enviaremos un enlace de un solo uso.'}
        </p>

        <form onSubmit={submit} className="space-y-4 text-left">
          {!verificar && !completado && (
            token ? (
              <div className="space-y-1.5">
                <Label htmlFor="nueva-password" className="text-xs text-slate-300">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="nueva-password"
                    type={mostrarPassword ? 'text' : 'password'}
                    minLength={12}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {mostrarPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <ul className="pt-1 grid grid-cols-1 sm:grid-cols-3 gap-1 text-[11px] text-slate-400">
                  <li className={`inline-flex items-center gap-1 ${cumpleLongitud ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <Check size={11} className={cumpleLongitud ? 'opacity-100' : 'opacity-40'} />
                    <span>12+ caracteres</span>
                  </li>
                  <li className={`inline-flex items-center gap-1 ${cumpleMayusMinus ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <Check size={11} className={cumpleMayusMinus ? 'opacity-100' : 'opacity-40'} />
                    <span>Mayús. y minús.</span>
                  </li>
                  <li className={`inline-flex items-center gap-1 ${cumpleNumeroOSimbolo ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <Check size={11} className={cumpleNumeroOSimbolo ? 'opacity-100' : 'opacity-40'} />
                    <span>Número o símbolo</span>
                  </li>
                </ul>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="correo-recuperar" className="text-xs text-slate-300">Correo registrado</Label>
                <Input
                  id="correo-recuperar"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="productor@finca.cr"
                />
              </div>
            )
          )}

          {verificar && !token && !completado && (
            <p role="alert" className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-amber-400" />
              <span>El enlace de verificación no contiene un token válido. Solicita uno nuevo desde tu perfil.</span>
            </p>
          )}

          {error && (
            <p role="alert" className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </p>
          )}

          {mensaje && (
            <p role="status" className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{mensaje}</span>
            </p>
          )}

          {!completado && (
            <Button
              variant="gradient"
              size="lg"
              className="w-full font-semibold"
              type="submit"
              disabled={pendiente || (verificar && !token)}
            >
              {pendiente ? 'Procesando…' : verificar ? 'Verificar correo' : token ? 'Guardar contraseña' : 'Solicitar enlace'}
            </Button>
          )}
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Volver a iniciar sesión</span>
          </Link>
        </div>
      </Card>
    </main>
  );
}
