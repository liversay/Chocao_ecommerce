/**
 * Stub de @clerk/react para el modo E2E (Playwright).
 *
 * Se activa SOLO vía alias en vite.config.ts cuando VITE_E2E=1 — el bundle
 * normal nunca incluye este archivo. La "sesión" vive en localStorage
 * (clave e2e_user: {clerkId, name, email}); los tests la escriben con
 * addInitScript antes de navegar y el backend (en modo E2E) acepta el
 * token "e2e:<clerkId>" que emite getToken().
 */
import React from "react";

interface E2EUser {
  clerkId: string;
  name: string;
  email: string;
}

function readUser(): E2EUser | null {
  try {
    const raw = window.localStorage.getItem("e2e_user");
    return raw ? (JSON.parse(raw) as E2EUser) : null;
  } catch {
    return null;
  }
}

export function ClerkProvider({ children }: { children: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}

export function useAuth() {
  const user = readUser();
  return {
    isLoaded: true,
    isSignedIn: !!user,
    getToken: async () => (user ? `e2e:${user.clerkId}` : null),
  };
}

export function useUser() {
  const stored = readUser();
  const [firstName, ...rest] = (stored?.name ?? "").split(" ");
  return {
    isLoaded: true,
    isSignedIn: !!stored,
    user: stored
      ? {
          id: stored.clerkId,
          firstName: firstName || stored.name,
          lastName: rest.join(" ") || null,
          emailAddresses: [{ emailAddress: stored.email }],
        }
      : null,
  };
}

export function useClerk() {
  return {
    signOut: async (cb?: () => void) => {
      window.localStorage.removeItem("e2e_user");
      if (cb) cb();
      else window.location.assign("/");
    },
    setActive: async () => {},
    client: {
      signIn: {
        create: async () => {
          throw new Error("login real no disponible en modo E2E");
        },
      },
      signUp: {
        create: async () => {
          throw new Error("registro real no disponible en modo E2E");
        },
      },
    },
  };
}

export function SignIn() {
  return <div data-testid="e2e-signin-stub">Login deshabilitado en modo E2E</div>;
}

export function SignUp() {
  return <div data-testid="e2e-signup-stub">Registro deshabilitado en modo E2E</div>;
}
