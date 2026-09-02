import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';

const TIPOS_GANADO = ['novillo', 'vaca', 'ternero', 'ternera', 'toro', 'vaquilla', 'buey', 'otro'];
const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

export default function FormularioIngreso({ form, setForm, handleSubmit, setMostrarForm, guardando, subtotal, ivaCalc }) {
  return (
    <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl mb-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      <CardHeader className="p-6 pb-4 border-b border-slate-800">
        <CardTitle className="text-xl font-bold font-heading text-white">Registrar Nueva Venta de Ganado</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fecha" className="text-xs text-slate-300">Fecha de la Venta</Label>
              <Input
                id="fecha"
                type="date"
                value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipoGanado" className="text-xs text-slate-300">Tipo de Ganado</Label>
              <select
                id="tipoGanado"
                className="flex h-10 w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                value={form.tipoGanado}
                onChange={e => setForm({ ...form, tipoGanado: e.target.value })}
              >
                {TIPOS_GANADO.map(t => (
                  <option key={t} value={t} className="bg-slate-900 text-slate-100">
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cantidadCabezas" className="text-xs text-slate-300">Cantidad de Cabezas</Label>
              <Input
                id="cantidadCabezas"
                type="number"
                min="1"
                value={form.cantidadCabezas}
                onChange={e => setForm({ ...form, cantidadCabezas: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="precioUnitario" className="text-xs text-slate-300">Precio Unitario (₡)</Label>
              <Input
                id="precioUnitario"
                type="number"
                min="0"
                value={form.precioUnitario}
                onChange={e => setForm({ ...form, precioUnitario: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tasaIVA" className="text-xs text-slate-300">Tasa de IVA (%)</Label>
              <select
                id="tasaIVA"
                className="flex h-10 w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                value={form.tasaIVA}
                onChange={e => setForm({ ...form, tasaIVA: Number(e.target.value) })}
              >
                <option value={0} className="bg-slate-900 text-slate-100">0% — Exento</option>
                <option value={1} className="bg-slate-900 text-slate-100">1% — Canasta Básica (REA)</option>
                <option value={13} className="bg-slate-900 text-slate-100">13% — General</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descripcion" className="text-xs text-slate-300">Descripción</Label>
              <Input
                id="descripcion"
                placeholder="Ej: Lote de 4 novillos para subasta"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compradorNombre" className="text-xs text-slate-300">Nombre Comprador (Opcional)</Label>
              <Input
                id="compradorNombre"
                placeholder="Nombre o subasta"
                value={form.comprador.nombre}
                onChange={e => setForm({ ...form, comprador: { ...form.comprador, nombre: e.target.value } })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compradorCedula" className="text-xs text-slate-300">Cédula Comprador (Opcional)</Label>
              <Input
                id="compradorCedula"
                placeholder="Cédula física o jurídica"
                value={form.comprador.cedula}
                onChange={e => setForm({ ...form, comprador: { ...form.comprador, cedula: e.target.value } })}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
            <div>
              <span className="text-xs text-slate-400 block">Subtotal</span>
              <span className="text-lg font-mono font-semibold text-white">{formatCRC(subtotal)}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">IVA ({form.tasaIVA}%)</span>
              <span className="text-lg font-mono font-semibold text-amber-400">{formatCRC(ivaCalc)}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Total Liquidación</span>
              <span className="text-xl font-mono font-bold text-emerald-400">{formatCRC(subtotal + ivaCalc)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setMostrarForm(false)}>
              Cancelar
            </Button>
            <Button variant="gradient" type="submit" disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" /> Guardando...
                </>
              ) : (
                'Guardar Venta'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
