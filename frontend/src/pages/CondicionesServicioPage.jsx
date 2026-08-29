import LegalLayout from '../components/layout/LegalLayout';
import useSeo from '../hooks/useSeo';
import { MailCheck } from 'lucide-react';

const TOC_ITEMS = [
  { id: 'seccion-1', label: '1. Alcance de los Servicios' },
  { id: 'seccion-2', label: '2. Planes y Suscripciones' },
  { id: 'seccion-3', label: '3. Facturación y Pasarelas de Pago' },
  { id: 'seccion-4', label: '4. Integración de Correo IMAP' },
  { id: 'seccion-5', label: '5. Facturación Electrónica REA' },
  { id: 'seccion-6', label: '6. Límites Operativos y SLA' },
  { id: 'seccion-7', label: '7. Cancelación y Reembolsos' },
  { id: 'seccion-8', label: '8. Soporte al Cliente' },
];

export default function CondicionesServicioPage() {
  useSeo({
    title: 'Condiciones del Servicio | ContadorGanadero Costa Rica',
    description: 'Condiciones de servicio, planes freemium/pro, pagos e integraciones de ContadorGanadero para productores agropecuarios.',
    path: '/condiciones-servicio',
    robots: 'index, follow',
  });

  return (
    <LegalLayout
      title="Condiciones del Servicio (SLA y Planes)"
      subtitle="Detalles operativos sobre planes de suscripción, integraciones con correo IMAP, facturación electrónica REA y procesamiento de datos."
      badgeText="Condiciones Operativas"
      badgeType="amber"
      tocItems={TOC_ITEMS}
    >
      {/* Sección 1 */}
      <section id="seccion-1" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">01.</span>
          <h2 className="legal-section-title">Alcance de los Servicios Prestados</h2>
        </div>
        <p>
          ContadorGanadero pone a disposición del usuario un conjunto de herramientas modulares en la nube diseñadas para
          el sector agropecuario costarricense:
        </p>
        <ul>
          <li><strong>Importación y Lectura de Facturas:</strong> Descarga y extracción automática de datos de archivos XML y PDF de facturas electrónicas vía IMAP.</li>
          <li><strong>Categorización Asistida por IA:</strong> Clasificación inteligente de insumos (alimentos, medicamentos veterinarios, sal, agroquímicos, maquinaria).</li>
          <li><strong>Módulos de Inventario Productivo:</strong> Control de ganado bovino (pesaje, ganancia diaria), aves de postura (lotes, mortalidad), acuicultura (biomasa, FCA) y apicultura (cosechas de miel).</li>
          <li><strong>Costos de Producción y Rentabilidad:</strong> Cálculo del costo real por kilogramo de carne, cartón de huevos o unidad de producto cosechado.</li>
          <li><strong>Proyecciones Tributarias REA:</strong> Estimación del IVA Cuatrimestral (D-135-1), Renta Anual (D-101) y resumen informativo D-150.</li>
        </ul>
      </section>

      {/* Sección 2 */}
      <section id="seccion-2" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">02.</span>
          <h2 className="legal-section-title">Planes y Modelos de Suscripción</h2>
        </div>
        <p>
          ContadorGanadero opera bajo un modelo freemium estructurado en tres niveles para adaptarse al tamaño de su finca:
        </p>
        <ul>
          <li>
            <strong>Plan Gratis (Con Anuncios):</strong> Acceso a módulos fundamentales para pequeños productores. Incluye anuncios
            publicitarios patrocinados de empresas del sector agropecuario y un límite mensual de facturas procesadas por IA.
          </li>
          <li>
            <strong>Plan Pro:</strong> Eliminación total de publicidad, mayor cuota de procesamiento de facturas, reportes avanzados de costos
            y generación de declaraciones cuatrimestrales y anuales.
          </li>
          <li>
            <strong>Plan Agro (Empresarial):</strong> Procesamiento ilimitado o de alto volumen, soporte multi-finca, multi-especie, emisión directa
            de comprobantes REA y soporte técnico prioritario por WhatsApp / Teléfono.
          </li>
        </ul>
      </section>

      {/* Sección 3 */}
      <section id="seccion-3" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">03.</span>
          <h2 className="legal-section-title">Facturación, Precios y Pasarelas de Pago</h2>
        </div>
        <p>
          Los pagos de las suscripciones pagas (Pro y Agro) se procesan a través de la pasarela segura <strong>Stripe</strong>.
        </p>
        <ul>
          <li><strong>Ciclos de Cobro:</strong> Las suscripciones se cobran por adelantado en ciclos mensuales o anuales, según la opción seleccionada.</li>
          <li><strong>Renovación Automática:</strong> Salvo que cancele su suscripción antes de la fecha de vencimiento, la suscripción se renovará automáticamente usando el método de pago registrado.</li>
          <li><strong>Impuestos Aplicables:</strong> Las tarifas publicadas no incluyen el Impuesto sobre el Valor Agregado (IVA) correspondiente a servicios digitales transfronterizos o locales, el cual será desglosado en el checkout.</li>
        </ul>
      </section>

      {/* Sección 4 */}
      <section id="seccion-4" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">04.</span>
          <h2 className="legal-section-title">Integración con Correo Electrónico (IMAP)</h2>
        </div>
        <p>
          Para habilitar la descarga automática de comprobantes electrónicos, el usuario puede vincular su cuenta de correo mediante protocolo IMAP.
        </p>
        <div className="legal-alert legal-alert--info">
          <MailCheck size={22} className="legal-alert-icon" />
          <div className="legal-alert-content">
            <h4>Privacidad del Correo</h4>
            <p>
              Nuestro sincronizador únicamente analiza y descarga correos que contengan archivos adjuntos con extensión <code>.xml</code> o <code>.pdf</code>
              correspondientes a facturas electrónicas de Hacienda. <strong>No leemos, almacenamos ni compartimos su correspondencia personal o comercial ajena a la facturación.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Sección 5 */}
      <section id="seccion-5" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">05.</span>
          <h2 className="legal-section-title">Facturación Electrónica REA y Comunicación con Hacienda</h2>
        </div>
        <p>
          Para el módulo de emisión de comprobantes electrónicos bajo el Régimen Especial Agropecuario (tarifa 1% de IVA):
        </p>
        <ul>
          <li>El usuario es el único responsable de contar con inscripción activa ante el MAG y la Dirección General de Tributación (DGT).</li>
          <li>El usuario debe cargar su llave criptográfica oficial (archivo <code>.p12</code>) y PIN de 4 dígitos proporcionado por ATV Hacienda.</li>
          <li>ContadorGanadero almacena la llave de forma estrictamente cifrada para firmar los comprobantes XML en el momento de su emisión.</li>
        </ul>
      </section>

      {/* Sección 6 */}
      <section id="seccion-6" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">06.</span>
          <h2 className="legal-section-title">Límites Operativos y Disponibilidad del Servicio (SLA)</h2>
        </div>
        <p>
          Nos esforzamos por mantener una disponibilidad de servicio del <strong>99.5%</strong>. No obstante, pueden presentarse
          interrupciones por mantenimientos programados de la infraestructura o fallas en servicios de terceros (Google Cloud, OpenRouter, ATV Hacienda).
        </p>
        <p>
          Los planes cuentan con límites de llamadas a modelos de IA para evitar abusos y garantizar un rendimiento óptimo para toda la comunidad de productores.
        </p>
      </section>

      {/* Sección 7 */}
      <section id="seccion-7" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">07.</span>
          <h2 className="legal-section-title">Cancelación de Suscripciones y Política de Reembolsos</h2>
        </div>
        <p>
          Usted puede cancelar su suscripción paga en cualquier momento desde la sección <strong>Facturación / Planes</strong> de su panel.
          Al cancelar, mantendrá acceso a los beneficios de su plan hasta el final del periodo facturado en curso.
        </p>
        <p>
          Por la naturaleza digital y de consumo inmediato de los recursos de cómputo e IA, no se realizan reembolsos proporcionales por periodos parcialmente utilizados, salvo requerimiento expreso de la legislación de protección al consumidor de Costa Rica.
        </p>
      </section>

      {/* Sección 8 */}
      <section id="seccion-8" className="legal-section">
        <div className="legal-section-heading">
          <span className="legal-section-number">08.</span>
          <h2 className="legal-section-title">Soporte Técnico y Atención al Productor</h2>
        </div>
        <p>
          Ofrecemos soporte técnico continuo para resolver incidencias de acceso, sincronización IMAP o dudas sobre la visualización de reportes:
        </p>
        <ul>
          <li><strong>Plan Gratis:</strong> Soporte vía correo electrónico y asistente virtual con IA.</li>
          <li><strong>Plan Pro / Agro:</strong> Soporte prioritario vía ticket, correo y canal de mensajería directa en días hábiles.</li>
        </ul>
      </section>
    </LegalLayout>
  );
}
