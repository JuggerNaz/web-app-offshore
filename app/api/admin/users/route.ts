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

    if (!memberships || memberships.length === 0) {
      return apiSuccess([]);
    }

    // Fetch user_roles for these user_ids
    const userIds = memberships.map((m: any) => m.user_id);
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role, modules")
      .in("user_id", userIds);

    if (rolesError) {
      console.error("[GET /api/admin/users] rolesError:", rolesError);
    }

    const rolesMap = new Map<string, any>(userRoles?.map((r: any) => [r.user_id, r]) || []);

    const mergedMemberships = memberships.map((m: any) => ({
      ...m,
      systemRole: rolesMap.get(m.user_id)?.role || "User",
      modules: rolesMap.get(m.user_id)?.modules || [],
    }));

    return apiSuccess(mergedMemberships);
  } catch (error: any) {
    console.error("[GET /api/admin/users] Error:", error);
    return apiError("Internal server error", 500);
  }
});

/**
 * POST /api/admin/users
 * Creates/invites a new user directly with optional default password and multi-tenant assignments.
 * Supports automatic direct user creation (no SMTP/email needed) or invitation fallback.
 * Protected by admin roles.
 */
export const POST = withRole(["company_admin", "super_admin"], async (request, { user, company, membership }) => {
  try {
    const json = await request.json();
    const { email, password, role, full_name, designation, tenant_assignments } = json;

    if (!email || typeof email !== "string" || !email.trim()) {
      return apiError("A valid email address is required", 400);
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return apiError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured in .env.local. Admin privileges are required to manage users.",
        500
      );
    }

    const adminClient = createAdminClient() as any;
    const origin = new URL(request.url).origin;

    let targetUser: any = null;
    let inviteLink: string | null = null;
    let emailSent = false;
    let notice = "";
    const isSuperAdmin = membership?.role === "super_admin";

    // 1. If a direct password is provided, try creating user directly or updating existing user
    if (password && typeof password === "string" && password.trim().length > 0) {
      const trimmedPassword = password.trim();
      
      // Check if user already exists
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const existing = usersData?.users?.find((u: any) => u.email?.toLowerCase() === trimmedEmail);

      if (existing) {
        targetUser = existing;
        // Update user's password and metadata
        const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
          password: trimmedPassword,
          user_metadata: {
            ...existing.user_metadata,
            full_name: full_name?.trim() || existing.user_metadata?.full_name || "",
            designation: designation?.trim() || existing.user_metadata?.designation || "",
          },
        });
        if (updateError) {
          console.warn("[POST /api/admin/users] updateUserById password error:", updateError);
        }
        notice = "Existing user credentials and profile updated.";
      } else {
        // Create brand new user directly with password and email_confirm: true
        const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
          email: trimmedEmail,
          password: trimmedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: full_name?.trim() || "",
            designation: designation?.trim() || "",
          },
        });

        if (createError) {
          console.error("[POST /api/admin/users] Direct createUser error:", createError);
          return apiError(createError.message || "Failed to create user", 400);
        }

        targetUser = createData?.user;
        notice = "User account created with default password.";
      }
    } else {
      // 2. No password provided -> Try standard invite email or fallback link
      try {
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
          trimmedEmail,
          {
            redirectTo: `${origin}/auth/callback`,
            data: {
              full_name: full_name?.trim() || "",
              designation: designation?.trim() || "",
            },
          }
        );

        if (!inviteError && inviteData?.user) {
          targetUser = inviteData.user;
          emailSent = true;
          notice = "Invitation email sent successfully.";
        } else {
          console.warn("[POST /api/admin/users] inviteUserByEmail failed, trying generateLink fallback:", inviteError?.message);
        }
      } catch (e: any) {
        console.warn("[POST /api/admin/users] inviteUserByEmail exception:", e?.message);
      }

      if (!targetUser) {
        try {
          const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: "invite",
            email: trimmedEmail,
            options: {
              redirectTo: `${origin}/auth/callback`,
              data: {
                full_name: full_name?.trim() || "",
                designation: designation?.trim() || "",
              },
            },
          });

          if (!linkError && linkData?.user) {
            targetUser = linkData.user;
            inviteLink = linkData.properties?.action_link || null;
            emailSent = false;
            notice = "User account created. Direct login link generated.";
          }
        } catch (e: any) {
          console.warn("[POST /api/admin/users] generateLink invite exception:", e?.message);
        }
      }

      if (!targetUser) {
        // Create user with randomized fallback password
        const randomPass = `Offshore#${Math.random().toString(36).slice(-8)}!`;
        const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
          email: trimmedEmail,
          password: randomPass,
          email_confirm: true,
          user_metadata: {
            full_name: full_name?.trim() || "",
            designation: designation?.trim() || "",
          },
        });

        if (createError) {
          return apiError(createError.message || "Failed to create user account", 400);
        }
        targetUser = createData?.user;
        notice = "User account created.";
      }
    }

    if (!targetUser) {
      return apiError("Unable to create or locate user in authentication system", 400);
    }

    // Upsert profiles record
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: targetUser.id,
        email: targetUser.email || trimmedEmail,
        full_name: full_name?.trim() || targetUser.user_metadata?.full_name || "",
        designation: designation?.trim() || targetUser.user_metadata?.designation || "",
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("[POST /api/admin/users] Profile Sync Error:", profileError);
    }

    // Determine target company assignments
    let assignmentsToProcess: Array<{ company_id: string; role: string }> = [];

    if (isSuperAdmin && Array.isArray(tenant_assignments) && tenant_assignments.length > 0) {
      assignmentsToProcess = tenant_assignments.map((ta: any) => ({
        company_id: ta.company_id,
        role: ta.role || "viewer",
      }));
    } else {
      assignmentsToProcess = [
        {
          company_id: company.id,
          role: role || "viewer",
        },
      ];
    }

    const createdMemberships: any[] = [];

    for (const assignment of assignmentsToProcess) {
      const { data: newMembership, error: membershipError } = await adminClient
        .from("company_memberships")
        .upsert(
          {
            user_id: targetUser.id,
            company_id: assignment.company_id,
            role: assignment.role,
            is_active: true,
            invited_by: user.id,
            updated_at: new Date().toISOString(),
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
          company:companies!company_id(id, name, slug),
          user:profiles!user_id(*)
        `)
        .single();

      if (membershipError) {
        console.error("[POST /api/admin/users] Membership Error for company", assignment.company_id, membershipError);
      } else if (newMembership) {
        createdMemberships.push(newMembership);
      }
    }

    // Create or ensure default user_roles entry
    const { error: defaultRoleError } = await adminClient
      .from("user_roles")
      .upsert(
        {
          user_id: targetUser.id,
          role: "User",
          modules: [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (defaultRoleError) {
      console.error("[POST /api/admin/users] Default user_roles Error:", defaultRoleError);
    }

    const primaryMembership = createdMemberships.find((m) => m.company_id === company.id) || createdMemberships[0];

    const result = {
      ...(primaryMembership || {}),
      user: {
        id: targetUser.id,
        email: targetUser.email || trimmedEmail,
        full_name: full_name?.trim() || "",
        designation: designation?.trim() || "",
      },
      memberships: createdMemberships,
      systemRole: "User",
      modules: [],
      inviteLink: inviteLink || null,
      emailSent,
      notice: notice || "User created successfully.",
    };

    return apiCreated(result);
  } catch (error: any) {
    console.error("[POST /api/admin/users] Error:", error);
    return apiError(error?.message || "Internal server error", 500);
  }
});
