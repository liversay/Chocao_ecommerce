import { z } from "zod";
import { objectIdSchema } from "./common";

export const agendarCitaSchema = z.object({
  depositoId: objectIdSchema,
  slotId: objectIdSchema,
});

export const CHECKLIST_CLAVES = [
  "vin", "odometro", "placa", "frontal", "posterior",
  "lateral_izq", "lateral_der", "interior", "vano_motor",
] as const;

export const registrarChecklistItemSchema = z.object({
  clave: z.enum(CHECKLIST_CLAVES),
  fotoUrl: z.string().url(),
  geolocalizacion: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const registrarVinSchema = z.object({
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "El VIN debe tener 17 caracteres alfanuméricos válidos"),
});

export const inventarioItemSchema = z.object({
  item: z.enum(["llaves", "documentos", "llanta_repuesto", "herramientas", "bateria", "accesorio"]),
  cantidad: z.number().int().min(0),
  faltante: z.boolean(),
});

export const registrarInventarioSchema = z.object({ items: z.array(inventarioItemSchema).min(1) });

export const entregaIdParamSchema = z.object({ id: objectIdSchema });

export const listEntregasQuerySchema = z.object({
  estado: z.enum(["CITA_AGENDADA", "EN_INSPECCION", "ENTREGADA", "BLOQUEADA"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
