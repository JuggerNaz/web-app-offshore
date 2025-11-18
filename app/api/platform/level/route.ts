import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request, context: any) {
  const supabase = createClient();
  const body = await request.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  body.cr_user = user?.id;

  const { data, error } = await supabase.from("str_level").insert(body);

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to insert level" });
  }

  return NextResponse.json({ comment: data });
}

export async function DELETE(request: Request, context: any) {
  const body = await request.json();

  const supabase = createClient();

  const { data, error } = await supabase
    .from("str_level")
    .delete()
    .eq("plat_id", body.plat_id)
    .eq("level_name", body.level_name);

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to delete level" });
  }

  return NextResponse.json({ comment: data });
}
