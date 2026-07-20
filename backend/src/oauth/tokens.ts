import { SignJWT, jwtVerify } from "jose";
import { logger } from "../lib/logger";

// Firma HS256: el emisor y el consumidor del token son el mismo backend
// (Authorization Server y Resource Server conviven en la app de Chocao).
let cachedSecret: Uint8Array | null = null;

function secret(): Uint8Array {
  if (!cachedSecret) {
    const raw = process.env.OAUTH_JWT_SECRET;
    if (!raw) {
      // En dev se genera uno efímero (los tokens mueren con el proceso);
      // en producción OAUTH_JWT_SECRET es obligatorio.
      logger.warn("OAUTH_JWT_SECRET no está definido; usando secreto efímero de desarrollo");
      cachedSecret = crypto.getRandomValues(new Uint8Array(32));
    } else {
      cachedSecret = new TextEncoder().encode(raw);
    }
  }
  return cachedSecret;
}

export function issuer(): string {
  return process.env.OAUTH_ISSUER || `http://localhost:${process.env.PORT || "3000"}`;
}

export interface AccessTokenClaims {
  sub: string;
  scope: string;
  client_id: string;
  jti: string;
}

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hora

export async function signAccessToken(claims: Omit<AccessTokenClaims, "jti">): Promise<{
  token: string;
  jti: string;
  expiresIn: number;
}> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ scope: claims.scope, client_id: claims.client_id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer())
    .setAudience(`${issuer()}/mcp`)
    .setSubject(claims.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret());
  return { token, jti, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: issuer(),
      audience: `${issuer()}/mcp`,
    });
    if (!payload.sub || typeof payload.scope !== "string" || !payload.jti) return null;
    return {
      sub: payload.sub,
      scope: payload.scope,
      client_id: String(payload.client_id ?? ""),
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}

// Solo para tests: fuerza a re-derivar el secreto tras cambiar la env.
export function __resetSecretForTests() {
  cachedSecret = null;
}
