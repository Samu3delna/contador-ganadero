import { Check, X, Crown, Sparkles, Eye, Users, HardDrive, Megaphone, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import './PlanCard.css';

export default function PlanCard({ plan, planActual, onSeleccionar }) {
  const esActual = plan.id === planActual;
  const esFree = plan.id === 'free';
  const esDestacado = plan.destacado;

  let textoBoton = 'Suscribirse';
  let botonVariant = esDestacado ? 'gradient' : 'default';
  let deshabilitado = false;

  if (esActual) {
    textoBoton = 'Plan actual';
    botonVariant = 'outline';
    deshabilitado = true;
  } else if (esFree && planActual && planActual !== 'free') {
    textoBoton = 'Downgrade';
    botonVariant = 'secondary';
  } else if (!esFree) {
    textoBoton = planActual && planActual !== 'free' ? 'Hacer upgrade' : 'Suscribirse';
    botonVariant = esDestacado ? 'amber' : 'gradient';
  }

  return (
    <Card
      className={cn(
        'plan-card relative flex flex-col justify-between overflow-visible transition-all duration-300 hover:translate-y-[-4px]',
        esDestacado && 'border-amber-500/50 shadow-xl shadow-amber-950/20 bg-gradient-to-b from-amber-500/5 via-slate-900/80 to-slate-900/90',
        esActual && 'border-emerald-500 shadow-lg shadow-emerald-950/30'
      )}
    >
      {esDestacado && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge variant="amber" className="px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-lg">
            <Crown size={13} className="mr-1 inline text-amber-900" /> Más popular
          </Badge>
        </div>
      )}

      <div>
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-2xl font-bold font-heading">{plan.nombre}</CardTitle>
            {esActual && (
              <Badge variant="default" className="text-xs">
                Activo
              </Badge>
            )}
          </div>
          <CardDescription className="text-slate-400 text-sm mt-1">{plan.descripcion}</CardDescription>
        </CardHeader>

        <CardContent className="p-6 pt-0 space-y-5">
          <div className="flex items-baseline gap-1 font-heading text-white">
            {plan.precio === 0 ? (
              <span className="text-4xl font-extrabold tracking-tight">Gratis</span>
            ) : (
              <>
                <span className="text-2xl font-semibold text-slate-400">$</span>
                <span className="text-4xl font-extrabold tracking-tight">{plan.precio}</span>
                <span className="text-sm font-medium text-slate-400">/ mes</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[11px] gap-1 bg-slate-800/60 border-slate-700">
              <Eye size={11} className="text-emerald-400" /> {plan.limiteConteos} conteos/mes
            </Badge>
            <Badge variant="outline" className="text-[11px] gap-1 bg-slate-800/60 border-slate-700">
              <Users size={11} className="text-sky-400" /> {plan.limiteUsuarios} {plan.limiteUsuarios === 1 ? 'usuario' : 'usuarios'}
            </Badge>
            <Badge variant="outline" className="text-[11px] gap-1 bg-slate-800/60 border-slate-700">
              <HardDrive size={11} className="text-purple-400" /> {plan.almacenamiento}
            </Badge>
            {plan.anuncios ? (
              <Badge variant="amber" className="text-[11px] gap-1">
                <Megaphone size={11} /> Con anuncios
              </Badge>
            ) : (
              <Badge variant="default" className="text-[11px] gap-1">
                <ShieldCheck size={11} /> Sin anuncios
              </Badge>
            )}
            {plan.vlm ? (
              <Badge variant="blue" className="text-[11px] gap-1">
                <Sparkles size={11} /> VLM
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] gap-1 text-slate-500 border-slate-800">
                <X size={11} /> Sin VLM
              </Badge>
            )}
          </div>

          <div className="h-px bg-slate-800/80 my-3" />

          <ul className="space-y-2.5 text-sm text-slate-300">
            {plan.caracteristicas.map((c, i) => (
              <li key={i} className={cn('flex items-start gap-2.5', !c.incluido && 'text-slate-500 line-through opacity-70')}>
                {c.incluido ? (
                  <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <X size={16} className="text-slate-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{c.texto}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </div>

      <CardFooter className="p-6 pt-0">
        <Button
          variant={botonVariant}
          size="lg"
          className="w-full font-semibold shadow-md"
          onClick={() => !deshabilitado && onSeleccionar(plan.id)}
          disabled={deshabilitado}
        >
          {textoBoton}
        </Button>
      </CardFooter>
    </Card>
  );
}
