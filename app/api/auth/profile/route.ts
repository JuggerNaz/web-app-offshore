import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withAuth } from "@/utils/with-auth";
import { apiSuccess, apiError, apiForbidden } from "@/utils/api-response";
import { getUserMembership } from "@/utils/role-auth";

/**
 * GET /api/auth/profile
 * Returns user profile, active company, active membership, and all active memberships.
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const supabase = createClient() as any;
    const companyId = request.headers.get("x-company-id");

    const result = await getUserMembership(supabase, user.id, companyId);
    if ("error" in result) {
      return apiForbidden(result.error);
    }

    return apiSuccess(result);
  } catch (error: any) {
    console.error("[GET /api/auth/profile] Error:", error);
    return apiError("Failed to fetch user profile", 500);
  }
});

/**
 * PATCH /api/auth/profile
 * Updates user profile details (full_name, designation, avatar_url).
 */
export const PATCH = withAuth(async (request: NextRequest, { user }) => {
  try {
    const supabase = createClient() as any;
    const json = await request.json();
    
    // Only allow updating safe profile fields
    const { full_name, designation, avatar_url } = json;
    
    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (designation !== undefined) updateData.designation = designation;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length === 0) {
      return apiError("No valid profile fields provided for update", 400);
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select("*")
      .single();

    if (error || !profile) {
      return apiError("Failed to update profile", 500);
    }

    // Return the updated profile along with the memberships context
    const companyId = request.headers.get("x-company-id");
    const result = await getUserMembership(supabase, user.id, companyId);
    if ("error" in result) {
      return apiForbidden(result.error);
    }

    return apiSuccess(result);
  } catch (error: any) {
    console.error("[PATCH /api/auth/profile] Error:", error);
    return apiError("Failed to update user profile", 500);
  }
});
