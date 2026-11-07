import { useState } from 'react';
import { Mail, Copy, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function EmailStatus() {
  const { usuario } = useAuth();
  const [copiado, setCopiado] = useState(false);
  const alias = usuario?.tenant?.emailAlias;
  const correo = alias ? alias + '@contadorganandero.com' : null;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(correo);
      setCopiado(true);
      toast.success('Correo copiado');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('No se pudo copiar el correo');
    }
  }
  return <section className="mb-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4" aria-label="Buzón de proveedores">
    <div className="flex items-start gap-3">
      <Mail size={22} className="shrink-0 text-blue-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-white">Buzón de proveedores</h2>
        <p className="mt-1 text-sm text-slate-400">Pide a tus proveedores que envíen el XML de la factura a este correo.</p>
        {correo ? <div className="mt-3 flex items-center gap-2">
          <code className="break-all text-sm text-blue-300">{correo}</code>
          <button type="button" onClick={copiar} aria-label="Copiar correo" className="rounded-lg border border-slate-600 p-2 text-slate-200 hover:bg-slate-800">{copiado ? <Check size={16} /> : <Copy size={16} />}</button>
        </div> : <p className="mt-3 text-sm text-amber-300">El correo de recepción aún no está disponible para esta finca.</p>}
      </div>
    </div>
  </section>;
}
