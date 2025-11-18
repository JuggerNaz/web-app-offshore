import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
  const { id } = await context.params;

  const supabase = createClient();
  const { data, error } = await supabase.from("str_faces").select("*").eq("plat_id", id);

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else return NextResponse.json({ error: "Failed to fetch platform" }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request, context: any) {
  const supabase = createClient();
  const body = await request.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  body.cr_user = user?.id;

  const { data, error } = await supabase.from("str_elv").insert(body);

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to insert elevation" });
  }

  return NextResponse.json({ comment: data });
}

export async function DELETE(request: Request, context: any) {
  const body = await request.json();

  const supabase = createClient();

  const { data, error } = await supabase
    .from("str_elv")
    .delete()
    .eq("plat_id", body.plat_id)
    .eq("elv", body.elv);

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to delete elevation" });
  }

  return NextResponse.json({ comment: data });
}
