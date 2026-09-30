"use client";

/* E2E encryption for 1:1 DMs — ECDH P-256 + AES-256-GCM via WebCrypto.
 *
 * - Identity: one ECDH keypair per user, generated once in the browser.
 *   Private JWK stays in localStorage (`tf_dm_priv:<userId>`); public JWK is
 *   published to the server (`PUT /v1/dm/keys`) so peers can derive the secret.
 * - Shared secret: ECDH(priv_self, pub_peer) → AES-GCM-256 key. Both sides
 *   derive the SAME key (Diffie-Hellman symmetry) without any key transport,
 *   and the server never sees either private half — it cannot decrypt.
 * - Messages: random 12-byte IV per message, AES-GCM encrypt UTF-8 plaintext,
 *   base64 the output. Server stores `{ ciphertext, iv }` only.
 */

export interface DmPublicJwk extends JsonWebKey {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}

const PRIV_PREFIX = "tf_dm_priv:";

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] as number);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function privKeyName(userId: string): string {
  return `${PRIV_PREFIX}${userId}`;
}

async function importPrivate(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
}

async function importPeerPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/** Load my private key, or generate + return `{ privateKey, publicJwk, isNew }`. */
export async function getOrCreateIdentity(
  userId: string,
): Promise<{ privateKey: CryptoKey; publicJwk: DmPublicJwk; isNew: boolean }> {
  const stored = (() => {
    try {
      return window.localStorage.getItem(privKeyName(userId));
    } catch {
      return null;
    }
  })();
  if (stored) {
    try {
      const jwk = JSON.parse(stored) as JsonWebKey;
      const privateKey = await importPrivate(jwk);
      const pub = await crypto.subtle.exportKey("jwk", privateKey).catch?.(() => null);
      void pub;
      // Derive the public half by re-exporting via a fresh public import is not
      // possible from a private-only CryptoKey in all browsers, so store the
      // public JWK alongside on creation (see below) — fall back to regenerate.
      const pubStored = (() => {
        try {
          return window.localStorage.getItem(`${privKeyName(userId)}:pub`);
        } catch {
          return null;
        }
      })();
      if (pubStored) {
        return { privateKey, publicJwk: JSON.parse(pubStored) as DmPublicJwk, isNew: false };
      }
    } catch {
      // corrupted — fall through and regenerate
    }
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const pubJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as DmPublicJwk;
  try {
    window.localStorage.setItem(privKeyName(userId), JSON.stringify(privJwk));
    window.localStorage.setItem(`${privKeyName(userId)}:pub`, JSON.stringify(pubJwk));
  } catch {
    // storage unavailable (private mode) — keys live for the session only
  }
  const privateKey = await importPrivate(privJwk);
  return { privateKey, publicJwk: pubJwk, isNew: true };
}

/** Derive the shared AES-GCM key for (myPriv, peerPub). Deterministic per pair. */
export async function deriveSharedKey(myPriv: CryptoKey, peerPublicJwk: JsonWebKey): Promise<CryptoKey> {
  const peerPub = await importPeerPublic(peerPublicJwk);
  return crypto.subtle.deriveKey({ name: "ECDH", public: peerPub }, myPriv, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptDm(sharedKey: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, data);
  return { ciphertext: bufToB64(ct), iv: bufToB64(iv) };
}

export async function decryptDm(sharedKey: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBuf(iv) }, sharedKey, b64ToBuf(ciphertext));
  return new TextDecoder().decode(pt);
}

/** Fingerprint shown in the UI so users can verify they're talking to the right
 * person out-of-band (compare over a call). SHA-256 of the canonical pair. */
export async function dmFingerprint(myPub: JsonWebKey, peerPub: JsonWebKey): Promise<string> {
  const canon = (j: JsonWebKey) => `P-256.${j.x}.${j.y}`;
  const pair = [canon(myPub), canon(peerPub)].sort().join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair));
  const b64 = bufToB64(digest).replace(/=+$/, "");
  // 8 groups of 4 for readability: "aB3d eF7h …"
  return (b64.slice(0, 32).match(/.{1,4}/g) ?? []).join(" ");
}
