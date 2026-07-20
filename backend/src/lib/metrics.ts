// Métricas en memoria con exposición en formato de texto Prometheus.
// Sin dependencias: contadores por método/status, latencia agregada y
// contadores de negocio (pujas). Suficiente para scrapear con Prometheus
// o leer a ojo; si el proyecto crece, sustituir por prom-client.
class Metrics {
  private httpRequests = new Map<string, number>();
  private durationSumMs = 0;
  private durationCount = 0;
  private counters = new Map<string, number>();

  recordHttp(method: string, status: number, durationMs: number) {
    const key = `${method}|${status}`;
    this.httpRequests.set(key, (this.httpRequests.get(key) ?? 0) + 1);
    this.durationSumMs += durationMs;
    this.durationCount += 1;
  }

  increment(name: string, by = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  render(): string {
    const lines: string[] = [
      "# HELP http_requests_total Total de peticiones HTTP",
      "# TYPE http_requests_total counter",
    ];
    for (const [key, count] of this.httpRequests) {
      const [method, status] = key.split("|");
      lines.push(`http_requests_total{method="${method}",status="${status}"} ${count}`);
    }
    lines.push(
      "# HELP http_request_duration_ms Duración acumulada de las peticiones",
      "# TYPE http_request_duration_ms summary",
      `http_request_duration_ms_sum ${this.durationSumMs}`,
      `http_request_duration_ms_count ${this.durationCount}`
    );
    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name} counter`, `${name} ${value}`);
    }
    lines.push(
      "# HELP process_uptime_seconds Segundos desde el arranque del proceso",
      "# TYPE process_uptime_seconds gauge",
      `process_uptime_seconds ${Math.round(process.uptime())}`
    );
    return lines.join("\n") + "\n";
  }

  reset() {
    this.httpRequests.clear();
    this.counters.clear();
    this.durationSumMs = 0;
    this.durationCount = 0;
  }
}

export const metrics = new Metrics();
