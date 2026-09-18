import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, CreditCard, Tractor, Users, Baby, Heart,
  Landmark, CalendarDays, AtSign, ShieldCheck, Link2, Inbox, KeyRound,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
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
  const { usuario } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p className="page-subtitle">Información de tu cuenta, finca y datos fiscales</p>
        </div>
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
              {tenant.emailAlias ? `${tenant.emailAlias}@contadorganandero.com` : null}
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
            <Dato icon={Inbox} label="Correo IMAP configurado">
              {usuario.configEmail?.host ? `Sí (${usuario.configEmail.host})` : 'No configurado'}
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
    </div>
  );
}
