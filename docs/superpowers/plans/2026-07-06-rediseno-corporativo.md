# Rediseño Corporativo de Chocao — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el estilo neumórfico del frontend y reemplazarlo por un lenguaje corporativo minimalista (público) + un backoffice estilo Stripe docs, según `docs/superpowers/specs/2026-07-06-rediseno-corporativo-design.md`.

**Architecture:** Un sistema de tokens CSS en `index.css` con dos temas (`:root` público y `.admin-theme` para admin) + clases de componentes. Los componentes base nuevos (`Card`, `Button`, `Input`, `Select`) viven en archivos nuevos; los viejos (`Glass*`, `NeumorphicSelect`) permanecen intactos durante la migración con tokens `--nm-*` de compatibilidad, y se eliminan en el barrido final.

**Tech Stack:** React 19 + Vite 8 + TypeScript, CSS variables (sin Tailwind), Bun como runtime. Verificación con Playwright headless.

## Global Constraints

- Paleta: azul institucional `#1e3a8a`, dorado `#b88a2e` (público solo; **cero dorado en admin**).
- Sin cambios en rutas, llamadas API, lógica Clerk/Stripe ni backend.
- Sin dependencias nuevas de producción.
- Al final: `grep -rE "nm-|Glass|Neumorphic" frontend/src/` debe dar 0 resultados.
- Dev servers ya corren: backend `http://localhost:3000`, frontend `http://localhost:5173` (Vite HMR). No reiniciarlos.
- Repo root: `/Users/simon/Documents/Universidad/DSIX/Parcial2/chocao`. Todos los paths de abajo son relativos a él.
- Commits sin mención a "Claude" salvo el trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Textos de UI en español (es-PA), como los actuales.

## Verificación (usada por todos los tasks)

Script de screenshot (crear una vez, NO commitearlo — está untracked y los commits usan listas explícitas de archivos):

**`frontend/scripts/shot.mjs`:**
```js
import { chromium } from "playwright";

const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: true });
console.log("ERRORS:", JSON.stringify(errors));
await browser.close();
```

Uso (siempre con cwd = `frontend/`):
```bash
bun scripts/shot.mjs http://localhost:5173/ /tmp/chocao-shots/landing.png
```
Esperado: `ERRORS: []` y screenshot legible. **Mirar el screenshot** — un frame en blanco es fallo.

Nota: las rutas protegidas (`/my-bids`, `/admin/*`) redirigen a `/login` sin sesión; para esas basta verificar que la redirección renderiza sin errores de consola. La verificación visual completa del admin la hace el usuario al final.

---

### Task 1: Nuevo sistema de diseño en `index.css`

**Files:**
- Modify: `frontend/src/index.css` (reemplazo completo)
- Create: `frontend/scripts/shot.mjs` (helper, no se commitea)

**Interfaces:**
- Produces: tokens (`--bg`, `--bg-alt`, `--surface`, `--border`, `--primary`, `--accent`, `--shadow-sm`…) y clases (`.btn*`, `.card*`, `.field*`, `.input`, `.select`, `.badge*`, `.table*`, `.admin-*`, `.kpi*`, `.section*`, `.container`, `.mono`, `.eyebrow`, `.trust-line`, `.stat-strip*`) que TODOS los tasks siguientes consumen.
- Mantiene temporalmente un bloque `/* COMPAT */` con `--nm-*` mapeados a sombras planas para que las páginas no migradas sigan renderizando. Task 11 lo elimina.

- [ ] **Step 1: Reemplazar `frontend/src/index.css` completo con:**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* ================= PRIMITIVOS (compartidos) ================= */
:root {
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;

  --t-xs: 0.75rem; --t-sm: 0.85rem; --t-base: 0.95rem; --t-md: 1.05rem;
  --t-lg: 1.25rem; --t-xl: 1.5rem; --t-2xl: 2rem; --t-3xl: 2.6rem;

  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-pill: 999px;

  --dur-fast: 120ms; --dur: 180ms;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

/* ================= TEMA PÚBLICO ================= */
:root {
  --bg: #ffffff;
  --bg-alt: #f6f8fa;
  --surface: #ffffff;

  --border: #e3e8ee;
  --border-strong: #c9d2dd;
  --hairline: #e3e8ee;

  --primary: #1e3a8a;
  --primary-hover: #172e70;
  --primary-soft: #eef2fb;

  --accent: #b88a2e;
  --accent-soft: #faf5e8;
  --success: #1f7a4d;  --success-soft: #e7f4ed;
  --danger: #9b2c2c;   --danger-soft: #fbeaea;
  --warning: #92651b;  --warning-soft: #fdf3dd;

  --text: #1a2233;
  --text-muted: #5a6878;
  --text-soft: #8390a0;
  --text-inverse: #ffffff;

  --shadow-sm: 0 1px 3px rgba(16, 24, 40, 0.06);
  --shadow-md: 0 4px 12px rgba(16, 24, 40, 0.08);
  --shadow-lg: 0 12px 32px rgba(16, 24, 40, 0.12);

  --base-size: 16px;
}

/* ================= TEMA ADMIN (Stripe docs) ================= */
.admin-theme {
  --bg: #ffffff;
  --bg-alt: #f5f6f8;
  --surface: #ffffff;

  --border: #ebeef1;
  --border-strong: #d8dee4;
  --hairline: #ebeef1;

  --primary: #1e3a8a;
  --primary-hover: #172e70;
  --primary-soft: #eef2fb;

  /* cero dorado: accent = primary en admin */
  --accent: #1e3a8a;
  --accent-soft: #eef2fb;

  --text: #414552;
  --text-muted: #687385;
  --text-soft: #87909f;

  font-size: 14px;
}

/* ================= RESET / BASE ================= */
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: var(--base-size);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root { min-height: 100vh; background: var(--bg); }

a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; border: none; background: none; }
input, select, textarea { font-family: inherit; outline: none; }

