import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiUnauthorized } from "@/utils/api-response";
import { AuthUser, getAuthUser } from "@/utils/auth/server-user";

export interface AuthenticatedContext {
  params: Promise<any>;
  user: AuthUser;
}

/**
 * Type for authenticated route handler
 */
type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthenticatedContext
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function to protect API routes with authentication
 *
 * Usage:
 * ```typescript
 * export const GET = withAuth(async (request, { params, user }) => {
 *   // user is guaranteed to exist here
 *   return apiSuccess({ data: "protected data" });
 * });
 * ```
 *
 * @param handler - The route handler function
 * @returns Protected route handler
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
    try {
      const supabase = createClient();
      const user = await getAuthUser(supabase);

      if (!user) {
        return apiUnauthorized("Authentication required");
      }

      // Call the original handler with user context
      return await handler(request, { params: context.params, user });
    } catch (error) {
      console.error("[withAuth] Error:", error);
      return apiUnauthorized("Authentication failed");
    }
  };
}

/**
 * Type for optionally authenticated route handler
 */
type OptionalAuthHandler = (
  request: NextRequest,
  context: { params: Promise<any>; user: AuthUser | null }
) => Promise<NextResponse> | NextResponse;

/**
 * Similar to withAuth but allows unauthenticated access
 * User will be null if not authenticated
 *
 * Usage:
 * ```typescript
 * export const GET = withOptionalAuth(async (request, { params, user }) => {
 *   if (user) {
 *     // Show user-specific data
 *   } else {
 *     // Show public data
 *   }
 * });
 * ```
 */
export function withOptionalAuth(handler: OptionalAuthHandler) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
    try {
      const supabase = createClient();
      const user = await getAuthUser(supabase);

      return await handler(request, { params: context.params, user });
    } catch (error) {
      console.error("[withOptionalAuth] Error:", error);
      // Continue with null user on error
      return await handler(request, { params: context.params, user: null });
    }
  };
}

/**
 * Extract user from request (for use in route handlers that already have auth checks)
 *
 * @returns User object or null
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = createClient();
    return await getAuthUser(supabase);
  } catch (error) {
    console.error("[getCurrentUser] Error:", error);
    return null;
  }
}
