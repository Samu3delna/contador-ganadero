import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import { toast } from 'react-hot-toast';

const TARIFAS_IVA = [
  { codigoTarifa: '08', tarifa: 13, label: '13% General' },
  { codigoTarifa: '04', tarifa: 4, label: '4% Salud Privada' },
  { codigoTarifa: '03', tarifa: 2, label: '2% Medicamentos' },
  { codigoTarifa: '02', tarifa: 1, label: '1% Agropecuario / Canasta Básica' },
  { codigoTarifa: '01', tarifa: 0, label: '0% Exento' },
];

const TIPOS_DOC = {
  FE: { label: 'Factura Electrónica (FE)', requiereReceptor: true },
  TE: { label: 'Tiquete Electrónico (TE)', requiereReceptor: false },
  NC: { label: 'Nota de Crédito (NC)', requiereReceptor: true, requiereReferencia: true },
  FEC: { label: 'Factura Electrónica de Compra (FEC)', requiereReceptor: true },
  REP: { label: 'Recibo Electrónico de Pago (REP)', requiereFacturaOriginal: true },
};

const TIPOS_PRODUCTO = [
  { value: 'carne_bovino', label: 'Carne Bovino' },
  { value: 'leche', label: 'Leche' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'tilapia', label: 'Tilapia' },
  { value: 'miel', label: 'Miel' },
  { value: 'otros_productos_rea', label: 'Otros' },
];

const MEDIOS_PAGO = [
  { value: '01', label: 'Efectivo' },
  { value: '02', label: 'Tarjeta' },
  { value: '03', label: 'Cheque' },
  { value: '04', label: 'Transferencia / Sinpe' },
];

