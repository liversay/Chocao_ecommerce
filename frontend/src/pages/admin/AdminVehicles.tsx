import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Input from "../../components/Input";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
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

const STATUS_FILTER_OPTIONS = [{ value: "", label: "Todos los estados" }, ...STATUSES];

const CONDITIONS = [
  { value: "excellent", label: "Excelente" },
  { value: "good", label: "Bueno" },
  { value: "fair", label: "Regular" },
  { value: "poor", label: "Malo" },
];

const TRANSMISSIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automático" },
];

const BODY_STYLES = [
  { value: "sedan", label: "Sedán" },
  { value: "suv", label: "SUV" },
  { value: "pickup", label: "Pickup" },
  { value: "van", label: "Bus / Coaster / Van" },
  { value: "panel", label: "Panel" },
];

const CONDITION_HELP: Record<string, string> = {
  excellent: "Como nuevo: sin detalles estéticos ni mecánicos",
  good: "Buen estado general: detalles menores de uso",
  fair: "Uso notable: requiere mantenimiento próximamente",
  poor: "Daños importantes: requiere reparación",
};

const BRANDS = [
  "Acura", "Alfa Romeo", "Audi", "BMW", "BYD", "Changan", "Chery", "Chevrolet",
  "Chrysler", "Citroën", "Dodge", "Fiat", "Ford", "Geely", "GMC", "Great Wall",
  "Honda", "Hyundai", "Infiniti", "Isuzu", "JAC", "Jaguar", "Jeep", "Kia",
  "Land Rover", "Lexus", "Mazda", "Mercedes-Benz", "MG", "Mini", "Mitsubishi",
  "Nissan", "Peugeot", "Porsche", "RAM", "Renault", "Seat", "Škoda", "SsangYong",
  "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo", "Otra",
];

