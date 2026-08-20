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
      .from("u_lib_list")
      .select()
      .in("lib_code", codes)
      .or("lib_delete.is.null,lib_delete.neq.1");

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      } else if (error.code === "22P02") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      } else return NextResponse.json({ error: `Failed to fetch liblist` }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  const includeDeleted = request.nextUrl.searchParams.get("include_deleted") === "true";

  // Single code logic (New Feature Requirement)
  // Fetch items for specific master code, hiding hidden items, sorting by value
  let query = supabase
    .from("u_lib_list")
    .select("*")
    .eq("lib_code", decodedFilter);

  if (!includeDeleted) {
    query = query.or("lib_delete.is.null,lib_delete.neq.1");
  }

  const { data, error } = await query.order("lib_desc", { ascending: true });

  if (error) {
    return handleSupabaseError(error, "Failed to fetch library items");
  }

  let visibleData = data?.filter((item: any) => item.hidden_item !== 'Y' && item.hidden_item !== 'y');

  // Custom sort for POSITION to match 1-12 O' CLOCK order
  if (decodedFilter === "POSITION" && visibleData) {
    // Map items to have a space after O' (e.g. "O' CLOCK") and strip "POSITION " prefix
    visibleData = visibleData.map((item: any) => {
      const formatStr = (s: any) => {
        if (typeof s !== 'string') return s;
        let res = s.replace("O'CLOCK", "O' CLOCK").trim();
        res = res.replace(/^POSITION\s+/i, '').trim();
        return res;
      };
      return {
        ...item,
        lib_id: formatStr(item.lib_id),
        lib_desc: formatStr(item.lib_desc),
        lib_name: formatStr(item.lib_name)
      };
    });

    // Deduplicate by lib_desc to avoid React duplicate key warnings
    const uniqueValues = new Set();
    visibleData = visibleData.filter((item: any) => {
      if (uniqueValues.has(item.lib_desc)) return false;
      uniqueValues.add(item.lib_desc);
      return true;
    });

    const positionOrder = [
      "N/A",
      "1 O' CLOCK",
      "2 O' CLOCK",
      "3 O' CLOCK",
      "4 O' CLOCK",
      "5 O' CLOCK",
      "6 O' CLOCK",
      "7 O' CLOCK",
      "8 O' CLOCK",
      "9 O' CLOCK",
      "10 O' CLOCK",
      "11 O' CLOCK",
      "12 O' CLOCK"
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

  const libId = body.lib_id;

  // Check if an item with the same category (lib_code) and ID/Value (lib_id) already exists (including soft-deleted)
  if (libId) {
    if (String(libId).length > 12) {
      return NextResponse.json({ error: "Value/Code cannot exceed 12 characters." }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("u_lib_list")
      .select("*")
      .eq("lib_code", decodedFilter)
      .eq("lib_id", libId)
      .maybeSingle();

    if (existing) {
      // lib_delete is set to any non-null value when soft-deleted (1, "1", "Y", etc.)
      const isSoftDeleted = existing.lib_delete != null;

      if (isSoftDeleted) {
        // Automatically reactivate the record (lib_delete = null) and update attributes with new inputs
        const updatePayload = {
          ...body,
          lib_code: decodedFilter,
          workunit: '000',
          cr_user: user?.email || user?.id || 'system',
          lib_delete: null,
        };

        const { data: updated, error: updateError } = await supabase
          .from("u_lib_list")
          .update(updatePayload)
          .eq("lib_code", decodedFilter)
          .eq("lib_id", libId)
          .select()
          .single();

        if (updateError) {
          return handleSupabaseError(updateError, "Failed to reactivate library item");
        }

        return apiSuccess(updated);
      } else {
        return NextResponse.json({ error: "Item with this ID already exists" }, { status: 409 });
      }
    }
  }

  // Inject lib_code, workunit, cr_user and ensure lib_delete is null
  const payload = {
    ...body,
    lib_code: decodedFilter,
    workunit: '000',
    cr_user: user?.email || user?.id || 'system',
    lib_delete: null,
  };

  const { data, error } = await supabase
    .from("u_lib_list")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return handleSupabaseError(error, "Failed to create library item");
  }

  return apiSuccess(data);
}
