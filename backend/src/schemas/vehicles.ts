import { z } from "zod";

const CURRENT_YEAR = new Date().getFullYear();

export const vehicleStatusSchema = z.enum(
  ["draft", "published", "active", "closed", "awarded"],
  "Estado inválido"
);

export const createVehicleSchema = z.object({
  title: z.string("El título es obligatorio").trim().min(3, "El título debe tener al menos 3 caracteres").max(120),
  brand: z.string("La marca es obligatoria").trim().min(1, "La marca es obligatoria").max(60),
  model: z.string("El modelo es obligatorio").trim().min(1, "El modelo es obligatorio").max(60),
  year: z
    .number("El año debe ser numérico")
    .int("El año debe ser un entero")
    .min(1950, "El año no puede ser anterior a 1950")
    .max(CURRENT_YEAR + 1, `El año no puede ser mayor a ${CURRENT_YEAR + 1}`),
  color: z.string().trim().max(40).optional(),
  mileage: z.number("El kilometraje debe ser numérico").nonnegative("El kilometraje no puede ser negativo").optional(),
  condition: z.enum(["excellent", "good", "fair", "poor"], "Condición inválida").optional(),
  transmission: z.enum(["manual", "automatic"], "Transmisión inválida").optional(),
  bodyStyle: z.enum(["sedan", "suv", "pickup", "van", "panel"], "Estilo de carrocería inválido").optional(),
  description: z.string().trim().max(4000, "La descripción no puede superar 4000 caracteres").optional(),
  images: z
    .array(z.string().url("Cada imagen debe ser una URL válida").max(2048), "Las imágenes deben ser una lista")
    .max(6, "Máximo 6 imágenes")
    .optional(),
  basePrice: z
    .number("El precio base debe ser numérico")
    .positive("El precio base debe ser mayor a 0")
    .max(100_000_000, "El precio base es demasiado alto"),
  auctionStartDate: z.coerce.date("Fecha de inicio inválida").optional(),
  auctionEndDate: z.coerce.date("Fecha de fin inválida").optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const patchVehicleStatusSchema = z.object({ status: vehicleStatusSchema });

const STATUS_TOKENS = ["all", "draft", "published", "active", "closed", "awarded"];

export const listVehiclesQuerySchema = z.object({
  // Lista separada por comas (p.ej. "active,closed"); "all" es un token
  // válido que significa "todos los estados públicos" (ver services/vehicles).
  // La validación de cada token individual vive acá; la resolución de
  // "qué estados finalmente aplican" vive en el servicio.
  status: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine(
      (value) => !value || value.split(",").every((token) => STATUS_TOKENS.includes(token.trim())),
      "Estado inválido"
    ),
  brand: z.string().trim().max(300).optional(),
  minPrice: z.coerce.number("El precio mínimo debe ser numérico").nonnegative().optional(),
  maxPrice: z.coerce.number("El precio máximo debe ser numérico").nonnegative().optional(),
  minYear: z.coerce.number("El año mínimo debe ser numérico").int().optional(),
  maxYear: z.coerce.number("El año máximo debe ser numérico").int().optional(),
  minMileage: z.coerce.number("El kilometraje mínimo debe ser numérico").nonnegative().optional(),
  maxMileage: z.coerce.number("El kilometraje máximo debe ser numérico").nonnegative().optional(),
  transmission: z.string().trim().max(60).optional(),
  bodyStyle: z.string().trim().max(120).optional(),
  sort: z.enum(["price_desc", "price_asc", "newest", "oldest"], "Orden inválido").optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number("La página debe ser numérica").int().min(1).default(1),
  limit: z.coerce.number("El límite debe ser numérico").int().min(1).max(50).default(12),
});
