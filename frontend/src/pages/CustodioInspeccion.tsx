import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import ImageDropzone from "../components/ImageDropzone";
import type { Entrega, Vehicle, User } from "../types";

// Mismas 9 claves que backend/src/schemas/entrega.ts (CHECKLIST_CLAVES) — se
// copian aquí en vez de importarlas porque el frontend no comparte código
// con el backend.
const CHECKLIST_CLAVES = [
  "vin", "odometro", "placa", "frontal", "posterior",
  "lateral_izq", "lateral_der", "interior", "vano_motor",
] as const;

const CLAVE_LABELS: Record<string, string> = {
  vin: "VIN (foto de la placa VIN)",
  odometro: "Odómetro",
  placa: "Placa",
  frontal: "Frontal",
  posterior: "Posterior",
  lateral_izq: "Lateral izquierdo",
  lateral_der: "Lateral derecho",
  interior: "Interior",
  vano_motor: "Vano del motor",
};

const INVENTARIO_ITEMS = ["llaves", "documentos", "llanta_repuesto", "herramientas", "bateria", "accesorio"] as const;

const INVENTARIO_LABELS: Record<string, string> = {
  llaves: "Llaves",
  documentos: "Documentos",
  llanta_repuesto: "Llanta de repuesto",
  herramientas: "Herramientas",
  bateria: "Batería",
  accesorio: "Accesorios",
};

type EntregaListItem = Omit<Entrega, "vehicleId" | "compradorId"> & {
  vehicleId: Vehicle | null;
  compradorId: User | null;
};

