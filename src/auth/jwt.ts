/**
 * JWT signing for App Store Connect.
 *
 * ASC requires an ES256 JWT with:
 *   header  { alg: "ES256", kid: <keyId>, typ: "JWT" }
 *   payload { iss: <issuerId>, iat: now, exp: now+1200, aud: "appstoreconnect-v1", [scope?] }
 *   signed with the private key from the `.p8` file.
 *
 * Lifetime: ASC accepts tokens up to 20 minutes (1200 s) old. We sign
 * for 20 min and refresh with a 60 s safety margin.
 *
 * Security:
 *   - The `.p8` content is read fresh from disk each time we sign.
 *   - The buffer holding the key is dereferenced immediately after signing.
 *     (JavaScript can't hard-zero memory, but dropping the reference is
 *     what we have; the real defense is never cloning or logging it.)
 *   - We never log, echo, or return the token or key material.
 */

import fs from "node:fs";
import jwt from "jsonwebtoken";
import type { Account } from "./account-store.js";

const ASC_AUDIENCE = "appstoreconnect-v1";
const LIFETIME_SECONDS = 1200; // 20 minutes, ASC maximum

export interface SignedJwt {
  token: string;
  issuedAt: number; // epoch seconds
  expiresAt: number; // epoch seconds
}

export function signAscJwt(account: Account): SignedJwt {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + LIFETIME_SECONDS;

  // Read on demand; no in-process cache.
  let keyBuffer: Buffer | null = fs.readFileSync(account.keyFile);
  try {
    const payload: Record<string, unknown> = {
      iss: account.issuerId,
      iat: now,
      exp,
      aud: ASC_AUDIENCE,
    };
    if (account.scope && account.scope.length > 0) {
      payload.scope = account.scope;
    }

    const token = jwt.sign(payload, keyBuffer, {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: account.keyId,
        typ: "JWT",
      },
    });

    return { token, issuedAt: now, expiresAt: exp };
  } finally {
    // Best-effort dereference. `jsonwebtoken` internally reads the buffer
    // synchronously, so by the time we reach this `finally` the signing
    // operation is done and the key is no longer needed.
    if (keyBuffer) {
      keyBuffer.fill(0);
      keyBuffer = null;
    }
  }
}
