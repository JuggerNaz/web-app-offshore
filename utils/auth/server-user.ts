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
    if (typeof supabase.auth?.getClaims === "function") {
      const { data, error } = await supabase.auth.getClaims();
      if (!error && data) {
        const payload: any = (data as any).claims ?? data;
        const id = payload?.sub ?? payload?.id;
        if (id) {
          return {
            id,
            email: payload?.email ?? null,
          };
        }
      }
    }

    // Fallback to standard getUser()
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    return {
      id: user.id,
      email: user.email ?? null,
    };
  } catch {
    return null;
  }
}
