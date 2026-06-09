import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import { toast } from 'react-hot-toast';

const TIPOS_PRODUCTO_REA = [
  { value: 'carne_bovino', label: 'Carne Bovino' },
  { value: 'leche', label: 'Leche' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'tilapia', label: 'Tilapia' },
  { value: 'miel', label: 'Miel' },
  { value: 'otros_productos_rea', label: 'Otros Productos REA' }
];

const CONDICIONES_VENTA = [
  { value: '01', label: 'Contado' },
  { value: '02', label: 'Crédito' },
  { value: '03', label: 'Consignación' }
];

const MEDIOS_PAGO = [
  { value: '04', label: 'Transferencia - Sinpe Móvil' },
  { value: '01', label: 'Efectivo' },
  { value: '02', label: 'Tarjeta' },
  { value: '03', label: 'Cheque' }
];

export default function EmitirFacturaModal({ isOpen, onClose, onSave, guardando }) {
  const [consecutivo, setConsecutivo] = useState('');
  const [tipoProducto, setTipoProducto] = useState('carne_bovino');
  const [condicionVenta, setCondicionVenta] = useState('01');
  const [medioPago, setMedioPago] = useState('04');

  // Emisor pre-cargado del localStorage
  const [emisor, setEmisor] = useState({
    nombre: '',
    cedula: { tipo: '01', numero: '' },
    telefono: '',
    correo: '',
    ubicacion: '',
    numeroMAG: ''
  });

  // Receptor
  const [receptor, setReceptor] = useState({
    nombre: '',
    cedula: { tipo: '01', numero: '' },
    correo: '',
    telefono: ''
  });

  // Líneas de detalle
  const [lineas, setLineas] = useState([
    { descripcion: '', cantidad: 1, unidadMedida: 'kg', precioUnitario: 0, descuento: 0 }
  ]);

  useEffect(() => {
    try {
      const usuarioStr = localStorage.getItem('usuario');
      if (usuarioStr) {
        const usr = JSON.parse(usuarioStr);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEmisor({
          nombre: usr.nombreFinca || usr.nombre || '',
          cedula: usr.cedula || { tipo: '01', numero: '' },
          telefono: usr.telefono || '',
          correo: usr.email || usr.correo || '',
          ubicacion: usr.direccion || '',
          numeroMAG: usr.numeroMAG || ''
        });
      }
    } catch (err) {
      console.error('Error cargando emisor de localstorage', err);
    }
    // Autogenerar un consecutivo temporal basado en timestamp
    setConsecutivo(`FAC-${Date.now().toString().slice(-8)}`);
  }, [isOpen]);

  const addLinea = () => {
    setLineas([...lineas, { descripcion: '', cantidad: 1, unidadMedida: 'kg', precioUnitario: 0, descuento: 0 }]);
  };

  const removeLinea = (idx) => {
    if (lineas.length === 1) return;
    setLineas(lineas.filter((_, i) => i !== idx));
  };

  const updateLinea = (idx, campo, valor) => {
    setLineas(lineas.map((linea, i) => {
      if (i === idx) {
        return { ...linea, [campo]: valor };
      }
      return linea;
    }));
  };

  // Cálculos totales
  const totalResumen = lineas.reduce((acc, l) => {
    const subtotal = l.cantidad * l.precioUnitario;
    const desc = l.descuento || 0;
    const neto = subtotal - desc;
    const iva = neto * 0.01; // Tasa REA del 1%
    return {
      subtotal: acc.subtotal + subtotal,
      descuentos: acc.descuentos + desc,
      iva: acc.iva + iva,
      total: acc.total + (neto + iva)
    };
  }, { subtotal: 0, descuentos: 0, iva: 0, total: 0 });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validar líneas
    const lineasValidas = lineas.every(l => l.descripcion.trim() !== '' && l.cantidad > 0 && l.precioUnitario > 0);
    if (!lineasValidas) {
      toast.error('Por favor complete la descripción, cantidad y precio de todos los conceptos.');
      return;
    }

    // Mapear líneas al esquema del backend
    const lineasDetalleMapeadas = lineas.map((l, index) => {
      const subtotal = l.cantidad * l.precioUnitario;
      const desc = l.descuento || 0;
      const montoTotal = subtotal - desc + (subtotal - desc) * 0.01;
      return {
        numeroLinea: index + 1,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        unidadMedida: l.unidadMedida,
        precioUnitario: l.precioUnitario,
        subtotal: subtotal,
        descuento: desc,
        impuesto: {
          codigo: '01',
          codigoTarifa: '02', // 1%
          tarifa: 1,
          monto: (subtotal - desc) * 0.01,
          factorIVA: 0.01
        },
        impuestoNeto: (subtotal - desc) * 0.01,
        montoTotal: montoTotal
      };
    });

    onSave({
      consecutivo,
      emisor,
      receptor,
      lineaDetalle: lineasDetalleMapeadas,
      tipoProducto,
      condicionVenta,
      medioPago: [medioPago]
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Emitir Nueva Factura REA (1% IVA)" size="lg">
      <form onSubmit={handleSubmit} className="form-grid">
        <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', margin: '12px 0 4px' }}>Datos del Comprobante</h4>

        <div className="form-group">
          <label>Número de Consecutivo *</label>
          <input
            className="input"
            type="text"
            value={consecutivo}
            onChange={e => setConsecutivo(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Tipo de Producto *</label>
          <select
            className="input"
            value={tipoProducto}
            onChange={e => setTipoProducto(e.target.value)}
          >
            {TIPOS_PRODUCTO_REA.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Condición de Venta</label>
          <select
            className="input"
            value={condicionVenta}
            onChange={e => setCondicionVenta(e.target.value)}
          >
            {CONDICIONES_VENTA.map(cv => <option key={cv.value} value={cv.value}>{cv.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Medio de Pago</label>
          <select
            className="input"
            value={medioPago}
            onChange={e => setMedioPago(e.target.value)}
          >
            {MEDIOS_PAGO.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
          </select>
        </div>

        <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', margin: '16px 0 4px' }}>Receptor (Comprador)</h4>

        <div className="form-group">
          <label>Nombre del Receptor *</label>
          <input
            className="input"
            type="text"
            placeholder="Ej: Cooperativa Dos Pinos, Carnicería X"
            value={receptor.nombre}
            onChange={e => setReceptor({ ...receptor, nombre: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Tipo Cédula *</label>
          <select
            className="input"
            value={receptor.cedula.tipo}
            onChange={e => setReceptor({ ...receptor, cedula: { ...receptor.cedula, tipo: e.target.value } })}
          >
            <option value="01">Física</option>
            <option value="02">Jurídica</option>
            <option value="03">DIMEX</option>
          </select>
        </div>

        <div className="form-group">
          <label>Número Cédula *</label>
          <input
            className="input"
            type="text"
            placeholder="Sin guiones ni espacios"
            value={receptor.cedula.numero}
            onChange={e => setReceptor({ ...receptor, cedula: { ...receptor.cedula, numero: e.target.value } })}
            required
          />
        </div>

        <div className="form-group">
          <label>Correo Electrónico</label>
          <input
            className="input"
            type="email"
            placeholder="cliente@correo.com"
            value={receptor.correo}
            onChange={e => setReceptor({ ...receptor, correo: e.target.value })}
          />
        </div>

        <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', margin: '16px 0 4px' }}>Conceptos (Líneas de Detalle)</h4>

        <div style={{ gridColumn: 'span 2' }}>
          {lineas.map((linea, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <input
                className="input"
                style={{ flex: 3 }}
                type="text"
                placeholder="Descripción del concepto"
                value={linea.descripcion}
                onChange={e => updateLinea(idx, 'descripcion', e.target.value)}
                required
              />
              <input
                className="input"
                style={{ flex: 1 }}
                type="number"
                min="0.01"
                step="any"
                placeholder="Cant"
                value={linea.cantidad}
                onChange={e => updateLinea(idx, 'cantidad', Number(e.target.value))}
                required
              />
              <input
                className="input"
                style={{ flex: 1.5 }}
                type="number"
                min="0"
                placeholder="Precio Unit."
                value={linea.precioUnitario}
                onChange={e => updateLinea(idx, 'precioUnitario', Number(e.target.value))}
                required
              />
              <input
                className="input"
                style={{ flex: 1.5 }}
                type="number"
                min="0"
                placeholder="Desc. (₡)"
                value={linea.descuento}
                onChange={e => updateLinea(idx, 'descuento', Number(e.target.value))}
              />
              <button
                type="button"
                className="btn-icon"
                onClick={() => removeLinea(idx)}
                disabled={lineas.length === 1}
                title="Quitar concepto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addLinea} style={{ marginTop: '4px' }}>
            <Plus size={14} style={{ marginRight: '4px' }} /> Agregar Concepto
          </button>
        </div>

        <div className="form-resumen glass-card" style={{ gridColumn: 'span 2', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Subtotal:</span>
            <span className="text-mono">₡{totalResumen.subtotal.toLocaleString('es-CR')}</span>
          </div>
          {totalResumen.descuentos > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--color-error)' }}>
              <span>Descuentos:</span>
              <span className="text-mono">-₡{totalResumen.descuentos.toLocaleString('es-CR')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>IVA (1% REA):</span>
            <span className="text-mono">₡{totalResumen.iva.toLocaleString('es-CR')}</span>
          </div>
          <div className="form-resumen-total" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '6px' }}>
            <span>Total Comprobante:</span>
            <span className="text-mono">₡{Math.round(totalResumen.total).toLocaleString('es-CR')}</span>
          </div>
        </div>

        <div className="form-actions" style={{ gridColumn: 'span 2', marginTop: '16px' }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Emitiendo...' : 'Emitir Factura'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