const COLORS = [
  "Amarillo", "Azul", "Beige", "Blanco", "Dorado", "Gris", "Marrón", "Naranja",
  "Negro", "Plata", "Rojo", "Verde", "Vinotinto", "Otro",
];

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_FORM = {
  title: "", brand: "", model: "", year: "", color: "", mileage: "",
  condition: "good", transmission: "", bodyStyle: "", description: "", basePrice: "",
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialStartDate, setInitialStartDate] = useState("");

  // Filtros de la tabla (client-side, sobre la lista ya cargada)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function loadVehicles() {
    setLoading(true);
    api.get("/api/vehicles/admin/all")
      .then((r) => setVehicles(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadVehicles(); }, []);
  useRealtimeRefetch(["vehicle.updated", "vehicle.removed", "vehicle.status", "bid.placed"], loadVehicles);

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = priceMin ? parseFloat(priceMin) : undefined;
    const max = priceMax ? parseFloat(priceMax) : undefined;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : undefined;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : undefined;

    return vehicles.filter((v) => {
      if (q) {
        const haystack = `${v.title} ${v.brand} ${v.model}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter && v.status !== statusFilter) return false;
      if (min !== undefined && !isNaN(min) && v.currentPrice < min) return false;
      if (max !== undefined && !isNaN(max) && v.currentPrice > max) return false;
      const createdAt = new Date(v.createdAt).getTime();
      if (from !== undefined && createdAt < from) return false;
      if (to !== undefined && createdAt > to) return false;
      return true;
    });
  }, [vehicles, search, statusFilter, priceMin, priceMax, dateFrom, dateTo]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImages([]);
    setError("");
    setErrors({});
    setInitialStartDate("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    const startDate = v.auctionStartDate ? v.auctionStartDate.slice(0, 10) : "";
    setForm({
      title: v.title, brand: v.brand, model: v.model,
      year: String(v.year), color: v.color || "",
      mileage: String(v.mileage || ""),
      condition: v.condition || "good",
      transmission: v.transmission || "",
      bodyStyle: v.bodyStyle || "",
      description: v.description || "",
      basePrice: String(v.basePrice),
      status: v.status,
      auctionStartDate: startDate,
      auctionEndDate: v.auctionEndDate ? v.auctionEndDate.slice(0, 10) : "",
    });
    setImages(v.images || []);
    setError("");
    setErrors({});
    setInitialStartDate(startDate);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function validate(f: typeof form): Record<string, string> {
    const errs: Record<string, string> = {};

    if (!f.brand) errs.brand = "La marca es requerida";

    if (!f.year) {
      errs.year = "El año es requerido";
    } else {
      const y = parseInt(f.year, 10);
      if (isNaN(y) || y < 1990 || y > CURRENT_YEAR) {
        errs.year = `El año debe estar entre 1990 y ${CURRENT_YEAR}`;
      }
    }

    if (f.mileage) {
      const km = parseInt(f.mileage, 10);
      if (!isNaN(km) && km < 0) {
        errs.mileage = "El kilometraje no puede ser negativo";
      }
    }

    if (!f.basePrice) {
      errs.basePrice = "El precio base es requerido";
    } else {
      const price = parseFloat(f.basePrice);
      if (isNaN(price) || price <= 0) {
        errs.basePrice = "El precio base debe ser mayor que 0";
      }
    }

    if (f.auctionStartDate && f.auctionStartDate !== initialStartDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(`${f.auctionStartDate}T00:00:00`);
      if (start < today) {
        errs.auctionStartDate = "El inicio no puede ser anterior a hoy";
      }
    }

    if (f.auctionEndDate) {
      if (!f.auctionStartDate) {
        errs.auctionEndDate = "Define primero el inicio de la subasta";
      } else {
        const start = new Date(`${f.auctionStartDate}T00:00:00`);
        const end = new Date(`${f.auctionEndDate}T00:00:00`);
        const oneDay = 24 * 60 * 60 * 1000;
        if (end.getTime() - start.getTime() < oneDay) {
          errs.auctionEndDate = "El fin debe ser al menos un día después del inicio";
        }
      }
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const payload = {
      ...form,
      year: parseInt(form.year),
      mileage: form.mileage ? parseInt(form.mileage) : undefined,
      basePrice: parseFloat(form.basePrice),
      images,
      auctionStartDate: form.auctionStartDate || undefined,
      auctionEndDate: form.auctionEndDate || undefined,
      transmission: form.transmission || undefined,
      bodyStyle: form.bodyStyle || undefined,
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

  const brandOptions = [
    { value: "", label: "— Seleccionar —" },
    ...(form.brand && !BRANDS.includes(form.brand) ? [{ value: form.brand, label: form.brand }] : []),
    ...BRANDS.map((b) => ({ value: b, label: b })),
  ];

  const colorOptions = [
    { value: "", label: "— Seleccionar —" },
    ...(form.color && !COLORS.includes(form.color) ? [{ value: form.color, label: form.color }] : []),
    ...COLORS.map((c) => ({ value: c, label: c })),
  ];

  const transmissionOptions = [{ value: "", label: "— Seleccionar —" }, ...TRANSMISSIONS];
  const bodyStyleOptions = [{ value: "", label: "— Seleccionar —" }, ...BODY_STYLES];

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Inventario"
        title="Gestión de vehículos"
        subtitle="Administra el catálogo completo de subastas"
        actions={!showForm && <Button variant="primary" onClick={openCreate}>+ Nuevo vehículo</Button>}
      />

      {/* Form */}
      {showForm && (
        <Card padding="lg" style={{ marginBottom: "var(--sp-5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-5)" }}>
            <div>
              <h2 style={{ fontSize: "var(--t-lg)", color: "var(--text)" }}>
                {editing ? "Editar vehículo" : "Nuevo vehículo"}
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginTop: 4 }}>
                Completa los campos requeridos para {editing ? "actualizar" : "registrar"} el vehículo
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              ✕
            </Button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Section: Basic info */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Información básica
              </h3>
              <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
                <Input label="Título *" name="title" value={form.title} onChange={handleChange} required />
                <Select
                  label="Marca *"
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  options={brandOptions}
                  error={errors.brand}
                  required
                />
                <Input label="Modelo *" name="model" value={form.model} onChange={handleChange} required />
                <Input
                  label="Año *"
                  name="year"
                  type="number"
                  min={1990}
                  max={CURRENT_YEAR}
                  value={form.year}
                  onChange={handleChange}
                  error={errors.year}
                  required
                />
              </div>
            </div>

            {/* Section: Specs */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Especificaciones
              </h3>
              <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
                <Select
                  label="Color"
                  name="color"
                  value={form.color}
                  onChange={handleChange}
                  options={colorOptions}
                  error={errors.color}
                />
                <Input
                  label="Kilometraje"
                  name="mileage"
                  type="number"
                  min={0}
                  value={form.mileage}
                  onChange={handleChange}
                  error={errors.mileage}
                />
                <div>
                  <Select
                    label="Condición"
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    options={CONDITIONS}
                  />
                  {CONDITION_HELP[form.condition] && (
                    <p className="text-muted" style={{ fontSize: "var(--t-xs)", marginTop: 4 }}>
                      {CONDITION_HELP[form.condition]}
                    </p>
                  )}
                </div>
                <Select
                  label="Transmisión"
                  name="transmission"
                  value={form.transmission}
                  onChange={handleChange}
                  options={transmissionOptions}
                />
                <Select
                  label="Carrocería"
                  name="bodyStyle"
                  value={form.bodyStyle}
                  onChange={handleChange}
                  options={bodyStyleOptions}
                />
              </div>
            </div>

            {/* Section: Auction */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Subasta
              </h3>
              <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
                <Input
                  label="Precio base (USD) *"
                  name="basePrice"
                  type="number"
                  value={form.basePrice}
                  onChange={handleChange}
                  error={errors.basePrice}
                  required
                />
                <Select
                  label="Estado"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={STATUSES}
                />
                <Input
                  label="Inicio subasta"
                  name="auctionStartDate"
                  type="date"
                  value={form.auctionStartDate}
                  onChange={handleChange}
                  error={errors.auctionStartDate}
                />
                <Input
                  label="Fin subasta"
                  name="auctionEndDate"
                  type="date"
                  value={form.auctionEndDate}
                  onChange={handleChange}
                  error={errors.auctionEndDate}
                />
              </div>
            </div>

            {/* Section: Media & description */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{
                fontSize: "var(--t-xs)",
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "var(--sp-3)",
              }}>
                Media y descripción
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
                <ImageDropzone value={images} onChange={setImages} />
                <div className="field">
                  <label className="field-label">Descripción</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    className="input"
                    style={{ resize: "vertical", fontFamily: "inherit" }}
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
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Guardando..." : editing ? "Actualizar vehículo" : "Crear vehículo"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filtros */}
      {!loading && vehicles.length > 0 && (
        <Card padding="md" style={{ marginBottom: "var(--sp-4)" }}>
          <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
            <Input
              label="Buscar"
              placeholder="Título, marca o modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              label="Estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_FILTER_OPTIONS}
            />
            <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
              <Input
                label="Precio mínimo"
                type="number"
                min={0}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
              />
              <Input
                label="Precio máximo"
                type="number"
                min={0}
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
              />
            </div>
            <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
              <Input
                label="Registrado desde"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                label="Registrado hasta"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <LoadingState />
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon="🚗"
            title="No hay vehículos registrados"
            description="Comienza agregando tu primer vehículo al catálogo."
            action={<Button variant="primary" onClick={openCreate}>+ Agregar vehículo</Button>}
          />
        ) : (
          <DataTable
            dense
            columns={[
              {
                header: "",
                width: "56px",
                accessor: (v) => (
                  v.images && v.images.length > 0 ? (
                    <img
                      src={v.images[0]}
                      alt={v.title}
                      style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", objectFit: "cover", border: "1px solid var(--border)" }}
                    />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--bg-alt)", border: "1px solid var(--border)" }} />
                  )
                ),
              },
              {
                header: "ID",
                accessor: (v) => <span className="mono" style={{ color: "var(--text-soft)" }}>{v._id.slice(-6)}</span>,
              },
              {
                header: "Vehículo",
                accessor: (v) => (
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--text)" }}>{v.title}</p>
                    <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>
                      {v.brand} · {v.model} · {v.year}
                    </p>
                  </div>
                ),
              },
              {
                header: "Estado",
                accessor: (v) => (
                  <Select
                    value={v.status}
                    onChange={(e) => handleStatus(v._id, e.target.value)}
                    options={STATUSES}
                  />
                ),
              },
              {
                header: "Precio",
                align: "right",
                accessor: (v) => (
                  <span className="mono" style={{ fontWeight: 600 }}>
                    ${v.currentPrice.toLocaleString()}
                  </span>
                ),
              },
              {
                header: "Fecha de registro",
                sortKey: "createdAt",
                sortValue: (v) => new Date(v.createdAt).getTime(),
                accessor: (v) => (
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                    {new Date(v.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                ),
              },
              {
                header: "",
                align: "right",
                accessor: (v) => (
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(v._id)} style={{ color: "var(--danger)" }}>Eliminar</Button>
                  </div>
                ),
              },
            ]}
            data={filteredVehicles}
            emptyMessage="No hay vehículos que coincidan con los filtros"
          />
        )}
      </Card>
    </div>
  );
}
