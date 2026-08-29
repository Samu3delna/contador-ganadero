import LegalLayout from '../components/layout/LegalLayout';
import useSeo from '../hooks/useSeo';
import { AlertCircle, ShieldAlert } from 'lucide-react';

const TOC_ITEMS = [
  { id: 'seccion-1', label: '1. Objeto y Aceptación' },
  { id: 'seccion-2', label: '2. Capacidad y Registro' },
  { id: 'seccion-3', label: '3. Naturaleza de la Plataforma' },
  { id: 'seccion-4', label: '4. Propiedad Intelectual' },
  { id: 'seccion-5', label: '5. Uso Permitido y Prohibiciones' },
  { id: 'seccion-6', label: '6. Limitación de Responsabilidad' },
  { id: 'seccion-7', label: '7. Modificaciones y Vigencia' },
  { id: 'seccion-8', label: '8. Jurisdicción y Ley Aplicable' },
];

export default function TerminosCondicionesPage() {
  useSeo({
    title: 'Términos y Condiciones | ContadorGanadero Costa Rica',
    description: 'Términos y condiciones de uso de la plataforma ContadorGanadero para productores agropecuarios en Costa Rica.',
    path: '/terminos',
    robots: 'index, follow',
  });

  return (
    <LegalLayout
      title="Términos y Condiciones de Uso"
      subtitle="Regulaciones generales y marco contractual para el uso de la plataforma digital ContadorGanadero en la República de Costa Rica."
      badgeText="Términos Generales"
      badgeType="green"
      tocItems={TOC_ITEMS}
    >
      {/* Sección 1 */}
      <section id="seccion-1" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">01.</span>
          <h2 className="legal-section-title">Objeto y Aceptación de los Términos</h2>
        </div>
        <p>
          Bienvenido a <strong>ContadorGanadero</strong> (en adelante, &quot;la Plataforma&quot; o &quot;el Servicio&quot;).
          Los presentes Términos y Condiciones constituyen un contrato legalmente vinculante celebrado entre el usuario
          (persona física o jurídica que administra o representa una explotación agropecuaria) y los operadores de ContadorGanadero.
        </p>
        <p>
          Al acceder, registrarse, navegar o utilizar cualquier función de la plataforma, usted declara haber leído,
          entendido y aceptado sin reservas todas y cada una de las cláusulas contenidas en este documento, así como
          nuestras <strong>Condiciones del Servicio</strong> y nuestra <strong>Política de Privacidad</strong>.
        </p>
        <div className="legal-alert legal-alert--info">
          <AlertCircle size={22} className="legal-alert-icon" />
          <div className="legal-alert-content">
            <h4>Aceptación Obligatoria</h4>
            <p>
              Si no está de acuerdo con cualquiera de estas estipulaciones, debe abstenerse de utilizar el servicio
              y cerrar inmediatamente su cuenta en la plataforma.
            </p>
          </div>
        </div>
      </section>

      {/* Sección 2 */}
      <section id="seccion-2" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">02.</span>
          <h2 className="legal-section-title">Capacidad Legal y Registro de Usuario</h2>
        </div>
        <p>
          Para registrarse y operar en ContadorGanadero, el usuario debe cumplir con los siguientes requisitos mínimos:
        </p>
        <ul>
          <li>Ser mayor de edad según la legislación costarricense (18 años cumplidos) y contar con plena capacidad jurídica de obrar.</li>
          <li>Ser titular, arrendatario o administrador debidamente facultado de una finca o actividad productiva (bovinos, aves, acuicultura, apicultura, café u otros rubros agropecuarios).</li>
          <li>Proporcionar información fidedigna, completa y actualizada durante el registro (nombre, correo electrónico, identificación tributaria y nombre de la explotación).</li>
          <li>Custodiar diligentemente sus credenciales de acceso (contraseñas y llaves de acceso). Toda actividad realizada desde una cuenta autenticada se presumirá realizada por su titular.</li>
        </ul>
      </section>

      {/* Sección 3 */}
      <section id="seccion-3" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">03.</span>
          <h2 className="legal-section-title">Naturaleza del Software y Alcance Tributario</h2>
        </div>
        <p>
          ContadorGanadero es una herramienta tecnológica de <strong>software como servicio (SaaS)</strong> diseñada para facilitar
          la organización contable, el seguimiento de inventarios productivos y la preparación de borradores de declaraciones tributarias
          bajo el Régimen Especial Agropecuario (REA) de Costa Rica (Formularios D-135-1, D-101 y D-150).
        </p>
        <div className="legal-alert legal-alert--warning">
          <ShieldAlert size={22} className="legal-alert-icon" />
          <div className="legal-alert-content">
            <h4>Aviso de Responsabilidad Fiscal</h4>
            <p>
              ContadorGanadero y sus algoritmos de Inteligencia Artificial actúan como asistentes de automatización y cálculo numérico. 
              <strong> La plataforma no sustituye la asesoría profesional de un Contador Público Autorizado (CPA)</strong> ni exime al
              productor de su responsabilidad legal como obligado tributario ante el Ministerio de Hacienda de Costa Rica.
            </p>
          </div>
        </div>
      </section>

      {/* Sección 4 */}
      <section id="seccion-4" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">04.</span>
          <h2 className="legal-section-title">Derechos de Propiedad Intelectual</h2>
        </div>
        <p>
          Todos los elementos que componen la plataforma —incluyendo, sin limitación, el código fuente, código objeto, interfaces de usuario,
          diseño visual, algoritmos de cálculo de costos agropecuarios, marcas comerciales, logotipos, textos, gráficos y software— son
          propiedad exclusiva de ContadorGanadero o de sus respectivos licenciantes.
        </p>
        <p>
          Se otorga al usuario una licencia de uso personal, intransferible, revocable y no exclusiva, estrictamente limitada al uso de las
          funciones contratadas para la gestión interna de sus fincas. Queda expresamente prohibido revender, sublicenciar, realizar ingeniería
          inversa o crear obras derivadas de la plataforma.
        </p>
      </section>

      {/* Sección 5 */}
      <section id="seccion-5" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">05.</span>
          <h2 className="legal-section-title">Uso Permitido y Conductas Prohibidas</h2>
        </div>
        <p>El usuario se compromete a no incurrir en ninguna de las siguientes conductas:</p>
        <ul>
          <li>Cargar facturas electrónicas fraudulentas, alteradas o de terceros sin la debida autorización tributaria.</li>
          <li>Intentar eludir los límites de uso de su plan de suscripción o vulnerar las medidas de seguridad del servidor.</li>
          <li>Emplear scripts automatizados (bots, scrapers) que sobrecarguen la infraestructura o alteren el funcionamiento normal del sistema.</li>
          <li>Utilizar la plataforma para actividades ilícitas tipificadas por el Código Penal de Costa Rica o la Ley contra la Delincuencia Organizada.</li>
        </ul>
      </section>

      {/* Sección 6 */}
      <section id="seccion-6" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">06.</span>
          <h2 className="legal-section-title">Exclusión de Garantías y Límite de Responsabilidad</h2>
        </div>
        <p>
          La plataforma se proporciona &quot;tal cual&quot; (<em>as is</em>) y &quot;según disponibilidad&quot;. Si bien implementamos las mejores prácticas
          de seguridad y alta disponibilidad, no garantizamos que el servicio sea ininterrumpido o esté 100% libre de errores ante caídas de
          servicios externos (como la plataforma ATV de Hacienda, servidores de correo IMAP o pasarelas bancarias).
        </p>
        <p>
          En ningún caso ContadorGanadero responderá por lucro cesante, pérdidas indirectas, multas o recargos impuestos por la Dirección
          General de Tributación derivados del ingreso erróneo de datos por parte del usuario o de la omisión en la presentación formal de declaraciones.
        </p>
      </section>

      {/* Sección 7 */}
      <section id="seccion-7" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">07.</span>
          <h2 className="legal-section-title">Modificaciones y Entrada en Vigor</h2>
        </div>
        <p>
          Nos reservamos el derecho de actualizar estos Términos y Condiciones para reflejar cambios legislativos (reformas fiscales de Costa Rica),
          mejoras en la plataforma o nuevas funcionalidades.
        </p>
        <p>
          Las modificaciones sustanciales serán notificadas a través del correo electrónico registrado o mediante un aviso destacado en el panel
          de usuario con al menos 15 días naturales de antelación a su entrada en vigencia.
        </p>
      </section>

      {/* Sección 8 */}
      <section id="seccion-8" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">08.</span>
          <h2 className="legal-section-title">Legislación Aplicable y Jurisdicción</h2>
        </div>
        <p>
          Estos términos se rigen e interpretan conforme a las leyes sustantivas y procesales de la <strong>República de Costa Rica</strong>.
          Cualquier controversia derivada de la interpretación o ejecución de este contrato será sometida primeramente a mecanismos de conciliación,
          y en su defecto, a la jurisdicción de los Tribunales de Justicia de la ciudad de San José, Costa Rica.
        </p>

        <div className="legal-contact-box">
          <div className="legal-contact-info">
            <h4>¿Dudas sobre nuestros términos legales?</h4>
            <p>Escríbenos a nuestro equipo legal y de cumplimiento tributario.</p>
          </div>
          <a href="mailto:soporte@contadorganadero.cr" className="btn btn-secondary btn-sm">
            soporte@contadorganadero.cr
          </a>
        </div>
      </section>
    </LegalLayout>
  );
}
