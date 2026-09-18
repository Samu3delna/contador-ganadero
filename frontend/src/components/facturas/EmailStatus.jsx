import { useState } from 'react';
import { Mail, MessageSquare, Copy, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function EmailStatus({ estadoEmail }) {
  const { usuario } = useAuth();
  const [copiado, setCopiado] = useState(false);

  // Alias asignado a la finca (ej: "pepe-af2e" o "finca-af2e")
  const suffix = usuario?._id ? String(usuario._id).slice(-4) : 'finca';
  const alias = usuario?.tenant?.emailAlias || (usuario?.nombreFinca ? `${usuario.nombreFinca.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${suffix}` : `finca-${suffix}`);
  const correoRecepcion = `${alias}@contadorganandero.com`;
  const telefonoUsuario = usuario?.telefono;

  const handleCopiarCorreo = () => {
    navigator.clipboard.writeText(correoRecepcion);
    setCopiado(true);
    toast.success('Correo copiado al portapapeles');
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Tarjeta 1: Correo Cloudflare para Facturas */}
      <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Mail size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white">Buzón de Proveedores</span>
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-blue-600 hover:bg-blue-600">
                    Cloudflare
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400">Pide a tus proveedores que envíen las facturas aquí:</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <code className="text-xs text-blue-300 font-mono truncate select-all">{correoRecepcion}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopiarCorreo}
              className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 shrink-0"
              title="Copiar correo"
            >
              {copiado ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta 2: Bot de WhatsApp */}
      <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <MessageSquare size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white">Bot de WhatsApp</span>
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600 hover:bg-emerald-600">
                    Móvil
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400">Reenvía XMLs o fotos de recibos desde tu celular.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
            <span className="text-slate-400 truncate">
              {telefonoUsuario ? (
                <span>Vinculado a: <strong className="text-emerald-400 font-mono">+{telefonoUsuario}</strong></span>
              ) : (
                <span className="text-amber-400">Sin teléfono vinculado</span>
              )}
            </span>
            <a
              href={`https://wa.me/?text=Hola%20ContadorGanadero%2C%20adjunto%20mi%20factura`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>Abrir chat</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
