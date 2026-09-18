import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, CreditCard, Tractor, Users, Baby, Heart,
  Landmark, CalendarDays, AtSign, ShieldCheck, Link2, Inbox, KeyRound,
  Pencil, Copy, Check, Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../components/ui/dialog';
import { actualizarPerfilAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import './PerfilPage.css';

const PLAN_NOMBRES = {
  free: 'Gratis',
  pro: 'Pro',
  agro: 'Agro',
};

const ROL_NOMBRES = {
  dueño: 'Dueño',
  contador: 'Contador',
  peon: 'Peón',
};

const ESTADO_LABEL = {
  activo: { texto: 'Activo', clase: 'badge-exito' },
  suspendido: { texto: 'Suspendido', clase: 'badge-error' },
  periodo_gracia: { texto: 'Período de gracia', clase: 'badge-advertencia' },
  cancelado: { texto: 'Cancelado', clase: 'badge-error' },
};

function formatFecha(fecha) {
  if (!fecha) return '—';
  try {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return String(fecha);
  }
}

function formatCedula(cedula) {
  if (!cedula?.numero) return '—';
  const tipo = cedula.tipo === 'juridica' ? 'Jurídica' : 'Física';
  return `${tipo} · ${cedula.numero}`;
}

function Dato({ icon: Icon, label, children }) {
  return (
    <div className="perfil-dato">
      <span className="perfil-dato-icon"><Icon size={16} /></span>
      <div className="perfil-dato-textos">
        <span className="perfil-dato-label">{label}</span>
        <span className="perfil-dato-valor">{children || '—'}</span>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  const { usuario, actualizarUsuario } = useAuth();
  const navigate = useNavigate();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    nombreFinca: '',
    telefono: '',
    cedulaTipo: 'fisica',
    cedulaNumero: '',
  });

  if (!usuario) {
    return <div className="page-content"><div className="loader-center"><div className="loader" /></div></div>;
  }

  const tenant = usuario.tenant || {};
  const fiscal = usuario.configuracionFiscal || {};
  const plan = tenant.plan || usuario.plan || 'free';
  const estadoTenant = tenant.estado || usuario.estadoTenant || 'activo';
  const estadoInfo = ESTADO_LABEL[estadoTenant] || { texto: estadoTenant, clase: 'badge-advertencia' };
  const nombreFinca = usuario.nombreFinca || tenant.nombreFinca;
  const inicial = (usuario.nombre || 'U').charAt(0).toUpperCase();

  const suffix = usuario?._id ? String(usuario._id).slice(-4) : 'finca';
  const aliasCorreo = tenant.emailAlias || (nombreFinca ? `${nombreFinca.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${suffix}` : `finca-${suffix}`);
  const correoRecepcion = `${aliasCorreo}@contadorganandero.com`;

  const abrirModalEdicion = () => {
    setForm({
      nombre: usuario.nombre || '',
      nombreFinca: nombreFinca || '',
      telefono: usuario.telefono ? String(usuario.telefono).replace(/^\+506/, '').replace(/\D/g, '') : '',
      cedulaTipo: usuario.cedula?.tipo || 'fisica',
      cedulaNumero: usuario.cedula?.numero || '',
    });
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await actualizarPerfilAPI({
        nombre: form.nombre,
        nombreFinca: form.nombreFinca,
        telefono: form.telefono ? `+506${form.telefono.replace(/\D/g, '')}` : undefined,
        cedula: {
          tipo: form.cedulaTipo,
          numero: form.cedulaNumero.replace(/[-\s]/g, ''),
        },
      });

      actualizarUsuario(res.data);
      toast.success('Perfil y cédula actualizados con éxito');
      setModalAbierto(false);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-2xl font-bold text-white">Mi Perfil</h1>
          <p className="page-subtitle text-slate-400 text-sm">Información de tu cuenta, finca y datos fiscales</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={abrirModalEdicion}
          className="gap-2 border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 self-start sm:self-auto"
        >
          <Pencil size={15} />
          <span>Editar Datos y Cédula</span>
        </Button>
      </div>

      {/* Encabezado con identidad del usuario */}
      <section className="glass-card perfil-identidad">
        <Avatar className="perfil-avatar">
          <AvatarFallback className="perfil-avatar-fallback">{inicial}</AvatarFallback>
        </Avatar>
        <div className="perfil-identidad-info">
          <h2 className="perfil-nombre">{usuario.nombre || 'Usuario'}</h2>
          <span className="perfil-email">{usuario.email}</span>
          <div className="perfil-chips">
            <span className="badge badge-primario">{ROL_NOMBRES[usuario.rol] || usuario.rol || 'Dueño'}</span>
            <span className="badge badge-secundario">Plan {PLAN_NOMBRES[plan] || plan}</span>
            <span className={`badge ${estadoInfo.clase}`}>{estadoInfo.texto}</span>
          </div>
        </div>
      </section>

      <div className="perfil-grid">
        {/* Datos personales */}
        <section className="glass-card perfil-section">
          <div className="perfil-section-head">
            <User size={18} />
            <h3>Datos personales</h3>
          </div>
          <div className="perfil-datos">
            <Dato icon={User} label="Nombre completo">{usuario.nombre}</Dato>
            <Dato icon={Mail} label="Correo electrónico">{usuario.email}</Dato>
            <Dato icon={Phone} label="Teléfono">{usuario.telefono}</Dato>
            <Dato icon={CreditCard} label="Cédula">{formatCedula(usuario.cedula)}</Dato>
          </div>
        </section>

        {/* Finca / organización */}
        <section className="glass-card perfil-section">
          <div className="perfil-section-head">
            <Tractor size={18} />
            <h3>Finca / Organización</h3>
          </div>
          <div className="perfil-datos">
            <Dato icon={Tractor} label="Nombre de la finca">{nombreFinca}</Dato>
            <Dato icon={AtSign} label="Alias de correo para facturas">
              <div className="flex items-center gap-2">
                <code className="text-xs text-blue-300 font-mono select-all">
                  {correoRecepcion}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(correoRecepcion);
                    setCopiado(true);
                    toast.success('Correo copiado');
                    setTimeout(() => setCopiado(false), 2000);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                  title="Copiar correo"
                >
                  {copiado ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </Dato>
            <Dato icon={CalendarDays} label="Miembro desde">{formatFecha(usuario.createdAt)}</Dato>
          </div>
        </section>

        {/* Datos fiscales */}
        <section className="glass-card perfil-section">
          <div className="perfil-section-head">
            <Landmark size={18} />
            <h3>Datos fiscales</h3>
          </div>
          <div className="perfil-datos">
            <Dato icon={Landmark} label="Régimen tributario">{fiscal.regimenTributario}</Dato>
            <Dato icon={CalendarDays} label="Frecuencia de IVA">
              {fiscal.frecuenciaIVA ? fiscal.frecuenciaIVA.charAt(0).toUpperCase() + fiscal.frecuenciaIVA.slice(1) : null}
            </Dato>
            <Dato icon={CreditCard} label="Actividad económica">{fiscal.actividadEconomica}</Dato>
            <Dato icon={Baby} label="Hijos a cargo">{String(usuario.cantidadHijos ?? 0)}</Dato>
            <Dato icon={Heart} label="Cónyuge">{usuario.tieneConyuge ? 'Sí' : 'No'}</Dato>
          </div>
        </section>

        {/* Cuenta y seguridad */}
        <section className="glass-card perfil-section">
          <div className="perfil-section-head">
            <ShieldCheck size={18} />
            <h3>Cuenta y conexiones</h3>
          </div>
          <div className="perfil-datos">
            <Dato icon={KeyRound} label="Contraseña">••••••••</Dato>
            <Dato icon={Link2} label="Cuenta de Google">
              {usuario.googleId ? 'Vinculada' : 'No vinculada'}
            </Dato>
            <Dato icon={Inbox} label="Canales de recepción de facturas">
              Cloudflare Email + WhatsApp (Tiempo real)
            </Dato>
            <Dato icon={Users} label="Rol en la finca">{ROL_NOMBRES[usuario.rol] || usuario.rol}</Dato>
          </div>
        </section>
      </div>

      <section className="glass-card perfil-acciones">
        <button className="btn btn-secondary" onClick={() => navigate('/billing')}>
          Ver mi suscripción
        </button>
      </section>

      {/* Modal de edición de perfil y cédula */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar Datos y Cédula</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Tu cédula y nombre de finca permiten asociar automáticamente las facturas electrónicas emitidas a tu nombre.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardar} className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-slate-300">Nombre completo</Label>
              <Input
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="mt-1 bg-slate-950/60 border-slate-800"
                required
              />
            </div>

            <div>
              <Label className="text-xs text-slate-300">Nombre de la Finca</Label>
              <Input
                value={form.nombreFinca}
                onChange={e => setForm({ ...form, nombreFinca: e.target.value })}
                placeholder="Ej: Finca Las Delicias"
                className="mt-1 bg-slate-950/60 border-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-300">Tipo de Cédula</Label>
                <select
                  value={form.cedulaTipo}
                  onChange={e => setForm({ ...form, cedulaTipo: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-md bg-slate-950/60 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="fisica">Física (9 dígitos)</option>
                  <option value="juridica">Jurídica (10 dígitos)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-slate-300">Número de Cédula</Label>
                <Input
                  value={form.cedulaNumero}
                  onChange={e => setForm({ ...form, cedulaNumero: e.target.value })}
                  placeholder={form.cedulaTipo === 'juridica' ? '3101123456' : '1119600049'}
                  className="mt-1 bg-slate-950/60 border-slate-800 font-mono text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-300">Teléfono móvil (WhatsApp)</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-300 text-xs font-mono select-none">
                  🇨🇷 +506
                </span>
                <Input
                  value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="88887777"
                  className="bg-slate-950/60 border-slate-800 font-mono text-sm"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalAbierto(false)}
                disabled={guardando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="gradient"
                disabled={guardando}
                className="gap-2"
              >
                {guardando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
