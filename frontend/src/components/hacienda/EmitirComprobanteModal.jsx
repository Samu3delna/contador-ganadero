import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const TARIFAS_IVA = [
  { codigoTarifa: '08', tarifa: 13, label: '13% General' },
  { codigoTarifa: '04', tarifa: 4, label: '4% Salud Privada' },
  { codigoTarifa: '03', tarifa: 2, label: '2% Medicamentos' },
  { codigoTarifa: '02', tarifa: 1, label: '1% Agropecuario / Canasta Básica' },
  { codigoTarifa: '09', tarifa: 0.5, label: '0,5% Orgánicos certificados' },
  { codigoTarifa: '10', tarifa: 0, label: 'Exento' },
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

function DatosPersona({ titulo, valor, onChange, ubicacion = false }) {
  const cambiar = (campo, dato) => onChange({ ...valor, [campo]: dato });
  return <fieldset className="form-grid form-grid-full">
    <legend className="form-seccion-titulo">{titulo}</legend>
    <label className="form-group">Nombre *<input className="input" value={valor.nombre} onChange={e => cambiar('nombre', e.target.value)} required /></label>
    <label className="form-group">Tipo de identificación<select className="input" value={valor.cedula.tipo} onChange={e => cambiar('cedula', { ...valor.cedula, tipo: e.target.value })}>{[['01','Física'],['02','Jurídica'],['03','DIMEX'],['04','NITE']].map(([v,t]) => <option key={v} value={v}>{t}</option>)}</select></label>
    <label className="form-group">Identificación *<input className="input" value={valor.cedula.numero} onChange={e => cambiar('cedula', { ...valor.cedula, numero: e.target.value })} required /></label>
    <label className="form-group">Correo {ubicacion && '*'}<input className="input" type="email" value={valor.correo || ''} onChange={e => cambiar('correo', e.target.value)} required={ubicacion} /></label>
    {ubicacion && <>{[['provincia','Provincia (código 1–7)',1],['canton','Cantón (dos dígitos)',2],['distrito','Distrito (dos dígitos)',2],['ubicacion','Otras señas',250]].map(([campo,label,max]) => <label className="form-group" key={campo}>{label} *<input className="input" value={valor[campo] || ''} maxLength={max} onChange={e => cambiar(campo,e.target.value)} required /></label>)}</>}
  </fieldset>;
}

export default function EmitirComprobanteModal({ isOpen, onClose, onSave, guardando, tipoDoc = 'FE' }) {
  const config = TIPOS_DOC[tipoDoc] || TIPOS_DOC.FE;
  const { usuario } = useAuth();
  const [plazoCredito, setPlazoCredito] = useState('');
  const [documentoReferencia, setDocumentoReferencia] = useState({ tipoDocReferencia: '13', numeroReferencia: '', fechaEmisionReferencia: '', codigoReferencia: '04', razonReferencia: 'Referencia de compra' });

  const [emisor, setEmisor] = useState({ nombre: '', cedula: { tipo: '01', numero: '' }, telefono: '', correo: '', ubicacion: '' });
  const [receptor, setReceptor] = useState({ nombre: '', cedula: { tipo: '02', numero: '' }, correo: '', telefono: '' });
  const [lineas, setLineas] = useState([{ codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'Kg', precioUnitario: 0, tarifaIdx: 3 }]);
  const [tipoProducto, setTipoProducto] = useState('carne_bovino');
  const [condicionVenta, setCondicionVenta] = useState('01');
  const [medioPago, setMedioPago] = useState('04');
  const [facturaIdOriginal, setFacturaIdOriginal] = useState('');
  const [montoAbono, setMontoAbono] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const u = usuario || {};
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmisor({
        nombre: u.nombreFinca || u.nombre || '',
        cedula: typeof u.cedula === 'string' ? { tipo: '01', numero: u.cedula } : u.cedula || { tipo: '01', numero: '' },
        telefono: u.telefono || '',
        correo: u.email || '',
        ubicacion: u.direccion || '',
      });
    } catch { /* noop */ }
    // Reset
    setReceptor({ nombre: '', cedula: { tipo: '02', numero: '' }, correo: '', telefono: '' });
    setLineas([{ codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'Kg', precioUnitario: 0, tarifaIdx: 3 }]);
    setFacturaIdOriginal('');
    setMontoAbono(0);
  }, [isOpen, usuario]);

  const addLinea = () => setLineas([...lineas, { codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'Kg', precioUnitario: 0, tarifaIdx: 3 }]);
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
      toast.error('Para REP debés indicar el ID de la factura original aceptada');
      return;
    }
    if (config.requiereFacturaOriginal && (!montoAbono || montoAbono <= 0)) {
      toast.error('Indicá el monto del abono');
      return;
    }
    if (tipoDoc !== 'REP' && (!emisor.nombre || !emisor.cedula?.numero)) {
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
      plazoCredito: condicionVenta === '02' || condicionVenta === '10' ? plazoCredito : undefined,
      documentoReferencia: tipoDoc === 'FEC' || config.requiereReferencia ? { ...documentoReferencia, fechaEmisionReferencia: new Date(documentoReferencia.fechaEmisionReferencia).toISOString() } : undefined,
    }, tipoDoc);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Emitir ${config.label}`} size="lg">
      <form onSubmit={handleSubmit} className="form-grid">
        {tipoDoc !== 'REP' && <DatosPersona titulo={tipoDoc === 'FEC' ? 'Comprador (su finca)' : 'Emisor'} valor={emisor} onChange={setEmisor} ubicacion />}
        {(tipoDoc === 'FEC' || config.requiereReferencia) && <fieldset className="form-grid form-grid-full"><legend>Documento de referencia</legend>{[['tipoDocReferencia','Tipo de documento (código)'],['numeroReferencia','Número de documento'],['fechaEmisionReferencia','Fecha del documento'],['codigoReferencia','Código de referencia'],['razonReferencia','Razón']].map(([campo,label]) => <label className="form-group" key={campo}>{label}<input className="input" type={campo === 'fechaEmisionReferencia' ? 'datetime-local' : 'text'} value={documentoReferencia[campo]} onChange={e => setDocumentoReferencia({ ...documentoReferencia, [campo]: e.target.value })} required /></label>)}</fieldset>}
        {config.requiereFacturaOriginal && (
          <>
            <h4 className="form-seccion-titulo">
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
            <h4 className="form-seccion-titulo">Datos del Comprobante</h4>
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
            {['02', '10'].includes(condicionVenta) && <label className="form-group">Plazo de crédito (días) *<input className="input" type="number" min="1" value={plazoCredito} onChange={e => setPlazoCredito(e.target.value)} required /></label>}
            <div className="form-group">
              <label>Medio de Pago</label>
              <select className="input" value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                {MEDIOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </>
        )}

        {config.requiereReceptor && <DatosPersona titulo={tipoDoc === 'FEC' ? 'Proveedor (vendedor)' : 'Receptor (comprador)'} valor={receptor} onChange={setReceptor} ubicacion={tipoDoc === 'FEC'} />}

        {tipoDoc !== 'REP' && (
          <>
            <h4 className="form-seccion-titulo">Líneas (CABYS obligatorio)</h4>
            <div className="form-grid-full">
              {lineas.map((l, idx) => (
                <div key={idx} className="linea-detalle">
                  <input className="input" style={{ flex: '0 0 130px' }} aria-label={`CABYS línea ${idx + 1}`} placeholder="CABYS (13)" maxLength={13}
                    value={l.codigo} onChange={(e) => updateLinea(idx, 'codigo', e.target.value)} required />
                  <input className="input" style={{ flex: '2 1 200px' }} placeholder="Descripción"
                    value={l.descripcion} onChange={(e) => updateLinea(idx, 'descripcion', e.target.value)} required />
                  <input className="input" style={{ flex: '0 0 70px' }} type="number" min="0.01" step="any" aria-label={`Cantidad línea ${idx + 1}`} placeholder="Cant"
                    value={l.cantidad} onChange={(e) => updateLinea(idx, 'cantidad', Number(e.target.value))} required />
                  <input className="input" style={{ flex: '0 0 110px' }} type="number" min="0" step="any" aria-label={`Precio línea ${idx + 1}`} placeholder="Precio"
                    value={l.precioUnitario} onChange={(e) => updateLinea(idx, 'precioUnitario', Number(e.target.value))} required />
                  <select className="input" style={{ flex: '0 0 130px' }} aria-label={`IVA línea ${idx + 1}`} value={l.tarifaIdx}
                    onChange={(e) => updateLinea(idx, 'tarifaIdx', Number(e.target.value))}>
                    {TARIFAS_IVA.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                  </select>
                  <button type="button" className="btn-icon" onClick={() => removeLinea(idx)} disabled={lineas.length === 1} aria-label={`Quitar línea ${idx + 1}`} title="Quitar"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addLinea} style={{ marginTop: '4px' }}>
                <Plus size={14} style={{ marginRight: '4px' }} /> Agregar Línea
              </button>
            </div>

            <div className="form-resumen glass-card form-grid-full" style={{ marginTop: '12px' }}>
              <div className="resumen-fila">
                <span>Base imponible:</span>
                <span className="text-mono">₡{Math.round(totales.base).toLocaleString('es-CR')}</span>
              </div>
              <div className="resumen-fila">
                <span>IVA:</span>
                <span className="text-mono">₡{Math.round(totales.iva).toLocaleString('es-CR')}</span>
              </div>
              <div className="resumen-fila resumen-fila--total">
                <span>Total:</span>
                <span className="text-mono">₡{Math.round(totales.total).toLocaleString('es-CR')}</span>
              </div>
            </div>
          </>
        )}

        <div className="form-actions form-grid-full" style={{ marginTop: '16px' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Procesando...' : `Crear ${config.label}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
