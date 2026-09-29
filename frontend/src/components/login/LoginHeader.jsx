import { Tractor } from 'lucide-react';

export default function LoginHeader({ esRegistro = false }) {
  return (
    <div className="login-header">
      <span className="login-logo"><Tractor size={48} color="var(--color-primario-claro)" /></span>
      <h1 className="login-title">ContadorGanadero</h1>
      <p className="login-subtitle">
        {esRegistro ? 'Registro de Productor Agropecuario (REA)' : 'Régimen Especial Agropecuario'}
      </p>
    </div>
  );
}
