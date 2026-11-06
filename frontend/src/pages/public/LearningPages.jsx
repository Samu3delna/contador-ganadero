import { Link, useLocation, useParams } from 'react-router-dom';
import { articles, tutorials, updated } from '../../data/learningContent';

export function VideoPlayer({ video, title }) {
  if (!video?.src || !video?.captions) return null;
  return <video controls preload="none" poster={video.poster} aria-label={title} style={{ width: '100%', borderRadius: 16 }}>
    <source src={video.src} type="video/mp4" />
    <track kind="captions" src={video.captions} srcLang="es" label="Español" default />
    Tu navegador no reproduce este video. <a href={video.src}>Descargar video</a>
  </video>;
}

export default function LearningPages() {
  const { pathname } = useLocation();
  const { slug } = useParams();
  const isTutorial = pathname.startsWith('/tutoriales');
  const base = isTutorial ? '/tutoriales' : '/academia';
  const collection = isTutorial ? tutorials : articles;
  const label = isTutorial ? 'Tutoriales' : 'Academia ContadorGanadero';
  const item = slug ? collection.find(entry => entry.slug === slug) : null;
  if (slug && !item) return <section className="cg-section cg-container"><h1>Esta guía no existe</h1><p>Elegí una guía de la biblioteca para continuar.</p><Link className="cg-button" to={base}>Volver a {label}</Link></section>;
  if (!item) return <>
    <header className="cg-hero cg-container"><p className="cg-kicker">Aprender para decidir</p><h1>{label}</h1><p>{isTutorial ? 'Recorridos paso a paso por las pantallas reales. Todas las guías se pueden leer ahora; los videos están pendientes de grabación.' : 'Guías prácticas para ordenar documentos, entender costos y revisar los números de tu actividad agropecuaria.'}</p></header>
    <section className="cg-section cg-container" aria-label="Biblioteca de guías"><div className="cg-grid">{collection.map(entry => <article className="cg-card" key={entry.slug}><p className="cg-kicker">{entry.category}</p><h2><Link to={`${base}/${entry.slug}`}>{entry.title}</Link></h2><p>{entry.intro}</p><p className="cg-note">{isTutorial ? 'Guía escrita · video en preparación' : `${entry.minutes} min de lectura`}</p><Link to={`${base}/${entry.slug}`}>Leer guía</Link></article>)}</div></section>
    <section className="cg-section cg-container"><h2>{isTutorial ? 'Más contexto para tus decisiones' : 'Del concepto a la pantalla'}</h2><p>{isTutorial ? 'Complementá los recorridos con ejemplos de organización y análisis.' : 'Explorá los tutoriales para reconocer los módulos del producto.'}</p><Link className="cg-button-secondary" to={isTutorial ? '/academia' : '/tutoriales'}>{isTutorial ? 'Explorar la academia' : 'Ver tutoriales'}</Link></section>
  </>;
  return <article className="cg-container cg-section">
    <nav aria-label="Migas de pan"><Link to="/">Inicio</Link> / <Link to={base}>{label}</Link> / <span aria-current="page">{item.title}</span></nav>
    <header className="cg-hero"><p className="cg-kicker">{item.category}</p><h1>{item.title}</h1><p>{item.intro}</p><p className="cg-note">Actualizado el <time dateTime={updated}>{new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${updated}T00:00:00Z`))}</time>{isTutorial ? ' · Guía escrita' : ` · ${item.minutes} min de lectura`}</p></header>
    <div className="cg-prose">
      {isTutorial ? <>
        <p className="cg-note">El video está pendiente de grabación. Podés seguir estas instrucciones por escrito. Los ejemplos son sintéticos.</p>
        <VideoPlayer video={item.video} title={item.title} />
        {item.steps.map(([title, text], index) => <section key={title}><h2>{index + 1}. {title}</h2><p>{text}</p></section>)}
        <section><h2>Antes de terminar</h2><p>Comprobá que el resultado coincida con tu documento de origen. Si la pantalla muestra un error, evitá repetir una acción de guardado sin revisar primero el historial. Para practicar, usá únicamente datos que tengas autorización para registrar.</p></section>
      </> : item.sections.map(part => <section key={part.title}><h2>{part.title}</h2>{part.paragraphs.map(p => <p key={p}>{p}</p>)}</section>)}
      {item.sources && <section><h2>Fuentes y revisión</h2><ul>{item.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul><p>Contenido educativo de organización documental. Confirmá la aplicación de la normativa a tu actividad con un profesional.</p></section>}
      <section><h2>Continuá con el producto</h2><p>Conocé el alcance del módulo y explorá ejemplos antes de registrar tus datos.</p><div className="cg-actions"><Link className="cg-button" to={`/producto/${item.product}`}>Explorar {item.product}</Link><Link className="cg-button-secondary" to="/registro">Comenzar gratis</Link></div></section>
      <section><h2>Guías relacionadas</h2><ul>{(isTutorial ? articles.filter(a => a.related === item.slug).slice(0, 3) : tutorials.filter(t => t.slug === item.related)).map(entry => <li key={entry.slug}><Link to={`${isTutorial ? '/academia' : '/tutoriales'}/${entry.slug}`}>{entry.title}</Link></li>)}</ul><Link to={base}>Volver a la biblioteca</Link></section>
    </div>
  </article>;
}
