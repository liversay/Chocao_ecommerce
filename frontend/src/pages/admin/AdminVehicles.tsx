import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import GlassCard from "../../components/GlassCard";
import GlassButton from "../../components/GlassButton";
import GlassInput from "../../components/GlassInput";
import NeumorphicSelect from "../../components/NeumorphicSelect";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import ImageDropzone from "../../components/ImageDropzone";
import type { Vehicle } from "../../types";

const STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "published", label: "Publicado" },
  { value: "active", label: "Activo" },
  { value: "closed", label: "Cerrado" },
  { value: "awarded", label: "Adjudicado" },
];

const CONDITIONS = [
  { value: "excellent", label: "Excelente" },
  { value: "good", label: "Bueno" },
  { value: "fair", label: "Regular" },
  { value: "poor", label: "Malo" },
];

const EMPTY_FORM = {
  title: "", brand: "", model: "", year: "", color: "", mileage: "",
  condition: "good", description: "", basePrice: "",
  status: "draft", auctionStartDate: "", auctionEndDate: "",
};

export default function AdminVehicles() {
  const api = useApi();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function loadVehicles() {
    setLoading(true);
    api.get("/api/vehicles/admin/all")
      .then((r) => setVehicles(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadVehicles(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImages([]);
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      title: v.title, brand: v.brand, model: v.model,
      year: String(v.year), color: v.color || "",
      mileage: String(v.mileage || ""),
      condition: v.condition || "good",
      description: v.description || "",
      basePrice: String(v.basePrice),
      status: v.status,
      auctionStartDate: v.auctionStartDate ? v.auctionStartDate.slice(0, 10) : "",
      auctionEndDate: v.auctionEndDate ? v.auctionEndDate.slice(0, 10) : "",
    });
    setImages(v.images || []);
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      year: parseInt(form.year),
      mileage: form.mileage ? parseInt(form.mileage) : undefined,
      basePrice: parseFloat(form.basePrice),
      images,
      auctionStartDate: form.auctionStartDate || undefined,
      auctionEndDate: form.auctionEndDate || undefined,
    };

    try {
      if (editing) {
        await api.put(`/api/vehicles/${editing._id}`, payload);
      } else {
        await api.post("/api/vehicles", payload);
      }
      setShowForm(false);
      loadVehicles();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar este vehículo?")) return;
    await api.delete(`/api/vehicles/${id}`).catch(console.error);
    loadVehicles();
  }

  async function handleStatus(id: string, status: string) {
    await api.patch(`/api/vehicles/${id}/status`, { status }).catch(console.error);
    loadVehicles();
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Inventario"
        title="Gestión de vehículos"
        subtitle="Administra el catálogo completo de subastas"
        actions={!showForm && <GlassButton variant="primary" onClick={openCreate}>+ Nuevo vehículo</GlassButton>}
      />

      {/* Form */}
      {showForm && (
        <GlassCard padding="lg" style={{ marginBottom: "var(--sp-5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-5)" }}>
            <div>
              <h2 style={{ fontSize: "var(--t-lg)", color: "var(--text)" }}>
                {editing ? "Editar vehículo" : "Nuevo vehículo"}
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginTop: 4 }}>
                Completa los campos requeridos para {editing ? "actualizar" : "registrar"} el vehículo
              </p>
            </div>
            <button
              onClick={() => setShowForm(false)}
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                background: "var(--surface)",
                boxShadow: "var(--nm-out-sm)",
                color: "var(--text-muted)",
                fontSize: "1rem",
                cursor: "pointer",
                border: "none",
              }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Section: Basic info */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Información básica
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-3)" }}>
                <GlassInput label="Título *" name="title" value={form.title} onChange={handleChange} required />
                <GlassInput label="Marca *" name="brand" value={form.brand} onChange={handleChange} required />
                <GlassInput label="Modelo *" name="model" value={form.model} onChange={handleChange} required />
                <GlassInput label="Año *" name="year" type="number" value={form.year} onChange={handleChange} required />
              </div>
            </div>

            {/* Section: Specs */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Especificaciones
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-3)" }}>
                <GlassInput label="Color" name="color" value={form.color} onChange={handleChange} />
                <GlassInput label="Kilometraje" name="mileage" type="number" value={form.mileage} onChange={handleChange} />
                <NeumorphicSelect
                  label="Condición"
                  name="condition"
                  value={form.condition}
                  onChange={handleChange}
                  options={CONDITIONS}
                />
              </div>
            </div>

            {/* Section: Auction */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Subasta
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--sp-3)" }}>
                <GlassInput label="Precio base (USD) *" name="basePrice" type="number" value={form.basePrice} onChange={handleChange} required />
                <NeumorphicSelect
                  label="Estado"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={STATUSES}
                />
                <GlassInput label="Inicio subasta" name="auctionStartDate" type="date" value={form.auctionStartDate} onChange={handleChange} />
                <GlassInput label="Fin subasta" name="auctionEndDate" type="date" value={form.auctionEndDate} onChange={handleChange} />
              </div>
            </div>

            {/* Section: Media & description */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Media y descripción
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
                <ImageDropzone value={images} onChange={setImages} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{
                    fontSize: "var(--t-xs)",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    style={{
                      background: "var(--surface)",
                      border: "none",
                      color: "var(--text)",
                      fontSize: "var(--t-base)",
                      padding: "13px 16px",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "var(--nm-in-sm)",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div style={{
                padding: "12px 16px",
                background: "var(--danger-soft)",
                color: "var(--danger)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--t-sm)",
                marginBottom: "var(--sp-3)",
                fontWeight: 500,
              }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "flex-end" }}>
              <GlassButton type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={saving}>
                {saving ? "Guardando..." : editing ? "Actualizar vehículo" : "Crear vehículo"}
              </GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Table */}
      <GlassCard>
        {loading ? (
          <LoadingState />
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon="🚗"
            title="No hay vehículos registrados"
            description="Comienza agregando tu primer vehículo al catálogo."
            action={<GlassButton variant="primary" onClick={openCreate}>+ Agregar vehículo</GlassButton>}
          />
        ) : (
          <DataTable
            columns={[
              {
                header: "Vehículo",
                accessor: (v) => (
                  <div>
                    <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "var(--t-sm)" }}>{v.title}</p>
                    <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>
                      {v.brand} · {v.model} · {v.year}
                    </p>
                  </div>
                ),
              },
              {
                header: "Estado",
                accessor: (v) => (
                  <select
                    value={v.status}
                    onChange={(e) => handleStatus(v._id, e.target.value)}
                    style={{
                      appearance: "none",
                      WebkitAppearance: "none",
                      background: "var(--surface)",
                      boxShadow: "var(--nm-in-sm)",
                      border: "none",
                      borderRadius: "var(--radius-pill)",
                      padding: "5px 28px 5px 14px",
                      color: "var(--text)",
                      fontSize: "var(--t-xs)",
                      fontWeight: 600,
                      cursor: "pointer",
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%235a6878' d='M5 6L0 0h10z'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                      backgroundSize: "8px",
                    }}
                  >
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                ),
              },
              {
                header: "Precio actual",
                align: "right",
                accessor: (v) => (
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                    ${v.currentPrice.toLocaleString()}
                  </span>
                ),
              },
              {
                header: "Estado base",
                accessor: (v) => <StatusBadge status={v.status} />,
              },
              {
                header: "",
                align: "right",
                accessor: (v) => (
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <GlassButton size="sm" variant="ghost" onClick={() => openEdit(v)}>Editar</GlassButton>
                    <GlassButton size="sm" variant="danger" onClick={() => handleDelete(v._id)}>Eliminar</GlassButton>
                  </div>
                ),
              },
            ]}
            data={vehicles}
            emptyMessage="No hay vehículos"
          />
        )}
      </GlassCard>
    </div>
  );
}
