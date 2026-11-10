import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import { apiSuccess, apiError, apiCreated, apiPaginated } from "@/utils/api-response";
import {
  getPaginationParams,
  createPaginationMeta,
  applyPagination,
  getSearchParam,
  buildSearchFilter,
} from "@/utils/pagination";

/**
 * GET /api/admin/users
 * Returns paged list of members in the active company.
 * Query params: ?page=1&pageSize=50&q=<name / email / designation search>
 * Protected by admin roles.
 */
export const GET = withRole(["company_admin", "super_admin"], async (request, { company, membership }) => {
  try {
    let supabase = createClient() as any;
    
    // Prefer adminClient if available to avoid RLS recursion/policy issues on memberships
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        supabase = createAdminClient() as any;
      }
    } catch (_) {}

    const targetCompanyId = company?.id || membership?.company_id || request.headers.get("x-company-id");

    const paginationParams = getPaginationParams(request);
    const q = getSearchParam(request);

    let query = supabase
      .from("company_memberships")
      .select(
        `
        id,
        user_id,
        company_id,
        role,
        is_active,
        created_at,
        updated_at,
        user:profiles!user_id(id, email, full_name, designation, avatar_url, is_active, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type, allowed_start_date, allowed_end_date)
      `,
        { count: "exact" }
      );

    if (targetCompanyId) {
      query = query.eq("company_id", targetCompanyId);
    }

    // Search embedded profile columns (PostgREST embedded-resource filter)
    const searchFilter = buildSearchFilter(q, ["user.email", "user.full_name", "user.designation"]);
    if (searchFilter) {
      query = query.or(searchFilter);
    }

    const sortBy = request.nextUrl.searchParams.get("sortBy");
    const sortOrder = request.nextUrl.searchParams.get("sortOrder") === "desc" ? false : true;

    if (sortBy === "role") {
      query = query.order("role", { ascending: sortOrder });
    } else if (sortBy === "status") {
      query = query.order("is_active", { ascending: sortOrder });
    } else if (sortBy === "created_at") {
      query = query.order("created_at", { ascending: sortOrder });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = applyPagination(query, paginationParams);

    let { data: memberships, error, count } = await query;

    // Graceful fallback if allowed_start_date / allowed_end_date columns don't exist yet on profiles
    if (error && (error.message?.includes("allowed_start_date") || error.message?.includes("allowed_end_date"))) {
      console.warn("[GET /api/admin/users] Date columns not yet on profiles, retrying without date fields");
      let fallbackQuery = supabase
        .from("company_memberships")
        .select(
          `
          id,
          user_id,
          company_id,
          role,
          is_active,
          created_at,
          updated_at,
          user:profiles!user_id(id, email, full_name, designation, avatar_url, is_active, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type)
        `,
          { count: "exact" }
        );
      if (targetCompanyId) fallbackQuery = fallbackQuery.eq("company_id", targetCompanyId);
      if (searchFilter) fallbackQuery = fallbackQuery.or(searchFilter);
      if (sortBy === "role") fallbackQuery = fallbackQuery.order("role", { ascending: sortOrder });
      else if (sortBy === "status") fallbackQuery = fallbackQuery.order("is_active", { ascending: sortOrder });
      else if (sortBy === "created_at") fallbackQuery = fallbackQuery.order("created_at", { ascending: sortOrder });
      else fallbackQuery = fallbackQuery.order("created_at", { ascending: false });
      fallbackQuery = applyPagination(fallbackQuery, paginationParams);

      const fallbackRes = await fallbackQuery;
      memberships = fallbackRes.data;
      error = fallbackRes.error;
      count = fallbackRes.count;
    }

    if (error) {
      console.error("[GET /api/admin/users] DB Error:", error);
      return apiError("Failed to retrieve company members", 500);
    }

    if (!memberships || memberships.length === 0) {
      return apiPaginated([], createPaginationMeta(paginationParams, count || 0));
    }

    // Fetch user_roles and profiles for these user_ids to guarantee all restriction and profile fields are present
    const userIds = memberships.map((m: any) => m.user_id).filter(Boolean);
    let userRoles: any[] = [];
    let userProfiles: any[] = [];
    if (userIds.length > 0) {
      const [rolesRes, profilesRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("user_id, role, modules")
          .in("user_id", userIds),
        supabase
          .from("profiles")
          .select("id, email, full_name, designation, avatar_url, is_active, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type, allowed_start_date, allowed_end_date")
          .in("id", userIds)
          .then(async (res: any) => {
            if (res.error && (res.error.message?.includes("allowed_start_date") || res.error.message?.includes("allowed_end_date"))) {
              return supabase
                .from("profiles")
                .select("id, email, full_name, designation, avatar_url, is_active, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type")
                .in("id", userIds);
            }
            return res;
          }),
      ]);

      if (rolesRes.error) {
        console.error("[GET /api/admin/users] rolesError:", rolesRes.error);
      }
      if (profilesRes.error) {
        console.error("[GET /api/admin/users] profilesError:", profilesRes.error);
      }
      userRoles = rolesRes.data || [];
      userProfiles = profilesRes.data || [];
    }

    const profilesMap = new Map<string, any>(userProfiles.map((p: any) => [p.id, p]));
    const rolesMap = new Map<string, any>(userRoles.map((r: any) => [r.user_id, r]));

    const mergedMemberships = memberships.map((m: any) => {
      const rawUser = Array.isArray(m.user) ? m.user[0] : m.user;
      const fullProfile = profilesMap.get(m.user_id) || rawUser || {};
      const mergedUser = {
        ...rawUser,
        ...fullProfile,
      };

      return {
        ...m,
        user: mergedUser,
        systemRole: rolesMap.get(m.user_id)?.role || "User",
        modules: rolesMap.get(m.user_id)?.modules || [],
      };
    });

    return apiPaginated(mergedMemberships, createPaginationMeta(paginationParams, count || 0));
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

    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const origin = new URL(request.url).origin;

    let targetUser: any = null;
    let inviteLink: string | null = null;
    let emailSent = false;
    let notice = "";
    const isSuperAdmin = membership?.role === "super_admin";

    // Prepare database client for memberships and profiles
    let dbClient = createClient() as any;
    let adminClient: any = null;

    if (hasServiceRole) {
      try {
        adminClient = createAdminClient() as any;
        dbClient = adminClient;
      } catch (e) {
        console.warn("[POST /api/admin/users] createAdminClient error:", e);
      }
    }

    if (hasServiceRole && adminClient) {
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
    } else {
      // Fallback: SUPABASE_SERVICE_ROLE_KEY not configured in .env.local
      // 1. Check if user profile already exists in the database
      const { data: existingProfile } = await dbClient
        .from("profiles")
        .select("id, email, full_name, designation")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (existingProfile) {
        targetUser = existingProfile;
        notice = "Existing user added to this workspace.";
      } else {
        // 2. Create user using isolated Supabase auth client with standard credentials
        const { createClient: createSupabaseJsClient } = await import("@supabase/supabase-js");
        const authClient = createSupabaseJsClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const targetPassword = (password && typeof password === "string" && password.trim().length > 0)
          ? password.trim()
          : `Offshore#${Math.floor(1000 + Math.random() * 9000)}!`;

        const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
          email: trimmedEmail,
          password: targetPassword,
          options: {
            data: {
              full_name: full_name?.trim() || "",
              designation: designation?.trim() || "",
            },
          },
        });

        if (signUpError) {
          if (
            signUpError.message?.toLowerCase().includes("already registered") ||
            signUpError.message?.toLowerCase().includes("already exists") ||
            (signUpError as any).status === 422
          ) {
            const { data: retryProfile } = await dbClient
              .from("profiles")
              .select("id, email, full_name, designation")
              .eq("email", trimmedEmail)
              .maybeSingle();

            if (retryProfile) {
              targetUser = retryProfile;
              notice = "Existing user added to company membership.";
            } else {
              return apiError(signUpError.message, 400);
            }
          } else if (signUpError.message?.toLowerCase().includes("signups not allowed")) {
            return apiError(
              "Signups are disabled in your Supabase project settings. To create new accounts directly from the admin dashboard, please configure SUPABASE_SERVICE_ROLE_KEY in .env.local (from Supabase Dashboard > Project Settings > API > service_role), or enable 'Allow new users to sign up' in Supabase Dashboard > Authentication > Providers > Email.",
              400
            );
          } else {
            return apiError(signUpError.message || "Failed to create user", 400);
          }
        } else if (signUpData?.user) {
          targetUser = signUpData.user;
          notice = "User account created with specified credentials.";
        }
      }
    }

    if (!targetUser) {
      return apiError("Unable to create or locate user in authentication system", 400);
    }

    // Upsert profiles record
    const { error: profileError } = await dbClient
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
      const { data: newMembership, error: membershipError } = await dbClient
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
    const { error: defaultRoleError } = await dbClient
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
