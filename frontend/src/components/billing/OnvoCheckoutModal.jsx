import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';

const SDK_URL = 'https://sdk.onvopay.com/sdk.js';

let sdkPromise = null;

/**
 * Carga el SDK web de ONVO una sola vez (https://sdk.onvopay.com/sdk.js).
 */
function cargarSdkOnvo() {
  if (window.onvo?.pay) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el SDK de ONVO'));
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/**
 * Modal con el formulario de tarjeta embebido de ONVO Pay.
 *
 * Props:
 *  - checkout: { subscriptionId, customerId, publicKey, planNombre }
 *  - onExito: () => void   (pago/suscripción confirmados por el SDK)
 *  - onCerrar: () => void
 */
export default function OnvoCheckoutModal({ checkout, onExito, onCerrar }) {
  const contenedorRef = useRef(null);
  const [sdkListo, setSdkListo] = useState(false);
  const [errorSdk, setErrorSdk] = useState(null);

  useEffect(() => {
    if (!checkout) return;
    let cancelado = false;

    cargarSdkOnvo()
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
  }, [checkout]);

  return (
    <Modal
      isOpen={!!checkout}
      onClose={onCerrar}
      title={`Suscribirse al plan ${checkout?.planNombre || ''}`}
      size="md"
    >
      {errorSdk ? (
        <p className="onvo-checkout-error">{errorSdk}</p>
      ) : (
        <>
          {!sdkListo && (
            <div className="loader-center"><div className="loader" /></div>
          )}
          <div ref={contenedorRef} className="onvo-checkout-container" />
          <p className="onvo-checkout-nota">
            Pago procesado de forma segura por ONVO Pay. Tu tarjeta se usará para el cobro mensual del plan.
          </p>
        </>
      )}
    </Modal>
  );
}
