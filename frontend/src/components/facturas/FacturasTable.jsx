import { Fragment } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, CheckCircle, XCircle, FileCode, Download, FileText } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

const formatCRC = (n) => `₡${(n || 0).toLocaleString('es-CR')}`;

const CATEGORIAS_LABEL = {
  veterinaria: 'Veterinaria',
  alimentacion_animal: 'Alimentación Animal',
  maquinaria_equipo: 'Maquinaria',
  transporte: 'Transporte',
  servicios_profesionales: 'Servicios Prof.',
  combustible: 'Combustible',
  mantenimiento: 'Mantenimiento',
  seguros: 'Seguros',
  insumos_agropecuarios: 'Insumos Agro',
  salarios: 'Salarios',
  servicios_publicos: 'Serv. Públicos',
  otros: 'Otros',
  sin_clasificar: 'Sin Clasificar',
};

export default function FacturasTable({ 
  cargando, facturas, filtroAlertas, detalleExpandido, toggleDetalle, 
  descargando, handleDescargarXML, handleDescargarPDF 
}) {
  if (cargando) {
    return (
      <Card className="p-12 text-center border-slate-800 bg-slate-900/60">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Cargando facturas electrónicas...</p>
        </div>
      </Card>
    );
  }

  if (facturas.length === 0) {
    return (
      <Card className="p-12 text-center border-slate-800 bg-slate-900/60">
        <div className="flex flex-col items-center justify-center gap-3">
          <FileText size={44} className="text-slate-600" />
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {filtroAlertas ? 'No hay facturas con alertas de tarifa incorrecta.' : 'No hay facturas aún. Configura tu correo IMAP o sincroniza para importar facturas XML.'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Table id="tabla-facturas">
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"><span className="sr-only">Expandir</span></TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Emisor</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>IVA</TableHead>
          <TableHead>Tarifa REA</TableHead>
          <TableHead>Categoría IA</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {facturas.map(f => (
          <Fragment key={f._id}>
            <TableRow 
              className={`cursor-pointer transition-colors ${f.resumenValidacionTarifa?.alertasError > 0 ? 'bg-amber-950/20 hover:bg-amber-950/30' : ''}`}
              onClick={() => toggleDetalle(f._id)}
            >
              <TableCell className="text-slate-400">
                {detalleExpandido === f._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </TableCell>
              <TableCell className="whitespace-nowrap text-slate-300 font-mono text-xs">
                {new Date(f.fechaEmision).toLocaleDateString('es-CR')}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-white text-sm">{f.emisor?.nombre || '—'}</span>
                  {f.carpetaOrigen && f.carpetaOrigen !== 'INBOX' && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-800 border-slate-700 text-slate-400">
                      {f.carpetaOrigen.replace('[Gmail]/', '')}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-mono font-semibold text-white whitespace-nowrap">
                {formatCRC(f.resumenFactura?.totalComprobante)}
              </TableCell>
              <TableCell className="font-mono text-slate-300 whitespace-nowrap">
                {formatCRC(f.resumenFactura?.totalImpuesto)}
              </TableCell>
              <TableCell>
                {f.resumenValidacionTarifa?.alertasError > 0 ? (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle size={11} /> {f.resumenValidacionTarifa.alertasError} alerta(s)
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-[10px] gap-1">
                    <CheckCircle size={11} /> OK
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={f.confianzaIA > 0.7 ? 'default' : f.confianzaIA > 0.4 ? 'amber' : 'secondary'}
                  className="text-[11px]"
                >
                  {CATEGORIAS_LABEL[f.categoriaManual || f.categoriaIA] || f.categoriaIA}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={f.estado === 'procesada' ? 'default' : f.estado === 'revision' ? 'amber' : 'destructive'}
                  className="text-[10px] uppercase font-bold"
                >
                  {f.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-emerald-400"
                    title="Descargar XML"
                    onClick={(e) => handleDescargarXML(f._id, e)}
                    disabled={descargando === f._id}
                    id={`btn-xml-${f._id}`}
                  >
                    <FileCode size={16} />
                  </Button>
                  {f.archivoPDF && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-sky-400"
                      title="Descargar PDF"
                      onClick={(e) => handleDescargarPDF(f._id, e)}
                      disabled={descargando === f._id}
                      id={`btn-pdf-${f._id}`}
                    >
                      <Download size={16} />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            
            {/* Fila expandida con detalle */}
            {detalleExpandido === f._id && (
              <TableRow key={`${f._id}-detail`} className="bg-slate-950/60 hover:bg-slate-950/70 border-b border-slate-800">
                <TableCell colSpan={9} className="p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                      <div><strong className="text-slate-400">Clave:</strong> <span className="font-mono text-slate-200 text-[11px] block truncate">{f.claveNumerica || 'N/A'}</span></div>
                      <div><strong className="text-slate-400">Esquema:</strong> <span className="text-slate-200 ml-1">{f.versionEsquema || 'v4.4'}</span></div>
                      <div><strong className="text-slate-400">Moneda:</strong> <span className="text-slate-200 ml-1">{f.moneda || 'CRC'}</span></div>
                      <div><strong className="text-slate-400">Carpeta:</strong> <span className="text-slate-200 ml-1">{f.carpetaOrigen || 'INBOX'}</span></div>
                    </div>

                    {f.alertasTarifa && f.alertasTarifa.length > 0 && (
                      <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-500/30 space-y-2">
                        <h4 className="text-xs font-bold font-heading text-red-300 flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-red-400" /> Alertas de Tarifa Detectadas
                        </h4>
                        <div className="space-y-1.5">
                          {f.alertasTarifa.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-red-200">
                              {a.severidad === 'error' ? <XCircle size={13} className="text-red-400 shrink-0" /> : <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                              <span>{a.mensaje}</span>
                            </div>
                          ))}
                        </div>
                        {f.resumenValidacionTarifa?.ahorrosPerdidos > 0 && (
                          <div className="text-xs text-amber-300 font-semibold pt-1 border-t border-red-500/20">
                            Sobrecosto por tarifa: <strong>{formatCRC(f.resumenValidacionTarifa.ahorrosPerdidos)}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {f.lineaDetalle && f.lineaDetalle.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-300">Detalle de líneas facturadas</h4>
                        <div className="overflow-x-auto rounded-lg border border-slate-800">
                          <table className="w-full text-xs text-slate-300">
                            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                              <tr>
                                <th className="p-2 text-left">#</th>
                                <th className="p-2 text-left">Descripción</th>
                                <th className="p-2 text-left">Cant.</th>
                                <th className="p-2 text-left">Precio Unit.</th>
                                <th className="p-2 text-left">Tarifa</th>
                                <th className="p-2 text-left">IVA %</th>
                                <th className="p-2 text-left">IVA ₡</th>
                                <th className="p-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                              {f.lineaDetalle.map((l, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/40">
                                  <td className="p-2 font-mono">{l.numeroLinea || idx + 1}</td>
                                  <td className="p-2 font-medium text-white">{l.descripcion}</td>
                                  <td className="p-2 font-mono">{l.cantidad}</td>
                                  <td className="p-2 font-mono">{formatCRC(l.precioUnitario)}</td>
                                  <td className="p-2">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-800 border-slate-700">
                                      {l.impuesto?.codigoTarifa || '—'}
                                    </Badge>
                                  </td>
                                  <td className="p-2 font-mono">{l.impuesto?.tarifa ?? '—'}%</td>
                                  <td className="p-2 font-mono text-slate-300">{formatCRC(l.impuesto?.monto)}</td>
                                  <td className="p-2 font-mono font-semibold text-right text-emerald-400">{formatCRC(l.montoTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
