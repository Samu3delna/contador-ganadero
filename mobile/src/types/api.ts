export interface User {
  _id: string;
  nombre: string;
  email: string;
  tenantId: string;
  rol: string;
  plan: "free" | "pro";
  nombreFinca?: string;
  tenant?: { nombreFinca?: string; plan?: string; emailAlias?: string };
}
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}
export interface Challenge {
  mfaRequired: true;
  mfaToken: string;
  mensaje: string;
}
export interface Invoice {
  _id: string;
  fechaEmision: string;
  emisor?: { nombre: string };
  estado: string;
  categoriaIA?: string;
  categoriaManual?: string;
  esDeducible?: boolean;
  resumenFactura?: {
    totalComprobante?: number;
    totalVenta?: number;
    totalImpuesto?: number;
  };
  alertasTarifa?: { mensaje?: string }[];
}
export interface Page<T> {
  facturas: T[];
  total: number;
  pagina: number;
  totalPaginas: number;
}
export interface Dashboard {
  periodoFiscal: number;
  cuatrimestreActual: number;
  resumen: {
    totalIngresos: number;
    totalGastos: number;
    utilidadNeta?: number;
    ivaAPagar?: number;
    rentaAPagar?: number;
  };
  ivaProyectado?: { totalFacturas: number };
}
