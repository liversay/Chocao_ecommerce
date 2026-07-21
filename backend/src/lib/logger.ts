export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined;
  return env && env in LEVELS ? env : "info";
}

// Logging estructurado: una línea JSON por evento con nivel, timestamp y los
// campos de contexto que se pasen (requestId, userId, path…). Nunca loguear
// tokens, secretos ni PII más allá del userId.
export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  if (LEVELS[level] < LEVELS[configuredLevel()]) return;
  const line = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => log("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => log("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => log("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => log("error", message, fields),
};
