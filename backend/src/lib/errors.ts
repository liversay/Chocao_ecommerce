import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// Errores de dominio: cualquier capa (rutas, servicios, tools MCP) los lanza
// y el handler global los convierte en la respuesta { error } con su status.
export class AppError extends Error {
  readonly status: ContentfulStatusCode;

  constructor(message: string, status: ContentfulStatusCode = 500) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Datos de entrada inválidos") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tienes permisos para realizar esta acción") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "La operación entra en conflicto con el estado actual") {
    super(message, 409);
  }
}

// Handler global: los AppError devuelven su mensaje; el resto se loguea y
// responde 500 genérico sin filtrar stack traces ni detalles internos.
export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("[error] no controlado:", err);
  return c.json({ error: "Error interno del servidor" }, 500);
}
