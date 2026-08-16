import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  const supabase = createClient();
  const { data, error } = await supabase.from("str_elv").select("*").eq("plat_id", Number(id));

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

export async function PUT(request: Request) {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  const body = await request.json();
  const { plat_id, old_elv, elv, orient } = body;

  if (plat_id === undefined || old_elv === undefined || elv === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const platIdNum = Number(plat_id);
  const oldElvNum = Number(old_elv);
  const newElvNum = Number(elv);

  // 1. Update str_elv record
  const { data, error } = await supabase
    .from("str_elv")
    .update({ elv: newElvNum, orient, workunit: "000" })
    .eq("plat_id", platIdNum)
    .eq("elv", oldElvNum)
    .select();

  if (error) {
    console.error("Failed to update elevation:", error.message);
    return NextResponse.json({ error: error.message || "Failed to update elevation" }, { status: 500 });
  }

  // 2. Cascade update to str_level if elv value changed
  if (oldElvNum !== newElvNum) {
    console.log(`Cascade updating str_level for plat_id ${platIdNum}: ${oldElvNum} -> ${newElvNum}`);
    
    // Update elv_from in str_level
    const { error: errFrom } = await supabase
      .from("str_level")
      .update({ elv_from: newElvNum })
      .eq("plat_id", platIdNum)
      .eq("elv_from", oldElvNum);

    if (errFrom) {
      console.error("Error cascade updating str_level elv_from:", errFrom.message);
    }

    // Update elv_to in str_level
    const { error: errTo } = await supabase
      .from("str_level")
      .update({ elv_to: newElvNum })
      .eq("plat_id", platIdNum)
      .eq("elv_to", oldElvNum);

    if (errTo) {
      console.error("Error cascade updating str_level elv_to:", errTo.message);
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request, context: any) {
  const body = await request.json();

  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();

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
