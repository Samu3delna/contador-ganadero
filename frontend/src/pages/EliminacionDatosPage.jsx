import { Link } from 'react-router-dom';

export default function EliminacionDatosPage() {
  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Eliminación de cuenta y datos</h1>
          <p className="page-subtitle">Gestiona la eliminación de tu cuenta de ContadorGanadero.</p>
        </div>
      </div>
      <section className="glass-card" style={{ padding: '2rem', maxWidth: '48rem' }}>
        <h2>Cómo solicitar la eliminación</h2>
        <p>Inicia sesión, abre <strong>Mi perfil</strong> y selecciona <strong>Eliminar mi cuenta y datos</strong>. La aplicación te mostrará una confirmación antes de completar la solicitud.</p>
        <p>Al finalizar recibirás un código de confirmación. Guarda ese código como constancia del proceso.</p>
        <Link className="btn btn-primary" to="/login">Iniciar sesión</Link>
      </section>
    </main>
  );
}