h1, h2, h3, h4 {
  color: var(--text);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg-alt); }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: var(--radius-pill); }

/* ================= LAYOUT ================= */
.container { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-5); }

.section { padding: var(--sp-8) 0; }
.section-alt { background: var(--bg-alt); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.section-dark { background: var(--primary); color: var(--text-inverse); }
.section-dark h2, .section-dark h3 { color: var(--text-inverse); }

.eyebrow {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--text-soft);
}

.section-title { font-size: var(--t-xl); font-weight: 700; margin-bottom: var(--sp-2); }
.section-subtitle { color: var(--text-muted); font-size: var(--t-sm); margin-bottom: var(--sp-5); }
.text-muted { color: var(--text-muted); }
.text-soft { color: var(--text-soft); }
.mono { font-family: var(--font-mono); font-size: 0.92em; }

/* ================= BOTONES ================= */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-weight: 600; font-size: var(--t-sm); white-space: nowrap;
  padding: 10px 20px; border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition: background var(--dur), color var(--dur), border-color var(--dur), box-shadow var(--dur);
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-primary { background: var(--primary); color: var(--text-inverse); }
.btn-primary:hover:not(:disabled) { background: var(--primary-hover); }

.btn-secondary { background: var(--surface); color: var(--primary); border-color: var(--border-strong); }
.btn-secondary:hover:not(:disabled) { border-color: var(--primary); background: var(--primary-soft); }

.btn-ghost { background: transparent; color: var(--text-muted); }
.btn-ghost:hover:not(:disabled) { background: var(--bg-alt); color: var(--text); }

.btn-danger { background: var(--danger); color: var(--text-inverse); }
.btn-danger:hover:not(:disabled) { filter: brightness(0.92); }

.btn-sm { padding: 6px 14px; font-size: var(--t-xs); }
.btn-lg { padding: 13px 28px; font-size: var(--t-base); }
.btn-block { width: 100%; }

/* botón inverso para secciones oscuras */
.btn-inverse { background: var(--text-inverse); color: var(--primary); }
.btn-inverse:hover:not(:disabled) { background: #eef2fb; }

/* ================= CARDS ================= */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.card-elevated { box-shadow: var(--shadow-sm); }
.card-interactive { transition: border-color var(--dur), box-shadow var(--dur); }
.card-interactive:hover { border-color: var(--primary); box-shadow: var(--shadow-md); cursor: pointer; }

.card-pad-none { padding: 0; }
.card-pad-sm { padding: var(--sp-4); }
.card-pad-md { padding: var(--sp-5); }
.card-pad-lg { padding: var(--sp-6); }

/* ================= FORMS ================= */
.field { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.field-label {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.field-error-msg { font-size: var(--t-xs); color: var(--danger); font-weight: 500; }
.field-hint { font-size: var(--t-xs); color: var(--text-soft); }

.input, .select {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: var(--t-sm);
  padding: 10px 12px;
  width: 100%;
  transition: border-color var(--dur), box-shadow var(--dur);
}
.input:focus, .select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.input-error { border-color: var(--danger); }
.input-error:focus { box-shadow: 0 0 0 3px var(--danger-soft); }

.select-wrap { position: relative; }
.select { appearance: none; -webkit-appearance: none; padding-right: 36px; cursor: pointer; }
.select-arrow {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  color: var(--text-soft); pointer-events: none; font-size: 0.65rem;
}

/* ================= BADGES ================= */
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: var(--radius-pill);
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}
.badge::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: currentColor; display: inline-block;
}

.badge-draft     { color: var(--text-soft);   background: var(--bg-alt);       border-color: var(--border); }
.badge-published { color: var(--primary);     background: var(--primary-soft); }
.badge-active    { color: var(--success);     background: var(--success-soft); }
.badge-closed    { color: var(--danger);      background: var(--danger-soft); }
.badge-awarded   { color: var(--accent);      background: var(--accent-soft); }
.badge-winner    { color: var(--accent);      background: var(--accent-soft); }
.badge-outbid    { color: var(--danger);      background: var(--danger-soft); }
.badge-pending   { color: var(--warning);     background: var(--warning-soft); }
.badge-paid      { color: var(--success);     background: var(--success-soft); }

/* admin: chip rectangular compacto */
.admin-theme .badge { border-radius: 4px; padding: 2px 8px; font-size: 10.5px; }

/* ================= TABLAS ================= */
.table-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow-x: auto;
}
.table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--t-sm); }
.table th {
  padding: 12px 16px; text-align: left;
  color: var(--text-muted); font-weight: 600; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.06em;
  border-bottom: 1px solid var(--border);
  background: var(--bg-alt);
}
.table td {
  padding: 12px 16px; color: var(--text);
  vertical-align: middle; border-bottom: 1px solid var(--border);
}
.table tbody tr:last-child td { border-bottom: none; }
.table tbody tr { transition: background var(--dur-fast); }
.table tbody tr:hover { background: var(--bg-alt); }
.table-empty { padding: var(--sp-6); text-align: center; color: var(--text-soft); font-size: var(--t-sm); }

