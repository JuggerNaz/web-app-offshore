import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiUnauthorized } from "@/utils/api-response";
import { User } from "@supabase/supabase-js";

/**
 * Type for authenticated route handler
 */
type AuthenticatedHandler = (
  request: NextRequest,
  context: { params: any; user: User }
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
  return async (request: NextRequest, context: { params: any }) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return apiUnauthorized("Authentication required");
      }

      // Call the original handler with user context
      return await handler(request, { params: context.params || {}, user });
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
  context: { params: any; user: User | null }
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
  return async (request: NextRequest, context: { params: any }) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      return await handler(request, { params: context.params || {}, user });
    } catch (error) {
      console.error("[withOptionalAuth] Error:", error);
      // Continue with null user on error
      return await handler(request, { params: context.params || {}, user: null });
    }
  };
}

/**
 * Extract user from request (for use in route handlers that already have auth checks)
 *
 * @returns User object or null
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error("[getCurrentUser] Error:", error);
    return null;
  }
}
