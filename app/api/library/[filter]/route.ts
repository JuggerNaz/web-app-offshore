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

  let visibleData = data?.filter((item: any) => item.hidden_item !== 'Y' && item.hidden_item !== 'y');

  // Custom sort for POSITION to match 1-12 O'CLOCK order
  if (decodedFilter === "POSITION" && visibleData) {
    const positionOrder = [
      "N/A",
      "1 O'CLOCK",
      "2 O'CLOCK",
      "3 O'CLOCK",
      "4 O'CLOCK",
      "5 O'CLOCK",
      "6 O'CLOCK",
      "7 O'CLOCK",
      "8 O'CLOCK",
      "9 O'CLOCK",
      "10 O'CLOCK",
      "11 O'CLOCK",
      "12 O'CLOCK"
    ];
    
    visibleData = visibleData.sort((a: any, b: any) => {
      const indexA = positionOrder.indexOf(a.lib_desc);
      const indexB = positionOrder.indexOf(b.lib_desc);
      
      // If both are in our predefined list, sort by the list order
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // If only A is in the list, A comes first
      if (indexA !== -1) return -1;
      // If only B is in the list, B comes first
      if (indexB !== -1) return 1;
      // Fallback to alphabetical if neither is in the list (shouldn't happen for our known items)
      return (a.lib_desc as string).localeCompare(b.lib_desc as string);
    });
  }

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
