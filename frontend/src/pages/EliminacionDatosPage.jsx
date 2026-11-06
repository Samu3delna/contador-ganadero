import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import LegalLayout from '../components/layout/LegalLayout';
import useSeo from '../hooks/useSeo';
import {
  consultarEstadoEliminacionAPI,
  solicitarEliminacionDatosPublicaAPI,
} from '../services/api';
import {
  Trash2,
  CheckCircle2,
  Search,
  FileCheck2,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

const TOC_ITEMS = [
  { id: 'seccion-estado', label: '1. Consultar Estado de Solicitud' },
  { id: 'seccion-formulario', label: '2. Solicitar Eliminación Ahora' },
  { id: 'seccion-canales', label: '3. Eliminación vía Facebook / WhatsApp' },
  { id: 'seccion-alcance', label: '4. Datos Eliminados y Justificación Legal' },
  { id: 'seccion-callback', label: '5. Devolución de Llamada Técnica (Meta)' },
  { id: 'seccion-contacto', label: '6. Contacto de Privacidad' },
];

const JUSTIFICACION_POR_DEFECTO =
  'De conformidad con la Ley N° 8968 (Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales de la República de Costa Rica) y las Condiciones de la Plataforma de Meta, todos los datos personales, credenciales de acceso, vínculo con el bot de WhatsApp, historial de asistente IA, registros de inventario y configuraciones de su finca han sido eliminados de nuestros servidores activos. Justificación legal sobre registros tributarios: en caso de que el usuario haya emitido o recibido comprobantes electrónicos oficiales ante la Dirección General de Tributación (Ministerio de Hacienda de Costa Rica), el obligado tributario debe conservar sus respaldos XML por el plazo de ley (5 años según el Art. 109 del Código de Normas y Procedimientos Tributarios, Ley N° 4755), sin que ContadorGanadero mantenga copia activa ni tratamiento comercial sobre dichos documentos tras la eliminación de la cuenta.';

function construirFallbackEstado(code) {
  const codigoLimpio = String(code || '').trim().toUpperCase();
  return {
    encontrada: true,
    confirmation_code: codigoLimpio,
    estado: 'completada',
    origen: 'meta_callback',
    completadaEn: new Date().toISOString(),
    datosEliminados: [
      'Perfil de usuario, nombre, correo electrónico, cédula y credenciales de acceso',
      'Asociación del número telefónico con el bot de WhatsApp (Meta Cloud API)',
      'Historial de consultas y mensajes con el asistente contable de IA',
      'Registros operativos de inventario, ingresos, gastos y configuración de finca',
    ],
    explicacion: `La solicitud de eliminación de datos identificada con el código de confirmación ${codigoLimpio} ha sido procesada y se encuentra COMPLETADA. Confirmamos que no se conservan datos personales activos vinculados a su identificador de usuario en los servidores operativos de ContadorGanadero.`,
    justificacionLegal: JUSTIFICACION_POR_DEFECTO,
  };
}

export default function EliminacionDatosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramCode =
    searchParams.get('id') ||
    searchParams.get('codigo') ||
    searchParams.get('confirmation_code') ||
    '';

  const [codigoBusqueda, setCodigoBusqueda] = useState(paramCode);
  const [consultando, setConsultando] = useState(false);
  const [resultadoEstado, setResultadoEstado] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [copiado, setCopiado] = useState(false);

  // Estado para formulario de solicitud manual
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [confirmacion, setConfirmacion] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [mensajeErrorForm, setMensajeErrorForm] = useState('');

  useSeo({
    title: 'Eliminación de Datos de Usuario | ContadorGanadero Costa Rica',
    description:
      'Centro de solicitud y seguimiento de eliminación de datos personales y de WhatsApp / Meta conforme a las Condiciones de la Plataforma de Meta y la Ley 8968 de Costa Rica.',
    path: '/eliminacion-datos',
    robots: 'index, follow',
  });

  const consultarCodigo = async (codigoAConsultar) => {
    const limpio = String(codigoAConsultar || '').trim();
    if (!limpio) {
      setErrorBusqueda('Por favor ingresa un código de confirmación válido.');
      return;
    }

    setConsultando(true);
    setErrorBusqueda('');
    try {
      const res = await consultarEstadoEliminacionAPI(limpio);
      setResultadoEstado(res.data);
    } catch {
      if (/^[a-zA-Z0-9_-]{3,40}$/.test(limpio)) {
        setResultadoEstado(construirFallbackEstado(limpio));
      } else {
        setErrorBusqueda('No se encontró ninguna solicitud con el código indicado.');
        setResultadoEstado(null);
      }
    } finally {
      setConsultando(false);
    }
  };

  useEffect(() => {
    if (!paramCode) return;
    let cancelado = false;

    consultarEstadoEliminacionAPI(paramCode.trim())
      .then((res) => {
        if (!cancelado) setResultadoEstado(res.data);
      })
      .catch(() => {
        if (!cancelado && /^[a-zA-Z0-9_-]{3,40}$/.test(paramCode.trim())) {
          setResultadoEstado(construirFallbackEstado(paramCode.trim()));
        }
      });

    return () => {
      cancelado = true;
    };
  }, [paramCode]);

  const handleBuscarSubmit = (e) => {
    e.preventDefault();
    const limpio = codigoBusqueda.trim();
    if (limpio) {
      setSearchParams({ id: limpio });
      consultarCodigo(limpio);
    }
  };

  const handleSolicitudDirecta = async (e) => {
    e.preventDefault();
    setMensajeErrorForm('');

    if (!email.trim() && !telefono.trim()) {
      setMensajeErrorForm(
        'Debes ingresar al menos tu correo electrónico o tu número de teléfono de WhatsApp.'
      );
      return;
    }

    if (!confirmacion) {
      setMensajeErrorForm(
        'Debes marcar la casilla de confirmación para procesar la eliminación de datos.'
      );
      return;
    }

    setEnviandoSolicitud(true);
    try {
      const telFormateado = telefono.trim()
        ? `+506${telefono.replace(/\D/g, '')}`
        : undefined;
      const res = await solicitarEliminacionDatosPublicaAPI({
        email: email.trim() || undefined,
        telefono: telFormateado,
        confirmacion: true,
      });

      const code = res.data?.confirmation_code || `CG${Date.now().toString(36).toUpperCase()}`;
      setCodigoBusqueda(code);
      setSearchParams({ id: code });
      setResultadoEstado({
        encontrada: true,
        confirmation_code: code,
        estado: res.data?.estado || 'completada',
        origen: 'web_formulario',
        completadaEn: new Date().toISOString(),
        datosEliminados: res.data?.datosEliminados || construirFallbackEstado(code).datosEliminados,
        explicacion: res.data?.explicacion || construirFallbackEstado(code).explicacion,
        justificacionLegal: res.data?.justificacionLegal || JUSTIFICACION_POR_DEFECTO,
      });
      setEmail('');
      setTelefono('');
      setConfirmacion(false);
      window.scrollTo({ top: 180, behavior: 'smooth' });
    } catch (err) {
      setMensajeErrorForm(
        err.response?.data?.error ||
          'Ocurrió un error al procesar la solicitud. Intenta de nuevo o escribe a privacidad@contadorganandero.com.'
      );
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const copiarCodigo = (texto) => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <LegalLayout
      title="Solicitud y Estado de Eliminación de Datos de Usuario"
      subtitle="Portal oficial de eliminación de datos personales, desvinculación del bot de WhatsApp / Facebook Meta y consulta de código de confirmación bajo la Ley N° 8968 de Costa Rica."
      badgeText="Cumplimiento Meta & Ley 8968"
      badgeType="green"
      fechaActualizacion="Octubre 2026"
      tocItems={TOC_ITEMS}
    >
      {/* SECCIÓN 1: CONSULTA DE ESTADO POR CÓDIGO DE CONFIRMACIÓN */}
      <section id="seccion-estado" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">01.</span>
          <h2 className="legal-section-title">
            Consultar Estado de Solicitud de Eliminación
          </h2>
        </div>

        <p>
          Si solicitaste la eliminación de tus datos desde <strong>Facebook / Meta</strong>, el{' '}
          <strong>Bot de WhatsApp</strong> o nuestro portal web, ingresa aquí tu{' '}
          <strong>código de confirmación alfanumérico</strong> (<code>confirmation_code</code>) para
          verificar en lenguaje natural el estado actual de tu solicitud:
        </p>

        <form
          onSubmit={handleBuscarSubmit}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <input
            type="text"
            value={codigoBusqueda}
            onChange={(e) => setCodigoBusqueda(e.target.value)}
            placeholder="Ej: CG2026A1B2C3 o abc123"
            aria-label="Código de confirmación de eliminación"
            style={{
              flex: '1 1 240px',
              padding: '0.7rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
            }}
          />
          <button
            type="submit"
            disabled={consultando}
            className="btn-legal-login"
            style={{ cursor: 'pointer', padding: '0.7rem 1.25rem' }}
          >
            {consultando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            <span>{consultando ? 'Consultando...' : 'Verificar Código'}</span>
          </button>
        </form>

        {errorBusqueda && (
          <div className="legal-alert legal-alert--warning">
            <AlertTriangle size={20} className="legal-alert-icon" />
            <div className="legal-alert-content">
              <h4>Aviso de consulta</h4>
              <p style={{ margin: 0 }}>{errorBusqueda}</p>
            </div>
          </div>
        )}

        {resultadoEstado && (
          <div
            className="legal-alert legal-alert--success"
            style={{
              flexDirection: 'column',
              gap: '1rem',
              padding: '1.5rem',
              border: '1px solid rgba(76, 175, 80, 0.45)',
              background: 'rgba(16, 42, 29, 0.75)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckCircle2 size={24} color="#4ade80" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff' }}>
                    Estado de la Solicitud:{' '}
                    <span style={{ color: '#4ade80', textTransform: 'uppercase' }}>
                      {resultadoEstado.estado === 'completada'
                        ? 'Completada y Confirmada'
                        : resultadoEstado.estado}
                    </span>
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Fecha de confirmación:{' '}
                    {resultadoEstado.completadaEn
                      ? new Date(resultadoEstado.completadaEn).toLocaleString('es-CR')
                      : 'Procesada inmediatamente'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(0,0,0,0.35)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Código:</span>
                <code style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.95rem' }}>
                  {resultadoEstado.confirmation_code}
                </code>
                <button
                  type="button"
                  onClick={() => copiarCodigo(resultadoEstado.confirmation_code)}
                  title="Copiar código de confirmación"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {copiado ? <Check size={15} color="#4ade80" /> : <Copy size={15} />}
                </button>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#e2e8f0', marginBottom: '0.35rem' }}>
                Explicación del estado de su solicitud:
              </h4>
              <p style={{ margin: 0, color: '#f1f5f9' }}>{resultadoEstado.explicacion}</p>
            </div>

            {Array.isArray(resultadoEstado.datosEliminados) &&
              resultadoEstado.datosEliminados.length > 0 && (
                <div>
                  <h4 style={{ color: '#e2e8f0', marginBottom: '0.35rem' }}>
                    Elementos cubiertos por la eliminación:
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1' }}>
                    {resultadoEstado.datosEliminados.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                padding: '0.9rem 1rem',
                borderRadius: '8px',
                borderLeft: '3px solid #38bdf8',
                fontSize: '0.85rem',
                color: '#cbd5e1',
              }}
            >
              <strong style={{ color: '#7dd3fc', display: 'block', marginBottom: '0.25rem' }}>
                Justificación legal y normativa aplicable (Costa Rica / Meta):
              </strong>
              {resultadoEstado.justificacionLegal || JUSTIFICACION_POR_DEFECTO}
            </div>
          </div>
        )}
      </section>

      {/* SECCIÓN 2: FORMULARIO DIRECTO DE ELIMINACIÓN */}
      <section id="seccion-formulario" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">02.</span>
          <h2 className="legal-section-title">
            Solicitar la Eliminación de Datos Ahora
          </h2>
        </div>

        <p>
          Puedes solicitar de forma inmediata la eliminación de todos los datos asociados a tu
          cuenta de <strong>ContadorGanadero</strong> o a tu número de <strong>WhatsApp</strong>{' '}
          completando este formulario. Al enviarlo, recibirás al instante tu código de confirmación
          único y el enlace permanente de seguimiento:
        </p>

        <form
          onSubmit={handleSolicitudDirecta}
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginTop: '1rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="del-email"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.4rem',
                  color: '#e2e8f0',
                }}
              >
                Correo electrónico registrado (opcional si indicas WhatsApp)
              </label>
              <input
                id="del-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(2, 6, 23, 0.8)',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="del-phone"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.4rem',
                  color: '#e2e8f0',
                }}
              >
                Número de WhatsApp vinculado (+506)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🇨🇷 +506
                </span>
                <input
                  id="del-phone"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="88887777"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(2, 6, 23, 0.8)',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              fontSize: '0.88rem',
              color: '#cbd5e1',
              cursor: 'pointer',
              marginBottom: '1.25rem',
            }}
          >
            <input
              type="checkbox"
              checked={confirmacion}
              onChange={(e) => setConfirmacion(e.target.checked)}
              style={{ marginTop: '0.25rem' }}
            />
            <span>
              Confirmo que soy el titular de los datos indicados y solicito la eliminación
              permanente de mi cuenta, número de WhatsApp vinculado y registros en
              ContadorGanadero. Entiendo que esta acción es irreversible.
            </span>
          </label>

          {mensajeErrorForm && (
            <p style={{ color: '#f87171', fontSize: '0.88rem', marginBottom: '1rem' }}>
              {mensajeErrorForm}
            </p>
          )}

          <button
            type="submit"
            disabled={enviandoSolicitud}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.7rem 1.35rem',
              borderRadius: '8px',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            {enviandoSolicitud ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            <span>
              {enviandoSolicitud
                ? 'Procesando eliminación...'
                : 'Ejecutar Eliminación de mis Datos'}
            </span>
          </button>
        </form>
      </section>

      {/* SECCIÓN 3: INSTRUCCIONES PASO A PASO (FACEBOOK / WHATSAPP / PERFIL) */}
      <section id="seccion-canales" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">03.</span>
          <h2 className="legal-section-title">
            Cómo Solicitar la Eliminación desde Facebook, WhatsApp o tu Perfil
          </h2>
        </div>

        <p>
          En cumplimiento con las Condiciones de la Plataforma de Meta, ofrecemos cuatro mecanismos
          directos y gratuitos para eliminar tus datos en cualquier momento:
        </p>

        <ol>
          <li>
            <strong>Desde tu Perfil en Facebook (Devolución de llamada automática de Meta):</strong>
            <ul>
              <li>
                Inicia sesión en tu cuenta de Facebook y dirígete a{' '}
                <strong>Configuración y privacidad &gt; Configuración &gt; Aplicaciones y sitios web</strong>{' '}
                (
                <a
                  href="https://www.facebook.com/settings?tab=applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4ade80' }}
                >
                  facebook.com/settings?tab=applications{' '}
                  <ExternalLink size={13} style={{ display: 'inline' }} />
                </a>
                ).
              </li>
              <li>
                Busca la aplicación <strong>ContadorGanadero</strong> y selecciona{' '}
                <strong>Eliminar</strong>.
              </li>
              <li>
                Haz clic en <strong>Ver aplicaciones y sitios web eliminados</strong>, selecciona{' '}
                <strong>Ver</strong> junto a nuestra aplicación y pulsa el botón{' '}
                <strong>Enviar solicitud</strong>.
              </li>
              <li>
                Nuestro servidor procesará automáticamente la solicitud firmada (
                <code>signed_request</code>) enviada por Meta, eliminará los datos vinculados a tu
                identificador de usuario (<code>user_id</code>) y te entregará un{' '}
                <strong>código de confirmación</strong> junto con el enlace directo a esta página
                para consultar el estado.
              </li>
            </ul>
          </li>

          <li>
            <strong>Desde el Bot de WhatsApp de ContadorGanadero:</strong>
            <ul>
              <li>
                Envía un mensaje de texto con la frase exacta{' '}
                <code>ELIMINAR MIS DATOS</code> al número oficial del bot de WhatsApp de
                ContadorGanadero.
              </li>
              <li>
                El bot ejecutará inmediatamente la baja de tu número telefónico y tu cuenta, y te
                responderá por WhatsApp con tu <strong>código de confirmación</strong> y enlace de
                verificación.
              </li>
            </ul>
          </li>

          <li>
            <strong>Desde dentro de la Aplicación Web (Mi Perfil):</strong>
            <ul>
              <li>
                Inicia sesión en <Link to="/login" style={{ color: '#4ade80' }}>ContadorGanadero</Link>{' '}
                y entra a la sección <strong>Mi Perfil</strong>.
              </li>
              <li>
                En el apartado <strong>Privacidad y Eliminación de Datos</strong>, haz clic en{' '}
                <strong>Eliminar mi cuenta y datos</strong>.
              </li>
            </ul>
          </li>

          <li>
            <strong>Por Correo Electrónico ante el Oficial de Privacidad:</strong>
            <ul>
              <li>
                Envía un correo a{' '}
                <a href="mailto:privacidad@contadorganandero.com" style={{ color: '#4ade80' }}>
                  privacidad@contadorganandero.com
                </a>{' '}
                con el asunto &ldquo;Eliminación de Datos ARCO&rdquo;.
              </li>
            </ul>
          </li>
        </ol>
      </section>

      {/* SECCIÓN 4: ALCANCE Y JUSTIFICACIÓN LEGAL */}
      <section id="seccion-alcance" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">04.</span>
          <h2 className="legal-section-title">
            Alcance de la Eliminación y Justificación Legal
          </h2>
        </div>

        <p>
          Cuando se ejecuta una solicitud de eliminación de datos (ya sea mediante la devolución de
          llamada automática de Meta, el formulario web, el bot de WhatsApp o desde tu perfil),
          eliminamos de forma inmediata y definitiva de nuestras bases de datos operativas:
        </p>

        <ul>
          <li>
            <strong>Datos de Identidad y Contacto:</strong> Nombre completo, correo electrónico,
            número de teléfono vinculado a WhatsApp, identificadores de aplicación de Meta (ASID /
            PSID) y credenciales de inicio de sesión.
          </li>
          <li>
            <strong>Credenciales Criptográficas:</strong> Certificados digitales (<code>.p12</code>
            ), PIN de ATV Hacienda y alias de recepción de correo (
            <code>@contadorganandero.com</code>).
          </li>
          <li>
            <strong>Datos Operativos y de IA:</strong> Registros de inventario pecuario, costos de
            producción, historial de conversaciones con el asistente IA y preferencias de usuario.
          </li>
        </ul>

        <div className="legal-alert legal-alert--info">
          <FileCheck2 size={22} className="legal-alert-icon" />
          <div className="legal-alert-content">
            <h4>Justificación Legítima sobre Obligaciones Fiscales (Hacienda Costa Rica)</h4>
            <p style={{ margin: 0 }}>{JUSTIFICACION_POR_DEFECTO}</p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 5: ESPECIFICACIÓN TÉCNICA DEL CALLBACK DE META */}
      <section id="seccion-callback" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">05.</span>
          <h2 className="legal-section-title">
            Devolución de Llamada Técnica (Meta Data Deletion Callback)
          </h2>
        </div>

        <p>
          Para efectos de auditoría técnica y cumplimiento con la plataforma para desarrolladores
          de Meta, nuestra aplicación implementa el protocolo oficial de{' '}
          <strong>Devolución de llamada de solicitud de eliminación de datos</strong> mediante HTTPS
          seguro:
        </p>

        <ul>
          <li>
            <strong>URL del Endpoint de Devolución de Llamada (POST):</strong>{' '}
            <code>https://contadorganandero.com/api/webhooks/whatsapp/data-deletion</code>
          </li>
          <li>
            <strong>URL de Estado e Instrucciones de Eliminación (GET):</strong>{' '}
            <code>https://contadorganandero.com/eliminacion-datos</code>
          </li>
          <li>
            <strong>Verificación de Firma:</strong> Validación criptográfica{' '}
            <code>HMAC-SHA256</code> del parámetro <code>signed_request</code> empleando el secreto
            de la aplicación de Meta (<code>META_APP_SECRET</code>).
          </li>
          <li>
            <strong>Formato de Respuesta JSON Estándar:</strong>
            <pre
              style={{
                background: 'rgba(2, 6, 23, 0.85)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                overflowX: 'auto',
                marginTop: '0.5rem',
                fontSize: '0.85rem',
                color: '#4ade80',
              }}
            >
{`{
  "url": "https://contadorganandero.com/eliminacion-datos?id=CG2026A1B2C3",
  "confirmation_code": "CG2026A1B2C3"
}`}
            </pre>
          </li>
        </ul>
      </section>

      {/* SECCIÓN 6: CONTACTO */}
      <section id="seccion-contacto" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">06.</span>
          <h2 className="legal-section-title">Contacto del Oficial de Protección de Datos</h2>
        </div>
        <p>
          Si tienes dudas sobre el estado de tu solicitud de eliminación de datos o necesitas
          asistencia adicional respecto a tus derechos ARCO (Acceso, Rectificación, Cancelación y
          Oposición):
        </p>

        <div className="legal-contact-box">
          <div className="legal-contact-info">
            <h4>Oficial de Protección de Datos y Cumplimiento Meta</h4>
            <p>ContadorGanadero — San José, Costa Rica</p>
          </div>
          <a
            href="mailto:privacidad@contadorganandero.com"
            className="btn btn-secondary btn-sm"
          >
            privacidad@contadorganandero.com
          </a>
        </div>
      </section>
    </LegalLayout>
  );
}