export default function EmitirComprobanteModal({ isOpen, onClose, onSave, guardando, tipoDoc = 'FE' }) {
  const config = TIPOS_DOC[tipoDoc] || TIPOS_DOC.FE;

  const [emisor, setEmisor] = useState({ nombre: '', cedula: { tipo: '01', numero: '' }, telefono: '', correo: '', ubicacion: '' });
  const [receptor, setReceptor] = useState({ nombre: '', cedula: { tipo: '02', numero: '' }, correo: '', telefono: '' });
  const [lineas, setLineas] = useState([{ codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'kg', precioUnitario: 0, tarifaIdx: 3 }]);
  const [tipoProducto, setTipoProducto] = useState('carne_bovino');
  const [condicionVenta, setCondicionVenta] = useState('01');
  const [medioPago, setMedioPago] = useState('04');
  const [facturaIdOriginal, setFacturaIdOriginal] = useState('');
  const [montoAbono, setMontoAbono] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const u = JSON.parse(localStorage.getItem('usuario') || '{}');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmisor({
        nombre: u.nombreFinca || u.nombre || '',
        cedula: u.cedula || { tipo: '01', numero: '' },
        telefono: u.telefono || '',
        correo: u.email || '',
        ubicacion: u.direccion || '',
      });
    } catch { /* noop */ }
    // Reset
    setReceptor({ nombre: '', cedula: { tipo: '02', numero: '' }, correo: '', telefono: '' });
    setLineas([{ codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'kg', precioUnitario: 0, tarifaIdx: 3 }]);
    setFacturaIdOriginal('');
    setMontoAbono(0);
  }, [isOpen]);

  const addLinea = () => setLineas([...lineas, { codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'kg', precioUnitario: 0, tarifaIdx: 3 }]);
  const removeLinea = (i) => setLineas(lineas.filter((_, idx) => idx !== i));
  const updateLinea = (i, k, v) => setLineas(lineas.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const totales = lineas.reduce((acc, l) => {
    const tarifa = TARIFAS_IVA[l.tarifaIdx];
    const subtotal = l.cantidad * l.precioUnitario;
    const iva = subtotal * (tarifa.tarifa / 100);
    return { base: acc.base + subtotal, iva: acc.iva + iva, total: acc.total + subtotal + iva };
  }, { base: 0, iva: 0, total: 0 });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validaciones
    if (config.requiereFacturaOriginal && !facturaIdOriginal) {
      toast.error('Para REP debés indicar el ID de la factura original acreditada');
      return;
    }
    if (config.requiereFacturaOriginal && (!montoAbono || montoAbono <= 0)) {
      toast.error('Indicá el monto del abono');
      return;
    }
    if (!emisor.nombre || !emisor.cedula?.numero) {
      toast.error('Datos del emisor incompletos');
      return;
    }
    if (config.requiereReceptor && (!receptor.nombre || !receptor.cedula?.numero)) {
      toast.error('Datos del receptor incompletos');
      return;
    }
    if (tipoDoc !== 'REP') {
      for (const l of lineas) {
        if (!l.codigo || String(l.codigo).length !== 13) {
          toast.error(`La línea "${l.descripcion || '?'}" necesita CABYS de 13 dígitos`);
          return;
        }
        if (!l.descripcion || l.cantidad <= 0 || l.precioUnitario <= 0) {
          toast.error('Complete descripción, cantidad y precio de todas las líneas');
          return;
        }
      }
    }

    // Mapear
    if (tipoDoc === 'REP') {
      onSave({
        facturaIdOriginal,
        montoAbono: Number(montoAbono),
        medioPago,
      }, 'REP');
      return;
    }

    const lineaDetalle = lineas.map((l, idx) => {
      const tarifa = TARIFAS_IVA[l.tarifaIdx];
      const subtotal = l.cantidad * l.precioUnitario;
      const iva = subtotal * (tarifa.tarifa / 100);
      return {
        numeroLinea: idx + 1,
        codigo: l.codigo,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        unidadMedida: l.unidadMedida,
        precioUnitario: l.precioUnitario,
        subtotal,
        descuento: { monto: 0, naturalezaDescuento: '' },
        impuesto: {
          codigo: '01',
          codigoTarifa: tarifa.codigoTarifa,
          tarifa: tarifa.tarifa,
          monto: Math.round(iva * 100) / 100,
          factorIVA: tarifa.tarifa / 100,
        },
        impuestoNeto: Math.round(iva * 100) / 100,
        montoTotal: Math.round((subtotal + iva) * 100) / 100,
      };
    });

    onSave({
      emisor,
      receptor: config.requiereReceptor ? receptor : undefined,
      lineaDetalle,
      tipoProducto,
      condicionVenta,
      medioPago: [medioPago],
    }, tipoDoc);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Emitir ${config.label}`} size="lg">
      <form onSubmit={handleSubmit} className="form-grid">
        {config.requiereFacturaOriginal && (
          <>
            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', margin: '12px 0 4px' }}>
              Recibo Electrónico de Pago
            </h4>
            <div className="form-group">
              <label>ID de la Factura original (aceptada) *</label>
              <input className="input" type="text" value={facturaIdOriginal}
                onChange={(e) => setFacturaIdOriginal(e.target.value)}
                placeholder="_id de la FE a acreditar (la buscas en Emisión FE/TE)" required />
            </div>
            <div className="form-group">
              <label>Monto del abono (₡) *</label>
              <input className="input" type="number" min="0.01" step="any" value={montoAbono}
                onChange={(e) => setMontoAbono(Number(e.target.value))} required />
            </div>
          </>
        )}

        {tipoDoc !== 'REP' && (
          <>
            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', margin: '12px 0 4px' }}>Datos del Comprobante</h4>
            <div className="form-group">
              <label>Tipo de Producto *</label>
              <select className="input" value={tipoProducto} onChange={(e) => setTipoProducto(e.target.value)}>
                {TIPOS_PRODUCTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Condición de Venta</label>
              <select className="input" value={condicionVenta} onChange={(e) => setCondicionVenta(e.target.value)}>
                <option value="01">Contado</option>
                <option value="02">Crédito</option>
                <option value="03">Consignación</option>
              </select>
            </div>
            <div className="form-group">
              <label>Medio de Pago</label>
              <select className="input" value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                {MEDIOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </>
        )}

        {config.requiereReceptor && (
          <>
            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', margin: '12px 0 4px' }}>
              {tipoDoc === 'FEC' ? 'Vendedor (quien vendió al emisor)' : 'Receptor (Comprador)'}
            </h4>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="input" type="text" value={receptor.nombre}
                onChange={(e) => setReceptor({ ...receptor, nombre: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Tipo Cédula *</label>
              <select className="input" value={receptor.cedula.tipo}
                onChange={(e) => setReceptor({ ...receptor, cedula: { ...receptor.cedula, tipo: e.target.value } })}>
                <option value="01">Física</option>
                <option value="02">Jurídica</option>
                <option value="03">DIMEX</option>
                <option value="04">NITE</option>
              </select>
            </div>
            <div className="form-group">
              <label>Número Cédula *</label>
              <input className="input" type="text" value={receptor.cedula.numero}
                onChange={(e) => setReceptor({ ...receptor, cedula: { ...receptor.cedula, numero: e.target.value } })} required />
            </div>
            <div className="form-group">
              <label>Correo</label>
              <input className="input" type="email" value={receptor.correo}
                onChange={(e) => setReceptor({ ...receptor, correo: e.target.value })} />
            </div>
          </>
        )}

        {tipoDoc !== 'REP' && (
          <>
            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', margin: '16px 0 4px' }}>Líneas (CABYS obligatorio)</h4>
            <div style={{ gridColumn: 'span 2' }}>
              {lineas.map((l, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input className="input" style={{ flex: '0 0 130px' }} placeholder="CABYS (13)" maxLength={13}
                    value={l.codigo} onChange={(e) => updateLinea(idx, 'codigo', e.target.value)} required />
                  <input className="input" style={{ flex: '2 1 200px' }} placeholder="Descripción"
                    value={l.descripcion} onChange={(e) => updateLinea(idx, 'descripcion', e.target.value)} required />
                  <input className="input" style={{ flex: '0 0 70px' }} type="number" min="0.01" step="any" placeholder="Cant"
                    value={l.cantidad} onChange={(e) => updateLinea(idx, 'cantidad', Number(e.target.value))} required />
                  <input className="input" style={{ flex: '0 0 110px' }} type="number" min="0" step="any" placeholder="Precio"
                    value={l.precioUnitario} onChange={(e) => updateLinea(idx, 'precioUnitario', Number(e.target.value))} required />
                  <select className="input" style={{ flex: '0 0 130px' }} value={l.tarifaIdx}
                    onChange={(e) => updateLinea(idx, 'tarifaIdx', Number(e.target.value))}>
                    {TARIFAS_IVA.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                  </select>
                  <button type="button" className="btn-icon" onClick={() => removeLinea(idx)} disabled={lineas.length === 1} title="Quitar"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addLinea} style={{ marginTop: '4px' }}>
                <Plus size={14} style={{ marginRight: '4px' }} /> Agregar Línea
              </button>
            </div>

            <div className="form-resumen glass-card" style={{ gridColumn: 'span 2', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Base imponible:</span>
                <span className="text-mono">₡{Math.round(totales.base).toLocaleString('es-CR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>IVA:</span>
                <span className="text-mono">₡{Math.round(totales.iva).toLocaleString('es-CR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '6px' }}>
                <span>Total:</span>
                <span className="text-mono">₡{Math.round(totales.total).toLocaleString('es-CR')}</span>
              </div>
            </div>
          </>
        )}

        <div className="form-actions" style={{ gridColumn: 'span 2', marginTop: '16px' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Procesando...' : `Crear ${config.label}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