.table-dense th { padding: 8px 12px; }
.table-dense td { padding: 10px 12px; }

/* ================= ADMIN LAYOUT ================= */
.admin-shell { display: flex; min-height: 100vh; background: var(--bg); }

.admin-sidebar {
  width: 240px; position: fixed; top: 0; left: 0; bottom: 0;
  background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: var(--sp-5) var(--sp-3);
  z-index: 50;
}
.admin-main { flex: 1; margin-left: 240px; padding: var(--sp-6) var(--sp-7); }
.admin-content { max-width: 1100px; }

.admin-nav-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-soft);
  padding: var(--sp-4) var(--sp-3) var(--sp-2);
}
.admin-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: var(--radius-sm);
  color: var(--text-muted); font-size: var(--t-sm); font-weight: 500;
  border-left: 3px solid transparent;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.admin-nav-item:hover { background: var(--bg-alt); color: var(--text); }
.admin-nav-item.active {
  background: var(--bg-alt); color: var(--primary); font-weight: 600;
  border-left-color: var(--primary);
}

.admin-chip {
  display: inline-block; font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--primary); background: var(--primary-soft);
  padding: 2px 8px; border-radius: 4px;
}

/* ================= KPIs (admin) ================= */
.kpi-row {
  display: flex; flex-wrap: wrap;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--surface);
}
.kpi { flex: 1 1 0; min-width: 160px; padding: var(--sp-5); }
.kpi + .kpi { border-left: 1px solid var(--border); }
.kpi-value { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
.kpi-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

/* barras de reporte */
.bar-track { background: var(--bg-alt); border-radius: var(--radius-pill); height: 8px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: var(--radius-pill); background: var(--primary); }

/* ================= LANDING ================= */
.trust-line {
  display: flex; gap: var(--sp-5); flex-wrap: wrap;
  color: var(--text-muted); font-size: var(--t-sm);
}
.trust-line span { display: inline-flex; align-items: center; gap: 8px; }

.stat-strip { display: flex; flex-wrap: wrap; }
.stat-strip-item { flex: 1 1 0; min-width: 140px; padding: 0 var(--sp-5); }
.stat-strip-item + .stat-strip-item { border-left: 1px solid var(--border); }
.stat-strip-value { font-size: var(--t-2xl); font-weight: 800; letter-spacing: -0.02em; color: var(--primary); }
.stat-strip-label { font-size: var(--t-xs); color: var(--text-muted); margin-top: 2px; }

.steps-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-5); }
.step-num {
  font-size: var(--t-sm); font-weight: 700; color: var(--primary);
  background: var(--primary-soft); border-radius: var(--radius-pill);
  width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: var(--sp-3);
}

/* precio dorado (solo público) */
.price-accent { color: var(--accent); font-weight: 700; }

/* ================= UTILIDADES ================= */
.grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--sp-5); }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeIn 0.35s ease both; }

/* ================= RESPONSIVE ================= */
@media (max-width: 900px) {
  .steps-row { grid-template-columns: 1fr 1fr; }
  .admin-sidebar {
    position: static; width: 100%; flex-direction: row; align-items: center;
    border-right: none; border-bottom: 1px solid var(--border);
    padding: var(--sp-3); overflow-x: auto;
  }
  .admin-shell { flex-direction: column; }
  .admin-main { margin-left: 0; padding: var(--sp-5); }
  .admin-nav-label { display: none; }
  .kpi + .kpi { border-left: none; border-top: 1px solid var(--border); }
}

@media (max-width: 640px) {
  .steps-row { grid-template-columns: 1fr; }
  .stat-strip-item + .stat-strip-item { border-left: none; }
}

