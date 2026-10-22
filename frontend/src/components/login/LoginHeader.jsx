import { Tractor, Sparkles } from 'lucide-react';

export default function LoginHeader({ esRegistro = false }) {
  return (
    <div className="login-header">
      <span className={`login-logo ${esRegistro ? 'login-logo--registro' : ''}`}>
        <Tractor
          size={44}
          color="var(--color-primario-claro)"
          className="transition-transform duration-500 ease-out"
        />
      </span>
      <h1 className="login-title">ContadorGanadero</h1>
      <p key={esRegistro ? 'sub-registro' : 'sub-login'} className="login-subtitle login-mode-fade">
        {esRegistro ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <Sparkles size={13} className="text-emerald-400" />
            Registro de Productor Agropecuario (REA)
          </span>
        ) : (
          'Régimen Especial Agropecuario'
        )}
      </p>
    </div>
  );
}
