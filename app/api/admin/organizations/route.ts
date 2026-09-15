import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import {
  apiSuccess,
  apiCreated,
  apiError,
  apiNotFound,
  apiBadRequest,
} from "@/utils/api-response";

/**
 * GET /api/admin/organizations
 * List all organizations. Super admin only.
 */
export const GET = withRole(["super_admin"], async (request) => {
  try {
    let clientToUse: any;
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        clientToUse = createAdminClient();
      } else {
        clientToUse = createClient();
      }
    } catch {
      clientToUse = createClient();
    }

    const { data, error } = await clientToUse
      .from("companies")
      .select(`*, company_memberships(count)`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/organizations] DB Error:", error);
      return apiError("Failed to fetch organizations: " + error.message, 500);
    }

    const organizations = (data || []).map((org: any) => ({
      ...org,
      member_count: org.company_memberships?.[0]?.count || 0,
      company_memberships: undefined,
    }));

    return apiSuccess(organizations);
  } catch (error: any) {
    console.error("[GET /api/admin/organizations] Error:", error);
    return apiError("Internal server error: " + (error?.message || "unknown"), 500);
  }
});

/**
 * POST /api/admin/organizations
 * Create a new organization with complete company details. Super admin only.
 */
export const POST = withRole(["super_admin"], async (request, { user }) => {
  try {
    let json: any;
    try {
      json = await request.json();
    } catch {
      return apiBadRequest("Invalid request body");
    }
    const {
      name,
      slug,
      serial_no,
      registration_no,
      tax_id,
      company_email,
      contact_person,
      contact_phone,
      address,
      country,
      start_date,
      end_date,
      description,
      max_users,
      subscription_plan,
      is_active,
    } = json;

    if (!name || !name.trim()) {
      return apiBadRequest("Organization Name is required");
    }

    if (!slug || !slug.trim()) {
      return apiBadRequest("Organization Slug is required");
    }

    const normalizedSlug = slug.trim().toLowerCase();
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugPattern.test(normalizedSlug)) {
      return apiBadRequest(
        "Slug must be lowercase, alphanumeric, separated by hyphens (e.g. petronas-carigali)"
      );
    }

    let clientToUse: any;
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        clientToUse = createAdminClient();
      } else {
        clientToUse = createClient();
      }
    } catch {
      clientToUse = createClient();
    }

    const insertData: Record<string, any> = {
      name: name.trim(),
      slug: normalizedSlug,
      is_active: is_active !== undefined ? is_active : true,
    };

    if (serial_no !== undefined) insertData.serial_no = serial_no?.trim() || null;
    if (registration_no !== undefined) insertData.registration_no = registration_no?.trim() || null;
    if (tax_id !== undefined) insertData.tax_id = tax_id?.trim() || null;
    if (company_email !== undefined) insertData.company_email = company_email?.trim() || null;
    if (contact_person !== undefined) insertData.contact_person = contact_person?.trim() || null;
    if (contact_phone !== undefined) insertData.contact_phone = contact_phone?.trim() || null;
    if (address !== undefined) insertData.address = address?.trim() || null;
    if (country !== undefined) insertData.country = country?.trim() || null;
    if (start_date !== undefined && start_date) insertData.start_date = start_date;
    if (end_date !== undefined && end_date) insertData.end_date = end_date;
    if (description !== undefined) insertData.description = description?.trim() || null;
    if (max_users !== undefined) insertData.max_users = parseInt(max_users) || 50;
    if (subscription_plan !== undefined) insertData.subscription_plan = subscription_plan || "standard";

    // Attempt insertion
    let { data, error } = await clientToUse
      .from("companies")
      .insert(insertData)
      .select()
      .single();

    // If service client failed with RLS, try session client fallback
    if (error && error.message?.includes("row-level security")) {
      console.warn("[POST /api/admin/organizations] Trying session client fallback...");
      const sessionClient = createClient() as any;
      const fallbackResult = await sessionClient
        .from("companies")
        .insert(insertData)
        .select()
        .single();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("[POST /api/admin/organizations] DB Error:", error);
      if (error.code === "23505") {
        return apiBadRequest("An organization with this slug or serial number already exists");
      }
      return apiError(`Failed to create organization: ${error.message}`, 500);
    }

    // Auto-create super_admin membership for the creator in this company
    if (data?.id && user?.id) {
      try {
        await clientToUse
          .from("company_memberships")
          .upsert({
            company_id: data.id,
            user_id: user.id,
            role: "super_admin",
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,company_id" });
      } catch (memErr) {
        console.warn("[POST /api/admin/organizations] Creator membership link warning:", memErr);
      }

      // Explicitly trigger template data provisioning (library, defect criteria, MGI profiles)
      try {
        await clientToUse.rpc("provision_tenant_template_data", {
          target_company_id: data.id,
        });
      } catch (rpcErr) {
        console.warn("[POST /api/admin/organizations] Provisioning RPC warning:", rpcErr);
      }
    }

    return apiCreated(data);
  } catch (error: any) {
    console.error("[POST /api/admin/organizations] Error:", error);
    return apiError(`Internal server error: ${error?.message || "unknown"}`, 500);
  }
});