/* ================= COMPAT (eliminar en Task 11) ================= */
:root {
  --bg-deep: #f6f8fa;
  --surface-2: #f6f8fa;
  --primary-600: #1d4ed8;
  --primary-500: #2563eb;
  --nm-light: rgba(255, 255, 255, 0);
  --nm-dark: rgba(16, 24, 40, 0.08);
  --nm-out-sm: var(--shadow-sm);
  --nm-out-md: var(--shadow-sm);
  --nm-out-lg: var(--shadow-md);
  --nm-in-sm: inset 0 0 0 1px var(--border);
  --nm-in-md: inset 0 0 0 1px var(--border-strong);
  --nm-flat: var(--shadow-sm);
}
```

- [ ] **Step 2: Crear `frontend/scripts/shot.mjs`** con el código de la sección "Verificación" de arriba. NO añadirlo a git.

- [ ] **Step 3: Verificar que el sitio sigue renderizando (modo compat)**

```bash
cd frontend && mkdir -p /tmp/chocao-shots && bun scripts/shot.mjs http://localhost:5173/ /tmp/chocao-shots/t1-landing.png
```
Esperado: `ERRORS: []`. El screenshot se ve "plano" (sin relieves) pero completo y legible — es el estado compat esperado.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(rediseño): nuevo sistema de diseño con temas público y admin

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Componentes base nuevos

**Files:**
- Create: `frontend/src/components/Card.tsx`
- Create: `frontend/src/components/Button.tsx`
- Create: `frontend/src/components/Input.tsx`
- Create: `frontend/src/components/Select.tsx`
- Modify: `frontend/src/components/DataTable.tsx` (reescritura a clases + prop `dense`)
- Modify: `frontend/src/components/PageHeader.tsx` (reescritura a clases)
- Modify: `frontend/src/components/StatusBadge.tsx` (sin cambios de interfaz; solo confirmar que usa `.badge badge-*`, ya lo hace — no tocar si es así)

**Interfaces:**
- Produces:
  - `Card`: `{ children, className?, style?, variant?: "default"|"elevated", interactive?: boolean, padding?: "none"|"sm"|"md"|"lg", onClick? }` — default `variant="default"`, `padding="md"`.
  - `Button`: `extends React.ButtonHTMLAttributes<HTMLButtonElement>` + `{ variant?: "primary"|"secondary"|"ghost"|"danger"|"inverse", size?: "sm"|"md"|"lg", fullWidth?: boolean }` — default `primary`/`md`.
  - `Input`: `extends React.InputHTMLAttributes<HTMLInputElement>` + `{ label?, error?, hint? }`.
  - `Select`: `extends React.SelectHTMLAttributes<HTMLSelectElement>` + `{ label?, options: {value,label}[] }`.
  - `DataTable<T>`: interfaz actual (`columns`, `data`, `emptyMessage`) + nuevo `dense?: boolean`.
  - `PageHeader`: interfaz actual (`title`, `subtitle?`, `actions?`, `eyebrow?`).
- Los componentes viejos (`GlassCard`, `GlassButton`, `GlassInput`, `NeumorphicSelect`) NO se tocan — siguen funcionando vía tokens compat hasta que cada página migre.

- [ ] **Step 1: Crear `frontend/src/components/Card.tsx`:**

```tsx
import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: "default" | "elevated";
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export default function Card({
  children,
  className = "",
  style,
  variant = "default",
  interactive = false,
  padding = "md",
  onClick,
}: Props) {
  const cls = [
    "card",
    variant === "elevated" && "card-elevated",
    interactive && "card-interactive",
    `card-pad-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Crear `frontend/src/components/Button.tsx`:**

```tsx
import React from "react";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "inverse";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...props
}: Props) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size !== "md" && `btn-${size}`,
    fullWidth && "btn-block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Crear `frontend/src/components/Input.tsx`:**

```tsx
import React from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({ label, error, hint, className = "", ...props }: Props) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <input className={`input ${error ? "input-error" : ""} ${className}`} {...props} />
      {error && <span className="field-error-msg">{error}</span>}
      {!error && hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Crear `frontend/src/components/Select.tsx`:**

```tsx
import React from "react";

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, options, className = "", ...props }: Props) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <div className="select-wrap">
        <select className={`select ${className}`} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="select-arrow">▼</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Reescribir `frontend/src/components/DataTable.tsx`:**

```tsx
import React from "react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  width?: string;
  align?: "left" | "right" | "center";
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  dense?: boolean;
}

export default function DataTable<T extends { _id?: string }>({
  columns,
  data,
  emptyMessage = "Sin datos para mostrar",
  dense = false,
}: Props<T>) {
  return (
    <div className="table-wrap">
      <table className={`table ${dense ? "table-dense" : ""}`}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{ width: col.width, textAlign: col.align || "left" }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr key={row._id || ri}>
                {columns.map((col, ci) => (
                  <td key={ci} style={{ textAlign: col.align || "left" }}>
                    {typeof col.accessor === "function"
                      ? col.accessor(row)
                      : String(row[col.accessor] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

(Nota: se elimina el export `NeumorphicTable`; verificar antes con `grep -r "NeumorphicTable" frontend/src/` — si alguna página lo importa, actualizar ese import a `DataTable` en este mismo step.)

- [ ] **Step 6: Reescribir `frontend/src/components/PageHeader.tsx`:**

```tsx
import React from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}

