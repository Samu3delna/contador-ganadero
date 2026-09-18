import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginForm({ form, setForm, handleSubmit, error, cargando, esRegistro }) {
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <form onSubmit={handleSubmit} className="login-form space-y-4">
      {esRegistro && (
        <>
          <div className="space-y-1.5 text-left">
            <Label htmlFor="nombre" className="text-xs text-slate-300">Nombre completo</Label>
            <Input
              id="nombre"
              name="nombre"
              placeholder="Juan Pérez"
              value={form.nombre}
              onChange={handleChange}
              required
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
              />
            </div>
          </div>
        </>
      )}
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
            minLength={6}
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

      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <Button
        variant="gradient"
        size="lg"
        className="w-full text-sm font-semibold shadow-lg shadow-emerald-950/50 mt-2"
        type="submit"
        disabled={cargando}
      >
        {cargando ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" /> Procesando...
          </>
        ) : esRegistro ? (
          'Crear Cuenta'
        ) : (
          'Iniciar Sesión'
        )}
      </Button>
    </form>
  );
}
