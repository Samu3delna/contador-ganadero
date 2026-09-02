import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginForm({ form, setForm, handleSubmit, error, cargando, esRegistro }) {
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
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          required
          minLength={6}
        />
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
