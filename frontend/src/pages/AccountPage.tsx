import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import Input from "../components/Input";
import PageHeader from "../components/PageHeader";
import LoadingState from "../components/LoadingState";
import type { NotificationPrefs, User } from "../types";

const PREF_LABELS: Record<keyof NotificationPrefs, { title: string; hint: string }> = {
  outbid: { title: "Puja superada", hint: "Cuando alguien ofrece más que tu puja activa." },
  won: { title: "Subasta ganada", hint: "Cuando tu puja resulta ganadora al cerrar la subasta." },
  payment: { title: "Pagos y reembolsos", hint: "Confirmación de pago y avisos de reembolso." },
  watchClosing: { title: "Watchlist por cerrar", hint: "Cuando un vehículo que sigues está por cerrar." },
};

export default function AccountPage() {
  const api = useApi();
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/api/users/me")
      .then((r) => {
        setUser(r.data);
        setPhone(r.data.phone || "");
        setPrefs(r.data.notificationPrefs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await api.patch("/api/users/me", { phone, notificationPrefs: prefs });
      setUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setSaveError("Error al guardar cambios. Por favor, intenta de nuevo.");
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !prefs) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 720 }}>
      <PageHeader eyebrow="Mi cuenta" title="Perfil y preferencias" subtitle="Tus datos y cómo quieres que te avisemos" />

      <Card padding="lg" style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Datos personales</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Input label="Nombre" value={user.name} disabled hint="Gestionado por tu cuenta de acceso" />
          <Input label="Correo" value={user.email} disabled hint="Gestionado por tu cuenta de acceso" />
          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+507 6000-0000"
          />
        </div>
      </Card>

      <Card padding="lg" style={{ marginBottom: "var(--sp-5)" }}>
        <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Preferencias de notificación</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map((key) => (
            <label
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--sp-4)",
                cursor: "pointer",
              }}
            >
              <span>
                <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>
                  {PREF_LABELS[key].title}
                </p>
                <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  {PREF_LABELS[key].hint}
                </p>
              </span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                style={{ width: 20, height: 20, flexShrink: 0, cursor: "pointer" }}
              />
            </label>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
        {saved && <span style={{ color: "var(--success)", fontSize: "var(--t-sm)", fontWeight: 600 }}>Guardado ✓</span>}
        {saveError && <span style={{ color: "var(--danger)", fontSize: "var(--t-sm)", fontWeight: 600 }}>{saveError}</span>}
      </div>
    </div>
  );
}
