/**
 * Redact strings that look like secrets before they reach MCP output or
 * error messages. Defense-in-depth — code paths SHOULD NOT pass keys or
 * JWTs around, but a single accidental `console.log` or stack trace
 * containing the Authorization header could otherwise leak.
 *
 * Patterns covered:
 *   - JWTs               eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}
 *   - PEM blocks         -----BEGIN …-----…-----END …-----
 *   - Bearer tokens      \bBearer\s+[A-Za-z0-9._-]{20,}
 *
 * NOTE: a generic `\b[a-f0-9]{40,}\b` "long hex" catch-all was REMOVED in
 * 0.2.0. It produced collateral damage with no security benefit: it matched
 * the `X-Amz-Signature` in the pre-signed S3 `uploadOperations[].url` that
 * every asset `create` call returns, rewriting it to `[REDACTED HEX]`. Because
 * the companion `asset_upload_file` tool PUTs to that exact URL, the round-trip
 * through MCP output corrupted the signature and broke ALL asset uploads
 * (screenshots, previews, review attachments, etc.) with a 403. The S3 upload
 * signature is a short-lived, single-asset, write-only token — not a credential
 * worth redacting. The actual secrets (the ASC JWT and the `.p8`) are covered
 * by the JWT / PEM / Bearer patterns here plus the field-name rules in
 * `redactDeep`, and they never appear in API response bodies anyway. See also
 * `asset_upload_file`, which now fetches `uploadOperations` server-side so the
 * signature never transits model context regardless of redaction.
 */

const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const PEM_RE =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g;

/**
 * Redact a string. Non-strings are stringified then redacted.
 */
export function redact(input: unknown): string {
  const s = typeof input === "string" ? input : String(input);
  return s
    .replace(PEM_RE, "[REDACTED PRIVATE KEY]")
    .replace(JWT_RE, "[REDACTED JWT]")
    .replace(BEARER_RE, "Bearer [REDACTED]");
}

/**
 * Redact every string value in an object (for safe logging of
 * request/response bodies that may contain embedded tokens).
 */
export function redactDeep<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") return redact(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Never echo back any field whose NAME implies a secret, regardless
      // of its current value (defense against future-added fields).
      if (
        /(?:^|[_-])(?:authorization|apikey|api[_-]?key|secret|private[_-]?key|password|token)(?:$|[_-])/i.test(
          k,
        )
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}
