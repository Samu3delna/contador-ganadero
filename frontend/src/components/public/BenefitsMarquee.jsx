import { ReceiptText, Sprout, ChartNoAxesCombined, Smartphone, CircleCheck } from 'lucide-react';
import './BenefitsMarquee.css';

const benefits = [
  [ReceiptText, 'Tus facturas XML, organizadas'],
  [Sprout, 'Bovinos, aves, peces y colmenas'],
  [CircleCheck, 'Menos información dispersa, más orden'],
  [ChartNoAxesCombined, 'Conocé tus costos de producción'],
  [Smartphone, 'Tu finca desde el celular'],
  [Sprout, 'Más tiempo para tu finca'],
  [ChartNoAxesCombined, 'Tus números, mejores decisiones'],
  [CircleCheck, 'Un plan Gratis para comenzar'],
];

export default function BenefitsMarquee() {
  return (
    <section className="cg-marquee-band" aria-label="Lo que te ofrece ContadorGanadero">
      <div className="cg-marquee-viewport">
        <div className="cg-marquee-track">
          {[0, 1].map(copy => (
            <ul className="cg-marquee-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
              {benefits.map(([Icon, text]) => <li key={text}><Icon size={19} aria-hidden="true" /><span>{text}</span><span className="cg-marquee-dot" aria-hidden="true">·</span></li>)}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
