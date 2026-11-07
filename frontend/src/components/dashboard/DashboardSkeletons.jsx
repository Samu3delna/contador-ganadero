import { Skeleton } from '../ui/skeleton';
import './DashboardSkeletons.css';

export function DashboardHeaderSkeleton() {
  return <div className="ds-header" aria-hidden="true"><div><Skeleton className="ds-title" /><Skeleton className="ds-subtitle" /></div><Skeleton className="ds-action" /></div>;
}
export function MetricCardSkeleton() {
  return <div className="ds-panel ds-metric" aria-hidden="true"><Skeleton className="ds-label" /><Skeleton className="ds-value" /><Skeleton className="ds-subtitle" /></div>;
}
export function ChartSkeleton() {
  return <div className="ds-panel ds-chart" aria-hidden="true"><Skeleton className="ds-label" /><Skeleton className="ds-plot" /></div>;
}
export function ListSkeleton() {
  return <div className="ds-panel ds-list" aria-hidden="true"><Skeleton className="ds-label" />{[0,1,2].map(i => <Skeleton key={i} className="ds-row" />)}</div>;
}
export function ActionSkeleton() {
  return <Skeleton className="ds-action" aria-hidden="true" />;
}
export function ProducerDashboardSkeleton() {
  return <div className="page-content producer-dashboard" aria-busy="true"><p className="sr-only" role="status">Cargando métricas de la finca…</p><DashboardHeaderSkeleton /><div className="producer-metrics">{[0,1,2,3].map(i => <MetricCardSkeleton key={i} />)}</div><ChartSkeleton /><div className="producer-bottom"><ListSkeleton /><ListSkeleton /></div><div className="producer-actions"><ActionSkeleton /><ActionSkeleton /><ActionSkeleton /></div></div>;
}
