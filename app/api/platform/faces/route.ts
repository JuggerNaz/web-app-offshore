import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function POST(request: Request, context: any) {
  const supabase = createClient();
  const body = await request.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  body.cr_user = user?.id;

  const { data, error } = await supabase.from("str_faces").insert(body).select();

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: data });
}

export async function PUT(request: Request, context: any) {
  const body = await request.json();
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();

  const originalFace = body.original_face || body.face;
  const { original_face, ...updateData } = body;

  const { data, error } = await supabase
    .from("str_faces")
    .update(updateData)
    .eq("plat_id", body.plat_id)
    .eq("face", originalFace)
    .select();

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: data });
}

export async function DELETE(request: Request, context: any) {
  const body = await request.json();

  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();

  const { data, error } = await supabase
    .from("str_faces")
    .delete()
    .eq("plat_id", body.plat_id)
    .eq("face", body.face);

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to delete face" });
  }

  return NextResponse.json({ comment: data });
}
