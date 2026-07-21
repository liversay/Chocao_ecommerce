import { mock } from "bun:test";

// Mock de Clerk para tests de integración: el token Bearer es directamente
// el clerkId del usuario de prueba (ver factories.authHeader). Importar este
// módulo ANTES que cualquier módulo que use @clerk/backend.
mock.module("@clerk/backend", () => ({
  verifyToken: async (token: string) => {
    if (!token || token.startsWith("invalido")) {
      throw new Error("token inválido (mock)");
    }
    return { sub: token };
  },
}));
