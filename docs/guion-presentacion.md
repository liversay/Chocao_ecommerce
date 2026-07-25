# Guion — Presentación Chocao (20 min)

Guion cronometrado para la presentación del proyecto, dividido en bloques y repartido entre 3 presentadores. Si el equipo es de 2 personas, los bloques de "Presentador 3" pueden fusionarse con el 1 o el 2 sin problema — no dependen entre sí. Cronometrado a ritmo de exposición normal (~140 ppm); el bloque de cierre (19:30–20:00) es el más comprimible si hay preguntas del profesor durante la exposición.

---

## [0:00–1:30] Apertura y problema — Presentador 1

Buenos días/tardes. Vamos a presentarles **Chocao**, una plataforma B2G de subastas oficiales de vehículos aprehendidos, desarrollada para un escenario tipo Gobierno de Panamá.

El problema que resuelve es concreto: cuando el Estado retiene vehículos —por decomiso, abandono o proceso legal— necesita un mecanismo transparente y auditable para rematarlos al público. Hacerlo con procesos manuales (listas en papel, subastas presenciales, pagos en efectivo) genera opacidad, riesgo de corrupción y cero trazabilidad de quién pujó qué y cuándo. Chocao digitaliza todo ese flujo: un ciudadano se registra, ve el catálogo de vehículos retenidos, puja en línea, paga digitalmente si gana, y cada paso queda registrado. Del lado del Estado, hay un panel administrativo para publicar vehículos, monitorear pujas en tiempo real y generar reportes de recaudación.

No es un MVP simple: partimos de un catálogo funcional y, en una segunda fase, lo llevamos a un nivel "production-ready" — seguridad, concurrencia, observabilidad — que es de lo que vamos a hablar hoy.

## [1:30–4:00] Funcionalidades — lado ciudadano — Presentador 1

Del lado del ciudadano, el flujo empieza con **registro y login sin contraseña**: usamos Clerk como proveedor de identidad, y ofrecemos tanto código OTP por email como el método tradicional. Implementamos el flujo OTP de forma "headless" en dos pasos —pedir el código, confirmarlo— en vez de usar el widget prefabricado, para controlar el diseño.

Una vez dentro, el ciudadano ve el **catálogo público de vehículos**, con filtros por estado, marca, año, kilometraje, transmisión, carrocería y rango de precio, más búsqueda de texto. Cada vehículo tiene una página de detalle con galería de imágenes, especificaciones técnicas y una **cuenta regresiva en vivo** —días, horas, minutos, segundos— hasta el cierre de la subasta.

Para pujar, el formulario sugiere automáticamente montos de +5%, +10% y +20% sobre el precio actual, y valida en el backend que la oferta supere el precio vigente y que la subasta siga activa. El ciudadano tiene una sección "Mis subastas" con sus pujas activas y ganadas, una lista de seguimiento (watchlist), y actualizaciones en tiempo real vía Server-Sent Events cuando alguien más puja sobre el mismo vehículo.

Cuando gana, paga con **Stripe Checkout** en modo test, y el vehículo pasa a su sección "Mis compras". Y en la fase de cumplimiento normativo agregamos algo que no estaba en el MVP original: un proceso de **acreditación previa** —el postor debe estar acreditado y dejar un depósito antes de poder pujar— y, tras ganar, un **proceso de entrega** con checklist, validación cruzada de VIN y un acta, donde interviene un rol de custodio.

## [4:00–6:00] Funcionalidades — lado administrador — Presentador 2

Del lado administrativo tenemos un dashboard con KPIs en tiempo real: vehículos, pujas, usuarios registrados y recaudación total. El CRUD de vehículos soporta drag & drop de hasta seis imágenes, y el cambio de estado se hace inline desde la misma tabla, siguiendo una máquina de estados: `draft → published → active → closed → awarded`. Al cerrar una subasta, la adjudicación es automática: la puja más alta pasa a "ganadora" y el resto queda "outbid", sin intervención manual.

También hay una vista de todas las pujas del sistema y reportes con distribución por estado y exportación a CSV, además de búsqueda y filtros sobre el inventario administrativo. Y, ya en la parte de cumplimiento, el admin gestiona reembolsos —con reversión coherente del estado: pago reembolsado, vehículo vuelve a estar disponible para readjudicar— y supervisa el proceso de entrega y custodia.

Todo esto está protegido por un sistema de permisos granular, no solo "admin sí / admin no" — de eso hablamos en el bloque de seguridad.

## [6:00–8:30] Arquitectura — Presentador 2

Arquitectónicamente, Chocao es una SPA de React que habla con una API REST stateless por HTTPS. El navegador nunca guarda sesión en el backend: cada request lleva un JWT de Clerk en el header `Authorization: Bearer`, inyectado por un interceptor de Axios.

