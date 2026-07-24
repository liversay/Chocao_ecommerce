import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface ISlot {
  inicio: Date;
  fin: Date;
  capacidad: number;
  ocupados: number;
}

export interface IDeposito {
  nombre: string;
  direccion: string;
  custodioIds: Types.ObjectId[];
  slots: ISlot[];
  createdAt: Date;
  updatedAt: Date;
}

export type DepositoDoc = HydratedDocument<IDeposito>;

const slotSchema = new mongoose.Schema<ISlot>(
  {
    inicio: { type: Date, required: true },
    fin: { type: Date, required: true },
    capacidad: { type: Number, required: true, default: 1 },
    ocupados: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const depositoSchema = new mongoose.Schema<IDeposito>(
  {
    nombre: { type: String, required: true },
    direccion: { type: String, required: true },
    custodioIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    slots: [slotSchema],
  },
  { timestamps: true }
);

export const Deposito = mongoose.model<IDeposito>("Deposito", depositoSchema);
