import { useState } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '../common/Modal';
import { guardarConfigHaciendaAPI, probarConfigHaciendaAPI } from '../../services/api';

export default function ConfigHaciendaModal({ isOpen, onClose, actual, onSaved }) {
  const [form, setForm] = useState(() => ({ ambiente: actual?.ambiente || 'local', sucursal: actual?.sucursal || '001', terminal: actual?.terminal || '00001', codigoActividad: actual?.codigoActividad || '', proveedorSistemas: actual?.proveedorSistemas || '', usuarioHacienda: '', passwordHacienda: '', pinCertificado: '', certificadoP12Base64: '' }));
  const [ocupado, setOcupado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const cambiar = (campo, value) => setForm(prev => ({ ...prev, [campo]: value }));
  const leerCertificado = async (event) => {
    const file = event.target.files?.[0];
    cambiar('certificadoP12Base64', '');
    if (!file) return;
    if (file.size > 1024 * 1024) { toast.error('El certificado debe pesar como máximo 1 MiB'); return; }
    setLeyendo(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (const byte of buffer) binary += String.fromCharCode(byte);
      cambiar('certificadoP12Base64', btoa(binary));
    } catch { toast.error('No se pudo leer el certificado'); }
    finally { setLeyendo(false); }
  };
  const guardar = async (event) => {
    event.preventDefault(); setOcupado(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
      await guardarConfigHaciendaAPI(payload);
      toast.success('Configuración guardada');
      await onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setOcupado(false); }
  };
  const probar = async () => {
    setOcupado(true);
    try { const { data } = await probarConfigHaciendaAPI(); toast.success(data.mensaje); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setOcupado(false); }
  };
  return <Modal isOpen={isOpen} onClose={onClose} title="Configuración de Hacienda" size="lg">
    <form className="form-grid" onSubmit={guardar}>
      <label className="form-group">Ambiente<select className="input" value={form.ambiente} onChange={e => cambiar('ambiente', e.target.value)}><option value="local">Local (simulación)</option><option value="sandbox">Sandbox (pruebas)</option><option value="produccion">Producción</option></select></label>
      {[['sucursal','Sucursal (3 dígitos)'],['terminal','Terminal (5 dígitos)'],['codigoActividad','Actividad económica (6 dígitos)'],['proveedorSistemas','Identificación del proveedor del sistema']].map(([campo,label]) => <label key={campo} className="form-group">{label} *<input className="input" value={form[campo]} onChange={e => cambiar(campo,e.target.value)} required /></label>)}
      {form.ambiente !== 'local' && <>
        <p className="form-grid-full">Al editar una configuración existente, dejá los secretos vacíos para conservarlos. El certificado y el usuario deben corresponder a esta finca y al ambiente seleccionado.</p>
        <label className="form-group">Certificado .p12<input className="input" type="file" accept=".p12,.pfx" onChange={leerCertificado} disabled={ocupado} /></label>
        {[['pinCertificado','PIN del certificado','password'],['usuarioHacienda','Usuario Hacienda (cpf-…)','text'],['passwordHacienda','Contraseña Hacienda','password']].map(([campo,label,type]) => <label key={campo} className="form-group">{label}<input className="input" type={type} autoComplete="off" value={form[campo]} onChange={e => cambiar(campo,e.target.value)} /></label>)}
      </>}
      <p className="form-grid-full">“Probar configuración guardada” verifica certificado y acceso. No envía comprobantes ni confirma su aceptación.</p>
      <div className="form-actions form-grid-full"><button className="btn btn-secondary" type="button" onClick={probar} disabled={ocupado || leyendo}>Probar configuración guardada</button><button className="btn btn-primary" type="submit" disabled={ocupado || leyendo}>{ocupado ? 'Procesando…' : 'Guardar configuración'}</button></div>
    </form>
  </Modal>;
}
