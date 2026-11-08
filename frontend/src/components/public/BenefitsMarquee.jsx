import { useState } from 'react';
import { ReceiptText, Sprout, ChartNoAxesCombined, Smartphone, CircleCheck, Pause, Play } from 'lucide-react';
import './BenefitsMarquee.css';

const benefits = [
  [ReceiptText, 'Tus facturas XML, organizadas'],
  [Sprout, 'Bovinos, aves, peces y colmenas'],
  [ChartNoAxesCombined, 'Conocé tus costos de producción'],
  [Smartphone, 'Tu finca desde el celular'],
  [CircleCheck, 'Un plan Gratis para comenzar'],
];

export default function BenefitsMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <section className="cg-marquee-band" aria-label="Lo que te ofrece ContadorGanadero" data-paused={paused}>
      <div className="cg-marquee-viewport">
        <div className="cg-marquee-track">
          {[0, 1].map(copy => (
            <ul className="cg-marquee-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
              {benefits.map(([Icon, text]) => <li key={text}><Icon size={19} aria-hidden="true" /><span>{text}</span><span className="cg-marquee-dot" aria-hidden="true">·</span></li>)}
            </ul>
          ))}
        </div>
      </div>
      <button type="button" className="cg-marquee-toggle" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Reanudar cinta de funciones' : 'Pausar cinta de funciones'} aria-pressed={paused}>
        {paused ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}
      </button>
    </section>
  );
}
