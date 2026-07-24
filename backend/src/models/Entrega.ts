import mongoose, { type HydratedDocument, Types } from "mongoose";

export type EstadoEntrega = "CITA_AGENDADA" | "EN_INSPECCION" | "ENTREGADA" | "BLOQUEADA";

export interface IChecklistItem {
  clave: string; // "vin" | "odometro" | "placa" | "frontal" | "posterior" | "lateral_izq" | "lateral_der" | "interior" | "vano_motor" | "danio_preexistente"
  fotoUrl: string;
  capturadoEn: Date;
  geolocalizacion?: { lat: number; lng: number };
}

export interface IInventarioItem {
  item: string; // "llaves" | "documentos" | "llanta_repuesto" | "herramientas" | "bateria" | "accesorio"
  cantidad: number;
  faltante: boolean;
}

export interface IEntrega {
  adjudicacionId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  paymentId: Types.ObjectId;
  compradorId: Types.ObjectId;
  depositoId: Types.ObjectId;
  citaProgramadaEn: Date;
  reprogramaciones: number;
  custodioId?: Types.ObjectId;
  estado: EstadoEntrega;
  checklist: IChecklistItem[];
  inventario: IInventarioItem[];
  vinCapturado?: string;
  actaHash?: string;
  actaGeneradaEn?: Date;
  motivoBloqueo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EntregaDoc = HydratedDocument<IEntrega>;

const checklistItemSchema = new mongoose.Schema<IChecklistItem>(
  {
    clave: { type: String, required: true },
    fotoUrl: { type: String, required: true },
    capturadoEn: { type: Date, required: true },
    geolocalizacion: { lat: Number, lng: Number },
  },
  { _id: false }
);

const inventarioItemSchema = new mongoose.Schema<IInventarioItem>(
  {
    item: { type: String, required: true },
    cantidad: { type: Number, required: true, default: 0 },
    faltante: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const entregaSchema = new mongoose.Schema<IEntrega>(
  {
    adjudicacionId: { type: mongoose.Schema.Types.ObjectId, ref: "Adjudicacion", required: true, unique: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    compradorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    depositoId: { type: mongoose.Schema.Types.ObjectId, ref: "Deposito", required: true },
    citaProgramadaEn: { type: Date, required: true },
    reprogramaciones: { type: Number, default: 0 },
    custodioId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    estado: { type: String, enum: ["CITA_AGENDADA", "EN_INSPECCION", "ENTREGADA", "BLOQUEADA"], default: "CITA_AGENDADA" },
    checklist: [checklistItemSchema],
    inventario: [inventarioItemSchema],
    vinCapturado: { type: String },
    actaHash: { type: String },
    actaGeneradaEn: { type: Date },
    motivoBloqueo: { type: String },
  },
  { timestamps: true }
);

export const Entrega = mongoose.model<IEntrega>("Entrega", entregaSchema);
