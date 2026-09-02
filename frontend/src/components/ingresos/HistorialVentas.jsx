import { Trash2, DollarSign } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

export default function HistorialVentas({ cargando, ingresos, handleEliminar }) {
  if (cargando) {
    return (
      <Card className="p-10 text-center border-slate-800 bg-slate-900/60">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Cargando ventas registradas...</p>
        </div>
      </Card>
    );
  }

  if (ingresos.length === 0) {
    return (
      <Card className="p-10 text-center border-slate-800 bg-slate-900/60">
        <div className="flex flex-col items-center justify-center gap-2">
          <DollarSign size={40} className="text-slate-600" />
          <p className="text-sm text-slate-400">No hay ventas registradas aún. ¡Registra la primera venta de tu finca!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md overflow-hidden">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold font-heading text-white">Historial de Ventas e Ingresos</CardTitle>
          <Badge variant="default" className="text-xs">
            {ingresos.length} registro(s)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo de Venta</TableHead>
              <TableHead>Cantidad / Cabezas</TableHead>
              <TableHead>Total Comprobante</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingresos.map(ing => (
              <TableRow key={ing._id} className="hover:bg-slate-800/50">
                <TableCell className="font-mono text-xs text-slate-300 whitespace-nowrap">
                  {new Date(ing.fecha).toLocaleDateString('es-CR')}
                </TableCell>
                <TableCell className="font-medium text-white">
                  {ing.descripcion}
                </TableCell>
                <TableCell>
                  <Badge variant="default" className="capitalize text-[11px]">
                    {ing.tipoGanado}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-slate-300">
                  {ing.cantidadCabezas}
                </TableCell>
                <TableCell className="font-mono font-semibold text-emerald-400">
                  {formatCRC(ing.montoTotal)}
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-400 hover:text-red-400"
                    onClick={() => handleEliminar(ing._id)} 
                    title="Eliminar ingreso"
                  >
                    <Trash2 size={15} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
