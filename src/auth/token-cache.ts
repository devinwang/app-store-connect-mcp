/**
 * In-memory JWT cache. Never persists anything to disk.
 * Invalidated on account switch / update / remove.
 */

import { signAscJwt, type SignedJwt } from "./jwt.js";
import type { Account } from "./account-store.js";

const SAFETY_MARGIN_SECONDS = 60;

interface CacheEntry {
  account: Account;
  signed: SignedJwt;
}

let cache: CacheEntry | null = null;

export function getToken(account: Account): string {
  const now = Math.floor(Date.now() / 1000);

  // Cache-hit: same account, still fresh, not close to expiry.
  if (
    cache &&
    cache.account.name === account.name &&
    cache.account.keyId === account.keyId &&
    cache.account.issuerId === account.issuerId &&
    cache.account.keyFile === account.keyFile &&
    cache.signed.expiresAt - now > SAFETY_MARGIN_SECONDS
  ) {
    return cache.signed.token;
  }

  const signed = signAscJwt(account);
  cache = { account, signed };
  return signed.token;
}

export function invalidate(): void {
  cache = null;
}

export function cacheStatus(): {
  cached: boolean;
  expiresAt: number | null;
  accountName: string | null;
} {
  if (!cache) return { cached: false, expiresAt: null, accountName: null };
  return {
    cached: true,
    expiresAt: cache.signed.expiresAt,
    accountName: cache.account.name,
  };
}
