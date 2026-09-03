import { NextResponse } from "next/server";

/**
 * Attach browser-only cache headers to a GET response.
 *
 * `private` keeps responses out of shared CDNs — these are authenticated,
 * tenant-scoped endpoints and must never be cached where another company
 * could read them. Browsers still skip the network entirely for `max-age`
 * seconds and serve stale content while revalidating in the background,
 * which directly cuts repeat Supabase egress (navigate away and back,
 * reopens, dropdowns re-mounted across pages).
 *
 * Only apply to reference/config-style data that tolerates `maxAgeSeconds`
 * of staleness. Never apply to per-user or frequently mutating endpoints.
 */
export function withCacheHeaders<T>(
  response: NextResponse,
  maxAgeSeconds: number,
  staleWhileRevalidateSeconds: number = maxAgeSeconds * 2
): NextResponse {
  response.headers.set(
    "Cache-Control",
    `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
  );
  return response;
}
