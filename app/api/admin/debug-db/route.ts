import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserMembership } from "@/utils/role-auth";
import { apiSuccess, apiError, apiUnauthorized } from "@/utils/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/debug-db
 * Secure server-side diagnostic endpoint to verify current user session,
 * active company memberships, and test basic table queries.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient() as any;

    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: "Authentication required",
        details: authError || "No active user session found"
      }, { status: 401 });
    }

    // 2. Read x-company-id context header
    const companyId = request.headers.get("x-company-id");

    // 3. Retrieve user membership & profile details
    let membershipResult: any = null;
    try {
      membershipResult = await getUserMembership(supabase, user.id, companyId);
    } catch (e: any) {
      membershipResult = { error: e.message || "Failed during getUserMembership execution" };
    }

    // 4. Perform diagnostic counts on target tables
    const tableDiagnostics: any = {
      companies: { count: null, error: null },
      profiles: { count: null, error: null },
      company_memberships: { count: null, error: null },
    };

    // A. Companies Count
    const { count: companiesCount, error: companiesError } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true });
    tableDiagnostics.companies.count = companiesCount;
    tableDiagnostics.companies.error = companiesError ? {
      code: companiesError.code,
      message: companiesError.message,
      details: companiesError.details,
    } : null;

    // B. Profiles Count
    const { count: profilesCount, error: profilesError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    tableDiagnostics.profiles.count = profilesCount;
    tableDiagnostics.profiles.error = profilesError ? {
      code: profilesError.code,
      message: profilesError.message,
      details: profilesError.details,
    } : null;

    // C. Company Memberships Count
    const { count: membershipsCount, error: membershipsError } = await supabase
      .from("company_memberships")
      .select("*", { count: "exact", head: true });
    tableDiagnostics.company_memberships.count = membershipsCount;
    tableDiagnostics.company_memberships.error = membershipsError ? {
      code: membershipsError.code,
      message: membershipsError.message,
      details: membershipsError.details,
    } : null;

    // 5. Query first few rows from profiles & company_memberships to see what is visible under RLS
    const { data: visibleProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, is_active")
      .limit(5);

    const { data: visibleMemberships } = await supabase
      .from("company_memberships")
      .select("id, user_id, company_id, role, is_active")
      .limit(5);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: {
        userId: user.id,
        email: user.email,
      },
      requestHeaders: {
        xCompanyId: companyId,
      },
      membershipContext: membershipResult,
      tableCounts: tableDiagnostics,
      rlsSampleData: {
        profiles: visibleProfiles || [],
        memberships: visibleMemberships || [],
      },
      testQuery: await (async () => {
        try {
          const compId = companyId || (membershipResult && membershipResult.company && membershipResult.company.id);
          if (!compId) return { error: "No company ID available for test query" };
          const { data, error } = await supabase
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
            .eq("company_id", compId);
          return { data, error };
        } catch (e: any) {
          return { catchError: e.message || String(e) };
        }
      })()
    });

  } catch (error: any) {
    console.error("[GET /api/admin/debug-db] System Error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error during diagnostics",
      message: error.message || String(error)
    }, { status: 500 });
  }
}
