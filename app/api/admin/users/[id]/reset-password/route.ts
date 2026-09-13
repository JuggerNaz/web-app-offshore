import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import { apiSuccess, apiError } from "@/utils/api-response";

/**
 * Generate a strong, memorable temporary password
 */
function generateTemporaryPassword(): string {
  const words = ["Offshore", "DeepSea", "Subsea", "Anchor", "Platform", "Energy", "Horizon"];
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const symbols = ["!", "@", "#", "$", "%", "*"];
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  return `${randomWord}#${randomDigits}${randomSymbol}`;
}

/**
 * POST /api/admin/users/[id]/reset-password
 * Resets a user's password to a temporary one-time password and forces them to change it on next login.
 * Protected by admin roles.
 */
export const POST = withRole(
  ["company_admin", "super_admin"],
  async (request, { params, company, user: executingUser }) => {
    try {
      const { id } = await params;
      const json = await request.json().catch(() => ({}));
      const { customPassword } = json;

      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return apiError(
          "SUPABASE_SERVICE_ROLE_KEY is not configured in environment variables. Admin credentials are required to reset user passwords.",
          500
        );
      }

      const supabase = createClient() as any;
      const adminClient = createAdminClient() as any;

      // 1. Retrieve the membership or profile to get the target user ID
      // ID can be either a company_membership id or a user profile id
      let targetUserId = id;
      let targetEmail = "";

      const { data: membership } = await supabase
        .from("company_memberships")
        .select("user_id, company_id, user:profiles!user_id(email, full_name)")
        .eq("id", id)
        .maybeSingle();

      if (membership) {
        targetUserId = membership.user_id;
        targetEmail = membership.user?.email || "";
      } else {
        // Try searching directly in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("id", id)
          .maybeSingle();

        if (profile) {
          targetUserId = profile.id;
          targetEmail = profile.email;
        }
      }

      if (!targetUserId) {
        return apiError("Target user not found", 404);
      }

      // 2. Prevent self-reset via admin one-time tool (should use standard change password)
      if (targetUserId === executingUser.id) {
        return apiError("Cannot reset your own password via admin tool. Please use Account Settings.", 400);
      }

      // 3. Determine the temporary password
      const tempPassword = (customPassword && typeof customPassword === "string" && customPassword.trim().length >= 6)
        ? customPassword.trim()
        : generateTemporaryPassword();

      // 4. Fetch existing auth user to preserve metadata
      const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (getUserError || !userData?.user) {
        console.error("[POST /api/admin/users/[id]/reset-password] getUserById error:", getUserError);
        return apiError("Failed to locate user in authentication directory", 404);
      }

      // 5. Update user password in auth.users and set must_change_password in user_metadata
      const existingMeta = userData.user.user_metadata || {};
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: tempPassword,
        user_metadata: {
          ...existingMeta,
          must_change_password: true,
          password_reset_at: new Date().toISOString(),
          password_reset_by: executingUser.id,
        },
      });

      if (updateAuthError) {
        console.error("[POST /api/admin/users/[id]/reset-password] updateUserById error:", updateAuthError);
        return apiError(updateAuthError.message || "Failed to update user password in authentication provider", 500);
      }

      // 6. Update must_change_password flag in public.profiles table
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);

      if (profileError) {
        console.warn("[POST /api/admin/users/[id]/reset-password] Profile update warning:", profileError);
      }

      return apiSuccess({
        success: true,
        userId: targetUserId,
        email: targetEmail || userData.user.email,
        temporaryPassword: tempPassword,
        mustChangePassword: true,
        message: "Password reset successfully. The user will be required to change this password on their next login.",
      });
    } catch (error: any) {
      console.error("[POST /api/admin/users/[id]/reset-password] Error:", error);
      return apiError(error?.message || "Internal server error resetting password", 500);
    }
  }
);
