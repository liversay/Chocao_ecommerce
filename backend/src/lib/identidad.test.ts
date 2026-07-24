import { test, expect } from "bun:test";
import { normalizarDocumento } from "./identidad";

test("acepta cédula nacional y normaliza a forma canónica", () => {
  const r = normalizarDocumento(" 8-888-8888 ");
  expect(r).not.toBeNull();
  expect(r?.categoria).toBe("NACIONAL");
  expect(r?.canonico).toBe("8-888-8888");
});

test("normaliza variantes de espaciado/mayúsculas a la misma forma canónica", () => {
  const a = normalizarDocumento("8-888-8888");
  const b = normalizarDocumento("8 - 888 - 8888");
  expect(a?.canonico).toBe(b?.canonico);
});

test("acepta cédula de extranjero residente (prefijo E)", () => {
  const r = normalizarDocumento("e-123-4567");
  expect(r?.categoria).toBe("EXTRANJERO_RESIDENTE");
  expect(r?.canonico).toBe("E-123-4567");
});

test("acepta pasaporte alfanumérico", () => {
  const r = normalizarDocumento("ab1234567");
  expect(r?.categoria).toBe("PASAPORTE");
  expect(r?.canonico).toBe("AB1234567");
});

test("rechaza formato que no matchea ninguna categoría", () => {
  expect(normalizarDocumento("no-es-un-documento")).toBeNull();
  expect(normalizarDocumento("")).toBeNull();
});