export default function PageHeader({ title, subtitle, actions, eyebrow }: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: "var(--sp-4)",
        marginBottom: "var(--sp-6)",
      }}
    >
      <div>
        {eyebrow && <p className="eyebrow" style={{ marginBottom: "var(--sp-2)" }}>{eyebrow}</p>}
        <h1 style={{ fontSize: "var(--t-2xl)" }}>{title}</h1>
        {subtitle && (
          <p className="text-muted" style={{ marginTop: 6, fontSize: "var(--t-sm)" }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: "var(--sp-3)" }}>{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 7: Verificar compilación y render**

```bash
cd frontend && bunx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
bun scripts/shot.mjs http://localhost:5173/ /tmp/chocao-shots/t2-landing.png
```
Esperado: sin errores TS nuevos; `ERRORS: []`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Card.tsx frontend/src/components/Button.tsx frontend/src/components/Input.tsx frontend/src/components/Select.tsx frontend/src/components/DataTable.tsx frontend/src/components/PageHeader.tsx
git commit -m "feat(rediseño): componentes base Card/Button/Input/Select y tablas por clases CSS

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Layout público — Navbar, PublicLayout, UserMenu

**Files:**
- Modify: `frontend/src/components/Navbar.tsx`
- Modify: `frontend/src/layouts/PublicLayout.tsx`
- Modify: `frontend/src/components/UserMenu.tsx`
- Read primero: `frontend/src/components/Logo.tsx` (se conserva tal cual salvo que use tokens nm)

**Interfaces:**
- Consumes: `Button` de Task 2, clases de Task 1.
- Produces: mismo contrato de rutas/props que hoy (drop-in replacement).

- [ ] **Step 1: Reescribir `Navbar.tsx`** — estructura:
  - `<nav>` con `background: var(--surface)`, `borderBottom: 1px solid var(--border)`, sticky top, sin sombras.
  - Izquierda: `Logo` + wordmark "Chocao" (mantener subtítulo "Subastas Gov · Panamá" en `.eyebrow`).
  - Centro-derecha: `NavLink`s como texto plano — clase inline: color `var(--text-muted)`, activo `var(--primary)` con `fontWeight: 600` y `borderBottom: 2px solid var(--primary)` (sin fondo, sin pill). Mantener la lógica actual de `role` para el enlace Backoffice (ahora `Button variant="secondary" size="sm"`).
  - "Ingresar" → `Button variant="ghost" size="sm"`; "Registrarse" → `Button variant="primary" size="sm"` (único botón sólido).
  - Mantener intacta la lógica: `useAuth`, fetch de `/api/users/me`, `UserMenu`.

- [ ] **Step 2: Reescribir `PublicLayout.tsx`** — mismo esqueleto actual (Navbar + Outlet + footer), footer sobre `var(--bg-alt)` con `borderTop: 1px solid var(--border)`, mismos enlaces y copy.

- [ ] **Step 3: Actualizar `UserMenu.tsx`** — leerlo primero; reemplazar cualquier `var(--nm-*)` / `GlassButton` por `Button` y `.card card-elevated` para el dropdown (posicionado absolute). Mantener el flujo de confirmación de logout tal cual.

- [ ] **Step 4: Verificar**

```bash
cd frontend && bun scripts/shot.mjs http://localhost:5173/ /tmp/chocao-shots/t3-navbar.png
```
Esperado: `ERRORS: []`; navbar blanca con hairline, sin pills. Mirar el screenshot.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Navbar.tsx frontend/src/layouts/PublicLayout.tsx frontend/src/components/UserMenu.tsx
git commit -m "feat(rediseño): navbar y layout público corporativo con hairlines

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Landing reestructurada

**Files:**
- Modify: `frontend/src/pages/Landing.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `Card`, `Button`, `Countdown` (existente), `VehicleCard` (aún viejo — se migra en Task 5; usarlo tal cual), API pública `GET /api/vehicles` vía `lib/api.ts`.

**Estructura requerida (spec §2):**
1. **Hero** (2 columnas en `.container`): izquierda — `.eyebrow` "REPÚBLICA DE PANAMÁ · SUBASTA PÚBLICA", `<h1>` grande (t-3xl), copy breve, fila de CTAs (`Button primary lg` "Ver catálogo" → `/vehicles`, `Button secondary lg` "Crear cuenta" → `/register`); debajo `.trust-line`: "✓ Proceso transparente · ✓ Trazabilidad completa · ✓ Pago seguro". Derecha — `Card elevated` con imagen del primer vehículo `active` (o el más reciente), título, `Countdown` y precio actual con `.price-accent`.
2. **Stats reales**: `.stat-strip` con conteos derivados del fetch ya hecho:
```tsx
const activos = vehicles.filter((v) => v.status === "active").length;
const publicados = vehicles.filter((v) => v.status === "published").length;
const cerrados = vehicles.filter((v) => v.status === "closed" || v.status === "awarded").length;
const stats = [
  { value: activos, label: "Subastas activas" },
  { value: publicados, label: "Próximas subastas" },
  { value: cerrados, label: "Subastas concluidas" },
].filter((s) => s.value > 0);
// si stats.length === 0 no se renderiza la franja
```
3. **Cómo funciona**: sección `.section-alt` con `.steps-row` — 4 pasos (`.step-num` 01–04): Regístrate / Explora el catálogo / Realiza tu puja / Adjudica y paga, cada uno con título 600 y una línea de descripción (reusar los textos actuales).
4. **Vehículos destacados**: `.grid-cards` con hasta 4 `VehicleCard` + enlace "Ver todos →".
5. **CTA final**: `.section section-dark` — título "¿Listo para participar?", copy breve, `Button inverse lg` "Crear cuenta gratuita" → `/register`.

**Se elimina**: la sección de 4 tarjetas de beneficios con iconos y los números inventados (50+/200+/1,200+).

- [ ] **Step 1: Leer `Landing.tsx` actual** para conservar el fetch y helpers existentes.
- [ ] **Step 2: Reescribir con la estructura de arriba.** Mantener textos en español; no inventar contenido nuevo fuera de lo especificado.
- [ ] **Step 3: Verificar**

```bash
cd frontend && bun scripts/shot.mjs http://localhost:5173/ /tmp/chocao-shots/t4-landing.png
```
Esperado: `ERRORS: []`; hero 2 columnas, trust line, stats reales, pasos en línea, CTA azul oscuro al final. Mirar el screenshot con ojo crítico.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Landing.tsx
git commit -m "feat(rediseño): landing corporativa con stats reales y CTA institucional

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Catálogo + VehicleCard

**Files:**
- Modify: `frontend/src/components/VehicleCard.tsx` (reescritura)
- Modify: `frontend/src/pages/CatalogPage.tsx`
- Modify: `frontend/src/components/EmptyState.tsx` y `frontend/src/components/LoadingState.tsx` (leer; quitar tokens nm si los usan, mantener interfaz)

**Interfaces:**
- Consumes: `Card`, `Input`, `Select`, `StatusBadge`, `Countdown`.
- Produces: `VehicleCard` mantiene props actuales (leerlas antes de reescribir).

**Requisitos (spec §2):**
- `VehicleCard`: `Card padding="none" interactive` — imagen 16:10 (object-fit cover, borde inferior hairline), cuerpo con `.eyebrow` marca·año, título 600, fila de metadatos muted, fila de precio: label "Oferta actual" + cifra con `.price-accent`; `StatusBadge` superpuesto en la esquina de la imagen. Sin translateY en hover (la clase `.card-interactive` ya da borde azul + sombra).
- `CatalogPage`: `PageHeader` + fila única de filtros (`Input` búsqueda con flex 1 + `Select` de estado ancho fijo 200px) + `.grid-cards`. Mantener la lógica de filtrado existente.

- [ ] **Step 1: Leer `VehicleCard.tsx` y `CatalogPage.tsx` actuales.**
- [ ] **Step 2: Reescribir ambos según requisitos.**
- [ ] **Step 3: Verificar**

```bash
cd frontend && bun scripts/shot.mjs http://localhost:5173/vehicles /tmp/chocao-shots/t5-catalog.png
```
Esperado: `ERRORS: []`; grid de tarjetas con borde, filtros en una fila.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/VehicleCard.tsx frontend/src/pages/CatalogPage.tsx frontend/src/components/EmptyState.tsx frontend/src/components/LoadingState.tsx
git commit -m "feat(rediseño): catálogo con tarjetas de borde y filtros en línea

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Detalle de vehículo + BidForm + Countdown

**Files:**
- Modify: `frontend/src/pages/VehicleDetailPage.tsx` (reestructuración)
- Modify: `frontend/src/components/BidForm.tsx`
- Modify: `frontend/src/components/Countdown.tsx` (leer; solo restilizar si usa tokens nm)

**Interfaces:**
- Consumes: `Card`, `Button`, `Input`, `StatusBadge`, `DataTable`.
- Sin cambios en llamadas API (`GET /api/vehicles/:id`, `GET /api/bids/vehicle/:id`, `POST /api/bids/vehicle/:id`).

**Requisitos (spec §2):**
- Grid 2 columnas (`1fr 380px`, gap sp-6; colapsa a 1 columna bajo 900px vía inline `gridTemplateColumns` condicionado por CSS — usar wrapper con clase y media query añadida a index.css si hace falta: `.detail-grid { display:grid; grid-template-columns: 1fr 380px; gap: var(--sp-6);} @media (max-width: 900px){ .detail-grid { grid-template-columns: 1fr; } }` — añadir esa clase a index.css en este task).
- Izquierda: galería (imagen principal + thumbnails con borde, activa con borde azul) + tabla de especificaciones 2 columnas con hairlines (dt muted / dd normal).
- Derecha: panel sticky (`position: sticky; top: 88px`) — `Card elevated`: precio actual grande `.price-accent`, `Countdown`, `BidForm`, historial de pujas compacto debajo (lista con hairlines, monto + fecha).
- `BidForm`: `Input` para monto + fila de 3 `Button secondary sm` (+5%, +10%, +20%) + `Button primary block` "Pujar". Mantener validación y submit actuales.

- [ ] **Step 1: Leer los 3 archivos actuales.**
- [ ] **Step 2: Añadir `.detail-grid` a `index.css`** (bloque LANDING/utilidades) con la media query de arriba.
- [ ] **Step 3: Reescribir página y componentes según requisitos.**
- [ ] **Step 4: Verificar** — obtener un id real:

```bash
curl -s "http://localhost:3000/api/vehicles" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['_id'])"
cd frontend && bun scripts/shot.mjs "http://localhost:5173/vehicles/<ID>" /tmp/chocao-shots/t6-detail.png
```
Esperado: `ERRORS: []`; layout 2 columnas con panel sticky.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/VehicleDetailPage.tsx frontend/src/components/BidForm.tsx frontend/src/components/Countdown.tsx frontend/src/index.css
git commit -m "feat(rediseño): detalle de vehículo con panel de puja sticky

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Auth — Login, Registro, OTP, tabs

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/components/AuthMethodTabs.tsx`
- Modify: `frontend/src/components/EmailOtpForm.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `Input`.
- **CRÍTICO: no tocar la lógica de Clerk** (signIn/signUp/prepare/attempt/setActive) — solo la presentación.

**Requisitos (spec §2):**
- Página: fondo `var(--bg-alt)` a pantalla completa (menos navbar), `Card elevated padding="lg"` centrada de max-width 440px, logo pequeño arriba, título, tabs, formulario.
- `AuthMethodTabs`: tabs subrayados — botones de texto con `borderBottom: 2px solid` (activo: `var(--primary)` + texto primary 600; inactivo: transparent + muted), sobre una línea base `1px solid var(--border)`. Sin fondos ni pills.
- `EmailOtpForm`: `Input`s + `Button primary block`; paso de código con el input centrado `.mono`.

- [ ] **Step 1: Leer los 4 archivos actuales.**
- [ ] **Step 2: Reescribir presentación según requisitos, lógica intacta.**
- [ ] **Step 3: Verificar**

```bash
cd frontend && bun scripts/shot.mjs http://localhost:5173/login /tmp/chocao-shots/t7-login.png && bun scripts/shot.mjs http://localhost:5173/register /tmp/chocao-shots/t7-register.png
```
Esperado: `ERRORS: []` en ambas; tarjeta centrada con tabs subrayados.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/components/AuthMethodTabs.tsx frontend/src/components/EmailOtpForm.tsx
git commit -m "feat(rediseño): auth con tarjeta centrada y tabs subrayados

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Páginas de cliente — Mis pujas, Mis compras, Checkout

**Files:**
- Modify: `frontend/src/pages/MyBidsPage.tsx`
- Modify: `frontend/src/pages/MyPurchasesPage.tsx`
- Modify: `frontend/src/pages/CheckoutResultPage.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `DataTable`, `StatusBadge`, `PageHeader`.
- Sin cambios en API ni en la condición del botón Pagar (`bid.status === "winner"` → `POST /api/payments/create-checkout-session`).

**Requisitos (spec §2):**
- `MyBidsPage`: `PageHeader` + `.stat-strip` con 3 stats (pujas totales / activas / ganadas — ya se calculan hoy; conservar) + `DataTable` con columnas: Vehículo (thumbnail 40px + título), Monto (`.mono` + `.price-accent` si winner), Estado (`StatusBadge`), Fecha, Acción (botón "Pagar ahora" `Button primary sm` solo si winner). Reemplaza las tarjetas grandes actuales.
- `MyPurchasesPage`: `PageHeader` + `DataTable` equivalente (Vehículo, Monto pagado, Fecha, Estado `paid`).
- `CheckoutResultPage`: `Card elevated` centrada max-width 480px — icono círculo (verde éxito / rojo cancel), título, resumen (vehículo, monto) y un CTA (`Button primary` "Ver mis compras" o "Volver a mis pujas"). Mantener la llamada a `GET /api/payments/success` tal cual.

- [ ] **Step 1: Leer las 3 páginas actuales.**
- [ ] **Step 2: Reescribir según requisitos.**
- [ ] **Step 3: Verificar** (sin sesión redirigen a login — basta consola limpia):

```bash
cd frontend && bun scripts/shot.mjs http://localhost:5173/my-bids /tmp/chocao-shots/t8-mybids.png
```
Esperado: `ERRORS: []` (renderiza login por redirección). Verificación visual autenticada la hará el usuario al final.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/MyBidsPage.tsx frontend/src/pages/MyPurchasesPage.tsx frontend/src/pages/CheckoutResultPage.tsx
git commit -m "feat(rediseño): mis pujas/compras como tablas y checkout minimalista

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: AdminLayout con tema Stripe docs

**Files:**
- Modify: `frontend/src/layouts/AdminLayout.tsx` (reescritura completa)

**Interfaces:**
- Consumes: clases `.admin-*` de Task 1, `Button`, `Logo`.
- Produces: todo el subtree admin queda envuelto en `<div className="admin-theme admin-shell">`.

**Requisitos (spec §3):**
- Wrapper raíz: `<div className="admin-theme admin-shell">`.
- Sidebar `.admin-sidebar`: arriba `Link to="/"` con `Logo size={32}` + "Chocao" + `.admin-chip` "Backoffice"; navegación con `.admin-nav-label` "GESTIÓN" (Dashboard `/admin` end, Vehículos `/admin/vehicles`, Pujas `/admin/bids`) y "ANÁLISIS" (Reportes `/admin/reports`), cada item `NavLink` con `className={({isActive}) => "admin-nav-item" + (isActive ? " active" : "")}` conservando los iconos actuales; abajo (mt auto): bloque de usuario (avatar iniciales 32px cuadrado redondeado fondo `var(--primary-soft)` texto primary, nombre + email truncados), `Button ghost sm fullWidth` "Cerrar sesión" (mantener modal de confirmación actual pero restilizado: `Card elevated` centrada, sin blur ni círculo con sombra) y `Link to="/"` `.admin-nav-item` "← Ver sitio público".
- Main: `.admin-main` > `.admin-content` > `Outlet`.

- [ ] **Step 1: Reescribir `AdminLayout.tsx` según requisitos** (la lógica de `useClerk`/`useUser`/`signOut`/confirm se conserva).
- [ ] **Step 2: Verificar** (redirige a login sin sesión — consola limpia):

```bash
cd frontend && bun scripts/shot.mjs http://localhost:5173/admin /tmp/chocao-shots/t9-admin.png && bunx tsc --noEmit -p tsconfig.app.json 2>&1 | head -10
```
Esperado: `ERRORS: []`, sin errores TS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/layouts/AdminLayout.tsx
git commit -m "feat(rediseño): backoffice con sidebar estilo Stripe docs y tema propio

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Páginas admin — Dashboard, Vehículos, Pujas, Reportes

**Files:**
- Modify: `frontend/src/pages/admin/AdminDashboard.tsx`
- Modify: `frontend/src/pages/admin/AdminVehicles.tsx`
- Modify: `frontend/src/pages/admin/AdminBids.tsx`
- Modify: `frontend/src/pages/admin/AdminReports.tsx`
- Modify: `frontend/src/components/AdminStatCard.tsx` → reemplazado por `.kpi-row`/`.kpi` (eliminar el componente si queda sin usos; si se conserva, reescribirlo como bloque `.kpi`)
- Modify: `frontend/src/components/ImageDropzone.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `Input`, `Select`, `DataTable` (`dense`), `StatusBadge`, `PageHeader`, clases `.kpi*`, `.bar-*`, `.mono`.
- Sin cambios en llamadas API (`/api/dashboard/summary`, `/api/dashboard/reports`, CRUD `/api/vehicles`, `/api/bids`).

**Requisitos (spec §3):**
- `AdminDashboard`: `PageHeader` + `.kpi-row` con 4 `.kpi` (valor `.kpi-value`, label `.kpi-label`) + tablas compactas (`DataTable dense`) de actividad reciente que ya existan.
- `AdminVehicles`: tabla `DataTable dense` — thumbnail 40px, ID corto `.mono` gris (`_id.slice(-6)`), título, `Select` compacto de estado inline (mantener handler actual de `PATCH /status`), precio `.mono`, acciones (Editar/Eliminar) como `Button ghost sm`. El form crear/editar mantiene el patrón panel inline (`showForm`), restilizado: `Card padding="lg"` con grid 2 columnas de `Input`/`Select`, `ImageDropzone` con borde punteado (`border: 2px dashed var(--border-strong)`, fondo `var(--bg-alt)`, sin sombras), fila de acciones al final.
- `AdminBids`: `DataTable dense` — vehículo, usuario, monto `.mono`, estado chip, fecha.
- `AdminReports`: `.kpi-row` para métricas + distribución por estado como filas: label + `.bar-track`>`.bar-fill` (width = porcentaje, color por estado: usar `var(--primary)` para todos salvo `closed`→`var(--danger)` y `active`→`var(--success)`) + porcentaje `.mono` a la derecha.
- **Cero dorado**: dentro de `.admin-theme` no usar `.price-accent` (usar `.mono` normal).

- [ ] **Step 1: Leer las 4 páginas + `AdminStatCard.tsx` + `ImageDropzone.tsx`.**
- [ ] **Step 2: Reescribir según requisitos.** Si `AdminStatCard` queda sin usos, eliminar el archivo y sus imports.
- [ ] **Step 3: Verificar**

```bash
cd frontend && bunx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
bun scripts/shot.mjs http://localhost:5173/admin /tmp/chocao-shots/t10-admin.png
```
Esperado: sin errores TS; `ERRORS: []`.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/pages/admin frontend/src/components/ImageDropzone.tsx
# + AdminStatCard.tsx si se modificó/eliminó
git commit -m "feat(rediseño): páginas admin densas con KPIs y tablas estilo Stripe

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Barrido final — eliminar Glass/Neumorphic y compat

**Files:**
- Delete: `frontend/src/components/GlassCard.tsx`, `GlassButton.tsx`, `GlassInput.tsx`, `NeumorphicSelect.tsx`
- Modify: `frontend/src/index.css` (eliminar bloque `/* COMPAT */`)
- Modify: cualquier archivo que aún importe los componentes viejos

**Interfaces:**
- Consumes: todo lo anterior. Al terminar, el grep de constraints globales da 0.

- [ ] **Step 1: Encontrar usos restantes**

```bash
cd frontend && grep -rlE "GlassCard|GlassButton|GlassInput|NeumorphicSelect|Neumorphic" src/
```

- [ ] **Step 2: Migrar cada uso restante** a `Card`/`Button`/`Input`/`Select` (mapa de variantes Button: `primary`→`primary`, `accent`→`secondary`, `ghost`→`ghost`, `danger`→`danger`).
- [ ] **Step 3: Eliminar los 4 archivos viejos** con `git rm`.
- [ ] **Step 4: Eliminar el bloque `/* COMPAT */`** completo al final de `index.css` (incluye todos los `--nm-*`, `--bg-deep`, `--surface-2`, `--primary-600`, `--primary-500` — verificar antes que nadie los use: `grep -rE "bg-deep|surface-2|primary-600|primary-500" src/`).
- [ ] **Step 5: Verificación final**

```bash
cd frontend && grep -rE "nm-|Glass|Neumorphic" src/ ; echo "exit: $?"
bunx tsc --noEmit -p tsconfig.app.json 2>&1 | head -10
bun scripts/shot.mjs http://localhost:5173/ /tmp/chocao-shots/t11-landing.png
bun scripts/shot.mjs http://localhost:5173/vehicles /tmp/chocao-shots/t11-catalog.png
bun scripts/shot.mjs http://localhost:5173/login /tmp/chocao-shots/t11-login.png
```
Esperado: grep sin resultados (`exit: 1`), TS limpio, `ERRORS: []` en las tres.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(rediseño): elimina componentes neumórficos y tokens de compatibilidad

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Verificación de usuario (gate final)

- [ ] **Step 1:** Revisar todos los screenshots de `/tmp/chocao-shots/` uno a uno.
- [ ] **Step 2:** Avisar al usuario para prueba manual completa (login OTP, puja, panel admin autenticado, flujo Stripe con `4242…`).
- [ ] **Step 3:** Solo tras aprobación explícita del usuario: push al repositorio como "rediseño" (el usuario pidió: "una vez aprobado subes los cambios al repositorio como rediseño"). NO pushear antes.
