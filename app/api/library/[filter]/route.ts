import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
  const { filter } = await context.params;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("u_lib_list")
    .select()
    .in("lib_code", [...filter.split(",")]);

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else return NextResponse.json({ error: `Failed to fetch liblist` }, { status: 500 });
  }

  return NextResponse.json({ data });
}
