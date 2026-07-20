import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  errorHandler,
} from "./errors";

function appWith(error: Error) {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.get("/boom", () => {
    throw error;
  });
  return app;
}

describe("errorHandler", () => {
  test.each([
    [new ValidationError("monto inválido"), 400, "monto inválido"],
    [new UnauthorizedError(), 401, "No autorizado"],
    [new ForbiddenError(), 403, "No tienes permisos para realizar esta acción"],
    [new NotFoundError("Vehículo no encontrado"), 404, "Vehículo no encontrado"],
    [new ConflictError(), 409, "La operación entra en conflicto con el estado actual"],
    [new AppError("falla puntual", 502), 502, "falla puntual"],
  ])("%s responde con su status y mensaje", async (error, status, message) => {
    const res = await appWith(error).request("/boom");
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
  });

  test("un error no controlado responde 500 genérico sin detalles internos", async () => {
    const res = await appWith(new Error("secreto: conexión a mongo fallida")).request("/boom");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Error interno del servidor" });
  });
});
