import feriadosPorAnio from "../data/feriados.json";

// Servicio de dominio para cómputo de plazos en días hábiles (RP-02). Nunca
// usar `fecha + N días` para un plazo legal: un cómputo errado invalida el
// procedimiento. Los feriados están versionados por año en data/feriados.json
// — confirmar el calendario oficial vigente antes de fijarlo en producción
// (punto abierto #7 del documento de reglas de negocio).
const feriados: Record<string, string[]> = feriadosPorAnio;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function isFeriado(d: Date): boolean {
  const year = String(d.getUTCFullYear());
  return (feriados[year] ?? []).includes(toDateKey(d));
}

export function isBusinessDay(d: Date): boolean {
  return !isWeekend(d) && !isFeriado(d);
}

// Suma n días hábiles a partir de `date` (la fecha de partida NO cuenta como
// uno de los n días, igual que "5 días hábiles siguientes a la fecha del
// acto" en RP-01). Devuelve la fecha resultante normalizada a medianoche UTC.
export function addBusinessDays(date: Date, n: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  let remaining = n;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result)) remaining -= 1;
  }
  return result;
}
