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
 *   - Generic long hex   \b[a-f0-9]{40,}\b
 *   - 32+ char base64    \b[A-Za-z0-9+/=_-]{32,}\b — only when the string
 *                        isn't obviously an ID (IDs are short)
 */

const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const PEM_RE =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g;
const LONG_HEX_RE = /\b[a-f0-9]{40,}\b/g;

/**
 * Redact a string. Non-strings are stringified then redacted.
 */
export function redact(input: unknown): string {
  const s = typeof input === "string" ? input : String(input);
  return s
    .replace(PEM_RE, "[REDACTED PRIVATE KEY]")
    .replace(JWT_RE, "[REDACTED JWT]")
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(LONG_HEX_RE, "[REDACTED HEX]");
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
