# Rediseño corporativo de Chocao — Design Doc

**Fecha**: 2026-07-06
**Estado**: Aprobado por el usuario (brainstorming completo)

## Objetivo

Eliminar por completo el estilo neumórfico del frontend y reemplazarlo por un
lenguaje visual profesional/corporativo, minimalista y funcional. El backoffice
recibe un diseño deliberadamente distinto al sitio público (estilo Stripe docs)
para evitar confusión de contexto administrativo.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Paleta | Se conserva la identidad: azul institucional `#1e3a8a` + dorado `#b88a2e`, sobre fondos blancos/grises limpios |
| Alcance | Todas las pantallas: públicas, auth, cliente y backoffice |
| Estructura | Rediseño estructural libre (no reskin estricto) |
| Backoffice | Diseño diferenciado, estilo Stripe docs |
| Implementación | Opción A: sistema de tokens CSS + clases, dos temas; se abandona el patrón de 419 estilos inline |

## 1. Sistema de diseño (index.css)

Tres capas en un solo archivo:

### Primitivos compartidos
- Espaciado: escala 4–64px (se mantiene `--sp-1..8`).
- Radios reducidos: 6 / 10 / 14px (`--radius-sm/md/lg`). Sin radios grandes neumórficos.
- Tipografía: Inter (se mantiene), escala actual `--t-xs..3xl`.
- Transiciones: duraciones estándar 120/180ms.

### Tema público (`:root`)
- Fondo `#ffffff`; secciones alternas `#f6f8fa`.
- Superficies delimitadas por borde hairline `1px solid #e3e8ee`; sin sombras
  neumórficas. Única sombra permitida: `0 1px 3px rgba(16,24,40,.06)` para
  tarjetas elevadas y dropdowns.
- Azul institucional `#1e3a8a` como color de acción dominante.
- Dorado `#b88a2e` de uso quirúrgico: solo precios/pujas y badge de ganador.
- Verde `#1f7a4d` / rojo `#9b2c2c` semánticos se mantienen.
- Jerarquía tipográfica: títulos 600–700 con tracking apretado, cuerpo 400,
  labels metadato uppercase 11px.

### Tema admin (`.admin-theme` envolviendo AdminLayout)
- Redefine variables semánticas al estilo Stripe docs.
- Fondo `#ffffff` pleno; texto base 14px denso.
- Grises fríos: texto `#414552`, muted `#687385`, bordes `#ebeef1`.
- Azul institucional como único acento. **Cero dorado en admin.**
- Monospace para IDs y montos.

### Badges de estado
Mismo mapa semántico de colores en ambos temas; forma distinta:
- Público: pill con fondo suave.
- Admin: chip rectangular compacto.

## 2. Sitio público (estructura)

- **Navbar**: barra blanca, borde inferior hairline. Logo+wordmark izquierda,
  enlaces centro-derecha, "Registrarse" único botón sólido azul. Sin píldoras.
- **Landing**: hero sobrio 2 columnas (titular izquierda + copy + 2 CTAs
  sólido/outline; tarjeta limpia del vehículo destacado con countdown a la
  derecha). Línea de trust bajo el hero ("Proceso transparente · Trazabilidad
  completa · Pago seguro") — reemplaza la sección de 4 tarjetas de beneficios.
  Franja de **stats reales** derivadas del catálogo ya descargado (subastas
  activas, publicados, cerradas); si un conteo es 0 la franja se oculta. Los
  números inventados (50+/200+/1,200+) se eliminan. "Cómo funciona" en 4 pasos
  numerados en línea horizontal. Grid de vehículos destacados. CTA final sobre
  fondo azul institucional (única sección oscura).
- **Catálogo**: barra de filtros en una fila (búsqueda + select estado), grid
  de tarjetas con borde, imagen 16:10, título, metadatos (año · marca ·
  kilometraje), precio con dorado solo en la cifra. Hover: borde azul + sombra
  sutil, sin levitación.
- **Detalle de vehículo**: 2 columnas — galería + info izquierda; panel de puja
  **sticky** derecha (precio actual, countdown, form con sugerencias
  +5/10/20%, historial compacto). Especificaciones en tabla 2 columnas con
  hairlines.
- **Login/Registro**: tarjeta única centrada sobre fondo gris claro, tabs
  OTP/contraseña subrayados (no botones).
- **Mis pujas / Mis compras**: encabezado + 3 stats en línea + tabla limpia
  (reemplaza tarjetas grandes); botón "Pagar" solo en filas winner.
- **Checkout success/cancel**: confirmación centrada minimalista.
- **Responsive**: grids colapsan a 1 columna en móvil; panel sticky pasa a
  bloque normal bajo la galería; sidebar admin se vuelve barra superior
  colapsable.

## 3. Backoffice (estilo Stripe docs)

- **Sidebar fija 240px** izquierda, blanca, borde derecho hairline. Logo
  compacto + chip "Backoffice". Navegación agrupada con labels 11px uppercase:
  GESTIÓN (Dashboard, Vehículos, Pujas) · ANÁLISIS (Reportes). Ítem activo:
  fondo `#f5f6f8`, texto azul, barra indicadora 3px izquierda. Abajo: UserMenu
  + enlace "← Ver sitio público".
- **Contenido**: fondo blanco, contenedor máx 1100px alineado a la izquierda,
  breadcrumb pequeño, título 24px, texto 14px.
- **Dashboard**: 4 KPIs como bloques separados por hairlines verticales
  (número 28px + label 12px + delta). Tablas compactas de actividad reciente.
- **Vehículos**: tabla densa (filas 44px, thumbnail 40px, ID monospace gris,
  select de estado inline compacto, acciones como iconos al hover). Form
  crear/editar como modal/panel con inputs de borde simple; dropzone con borde
  punteado gris.
- **Pujas**: tabla densa, monto en monospace, filtrable.
- **Reportes**: distribución por estado como barras horizontales finas con
  porcentaje; métricas en la retícula de KPIs.

## 4. Plan técnico

### Componentes (renombrado + clases CSS)

| Actual | Nuevo | Cambio |
|---|---|---|
| `GlassCard` | `Card` | variantes `default` (borde) / `elevated` (sombra sutil); sin hover JS |
| `GlassButton` | `Button` | `primary` (azul sólido) / `secondary` (outline) / `ghost` / `danger`; estados por CSS |
| `GlassInput` | `Input` | borde simple, focus ring azul |
| `NeumorphicSelect` | `Select` | ídem |
| `DataTable` | `DataTable` | gana variante `dense` para admin |

Alias temporales (`GlassCard = Card`) solo durante la migración; el commit
final no contiene rastro de "Glass/Neumorphic" ni tokens `--nm-*`.

### Orden de trabajo
1. `index.css` nuevo completo (tokens + clases de componentes + tema admin).
2. Componentes base.
3. Layouts (Navbar, PublicLayout, AdminLayout con sidebar).
4. Páginas públicas.
5. Páginas admin.
6. Barrido final: `grep -r "nm-\|Glass\|Neumorphic" src/` debe dar 0.

### Sin cambios en
Rutas, llamadas API, lógica Clerk/Stripe, backend.

### Verificación
- Tras cada grupo de páginas: screenshot Playwright headless + consola sin
  errores.
- Al final: flujo manual completo del usuario (login OTP, puja, admin).
- Solo tras aprobación del usuario se commitea y pushea como "rediseño".

## Riesgos
- Romper handlers al reestructurar JSX → mitigado con verificación por página
  en navegador.
- Las stats reales de la landing dependen del payload del catálogo público →
  si el cálculo no es derivable del fetch existente, se ocultan (no se añaden
  endpoints).
