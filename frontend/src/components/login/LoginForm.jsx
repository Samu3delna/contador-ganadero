import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { AlertCircle, Loader2, Eye, EyeOff, Check, LogIn, UserPlus } from 'lucide-react';

export default function LoginForm({ form, setForm, handleSubmit, error, cargando, esRegistro }) {
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const handleChange = (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: valor });
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {/* Acordeón animado para los campos exclusivos de Registro */}
      <div
        className={`login-collapse-grid ${esRegistro ? 'login-collapse-grid--open' : ''}`}
        aria-hidden={!esRegistro}
      >
        <div className="login-collapse-inner space-y-3.5">
          <div className="space-y-1.5 text-left">
            <Label htmlFor="nombre" className="text-xs text-slate-300">Nombre completo</Label>
            <Input
              id="nombre"
              name="nombre"
              placeholder="Juan Pérez"
              value={form.nombre}
              onChange={handleChange}
              required={esRegistro}
              disabled={!esRegistro}
              tabIndex={esRegistro ? 0 : -1}
            />
          </div>
          <div className="space-y-1.5 text-left">
            <Label htmlFor="nombreFinca" className="text-xs text-slate-300">Nombre de la finca (opcional)</Label>
            <Input
              id="nombreFinca"
              name="nombreFinca"
              placeholder="Hacienda La Esmeralda"
              value={form.nombreFinca}
              onChange={handleChange}
              disabled={!esRegistro}
              tabIndex={esRegistro ? 0 : -1}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="telefono" className="text-xs text-slate-300">WhatsApp / Celular (opcional)</Label>
              <div className="flex rounded-lg overflow-hidden border border-slate-700/80 bg-slate-900/90 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                <span className="inline-flex items-center px-2.5 bg-slate-800/90 text-slate-300 text-xs font-semibold border-r border-slate-700/80 select-none">
                  🇨🇷 +506
                </span>
                <Input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  placeholder="8888-8888"
                  value={form.telefono || ''}
                  onChange={handleChange}
                  disabled={!esRegistro}
                  tabIndex={esRegistro ? 0 : -1}
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-slate-500 text-sm h-9 rounded-none"
                />
              </div>
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="cedula" className="text-xs text-slate-300">Cédula física o jurídica</Label>
              <Input
                id="cedula"
                name="cedula"
                placeholder="109990888"
                value={form.cedula || ''}
                onChange={handleChange}
                disabled={!esRegistro}
                tabIndex={esRegistro ? 0 : -1}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-left">
        <Label htmlFor="email" className="text-xs text-slate-300">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="productor@finca.cr"
          value={form.email}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-1.5 text-left">
        <Label htmlFor="password" className="text-xs text-slate-300">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={mostrarPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            required
            minLength={esRegistro ? 12 : 6}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setMostrarPassword(!mostrarPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {mostrarPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      {/* Acordeón animado para aceptación de términos en Registro */}
      <div
        className={`login-collapse-grid ${esRegistro ? 'login-collapse-grid--open' : ''}`}
        aria-hidden={!esRegistro}
      >
        <div className="login-collapse-inner">
          <div className="text-left pt-1">
            <div className="rounded-lg bg-slate-800/40 border border-slate-700/60 p-3">
              <label htmlFor="aceptaTerminos" className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  id="aceptaTerminos"
                  name="aceptaTerminos"
                  type="checkbox"
                  checked={Boolean(form.aceptaTerminos)}
                  onChange={handleChange}
                  required={esRegistro}
                  disabled={!esRegistro}
                  tabIndex={esRegistro ? 0 : -1}
                  aria-required={esRegistro ? 'true' : 'false'}
                  className="peer sr-only"
                />
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-900/80 transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-slate-900">
                  <Check size={12} strokeWidth={3.5} className="text-slate-950 opacity-0 transition-opacity" />
                </span>
                <span className="text-xs text-slate-300 leading-relaxed">
                  He leído y acepto los{' '}
                  <Link to="/terminos" className="text-emerald-400 hover:text-emerald-300 underline" target="_blank" rel="noopener noreferrer">Términos y Condiciones</Link>, las{' '}
                  <Link to="/condiciones-servicio" className="text-emerald-400 hover:text-emerald-300 underline" target="_blank" rel="noopener noreferrer">Condiciones del Servicio</Link> y la{' '}
                  <Link to="/privacidad" className="text-emerald-400 hover:text-emerald-300 underline" target="_blank" rel="noopener noreferrer">Política de Privacidad</Link>.
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 login-mode-fade">
          <AlertCircle size={15} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <Button
        variant="gradient"
        size="lg"
        className="w-full text-sm font-semibold shadow-lg shadow-emerald-950/50 mt-2 transition-all duration-300"
        type="submit"
        disabled={cargando}
      >
        {cargando ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" /> Procesando...
          </>
        ) : (
          <span key={esRegistro ? 'btn-reg' : 'btn-log'} className="inline-flex items-center gap-2 login-mode-fade">
            {esRegistro ? <UserPlus size={16} /> : <LogIn size={16} />}
            {esRegistro ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </span>
        )}
      </Button>
    </form>
  );
}
