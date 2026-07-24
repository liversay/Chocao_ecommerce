import mongoose, { type HydratedDocument, Types } from "mongoose";

export type EstadoAdjudicacion =
  | "ADJUDICADA_PENDIENTE_PAGO"
  | "PAGADA"
  | "INCUMPLIDA"
  | "OFERTA_A_SEGUNDO"
  | "DESIERTO_POR_INCUMPLIMIENTO";

export interface IAdjudicacion {
  vehicleId: Types.ObjectId;
  ganadorBidId: Types.ObjectId;
  segundoBidId?: Types.ObjectId;
  segundoMonto?: number;
  fechaActo: Date;
  fechaLimitePago: Date;
  estado: EstadoAdjudicacion;
  ofertaSegundoVenceEn?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AdjudicacionDoc = HydratedDocument<IAdjudicacion>;

// Registro formal del acto de adjudicación (RP-01/RP-02): quién ganó, quién
// quedó de segundo (para RP-05 si el ganador incumple) y el plazo legal de
// pago en días hábiles. Un vehículo tiene a lo sumo una Adjudicacion viva
// (índice único por vehicleId) — se actualiza in-place cuando el segundo
// postor asume la adjudicación tras un incumplimiento.
const adjudicacionSchema = new mongoose.Schema<IAdjudicacion>(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true, unique: true },
    ganadorBidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", required: true },
    segundoBidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid" },
    segundoMonto: { type: Number },
    fechaActo: { type: Date, required: true },
    fechaLimitePago: { type: Date, required: true },
    estado: {
      type: String,
      enum: ["ADJUDICADA_PENDIENTE_PAGO", "PAGADA", "INCUMPLIDA", "OFERTA_A_SEGUNDO", "DESIERTO_POR_INCUMPLIMIENTO"],
      default: "ADJUDICADA_PENDIENTE_PAGO",
    },
    ofertaSegundoVenceEn: { type: Date },
  },
  { timestamps: true }
);

export const Adjudicacion = mongoose.model<IAdjudicacion>("Adjudicacion", adjudicacionSchema);
