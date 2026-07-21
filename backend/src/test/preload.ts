// Preload de bun test (ver bunfig.toml): registra los mocks de Clerk y
// Stripe ANTES de que se cargue cualquier archivo de test, garantizando que
// mock.module intercepte los módulos sin depender del orden de imports.
import "./mocks/clerk";
import "./mocks/stripe";
