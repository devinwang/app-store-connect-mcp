/**
 * ASC pagination helpers. ASC uses JSON:API-style cursor pagination:
 *   {
 *     "data": [ ... ],
 *     "links": {
 *       "self": "...",
 *       "next": "https://api.appstoreconnect.apple.com/v1/...?cursor=..."
 *     },
 *     "meta": { "paging": { "total": 42, "limit": 200 } }
 *   }
 *
 * The "cursor" value is opaque — we simply forward it back on the next
 * request. Most list endpoints accept `limit` (1..200) and `cursor`.
 */

export interface PageResult<T> {
  data: T[];
  nextCursor: string | undefined;
  total?: number | undefined;
}

export function extractCursor(nextLink: string | undefined): string | undefined {
  if (!nextLink) return undefined;
  try {
    const url = new URL(nextLink);
    return url.searchParams.get("cursor") ?? undefined;
  } catch {
    return undefined;
  }
}

export interface AscListResponse<T> {
  data: T[];
  links?: { next?: string };
  meta?: { paging?: { total?: number; limit?: number } };
}

export function page<T>(res: AscListResponse<T>): PageResult<T> {
  return {
    data: res.data,
    nextCursor: extractCursor(res.links?.next),
    total: res.meta?.paging?.total,
  };
}
