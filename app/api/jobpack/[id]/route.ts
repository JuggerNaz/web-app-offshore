import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid jobpack id" }, { status: 400 });
  }

  const supabase = createClient();
  let { data, error } = await (supabase as any)
    .from("jobpack")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", numId)
    .maybeSingle();

  // Fallback: If not found under current company_id, check if jobpack exists with NULL company_id (unassigned/legacy)
  if (!data) {
    const { data: legacyData } = await (supabase as any)
      .from("jobpack")
      .select("*")
      .is("company_id", null)
      .eq("id", numId)
      .maybeSingle();

    if (legacyData) {
      // Auto-assign to active tenant
      await (supabase as any)
        .from("jobpack")
        .update({ company_id: companyId })
        .eq("id", numId);
      legacyData.company_id = companyId;
      data = legacyData;
    }
  }

  if (!data) {
    return NextResponse.json({ error: "Jobpack not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
});

export const PUT = withTenant(async (request, { companyId, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid jobpack id" }, { status: 400 });
  }
  const body = await request.json();
  const supabase = createClient();

  const updatePayload = {
    ...body,
    company_id: body.company_id || companyId,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await (supabase as any)
    .from("jobpack")
    .update(updatePayload)
    .eq("company_id", companyId)
    .eq("id", numId)
    .select()
    .maybeSingle();

  // If not matched by company_id, check if the jobpack had NULL company_id
  if (!data) {
    const { data: retryData, error: retryError } = await (supabase as any)
      .from("jobpack")
      .update(updatePayload)
      .is("company_id", null)
      .eq("id", numId)
      .select()
      .maybeSingle();

    if (retryData) {
      data = retryData;
      error = null;
    }
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to update jobpack" }, { status: error ? 500 : 404 });
  }

  return NextResponse.json({ data });
});

export const DELETE = withTenant(async (request, { companyId, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid jobpack id" }, { status: 400 });
  }
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();

  const { error } = await (supabase as any)
    .from("jobpack")
    .delete()
    .eq("company_id", companyId)
    .eq("id", numId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