En el backend, sobre Hono, el request pasa por una cadena de middlewares: CORS con lista blanca explícita, cabeceras de seguridad, verificación del JWT, logging estructurado con un request-id que se propaga en cada log de esa petición. De ahí entra a los routers por dominio —usuarios, vehículos, pujas, pagos, dashboard— que a su vez delegan en una **capa de servicios** (`services/bids.ts`, `services/payments.ts`, `services/vehicles.ts`, etc.) donde vive toda la lógica de negocio, desacoplada del transporte HTTP. Esa capa habla con MongoDB vía Mongoose, y con dos integraciones externas: Clerk para verificar identidad, y Stripe —como singleton reutilizado en todas las peticiones— para pagos.

Dos patrones vale la pena resaltar. Primero, el manejo de la **concurrencia en pujas**: usamos optimistic locking, un `findOneAndUpdate` condicional que solo reclama el precio si en ese instante exacto sigue siendo válido; si dos personas pujan al mismo tiempo, una gana el "claim" atómico y la otra recibe un 409 con el precio ya actualizado. Segundo, el cierre de subastas corre como un job en background —un intervalo de 60 segundos— que reclama vehículos vencidos de forma atómica, así que es seguro incluso si corriera en paralelo desde varias instancias.

## [8:30–10:30] Stack tecnológico — Presentador 3

En el backend usamos **Bun** como runtime de JavaScript/TypeScript en lugar de Node —nos da instalación, test runner y watch mode integrados—, con **Hono** como framework HTTP minimalista pensado para edge. La persistencia es **MongoDB** vía **Mongoose** como ODM tipado. La autenticación de usuarios la resuelve **Clerk** en el backend con verificación de JWT, y los pagos, el **SDK oficial de Stripe**. Para validación de entrada usamos **Zod** en cada endpoint, y **jose** para firmar los JWT propios de nuestra capa OAuth.

En el frontend: **React 19** con **Vite** como bundler y dev server con hot reload, **TypeScript**, **React Router** para el enrutado con layouts anidados, **Axios** para las llamadas HTTP, **lucide-react** para iconografía consistente —nada de emojis como íconos de UI—, **Recharts** para las gráficas de reportes, y **@microsoft/fetch-event-source** para consumir el stream de Server-Sent Events del realtime.

Para testing: **Bun test** en el backend, con **mongodb-memory-server** corriendo en modo replSet para que la concurrencia se comporte igual que en producción, y **Playwright** para los end-to-end del frontend. Y todo el pipeline de CI corre en **GitHub Actions**.

## [10:30–12:00] Estructura del proyecto — Presentador 1

El repo se divide en `backend/` y `frontend/`, cada uno con su propio `package.json` y su propio pipeline de CI.

En el backend, `src/` se organiza por responsabilidad: `lib/` para infraestructura transversal —conexión a Mongo, cliente de Stripe, logger, manejo de errores, permisos—, `middlewares/` para auth, CORS, rate limiting y logging, `models/` con los esquemas Mongoose, `schemas/` con la validación Zod por dominio, `routes/` con los endpoints HTTP, y `services/` con la lógica de negocio pura que routers y, como veremos, herramientas MCP, reutilizan sin duplicar reglas. Además hay `oauth/` y `mcp/`, que son la capa que expone el backend a agentes de IA.

En el frontend, `src/` separa `layouts/` públicos y de admin, `pages/`, `components/` reutilizables —tenemos alrededor de 21, como `DataTable`, `Countdown`, `BidForm`, `ImageDropzone`—, `hooks/` para el cliente HTTP autenticado, y `lib/` para la instancia pública de Axios. El diseño sigue un sistema de tokens en CSS variables —neumorfismo institucional sobre una paleta azul y dorado— definido una sola vez en `index.css` y reutilizado en todos los componentes.

## [12:00–14:00] Seguridad y robustez production-ready — Presentador 2

Esta es la parte que más trabajo llevó después del MVP. Migramos de un modelo simple "admin sí / admin no" a **RBAC de grano fino**: un catálogo de permisos concretos —`bids:write`, `payment:refund`, `vehicle:write`, `users:manage`, `audit:read`, entre otros— asignados por rol, y cada endpoint exige el permiso puntual que necesita, no un rol genérico.

Agregamos **ownership checks** —un usuario no puede ver ni pagar recursos de otro, y si lo intenta recibe un 403, nunca un 404 con datos filtrados—, **auditoría inmutable**: un log que registra actor, acción, recurso y estado antes/después, y que a nivel de esquema bloquea cualquier update o delete sobre sí mismo, solo puede crecer. También **rate limiting** configurable por endpoint, con un límite más estricto en checkout para frenar abuso, y **health checks** —liveness, readiness con ping real a MongoDB, y métricas en formato Prometheus— pensados para despliegue en producción.

En pagos, el webhook de Stripe es la fuente primaria de confirmación —no polling desde el frontend—, validado por firma criptográfica sobre el cuerpo crudo, con idempotencia real: un reintento de red o un webhook duplicado no puede cobrar ni adjudicar dos veces. Y todo esto se apoya en migraciones de base de datos versionadas y un seed reproducible e idempotente para levantar el ambiente de demo o de tests siempre en el mismo estado conocido.

