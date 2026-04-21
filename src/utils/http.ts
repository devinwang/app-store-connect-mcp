/**
 * Single HTTP client for all App Store Connect API calls.
 *
 *  - Uses `undici` for performance and native fetch semantics.
 *  - Acquires a signed JWT via `client-factory.ts` just-in-time.
 *  - Surfaces ASC errors as `AscHttpError` with the full JSON:API payload.
 *  - Retries transient 429 / 502 / 503 / 504 with exponential backoff.
 *  - Never logs credentials. If a redacted body dump is needed,
 *    call `redactDeep()` before emitting.
 */

import { request as undiciRequest, type Dispatcher } from "undici";
import { authorizationHeader } from "../auth/client-factory.js";
import { AscHttpError } from "./errors.js";

const BASE_URL = "https://api.appstoreconnect.apple.com";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const RETRYABLE = new Set([429, 502, 503, 504]);

export interface AscRequestInit {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "HEAD";
  path: string; // e.g. "/v1/apps/{id}" — templated
  pathParams?: Record<string, string | number>;
  query?: Record<string, unknown> | undefined;
  body?: unknown;
  headers?: Record<string, string>;
  accept?: string;
  /** If true, return raw bytes + headers instead of parsing JSON. */
  raw?: boolean;
  timeoutMs?: number;
}

export interface AscResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
  requestId: string | undefined;
}

/**
 * Substitute `{name}` path segments, URL-encode values.
 */
function substitutePath(
  path: string,
  params: Record<string, string | number> | undefined,
): string {
  if (!params) return path;
  return path.replace(/\{([^}]+)\}/g, (_match, name) => {
    const v = params[name];
    if (v === undefined || v === null) {
      throw new Error(`missing path parameter: ${name}`);
    }
    return encodeURIComponent(String(v));
  });
}

/**
 * Build a query string. ASC uses the JSON:API convention:
 *   - filters:      filter[app]=ID
 *   - fields:       fields[apps]=name,bundleId
 *   - includes:     include=builds
 *   - sorts:        sort=-createdDate
 *   - limits:       limit=200
 *   - cursors:      cursor=opaque
 *
 * We accept nested plain objects for `filter`, `fields`, `include`, `sort`,
 * `limit_relationships`, and pass primitives for everything else.
 */
function encodeQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v.join(","))}`);
    } else if (typeof v === "object") {
      // nested bag: { apps: "name,bundleId" } → fields[apps]=name,bundleId
      for (const [sub, sv] of Object.entries(v as Record<string, unknown>)) {
        if (sv === undefined || sv === null) continue;
        const value = Array.isArray(sv) ? sv.join(",") : String(sv);
        pairs.push(
          `${encodeURIComponent(k)}[${encodeURIComponent(sub)}]=${encodeURIComponent(value)}`,
        );
      }
    } else {
      pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return pairs.length ? `?${pairs.join("&")}` : "";
}

function backoffDelay(attempt: number, retryAfter?: string): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 30_000);
  }
  return Math.min(1000 * 2 ** attempt, 10_000);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBody(
  resBody: Dispatcher.ResponseData["body"],
  raw: boolean,
): Promise<unknown> {
  if (raw) return Buffer.from(await resBody.arrayBuffer());
  // JSON:API is always UTF-8 JSON unless we asked for something else.
  const text = await resBody.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function ascRequest<T = unknown>(
  init: AscRequestInit,
): Promise<AscResponse<T>> {
  const pathWithParams = substitutePath(init.path, init.pathParams);
  const url = `${BASE_URL}${pathWithParams}${encodeQuery(init.query)}`;
  const bodyIsJson = init.body !== undefined && !Buffer.isBuffer(init.body);
  const bodyString = bodyIsJson ? JSON.stringify(init.body) : undefined;
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const auth = await authorizationHeader();
      const res = await undiciRequest(url, {
        method: init.method,
        headers: {
          authorization: auth,
          accept: init.accept ?? "application/json",
          ...(bodyIsJson && { "content-type": "application/json" }),
          ...(init.headers ?? {}),
        },
        body: bodyString ?? (Buffer.isBuffer(init.body) ? init.body : undefined),
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      });

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (typeof v === "string") headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(", ");
      }
      const requestId =
        headers["x-apple-request-id"] ?? headers["x-request-id"];

      if (RETRYABLE.has(res.statusCode) && attempt < MAX_RETRIES) {
        await res.body.dump();
        const delay = backoffDelay(attempt, headers["retry-after"]);
        await sleep(delay);
        continue;
      }

      const body = await readBody(res.body, init.raw === true);

      if (res.statusCode >= 400) {
        throw new AscHttpError({
          status: res.statusCode,
          body,
          requestId,
          method: init.method,
          url,
        });
      }

      return {
        status: res.statusCode,
        headers,
        body: body as T,
        requestId,
      };
    } catch (err) {
      lastErr = err;
      // Only retry on network-layer errors. HTTP-layer 4xx/5xx handled above.
      const isNetwork =
        err instanceof Error &&
        /ECONN|ETIMEDOUT|socket hang up|fetch failed|network/i.test(
          err.message,
        );
      if (!isNetwork || attempt >= MAX_RETRIES) break;
      await sleep(backoffDelay(attempt));
    }
  }
  throw lastErr;
}
