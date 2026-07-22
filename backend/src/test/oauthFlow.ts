import { createHash, randomBytes } from "node:crypto";
import { expect } from "bun:test";
import type { Hono } from "hono";
import type { AppEnv } from "../types";
import type { UserDoc } from "../models/User";
import { authHeader } from "./factories";

const REDIRECT = "http://localhost:41234/callback";

// Ejecuta el flujo OAuth completo (register → approve → token) y devuelve el
// access token MCP del usuario. Requiere OAUTH_JWT_SECRET seteado en el test.
export async function obtainAccessToken(
  app: Hono<AppEnv>,
  user: UserDoc,
  scope?: string
): Promise<string> {
  const reg = await app.request("/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: [REDIRECT] }),
  });
  expect(reg.status).toBe(201);
  const { client_id } = (await reg.json()) as { client_id: string };

  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const approve = await app.request("/oauth/authorize/approve", {
    method: "POST",
    headers: authHeader(user),
    body: JSON.stringify({ client_id, redirect_uri: REDIRECT, scope, code_challenge: challenge }),
  });
  expect(approve.status).toBe(200);
  const { redirect } = (await approve.json()) as { redirect: string };
  const code = new URL(redirect).searchParams.get("code")!;

  const tokenRes = await app.request("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id,
      redirect_uri: REDIRECT,
    }),
  });
  expect(tokenRes.status).toBe(200);
  return ((await tokenRes.json()) as { access_token: string }).access_token;
}
