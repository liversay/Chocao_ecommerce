import type { Page } from "@playwright/test";

// Usuarios del seed determinístico de backend/scripts/e2e-server.ts
export const E2E_USERS = {
  admin: { clerkId: "e2e_admin", name: "Admin E2E", email: "admin@e2e.test" },
  ana: { clerkId: "e2e_ana", name: "Ana E2E", email: "ana@e2e.test" },
  bruno: { clerkId: "e2e_bruno", name: "Bruno E2E", email: "bruno@e2e.test" },
} as const;

export type E2EUserKey = keyof typeof E2E_USERS;

// "Inicia sesión" escribiendo la sesión del stub de Clerk (clerkStub.tsx)
// en localStorage ANTES de cargar la app. El backend E2E acepta el token
// "e2e:<clerkId>" que el stub emite.
export async function loginAs(page: Page, who: E2EUserKey) {
  const user = E2E_USERS[who];
  await page.addInitScript((value) => {
    window.localStorage.setItem("e2e_user", value);
  }, JSON.stringify(user));
}
