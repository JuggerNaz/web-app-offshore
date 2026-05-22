import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import { apiSuccess, apiError, apiCreated } from "@/utils/api-response";

/**
 * GET /api/admin/users
 * Returns list of members in the active company.
 * Protected by admin roles.
 */
export const GET = withRole(["company_admin", "super_admin"], async (request, { company }) => {
  try {
    const supabase = createClient() as any;
    
    // Fetch memberships linked with user profiles
    const { data: memberships, error } = await supabase
      .from("company_memberships")
      .select(`
        id,
        user_id,
        company_id,
        role,
        is_active,
        created_at,
        updated_at,
        user:profiles!user_id(*)
      `)
      .eq("company_id", company.id);

    if (error) {
      console.error("[GET /api/admin/users] DB Error:", error);
      return apiError("Failed to retrieve company members", 500);
    }

    return apiSuccess(memberships);
  } catch (error: any) {
    console.error("[GET /api/admin/users] Error:", error);
    return apiError("Internal server error", 500);
  }
});

/**
 * POST /api/admin/users
 * Invites a new user by email and creates profile + membership in the active company.
 * Protected by admin roles.
 */
export const POST = withRole(["company_admin", "super_admin"], async (request, { user, company }) => {
  try {
    const json = await request.json();
    const { email, role, full_name, designation } = json;

    if (!email) {
      return apiError("Email is required", 400);
    }

    const adminClient = createAdminClient() as any;
    const origin = new URL(request.url).origin;

    // 1. Send Supabase auth invite
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${origin}/auth/callback`,
        data: {
          full_name: full_name || "",
          designation: designation || "",
        },
      }
    );

    if (inviteError || !inviteData?.user) {
      console.error("[POST /api/admin/users] Invite Error:", inviteError);
      return apiError(inviteError?.message || "Failed to invite user", 400);
    }

    const invitedUser = inviteData.user;

    // 2. Ensure profile exists and has the requested full_name / designation
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: invitedUser.id,
        email: invitedUser.email || email,
        full_name: full_name || "",
        designation: designation || "",
        is_active: true,
      });

    if (profileError) {
      console.error("[POST /api/admin/users] Profile Sync Error:", profileError);
      // Log error but continue trying to create membership
    }

    // 3. Create or update company membership for the active company
    const { data: newMembership, error: membershipError } = await adminClient
      .from("company_memberships")
      .upsert(
        {
          user_id: invitedUser.id,
          company_id: company.id,
          role: role || "viewer",
          is_active: true,
          invited_by: user.id,
        },
        {
          onConflict: "user_id,company_id",
        }
      )
      .select(`
        id,
        user_id,
        company_id,
        role,
        is_active,
        created_at,
        user:profiles!user_id(*)
      `)
      .single();

    if (membershipError) {
      console.error("[POST /api/admin/users] Membership Error:", membershipError);
      return apiError("User invited but failed to add to company", 500);
    }

    return apiCreated(newMembership);
  } catch (error: any) {
    console.error("[POST /api/admin/users] Error:", error);
    return apiError("Internal server error", 500);
  }
});
