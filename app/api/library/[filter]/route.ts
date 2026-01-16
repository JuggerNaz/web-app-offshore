import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

export async function GET(request: NextRequest, { params }: { params: Promise<{ filter: string }> }) {
  const supabase = createClient();
  const { filter } = await params;
  const decodedFilter = decodeURIComponent(filter);

  // Check if multiple codes requested (comma-separated) - preserve legacy behavior
  if (decodedFilter.includes(",")) {
    const codes = decodedFilter.split(",");
    const { data, error } = await supabase
      .from("u_lib_list" as any)
      .select()
      .in("lib_code", codes);

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      } else if (error.code === "22P02") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      } else return NextResponse.json({ error: `Failed to fetch liblist` }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  // Single code logic (New Feature Requirement)
  // Fetch items for specific master code, hiding hidden items, sorting by value
  const { data, error } = await supabase
    .from("u_lib_list" as any)
    .select("*")
    .eq("lib_code", decodedFilter)
    .order("lib_desc", { ascending: true });

  if (error) {
    return handleSupabaseError(error, "Failed to fetch library items");
  }

  const visibleData = data?.filter((item: any) => item.hidden_item !== 'Y' && item.hidden_item !== 'y');

  return apiSuccess(visibleData);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ filter: string }> }) {
  const supabase = createClient();
  const { filter } = await params;
  const body = await request.json();
  const decodedFilter = decodeURIComponent(filter);

  // Get current user for cr_user
  const { data: { user } } = await supabase.auth.getUser();

  // Assuming body contains the fields to insert. We inject lib_code, workunit, cr_user
  const payload = {
    ...body,
    lib_code: decodedFilter,
    workunit: '000',
    cr_user: user?.email || user?.id || 'system'
  };

  const { data, error } = await supabase
    .from("u_lib_list" as any)
    .insert(payload)
    .select()
    .single();

  if (error) {
    return handleSupabaseError(error, "Failed to create library item");
  }

  return apiSuccess(data);
}
