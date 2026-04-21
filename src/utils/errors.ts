/**
 * Translate App Store Connect API errors into readable MCP tool messages.
 *
 * ASC errors follow the JSON:API error shape:
 *   { "errors": [{ "id", "status", "code", "title", "detail", "source", "meta" }] }
 *
 * On top of that our `http.ts` throws an `AscHttpError` carrying the
 * HTTP status + parsed body. Anything else falls through to a generic
 * "unknown error" rendering.
 */

export class AscHttpError extends Error {
  status: number;
  body: unknown;
  requestId: string | undefined;
  method: string;
  url: string;

  constructor(init: {
    status: number;
    body: unknown;
    requestId?: string | undefined;
    method: string;
    url: string;
  }) {
    super(`ASC ${init.status} ${init.method} ${init.url}`);
    this.name = "AscHttpError";
    this.status = init.status;
    this.body = init.body;
    this.requestId = init.requestId;
    this.method = init.method;
    this.url = init.url;
  }
}

interface AscJsonApiError {
  id?: string;
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: { pointer?: string; parameter?: string };
}

function parseAscErrors(body: unknown): AscJsonApiError[] {
  if (!body || typeof body !== "object") return [];
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors as AscJsonApiError[];
}

function hint(status: number, errs: AscJsonApiError[]): string | undefined {
  if (status === 401) {
    return "401 UNAUTHENTICATED — the JWT was rejected. Typical causes: (a) the key was revoked in App Store Connect → Users and Access → Integrations, (b) the `keyId` / `issuerId` / `.p8` file don't match, (c) the JWT expired (max lifetime 20 min — we sign 20 min and refresh with a 60s safety margin), (d) your machine's clock is skewed by more than 5 min. Try `auth_revoke_cache` then `auth_status`.";
  }
  if (status === 403) {
    return "403 FORBIDDEN — the key is authenticated but not authorized. Check the key's access level in App Store Connect → Users and Access → Integrations. Admin-level keys see everything; restricted keys see only a subset of apps / endpoints.";
  }
  if (status === 404) {
    return "404 NOT_FOUND — the resource id may have been deleted, may belong to a different team, or the URL path is wrong.";
  }
  if (status === 409) {
    return "409 CONFLICT — the resource state prevents this change, or a concurrent modification raced you. Re-fetch and retry.";
  }
  if (status === 422) {
    // ASC often returns validation errors here with a helpful `source.pointer`.
    const pointers = errs
      .map((e) => e.source?.pointer)
      .filter(Boolean)
      .join(", ");
    return pointers
      ? `422 UNPROCESSABLE_ENTITY — validation failed at: ${pointers}`
      : "422 UNPROCESSABLE_ENTITY — request body failed validation. Check required fields, enum values, and relationship ids.";
  }
  if (status === 429) {
    return "429 TOO_MANY_REQUESTS — ASC throttled. The per-team quota is ~3500 req/hour. Back off and retry.";
  }
  if (status >= 500) {
    return "Apple-side failure. Retry with exponential backoff; if it persists, check https://developer.apple.com/system-status/.";
  }
  return undefined;
}

export function formatError(err: unknown): string {
  if (!err) return "Unknown error";

  if (err instanceof AscHttpError) {
    const errs = parseAscErrors(err.body);
    const parts: string[] = [`HTTP ${err.status} ${err.method} ${err.url}`];
    if (err.requestId) parts.push(`request-id: ${err.requestId}`);
    for (const e of errs) {
      const tag = [e.code, e.title].filter(Boolean).join(" / ");
      const msg = e.detail ?? "";
      parts.push(tag ? `${tag}${msg ? ` — ${msg}` : ""}` : msg);
    }
    const h = hint(err.status, errs);
    if (h) parts.push("", `Hint: ${h}`);
    return parts.filter(Boolean).join("\n");
  }

  const e = err as { message?: string; stack?: string };
  return e.message ?? (typeof err === "string" ? err : JSON.stringify(err));
}
