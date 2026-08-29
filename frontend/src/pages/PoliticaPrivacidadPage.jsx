import LegalLayout from '../components/layout/LegalLayout';
import useSeo from '../hooks/useSeo';
import { EyeOff } from 'lucide-react';

const TOC_ITEMS = [
  { id: 'seccion-1', label: '1. Marco Legal (Ley 8968)' },
  { id: 'seccion-2', label: '2. Datos que Recopilamos' },
  { id: 'seccion-3', label: '3. Finalidad del Tratamiento' },
  { id: 'seccion-4', label: '4. Tratamiento con IA' },
  { id: 'seccion-5', label: '5. Seguridad y Cifrado' },
  { id: 'seccion-6', label: '6. Compartición con Terceros' },
  { id: 'seccion-7', label: '7. Derechos ARCO' },
  { id: 'seccion-8', label: '8. Retención y Eliminación' },
  { id: 'seccion-9', label: '9. Contacto de Privacidad' },
];

export default function PoliticaPrivacidadPage() {
  useSeo({
    title: 'Política de Privacidad | ContadorGanadero Costa Rica',
    description: 'Política de privacidad y protección de datos personales y agropecuarios conforme a la Ley 8968 de Costa Rica en ContadorGanadero.',
    path: '/privacidad',
    robots: 'index, follow',
  });

  return (
    <LegalLayout
      title="Política de Privacidad y Protección de Datos"
      subtitle="Garantizamos la confidencialidad, seguridad y protección de los datos de su finca y facturación tributaria de conformidad con la Ley N° 8968 de Costa Rica."
      badgeText="Protección de Datos Personales"
      badgeType="cyan"
      tocItems={TOC_ITEMS}
    >
      {/* Sección 1 */}
      <section id="seccion-1" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">01.</span>
          <h2 className="legal-section-title">Marco Legal y Compromiso de Privacidad</h2>
        </div>
        <p>
          En <strong>ContadorGanadero</strong> reconocemos la importancia crítica de la confidencialidad de la información financiera,
          productiva y fiscal de su actividad agropecuaria.
        </p>
        <p>
          El tratamiento de sus datos personales y empresariales se realiza en estricto apego a la <strong>Ley N° 8968</strong> (&quot;Ley de Protección
          de la Persona frente al Tratamiento de sus Datos Personales&quot; de la República de Costa Rica), su Reglamento Ejecutivo, y los más
          altos estándares de ciberseguridad en la nube.
        </p>
      </section>

      {/* Sección 2 */}
      <section id="seccion-2" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">02.</span>
          <h2 className="legal-section-title">Información que Recopilamos</h2>
        </div>
        <p>Para prestar los servicios de gestión contable e inventario, recopilamos las siguientes categorías de datos:</p>
        <ul>
          <li><strong>Datos de Identificación del Titular:</strong> Nombre completo, correo electrónico, número de identificación (cédula física, jurídica, DIMEX o NITE) y teléfono.</li>
          <li><strong>Datos de la Finca / Explotación:</strong> Nombre de la finca, ubicación geográfica general, tipo de actividad pecuaria o agrícola (bovinos de cría/engorde/leche, aves, acuicultura, apicultura, agricultura).</li>
          <li><strong>Datos Fiscales y Comprobantes Electrónicos:</strong> Archivos XML y PDF de facturas electrónicas de compra y venta, montos, tarifas de IVA (1%, 13%, exento), líneas de detalle de insumos y claves numéricas de Hacienda.</li>
          <li><strong>Credenciales Técnicas para Integraciones:</strong> Datos de acceso IMAP (servidor, usuario, contraseña de aplicación cifrada) y llaves criptográficas <code>.p12</code> y PIN de Hacienda para la emisión autorizada de comprobantes.</li>
          <li><strong>Datos de Inventario y Producción:</strong> Pesos de animales, registros de lotes, consumos de insumos, parámetros de producción y costos asociados.</li>
        </ul>
      </section>

      {/* Sección 3 */}
      <section id="seccion-3" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">03.</span>
          <h2 className="legal-section-title">Finalidad del Tratamiento de los Datos</h2>
        </div>
        <p>La información recopilada se utiliza exclusivamente para los siguientes propósitos legítimos:</p>
        <ul>
          <li>Crear y administrar su cuenta de usuario y autenticación segura.</li>
          <li>Procesar, clasificar y conciliar automáticamente los gastos e ingresos de su finca.</li>
          <li>Calcular proyecciones tributarias del Régimen Especial Agropecuario (IVA D-135-1, Renta D-101 y D-150).</li>
          <li>Calcular costos reales de producción (costo por kilo de carne, cartón de huevos, kilo de pescado, etc.).</li>
          <li>Generar y firmar comprobantes electrónicos ante la Dirección General de Tributación a solicitud expresa del usuario.</li>
          <li>Brindar soporte técnico y resolver incidencias operativas.</li>
        </ul>
      </section>

      {/* Sección 4 */}
      <section id="seccion-4" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">04.</span>
          <h2 className="legal-section-title">Tratamiento con Inteligencia Artificial (IA)</h2>
        </div>
        <div className="legal-alert legal-alert--success">
          <EyeOff size={22} className="legal-alert-icon" />
          <div className="legal-alert-content">
            <h4>Garantía de Confidencialidad en Modelos de IA</h4>
            <p>
              Los modelos de Inteligencia Artificial utilizados en ContadorGanadero procesan únicamente el texto de las descripciones
              de productos en facturas para categorizar el insumo contable. <strong>Sus datos nunca se venden a terceros ni se utilizan
              para entrenar modelos públicos de inteligencia artificial de acceso abierto.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Sección 5 */}
      <section id="seccion-5" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">05.</span>
          <h2 className="legal-section-title">Seguridad, Cifrado y Almacenamiento</h2>
        </div>
        <p>Aplicamos medidas técnicas, organizativas y físicas para proteger sus datos contra acceso no autorizado, alteración o pérdida:</p>
        <ul>
          <li><strong>Cifrado en Tránsito:</strong> Toda comunicación entre su navegador y nuestros servidores utiliza protocolos seguros SSL/TLS (HTTPS).</li>
          <li><strong>Cifrado de Credenciales:</strong> Las contraseñas de usuario se almacenan con algoritmos de hashing unidireccional (bcrypt con salt seguro). Las llaves criptográficas y contraseñas de correo IMAP se almacenan en reposo mediante cifrado AES-256.</li>
          <li><strong>Bases de Datos Aisladas:</strong> El acceso a la base de datos se realiza bajo principios de mínimo privilegio con autenticación estricta y firewalls de red.</li>
        </ul>
      </section>

      {/* Sección 6 */}
      <section id="seccion-6" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">06.</span>
          <h2 className="legal-section-title">Compartición de Información con Terceros</h2>
        </div>
        <p>
          ContadorGanadero <strong>no comercializa, alquila ni transfiere</strong> sus bases de datos con fines publicitarios de terceros.
          Únicamente se comparte información con los siguientes proveedores estrictamente necesarios para la ejecución del servicio:
        </p>
        <ul>
          <li><strong>Stripe:</strong> Procesamiento seguro de pagos con tarjetas de crédito/débito bajo certificación PCI-DSS.</li>
          <li><strong>Proveedores de Infraestructura en la Nube:</strong> Servidores de base de datos y cómputo que cumplen con estándares internacionales de seguridad (SOC 2, ISO 27001).</li>
          <li><strong>Ministerio de Hacienda de Costa Rica:</strong> Envío de comprobantes XML a solicitud del usuario cuando utiliza el módulo de emisión de facturación electrónica.</li>
        </ul>
      </section>

      {/* Sección 7 */}
      <section id="seccion-7" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">07.</span>
          <h2 className="legal-section-title">Derechos ARCO del Titular de los Datos</h2>
        </div>
        <p>
          De conformidad con la Ley N° 8968 de Costa Rica, usted tiene en todo momento el derecho de ejercer sus derechos de:
        </p>
        <ul>
          <li><strong>Acceso:</strong> Conocer los datos personales que mantenemos registrados sobre usted y su finca.</li>
          <li><strong>Rectificación:</strong> Solicitar la corrección o actualización de datos incompletos o inexactos.</li>
          <li><strong>Cancelación / Supresión:</strong> Solicitar la eliminación definitiva de su cuenta y borrado de sus datos de nuestros servidores.</li>
          <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos para fines específicos no esenciales para el servicio.</li>
        </ul>
      </section>

      {/* Sección 8 */}
      <section id="seccion-8" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">08.</span>
          <h2 className="legal-section-title">Retención y Eliminación de Datos</h2>
        </div>
        <p>
          Conservaremos sus datos mientras mantenga activa su cuenta en ContadorGanadero.
          Si decide cerrar su cuenta, podrá solicitar previamente la exportación de sus facturas e históricos en formato Excel/CSV.
          Tras el cierre definitivo, los datos serán eliminados de nuestras bases de datos operativas en un plazo máximo de 30 días hábiles.
        </p>
      </section>

      {/* Sección 9 */}
      <section id="seccion-9" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">09.</span>
          <h2 className="legal-section-title">Contacto del Delegado de Privacidad</h2>
        </div>
        <p>
          Para ejercer sus derechos ARCO o plantear cualquier consulta sobre el tratamiento de sus datos personales,
          puede contactar a nuestro equipo de protección de datos:
        </p>

        <div className="legal-contact-box">
          <div className="legal-contact-info">
            <h4>Oficial de Protección de Datos</h4>
            <p>ContadorGanadero — San José, Costa Rica</p>
          </div>
          <a href="mailto:privacidad@contadorganadero.cr" className="btn btn-secondary btn-sm">
            privacidad@contadorganadero.cr
          </a>
        </div>
      </section>
    </LegalLayout>
  );
}
