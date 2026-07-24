import { test, expect } from "bun:test";
import { addBusinessDays, isBusinessDay } from "./calendario";

test("isBusinessDay: un feriado nacional no es día hábil", () => {
  expect(isBusinessDay(new Date("2026-01-01T12:00:00Z"))).toBe(false);
});

test("isBusinessDay: un sábado o domingo no es día hábil", () => {
  expect(isBusinessDay(new Date("2026-07-25T12:00:00Z"))).toBe(false); // sábado
  expect(isBusinessDay(new Date("2026-07-26T12:00:00Z"))).toBe(false); // domingo
});

test("isBusinessDay: un jueves laborable normal sí es día hábil", () => {
  expect(isBusinessDay(new Date("2026-07-23T12:00:00Z"))).toBe(true);
});

test("addBusinessDays: salta fin de semana sin cruzar feriados", () => {
  // jueves 2026-07-23 + 5 hábiles: vie24, (sáb25 dom26 saltan), lun27, mar28, mié29, jue30
  const result = addBusinessDays(new Date("2026-07-23T15:00:00Z"), 5);
  expect(result.toISOString().slice(0, 10)).toBe("2026-07-30");
});

test("addBusinessDays: salta un feriado nacional intermedio", () => {
  // viernes 2026-01-08 + 1 hábil: sábado/domingo no cuentan, 01-09 es feriado -> cae 01-12 (lunes)
  const result = addBusinessDays(new Date("2026-01-08T15:00:00Z"), 1);
  expect(result.toISOString().slice(0, 10)).toBe("2026-01-12");
});

test("addBusinessDays: n=0 devuelve la misma fecha calendario", () => {
  const d = new Date("2026-07-23T15:00:00Z");
  const result = addBusinessDays(d, 0);
  expect(result.toISOString().slice(0, 10)).toBe("2026-07-23");
});
