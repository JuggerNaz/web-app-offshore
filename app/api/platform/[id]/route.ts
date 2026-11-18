import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { syncWebapp3D } from "@/utils/platform-3d-math";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient();
  const { data, error } = await supabase.from("platform").select("*").eq("plat_id", Number(id)).single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else return NextResponse.json({ error: "Failed to fetch platform" }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rawBody = await request.json();
  const supabase = createClient();
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupabase = useAdmin ? createAdminClient() : supabase;

  // Handle aliases and clean up non-column fields
  const body: Record<string, any> = { ...rawBody };
  if (body.cslota !== undefined) {
    if (body.cslot === undefined) {
      body.cslot = body.cslota;
    }
    delete body.cslota;
  }
  if (body.slots !== undefined && body.cslot === undefined) {
    body.cslot = body.slots;
    delete body.slots;
  }
  delete body.id;
  delete body.metadata;
  delete body.oilfield;
  delete body.oil_field;

  const { data, error } = await supabase.from("platform").update(body).eq("plat_id", Number(id)).select().maybeSingle();

  if (error) {
    console.error("[Platform PUT Error]", error);
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else return NextResponse.json({ error: error.message || "Failed to update platform" }, { status: 500 });
  }

  // Trigger 3D recalculation after updating platform specifications
  await syncWebapp3D(adminSupabase, Number(id)).catch((err) => {
    console.error("[3D Sync Error on platform PUT]", err);
  });

  return NextResponse.json({ data });
}