// Lista de trabajo del custodio (estados no terminales) — reachable en
// /custodio, enlaza a la inspección de cada entrega en /custodio/entregas/:id.
function CustodioLista() {
  const api = useApi();
  const [items, setItems] = useState<EntregaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/entrega")
      .then((r) => {
        const nonTerminal = (r.data.items as EntregaListItem[]).filter(
          (e) => e.estado === "CITA_AGENDADA" || e.estado === "EN_INSPECCION"
        );
        setItems(nonTerminal);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader eyebrow="Custodio" title="Entregas por inspeccionar" subtitle={`${items.length} pendientes`} />

      <Card padding="none">
        {loading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState title="No hay entregas pendientes" description="Cuando un comprador agende una cita, aparecerá aquí." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((e) => (
              <Link
                key={e._id}
                to={`/custodio/entregas/${e._id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--sp-4) var(--sp-5)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>
                    {e.vehicleId?.title ?? "Vehículo"}
                  </p>
                  <p style={{ color: "var(--text-soft)", fontSize: "10.5px" }}>
                    {e.compradorId?.name ?? ""} · {new Date(e.citaProgramadaEn).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <StatusBadge status={e.estado} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Formulario de inspección de una Entrega concreta: checklist (9 fotos),
// VIN, inventario y generación del acta. El backend sigue siendo la fuente
// de verdad de la regla bloqueante (RE-04/RE-06/RE-07) — este componente
// solo replica la misma regla para deshabilitar el botón "Generar acta" y
// dar feedback inmediato.
function CustodioInspeccionForm({ id }: { id: string }) {
  const api = useApi();
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [vin, setVin] = useState("");
  const [vinSubmitting, setVinSubmitting] = useState(false);
  const [vinError, setVinError] = useState("");

  const [inventario, setInventario] = useState<Record<string, { cantidad: number; faltante: boolean }>>(
    () => Object.fromEntries(INVENTARIO_ITEMS.map((i) => [i, { cantidad: 0, faltante: false }]))
  );
  const [inventarioSubmitting, setInventarioSubmitting] = useState(false);

  const [actaSubmitting, setActaSubmitting] = useState(false);
  const [actaError, setActaError] = useState("");

  function load() {
    setLoading(true);
    api
      .get(`/api/entrega/${id}`)
      .then(async (r) => {
        const e = r.data as Entrega;
        setEntrega(e);
        setVin(e.vinCapturado || "");
        if (e.inventario.length > 0) {
          setInventario((prev) => {
            const next = { ...prev };
            for (const it of e.inventario) next[it.item] = { cantidad: it.cantidad, faltante: it.faltante };
            return next;
          });
        }
        try {
          const vehicleId = typeof e.vehicleId === "string" ? e.vehicleId : e.vehicleId._id;
          const vr = await api.get(`/api/vehicles/${vehicleId}`);
          setVehicle(vr.data);
        } catch {
          setVehicle(null);
        }
      })
      .catch(() => setError("No se pudo cargar esta entrega."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  const bloqueada = entrega?.estado === "BLOQUEADA";
  const terminada = entrega?.estado === "ENTREGADA";
  const readOnly = bloqueada || terminada;

  const claveFoto = (clave: string) => entrega?.checklist.find((c) => c.clave === clave)?.fotoUrl;
  const checklistCompleto = CHECKLIST_CLAVES.every((c) => Boolean(claveFoto(c)));
  const vinValidado = Boolean(entrega?.vinCapturado) && entrega?.estado !== "BLOQUEADA";
  const puedeGenerarActa = checklistCompleto && vinValidado && !readOnly;

  async function subirFotoClave(clave: string, urls: string[]) {
    const url = urls[urls.length - 1];
    if (!url || !entrega) return;
    try {
      const r = await api.post(`/api/entrega/${entrega._id}/checklist`, { clave, fotoUrl: url });
      setEntrega(r.data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || "No se pudo registrar el ítem del checklist.");
    }
  }

  async function validarVin() {
    if (!entrega || !vin.trim()) return;
    setVinSubmitting(true);
    setVinError("");
    try {
      const r = await api.post(`/api/entrega/${entrega._id}/vin`, { vin: vin.trim() });
      setEntrega(r.data);
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
      setVinError(response?.data?.error || "No se pudo validar el VIN.");
      if (response?.status === 409) load();
    } finally {
      setVinSubmitting(false);
    }
  }

  async function guardarInventario() {
    if (!entrega) return;
    setInventarioSubmitting(true);
    try {
      const items = INVENTARIO_ITEMS.map((item) => ({ item, ...inventario[item] }));
      const r = await api.post(`/api/entrega/${entrega._id}/inventario`, { items });
      setEntrega(r.data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || "No se pudo guardar el inventario.");
    } finally {
      setInventarioSubmitting(false);
    }
  }

  async function generarActa() {
    if (!entrega) return;
    setActaSubmitting(true);
    setActaError("");
    try {
      const r = await api.post(`/api/entrega/${entrega._id}/acta`);
      setEntrega(r.data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setActaError(message || "No se pudo generar el acta.");
    } finally {
      setActaSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <LoadingState />
      </div>
    );
  }

  if (error && !entrega) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <EmptyState title="Entrega no disponible" description={error} />
      </div>
    );
  }

  if (!entrega) return null;

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 720 }}>
      <Link to="/custodio" className="text-muted" style={{ fontSize: "var(--t-sm)", fontWeight: 500 }}>
        ← Volver a la lista
      </Link>

      <PageHeader
        eyebrow="Custodio"
        title={vehicle?.title || "Inspección de entrega"}
        subtitle={vehicle ? `${vehicle.brand} · ${vehicle.model} · ${vehicle.year}` : entrega._id}
        actions={<StatusBadge status={entrega.estado} />}
      />

      {bloqueada && (
        <Card padding="md" style={{ marginBottom: "var(--sp-4)", background: "var(--danger-soft)" }}>
          <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: "var(--t-sm)" }}>
            {entrega.motivoBloqueo || "Esta entrega está bloqueada."} Se escaló a un administrador; no admite más
            acciones desde esta pantalla.
          </p>
        </Card>
      )}

      {terminada && (
        <Card padding="md" style={{ marginBottom: "var(--sp-4)", background: "var(--success-soft)" }}>
          <p style={{ color: "var(--success)", fontWeight: 600, fontSize: "var(--t-sm)" }}>
            El acta ya fue generada. Esta entrega es irreversible.
          </p>
        </Card>
      )}

      <Card padding="lg" style={{ marginBottom: "var(--sp-4)" }}>
        <h3 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>
          Checklist de inspección ({entrega.checklist.length}/9)
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          {CHECKLIST_CLAVES.map((clave) => {
            const fotoUrl = claveFoto(clave);
            return (
              <div key={clave}>
                <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                  {CLAVE_LABELS[clave]} {fotoUrl && <span style={{ color: "var(--success)" }}>✓</span>}
                </p>
                {readOnly ? (
                  fotoUrl ? (
                    <img src={fotoUrl} alt={clave} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: "var(--radius-md)" }} />
                  ) : (
                    <p className="text-soft" style={{ fontSize: "var(--t-xs)" }}>Sin foto registrada</p>
                  )
                ) : (
                  <ImageDropzone value={fotoUrl ? [fotoUrl] : []} onChange={(urls) => subirFotoClave(clave, urls)} maxImages={1} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="lg" style={{ marginBottom: "var(--sp-4)" }}>
        <h3 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>VIN capturado</h3>
        <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="vin-input">VIN (17 caracteres)</label>
            <input
              id="vin-input"
              className="input"
              value={vin}
              maxLength={17}
              disabled={readOnly}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="1HGCM82633A004352"
            />
          </div>
          <Button variant="secondary" onClick={validarVin} disabled={readOnly || vinSubmitting || vin.trim().length !== 17}>
            {vinSubmitting ? "Validando..." : "Validar VIN"}
          </Button>
        </div>
        {vinError && (
          <p style={{ color: "var(--danger)", fontSize: "var(--t-sm)", fontWeight: 600, marginTop: "var(--sp-3)" }}>
            {vinError}
          </p>
        )}
        {entrega.vinCapturado && !bloqueada && (
          <p style={{ color: "var(--success)", fontSize: "var(--t-sm)", marginTop: "var(--sp-3)" }}>
            VIN validado correctamente.
          </p>
        )}
      </Card>

      <Card padding="lg" style={{ marginBottom: "var(--sp-4)" }}>
        <h3 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Inventario</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {INVENTARIO_ITEMS.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
              <span style={{ flex: 1, fontSize: "var(--t-sm)", color: "var(--text)" }}>{INVENTARIO_LABELS[item]}</span>
              <input
                type="number"
                min={0}
                className="input"
                style={{ width: 80 }}
                disabled={readOnly}
                value={inventario[item].cantidad}
                onChange={(e) =>
                  setInventario((prev) => ({ ...prev, [item]: { ...prev[item], cantidad: Number(e.target.value) } }))
                }
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={inventario[item].faltante}
                  onChange={(e) =>
                    setInventario((prev) => ({ ...prev, [item]: { ...prev[item], faltante: e.target.checked } }))
                  }
                />
                Faltante
              </label>
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={guardarInventario} disabled={readOnly || inventarioSubmitting} style={{ marginTop: "var(--sp-4)" }}>
          {inventarioSubmitting ? "Guardando..." : "Guardar inventario"}
        </Button>
      </Card>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>{error}</p>
      )}

      <Card padding="lg">
        <h3 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-2)" }}>Generar acta</h3>
        <p className="text-muted" style={{ fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>
          Requiere las 9 fotos del checklist y el VIN validado. Esta acción es irreversible.
        </p>
        {actaError && (
          <p style={{ color: "var(--danger)", fontSize: "var(--t-sm)", fontWeight: 600, marginBottom: "var(--sp-3)" }}>
            {actaError}
          </p>
        )}
        <Button variant="primary" onClick={generarActa} disabled={!puedeGenerarActa || actaSubmitting}>
          {actaSubmitting ? "Generando..." : "Generar acta"}
        </Button>
      </Card>
    </div>
  );
}

export default function CustodioInspeccion() {
  const { id } = useParams<{ id: string }>();
  return id ? <CustodioInspeccionForm id={id} /> : <CustodioLista />;
}
