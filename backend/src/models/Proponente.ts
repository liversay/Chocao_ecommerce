import mongoose, { type HydratedDocument, Types } from "mongoose";

export type EstadoProponente = "BORRADOR" | "EN_REVISION" | "ACREDITADO" | "RECHAZADO";
export type MotivoRechazo = "DOCUMENTO_INVALIDO" | "DOCUMENTO_DUPLICADO" | "VERIFICACION_FALLIDA" | "OTRO";

export interface IProponente {
  userId: Types.ObjectId;
  documento: {
    canonico: string;
    original: string;
    categoria: string;
  };
  estado: EstadoProponente;
  motivoRechazo?: MotivoRechazo;
  aceptoPliego: boolean;
  aceptoPliegoEn?: Date;
  verificacion: {
    estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
    verificadoEn?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type ProponenteDoc = HydratedDocument<IProponente>;

const proponenteSchema = new mongoose.Schema<IProponente>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    documento: {
      canonico: { type: String, required: true, unique: true },
      original: { type: String, required: true },
      categoria: { type: String, required: true },
    },
    estado: {
      type: String,
      enum: ["BORRADOR", "EN_REVISION", "ACREDITADO", "RECHAZADO"],
      default: "BORRADOR",
    },
    motivoRechazo: {
      type: String,
      enum: ["DOCUMENTO_INVALIDO", "DOCUMENTO_DUPLICADO", "VERIFICACION_FALLIDA", "OTRO"],
    },
    aceptoPliego: { type: Boolean, default: false },
    aceptoPliegoEn: { type: Date },
    verificacion: {
      estado: { type: String, enum: ["PENDIENTE", "APROBADO", "RECHAZADO"], default: "PENDIENTE" },
      verificadoEn: { type: Date },
    },
  },
  { timestamps: true }
);

export const Proponente = mongoose.model<IProponente>("Proponente", proponenteSchema);
