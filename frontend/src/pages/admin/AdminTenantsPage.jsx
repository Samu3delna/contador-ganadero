import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import {
  listarTenantsAPI, obtenerTenantAPI,
  cambiarPlanTenantAPI, cambiarEstadoTenantAPI, resetearConsumoTenantAPI,
} from '../../services/adminApi';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../components/ui/dialog';
import './admin.css';

const LIMITE = 15;

const ESTADOS = [
  { id: 'activo', label: 'Activo' },
  { id: 'suspendido', label: 'Suspendido' },
  { id: 'periodo_gracia', label: 'Período de gracia' },
  { id: 'cancelado', label: 'Cancelado' },
];

const MB_A_TEXTO = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`);

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [filtroPlan, setFiltroPlan] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [tenantSel, setTenantSel] = useState(null);

  const paginasTotales = Math.max(1, Math.ceil(total / LIMITE));

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listarTenantsAPI({
        q: busqueda, plan: filtroPlan, estado: filtroEstado, page: pagina, limit: LIMITE,
      });
      setTenants(res.data.tenants);
      setTotal(res.data.total);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cargar tenants');
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroPlan, filtroEstado, pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirDetalle = async (id) => {
    try {
      const res = await obtenerTenantAPI(id);
      setTenantSel(res.data);
    } catch {
      toast.error('No se pudo cargar el detalle del tenant');
    }
  };

  const accion = async (fn, mensajeOk) => {
    try {
      await fn();
      toast.success(mensajeOk);
      cargar();
      if (tenantSel?.tenant?._id) abrirDetalle(tenantSel.tenant._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operación fallida');
    }
  };

  const cambiarPlan = (t, plan) =>
    accion(() => cambiarPlanTenantAPI(t._id, plan), `Plan cambiado a ${plan === 'pro' ? 'Pro' : 'Gratis'}`);

  const cambiarEstado = (t, estado) =>
    accion(() => cambiarEstadoTenantAPI(t._id, estado), `Estado cambiado a "${estado}"`);

  const resetearConsumo = (t) =>
    accion(() => resetearConsumoTenantAPI(t._id), 'Consumo mensual reseteado');

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tenants & Planes</h1>
          <p className="page-subtitle">Gestión de fincas (tenants), planes de suscripción y consumo.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar por finca o email alias..."
            style={{ paddingLeft: 30 }}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
        </div>
        <select value={filtroPlan} onChange={(e) => { setFiltroPlan(e.target.value); setPagina(1); }}>
          <option value="">Todos los planes</option>
          <option value="free">Gratis</option>
          <option value="pro">Pro</option>
        </select>
        <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </div>

      {cargando ? (
        <div className="loader-center"><div className="loader" /></div>
      ) : (
        <div className="admin-panel" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.85rem', color: '#cbd5e1', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.8rem' }}>Finca</th>
                <th style={{ padding: '0.8rem' }}>Dueño</th>
                <th style={{ padding: '0.8rem' }}>Plan</th>
                <th style={{ padding: '0.8rem' }}>Estado</th>
                <th style={{ padding: '0.8rem' }}>Consumo mes</th>
                <th style={{ padding: '0.8rem' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t._id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>{t.nombreFinca}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.emailAlias || '—'}</div>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    {t.owner ? (
                      <>
                        <div>{t.owner.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.owner.email}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <span className={`admin-badge admin-badge--${t.plan}`}>{t.plan}</span>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <span className={`admin-badge admin-badge--${t.estado}`}>
                      {ESTADOS.find((e) => e.id === t.estado)?.label || t.estado}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                    Conteos: {t.consumoActual?.conteosMes || 0}/{t.limites?.conteosMes ?? '—'}
                    <br />
                    Chat: {(t.consumoActual?.tokensChatMes || 0).toLocaleString('es-CR')} tokens
                  </td>
                  <td style={{ padding: '0.7rem 0.8rem' }}>
                    <div className="admin-acciones">
                      <button className="admin-btn" onClick={() => abrirDetalle(t._id)}>Ver</button>
                      <button
                        className="admin-btn admin-btn--primario"
                        onClick={() => cambiarPlan(t, t.plan === 'pro' ? 'free' : 'pro')}
                      >
                        {t.plan === 'pro' ? 'Bajar a Gratis' : 'Subir a Pro'}
                      </button>
                      {t.estado !== 'suspendido' ? (
                        <button className="admin-btn admin-btn--danger" onClick={() => cambiarEstado(t, 'suspendido')}>
                          Suspender
                        </button>
                      ) : (
                        <button className="admin-btn admin-btn--primario" onClick={() => cambiarEstado(t, 'activo')}>
                          Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No se encontraron tenants.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-paginacion">
        <span>{total} tenant(s) en total — página {pagina} de {paginasTotales}</span>
        <div className="paginacion-botones">
          <button className="admin-btn" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <button className="admin-btn" disabled={pagina >= paginasTotales} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
        </div>
      </div>

      {/* Modal de detalle de tenant */}
      <Dialog open={!!tenantSel} onOpenChange={(open) => { if (!open) setTenantSel(null); }}>
        <DialogContent style={{ maxWidth: 640 }}>
          <DialogHeader>
            <DialogTitle>{tenantSel?.tenant?.nombreFinca}</DialogTitle>
            <DialogDescription>
              Alias de correo: {tenantSel?.tenant?.emailAlias || '—'}
            </DialogDescription>
          </DialogHeader>

          {tenantSel && (
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'grid', gap: '0.9rem' }}>
              <div>
                <strong style={{ color: '#e2e8f0' }}>Suscripción</strong>
                <div style={{ marginTop: 4, color: '#94a3b8' }}>
                  Plan: {tenantSel.tenant.plan} · Estado: {tenantSel.tenant.estado}
                  {tenantSel.tenant.onvoSubscriptionId && <> · ONVO: {tenantSel.tenant.onvoSubscriptionId}</>}
                </div>
                {tenantSel.tenant.periodoRenovacion && (
                  <div style={{ color: '#94a3b8' }}>
                    Renovación: {new Date(tenantSel.tenant.periodoRenovacion).toLocaleDateString('es-CR')}
                  </div>
                )}
              </div>

              <div>
                <strong style={{ color: '#e2e8f0' }}>Límites del plan</strong>
                <div style={{ marginTop: 4, color: '#94a3b8' }}>
                  Conteos IA: {tenantSel.tenant.limites?.conteosMes}/mes · Usuarios: {tenantSel.tenant.limites?.usuariosTenant} · Almacenamiento: {MB_A_TEXTO(tenantSel.tenant.limites?.almacenamientoMB || 0)}
                  <br />
                  Tokens chat: {(tenantSel.tenant.limites?.tokensChatMes || 0).toLocaleString('es-CR')}/mes · VLM: {tenantSel.tenant.limites?.vlmHabilitado ? 'Sí' : 'No'} · D-150: {tenantSel.tenant.limites?.moduloD150 ? 'Sí' : 'No'} · Anuncios: {tenantSel.tenant.limites?.anunciosHabilitados ? 'Sí' : 'No'}
                </div>
              </div>

              <div>
                <strong style={{ color: '#e2e8f0' }}>Consumo actual</strong>
                <div style={{ marginTop: 4, color: '#94a3b8' }}>
                  Conteos: {tenantSel.tenant.consumoActual?.conteosMes || 0} · Tokens chat: {(tenantSel.tenant.consumoActual?.tokensChatMes || 0).toLocaleString('es-CR')} · Almacenamiento: {MB_A_TEXTO(tenantSel.tenant.consumoActual?.almacenamientoUsadoMB || 0)} · Período: {tenantSel.tenant.consumoActual?.periodoActual || '—'}
                </div>
              </div>

              <div>
                <strong style={{ color: '#e2e8f0' }}>Actividad registrada</strong>
                <div style={{ marginTop: 4, color: '#94a3b8' }}>
                  Facturas: {tenantSel.actividad.facturas} · Ingresos: {tenantSel.actividad.ingresos} · Eventos ONVO: {tenantSel.actividad.eventosOnvo}
                </div>
              </div>

              <div>
                <strong style={{ color: '#e2e8f0' }}>Miembros ({tenantSel.tenant.usuarios?.length || 0})</strong>
                <div className="admin-lista-seguimiento" style={{ marginTop: 6 }}>
                  {(tenantSel.tenant.usuarios || []).map((m) => (
                    <div key={m.usuarioId?._id || m.usuarioId} className="admin-item-seguimiento">
                      <div className="item-principal">
                        {m.usuarioId?.nombre || 'Usuario'}
                        <div className="item-meta">{m.usuarioId?.email}</div>
                      </div>
                      <span className="admin-badge admin-badge--free">{m.rol}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-acciones">
                <button
                  className="admin-btn admin-btn--primario"
                  onClick={() => cambiarPlan(tenantSel.tenant, tenantSel.tenant.plan === 'pro' ? 'free' : 'pro')}
                >
                  {tenantSel.tenant.plan === 'pro' ? 'Bajar a Gratis' : 'Subir a Pro'}
                </button>
                {tenantSel.tenant.estado !== 'suspendido' ? (
                  <button className="admin-btn admin-btn--danger" onClick={() => cambiarEstado(tenantSel.tenant, 'suspendido')}>
                    Suspender tenant
                  </button>
                ) : (
                  <button className="admin-btn admin-btn--primario" onClick={() => cambiarEstado(tenantSel.tenant, 'activo')}>
                    Reactivar tenant
                  </button>
                )}
                <button className="admin-btn" onClick={() => resetearConsumo(tenantSel.tenant)}>
                  Resetear consumo
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
