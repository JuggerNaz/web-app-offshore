import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId, params }) => {
  const { id } = await params;

  const supabase = createClient();
  const { data, error } = await (supabase as any).from("jobpack").select("*").eq("company_id", companyId).eq("id", Number(id)).single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else return NextResponse.json({ error: "Failed to fetch jobpack" }, { status: 500 });
  }

  return NextResponse.json({ data });
});

export const PUT = withTenant(async (request, { companyId, params }) => {
  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await (supabase as any)
    .from("jobpack")
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("id", Number(id))
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else return NextResponse.json({ error: "Failed to update jobpack" }, { status: 500 });
  }

  return NextResponse.json({ data });
});

export const DELETE = withTenant(async (request, { companyId, params }) => {
  const { id } = await params;
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();

  const { error } = await (supabase as any).from("jobpack").delete().eq("company_id", companyId).eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
