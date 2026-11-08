import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './ScrollLandscape.css';

export default function ScrollLandscape() {
  const root = useRef(null);
  const video = useRef(null);
  useEffect(() => {
    const element = root.current;
    const media = video.current;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let target = 0;
    const seek = () => {
      if (!preference.matches && media.duration && !media.seeking && Math.abs(media.currentTime - target) > 0.08) media.currentTime = target;
    };
    const paint = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, element.offsetHeight - innerHeight)));
      element.style.setProperty('--journey', progress);
      element.querySelectorAll('[data-beat]').forEach((beat, index) => {
        const visibility = Math.max(0, 1 - Math.abs(progress * 2 - index) * 1.8);
        beat.style.opacity = preference.matches ? 1 : visibility;
        beat.style.transform = preference.matches ? 'none' : `translateY(${(1 - visibility) * 35}px)`;
      });
      target = progress * Math.max(0, (media.duration || 0) - 0.05);
      seek();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const configure = () => {
      if (preference.matches) { media.pause(); media.removeAttribute('src'); media.load(); }
      else { media.src = '/videos/fondo-ganadero.webm'; }
      schedule();
    };
    configure();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    preference.addEventListener('change', configure);
    media.addEventListener('loadedmetadata', schedule);
    media.addEventListener('seeked', seek);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      preference.removeEventListener('change', configure);
      media.removeEventListener('loadedmetadata', schedule);
      media.removeEventListener('seeked', seek);
      media.removeAttribute('src'); media.load();
    };
  }, []);
  return <section className="cg-landscape" ref={root} aria-label="Del campo a tus decisiones">
    <div className="cg-landscape-stage">
      <video ref={video} muted playsInline preload="metadata" aria-hidden="true" className="cg-landscape-video" />
      <div className="cg-landscape-light" aria-hidden="true" />
      <div className="cg-landscape-copy">
        <div data-beat><p>ContadorGanadero · Costa Rica</p><h2>Tu esfuerzo en el campo.<br />Tu futuro en tus manos.</h2><p>Deslizá y descubrí una nueva forma de llevar tu finca.</p></div>
        <div data-beat><p>Todo conectado</p><h2>De cada factura.<br />A una visión más clara.</h2><p>Ingresos, gastos e inventario en un mismo lugar.</p></div>
        <div data-beat><p>Más tiempo para producir</p><h2>Conocé tus números.<br />Cultivá lo que sigue.</h2><p>Herramientas pensadas para productores de Costa Rica.</p></div>
      </div>
      <Link className="cg-button cg-landscape-cta" to="/registro">Comenzar gratis ↗</Link>
      <div className="cg-landscape-progress" aria-hidden="true"><span /></div>
    </div>
  </section>;
}
