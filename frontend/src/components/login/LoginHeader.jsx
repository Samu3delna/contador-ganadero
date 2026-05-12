import { Tractor } from 'lucide-react';

export default function LoginHeader() {
  return (
    <div className="login-header">
      <span className="login-logo"><Tractor size={48} color="var(--color-primario-claro)" /></span>
      <h1 className="login-title">ContadorGanadero</h1>
      <p className="login-subtitle">Régimen Especial Agropecuario</p>
    </div>
  );
}
