import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import {
  listarUsuariosAPI, obtenerUsuarioAPI, actualizarUsuarioAPI,
  cambiarSuspensionUsuarioAPI, resetPasswordUsuarioAPI, eliminarUsuarioAPI,
} from '../../services/adminApi';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import './admin.css';

const LIMITE = 15;

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  const [usuarioSel, setUsuarioSel] = useState(null);       // usuario en modal ver/editar
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nombre: '', telefono: '', rol: '' });
  const [passwordTemporal, setPasswordTemporal] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  const paginasTotales = Math.max(1, Math.ceil(total / LIMITE));

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listarUsuariosAPI({ q: busqueda, page: pagina, limit: LIMITE });
      setUsuarios(res.data.usuarios);
      setTotal(res.data.total);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  }, [busqueda, pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirDetalle = async (id) => {
    try {
      const res = await obtenerUsuarioAPI(id);
      setUsuarioSel(res.data);
      setForm({
        nombre: res.data.usuario.nombre || '',
        telefono: res.data.usuario.telefono || '',
        rol: res.data.usuario.rol || 'dueño',
      });
      setEditando(false);
      setPasswordTemporal(null);
    } catch {
      toast.error('No se pudo cargar el detalle del usuario');
    }
  };

  const guardarEdicion = async () => {
    try {
      await actualizarUsuarioAPI(usuarioSel.usuario._id, form);
      toast.success('Usuario actualizado');
      setEditando(false);
      cargar();
      abrirDetalle(usuarioSel.usuario._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar');
    }
  };

  const toggleSuspension = async (usuario) => {
    const accion = usuario.suspendido ? 'reactivar' : 'suspender';
    try {
      await cambiarSuspensionUsuarioAPI(usuario._id, !usuario.suspendido);
      toast.success(`Usuario ${accion === 'suspender' ? 'suspendido' : 'reactivado'}`);
      cargar();
      if (usuarioSel?.usuario?._id === usuario._id) abrirDetalle(usuario._id);
    } catch (err) {
      toast.error(err.response?.data?.message || `Error al ${accion} el usuario`);
    }
  };

  const resetPassword = async (usuario) => {
    try {
      const res = await resetPasswordUsuarioAPI(usuario._id);
      setPasswordTemporal(res.data.passwordTemporal);
      toast.success('Contraseña temporal generada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al resetear la contraseña');
    }
  };

  const eliminar = async () => {
    try {
      await eliminarUsuarioAPI(confirmarEliminar._id);
      toast.success('Usuario eliminado');
      setConfirmarEliminar(null);
      setUsuarioSel(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al eliminar el usuario');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">Gestión global de usuarios registrados en la plataforma.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            style={{ paddingLeft: 30 }}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
        </div>
      </div>

      {cargando ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <div className="admin-panel" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.85rem', color: '#cbd5e1', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.8rem' }}>Usuario</th>
                <th style={{ padding: '0.8rem' }}>Finca / Tenant</th>
                <th style={{ padding: '0.8rem' }}>Plan</th>
                <th style={{ padding: '0.8rem' }}>Rol</th>
                <th style={{ padding: '0.8rem' }}>Estado</th>
                <th style={{ padding: '0.8rem' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u._id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>{u.tenantId?.nombreFinca || '—'}</td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <span className={`admin-badge admin-badge--${u.tenantId?.plan || 'free'}`}>
                      {u.tenantId?.plan || 'free'}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>{u.rol}</td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    {u.suspendido
                      ? <span className="admin-badge admin-badge--suspendido">Suspendido</span>
                      : <span className="admin-badge admin-badge--activo">Activo</span>}
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <div className="admin-acciones">
                      <button className="admin-btn" onClick={() => abrirDetalle(u._id)}>Ver</button>
                      <button
                        className={`admin-btn ${u.suspendido ? 'admin-btn--primario' : 'admin-btn--danger'}`}
                        onClick={() => toggleSuspension(u)}
                      >
                        {u.suspendido ? 'Reactivar' : 'Suspender'}
                      </button>
                      <button className="admin-btn admin-btn--danger" onClick={() => setConfirmarEliminar(u)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No se encontraron usuarios.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-paginacion">
        <span>{total} usuario(s) en total — página {pagina} de {paginasTotales}</span>
        <div className="paginacion-botones">
          <button className="admin-btn" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <button className="admin-btn" disabled={pagina >= paginasTotales} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
        </div>
      </div>

      {/* Modal de detalle / edición */}
      <Dialog open={!!usuarioSel} onOpenChange={(open) => { if (!open) setUsuarioSel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{usuarioSel?.usuario?.nombre}</DialogTitle>
            <DialogDescription>{usuarioSel?.usuario?.email}</DialogDescription>
          </DialogHeader>

          {usuarioSel && (
            <div className="admin-form-grid">
              {editando ? (
                <>
                  <label>
                    Nombre
                    <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  </label>
                  <label>
                    Teléfono
                    <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                  </label>
                  <label>
                    Rol
                    <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                      <option value="dueño">Dueño</option>
                      <option value="contador">Contador</option>
                      <option value="peon">Peón</option>
                    </select>
                  </label>
                </>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'grid', gap: '0.4rem' }}>
                  <div><strong>Teléfono:</strong> {usuarioSel.usuario.telefono || '—'}</div>
                  <div><strong>Rol:</strong> {usuarioSel.usuario.rol}</div>
                  <div><strong>Finca:</strong> {usuarioSel.usuario.tenantId?.nombreFinca || '—'}</div>
                  <div><strong>Plan:</strong> {usuarioSel.usuario.tenantId?.plan || 'free'}</div>
                  <div><strong>Facturas procesadas:</strong> {usuarioSel.actividad.facturas}</div>
                  <div><strong>Ingresos registrados:</strong> {usuarioSel.actividad.ingresos}</div>
                  <div><strong>Registrado:</strong> {new Date(usuarioSel.usuario.createdAt).toLocaleDateString('es-CR')}</div>
                </div>
              )}

              {passwordTemporal && (
                <div>
                  <p className="admin-ok-text" style={{ marginBottom: 4 }}>
                    Nueva contraseña temporal (se muestra una sola vez):
                  </p>
                  <div className="admin-password-temp">{passwordTemporal}</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {editando ? (
              <>
                <button className="admin-btn" onClick={() => setEditando(false)}>Cancelar</button>
                <button className="admin-btn admin-btn--primario" onClick={guardarEdicion}>Guardar</button>
              </>
            ) : (
              <>
                <button className="admin-btn" onClick={() => resetPassword(usuarioSel.usuario)}>Resetear contraseña</button>
                <button className="admin-btn admin-btn--primario" onClick={() => setEditando(true)}>Editar</button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={!!confirmarEliminar} onOpenChange={(open) => { if (!open) setConfirmarEliminar(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar a <strong>{confirmarEliminar?.nombre}</strong> ({confirmarEliminar?.email})?
              Esta acción no se puede deshacer. Si es dueño de un tenant con más miembros, la propiedad se
              transferirá al primero de ellos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className="admin-btn" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
            <button className="admin-btn admin-btn--danger" onClick={eliminar}>Eliminar definitivamente</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
