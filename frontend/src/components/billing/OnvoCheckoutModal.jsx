import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { cargarSdkOnvo } from '../../services/onvoSdk';


/**
 * Modal con el formulario de tarjeta embebido de ONVO Pay.
 *
 * Props:
 *  - checkout: { subscriptionId, customerId, publicKey, planNombre }
 *  - onExito: () => void   (pago/suscripción confirmados por el SDK)
 *  - onCerrar: () => void
 */
export default function OnvoCheckoutModal({ checkout, onExito, onCerrar }) {
  if (!checkout) return null;
  return <CheckoutIntento key={checkout.subscriptionId} checkout={checkout} onExito={onExito} onCerrar={onCerrar} />;
}

function CheckoutIntento({ checkout, onExito, onCerrar }) {
  const contenedorRef = useRef(null);
  const [sdkListo, setSdkListo] = useState(false);
  const [errorSdk, setErrorSdk] = useState(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!checkout) return;
    let cancelado = false;

    Promise.resolve().then(() => { if (!cancelado) { setErrorSdk(null); setSdkListo(false); } }).then(cargarSdkOnvo)
      .then(() => {
        if (cancelado || !contenedorRef.current) return;
        contenedorRef.current.innerHTML = '';

        window.onvo.pay({
          publicKey: checkout.publicKey,
          subscriptionId: checkout.subscriptionId,
          customerId: checkout.customerId,
          paymentType: 'subscription',
          locale: 'es',
          onSuccess: (data) => {
            console.log('ONVO suscripción confirmada:', data);
            onExito();
          },
          onError: (data) => {
            console.error('Error en pago ONVO:', data);
            toast.error(data?.message || 'No se pudo procesar el pago. Revisa los datos de tu tarjeta.');
          },
        }).render(contenedorRef.current);

        setSdkListo(true);
      })
      .catch((err) => {
        if (cancelado) return;
        console.error(err);
        setErrorSdk('No se pudo cargar el formulario de pago de ONVO.');
      });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout, intento]);

  return (
    <Modal
      isOpen={!!checkout}
      onClose={onCerrar}
      title={`Suscribirse al plan ${checkout?.planNombre || ''}`}
      size="md"
    >
      {errorSdk ? (
        <div><p className="onvo-checkout-error" role="alert">{errorSdk}</p><button type="button" onClick={() => setIntento(i => i + 1)}>Reintentar</button></div>
      ) : (
        <>
          {!sdkListo && (
            <div className="loader-center"><div className="loader" /></div>
          )}
          <p className="onvo-checkout-nota">
            Pago procesado de forma segura por ONVO Pay. Tu tarjeta se usará para el cobro mensual del plan.
          </p>
        </>
      )}
      <div ref={contenedorRef} className="onvo-checkout-container" />
    </Modal>
  );
}
