import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
  const { id } = await context.params;

  const supabase = createClient();
  const { data, error } = await supabase.from("jobpack").select("*").eq("id", Number(id)).single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else return NextResponse.json({ error: "Failed to fetch jobpack" }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PUT(request: Request, context: any) {
  const { id } = await context.params;
  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("jobpack")
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
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
}

export async function DELETE(request: Request, context: any) {
  const { id } = await context.params;
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();

  const { error } = await supabase.from("jobpack").delete().eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
