/** Google Sign-In verification (Google Identity Services ID tokens).
 *
 * The frontend obtains an ID token via GIS (`google.accounts.id`) and posts it
 * to `POST /v1/auth/google`. We verify the JWT signature against Google's JWKS
 * (jose remote key set — already a dependency), pin the issuer, and require
 * `aud` to be one of our configured GOOGLE_CLIENT_IDs. Account linking is by
 * verified email: Google guarantees the address, so a matching local account
 * is signed in and a new address auto-provisions (user + personal org).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config.js";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super("GOOGLE_NOT_CONFIGURED");
  }
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientIds = config().googleClientIds;
  if (clientIds.length === 0) throw new GoogleNotConfiguredError();
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: clientIds,
  });
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  const emailVerified = payload.email_verified === true;
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const name =
    typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 80) : "";
  if (!sub || !email || !emailVerified) throw new Error("Google token missing verified email");
  return { sub, email, emailVerified, name };
}
