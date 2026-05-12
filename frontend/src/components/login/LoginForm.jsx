export default function LoginForm({ form, setForm, handleSubmit, error, cargando, esRegistro }) {
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {esRegistro && (
        <>
          <input className="input" name="nombre" placeholder="Nombre completo"
            value={form.nombre} onChange={handleChange} required />
          <input className="input" name="nombreFinca" placeholder="Nombre de la finca (opcional)"
            value={form.nombreFinca} onChange={handleChange} />
        </>
      )}
      <input className="input" name="email" type="email" placeholder="Correo electrónico"
        value={form.email} onChange={handleChange} required />
      <input className="input" name="password" type="password" placeholder="Contraseña"
        value={form.password} onChange={handleChange} required minLength={6} />

      {error && <div className="login-error">{error}</div>}

      <button className="btn btn-primary login-btn" type="submit" disabled={cargando}>
        {cargando ? 'Procesando...' : esRegistro ? 'Crear Cuenta' : 'Iniciar Sesión'}
      </button>
    </form>
  );
}
