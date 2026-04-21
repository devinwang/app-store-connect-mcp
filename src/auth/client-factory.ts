/**
 * Produces the Authorization header for outgoing ASC API calls.
 *
 * Resolution order:
 *   1. An account registered via `accounts_add` (preferred).
 *   2. Fallback: env vars `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_PATH`.
 *      Only for compatibility with `zelentsov-dev/asc-mcp`. Emits a
 *      one-time stderr warning.
 */

import fs from "node:fs";
import { getCurrentAccount, type Account } from "./account-store.js";
import { getToken } from "./token-cache.js";

let envWarned = false;

function envAccount(): Account | null {
  const keyId = process.env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyFile = process.env.ASC_PRIVATE_KEY_PATH;
  if (!keyId || !issuerId || !keyFile) return null;
  if (!fs.existsSync(keyFile)) {
    throw new Error(
      `ASC_PRIVATE_KEY_PATH points to a missing file: ${keyFile}`,
    );
  }
  if (!envWarned) {
    process.stderr.write(
      "[app-store-connect-mcp] Using env-var credentials (ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY_PATH). Consider migrating to `accounts_add` for multi-account support.\n",
    );
    envWarned = true;
  }
  return {
    name: "__env__",
    keyId,
    issuerId,
    keyFile,
  };
}

export function resolveAccount(): Account {
  const registered = getCurrentAccount();
  if (registered) {
    if (!fs.existsSync(registered.keyFile)) {
      throw new Error(
        `Private key file for account '${registered.name}' is missing: ${registered.keyFile}. Update with \`accounts_update\`.`,
      );
    }
    return registered;
  }
  const env = envAccount();
  if (env) return env;
  throw new Error(
    "No App Store Connect credentials. Register a key with `accounts_add` or set env vars ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY_PATH.",
  );
}

export async function authorizationHeader(): Promise<string> {
  const account = resolveAccount();
  const token = getToken(account);
  return `Bearer ${token}`;
}

/**
 * Read-only snapshot for `auth_status`. Never returns the JWT or
 * key material — only the identifiers and boolean readiness.
 */
export async function authStatus(): Promise<{
  source: "accounts" | "env";
  keyId: string;
  issuerId: string;
  keyFileExists: boolean;
  tokenAcquired: boolean;
  expiresAt: number | null;
  error?: string;
}> {
  const registered = getCurrentAccount();
  const account = registered ?? envAccount();
  if (!account) {
    return {
      source: "accounts",
      keyId: "",
      issuerId: "",
      keyFileExists: false,
      tokenAcquired: false,
      expiresAt: null,
      error: "No credentials configured",
    };
  }
  const source: "accounts" | "env" = registered ? "accounts" : "env";
  const keyFileExists = fs.existsSync(account.keyFile);
  if (!keyFileExists) {
    return {
      source,
      keyId: account.keyId,
      issuerId: account.issuerId,
      keyFileExists: false,
      tokenAcquired: false,
      expiresAt: null,
      error: `Key file missing: ${account.keyFile}`,
    };
  }
  try {
    // Trigger a sign (or cache hit) to prove the key decodes + signs.
    getToken(account);
    // Re-read cache status AFTER we forced a token.
    const { cacheStatus } = await import("./token-cache.js");
    const st = cacheStatus();
    return {
      source,
      keyId: account.keyId,
      issuerId: account.issuerId,
      keyFileExists: true,
      tokenAcquired: st.cached,
      expiresAt: st.expiresAt,
    };
  } catch (err) {
    return {
      source,
      keyId: account.keyId,
      issuerId: account.issuerId,
      keyFileExists: true,
      tokenAcquired: false,
      expiresAt: null,
      error: (err as Error).message,
    };
  }
}
