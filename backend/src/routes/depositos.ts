import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middlewares/auth";
import { Deposito } from "../models/Deposito";

const depositos = new Hono<AppEnv>();

// Listado mínimo de depósitos para que el comprador elija dónde/cuándo
// agendar su cita de entrega (MyPurchasesPage). Sin restricción de permiso
// más allá de estar autenticado: es solo información de ubicación/horario,
// no datos sensibles de ninguna entrega concreta.
depositos.get("/", requireAuth, async (c) => {
  const list = await Deposito.find().select("nombre direccion slots");
  return c.json(
    list.map((d) => ({
      _id: d._id.toString(),
      nombre: d.nombre,
      direccion: d.direccion,
      slots: d.slots.map((s) => ({
        _id: (s as unknown as { _id: { toString(): string } })._id.toString(),
        inicio: s.inicio,
        fin: s.fin,
        capacidad: s.capacidad,
        ocupados: s.ocupados,
      })),
    }))
  );
});

export default depositos;
