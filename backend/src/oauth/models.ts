import mongoose, { type HydratedDocument, Types } from "mongoose";

// Clientes OAuth registrados por Dynamic Client Registration (RFC 7591).
// Son clientes públicos (PKCE obligatorio, sin client_secret).
export interface IOAuthClient {
  clientId: string;
  clientName?: string;
  redirectUris: string[];
  revoked: boolean;
  createdAt: Date;
}

export type OAuthClientDoc = HydratedDocument<IOAuthClient>;

const oauthClientSchema = new mongoose.Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true },
    clientName: { type: String },
    redirectUris: { type: [String], required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const OAuthClient = mongoose.model<IOAuthClient>("OAuthClient", oauthClientSchema);

// Códigos de autorización de un solo uso (PKCE S256), con TTL corto.
export interface IOAuthCode {
  code: string;
  clientId: string;
  userId: Types.ObjectId;
  scope: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: Date;
}

const oauthCodeSchema = new mongoose.Schema<IOAuthCode>({
  code: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  scope: { type: String, required: true },
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
oauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthCode = mongoose.model<IOAuthCode>("OAuthCode", oauthCodeSchema);

// Refresh tokens rotativos: cada uso emite uno nuevo y revoca el anterior.
export interface IRefreshToken {
  token: string;
  clientId: string;
  userId: Types.ObjectId;
  scope: string;
  revoked: boolean;
  expiresAt: Date;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>({
  token: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  scope: { type: String, required: true },
  revoked: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
});
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>("RefreshToken", refreshTokenSchema);
