export interface NotificationPrefs {
  outbid: boolean;
  won: boolean;
  payment: boolean;
  watchClosing: boolean;
}

export interface User {
  _id: string;
  clerkId: string;
  name: string;
  email: string;
  role: "customer" | "admin" | "auditor" | "custodio";
  phone?: string;
  banned: boolean;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
}

export interface Vehicle {
  _id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  mileage: number;
  condition: "excellent" | "good" | "fair" | "poor";
  transmission?: "manual" | "automatic";
  bodyStyle?: "sedan" | "suv" | "pickup" | "van" | "panel";
  description: string;
  images: string[];
  basePrice: number;
  currentPrice: number;
  status: "draft" | "published" | "active" | "closed" | "awarded";
  auctionStartDate: string;
  auctionEndDate: string;
  createdAt: string;
}

export type EstadoAdjudicacion =
  | "ADJUDICADA_PENDIENTE_PAGO"
  | "PAGADA"
  | "INCUMPLIDA"
  | "OFERTA_A_SEGUNDO"
  | "DESIERTO_POR_INCUMPLIMIENTO";

export interface AdjudicacionInfo {
  id: string;
  estado: EstadoAdjudicacion;
  fechaLimitePago: string;
  // true solo para el bid que es el segundoBidId de la Adjudicacion — el
  // ganador original (ahora inhabilitado) comparte la misma Adjudicacion
  // por vehicleId pero nunca puede aceptar la oferta.
  esSegundoPostor: boolean;
}

export type EstadoEntrega = "CITA_AGENDADA" | "EN_INSPECCION" | "ENTREGADA" | "BLOQUEADA";

export interface EntregaInfo {
  id: string;
  estado: EstadoEntrega;
}

export interface Bid {
  _id: string;
  vehicleId: Vehicle | string;
  userId: User | string;
  amount: number;
  status: "active" | "outbid" | "winner" | "paid";
  createdAt: string;
  payment?: { id: string; status: string };
  adjudicacion?: AdjudicacionInfo | null;
  entrega?: EntregaInfo | null;
}

export interface ChecklistItem {
  clave: string;
  fotoUrl: string;
  capturadoEn: string;
  geolocalizacion?: { lat: number; lng: number };
}

export interface InventarioItem {
  item: string;
  cantidad: number;
  faltante: boolean;
}

export interface Entrega {
  _id: string;
  adjudicacionId: string;
  vehicleId: Vehicle | string;
  paymentId: string;
  compradorId: User | string;
  depositoId: string;
  citaProgramadaEn: string;
  reprogramaciones: number;
  custodioId?: string;
  estado: EstadoEntrega;
  checklist: ChecklistItem[];
  inventario: InventarioItem[];
  vinCapturado?: string;
  actaHash?: string;
  actaGeneradaEn?: string;
  motivoBloqueo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepositoSlot {
  _id: string;
  inicio: string;
  fin: string;
  capacidad: number;
  ocupados: number;
}

export interface Deposito {
  _id: string;
  nombre: string;
  direccion: string;
  slots: DepositoSlot[];
}

export interface Payment {
  _id: string;
  userId: string;
  vehicleId: string;
  bidId: string;
  stripeSessionId: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  createdAt: string;
}

export interface DashboardSummary {
  totalVehicles: number;
  totalBids: number;
  totalUsers: number;
  totalRevenue: number;
  activeAuctions: number;
  awardedVehicles: number;
}

export interface AppNotification {
  _id: string;
  type: "outbid" | "won" | "payment_confirmed" | "refunded" | "watch_closing" | "banned";
  title: string;
  body: string;
  data?: { vehicleId?: string; bidId?: string; paymentId?: string };
  read: boolean;
  createdAt: string;
}

export interface WatchlistItem {
  _id: string;
  vehicleId: Vehicle;
  createdAt: string;
}

export interface Proponente {
  _id: string;
  userId: string;
  documento: { canonico: string; original: string; categoria: string };
  estado: "BORRADOR" | "EN_REVISION" | "ACREDITADO" | "RECHAZADO";
  motivoRechazo?: string;
  aceptoPliego: boolean;
  aceptoPliegoEn?: string;
  verificacion: { estado: "PENDIENTE" | "APROBADO" | "RECHAZADO"; verificadoEn?: string };
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  paymentId: string;
  amount: number;
  paidAt: string;
  buyerName: string;
  buyerEmail: string;
  vehicle: { title: string; brand: string; model: string; year: number };
  stripeSessionId?: string;
}