## [14:00–15:30] Capa MCP — el diferenciador — Presentador 3

Algo que no es común en un proyecto universitario: Chocao expone un **servidor MCP** —Model Context Protocol—, el estándar que permite que un agente de IA, como Claude Code, interactúe directamente con la aplicación como si fuera un cliente más.

Implementamos nuestro propio Authorization Server **OAuth 2.1 con PKCE obligatorio**, con descubrimiento automático —el agente se autoregistra y se autoconfigura sin intervención humana, siguiendo los RFCs correspondientes—. Los scopes que un cliente MCP puede usar se intersectan con el rol real del usuario, así que un agente nunca puede hacer más de lo que su usuario podría hacer por la web. Expusimos herramientas de solo lectura, como buscar vehículos o consultar el historial de pujas, y herramientas de escritura, como pujar o generar un link de pago, estas últimas marcadas para exigir confirmación explícita antes de comprometer una acción. Y como gobernanza transversal: rate limiting por token, auditoría de cada invocación con los campos sensibles enmascarados, y revocación inmediata de clientes comprometidos.

En la práctica, esto significa que un asistente de IA puede pujar, consultar reportes o publicar un vehículo en nuestro nombre, respetando exactamente las mismas reglas de negocio y permisos que ya construimos para la API REST.

## [15:30–17:30] Manejo de tickets en GitHub — Presentador 1

Trabajamos con **GitHub Issues como Historias de Usuario**: cada HU es un issue numerado —hoy tenemos más de 60 HU del backlog "core" más un bloque adicional de mejoras de UX que llamamos HU-A1 a HU-A11—. Cada issue lleva etiquetas de dos tipos: **estado** —`estado:backlog`, `estado:implementado`— y **área** —`area:seguridad`, `area:observabilidad`, `area:calidad-ci`, `area:mcp`, `area:ux-a11y`, entre otras—, lo que nos permite filtrar el tablero por dominio técnico o ver de un vistazo qué queda pendiente en cada frente.

El flujo de trabajo es: un issue por HU, una rama `feat/hu-XX-slug` o `fix/slug` por issue, y un Pull Request que cierra ese issue explícitamente con `Closes #N`. Cuando varias HU tocan las mismas rutas, apilamos PRs —cada rama nace de la anterior de la cadena en vez de partir siempre de `main`—, lo cual, como verán en el siguiente bloque, nos enseñó una lección importante sobre CI. Los issues que siguen abiertos hoy —cosas como internacionalización, accesibilidad WCAG, notificaciones por correo o respaldos automáticos— están conscientemente etiquetados `estado:backlog`: son mejoras identificadas y priorizadas, no deuda oculta.

## [17:30–19:30] QA, CI y pruebas — Presentador 2

En pruebas automatizadas tenemos dos capas. En el backend, tests unitarios y de integración con Bun, contra una instancia de MongoDB en memoria corriendo en modo replSet —para que el comportamiento de las operaciones atómicas sea idéntico al de producción—, con mocks de Stripe y de Clerk cargados de forma determinista. En el frontend, una suite de Playwright que corre end-to-end contra un backend dedicado de pruebas —con su propio puerto, su propio seed fijo y autenticación simulada—, deliberadamente en serie y no en paralelo, porque todos los specs comparten el mismo estado y paralelizarlos mezclaría pujas entre tests.

El pipeline de CI en GitHub Actions tiene dos jobs paralelos: **backend** —type-check con `tsc`, tests con cobertura, auditoría de dependencias— y **frontend** —lint, build, auditoría de dependencias—. Y corre tanto en push a `main` como en *todo* pull request, sin filtrar por rama base, precisamente por la estrategia de PRs apilados que mencionamos.

Y aquí va lo más honesto de nuestro proceso de QA: hicimos una auditoría posterior de las más de 40 PRs de esta fase y encontramos **cinco bugs reales que habían estado fallando en CI en silencio** — desde una condición de carrera real en la reconciliación de pujas que solo se manifestaba con el timing exacto de GitHub Actions, hasta un umbral de cobertura mal configurado y un problema de configuración que hacía que CI nunca corriera en la mayoría de las ramas apiladas. Los corregimos todos, pero la lección que nos llevamos —y que aplicamos desde entonces— es correr `gh pr checks` después de cada PR, no solo confiar en que "el código compila localmente".

## [19:30–20:00] Cierre — Presentador 3

En resumen: Chocao no es solo un catálogo con pujas — es un sistema con concurrencia real, seguridad por capas, observabilidad, cumplimiento normativo, y una capa experimental que lo abre a agentes de IA vía MCP, todo trazado issue por issue en GitHub y validado por un pipeline de CI que nosotros mismos pusimos a prueba. Quedamos abiertos a preguntas.
