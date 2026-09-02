import { useState, useEffect, useCallback } from 'react';
import { Edit3, Trash2, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import {
  obtenerInventarioAPI,
  obtenerResumenInventarioAPI,
  agregarBovinoAPI,
  actualizarBovinoAPI,
  eliminarBovinoAPI,
  agregarLoteAvesAPI,
  actualizarLoteAvesAPI,
  eliminarLoteAvesAPI,
  agregarEstanqueAPI,
  actualizarEstanqueAPI,
  eliminarEstanqueAPI,
  agregarColmenaAPI,
  actualizarColmenaAPI,
  eliminarColmenaAPI
} from '../services/api';
import { toast } from 'react-hot-toast';
import Modal from '../components/common/Modal';
import BovinoForm from '../components/inventario/BovinoForm';
import AvesForm from '../components/inventario/AvesForm';
import PecesForm from '../components/inventario/PecesForm';
import ColmenaForm from '../components/inventario/ColmenaForm';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import './InventarioPage.css';

export default function InventarioPage() {
  const [inventario, setInventario] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tabActiva, setTabActiva] = useState('bovinos');

  // Control del modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [elementoEdicion, setElementoEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // { id, tipo }

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [invRes, resumenRes] = await Promise.all([
        obtenerInventarioAPI(),
        obtenerResumenInventarioAPI(),
      ]);
      setInventario(invRes.data);
      setResumen(resumenRes.data);
    } catch (err) {
      console.error(err);
      setError('Error cargando inventario');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos();
  }, [cargarDatos]);

  const handleGuardar = async (datos) => {
    setGuardando(true);
    try {
      if (tabActiva === 'bovinos') {
        if (elementoEdicion) {
          await actualizarBovinoAPI(elementoEdicion._id, datos);
          toast.success('Bovino actualizado correctamente');
        } else {
          await agregarBovinoAPI(datos);
          toast.success('Bovino registrado correctamente');
        }
      } else if (tabActiva === 'aves') {
        if (elementoEdicion) {
          await actualizarLoteAvesAPI(elementoEdicion._id, datos);
          toast.success('Lote de aves actualizado');
        } else {
          await agregarLoteAvesAPI(datos);
          toast.success('Lote de aves registrado');
        }
      } else if (tabActiva === 'peces') {
        if (elementoEdicion) {
          await actualizarEstanqueAPI(elementoEdicion._id, datos);
          toast.success('Estanque actualizado');
        } else {
          await agregarEstanqueAPI(datos);
          toast.success('Estanque registrado');
        }
      } else if (tabActiva === 'colmenas') {
        if (elementoEdicion) {
          await actualizarColmenaAPI(elementoEdicion._id, datos);
          toast.success('Colmena actualizada');
        } else {
          await agregarColmenaAPI(datos);
          toast.success('Colmena registrada');
        }
      }
      setModalAbierto(false);
      setElementoEdicion(null);
      await cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = (id) => {
    setConfirmarEliminar({ id, tipo: tabActiva });
  };

  const confirmarEliminarAccion = async () => {
    if (!confirmarEliminar) return;
    const { id, tipo } = confirmarEliminar;
    try {
      if (tipo === 'bovinos') {
        await eliminarBovinoAPI(id);
        toast.success('Bovino eliminado');
      } else if (tipo === 'aves') {
        await eliminarLoteAvesAPI(id);
        toast.success('Lote de aves eliminado');
      } else if (tipo === 'peces') {
        await eliminarEstanqueAPI(id);
        toast.success('Estanque eliminado');
      } else if (tipo === 'colmenas') {
        await eliminarColmenaAPI(id);
        toast.success('Colmena eliminada');
      }
      await cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar el elemento');
    } finally {
      setConfirmarEliminar(null);
    }
  };

  const abrirRegistro = () => {
    setElementoEdicion(null);
    setModalAbierto(true);
  };

  const abrirEdicion = (elemento) => {
    setElementoEdicion(elemento);
    setModalAbierto(true);
  };

  if (cargando) {
    return (
      <div className="page-content">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400">Cargando inventario agropecuario...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'bovinos', label: 'Bovinos', icon: '🐄', count: resumen?.totalBovinos || 0 },
    { id: 'aves', label: 'Aves', icon: '🐔', count: resumen?.totalAves || 0 },
    { id: 'peces', label: 'Peces', icon: '🐟', count: resumen?.totalPeces || 0 },
    { id: 'colmenas', label: 'Colmenas', icon: '🍯', count: inventario?.colmenas?.filter(c => c.activo).length || 0 },
  ];

  const renderFormulario = () => {
    switch (tabActiva) {
      case 'bovinos':
        return <BovinoForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      case 'aves':
        return <AvesForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      case 'peces':
        return <PecesForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      case 'colmenas':
        return <ColmenaForm animal={elementoEdicion} onSave={handleGuardar} onCancel={() => setModalAbierto(false)} guardando={guardando} />;
      default:
        return null;
    }
  };

  return (
    <div className="page-content">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-2xl md:text-3xl font-bold font-heading text-white">Inventario Agropecuario</h1>
          <p className="page-subtitle text-slate-400 text-sm mt-1">Control multiespecie de bovinos, aves, acuicultura y apicultura</p>
        </div>
        <Button variant="gradient" size="default" className="gap-2 shadow-md shadow-emerald-950/40 self-start sm:self-auto" onClick={abrirRegistro}>
          <Plus size={18} /> Registrar {tabActiva === 'bovinos' ? 'Bovino' : tabActiva === 'aves' ? 'Lote de Aves' : tabActiva === 'peces' ? 'Estanque' : 'Colmena'}
        </Button>
      </div>

      {/* Resumen Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
              <span>🐄</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">Bovinos Activos</span>
              <div className="text-2xl font-bold text-white font-heading mt-0.5">{resumen?.totalBovinos || 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
              <span>🐔</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">Aves en Producción</span>
              <div className="text-2xl font-bold text-white font-heading mt-0.5">{resumen?.totalAves || 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-xl shrink-0">
              <span>🐟</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">Biomasa Peces (kg)</span>
              <div className="text-2xl font-bold text-white font-heading mt-0.5">{resumen?.totalBiomasa?.toLocaleString() || 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
              <span>🍯</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">Miel Producida (kg)</span>
              <div className="text-2xl font-bold text-white font-heading mt-0.5">{resumen?.totalMiel?.toLocaleString() || 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1.5 gap-1 mb-6 bg-slate-900/80 border border-slate-800 rounded-xl">
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all gap-1.5"
            >
              <span>{tab.icon}</span> {tab.label} <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-slate-800">{tab.count}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Bovinos */}
        <TabsContent value="bovinos">
          {inventario?.bovinos?.filter(b => b.activo).length === 0 ? (
            <Card className="p-8 text-center border-slate-800 bg-slate-900/60">
              <p className="text-slate-400 text-sm">No hay bovinos registrados aún. Usa el botón superior para registrar uno.</p>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag / Arete</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Raza</TableHead>
                  <TableHead>Peso (kg)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventario.bovinos.filter(b => b.activo).map(b => (
                  <TableRow key={b._id}>
                    <TableCell className="font-mono font-semibold text-emerald-400">{b.tagId}</TableCell>
                    <TableCell className="font-medium text-white">{b.nombre || '-'}</TableCell>
                    <TableCell className="capitalize text-slate-300">{b.tipo}</TableCell>
                    <TableCell className="text-slate-400">{b.raza || '-'}</TableCell>
                    <TableCell className="font-mono text-slate-200">{b.pesoActualKg} kg</TableCell>
                    <TableCell>
                      <Badge variant={b.estadoSanitario === 'sano' ? 'default' : 'amber'} className="text-[11px] capitalize">
                        {b.estadoSanitario}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => abrirEdicion(b)} title="Editar">
                          <Edit3 size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => handleEliminar(b._id)} title="Eliminar">
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Tab Aves */}
        <TabsContent value="aves">
          {inventario?.lotesAves?.filter(l => l.activo).length === 0 ? (
            <Card className="p-8 text-center border-slate-800 bg-slate-900/60">
              <p className="text-slate-400 text-sm">No hay lotes de aves registrados.</p>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote ID</TableHead>
                  <TableHead>Especie</TableHead>
                  <TableHead>Galpón</TableHead>
                  <TableHead>Aves Actuales</TableHead>
                  <TableHead>Huevos / Cartones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventario.lotesAves.filter(l => l.activo).map(l => (
                  <TableRow key={l._id}>
                    <TableCell className="font-mono font-semibold text-amber-400">{l.loteId}</TableCell>
                    <TableCell className="font-medium text-white">{l.especie}</TableCell>
                    <TableCell className="text-slate-300">{l.galpon || '-'}</TableCell>
                    <TableCell className="font-mono text-slate-200">{l.cicloActual?.nActualAves || 0}</TableCell>
                    <TableCell className="font-mono text-slate-300">{l.totalHuevosProducidos || 0} / {l.totalCartonesProducidos || 0}</TableCell>
                    <TableCell>
                      <Badge variant="blue" className="text-[11px] capitalize">
                        {l.cicloActual?.estado || 'Activo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => abrirEdicion(l)} title="Editar">
                          <Edit3 size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => handleEliminar(l._id)} title="Eliminar">
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Tab Peces */}
        <TabsContent value="peces">
          {inventario?.estanques?.filter(e => e.activo).length === 0 ? (
            <Card className="p-8 text-center border-slate-800 bg-slate-900/60">
              <p className="text-slate-400 text-sm">No hay estanques registrados.</p>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estanque</TableHead>
                  <TableHead>Especie</TableHead>
                  <TableHead>Capacidad (m³)</TableHead>
                  <TableHead>Peces</TableHead>
                  <TableHead>Biomasa (kg)</TableHead>
                  <TableHead>FCA</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventario.estanques.filter(e => e.activo).map(e => (
                  <TableRow key={e._id}>
                    <TableCell className="font-mono font-semibold text-sky-400">{e.estanqueId}</TableCell>
                    <TableCell className="font-medium text-white">{e.especie}</TableCell>
                    <TableCell className="font-mono text-slate-300">{e.capacidadM3} m³</TableCell>
                    <TableCell className="font-mono text-slate-200">{e.nActual}</TableCell>
                    <TableCell className="font-mono text-slate-200">{e.biomasaTotalKg?.toLocaleString()} kg</TableCell>
                    <TableCell className="font-mono text-emerald-400">{e.tasaConversionAlimenticia?.toFixed(2) || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="text-[11px] capitalize">
                        {e.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => abrirEdicion(e)} title="Editar">
                          <Edit3 size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => handleEliminar(e._id)} title="Eliminar">
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Tab Colmenas */}
        <TabsContent value="colmenas">
          {inventario?.colmenas?.filter(c => c.activo).length === 0 ? (
            <Card className="p-8 text-center border-slate-800 bg-slate-900/60">
              <p className="text-slate-400 text-sm">No hay colmenas registradas.</p>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colmena</TableHead>
                  <TableHead>Especie</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Estado Colonia</TableHead>
                  <TableHead>Miel Total (kg)</TableHead>
                  <TableHead>Extracciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventario.colmenas.filter(c => c.activo).map(c => (
                  <TableRow key={c._id}>
                    <TableCell className="font-mono font-semibold text-amber-400">{c.colmenaId}</TableCell>
                    <TableCell className="font-medium text-white">{c.especie}</TableCell>
                    <TableCell className="text-slate-300">{c.ubicacion || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="amber" className="text-[11px] capitalize">
                        {c.estadoColonia}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-emerald-400 font-semibold">{c.mielProducidaTotalKg} kg</TableCell>
                    <TableCell className="font-mono text-slate-300">{c.extracciones?.length || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => abrirEdicion(c)} title="Editar">
                          <Edit3 size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => handleEliminar(c._id)} title="Eliminar">
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={`${elementoEdicion ? 'Editar' : 'Registrar'} ${
          tabActiva === 'bovinos' ? 'Bovino' : tabActiva === 'aves' ? 'Lote de Aves' : tabActiva === 'peces' ? 'Estanque' : 'Colmena'
        }`}
        size="lg"
      >
        {renderFormulario()}
      </Modal>

      {confirmarEliminar && (
        <Modal
          isOpen
          onClose={() => setConfirmarEliminar(null)}
          title="Confirmar Eliminación"
          size="sm"
        >
          <div className="confirm-dialog-body flex items-start gap-3 p-2">
            <AlertTriangle size={24} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-slate-200 text-sm">¿Está seguro de que desea eliminar este registro? Esta acción no se puede deshacer.</span>
          </div>
          <div className="form-actions flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => setConfirmarEliminar(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmarEliminarAccion}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
