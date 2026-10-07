const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * fetch wrapper that aborts the request after `timeoutMs`.
 *
 * Server-side Supabase calls (middleware session refresh, dashboard layout
 * auth/membership checks) previously used plain fetch with no timeout. When
 * Supabase Auth/PostgREST stalls, those calls hang until the hosting platform
 * kills the request — observed in production as Netlify edge functions dying
 * at ~36s with "the edge function timed out" (HTTP 500). This wrapper makes
 * every server-side Supabase call fail fast so the app can degrade gracefully
 * (middleware returns a retryable 503; layout redirects) instead of crashing.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined = undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  // Respect an explicitly provided signal (e.g. per-query abortSignal(...)).
  if (init?.signal) {
    return fetch(input, init);
  }
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
