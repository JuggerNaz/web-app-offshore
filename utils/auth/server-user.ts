/**
 * Lightweight authenticated-user shape resolved from verified JWT claims.
 * Avoids a network round trip to Supabase Auth on every request.
 */
export interface AuthUser {
  id: string;
  email?: string | null;
}

/**
 * Resolve the authenticated user for route handlers without a network call.
 *
 * Uses `supabase.auth.getClaims()` which verifies the JWT locally when the
 * project uses asymmetric signing keys (ES256/RS256). On legacy HS256 projects
 * it transparently falls back to the `/auth/v1/user` endpoint, so behavior is
 * always correct — just not faster.
 *
 * Returns null when the request is not authenticated.
 */
export async function getAuthUser(supabase: any): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data) return null;

    // Local verification returns { claims, header, signature };
    // the HS256 fallback returns a full User object. Handle both shapes.
    const payload: any = (data as any).claims ?? data;
    const id = payload?.sub ?? payload?.id;
    if (!id) return null;

    return {
      id,
      email: payload?.email ?? null,
    };
  } catch {
    return null;
  }
}
